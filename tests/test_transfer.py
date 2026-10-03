import json
import re
import sqlite3
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from tracefix import store
from tracefix.app import app
from tracefix.transfer import catalog, engine, journal, routes

ROOT = Path(__file__).resolve().parents[1]


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(store, 'DB_PATH', tmp_path / 'transfer.sqlite3')
    monkeypatch.setenv('TRACEFIX_SIM_TICKER', '0')  # tests drive the synthetic clock explicitly
    monkeypatch.delenv('TRACEFIX_SANDBOX_CORRECTIONS', raising=False)
    with TestClient(app) as c:
        yield c


def session(c, role, run_id=None):
    r = c.post('/api/transfer/session', json=dict(role=role, **({'run_id': run_id} if run_id else {})))
    assert r.status_code == 200, r.text
    d = r.json()
    return dict(headers={'Authorization': 'Bearer ' + d['token']}, **d)


def new_run(c, scenario):
    p = session(c, 'presenter')
    r = c.post('/api/transfer/runs', json=dict(scenario=scenario), headers=p['headers'])
    assert r.status_code == 200, r.text
    return p, r.json()


def pay(c, cust, run_id, key='k1', amount=125000):
    return c.post('/api/transfer/payments', json=dict(run_id=run_id, amount_minor=amount, bank_code='MCB'), headers={**cust['headers'], 'Idempotency-Key': key})


def story(c, scenario):
    """Presenter + customer + staff tabs for one run, with the payment created."""
    presenter, run = new_run(c, scenario)
    cust, staff = session(c, 'customer', run['id']), session(c, 'staff', run['id'])
    r = pay(c, cust, run['id'])
    assert r.status_code == 200, r.text
    return dict(run=run, presenter=presenter, cust=cust, staff=staff, pid=r.json()['payment']['id'])


def snapshot(c, s):
    return c.get(f"/api/transfer/staff/cases/{s['pid']}", headers=s['staff']['headers']).json()


def investigate(c, s, key='inv1'):
    return c.post(f"/api/transfer/staff/cases/{s['pid']}/investigate", json={}, headers={**s['staff']['headers'], 'Idempotency-Key': key})


def approve(c, s, plan, key='ap1', version=None):
    ver = plan['evidence_version'] if version is None else version
    return c.post(f"/api/transfer/staff/cases/{s['pid']}/corrections/{plan['plan_id']}/approve", json=dict(evidence_version=ver),
                  headers={**s['staff']['headers'], 'Idempotency-Key': key})


def to_plan(c, s):
    engine.advance(s['run']['id'], 15000)
    assert investigate(c, s).status_code == 200
    engine.run_until_idle(s['run']['id'], 60000)
    snap = snapshot(c, s)
    assert snap['investigation']['status'] == 'concluded'
    return snap


def db():
    return sqlite3.connect(store.DB_PATH)


# ------------------------------------------------------------------ sessions & roles
def test_tokens_are_scoped_and_roles_enforced(client):
    cust, staff, presenter = session(client, 'customer'), session(client, 'staff'), session(client, 'presenter')
    assert client.get('/api/transfer/staff/queue').status_code == 401
    assert client.get('/api/transfer/staff/queue', headers=cust['headers']).status_code == 403
    assert client.get('/api/transfer/staff/queue', headers=presenter['headers']).status_code == 403
    assert client.get('/api/transfer/staff/queue', headers=staff['headers']).status_code == 200
    assert client.get('/api/transfer/runs', headers=staff['headers']).status_code == 403
    assert client.post('/api/transfer/payments', json={}, headers={**staff['headers'], 'Idempotency-Key': 'x'}).status_code == 403
    assert client.post('/api/transfer/session', json=dict(role='root')).status_code == 422
    assert 'tracefix_session' not in client.cookies  # per-tab tokens never overwrite each other through a cookie


def test_two_identities_in_one_browser_do_not_collide(client):
    s = story(client, 'worker_fault')
    other = session(client, 'other_customer', s['run']['id'])
    assert client.get(f"/api/transfer/payments/{s['pid']}", headers=other['headers']).status_code == 404
    assert client.get(f"/api/transfer/payments/{s['pid']}", headers=s['cust']['headers']).status_code == 200
    assert client.get(f"/api/transfer/events?scope=payment:{s['pid']}", headers=other['headers']).status_code == 404
    assert client.get('/api/transfer/events?scope=inbox', headers=s['cust']['headers']).status_code == 403


def test_fixture_sessions_can_be_disabled(client, monkeypatch):
    monkeypatch.setenv('TRACEFIX_FIXTURE_SESSIONS', '0')
    assert client.post('/api/transfer/session', json=dict(role='customer')).status_code == 403


# ------------------------------------------------------------------ payment intent
def test_payment_is_idempotent_and_validated(client):
    presenter, run = new_run(client, 'worker_fault')
    cust = session(client, 'customer', run['id'])
    a, b = pay(client, cust, run['id']), pay(client, cust, run['id'])
    assert a.json()['payment']['id'] == b.json()['payment']['id']
    assert pay(client, cust, run['id'], amount=900).status_code == 409  # same key, different content
    with db() as d:
        assert d.execute('SELECT COUNT(*) FROM tx_payments').fetchone()[0] == 1
        assert d.execute("SELECT COUNT(*) FROM tx_events WHERE type='INTENT_CREATED'").fetchone()[0] == 1
    for bad in (0, -5, 5.5, True, '1000', 500001):
        r = client.post('/api/transfer/payments', json=dict(run_id=run['id'], amount_minor=bad, bank_code='MCB'), headers={**cust['headers'], 'Idempotency-Key': f'bad{bad}'})
        assert r.status_code == 422, bad
    assert client.post('/api/transfer/payments', json=dict(run_id=run['id'], amount_minor=1000, bank_code='NOPE'), headers={**cust['headers'], 'Idempotency-Key': 'nb'}).status_code == 422
    assert client.post('/api/transfer/payments', json=dict(run_id=run['id'], amount_minor=1000, bank_code='MCB'), headers=cust['headers']).status_code == 422


def test_money_is_integer_and_postings_are_balanced_and_immutable(client):
    s = story(client, 'lost_ack')
    engine.advance(s['run']['id'], 15000)
    with db() as d:
        d.execute('PRAGMA foreign_keys=ON')
        posts = d.execute('SELECT id,leg,amount_minor FROM tx_postings WHERE payment_id=?', (s['pid'],)).fetchall()
        assert {p[1] for p in posts} == {'BANK_DEBIT', 'WALLET_CREDIT'} and all(isinstance(p[2], int) and p[2] == 125000 for p in posts)
        for pid, _, amount in posts:
            lines = d.execute('SELECT side,SUM(amount_minor) FROM tx_posting_lines WHERE posting_id=? GROUP BY side', (pid,)).fetchall()
            assert dict(lines) == {'D': amount, 'C': amount}
        with pytest.raises(sqlite3.DatabaseError):
            d.execute('UPDATE tx_postings SET amount_minor=1 WHERE id=?', (posts[0][0],))
        with pytest.raises(sqlite3.DatabaseError):
            d.execute('DELETE FROM tx_posting_lines WHERE posting_id=?', (posts[0][0],))
        with pytest.raises(sqlite3.IntegrityError):
            d.execute("INSERT INTO tx_postings VALUES ('dup',?,'WALLET_CREDIT',125000,'BDT',2,'X',0,'now',NULL)", (s['pid'],))
    with store.transaction() as dbx:
        payment = engine.payment_row(dbx, s['pid'])
        with pytest.raises(ValueError):
            engine.post_ledger(dbx, payment, 'BANK_RETURN', 1, 0, [('a', 'D', 125000), ('b', 'C', 124999)])


# ------------------------------------------------------------------ journeys
def test_worker_fault_journey_end_to_end_with_single_credit(client):
    s = story(client, 'worker_fault')
    snap = to_plan(client, s)
    assert snap['plan']['kind'] == 'RESUME_ORIGINAL' and snap['plan']['status'] == 'proposed'
    assert snap['investigation']['mode_label'] == 'Rules-based investigation'
    # a stale evidence version is refused
    r = approve(client, s, snap['plan'], 'stale', version=snap['plan']['evidence_version'] - 1)
    assert r.status_code == 409
    after = snapshot(client, s)
    assert after['plan']['status'] == 'superseded'
    assert approve(client, s, snap['plan'], 'ap-late').status_code == 409  # superseded plans cannot run

    # a fresh investigation proposes again, and that approval runs once
    assert investigate(client, s, 'inv2').status_code == 200
    engine.run_until_idle(s['run']['id'], 60000)
    plan = snapshot(client, s)['plan']
    assert plan['status'] == 'proposed' and plan['plan_id'] != snap['plan']['plan_id']
    ok = approve(client, s, plan, 'ap-ok')
    assert ok.status_code == 200 and ok.json()['status'] == 'executing'
    replay = approve(client, s, plan, 'ap-ok')
    assert replay.status_code == 200 and replay.json()['replayed'] is True
    assert approve(client, s, plan, 'ap-other').status_code == 409
    engine.run_until_idle(s['run']['id'], 60000)

    with db() as d:
        credits = d.execute("SELECT attempt_no FROM tx_postings WHERE payment_id=? AND leg='WALLET_CREDIT'", (s['pid'],)).fetchall()
        assert credits == [(2,)]
        assert d.execute("SELECT status FROM tx_payments WHERE id=?", (s['pid'],)).fetchone()[0] == 'COMPLETED'
    final = snapshot(client, s)
    assert final['case']['status'] == 'OUTCOME_RECORDED' and final['case']['resolution'] == 'credit_confirmed'
    cust = client.get(f"/api/transfer/payments/{s['pid']}", headers=s['cust']['headers']).json()
    assert cust['payment']['status'] == 'COMPLETED' and cust['can_report'] is False


def test_lost_ack_refreshes_status_without_moving_money(client):
    s = story(client, 'lost_ack')
    snap = to_plan(client, s)
    assert snap['plan']['kind'] == 'REFRESH_CUSTOMER_STATUS' and snap['plan']['moves_money'] is False
    with db() as d:
        before = d.execute('SELECT COUNT(*) FROM tx_postings WHERE payment_id=?', (s['pid'],)).fetchone()[0]
    assert approve(client, s, snap['plan']).json()['status'] == 'completed'
    with db() as d:
        assert d.execute('SELECT COUNT(*) FROM tx_postings WHERE payment_id=?', (s['pid'],)).fetchone()[0] == before
    assert snapshot(client, s)['payment']['status'] == 'COMPLETED'


def test_mapping_ambiguity_hands_off_and_never_returns_funds(client):
    s = story(client, 'mapping_ambiguity')
    snap = to_plan(client, s)
    assert snap['plan'] is None
    assert snap['case']['resolution'] == 'handoff' and snap['case']['status'] == 'ESCALATED'
    kinds = {e['type'] for e in snap['events']}
    assert {'CORRECTION_BLOCKED', 'HANDOFF_CREATED'} <= kinds
    assert snap['payment']['status'] == 'UNCERTAIN'
    with db() as d:
        assert d.execute("SELECT COUNT(*) FROM tx_postings WHERE payment_id=? AND leg!='BANK_DEBIT'", (s['pid'],)).fetchone()[0] == 0
    blocked = next(e for e in snap['events'] if e['type'] == 'CORRECTION_BLOCKED')
    assert any(b['kind'] == 'RETURN_FUNDS' for b in blocked['payload']['reasons'])


def test_late_completion_waits_then_updates_same_case_and_blocks_stale_approval(client):
    s = story(client, 'late_completion')
    snap = to_plan(client, s)
    assert snap['plan']['kind'] == 'MONITOR_ORIGINAL'
    case_id = snap['case']['id']
    engine.advance(s['run']['id'], 60000)  # the queued original now completes: records changed under the plan
    after = snapshot(client, s)
    assert after['payment']['status'] == 'COMPLETED' and after['case']['id'] == case_id
    assert after['plan']['status'] == 'superseded'
    assert approve(client, s, snap['plan']).status_code in (409,)
    with db() as d:
        assert d.execute("SELECT COUNT(*) FROM tx_postings WHERE payment_id=? AND leg='WALLET_CREDIT'", (s['pid'],)).fetchone()[0] == 1
        assert d.execute("SELECT COUNT(*) FROM tx_postings WHERE payment_id=? AND leg='BANK_RETURN'", (s['pid'],)).fetchone()[0] == 0


def test_original_credit_after_resume_started_cannot_double_credit(client):
    s = story(client, 'worker_fault')
    snap = to_plan(client, s)
    assert approve(client, s, snap['plan']).status_code == 200
    with store.transaction() as d:  # the original attempt also tries to credit while the resumed one is in flight
        run, payment = engine.run_row(d, s['run']['id']), engine.payment_row(d, s['pid'])
        first = engine.credit_wallet(d, payment, 1, run['clock_ms'])
        second = engine.credit_wallet(d, payment, 2, run['clock_ms'])
    assert first is not None and second is None
    engine.run_until_idle(s['run']['id'], 60000)
    with db() as d:
        assert d.execute("SELECT COUNT(*) FROM tx_postings WHERE payment_id=? AND leg='WALLET_CREDIT'", (s['pid'],)).fetchone()[0] == 1


def test_sandbox_flag_blocks_money_moving_execution_only(client, monkeypatch):
    s = story(client, 'worker_fault')
    snap = to_plan(client, s)
    monkeypatch.setenv('TRACEFIX_SANDBOX_CORRECTIONS', '0')
    r = approve(client, s, snap['plan'])
    assert r.status_code == 403
    with db() as d:
        assert d.execute("SELECT COUNT(*) FROM tx_postings WHERE payment_id=? AND leg='WALLET_CREDIT'", (s['pid'],)).fetchone()[0] == 0
    assert client.get(f"/api/transfer/staff/cases/{s['pid']}/report", headers=s['staff']['headers']).status_code == 200


def test_investigation_start_is_idempotent_and_single(client):
    s = story(client, 'worker_fault')
    engine.advance(s['run']['id'], 15000)
    first = investigate(client, s, 'same')
    again = investigate(client, s, 'same')
    assert first.json() == again.json()
    assert investigate(client, s, 'different').status_code == 409  # one running investigation per case
    with db() as d:
        assert d.execute('SELECT COUNT(*) FROM tx_investigations').fetchone()[0] == 1


def test_investigation_requires_an_incident(client):
    s = story(client, 'worker_fault')
    engine.advance(s['run']['id'], 4000)
    assert investigate(client, s).status_code == 409


# ------------------------------------------------------------------ incidents & complaints
def test_customer_report_attaches_to_one_case_and_is_idempotent(client):
    s = story(client, 'worker_fault')
    engine.advance(s['run']['id'], 9500)  # unconfirmed, but the incident threshold has not elapsed
    h = s['cust']['headers']
    r1 = client.post(f"/api/transfer/payments/{s['pid']}/report", json=dict(note='Still nothing in my wallet.'), headers={**h, 'Idempotency-Key': 'r1'})
    r2 = client.post(f"/api/transfer/payments/{s['pid']}/report", json=dict(note='Still nothing in my wallet.'), headers={**h, 'Idempotency-Key': 'r1'})
    r3 = client.post(f"/api/transfer/payments/{s['pid']}/report", json=dict(note='Second click'), headers={**h, 'Idempotency-Key': 'r3'})
    assert r1.status_code == r2.status_code == r3.status_code == 200
    engine.advance(s['run']['id'], 10000)  # threshold passes: the incident step finds the existing case
    with store.connect() as d:
        cases = [json.loads(r['body']) for r in d.execute('SELECT body FROM cases')]
    mine = [c for c in cases if c.get('family') == catalog.FAMILY]
    assert len(mine) == 1 and len(mine[0]['complaints']) == 1
    assert client.get(f"/api/transfer/payments/{s['pid']}", headers=h).json()['can_report'] is False


def test_incident_opens_once_at_threshold_and_not_for_completed_payments(client):
    s = story(client, 'lost_ack')
    engine.advance(s['run']['id'], 20000)
    snap = snapshot(client, s)
    assert snap['case'] and snap['case']['status'] == 'OPEN'
    with db() as d:
        assert d.execute("SELECT COUNT(*) FROM tx_events WHERE type='INCIDENT_OPENED'").fetchone()[0] == 1
    assert client.post(f"/api/transfer/payments/{s['pid']}/report", json={}, headers={**s['cust']['headers'], 'Idempotency-Key': 'late'}).status_code == 200


# ------------------------------------------------------------------ projections & streams
LEAKS = ['LEDGER_LOCK', 'worker', 'hypothes', 'OBS-', 'rationale', 'bank:MCB', 'clearing', 'node_id', 'scenario', 'worker_fault', 'lost_ack',
         'mapping_ambiguity', 'late_completion', 'investigation_id', 'check_id', 'Rules-based', 'safe_replay', 'RETURN_FUNDS', 'RESUME_ORIGINAL']


def test_customer_projection_contains_no_staff_data(client):
    s = story(client, 'worker_fault')
    snap = to_plan(client, s)
    assert approve(client, s, snap['plan']).status_code == 200
    engine.run_until_idle(s['run']['id'], 60000)
    h = s['cust']['headers']
    blobs = [json.dumps(client.get(f"/api/transfer/payments/{s['pid']}", headers=h).json()),
             json.dumps(client.get(f"/api/transfer/events?scope=payment:{s['pid']}&cursor=0", headers=h).json())]
    case_id = snap['case']['id']
    blobs.append(json.dumps(client.get(f'/api/transfer/customer/cases/{case_id}', headers=h).json()))
    for blob in blobs:
        for leak in LEAKS:
            assert leak not in blob, leak
    # the full masked identifiers never reach the customer either
    assert 'customer_1' not in blobs[0] and 'staff_1' not in blobs[0]


def test_staff_snapshot_never_exposes_the_scenario_label(client):
    s = story(client, 'late_completion')
    snap = to_plan(client, s)
    blob = json.dumps(snap)
    for sid, meta in catalog.SCENARIOS.items():
        assert f'"{sid}"' not in blob and meta['title'] not in blob


def test_investigator_tools_and_policy_never_read_the_scenario_label():
    for name in ('tools.py', 'policy.py', 'contract.py', 'investigation.py', 'journal.py'):
        src = (ROOT / 'tracefix' / 'transfer' / name).read_text()
        code = '\n'.join(line for line in src.splitlines() if not line.lstrip().startswith(('#', '"""')))
        assert not re.search(r"\[.scenario.\]|\.scenario\b|SCENARIOS|SCRIPTS", code), name


def test_event_polling_is_cursor_based_ordered_and_deduplicated(client):
    s = story(client, 'lost_ack')
    engine.advance(s['run']['id'], 20000)
    h = s['staff']['headers']
    first = client.get(f"/api/transfer/events?scope=payment:{s['pid']}&cursor=0", headers=h).json()
    seqs = [e['sequence'] for e in first['events']]
    assert seqs == sorted(seqs) and len(set(e['event_id'] for e in first['events'])) == len(seqs)
    mid = seqs[len(seqs) // 2]
    tail = client.get(f"/api/transfer/events?scope=payment:{s['pid']}&cursor={mid}", headers=h).json()['events']
    assert [e['sequence'] for e in tail] == [q for q in seqs if q > mid]
    snap = snapshot(client, s)
    assert snap['cursor'] >= seqs[-1]
    inbox = client.get('/api/transfer/events?scope=inbox&cursor=0', headers=h).json()['events']
    assert {'INTENT_CREATED', 'INCIDENT_OPENED'} <= {e['type'] for e in inbox}


def test_sse_stream_delivers_events_and_honours_cursor(client):
    s = story(client, 'lost_ack')
    engine.advance(s['run']['id'], 20000)
    with client.stream('GET', f"/api/transfer/stream?scope=payment:{s['pid']}&cursor=0&wait=0.4", headers=s['cust']['headers']) as r:
        assert r.status_code == 200 and r.headers['content-type'].startswith('text/event-stream')
        body = ''.join(r.iter_text())
    data = [json.loads(m) for m in re.findall(r'^data: (.*)$', body, re.M)]
    assert data and all('node_id' not in d for d in data)  # customer stream carries the customer projection only
    last = data[-1]['sequence']
    with client.stream('GET', f"/api/transfer/stream?scope=payment:{s['pid']}&cursor={last}&wait=0.3", headers=s['cust']['headers']) as r:
        assert 'event: tx' not in ''.join(r.iter_text())


# ------------------------------------------------------------------ report
def test_report_is_cited_versioned_and_exportable(client):
    s = story(client, 'worker_fault')
    snap = to_plan(client, s)
    h = s['staff']['headers']
    md = client.get(f"/api/transfer/staff/cases/{s['pid']}/report.md", headers=h)
    assert md.status_code == 200 and md.headers['X-Report-SHA256']
    text = md.text
    assert snap['case']['reference'] in text and 'LEDGER_LOCK_TIMEOUT' in text and 'Located processing fault' in text
    assert re.findall(r'OBS-[0-9A-F]{6}', text)
    assert text.count('Simulated partners and fictional BDT') == 1  # a single footer disclosure
    again = client.get(f"/api/transfer/staff/cases/{s['pid']}/report", headers=h).json()
    assert again['sha256'] == md.headers['X-Report-SHA256']  # identical content does not create a new version
    html = client.get(f"/api/transfer/staff/cases/{s['pid']}/report.html", headers=h)
    assert html.status_code == 200 and '<script' not in html.text.lower()
    assert client.get(f"/api/transfer/staff/cases/{s['pid']}/report", headers=s['cust']['headers']).status_code == 403


# ------------------------------------------------------------------ presenter clock & runs
def test_presenter_clock_controls_pause_speed_and_new_runs(client):
    presenter, run = new_run(client, 'worker_fault')
    h = presenter['headers']
    cust = session(client, 'customer', run['id'])
    pay(client, cust, run['id'])
    assert client.post(f"/api/transfer/runs/{run['id']}/clock", json=dict(action='pause'), headers=h).json()['paused'] is True
    engine.tick(5)
    assert client.get('/api/transfer/runs', headers=h).json()[0]['clock_ms'] == 0
    client.post(f"/api/transfer/runs/{run['id']}/clock", json=dict(action='play'), headers=h)
    assert client.post(f"/api/transfer/runs/{run['id']}/clock", json=dict(action='speed', speed=3), headers=h).status_code == 422
    client.post(f"/api/transfer/runs/{run['id']}/clock", json=dict(action='speed', speed=4), headers=h)
    engine.tick(1)
    assert client.get('/api/transfer/runs', headers=h).json()[0]['clock_ms'] >= 3900
    second = client.post('/api/transfer/runs', json=dict(scenario='lost_ack', replaces=run['id']), headers=h).json()
    runs = {r['id']: r for r in client.get('/api/transfer/runs', headers=h).json()}
    assert runs[run['id']]['status'] == 'archived' and runs[second['id']]['status'] == 'active'
    assert runs[run['id']]['payments'] and not runs[second['id']]['payments']  # prior records are kept, never erased
    assert client.post('/api/transfer/runs', json=dict(scenario='bogus'), headers=h).status_code == 422


# ------------------------------------------------------------------ legacy QR workflow stays isolated
def test_qr_routes_cannot_act_on_add_money_cases(client):
    s = story(client, 'worker_fault')
    snap = to_plan(client, s)
    case_id = snap['case']['id']
    assert client.post('/api/session', json=dict(role='staff')).status_code == 200
    assert client.get(f'/api/cases/{case_id}').status_code == 409
    for action in ('decision', 'check', 'analyze', 'handoff'):
        r = client.post(f'/api/cases/{case_id}/{action}', json=dict(version=1), headers={'Idempotency-Key': 'x' + action})
        assert r.status_code == 409, action
    assert client.get(f'/api/cases/{case_id}/dossier').status_code == 409
    listed = client.get('/api/cases').json()
    assert all(c['id'] != case_id for c in listed) and len(listed) == 4  # the four seeded QR journeys are unchanged
    assert 'tx_' not in json.dumps(listed)


def test_run_summary_reports_walkthrough_phase(client):
    s = story(client, 'worker_fault')
    h = s['presenter']['headers']
    phase = lambda: client.get('/api/transfer/runs', headers=h).json()[0]['payments'][0]['phase']
    assert phase() == 'submitted'
    engine.advance(s['run']['id'], 15000)
    assert phase() == 'incident'
    assert investigate(client, s).status_code == 200
    assert phase() == 'investigating'
    engine.run_until_idle(s['run']['id'], 60000)
    snap = snapshot(client, s)
    assert phase() == 'decision'
    assert approve(client, s, snap['plan']).status_code == 200
    engine.run_until_idle(s['run']['id'], 60000)
    assert phase() == 'resolved'
