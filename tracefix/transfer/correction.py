"""Correction proposals, the sandbox executor and the operator handoff.

The investigation only *proposes*. The backend revalidates everything from current records at approval time, the
admin explicitly approves, and a single serialized fulfillment decides between a credit and any incompatible outcome.
The investigation has no money-moving tool; this module is the only writer of correction postings and is reachable
solely through an authenticated staff approval on a STALLED_ADD_MONEY case.
"""
import hashlib
import json
from datetime import datetime, timedelta, timezone

from .. import store
from ..domain import now, uid
from . import catalog, contract, journal
from . import investigation
from .engine import (credit_wallet, customer_update, finish_payment, handler, mutate_case, notify, payment_row, run_row, sandbox_enabled,
                     schedule, stage, taka, bump_evidence, owner_label)

PLAN_STEPS = {
    'RESUME_ORIGINAL': ['Revalidate funding, mapping and the replay capability against current records',
                        'Resume the same funded intent once as attempt 2',
                        'Post the wallet credit through the payment engine',
                        'Confirm through the ledger adapter, then update the customer'],
    'REFRESH_CUSTOMER_STATUS': ['Confirm the posted credit amount against the intent', 'Update the customer status', 'No money moves'],
    'MONITOR_ORIGINAL': ['Save an owned follow-up with a review time', 'Keep the customer informed that the original transfer is still processing',
                         'A later credit updates this same case; no return is requested'],
}


class Refused(Exception):
    """A request that must not execute. `persist=True` means the refusal itself was recorded and must be committed."""
    def __init__(self, status, detail, persist=False, **extra):
        super().__init__(detail)
        self.status, self.detail, self.persist, self.extra = status, detail, persist, extra


def plan_row(db, plan_id):
    r = db.execute('SELECT * FROM tx_corrections WHERE id=?', (plan_id,)).fetchone()
    if not r:
        return None
    d = dict(r)
    d['eligibility'] = json.loads(d['eligibility'])
    d['observation_ids'] = json.loads(d['observation_ids'])
    d['outcome'] = json.loads(d['outcome']) if d['outcome'] else None
    return d


def plan_public(p):
    spec = catalog.CORRECTION_KINDS[p['kind']]
    return dict(plan_id=p['id'], kind=p['kind'], label=spec['label'], status=p['status'], moves_money=spec['money'],
                steps=PLAN_STEPS.get(p['kind'], []), evidence_version=p['evidence_version'], observation_ids=p['observation_ids'],
                options=p['eligibility']['options'], missing_proof=p['eligibility'].get('missing_proof', []), outcome=p['outcome'],
                sandbox_enabled=sandbox_enabled(), approved_by=p['approved_by'], approved_at=p['approved_at'])


def _performed(db, case_id):
    return [r['tool'] for r in db.execute('SELECT DISTINCT tool FROM tx_observations WHERE case_id=?', (case_id,))]


def propose(db, run, case, payment, inv, conclusion):
    kind = conclusion['kind']
    e = contract.eligibility(db, payment, run['clock_ms'], _performed(db, case['id']))
    db.execute("UPDATE tx_corrections SET status='superseded' WHERE payment_id=? AND status='proposed'", (payment['id'],))
    plan_id = uid('plan')
    db.execute('INSERT INTO tx_corrections(id,case_id,payment_id,investigation_id,kind,status,label,eligibility,evidence_version,observation_ids,created_ms,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
               (plan_id, case['id'], payment['id'], inv['id'], kind, 'proposed', catalog.CORRECTION_KINDS[kind]['label'],
                json.dumps(e, ensure_ascii=False), case['evidence_version'], json.dumps(conclusion.get('cites', [])), run['clock_ms'], now()))
    plan = plan_row(db, plan_id)
    cust = customer_update(db, run, payment, 'update', 'An investigator has found the next step and will confirm it shortly.',
                           headline='Next step identified', next_step='An investigator is confirming the next step. This page updates automatically.', case=case)
    journal.emit(db, 'CORRECTION_PROPOSED', run_id=run['id'], payment_id=payment['id'], case_id=case['id'], case_version=case['version'],
                 sim_ms=run['clock_ms'], cust=cust, payload=dict(plan_public(plan), summary=conclusion['summary']))
    return plan


def handoff(db, run, case, payment, inv, conclusion):
    """Unrepairable: correction is blocked and the case returns to an owned operator queue with the next requirement."""
    review = (datetime.now(timezone.utc) + timedelta(hours=4)).isoformat()
    need = conclusion['next_requirement']

    def apply(c):
        c['status'] = 'ESCALATED'
        c['resolution'] = 'handoff'
        c['next_review'] = review
        c['handoffs'].append(dict(id=uid('handoff'), origin='investigation', destination=c['owner'], reason=need, at=now(), status='ACKNOWLEDGED',
                                  acknowledged_at=now(), queue='Payments operations'))
        c['tasks'].append(dict(id=uid('task'), question=need, owner=c['owner'], created_at=now(), next_review=review, status='OPEN'))
        notify(c, 'Automatic correction is not possible. An operator owns your case and the next requirement is saved.')
    c = mutate_case(db, case['id'], apply, action='handoff_created')
    cust = customer_update(db, run, payment, 'update', 'We could not confirm your wallet credit with the partner yet.',
                           headline='An operator now owns your case',
                           next_step='An operator will follow up on the next requirement. Please do not send another transfer.', case=c)
    journal.emit(db, 'CORRECTION_BLOCKED', run_id=run['id'], payment_id=payment['id'], case_id=case['id'], case_version=c['version'],
                 sim_ms=run['clock_ms'], payload=dict(reasons=_blocked_reasons(db, payment, run['clock_ms'], case['id']), summary=conclusion['summary']))
    journal.emit(db, 'HANDOFF_CREATED', run_id=run['id'], payment_id=payment['id'], case_id=case['id'], case_version=c['version'],
                 sim_ms=run['clock_ms'], cust=cust,
                 payload=dict(owner=owner_label(c['owner']), queue='Payments operations', next_requirement=need, next_review=review, reference=c['reference']))
    journal.emit(db, 'CASE_STATUS_CHANGED', run_id=run['id'], payment_id=payment['id'], case_id=case['id'], case_version=c['version'],
                 sim_ms=run['clock_ms'], payload=dict(status=c['status'], resolution=c['resolution'], reference=c['reference']))


def _blocked_reasons(db, payment, clock, case_id):
    e = contract.eligibility(db, payment, clock, _performed(db, case_id))
    return [dict(kind=o['kind'], label=catalog.CORRECTION_KINDS[o['kind']]['label'], reasons=o['reasons']) for o in e['options'] if not o['eligible']]


# ------------------------------------------------------------------ approval
def approve(db, case_id, plan_id, actor, idem_key, evidence_version):
    """Runs inside the caller's BEGIN IMMEDIATE transaction. Raises Refused for anything that must not execute."""
    plan = plan_row(db, plan_id)
    case = store.get_case(db, case_id)
    if not plan or not case or plan['case_id'] != case_id or case.get('family') != catalog.FAMILY:
        raise Refused(404, 'Correction plan not found for this case.')
    digest = hashlib.sha256(f'{plan_id}:{evidence_version}'.encode()).hexdigest()
    if plan['idem_key'] == idem_key:
        if plan['digest'] != digest:
            raise Refused(409, 'This operation key was already used with different content.')
        return dict(plan['outcome'] or {}, plan_id=plan_id, status=plan['status'], replayed=True)
    if plan['status'] != 'proposed':
        raise Refused(409, f"This plan was already {plan['status']}; it cannot be approved again.", plan_status=plan['status'], outcome=plan['outcome'])
    if evidence_version != plan['evidence_version'] or case['evidence_version'] != plan['evidence_version']:
        db.execute("UPDATE tx_corrections SET status='superseded' WHERE id=? AND status='proposed'", (plan_id,))
        raise Refused(409, 'The evidence changed after this plan was proposed. Review the new evidence before approving.', persist=True)
    spec = catalog.CORRECTION_KINDS[plan['kind']]
    payment = payment_row(db, plan['payment_id'])
    run = run_row(db, payment['run_id'])
    if spec['money'] and not sandbox_enabled():
        raise Refused(403, 'Correction execution is disabled on this server. Investigation and reporting remain available.')
    e = contract.eligibility(db, payment, run['clock_ms'], _performed(db, case_id))
    option = next(o for o in e['options'] if o['kind'] == plan['kind'])
    if not option['eligible']:
        outcome = dict(result='refused', reasons=option['reasons'])
        db.execute("UPDATE tx_corrections SET status='refused', outcome=?, idem_key=?, digest=?, approved_by=?, approved_at=? WHERE id=?",
                   (json.dumps(outcome), idem_key, digest, actor, now(), plan_id))
        journal.emit(db, 'CORRECTION_BLOCKED', run_id=run['id'], payment_id=payment['id'], case_id=case_id, case_version=case['version'],
                     sim_ms=run['clock_ms'], payload=dict(plan_id=plan_id, reasons=[dict(kind=plan['kind'], label=spec['label'], reasons=option['reasons'])],
                                                          summary='Revalidation refused this correction.'))
        raise Refused(409, 'Fresh validation refused this correction: ' + ' '.join(option['reasons']), persist=True, outcome=outcome)

    db.execute('UPDATE tx_corrections SET approved_by=?, approved_at=?, idem_key=?, digest=? WHERE id=?', (actor, now(), idem_key, digest, plan_id))
    c = mutate_case(db, case_id, lambda c: c['decisions'].append(dict(id=uid('decision'), decision='CORRECTION_APPROVED', note=spec['label'], evidence_ids=[],
                                                                      evidence_version=plan['evidence_version'], actor=actor, at=now(), stale=False)),
                    actor=actor, action='correction_approved')
    journal.emit(db, 'CORRECTION_APPROVED', run_id=run['id'], payment_id=payment['id'], case_id=case_id, case_version=c['version'], sim_ms=run['clock_ms'],
                 payload=dict(plan_id=plan_id, kind=plan['kind'], label=spec['label'], approved_by=actor, moves_money=spec['money']))
    handler_fn = dict(RESUME_ORIGINAL=_start_resume, REFRESH_CUSTOMER_STATUS=_refresh_status, MONITOR_ORIGINAL=_monitor)[plan['kind']]
    outcome = handler_fn(db, run, payment, plan, c, actor)
    db.execute('UPDATE tx_corrections SET outcome=? WHERE id=?', (json.dumps(outcome), plan_id))
    return dict(outcome, plan_id=plan_id, status=plan_row(db, plan_id)['status'])


def _start_resume(db, run, payment, plan, case, actor):
    db.execute("UPDATE tx_corrections SET status='executing' WHERE id=?", (plan['id'],))
    db.execute('INSERT INTO tx_attempts(payment_id,attempt_no,parent_no,kind,started_ms,outcome,detail) VALUES (?,?,?,?,?,?,?)',
               (payment['id'], 2, 1, 'RESUMED', run['clock_ms'], 'IN_FLIGHT', 'Original funded intent resumed under the safe-replay contract'))
    stage(db, run, payment, 'retry-history', 'running', 'Attempt 2', 'Resuming the original intent', attempt_no=2)
    t = run['clock_ms']
    for off, kind in [(600, 'RESUME_QUEUE'), (1700, 'RESUME_WORKER'), (2900, 'RESUME_POST'), (3700, 'RESUME_VERIFY_REQ')]:
        schedule(db, run['id'], payment['id'], t + off, kind, plan_id=plan['id'])
    return dict(result='executing', message='Resuming the original intent once. Progress appears on the graph.')


def _refresh_status(db, run, payment, plan, case, actor):
    credit = contract.records(db, payment, run['clock_ms'])['credit']
    finish_payment(db, run, payment_row(db, payment['id']), dict(ref=credit['ref'], attempt_no=credit['attempt_no']), how='ledger confirmation')
    outcome = dict(result='completed', message='Customer status refreshed. No money moved.', posting_ref=credit['ref'])
    db.execute("UPDATE tx_corrections SET status='completed' WHERE id=?", (plan['id'],))
    journal.emit(db, 'CORRECTION_COMPLETED', run_id=run['id'], payment_id=payment['id'], case_id=case['id'], case_version=case_version(db, case['id']),
                 sim_ms=run['clock_ms'], payload=dict(plan_id=plan['id'], kind=plan['kind'], outcome=outcome, moved_money=False))
    return outcome


def case_version(db, case_id):
    r = db.execute('SELECT body FROM cases WHERE id=?', (case_id,)).fetchone()
    return json.loads(r['body'])['version']


def _monitor(db, run, payment, plan, case, actor):
    review = (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat()
    question = 'Confirm the original transfer completed. If it is still pending at the review time, escalate to the partner; do not request a return.'

    def apply(c):
        c['status'] = 'WAITING_EVIDENCE'
        c['next_review'] = review
        c['tasks'].append(dict(id=uid('task'), question=question, owner=c['owner'], created_at=now(), next_review=review, status='OPEN'))
        notify(c, 'We are waiting for the original transfer to finish. Your investigator keeps the follow-up.')
    c = mutate_case(db, case['id'], apply, actor=actor, action='follow_up_saved')
    cust = customer_update(db, run, payment, 'update', 'Your transfer is still processing and can still complete.', headline='Still processing',
                           next_step='Please do not send another transfer. We will update this page when it finishes.', case=c)
    outcome = dict(result='completed', message='Owned follow-up saved. A late credit will update this same case.', next_review=review)
    db.execute("UPDATE tx_corrections SET status='completed' WHERE id=?", (plan['id'],))
    journal.emit(db, 'CORRECTION_COMPLETED', run_id=run['id'], payment_id=payment['id'], case_id=case['id'], case_version=c['version'], sim_ms=run['clock_ms'],
                 cust=cust, payload=dict(plan_id=plan['id'], kind=plan['kind'], outcome=outcome, moved_money=False))
    journal.emit(db, 'CASE_STATUS_CHANGED', run_id=run['id'], payment_id=payment['id'], case_id=case['id'], case_version=c['version'], sim_ms=run['clock_ms'],
                 payload=dict(status=c['status'], resolution=c['resolution'], reference=c['reference']))
    from . import report
    report.save(db, run, case['id'], 'follow_up_saved')
    return outcome


# ------------------------------------------------------------------ resume steps
def _ctx(db, step):
    return run_row(db, step['run_id']), payment_row(db, step['payment_id'])


@handler('RESUME_QUEUE')
def _r_queue(db, step, args):
    run, p = _ctx(db, step)
    stage(db, run, p, 'durable-queue', 'running', 'Attempt 2 enqueued', 'Original intent resumed', attempt_no=2)


@handler('RESUME_WORKER')
def _r_worker(db, step, args):
    run, p = _ctx(db, step)
    stage(db, run, p, 'credit-worker', 'running', 'Attempt 2 processing', 'Worker is posting the credit', attempt_no=2)


@handler('RESUME_POST')
def _r_post(db, step, args):
    run, p = _ctx(db, step)
    plan = plan_row(db, args['plan_id'])
    posting = credit_wallet(db, p, 2, run['clock_ms'], correction_id=plan['id'])
    if posting is None:
        # Lost the fulfillment race: the original intent was fulfilled first. No second credit exists.
        outcome = dict(result='refused', message='The original intent was fulfilled before the replay could post. No second credit was created.')
        db.execute("UPDATE tx_corrections SET status='refused', outcome=? WHERE id=?", (json.dumps(outcome), plan['id']))
        db.execute("UPDATE tx_attempts SET outcome='CANCELLED', detail='Original intent already fulfilled' WHERE payment_id=? AND attempt_no=2", (p['id'],))
        db.execute('UPDATE tx_steps SET done=1 WHERE run_id=? AND done=0 AND kind=?', (run['id'], 'RESUME_VERIFY_REQ'))
        stage(db, run, p, 'retry-history', 'failed', 'Attempt 2 cancelled', 'The original intent had already been fulfilled', attempt_no=2)
        journal.emit(db, 'CORRECTION_BLOCKED', run_id=run['id'], payment_id=p['id'], case_id=p['case_id'], case_version=case_version(db, p['case_id']),
                     sim_ms=run['clock_ms'], payload=dict(plan_id=plan['id'], reasons=[dict(kind=plan['kind'], label=plan['label'], reasons=[outcome['message']])], summary=outcome['message']))
        return
    db.execute("UPDATE tx_attempts SET outcome='CREDITED', detail='Credit posted by the resumed attempt' WHERE payment_id=? AND attempt_no=2", (p['id'],))
    db.execute('INSERT INTO tx_partner(payment_id,at_ms,state,source_available,caps,detail) VALUES (?,?,?,?,?,?)',
               (p['id'], run['clock_ms'], 'completed', 1, json.dumps(dict(safe_replay=False, late_completion_possible=False, safe_cancel=False)),
                'Partner reports the resumed instruction processed'))
    stage(db, run, p, 'credit-worker', 'completed', 'Recovered', 'Attempt 2 posted the credit. Attempt 1 failed with a worker error.',
          attempt_no=2, extra=dict(recovered=True))
    stage(db, run, p, 'wallet-ledger', 'completed', f"{taka(p['amount_minor'])} posted", posting['ref'], attempt_no=2, amount_minor=p['amount_minor'])
    stage(db, run, p, 'retry-history', 'completed', 'Attempt 2 completed', 'Attempt 1 failed; attempt 2 credited', attempt_no=2)
    bump_evidence(db, p)


@handler('RESUME_VERIFY_REQ')
def _r_verify_req(db, step, args):
    run, p = _ctx(db, step)
    cid = investigation.request_check(db, run, p['case_id'], p, 'wallet_ledger_check', origin='verification',
                                      rationale='Confirm the resumed credit through the ledger adapter before telling the customer.')
    schedule(db, run['id'], p['id'], run['clock_ms'] + catalog.CHECK_DURATION_MS, 'RESUME_VERIFY_DONE', plan_id=args['plan_id'], check_id=cid)


@handler('RESUME_VERIFY_DONE')
def _r_verify_done(db, step, args):
    run, p = _ctx(db, step)
    plan = plan_row(db, args['plan_id'])
    ctx = investigation.check_context(db, run, p['case_id'], p, actor=plan['approved_by'], origin='verification')
    obs, case = investigation.complete_check(db, run, p['case_id'], p, 'wallet_ledger_check', args['check_id'], origin='verification', ctx=ctx)
    posting = obs['data'].get('posting')
    if not (obs['status'] == 'completed' and posting):
        return
    finish_payment(db, run, payment_row(db, p['id']), dict(ref=posting['ref'], attempt_no=posting['attempt_no']), how='resumed processing',
                   skip=('credit-worker', 'wallet-ledger'))
    outcome = dict(result='completed', message='The original intent resumed once and the credit is confirmed in the wallet ledger.',
                   posting_ref=posting['ref'], attempt_no=posting['attempt_no'])
    db.execute("UPDATE tx_corrections SET status='completed', outcome=? WHERE id=?", (json.dumps(outcome), plan['id']))
    journal.emit(db, 'CORRECTION_COMPLETED', run_id=run['id'], payment_id=p['id'], case_id=p['case_id'], case_version=case_version(db, p['case_id']),
                 sim_ms=run['clock_ms'], payload=dict(plan_id=plan['id'], kind=plan['kind'], outcome=outcome, moved_money=True, amount_minor=p['amount_minor']))
