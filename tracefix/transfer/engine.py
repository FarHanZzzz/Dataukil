"""Simulated bank-funded wallet payment engine.

Every state change is a step executed on a run's synthetic clock inside one SQLite transaction together with the
journal event that announces it. The scenario label is read only here, to decide which *records* the simulated
partners write. Tools and the investigation policy read those records, never this module's scenario table.
"""
import asyncio
import hashlib
import json
import os
import secrets
import time
from datetime import datetime, timedelta, timezone

from .. import store
from ..domain import now, uid
from . import catalog, datadna, journal

DHAKA = timezone(timedelta(hours=6))
HANDLERS = {}


def handler(kind):
    def deco(fn):
        HANDLERS[kind] = fn
        return fn
    return deco


def sandbox_enabled():
    return os.environ.get('TRACEFIX_SANDBOX_CORRECTIONS', '1') != '0'


def check_budget():
    try:
        return max(1, min(20, int(os.environ.get('TRACEFIX_CHECK_BUDGET', catalog.DEFAULT_CHECK_BUDGET))))
    except ValueError:
        return catalog.DEFAULT_CHECK_BUDGET


def incident_after_ms():
    try:
        return max(2000, int(os.environ.get('TRACEFIX_INCIDENT_AFTER_MS', catalog.INCIDENT_AFTER_MS)))
    except ValueError:
        return catalog.INCIDENT_AFTER_MS


# ------------------------------------------------------------------ formatting
def taka(minor):
    return f'৳{minor / 100:,.2f}'


def bdt(minor):
    return f'BDT {minor / 100:,.2f}'


def hms(iso=None):
    t = datetime.fromisoformat(iso) if iso else datetime.now(timezone.utc)
    return t.astimezone(DHAKA).strftime('%H:%M:%S')


# ------------------------------------------------------------------ runs
def run_row(db, run_id):
    r = db.execute('SELECT * FROM tx_runs WHERE id=?', (run_id,)).fetchone()
    return dict(r) if r else None


def create_run(db, scenario=None, speed=1.0, replaces=None):
    scenario = scenario or catalog.DEFAULT_SCENARIO
    if scenario not in catalog.SCENARIOS:
        raise ValueError('Unknown scenario.')
    run_id = uid('run')
    db.execute('INSERT INTO tx_runs(id,scenario,speed,paused,clock_ms,seed,status,created_at,replaces) VALUES (?,?,?,?,?,?,?,?,?)',
               (run_id, scenario, speed, 0, 0, secrets.randbelow(10**6), 'active', now(), replaces))
    if replaces:
        db.execute("UPDATE tx_runs SET status='archived' WHERE id=?", (replaces,))
    return run_row(db, run_id)


def default_run(db):
    """The most recent active run, or a new run with the default scenario (a direct visit to /customer/payment)."""
    r = db.execute("""SELECT id FROM tx_runs WHERE status='active' AND NOT EXISTS (
                       SELECT 1 FROM tx_chats c JOIN tx_payments p ON p.id=c.payment_id
                       WHERE p.run_id=tx_runs.id AND c.isolated=1)
                       ORDER BY created_at DESC, rowid DESC LIMIT 1""").fetchone()
    return run_row(db, r['id']) if r else create_run(db)


def control_run(db, run_id, action, speed=None):
    run = run_row(db, run_id)
    if not run or run['status'] != 'active':
        raise LookupError('Run not found or no longer active.')
    if action == 'pause':
        db.execute('UPDATE tx_runs SET paused=1 WHERE id=?', (run_id,))
    elif action == 'play':
        db.execute('UPDATE tx_runs SET paused=0 WHERE id=?', (run_id,))
    elif action == 'speed':
        if speed not in (1, 2, 4):
            raise ValueError('Presentation speed must be 1, 2 or 4.')
        db.execute('UPDATE tx_runs SET speed=? WHERE id=?', (float(speed), run_id))
    else:
        raise ValueError('Unknown clock action.')
    run = run_row(db, run_id)
    journal.emit(db, 'CLOCK_CHANGED', run_id=run_id, payload=dict(paused=bool(run['paused']), speed=run['speed'], clock_ms=run['clock_ms']),
                 sim_ms=run['clock_ms'])
    return run


def schedule(db, run_id, payment_id, due_ms, kind, **args):
    db.execute('INSERT INTO tx_steps(run_id,payment_id,due_ms,kind,args) VALUES (?,?,?,?,?)',
               (run_id, payment_id, due_ms, kind, json.dumps(args)))


# ------------------------------------------------------------------ payments & ledger
def payment_row(db, payment_id):
    r = db.execute('SELECT * FROM tx_payments WHERE id=?', (payment_id,)).fetchone()
    return dict(r) if r else None


def stage(db, run, payment, node_id, state, title, fact='', *, attempt_no=1, amount_minor=None, cust=None, case_id=None, extra=None):
    """Announce an observed processing stage. `state`: completed|pending|running|failed|unavailable|unknown."""
    if node_id not in catalog.NODE_IDS:
        raise ValueError(node_id)
    payload = dict(node_id=node_id, state=state, title=title, fact=fact, attempt_no=attempt_no)
    if amount_minor is not None:
        payload['amount_minor'] = amount_minor
    if extra:
        payload.update(extra)
    case_id = case_id or payment.get('case_id')
    cv = case_version(db, case_id)
    return journal.emit(db, 'STAGE_OBSERVED', run_id=run['id'], payment_id=payment['id'], case_id=case_id, case_version=cv,
                        node_id=node_id, payload=payload, cust=cust, sim_ms=run['clock_ms'])


def dna_flow(db, run, payment, hop, state='sent'):
    """Review one hand-off of this payment through the DataDNA gates and save the decision on the run clock.

    Facts come from the saved records only. Flow reviews carry no case id so a customer page, which never receives them,
    and the investigation ledger, which is keyed by case, stay separate; the report joins them by payment."""
    env = journal.processing_envelope(db, payment['id'])
    if not env:  # a payment created before DataDNA existed: open its envelope at the first hand-off
        env = datadna.open_processing_envelope(payment)
        journal.emit(db, 'DATADNA_ENVELOPE', run_id=run['id'], payment_id=payment['id'], node_id='intent', sim_ms=run['clock_ms'], payload=env)
    facts = {}
    if hop == 'partner':
        facts['candidates'] = db.execute('SELECT COUNT(*) AS n FROM tx_mappings WHERE payment_id=?', (payment['id'],)).fetchone()['n']
    rec = datadna.review_flow(env, payment, hop, state=state, facts=facts, sim_ms=run['clock_ms'])
    journal.emit(db, 'DATADNA_REVIEWED', run_id=run['id'], payment_id=payment['id'], node_id=rec['node'], sim_ms=run['clock_ms'], payload=rec)
    return rec


def case_version(db, case_id):
    if not case_id:
        return None
    r = db.execute('SELECT body FROM cases WHERE id=?', (case_id,)).fetchone()
    return json.loads(r['body'])['version'] if r else None


def post_ledger(db, payment, leg, attempt_no, clock_ms, lines, correction_id=None):
    """Immutable balanced posting; returns None if this logical leg already exists (funding-leg uniqueness)."""
    debit = sum(a for _, s, a in lines if s == 'D')
    credit = sum(a for _, s, a in lines if s == 'C')
    if debit != credit or debit != payment['amount_minor']:
        raise ValueError('Unbalanced posting refused.')
    pid = uid('post')
    ref = {'BANK_DEBIT': 'BNK', 'WALLET_CREDIT': 'WLT', 'BANK_RETURN': 'RTN'}[leg] + '-' + secrets.token_hex(4).upper()
    try:
        db.execute('INSERT INTO tx_postings(id,payment_id,leg,amount_minor,currency,attempt_no,ref,created_ms,created_at,correction_id) VALUES (?,?,?,?,?,?,?,?,?,?)',
                   (pid, payment['id'], leg, payment['amount_minor'], payment['currency'], attempt_no, ref, clock_ms, now(), correction_id))
    except Exception as e:  # sqlite3.IntegrityError on UNIQUE(payment_id, leg)
        if 'UNIQUE' in str(e):
            return None
        raise
    for account, side, amount in lines:
        db.execute('INSERT INTO tx_posting_lines VALUES (?,?,?,?)', (pid, account, side, amount))
    return dict(id=pid, ref=ref, leg=leg, amount_minor=payment['amount_minor'], attempt_no=attempt_no)


def credit_wallet(db, payment, attempt_no, clock_ms, correction_id=None):
    """Single serialized fulfillment. Whichever of the original worker or a correction gets here first wins."""
    claimed = db.execute("UPDATE tx_payments SET fulfillment='fulfilled' WHERE id=? AND fulfillment='open'", (payment['id'],)).rowcount
    if not claimed:
        return None
    wallet = f"wallet:{payment['wallet_label']}"
    posting = post_ledger(db, payment, 'WALLET_CREDIT', attempt_no, clock_ms,
                          [('clearing:add-money', 'D', payment['amount_minor']), (wallet, 'C', payment['amount_minor'])], correction_id)
    if posting is None:  # logical leg already posted: undo the claim by raising so the whole step rolls back
        raise RuntimeError('Funding leg already credited.')
    return posting


def mutate_case(db, case_id, fn, actor='system', action='update'):
    c = store.get_case(db, case_id)
    fn(c)
    c['version'] += 1
    c['updated_at'] = now()
    store.save_case(db, c)
    store.audit(db, c, actor, action)
    return c


def notify(c, text):
    c['notifications'].append(dict(at=now(), text=text))


def customer_update(db, run, payment, kind, text, *, headline=None, facts=None, next_step=None, case=None, stage_key=None, completed=False):
    cust = dict(kind=kind, text=text, headline=headline or text)
    if facts:
        cust['facts'] = facts
    if next_step:
        cust['next_step'] = next_step
    if stage_key:
        cust['stage'] = stage_key
    if case:
        cust['case_ref'] = case['reference']
        cust['owner'] = owner_label(case['owner'])
    if completed:
        cust['completed'] = True
    return cust


def owner_label(actor):
    return {'staff_1': 'Investigator 1', 'staff_2': 'Investigator 2'}.get(actor, actor)


def mark_payment(db, payment_id, status):
    db.execute('UPDATE tx_payments SET status=? WHERE id=?', (status, payment_id))


def create_payment(db, run, owner, key, digest, amount_minor, bank_code):
    bank = next((b for b in catalog.BANKS if b['code'] == bank_code), None)
    if not bank:
        raise ValueError('Choose one of the listed fixture banks.')
    pid = uid('pay')
    reference = 'ADD-' + secrets.token_hex(3).upper()
    db.execute('INSERT INTO tx_payments(id,run_id,owner,idem_key,digest,amount_minor,currency,bank_code,bank_label,wallet_label,reference,status,fulfillment,created_at,created_ms) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
               (pid, run['id'], owner, key, digest, amount_minor, catalog.CURRENCY, bank['code'],
                f"{bank['name']} {bank['mask']}", f"{catalog.WALLET['name']} {catalog.WALLET['mask']}", reference, 'IN_PROGRESS', 'open', now(), run['clock_ms']))
    db.execute('INSERT INTO tx_attempts(payment_id,attempt_no,parent_no,kind,started_ms,outcome,detail) VALUES (?,?,?,?,?,?,?)',
               (pid, 1, None, 'ORIGINAL', run['clock_ms'], 'IN_FLIGHT', ''))
    payment = payment_row(db, pid)
    cust = customer_update(db, run, payment, 'stage', 'Request received', headline='Request received', stage_key='created')
    journal.emit(db, 'INTENT_CREATED', run_id=run['id'], payment_id=pid, node_id='intent', sim_ms=run['clock_ms'], cust=cust,
                 payload=dict(node_id='intent', state='completed', title='Intent created', fact=f"{taka(amount_minor)} from {payment['bank_label']}",
                              attempt_no=1, amount_minor=amount_minor, reference=reference, bank_label=payment['bank_label'],
                              wallet_label=payment['wallet_label']))
    env = datadna.open_processing_envelope(payment)
    journal.emit(db, 'DATADNA_ENVELOPE', run_id=run['id'], payment_id=pid, node_id='intent', sim_ms=run['clock_ms'], payload=env)
    dna_flow(db, run, payment, 'request')
    t0 = run['clock_ms']
    for offset, kind in [(500, 'VALIDATION'), (1000, 'AUTH'), (1600, 'FUNDING'), (2400, 'BANK'), (3200, 'ROUTE'),
                         (catalog.ACK_TIMEOUT_AFTER_MS, 'ACK_TIMEOUT'), (incident_after_ms(), 'INCIDENT')]:
        schedule(db, run['id'], pid, t0 + offset, kind)
    for entry in SCRIPTS[run['scenario']]:
        offset, kind = entry[0], entry[1]
        schedule(db, run['id'], pid, t0 + offset, kind, **(entry[2] if len(entry) > 2 else {}))
    return payment_row(db, pid)


# Hidden fault scripts: which records the simulated partners write, and when. Offsets are synthetic ms after intent creation.
SCRIPTS = {
    'worker_fault': [(5200, 'WORKER_FAIL')],
    'lost_ack': [(5200, 'CREDIT_ORIGINAL'), (6400, 'CALLBACK_FAIL')],
    'mapping_ambiguity': [(4200, 'PARTNER_DOWN')],
    'late_completion': [(5200, 'QUEUE_BACKLOG'), (48000, 'CREDIT_ORIGINAL', dict(late=True))],
}


# ------------------------------------------------------------------ step handlers
def _ctx(db, step):
    run = run_row(db, step['run_id'])
    payment = payment_row(db, step['payment_id']) if step['payment_id'] else None
    return run, payment


@handler('VALIDATION')
def _validation(db, step, args):
    run, p = _ctx(db, step)
    stage(db, run, p, 'validation', 'completed', 'Validated', 'Amount and accounts accepted')
    stage(db, run, p, 'idempotency', 'completed', 'Key recorded', 'A repeated submit reuses this intent')


@handler('AUTH')
def _auth(db, step, args):
    run, p = _ctx(db, step)
    cust = customer_update(db, run, p, 'stage', 'Request accepted', headline='Request accepted', stage_key='accepted')
    stage(db, run, p, 'authorization', 'completed', 'Authorized', 'Request accepted', cust=cust)


@handler('FUNDING')
def _funding(db, step, args):
    run, p = _ctx(db, step)
    dna_flow(db, run, p, 'bank')
    stage(db, run, p, 'funding-check', 'completed', 'Funds available', 'Bank funding check passed')


@handler('BANK')
def _bank(db, step, args):
    run, p = _ctx(db, step)
    post_ledger(db, p, 'BANK_DEBIT', 1, run['clock_ms'],
                [(f"bank:{p['bank_code']}:customer", 'D', p['amount_minor']), ('clearing:add-money', 'C', p['amount_minor'])])
    cust = customer_update(db, run, p, 'stage', 'Your bank approved the request', headline='Bank approval received', stage_key='bank',
                           facts=['Your bank approved the request.'])
    stage(db, run, p, 'bank-response', 'completed', 'Approved', f"Bank approval for {p['reference']}", cust=cust)


@handler('ROUTE')
def _route(db, step, args):
    run, p = _ctx(db, step)
    wallet_a = 'W-' + secrets.token_hex(3).upper()
    db.execute('INSERT INTO tx_mappings(payment_id,source_ref,candidate,candidate_label,at_ms) VALUES (?,?,?,?,?)',
               (p['id'], p['reference'], wallet_a, p['wallet_label'], run['clock_ms']))
    if run['scenario'] == 'mapping_ambiguity':
        db.execute('INSERT INTO tx_mappings(payment_id,source_ref,candidate,candidate_label,at_ms) VALUES (?,?,?,?,?)',
                   (p['id'], p['reference'], 'W-' + secrets.token_hex(3).upper(), f"{catalog.WALLET['name']} ••0127", run['clock_ms']))
    db.execute('INSERT INTO tx_partner(payment_id,at_ms,state,source_available,caps,detail) VALUES (?,?,?,?,?,?)',
               (p['id'], run['clock_ms'], 'processing', 1, json.dumps({}), 'Instruction accepted for delivery'))
    dna_flow(db, run, p, 'partner')
    stage(db, run, p, 'routing-request', 'completed', 'Sent · attempt 1', 'Routed to the wallet partner')
    stage(db, run, p, 'partner-ack', 'pending', 'Waiting', 'No acknowledgement yet')
    stage(db, run, p, 'retry-history', 'pending', 'Attempt 1', 'Awaiting an outcome')


@handler('WORKER_FAIL')
def _worker_fail(db, step, args):
    run, p = _ctx(db, step)
    db.execute('INSERT INTO tx_worker_logs(payment_id,attempt_no,at_ms,level,code,message,retryable) VALUES (?,?,?,?,?,?,?)',
               (p['id'], 1, run['clock_ms'], 'ERROR', 'LEDGER_LOCK_TIMEOUT', 'Credit worker aborted before posting: ledger lock timeout.', 1))
    db.execute("UPDATE tx_attempts SET outcome='WORKER_ERROR', detail='Credit worker aborted before posting' WHERE payment_id=? AND attempt_no=1", (p['id'],))
    db.execute('INSERT INTO tx_partner(payment_id,at_ms,state,source_available,caps,detail) VALUES (?,?,?,?,?,?)',
               (p['id'], run['clock_ms'], 'stalled', 1, json.dumps(dict(safe_replay=True, late_completion_possible=False, safe_cancel=False)),
                'No worker heartbeat for this intent; contract permits replay of the original funded intent'))


@handler('QUEUE_BACKLOG')
def _backlog(db, step, args):
    run, p = _ctx(db, step)
    db.execute('INSERT INTO tx_worker_logs(payment_id,attempt_no,at_ms,level,code,message,retryable) VALUES (?,?,?,?,?,?,?)',
               (p['id'], 1, run['clock_ms'], 'WARN', 'INGRESS_BACKLOG', 'Ingress backlog: this intent is queued behind earlier work. No error recorded.', 0))
    db.execute('INSERT INTO tx_partner(payment_id,at_ms,state,source_available,caps,detail) VALUES (?,?,?,?,?,?)',
               (p['id'], run['clock_ms'], 'processing', 1,
                json.dumps(dict(safe_replay=False, late_completion_possible=True, safe_cancel=False)),
                'Original instruction is queued and can still complete'))


@handler('PARTNER_DOWN')
def _partner_down(db, step, args):
    run, p = _ctx(db, step)
    db.execute("UPDATE tx_attempts SET outcome='UNKNOWN', detail='Partner source unreachable' WHERE payment_id=? AND attempt_no=1", (p['id'],))
    db.execute('INSERT INTO tx_partner(payment_id,at_ms,state,source_available,caps,detail) VALUES (?,?,?,?,?,?)',
               (p['id'], run['clock_ms'], 'unknown', 0, json.dumps({}), 'Status endpoint returned HTTP 503'))


@handler('CALLBACK_FAIL')
def _callback_fail(db, step, args):
    run, p = _ctx(db, step)
    db.execute('INSERT INTO tx_callbacks(payment_id,at_ms,status,attempts,detail) VALUES (?,?,?,?,?)',
               (p['id'], run['clock_ms'], 'FAILED', 3, 'Connection reset by the acknowledgement endpoint'))
    db.execute('INSERT INTO tx_worker_logs(payment_id,attempt_no,at_ms,level,code,message,retryable) VALUES (?,?,?,?,?,?,?)',
               (p['id'], 1, run['clock_ms'], 'INFO', 'CALLBACK_DELIVERY_FAILED', 'Acknowledgement callback failed three times after the credit posted.', 0))


@handler('CREDIT_ORIGINAL')
def _credit_original(db, step, args):
    run, p = _ctx(db, step)
    posting = credit_wallet(db, p, 1, run['clock_ms'])
    if posting is None:
        return  # a correction or earlier fulfillment already won; the original is a no-op
    db.execute("UPDATE tx_attempts SET outcome='CREDITED', detail='Credit posted by the original attempt' WHERE payment_id=? AND attempt_no=1", (p['id'],))
    db.execute('INSERT INTO tx_partner(payment_id,at_ms,state,source_available,caps,detail) VALUES (?,?,?,?,?,?)',
               (p['id'], run['clock_ms'], 'completed', 1, json.dumps(dict(safe_replay=False, late_completion_possible=False, safe_cancel=False)),
                'Partner reports the instruction processed'))
    bump_evidence(db, p)
    if args.get('late'):
        finish_payment(db, run, payment_row(db, p['id']), posting, how='late original completion')


def bump_evidence(db, payment):
    """Material record change: new evidence version, which invalidates any approval bound to the old one."""
    if payment.get('case_id'):
        mutate_case(db, payment['case_id'], lambda c: c.__setitem__('evidence_version', c['evidence_version'] + 1), action='evidence_changed')
        db.execute("UPDATE tx_corrections SET status='superseded' WHERE payment_id=? AND status='proposed'", (payment['id'],))


def finish_payment(db, run, payment, posting, how, skip=()):
    """Confirmed credit reaches the customer: nodes go green, customer status completes, case closes."""
    pid = payment['id']
    t = run['clock_ms']
    amt = payment['amount_minor']
    a = posting['attempt_no']
    if 'wallet-ingress' not in skip:
        stage(db, run, payment, 'wallet-ingress', 'completed', 'Accepted', '', attempt_no=a)
    if 'durable-queue' not in skip:
        stage(db, run, payment, 'durable-queue', 'completed', 'Dequeued', f'Attempt {a}', attempt_no=a)
    if 'credit-worker' not in skip:
        stage(db, run, payment, 'credit-worker', 'completed', 'Credit worker completed', f'Posted {taka(amt)}', attempt_no=a)
    if 'wallet-ledger' not in skip:
        stage(db, run, payment, 'wallet-ledger', 'completed', f'{taka(amt)} posted', posting['ref'], attempt_no=a, amount_minor=amt)
    dna_flow(db, run, payment, 'ack')
    stage(db, run, payment, 'partner-ack', 'completed', 'Acknowledged', 'Partner acknowledged late' if how.startswith('late') else 'Partner acknowledged')
    stage(db, run, payment, 'posting-verify', 'completed', 'Posting verified', posting['ref'])
    stage(db, run, payment, 'reconciliation', 'completed', 'Bank and wallet match', f"{taka(amt)} debit matches credit")
    stage(db, run, payment, 'ack-return', 'completed', 'Acknowledged', 'Returned to the customer channel')
    case = store.get_case(db, payment['case_id']) if payment.get('case_id') else None
    cust = customer_update(db, run, payment, 'completed', f'Your {taka(amt)} is now in your wallet.', headline='Wallet credit confirmed',
                           facts=[f'{taka(amt)} was credited to {payment["wallet_label"]}.', f'Wallet reference {posting["ref"]}.'],
                           next_step='Nothing else is needed.', case=case, stage_key='confirmed', completed=True)
    dna_flow(db, run, payment, 'customer', 'confirmed')
    stage(db, run, payment, 'customer-update', 'completed', 'Customer updated', f'Confirmed via {how}', cust=cust)
    mark_payment(db, pid, 'COMPLETED')
    if case:
        def done(c):
            c['status'] = 'OUTCOME_RECORDED'
            c['resolution'] = 'credit_confirmed'
            c['next_review'] = now()
            notify(c, f'Your wallet credit was confirmed ({how}).')
        c = mutate_case(db, case['id'], done, action='credit_confirmed')
        journal.emit(db, 'CASE_STATUS_CHANGED', run_id=run['id'], payment_id=pid, case_id=c['id'], case_version=c['version'], sim_ms=t,
                     payload=dict(status=c['status'], resolution=c['resolution'], reference=c['reference']))
    journal.emit(db, 'PAYMENT_COMPLETED', run_id=run['id'], payment_id=pid, case_id=payment.get('case_id'),
                 case_version=case_version(db, payment.get('case_id')), sim_ms=t,
                 payload=dict(amount_minor=amt, how=how, posting_ref=posting['ref']))
    if case:  # keep the operator report in step with the final outcome
        from . import report
        report.save(db, run, case['id'], 'outcome_recorded')


@handler('ACK_TIMEOUT')
def _ack_timeout(db, step, args):
    run, p = _ctx(db, step)
    if p['status'] == 'COMPLETED':
        return
    mark_payment(db, p['id'], 'UNCERTAIN')
    stage(db, run, p, 'partner-ack', 'failed', 'Acknowledgement timed out', 'No reply within the expected window')
    stage(db, run, p, 'retry-history', 'pending', 'Attempt 1', 'No outcome recorded; no retry yet')
    stage(db, run, p, 'ack-return', 'pending', 'Nothing to return', 'No acknowledgement received')
    cust = customer_update(db, run, p, 'uncertain', 'We have not confirmed your wallet credit yet.', headline='Wallet credit not confirmed yet',
                           next_step='Please do not send another transfer. We are checking and will update this page.', stage_key='wallet')
    dna_flow(db, run, p, 'customer', 'unconfirmed')
    stage(db, run, p, 'customer-update', 'pending', 'Outcome unconfirmed', 'Customer told the credit is not yet confirmed', cust=cust)


@handler('INCIDENT')
def _incident(db, step, args):
    run, p = _ctx(db, step)
    if p['status'] == 'COMPLETED' or p['case_id']:
        return
    open_incident(db, run, p, 'threshold')


def open_incident(db, run, payment, reason):
    """Create or reuse the single incident for this payment. A customer report attaches to it rather than duplicating."""
    payment = payment_row(db, payment['id'])
    if payment['case_id']:
        return store.get_case(db, payment['case_id'])
    cid = uid('case')
    c = dict(id=cid, reference='TF-' + secrets.token_hex(4).upper(), family=catalog.FAMILY, customer_id=payment['owner'],
             purchase_id=payment['id'], qr_reference=None, unlinked_reference=payment['reference'], reported_purchase='',
             second_method='other', description='Bank-funded add-money to the wallet has no confirmed credit.',
             reported_amount_minor=payment['amount_minor'], owner='staff_1', status='OPEN', version=1, evidence_version=1,
             created_at=now(), updated_at=now(), next_review=(datetime.now(timezone.utc) + timedelta(hours=4)).isoformat(),
             evidence=[], analysis=None, analyses=[], checks=[], tasks=[], handoffs=[], decisions=[], notifications=[],
             payment_id=payment['id'], run_id=run['id'], bank_label=payment['bank_label'], wallet_label=payment['wallet_label'],
             complaints=[], resolution='open', incident_reason=reason)
    notify(c, 'We opened an investigation for this payment. An investigator now owns it.')
    store.save_case(db, c)
    store.audit(db, c, 'system', 'incident_opened', reason)
    db.execute('UPDATE tx_payments SET case_id=?, incident_ms=? WHERE id=?', (cid, run['clock_ms'], payment['id']))
    cust = customer_update(db, run, payment, 'incident', 'An investigator now owns this payment.', headline='Investigation opened',
                           next_step='An investigator is reviewing the saved payment records.', case=c, stage_key='wallet')
    journal.emit(db, 'INCIDENT_OPENED', run_id=run['id'], payment_id=payment['id'], case_id=cid, case_version=c['version'], sim_ms=run['clock_ms'],
                 cust=cust, payload=dict(reference=c['reference'], owner=owner_label(c['owner']), reason=reason, amount_minor=payment['amount_minor']))
    return c


def attach_complaint(db, run, payment, actor, note):
    """Customer 'Report an issue': attach to the incident (creating it now if the threshold has not elapsed)."""
    case = open_incident(db, run, payment, 'customer_report')
    note = (note or '').strip()

    def add(c):
        c.setdefault('complaints', []).append(dict(at=now(), by=actor, text=note or 'Customer reported that the credit has not arrived.'))
        notify(c, 'Your report was added to the existing investigation. No duplicate case was created.')
    c = mutate_case(db, case['id'], add, actor=actor, action='complaint_attached')
    db.execute('UPDATE tx_payments SET reported=1 WHERE id=?', (payment['id'],))
    cust = customer_update(db, run, payment, 'complaint', 'Your report was added to the investigation.', headline='Report added',
                           next_step='The investigator can now see your report.', case=c)
    journal.emit(db, 'COMPLAINT_ATTACHED', run_id=run['id'], payment_id=payment['id'], case_id=c['id'], case_version=c['version'],
                 sim_ms=run['clock_ms'], cust=cust, payload=dict(note=note, reference=c['reference']))
    return c


# ------------------------------------------------------------------ clock
def advance(run_id, delta_ms):
    """Advance one run's synthetic clock, executing every due step in order (also the deterministic test driver)."""
    with store.transaction() as db:
        run = run_row(db, run_id)
        if not run or run['status'] != 'active':
            return
        target = run['clock_ms'] + max(0, int(delta_ms))
    while True:
        with store.transaction() as db:
            run = run_row(db, run_id)
            if not run or run['status'] != 'active':
                return
            step = db.execute('SELECT * FROM tx_steps WHERE run_id=? AND done=0 AND due_ms<=? ORDER BY due_ms,id LIMIT 1', (run_id, target)).fetchone()
            if not step:
                db.execute('UPDATE tx_runs SET clock_ms=? WHERE id=? AND clock_ms<?', (target, run_id, target))
                return
            db.execute('UPDATE tx_runs SET clock_ms=? WHERE id=? AND clock_ms<?', (step['due_ms'], run_id, step['due_ms']))
            db.execute('UPDATE tx_steps SET done=1 WHERE id=?', (step['id'],))
            HANDLERS[step['kind']](db, dict(step), json.loads(step['args']))


def run_until_idle(run_id, limit_ms=300000, stride_ms=250):
    """Test/CLI helper: advance until no steps remain or the limit is reached."""
    spent = 0
    while spent < limit_ms:
        with store.connect() as db:
            pending = db.execute('SELECT 1 FROM tx_steps WHERE run_id=? AND done=0 LIMIT 1', (run_id,)).fetchone()
        if not pending:
            return spent
        advance(run_id, stride_ms)
        spent += stride_ms
    return spent


def tick(elapsed_s):
    with store.connect() as db:
        runs = [dict(r) for r in db.execute(
            "SELECT id,speed FROM tx_runs WHERE status='active' AND paused=0 AND EXISTS (SELECT 1 FROM tx_steps s WHERE s.run_id=tx_runs.id AND s.done=0)")]
    for r in runs:
        advance(r['id'], int(elapsed_s * 1000 * r['speed']))


async def ticker(interval=0.15):
    last = time.monotonic()
    while True:
        await asyncio.sleep(interval)
        t = time.monotonic()
        dt, last = min(t - last, 1.0), t
        try:
            await asyncio.to_thread(tick, dt)
        except Exception:  # keep the clock alive; a failed step is retried on the next tick
            await asyncio.sleep(0.5)
