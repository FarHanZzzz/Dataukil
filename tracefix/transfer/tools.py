"""Read-only investigation tools.

Scope is fixed by the backend: a tool receives the payment that belongs to the authorized case and nothing else, so
neither the policy nor a future model can name another customer, endpoint or the simulator's scenario. Results are
structured, timestamped as-of records; each becomes a preserved observation. No tool writes financial state.
"""
import json
from . import catalog, contract
from .engine import taka, hms


def _u(node, state=None, title=None, fact=None, amount=None):
    d = dict(node_id=node)
    for k, v in (('state', state), ('title', title), ('fact', fact), ('amount_minor', amount)):
        if v is not None:
            d[k] = v
    return d


def run_tool(db, tool, payment, as_of_ms, performed=()):
    fn = TOOL_FUNCTIONS.get(tool)
    if fn is None:
        raise ValueError('Tool is not on the allowlist.')
    spec = catalog.TOOLS[tool]
    out = fn(db, payment, as_of_ms, performed)
    out.setdefault('status', 'completed')
    out.setdefault('node_updates', [])
    out.update(source=spec['source'], scope=f"this intent only ({payment['reference']})", tool=tool)
    return out


def bank_record_check(db, p, t, performed):
    rec = contract.records(db, p, t)
    d, r = rec['debit'], rec['ret']
    data = dict(intent_amount_minor=p['amount_minor'], currency=p['currency'], debit_count=1 if d else 0,
                debits=[dict(id=d['id'], ref=d['ref'], amount_minor=d['amount_minor'], posted_at=d['created_at'])] if d else [],
                returns=[dict(ref=r['ref'], amount_minor=r['amount_minor'])] if r else [],
                amount_matches=bool(d and d['amount_minor'] == p['amount_minor']))
    if d:
        summary = f"One debit of {taka(d['amount_minor'])} is posted ({d['ref']}); no return posting exists."
        nodes = [_u('bank-debit', 'completed', f"{taka(d['amount_minor'])} debit posted", d['ref'], d['amount_minor'])]
    else:
        summary = f'No bank debit posting was found as of {hms()}.'
        nodes = [_u('bank-debit', 'pending', 'No debit found', f'As of {hms()}')]
    return dict(summary=summary, data=data, node_updates=nodes)


def wallet_ledger_check(db, p, t, performed):
    rec = contract.records(db, p, t)
    c = rec['credit']
    if c:
        data = dict(found=True, posting=dict(id=c['id'], ref=c['ref'], amount_minor=c['amount_minor'], posted_at=c['created_at'], attempt_no=c['attempt_no']), as_of=hms())
        return dict(summary=f"A matching wallet credit of {taka(c['amount_minor'])} is posted ({c['ref']}, attempt {c['attempt_no']}).", data=data,
                    node_updates=[_u('wallet-ledger', 'completed', f"{taka(c['amount_minor'])} posted", c['ref'], c['amount_minor'])])
    return dict(summary=f'No wallet credit matches this intent as of {hms()}. This is a time-scoped lookup, not proof that none will ever post.',
                data=dict(found=False, as_of=hms()),
                node_updates=[_u('wallet-ledger', 'pending', 'No credit posted', f'As of {hms()}')])


def partner_status_check(db, p, t, performed):
    rec = contract.records(db, p, t)
    pt = rec['partner']
    cb = db.execute('SELECT * FROM tx_callbacks WHERE payment_id=? AND at_ms<=? ORDER BY id DESC LIMIT 1', (p['id'], t)).fetchone()
    if not pt or not pt['source_available']:
        return dict(status='unavailable', summary='The partner status source did not respond (HTTP 503). Nothing can be concluded about processing from this source.',
                    data=dict(source_available=False, detail=(pt or {}).get('detail', 'No response')),
                    node_updates=[_u('durable-queue', 'unavailable', 'Source unavailable', 'Partner status endpoint: HTTP 503'),
                                  _u('partner-ack', fact='Status source unavailable; not a payment failure')])
    caps = rec['caps']
    callback = dict(status=cb['status'], attempts=cb['attempts'], detail=cb['detail']) if cb else None
    state = pt['state']
    data = dict(source_available=True, state=state, capabilities=caps, detail=pt['detail'], callback=callback)
    nodes = []
    if state == 'completed':
        nodes.append(_u('durable-queue', 'completed', 'Partner reports processed', pt['detail']))
    elif state == 'stalled':
        nodes.append(_u('durable-queue', 'pending', 'No recent activity', 'No worker heartbeat for this intent'))
    else:
        nodes.append(_u('durable-queue', 'pending', 'Processing at partner', pt['detail']))
    nodes.append(_u('partner-ack', fact=f"Partner state: {state}" + ('; safe replay permitted' if caps.get('safe_replay') else '')))
    if callback and callback['status'] == 'FAILED':
        nodes.append(_u('callback-delivery', 'failed', f"Callback failed ×{callback['attempts']}", callback['detail']))
    summary = f"Partner reports the instruction as '{state}'."
    if callback and callback['status'] == 'FAILED':
        summary += f" Callback delivery failed {callback['attempts']} times."
    if caps.get('safe_replay'):
        summary += ' The contract permits one safe replay of the original intent.'
    if caps.get('late_completion_possible'):
        summary += ' The partner says original processing can still complete.'
    return dict(summary=summary, data=data, node_updates=nodes)


def attempt_history_check(db, p, t, performed):
    rec = contract.records(db, p, t)
    rows = []
    for a in rec['attempts']:
        # The connector log records only what the connector saw: acknowledgements, not the partner's internal outcome.
        seen = 'COMPLETED' if a['kind'] == 'RESUMED' and a['outcome'] == 'CREDITED' else 'NO_ACK'
        rows.append(dict(attempt_no=a['attempt_no'], kind=a['kind'], parent_no=a['parent_no'], connector_outcome=seen,
                         started_ms=a['started_ms']))
    n = len(rows)
    return dict(summary=f"{n} attempt{'s' if n != 1 else ''} on record for this intent" + ('; no duplicate intent is visible in this log.' if n == 1 else '; a second attempt exists, so a replay would need review.'),
                data=dict(count=n, attempts=rows),
                node_updates=[_u('retry-history', 'pending', f"{n} attempt{'s' if n != 1 else ''}", 'No acknowledgement recorded for attempt 1'),
                              _u('idempotency', 'completed', 'Single intent', 'One idempotency key, one logical operation')])


def mapping_check(db, p, t, performed):
    rec = contract.records(db, p, t)
    m = rec['mappings']
    if len(m) == 1 and m[0]['candidate_label'] == p['wallet_label']:
        return dict(summary=f"The intent maps to exactly one wallet account ({m[0]['candidate_label']}).",
                    data=dict(verified=True, ambiguous=False, candidates=[dict(ref=m[0]['candidate'], label=m[0]['candidate_label'])]),
                    node_updates=[_u('ref-mapping', 'completed', 'Mapped', m[0]['candidate_label'])])
    cand = [dict(ref=x['candidate'], label=x['candidate_label']) for x in m]
    return dict(summary=f"{len(m)} wallet accounts match this reference and none is verified as the intended account.",
                data=dict(verified=False, ambiguous=len(m) > 1, candidates=cand),
                node_updates=[_u('ref-mapping', 'failed', 'Ambiguous mapping', f"{len(m)} candidate wallets")])


def worker_error_check(db, p, t, performed):
    rec = contract.records(db, p, t)
    if not rec['partner'] or not rec['partner']['source_available']:
        return dict(status='unavailable', summary='Worker logs are not reachable while the partner source is down.',
                    data=dict(available=False), node_updates=[_u('credit-worker', 'unavailable', 'Source unavailable', 'Authorized logs not reachable')])
    rows = [dict(r) for r in db.execute('SELECT * FROM tx_worker_logs WHERE payment_id=? AND at_ms<=? ORDER BY id', (p['id'], t))]
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
