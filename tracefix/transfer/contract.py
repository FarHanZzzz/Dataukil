"""Record-derived facts and the correction contract.

Pure reads over the simulated partners' records, as of a synthetic time. Nothing here knows a scenario label.
"""
import json
from .catalog import CORRECTION_KINDS

REQUIRED_PROOF = ['bank_record_check', 'wallet_ledger_check', 'partner_status_check', 'mapping_check', 'worker_error_check']


RECORD_SECTIONS = {'debit', 'credit', 'ret', 'partner', 'mappings', 'attempts', 'active_corrections', 'fulfillment'}


def records(db, payment, as_of_ms, *, sections=None):
    """Read only the source sections requested by an adapter.

    The privileged correction contract uses the complete set to revalidate an
    action. Investigation adapters request one source and project its output.
    Internal posting identifiers and unrestricted diagnostic text are not loaded.
    """
    selected = RECORD_SECTIONS if sections is None else set(sections)
    if selected - RECORD_SECTIONS:
        raise ValueError('Unknown record section.')
    pid = payment['id']
    legs = [leg for key, leg in (('debit', 'BANK_DEBIT'), ('credit', 'WALLET_CREDIT'), ('ret', 'BANK_RETURN')) if key in selected]
    posts = {}
    if legs:
        placeholders = ','.join('?' for _ in legs)
        posts = {r['leg']: dict(r) for r in db.execute(
            f'SELECT leg,ref,amount_minor,currency,created_at,created_ms,attempt_no FROM tx_postings WHERE payment_id=? AND created_ms<=? AND leg IN ({placeholders})',
            (pid, as_of_ms, *legs))}
    partner = db.execute('SELECT state,source_available,caps FROM tx_partner WHERE payment_id=? AND at_ms<=? ORDER BY id DESC LIMIT 1', (pid, as_of_ms)).fetchone() if 'partner' in selected else None
    maps = [dict(r) for r in db.execute('SELECT candidate_label FROM tx_mappings WHERE payment_id=? AND at_ms<=? ORDER BY id', (pid, as_of_ms))] if 'mappings' in selected else []
    attempts = [dict(r) for r in db.execute('SELECT attempt_no,kind,parent_no,outcome,started_ms FROM tx_attempts WHERE payment_id=? AND started_ms<=? ORDER BY attempt_no', (pid, as_of_ms))] if 'attempts' in selected else []
    active = db.execute("SELECT kind,status FROM tx_corrections WHERE payment_id=? AND status IN ('executing','completed')", (pid,)).fetchall() if 'active_corrections' in selected else []
    fresh = db.execute('SELECT fulfillment FROM tx_payments WHERE id=?', (pid,)).fetchone() if 'fulfillment' in selected else None
    caps = json.loads(partner['caps']) if partner else {}
    return dict(debit=posts.get('BANK_DEBIT'), credit=posts.get('WALLET_CREDIT'), ret=posts.get('BANK_RETURN'),
                partner=dict(partner) if partner else None, caps=caps, mappings=maps, attempts=attempts,
                active_corrections=[dict(a) for a in active], fulfillment=fresh['fulfillment'] if fresh else 'open')


def derive(payment, rec):
    debit, credit = rec['debit'], rec['credit']
    funding_exact = bool(debit and debit['amount_minor'] == payment['amount_minor'] and debit['currency'] == payment['currency'] and not rec['ret'])
    mapping_verified = len(rec['mappings']) == 1 and rec['mappings'][0]['candidate_label'] == payment['wallet_label']
    source_ok = bool(rec['partner'] and rec['partner']['source_available'])
    return dict(funding_exact=funding_exact, mapping_verified=mapping_verified, source_ok=source_ok,
                credit_posted=bool(credit and credit['amount_minor'] == payment['amount_minor']),
                safe_replay=bool(rec['caps'].get('safe_replay')), late_possible=bool(rec['caps'].get('late_completion_possible')),
                safe_cancel=bool(rec['caps'].get('safe_cancel')), open=rec['fulfillment'] == 'open',
                already_corrected=bool(rec['active_corrections']))


def eligibility(db, payment, as_of_ms, performed_tools=()):
    """Deterministic prerequisites, missing proof and the permitted sandbox options for this payment right now."""
    rec = records(db, payment, as_of_ms)
    f = derive(payment, rec)
    missing = [t for t in REQUIRED_PROOF if t not in set(performed_tools)]
    options = []

    reasons = []
    if not f['credit_posted']:
        reasons.append('No matching posted wallet credit exists to confirm.')
    if payment['status'] == 'COMPLETED':
        reasons.append('The customer already has the confirmed outcome.')
    options.append(dict(kind='REFRESH_CUSTOMER_STATUS', eligible=not reasons, reasons=reasons, moves_money=False,
                        summary='Credit is posted in the wallet ledger. Update the customer status; no money moves.'))

    reasons = []
    if not f['funding_exact']:
        reasons.append('Exact bank funding (amount and currency) is not established.')
    if not f['mapping_verified']:
        reasons.append('The intent does not map to exactly one wallet account.')
    if not f['source_ok']:
        reasons.append('The partner status source is unavailable.')
    if not f['safe_replay']:
        reasons.append('The correction contract exposes no safe replay for this intent.')
    if f['late_possible']:
        reasons.append('Original processing can still complete, so a replay could create a second credit.')
    if f['credit_posted'] or not f['open']:
        reasons.append('The original intent is already fulfilled or cancelled.')
    if f['already_corrected']:
        reasons.append('A correction already exists for this intent.')
    proof_gap = [t for t in REQUIRED_PROOF if t in missing]
    if proof_gap:
        reasons.append('Missing proof: ' + ', '.join(proof_gap) + '.')
    options.append(dict(kind='RESUME_ORIGINAL', eligible=not reasons, reasons=reasons, moves_money=True,
                        summary='Funding is confirmed, the credit never posted, and the contract allows the original funded intent to resume once.'))

    reasons = []
    if f['credit_posted'] or not f['open']:
        reasons.append('The original intent is already fulfilled or cancelled.')
    if not f['late_possible']:
        reasons.append('No evidence that original processing is still progressing.')
    options.append(dict(kind='MONITOR_ORIGINAL', eligible=not reasons, reasons=reasons, moves_money=False,
                        summary='Original processing can still complete. Wait, keep an owned follow-up and escalate if it does not finish.'))

    reasons = ['The correction contract exposes no safe cancellation capability.'] if not f['safe_cancel'] else []
    if f['late_possible']:
        reasons.append('Original processing can still complete, so a return could conflict with a credit.')
    if f['credit_posted']:
        reasons.append('The wallet credit already posted.')
    if not f['funding_exact']:
        reasons.append('Exact bank funding is not established.')
    options.append(dict(kind='RETURN_FUNDS', eligible=not reasons, reasons=reasons, moves_money=True,
                        summary='A return stays pending until a bank return posting is observed.'))
    for option in options:
        option['label'] = CORRECTION_KINDS[option['kind']]['label']
    return dict(options=options, missing_proof=proof_gap, facts=f)
