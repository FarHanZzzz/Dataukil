"""Read-only investigation tools.

Scope is fixed by the backend: a tool receives the payment that belongs to the authorized case and nothing else, so
neither the policy nor a future model can name another customer, endpoint or the simulator's scenario. Results are
structured, timestamped as-of records; each becomes a preserved observation. No tool writes financial state.
"""
from .. import data_dna
from . import catalog, contract
from .engine import taka, hms


def _u(node, state=None, title=None, fact=None, amount=None):
    d = dict(node_id=node)
    for k, v in (('state', state), ('title', title), ('fact', fact), ('amount_minor', amount)):
        if v is not None:
            d[k] = v
    return d


def run_tool(db, tool, payment, as_of_ms, performed=(), *, access_decision=None):
    fn = TOOL_FUNCTIONS.get(tool)
    if fn is None:
        raise ValueError('Tool is not on the allowlist.')
    spec = catalog.TOOLS[tool]
    access = access_decision if access_decision is not None else data_dna.tool_request(
        tool, payment.get('case_id'), actor='case_investigator_service')
    required = set(data_dna.TOOL_FIELDS.get(tool, [])) - set(data_dna.WITHHELD_FIELDS)
    approved = (isinstance(access, dict) and access.get('decision') in ('ALLOWED', 'MINIMIZED')
                and access.get('case_id') == payment.get('case_id') and bool(access.get('case_id'))
                and access.get('source') == tool and access.get('workflow') == 'add_money'
                and access.get('policy_version') == data_dna.POLICY_VERSION
                and access.get('purpose') == data_dna.PURPOSE and access.get('basis') == data_dna.BASIS
                and access.get('recipient') in data_dna.RECIPIENTS and bool(access.get('actor'))
                and required.issubset(set(access.get('released_fields', []))))
    if not approved:
        return dict(status='unavailable', summary='DataDNA withheld this source read. ' +
                    (access.get('reason', 'The approved case and release contract must be restored.') if isinstance(access, dict) else 'The access decision is invalid.'),
                    data={}, node_updates=[], source=spec['source'], scope='No source read performed', tool=tool)
    out = fn(db, payment, as_of_ms, performed)
    out.setdefault('status', 'completed')
    out.setdefault('node_updates', [])
    out.update(source=spec['source'], scope=f"this intent only ({payment['reference']})", tool=tool)
    return out


def bank_record_check(db, p, t, performed):
    rec = contract.records(db, p, t, sections={'debit', 'ret'})
    d, r = rec['debit'], rec['ret']
    data = dict(intent_amount_minor=p['amount_minor'], currency=p['currency'], debit_count=1 if d else 0,
                debits=[dict(ref=d['ref'], amount_minor=d['amount_minor'], posted_at=d['created_at'])] if d else [],
                returns=[dict(ref=r['ref'], amount_minor=r['amount_minor'])] if r else [],
                amount_matches=bool(d and d['amount_minor'] == p['amount_minor']))
    if d:
        summary = f"One debit of {taka(d['amount_minor'])} is posted ({d['ref']}); " + ('a return posting also exists.' if r else 'no return posting exists.')
        nodes = [_u('bank-debit', 'completed', f"{taka(d['amount_minor'])} debit posted", d['ref'], d['amount_minor'])]
    else:
        summary = f'No bank debit posting was found as of {hms()}.'
        nodes = [_u('bank-debit', 'pending', 'No debit found', f'As of {hms()}')]
    return dict(summary=summary, data=data, node_updates=nodes)


def wallet_ledger_check(db, p, t, performed):
    rec = contract.records(db, p, t, sections={'credit'})
    c = rec['credit']
    if c:
        data = dict(found=True, posting=dict(ref=c['ref'], amount_minor=c['amount_minor'], posted_at=c['created_at'], attempt_no=c['attempt_no']), as_of=hms())
        return dict(summary=f"A matching wallet credit of {taka(c['amount_minor'])} is posted ({c['ref']}, attempt {c['attempt_no']}).", data=data,
                    node_updates=[_u('wallet-ledger', 'completed', f"{taka(c['amount_minor'])} posted", c['ref'], c['amount_minor'])])
    return dict(summary=f'No wallet credit matches this intent as of {hms()}. This is a time-scoped lookup, not proof that none will ever post.',
                data=dict(found=False, as_of=hms()),
                node_updates=[_u('wallet-ledger', 'pending', 'No credit posted', f'As of {hms()}')])


def partner_status_check(db, p, t, performed):
    rec = contract.records(db, p, t, sections={'partner'})
    pt = rec['partner']
    if not pt or not pt['source_available']:
        return dict(status='unavailable', summary='The partner status source did not respond (HTTP 503). Nothing can be concluded about processing from this source.',
                    data=dict(source_available=False),
                    node_updates=[_u('durable-queue', 'unavailable', 'Source unavailable', 'Partner status endpoint: HTTP 503'),
                                  _u('partner-ack', fact='Status source unavailable; not a payment failure')])
    cb = db.execute('SELECT status,attempts FROM tx_callbacks WHERE payment_id=? AND at_ms<=? ORDER BY id DESC LIMIT 1', (p['id'], t)).fetchone()
    caps = {name: rec['caps'].get(name) is True for name in ('safe_replay', 'late_completion_possible', 'safe_cancel')}
    callback = dict(status=cb['status'] if cb['status'] in ('FAILED', 'DELIVERED', 'COMPLETED', 'PENDING') else 'UNKNOWN', attempts=cb['attempts']) if cb else None
    state = pt['state'] if pt['state'] in ('completed', 'stalled', 'processing', 'unknown') else 'unknown'
    data = dict(source_available=True, state=state, capabilities=caps, callback=callback)
    nodes = []
    if state == 'completed':
        nodes.append(_u('durable-queue', 'completed', 'Partner reports processed', 'The linked instruction has completed.'))
    elif state == 'stalled':
        nodes.append(_u('durable-queue', 'pending', 'No recent activity', 'No worker heartbeat for this intent'))
    else:
        nodes.append(_u('durable-queue', 'pending', 'Processing at partner', 'Read the linked instruction status and finality before correcting.'))
    nodes.append(_u('partner-ack', fact=f"Partner state: {state}" + ('; safe replay permitted' if caps.get('safe_replay') else '')))
    if callback and callback['status'] == 'FAILED':
        nodes.append(_u('callback-delivery', 'failed', f"Callback failed ×{callback['attempts']}", 'Delivery of the outcome acknowledgement failed.'))
    summary = f"Partner reports the instruction as '{state}'."
    if callback and callback['status'] == 'FAILED':
        summary += f" Callback delivery failed {callback['attempts']} times."
    if caps.get('safe_replay'):
        summary += ' The contract permits one safe replay of the original intent.'
    if caps.get('late_completion_possible'):
        summary += ' The partner says original processing can still complete.'
    return dict(summary=summary, data=data, node_updates=nodes)


def attempt_history_check(db, p, t, performed):
    rec = contract.records(db, p, t, sections={'attempts'})
    rows = []
    for a in rec['attempts']:
        # The connector log records only what the connector saw: acknowledgements, not the partner's internal outcome.
        seen = 'COMPLETED' if a['kind'] == 'RESUMED' and a['outcome'] == 'CREDITED' else 'NO_ACK'
        rows.append(dict(attempt_no=a['attempt_no'], kind=a['kind'] if a['kind'] in ('ORIGINAL', 'RESUMED') else 'OTHER', parent_no=a['parent_no'], connector_outcome=seen,
                         started_ms=a['started_ms']))
    n = len(rows)
    return dict(summary=f"{n} attempt{'s' if n != 1 else ''} on record for this intent" + ('; no duplicate intent is visible in this log.' if n == 1 else '; a second attempt exists, so a replay would need review.'),
                data=dict(count=n, attempts=rows),
                node_updates=[_u('retry-history', 'pending', f"{n} attempt{'s' if n != 1 else ''}", 'No acknowledgement recorded for attempt 1'),
                              _u('idempotency', 'completed', 'Single intent', 'One idempotency key, one logical operation')])


def mapping_check(db, p, t, performed):
    rec = contract.records(db, p, t, sections={'mappings'})
    m = rec['mappings']
    tokens = [f'candidate-{i + 1}' for i in range(len(m))]
    projected = dict(candidate_count=len(m), candidate_tokens=tokens, candidates=[dict(token=token) for token in tokens])
    if len(m) == 1 and m[0]['candidate_label'] == p['wallet_label']:
        return dict(summary='The intent maps to exactly one verified wallet account; account identifiers remain at the source.',
                    data=dict(verified=True, ambiguous=False, **projected),
                    node_updates=[_u('ref-mapping', 'completed', 'Mapped', 'One verified account; identifiers withheld')])
    return dict(summary=f"{len(m)} wallet accounts match this reference and none is verified as the intended account.",
                data=dict(verified=False, ambiguous=len(m) > 1, **projected),
                node_updates=[_u('ref-mapping', 'failed', 'Ambiguous mapping', f"{len(m)} candidate wallets")])


def worker_error_check(db, p, t, performed):
    rec = contract.records(db, p, t, sections={'partner'})
    if not rec['partner'] or not rec['partner']['source_available']:
        return dict(status='unavailable', summary='Worker logs are not reachable while the partner source is down.',
                    data=dict(available=False), node_updates=[_u('credit-worker', 'unavailable', 'Source unavailable', 'Authorized logs not reachable')])
    messages = {
        'LEDGER_LOCK_TIMEOUT': 'The credit worker stopped before posting because the ledger lock timed out.',
        'INGRESS_BACKLOG': 'The linked instruction is queued behind earlier work; no error is recorded.',
        'CALLBACK_DELIVERY_FAILED': 'Delivery of the outcome acknowledgement failed after credit.',
    }
    rows = []
    for record in db.execute('SELECT level,code,attempt_no,retryable FROM tx_worker_logs WHERE payment_id=? AND at_ms<=? ORDER BY id', (p['id'], t)):
        code = record['code'] if record['code'] in messages else 'UNCLASSIFIED_DIAGNOSTIC'
        rows.append(dict(level=record['level'] if record['level'] in ('ERROR', 'WARN', 'INFO') else 'UNKNOWN', code=code,
                         message=messages.get(code, 'An unclassified diagnostic requires operator review; raw content is withheld.'),
                         attempt_no=record['attempt_no'], retryable=bool(record['retryable'])))
    errors = [r for r in rows if r['level'] == 'ERROR']
    warns = [r for r in rows if r['level'] == 'WARN']
    data = dict(available=True, record_count=len(rows),
                records=[dict(level=r['level'], code=r['code'], message=r['message'], attempt_no=r['attempt_no'], retryable=bool(r['retryable'])) for r in rows],
                error=dict(code=errors[0]['code'], message=errors[0]['message'], attempt_no=errors[0]['attempt_no'], retryable=bool(errors[0]['retryable'])) if errors else None,
                warnings=[w['code'] for w in warns])
    if errors:
        e = errors[0]
        return dict(summary=f"Worker error before credit on attempt {e['attempt_no']}: {e['code']} ({'retryable' if e['retryable'] else 'not retryable'}).", data=data,
                    node_updates=[_u('credit-worker', 'failed', 'Worker error before credit', e['code']),
                                  _u('dead-letter', 'failed', '1 error record', e['code'])])
    if warns:
        return dict(summary='No worker error is recorded. The log shows an ingress backlog warning for this intent.', data=data,
                    node_updates=[_u('credit-worker', 'pending', 'Queued, no error', warns[0]['code']),
                                  _u('dead-letter', 'completed', 'No error records', 'Nothing dead-lettered')])
    return dict(summary='No worker error or warning is recorded for this intent.', data=data,
                node_updates=[_u('dead-letter', 'completed', 'No error records', 'Nothing dead-lettered')])


def eligibility_check(db, p, t, performed):
    e = contract.eligibility(db, p, t, performed)
    elig = [o for o in e['options'] if o['eligible']]
    summary = ('Permitted: ' + '; '.join(catalog.CORRECTION_KINDS[o['kind']]['label'] for o in elig) + '.') if elig else \
        'No correction option is permitted. ' + (e['options'][1]['reasons'][0] if e['options'][1]['reasons'] else '')
    ret = next(o for o in e['options'] if o['kind'] == 'RETURN_FUNDS')
    return dict(summary=summary, data=dict(options=e['options'], missing_proof=e['missing_proof'], facts=e['facts']),
                node_updates=[_u('reconciliation', fact='Eligibility evaluated'),
                              _u('return-path', 'pending' if not ret['eligible'] else 'unknown', 'Return not permitted' if not ret['eligible'] else None,
                                 ret['reasons'][0] if ret['reasons'] else None)])


TOOL_FUNCTIONS = dict(bank_record_check=bank_record_check, wallet_ledger_check=wallet_ledger_check, partner_status_check=partner_status_check,
                      attempt_history_check=attempt_history_check, mapping_check=mapping_check, worker_error_check=worker_error_check,
                      eligibility_check=eligibility_check)
