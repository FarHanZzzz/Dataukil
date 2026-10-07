"""HTTP surface for the stalled add-money investigation.

Two views, one authoritative backend: customer and staff read role-scoped projections of the same journal.
Actions are authenticated HTTP requests; server-sent events carry only server-to-browser updates.
"""
import asyncio
import hashlib
import json
import os
import secrets
import time
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import PlainTextResponse, StreamingResponse

from .. import data_dna, store
from ..auth import read_session
from ..domain import now, uid
from . import catalog, correction, engine, investigation, journal, policy, privacy, report

router = APIRouter(prefix='/api/transfer')

FIXTURE_ROLES = {'customer': ('customer_1', 'customer'), 'other_customer': ('customer_2', 'customer'),
                 'staff': ('staff_1', 'staff'), 'other_staff': ('staff_2', 'staff'), 'presenter': ('presenter_1', 'presenter')}
MIN_MINOR, MAX_MINOR = 100, 500000


@contextmanager
def reader():
    db = store.connect()
    try:
        db.execute('BEGIN')  # one consistent snapshot: head cursor and rows are read together
        yield db
    finally:
        db.rollback()
        db.close()


def need(request, *roles):
    s = read_session(request)
    if s['role'] not in roles:
        raise HTTPException(403, 'This session cannot perform that action.')
    return s


async def body_of(request):
    try:
        p = await request.json()
    except Exception:
        raise HTTPException(422, 'Provide a JSON object.')
    if not isinstance(p, dict) or len(json.dumps(p)) > 20000:
        raise HTTPException(422, 'Invalid or oversized request.')
    return p


def idem_key(request):
    k = request.headers.get('Idempotency-Key', '')
    if not k or len(k) > 128:
        raise HTTPException(422, 'A bounded Idempotency-Key is required.')
    return k


def idem_get(db, actor, scope, key, digest):
    old = db.execute('SELECT * FROM operations WHERE actor=? AND scope=? AND key=?', (actor, scope, key)).fetchone()
    if old:
        if old['digest'] != digest:
            raise HTTPException(409, 'This operation key was already used with different content.')
        return json.loads(old['response'])
    return None


def idem_put(db, actor, scope, key, digest, response):
    db.execute('INSERT INTO operations VALUES (?,?,?,?,?)', (actor, scope, key, digest, json.dumps(response, ensure_ascii=False)))


def digest_of(p):
    return hashlib.sha256(json.dumps(p, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


# ------------------------------------------------------------------ sessions & config
@router.post('/session')
async def fixture_session(request: Request):
    """Server-issued scoped opaque token for one browser tab (fixture mode). Roles are fixed server-side."""
    if os.environ.get('TRACEFIX_FIXTURE_SESSIONS', '1') == '0':
        raise HTTPException(403, 'Fixture sessions are disabled on this server.')
    p = await body_of(request)
    role = p.get('role')
    if role not in FIXTURE_ROLES:
        raise HTTPException(422, 'Unknown fixture role.')
    actor, actual = FIXTURE_ROLES[role]
    token = secrets.token_urlsafe(32)
    with store.transaction() as db:
        if p.get('run_id'):
            run = engine.run_row(db, p['run_id'])
            if not run:
                raise HTTPException(404, 'Run not found.')
        else:
            run = engine.default_run(db)
        db.execute('INSERT INTO sessions VALUES (?,?,?,?)', (token, actor, actual, (datetime.now(timezone.utc) + timedelta(hours=8)).isoformat()))
    return dict(token=token, actor=actor, role=actual, label=engine.owner_label(actor), run_id=run['id'])


@router.get('/config')
def config(request: Request):
    s = read_session(request)
    out = dict(banks=catalog.BANKS, wallet=catalog.WALLET, currency=catalog.CURRENCY, min_minor=MIN_MINOR, max_minor=MAX_MINOR,
               role=s['role'], actor=s['actor'])
    if s['role'] in ('staff', 'presenter'):
        out.update(sandbox_enabled=engine.sandbox_enabled(), incident_after_ms=engine.incident_after_ms(), check_budget=engine.check_budget(),
                   mode=policy.MODE, mode_label=policy.MODE_LABEL)
    return out


# ------------------------------------------------------------------ presenter: runs
def payment_phase(db, p):
    """Saved investigation progress; handoff does not establish a payment resolution."""
    inv = db.execute('SELECT status FROM tx_investigations WHERE payment_id=? ORDER BY started_ms DESC, rowid DESC LIMIT 1', (p['id'],)).fetchone()
    cor = db.execute('SELECT status FROM tx_corrections WHERE payment_id=? ORDER BY created_ms DESC, rowid DESC LIMIT 1', (p['id'],)).fetchone()
    case = store.get_case(db, p['case_id']) if p['case_id'] else None
    if p['status'] == 'COMPLETED' or (case and case.get('resolution') == 'credit_confirmed'):
        return 'resolved', inv['status'] if inv else None
    if case and case.get('resolution') == 'handoff':
        return 'handoff', inv['status'] if inv else None
    if inv and inv['status'] == 'running':
        return 'investigating', inv['status']
    if inv:
        return 'decision', inv['status']
    return ('incident' if p['case_id'] else 'submitted'), None


def run_summary(db, r):
    pays = db.execute('SELECT id,status,case_id,amount_minor,reference FROM tx_payments WHERE run_id=? ORDER BY created_at', (r['id'],)).fetchall()
    out = []
    for p in pays:
        phase, inv = payment_phase(db, p)
        out.append(dict(id=p['id'], status=p['status'], case_id=p['case_id'], amount_minor=p['amount_minor'], reference=p['reference'], phase=phase, investigation=inv))
    return dict(id=r['id'], scenario=r['scenario'], scenario_title=catalog.SCENARIOS[r['scenario']]['title'], status=r['status'], paused=bool(r['paused']),
                speed=r['speed'], clock_ms=r['clock_ms'], created_at=r['created_at'], payments=out)


@router.get('/scenarios')
def scenarios(request: Request):
    need(request, 'presenter')
    return [dict(id=k, **v) for k, v in catalog.SCENARIOS.items()]


@router.get('/runs')
def runs(request: Request):
    need(request, 'presenter')
    with reader() as db:
        return [run_summary(db, dict(r)) for r in db.execute('SELECT * FROM tx_runs ORDER BY created_at DESC, rowid DESC LIMIT 12')]


@router.post('/runs')
async def new_run(request: Request):
    """Creates an isolated synthetic run with a new simulation identity. Existing project records are never reset."""
    need(request, 'presenter')
    p = await body_of(request)
    with store.transaction() as db:
        try:
            r = engine.create_run(db, p.get('scenario'), replaces=p.get('replaces'))
        except ValueError as e:
            raise HTTPException(422, str(e))
        return run_summary(db, r)


@router.post('/runs/{run_id}/clock')
async def clock(run_id: str, request: Request):
    need(request, 'presenter')
    p = await body_of(request)
    with store.transaction() as db:
        try:
            r = engine.control_run(db, run_id, p.get('action'), p.get('speed'))
        except LookupError as e:
            raise HTTPException(404, str(e))
        except ValueError as e:
            raise HTTPException(422, str(e))
        return run_summary(db, r)


# ------------------------------------------------------------------ customer projections
STAGES = [('accepted', 'Request accepted'), ('bank', 'Bank approval'), ('wallet', 'Wallet credit'), ('confirmed', 'Confirmed in your wallet')]


def customer_snapshot(db, payment_id):
    p = engine.payment_row(db, payment_id)
    events = journal.customer_events(db, payment_id)
    cursor = journal.head(db)
    seen = {e.get('stage') for e in events if e.get('stage')}
    facts, last_next, last_headline = [], None, None
    for e in events:
        for f in e.get('facts', []):
            if f not in facts:
                facts.append(f)
        if e.get('next_step'):
            last_next = e['next_step']
        last_headline = e.get('headline') or last_headline
    done = p['status'] == 'COMPLETED'
    uncertain = p['status'] == 'UNCERTAIN'
    stages = []
    for key, label in STAGES:
        if key == 'wallet':
            state = 'done' if done else 'uncertain' if (uncertain or 'wallet' in seen) else 'pending'
        elif key == 'confirmed':
            state = 'done' if done else 'pending'
        else:
            state = 'done' if key in seen or done else 'current' if (key == 'accepted' or 'accepted' in seen) else 'pending'
        stages.append(dict(key=key, label=label, state=state))
    if done:
        headline, lead = 'Your wallet credit is confirmed', 'Your money is in your wallet.'
    elif uncertain:
        headline, lead = 'We have not confirmed your wallet credit yet', 'Your bank approved the request, but the wallet has not confirmed the credit. Please do not send another transfer.'
    else:
        headline, lead = 'Your payment is being processed', 'We are sending your request to the wallet. This usually takes a few seconds.'
    case = None
    if p['case_id']:
        c = store.get_case(db, p['case_id'])
        resolved = c['status'] == 'OUTCOME_RECORDED'
        case = dict(id=c['id'], reference=c['reference'], owner=engine.owner_label(c['owner']), resolved=resolved,
                    next_review=None if resolved else c['next_review'], next_step=last_next or 'An investigator is reviewing the saved payment records.')
    return dict(cursor=cursor, payment=dict(id=p['id'], reference=p['reference'], amount_minor=p['amount_minor'], currency=p['currency'], bank_label=p['bank_label'],
                                            wallet_label=p['wallet_label'], status=p['status'], created_at=p['created_at'], reported=bool(p['reported'])),
                headline=headline, lead=lead, stages=stages, facts=facts, case=case, next_step=last_next,
                can_report=bool(uncertain and not p['reported']),
                data_dna_summary=data_dna.customer_summary(privacy.decisions(db, p['case_id'])),
                timeline=[dict(at=e['occurred_at'], text=e['headline'], kind=e['kind'], sequence=e['sequence']) for e in events if e.get('headline')])


def owned_payment(db, s, payment_id):
    p = engine.payment_row(db, payment_id)
    if not p or (s['role'] == 'customer' and p['owner'] != s['actor']):
        raise HTTPException(404, 'Payment not found.')
    return p


@router.post('/payments')
async def create_payment(request: Request):
    s = need(request, 'customer')
    key = idem_key(request)
    p = await body_of(request)
    amount, bank = p.get('amount_minor'), p.get('bank_code')
    if isinstance(amount, bool) or not isinstance(amount, int) or not MIN_MINOR <= amount <= MAX_MINOR:
        raise HTTPException(422, f'Amount must be a whole number of paisa between {MIN_MINOR} and {MAX_MINOR}.')
    if bank not in {b['code'] for b in catalog.BANKS}:
        raise HTTPException(422, 'Choose one of the listed accounts.')
    digest = digest_of(dict(amount_minor=amount, bank_code=bank, run_id=p.get('run_id')))
    with store.transaction() as db:
        existing = db.execute('SELECT * FROM tx_payments WHERE owner=? AND idem_key=?', (s['actor'], key)).fetchone()
        if existing:  # a double submit reuses the same logical operation
            if existing['digest'] != digest:
                raise HTTPException(409, 'This operation key was already used with different content.')
            return customer_snapshot(db, existing['id'])
        run = engine.run_row(db, p['run_id']) if p.get('run_id') else engine.default_run(db)
        if not run or run['status'] != 'active':
            raise HTTPException(404, 'This run is no longer active. Open the presenter controls and start a new run.')
        pay = engine.create_payment(db, run, s['actor'], key, digest, amount, bank)
        return customer_snapshot(db, pay['id'])


@router.get('/payments')
def my_payments(request: Request):
    """The signed-in customer's own add-money requests, newest first (customer-safe fields only)."""
    s = need(request, 'customer')
    with reader() as db:
        rows = db.execute('SELECT * FROM tx_payments WHERE owner=? ORDER BY created_at DESC, rowid DESC LIMIT 20', (s['actor'],)).fetchall()
        out = []
        for r in rows:
            c = store.get_case(db, r['case_id']) if r['case_id'] else None
            out.append(dict(id=r['id'], reference=r['reference'], amount_minor=r['amount_minor'], currency=r['currency'], bank_label=r['bank_label'],
                            status=r['status'], created_at=r['created_at'], case_id=c['id'] if c else None, case_reference=c['reference'] if c else None))
        return out


@router.get('/payments/{payment_id}')
def get_payment(payment_id: str, request: Request):
    s = need(request, 'customer')
    with reader() as db:
        owned_payment(db, s, payment_id)
        return customer_snapshot(db, payment_id)


@router.get('/customer/cases/{case_id}')
def customer_case(case_id: str, request: Request):
    s = need(request, 'customer')
    with reader() as db:
        r = db.execute('SELECT id FROM tx_payments WHERE case_id=? AND owner=?', (case_id, s['actor'])).fetchone()
        if not r:
            raise HTTPException(404, 'Case not found.')
        return customer_snapshot(db, r['id'])


@router.post('/payments/{payment_id}/report')
async def report_issue(payment_id: str, request: Request):
    s = need(request, 'customer')
    key = idem_key(request)
    body = await body_of(request)
    note = body.get('note', '')
    if not isinstance(note, str) or len(note) > 1000:
        raise HTTPException(422, 'The note must be at most 1000 characters.')
    with store.transaction() as db:
        pay = owned_payment(db, s, payment_id)
        old = idem_get(db, s['actor'], f'report:{payment_id}', key, digest_of(dict(note=note)))
        if old:
            return customer_snapshot(db, payment_id)
        if pay['status'] == 'COMPLETED':
            raise HTTPException(409, 'This payment is already confirmed.')
        if not pay['reported']:
            run = engine.run_row(db, pay['run_id'])
            engine.attach_complaint(db, run, pay, s['actor'], note)
        idem_put(db, s['actor'], f'report:{payment_id}', key, digest_of(dict(note=note)), dict(ok=True))
        return customer_snapshot(db, payment_id)


# ------------------------------------------------------------------ staff projections
def resolve_case(db, ident):
    """Accepts a case id or a payment id so the workspace can open an in-flight payment before the incident exists."""
    if ident.startswith('pay_'):
        p = engine.payment_row(db, ident)
    else:
        row = db.execute('SELECT id FROM tx_payments WHERE case_id=?', (ident,)).fetchone()
        p = engine.payment_row(db, row['id']) if row else None
    if not p:
        raise HTTPException(404, 'Record not found.')
    return p


def case_public(c):
    return dict(id=c['id'], reference=c['reference'], status=c['status'], resolution=c.get('resolution', 'open'), owner=c['owner'],
                owner_label=engine.owner_label(c['owner']), next_review=c['next_review'], version=c['version'], evidence_version=c['evidence_version'],
                tasks=[dict(id=t['id'], question=t['question'], status=t['status'], next_review=t['next_review']) for t in c['tasks']],
                complaints=c.get('complaints', []), reason=c.get('incident_reason'))


def staff_snapshot(db, payment):
    run = engine.run_row(db, payment['run_id'])
    cursor = journal.head(db)
    events = journal.staff_events(db, payment['id'], run['id'])
    c = store.get_case(db, payment['case_id']) if payment['case_id'] else None
    plan = db.execute("SELECT id FROM tx_corrections WHERE payment_id=? ORDER BY rowid DESC LIMIT 1", (payment['id'],)).fetchone()
    inv = db.execute('SELECT * FROM tx_investigations WHERE payment_id=? ORDER BY rowid DESC LIMIT 1', (payment['id'],)).fetchone()
    rep = db.execute('SELECT version,sha256,created_at FROM tx_reports WHERE case_id=? ORDER BY version DESC LIMIT 1', (payment['case_id'],)).fetchone() if c else None
    return dict(
        cursor=cursor, topology=catalog.TOPOLOGY, hypotheses=catalog.HYPOTHESES, tools={k: dict(label=v['label'], node=v['node']) for k, v in catalog.TOOLS.items()},
        run=dict(id=run['id'], paused=bool(run['paused']), speed=run['speed'], clock_ms=run['clock_ms']),
        payment=dict(id=payment['id'], reference=payment['reference'], amount_minor=payment['amount_minor'], currency=payment['currency'],
                     bank_label=payment['bank_label'], wallet_label=payment['wallet_label'], status=payment['status'], created_at=payment['created_at'],
                     case_id=payment['case_id']),
        case=case_public(c) if c else None, events=events, data_dna=privacy.snapshot(db, c['id'] if c else None),
        plan=correction.plan_public(correction.plan_row(db, plan['id'])) if plan else None,
        investigation=dict(id=inv['id'], status=inv['status'], checks_used=inv['checks_used'], budget=inv['budget'], mode=inv['mode'], mode_label=policy.MODE_LABEL) if inv else None,
        report=dict(version=rep['version'], sha256=rep['sha256'], created_at=rep['created_at']) if rep else None,
        sandbox_enabled=engine.sandbox_enabled(), incident_after_ms=engine.incident_after_ms(), mode=policy.MODE, mode_label=policy.MODE_LABEL,
        check_budget=engine.check_budget())


@router.get('/staff/queue')
def staff_queue(request: Request, run: str | None = None):
    need(request, 'staff')
    with reader() as db:
        if run:
            rows = db.execute('SELECT * FROM tx_payments WHERE run_id=? ORDER BY created_at DESC, rowid DESC LIMIT 40', (run,)).fetchall()
        else:
            rows = db.execute('SELECT * FROM tx_payments ORDER BY created_at DESC, rowid DESC LIMIT 40').fetchall()
        items = []
        for r in rows:
            c = store.get_case(db, r['case_id']) if r['case_id'] else None
            items.append(dict(payment_id=r['id'], case_id=r['case_id'], reference=c['reference'] if c else r['reference'], payment_reference=r['reference'],
                              amount_minor=r['amount_minor'], payment_status=r['status'], case_status=c['status'] if c else None,
                              resolution=c.get('resolution') if c else None, owner=engine.owner_label(c['owner']) if c else None, created_at=r['created_at'],
                              incident=bool(c)))
        return dict(cursor=journal.head(db), items=items)


@router.get('/staff/cases/{ident}')
def staff_case(ident: str, request: Request):
    need(request, 'staff')
    with reader() as db:
        return staff_snapshot(db, resolve_case(db, ident))


@router.post('/staff/cases/{ident}/investigate')
async def start_investigation(ident: str, request: Request):
    s = need(request, 'staff')
    key = idem_key(request)
    await body_of(request)
    with store.transaction() as db:
        pay = resolve_case(db, ident)
        scope, digest = f"investigate:{pay['id']}", digest_of(dict(id=pay['id']))
        old = idem_get(db, s['actor'], scope, key, digest)
        if old:
            return old
        if not pay['case_id']:
            raise HTTPException(409, 'No incident is open for this payment yet. The incident opens once the outcome stays unconfirmed past the threshold.')
        case = store.get_case(db, pay['case_id'])
        run = engine.run_row(db, pay['run_id'])
        running = db.execute("SELECT id FROM tx_investigations WHERE case_id=? AND status='running'", (case['id'],)).fetchone()
        if running:
            raise HTTPException(409, 'An investigation is already running on this case.')
        try:
            inv = investigation.start(db, run, case, pay, s['actor'])
        except ValueError as e:
            raise HTTPException(409, str(e))
        resp = dict(investigation_id=inv['id'], status=inv['status'], budget=inv['budget'], mode=inv['mode'])
        idem_put(db, s['actor'], scope, key, digest, resp)
        return resp


@router.post('/staff/cases/{ident}/privacy-probe')
async def demonstrate_privacy_boundary(ident: str, request: Request):
    """Save a refused synthetic request; do not call a data source or alter incident evidence."""
    s = need(request, 'staff')
    key = idem_key(request)
    p = await body_of(request)
    kind = p.get('probe', 'unrelated_history')
    if kind not in ('unrelated_history', 'external_model', 'missing_basis'):
        raise HTTPException(422, 'Choose unrelated_history, external_model or missing_basis.')
    with store.transaction() as db:
        pay = resolve_case(db, ident)
        if not pay['case_id']:
            raise HTTPException(409, 'Wait for a case to open before demonstrating a case-scoped data request.')
        scope, digest = f"privacy-probe:{pay['id']}", digest_of(dict(probe=kind))
        old = idem_get(db, s['actor'], scope, key, digest)
        if old:
            return old
        case = store.get_case(db, pay['case_id'])
        run = engine.run_row(db, pay['run_id'])
        privacy.probe(db, run, case, pay, s['actor'], kind)
        response = staff_snapshot(db, pay)
        idem_put(db, s['actor'], scope, key, digest, response)
        return response


@router.post('/staff/cases/{ident}/corrections/{plan_id}/approve')
async def approve_correction(ident: str, plan_id: str, request: Request):
    s = need(request, 'staff')
    key = idem_key(request)
    p = await body_of(request)
    ev = p.get('evidence_version')
    if isinstance(ev, bool) or not isinstance(ev, int):
        raise HTTPException(422, 'evidence_version must be the integer shown with the plan.')
    db = store.connect()
    refusal = None
    try:
        db.execute('BEGIN IMMEDIATE')
        pay = resolve_case(db, ident)
        try:
            result = correction.approve(db, pay['case_id'], plan_id, s['actor'], key, ev)
        except correction.Refused as r:
            refusal = r
            if not r.persist:
                db.rollback()
                raise HTTPException(r.status, r.detail)
        db.commit()
    except HTTPException:
        raise
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
    if refusal:
        raise HTTPException(refusal.status, refusal.detail)
    return result


# ------------------------------------------------------------------ report
def _report(db, ident, run_for_event=True):
    pay = resolve_case(db, ident)
    if not pay['case_id']:
        raise HTTPException(409, 'No incident exists for this payment yet, so there is no report.')
    run = engine.run_row(db, pay['run_id'])
    meta = report.save(db, run, pay['case_id'], 'requested')
    row = db.execute('SELECT * FROM tx_reports WHERE case_id=? AND version=?', (pay['case_id'], meta['version'])).fetchone()
    return pay, row


@router.get('/staff/cases/{ident}/report')
def get_report(ident: str, request: Request):
    need(request, 'staff')
    with store.transaction() as db:
        pay, row = _report(db, ident)
        return dict(version=row['version'], sha256=row['sha256'], created_at=row['created_at'], report=json.loads(row['body']))


@router.get('/staff/cases/{ident}/report.md')
def get_report_md(ident: str, request: Request):
    need(request, 'staff')
    with store.transaction() as db:
        pay, row = _report(db, ident)
        c = store.get_case(db, pay['case_id'])
    return PlainTextResponse(row['markdown'], media_type='text/markdown', headers={
        'Content-Disposition': f'attachment; filename="{c["reference"]}-report-v{row["version"]}.md"', 'X-Report-SHA256': row['sha256']})


@router.get('/staff/cases/{ident}/report.html')
def get_report_html(ident: str, request: Request):
    need(request, 'staff')
    with store.transaction() as db:
        pay, row = _report(db, ident)
        c = store.get_case(db, pay['case_id'])
    return PlainTextResponse(report.to_html(json.loads(row['body'])), media_type='text/html', headers={
        'Content-Disposition': f'attachment; filename="{c["reference"]}-report-v{row["version"]}.html"', 'X-Report-SHA256': row['sha256']})


# ------------------------------------------------------------------ streams
def stream_fetch(s, scope):
    """Returns (fetch(cursor)->events) for a role-authorized scope, or raises 403/404."""
    kind, _, ident = scope.partition(':')
    if kind == 'inbox':
        if s['role'] != 'staff':
            raise HTTPException(403, 'Staff session required.')

        def fetch(cursor):
            with reader() as db:
                return journal.inbox_events(db, cursor)
        return fetch
    if kind == 'payment':
        with reader() as db:
            if s['role'] == 'customer':
                p = owned_payment(db, s, ident)
            elif s['role'] == 'staff':
                p = resolve_case(db, ident)
            else:
                raise HTTPException(403, 'Customer or staff session required.')
            pid, run_id = p['id'], p['run_id']
        if s['role'] == 'customer':
            def fetch(cursor):
                with reader() as db:
                    return journal.customer_events(db, pid, cursor)
        else:
            def fetch(cursor):
                with reader() as db:
                    return journal.staff_events(db, pid, run_id, cursor)
        return fetch
    raise HTTPException(422, 'Unknown stream scope.')


@router.get('/events')
def poll_events(request: Request, scope: str, cursor: int = 0):
    """Polling fallback: reads saved projections after a cursor."""
    s = read_session(request)
    return dict(events=stream_fetch(s, scope)(max(0, cursor)), head=_head())


def _head():
    with reader() as db:
        return journal.head(db)


@router.get('/stream')
async def stream(request: Request, scope: str, cursor: int = 0, wait: float = 0):
    s = read_session(request)
    fetch = stream_fetch(s, scope)
    last_id = request.headers.get('last-event-id')
    start_cursor = max(0, int(last_id)) if last_id and last_id.isdigit() else max(0, cursor)

    async def gen():
        cur, began, pinged = start_cursor, time.monotonic(), time.monotonic()
        yield 'retry: 1500\n\n'
        while True:
            rows = await asyncio.to_thread(fetch, cur)
            for e in rows:
                cur = e['sequence']
                yield f"id: {cur}\nevent: tx\ndata: {json.dumps(e, ensure_ascii=False)}\n\n"
            if rows:
                continue
            if await request.is_disconnected():
                return
            t = time.monotonic()
            if wait and t - began > min(wait, 120):
                return
            if t - pinged > 15:
                pinged = t
                yield ': keep-alive\n\n'
            await asyncio.sleep(0.15)
    return StreamingResponse(gen(), media_type='text/event-stream', headers={'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no'})
