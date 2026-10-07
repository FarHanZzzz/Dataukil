"""DataDNA: every personal-data access passes five gates, refused requests read nothing, and the ledger is auditable."""
import json
import re
import sqlite3

import pytest

from tracefix import store
from tracefix.transfer import catalog, datadna, engine
from tests.test_transfer import approve, client, investigate, session, snapshot, story, to_plan  # noqa: F401  (client is a fixture)


def ledger(c, s):
    """Saved DataDNA events for the payment, in journal order."""
    ev = snapshot(c, s)['events']
    return [e for e in ev if e['type'].startswith('DATADNA')]


def calls(c, s):
    return [e['payload'] for e in ledger(c, s) if e['type'] == 'DATADNA_REVIEWED']


def by_label(records, label):
    return next(r for r in records if r['label'] == label)


# ------------------------------------------------------------------ every check is gated, and the gate is saved first
def test_every_check_has_a_saved_gate_decision_before_its_result(client):
    s = story(client, 'worker_fault')
    snap = to_plan(client, s)
    events = snap['events']
    checks = [e for e in events if e['type'] in ('CHECK_COMPLETED', 'CHECK_UNAVAILABLE')]
    assert checks
    for chk in checks:
        gate = next(e for e in events if e['type'] == 'DATADNA_REVIEWED' and e['payload']['check_id'] == chk['payload']['check_id'])
        assert gate['sequence'] < chk['sequence']  # decision is saved before the result is announced
        assert gate['payload']['observation_id'] == chk['payload']['observation']['id']
        assert [g['id'] for g in gate['payload']['gates']] == ['why', 'who', 'where', 'how', 'until']
        assert gate['payload']['dna'].keys() == {'why', 'who', 'where', 'how', 'until'}
    env = [e for e in events if e['type'] == 'DATADNA_ENVELOPE' and e['payload']['kind'] == 'investigation']
    assert len(env) == 1 and env[0]['payload']['scope'].startswith('this intent only')
    plan = [e for e in events if e['type'] == 'DATADNA_PLAN']
    assert len(plan) == 1 and plan[0]['payload']['steps'] and plan[0]['payload']['tally']['total'] == len(calls(client, s))


def test_bank_and_wallet_reads_release_with_controls_and_never_select_account_lines(client):
    s = story(client, 'worker_fault')
    to_plan(client, s)
    recs = calls(client, s)
    bank = by_label(recs, 'Bank record check')
    assert bank['decision'] == 'controlled' and bank['outcome'] == 'released' and bank['blocked_at'] is None
    assert any(f['action'] == 'exclude' and f['cls'] == 'account_identifier' for f in bank['fields'])
    assert {c['code'] for c in bank['concerns']} == {'cross_org', 'minimisation'}
    assert all(c['status'] == 'mitigated' for c in bank['concerns'])
    attempts = [r for r in recs if r['label'] == 'Attempt and retry history']
    assert attempts and attempts[0]['decision'] == 'passed' and not attempts[0]['concerns']


# ------------------------------------------------------------------ refused follow-up requests fetch nothing
def test_overreaching_followup_is_refused_at_the_first_failing_gate_and_flags_every_concern(client):
    s = story(client, 'worker_fault')
    to_plan(client, s)
    req = by_label(calls(client, s), 'Customer bank statement (last 90 days)')
    assert req['kind'] == 'ai_request' and req['decision'] == 'blocked' and req['outcome'] == 'denied'
    assert req['blocked_at'] == 'why' and req['observation_id'] is None and req['trigger'].startswith('OBS-')
    assert [g['status'] for g in req['gates']] == ['block'] * 5  # every gate is evaluated, so every concern is flagged, not just the first
    codes = {c['code'] for c in req['concerns'] if c['status'] == 'blocked'}
    assert {'purpose_limitation', 'lawful_basis', 'need_to_know', 'scope_limitation', 'identifier_masking', 'storage_limitation'} <= codes
    assert all(c['alternative'] or c['status'] != 'blocked' for c in req['concerns'] if c['code'] in ('purpose_limitation', 'lawful_basis'))
    with sqlite3.connect(store.DB_PATH) as d:  # a refused request never became an observation
        assert d.execute("SELECT COUNT(*) FROM tx_observations WHERE tool LIKE '%statement%'").fetchone()[0] == 0


def test_ambiguous_mapping_withholds_third_party_identifiers_before_they_are_saved(client):
    s = story(client, 'mapping_ambiguity')
    snap = to_plan(client, s)
    recs = calls(client, s)
    mapping = by_label(recs, 'Reference mapping check')
    assert mapping['decision'] == 'blocked' and mapping['outcome'] == 'partial' and mapping['blocked_at'] == 'where'
    assert {c['code'] for c in mapping['concerns'] if c['status'] == 'blocked'} == {'third_party_data', 'identifier_masking'}
    with sqlite3.connect(store.DB_PATH) as d:
        real = [r[0] for r in d.execute('SELECT candidate FROM tx_mappings')]
        saved = d.execute("SELECT data FROM tx_observations WHERE tool='mapping_check'").fetchone()[0]
        events = ' '.join(r[0] for r in d.execute('SELECT payload FROM tx_events'))
    assert len(real) == 2 and not any(ref in saved or ref in events for ref in real)
    assert '••0127' not in saved and json.loads(saved)['ambiguous'] is True and len(json.loads(saved)['candidates']) == 2
    holders = by_label(recs, 'Names and phones of the candidate wallet holders')
    assert holders['decision'] == 'blocked' and holders['blocked_at'] == 'who' and holders['concerns']
    assert {'third_party_data', 'need_to_know'} <= {c['code'] for c in holders['concerns']}
    plan = next(e for e in snap['events'] if e['type'] == 'DATADNA_PLAN')['payload']
    action = [x for x in plan['steps'] if x['status'] == 'action' and x['owner'] == 'Operator']
    assert any('partner' in x['step'].lower() for x in action)


def test_lost_ack_refuses_contact_details_and_names_the_less_intrusive_path(client):
    s = story(client, 'lost_ack')
    to_plan(client, s)
    req = by_label(calls(client, s), 'Customer phone and email')
    assert req['decision'] == 'blocked' and req['blocked_at'] == 'how'
    assert any(c['code'] == 'minimisation' and 'signed-in' in c['detail'] for c in req['concerns'])


def test_verified_mapping_masks_the_wallet_reference(client):
    s = story(client, 'worker_fault')
    to_plan(client, s)
    mapping = by_label(calls(client, s), 'Reference mapping check')
    assert mapping['decision'] == 'controlled'
    with sqlite3.connect(store.DB_PATH) as d:
        real = d.execute('SELECT candidate FROM tx_mappings').fetchone()[0]
        saved = json.loads(d.execute("SELECT data FROM tx_observations WHERE tool='mapping_check'").fetchone()[0])
    # The access policy already reduces candidates to opaque tokens; the gate must not bring the real reference back.
    assert real not in json.dumps(saved) and saved['candidates'][0].get('token') and saved['verified'] is True


# ------------------------------------------------------------------ the pure gate
def make_ctx(**over):
    case, pay = dict(id='c1', owner='staff_1'), dict(id='p1', reference='ADD-1')
    env = datadna.open_envelope('staff_1', 'Investigator 1', case, pay, budget=8)
    base = dict(case=case, pay=pay, envelope=env, actor='staff_1', label='Investigator 1', role='staff')
    base.update(over)
    return datadna.context(base['case'], base['pay'], base['envelope'], actor=base['actor'], actor_label=base['label'], role=base['role'])


def test_gate_refuses_without_an_envelope_and_never_calls_the_tool():
    def boom():
        raise AssertionError('the tool must not run')
    res, rec = datadna.gate_tool(make_ctx(envelope=None), 'bank_record_check', boom)
    assert res is None and rec['decision'] == 'blocked' and rec['outcome'] == 'denied' and rec['blocked_at'] == 'why'
    result = datadna.blocked_result('bank_record_check', rec)
    assert result['status'] == 'blocked' and result['data']['blocked'] is True


def test_gate_refuses_a_non_staff_requester():
    res, rec = datadna.gate_tool(make_ctx(role='customer'), 'wallet_ledger_check', lambda: pytest.fail('read'))
    assert res is None and rec['blocked_at'] == 'who'


def test_gate_refuses_a_purpose_the_source_is_not_declared_for():
    case, pay = dict(id='c1', owner='staff_1'), dict(id='p1', reference='ADD-1')
    env = datadna.open_envelope('staff_1', 'Investigator 1', case, pay, purpose_id='verify_correction')
    res, rec = datadna.gate_tool(make_ctx(envelope=env), 'bank_record_check', lambda: pytest.fail('read'))
    assert res is None and rec['blocked_at'] == 'why'


def test_gate_drops_unlisted_fields_and_records_the_control():
    raw = dict(status='completed', summary='x', node_updates=[], data=dict(found=True, posting=dict(ref='R'), as_of='t', customer_phone='01711111111'))
    res, rec = datadna.gate_tool(make_ctx(), 'wallet_ledger_check', lambda: raw)
    assert 'customer_phone' not in res['data'] and res['data']['found'] is True
    assert any('customer_phone' in c['detail'] for c in rec['concerns'])


def test_gate_scrubs_identifiers_from_worker_log_text():
    raw = dict(status='completed', summary='x', node_updates=[], data=dict(
        available=True, record_count=1, warnings=[], error=None,
        records=[dict(level='ERROR', code='X', message='Failed for 01711223344 and a.b@example.com', attempt_no=1, retryable=True)]))
    res, rec = datadna.gate_tool(make_ctx(), 'worker_error_check', lambda: raw)
    text = res['data']['records'][0]['message']
    assert '01711223344' not in text and '@' not in text and text.count('[masked]') == 2
    assert rec['decision'] == 'controlled' and any(c['code'] == 'identifier_masking' for c in rec['concerns'])


def test_non_owner_investigator_is_allowed_but_flagged():
    res, rec = datadna.gate_tool(make_ctx(actor='staff_2', label='Investigator 2'), 'attempt_history_check',
                                 lambda: dict(status='completed', summary='x', node_updates=[], data=dict(count=1, attempts=[])))
    assert res is not None and rec['decision'] == 'controlled'
    assert any(c['code'] == 'need_to_know' and c['status'] == 'mitigated' for c in rec['concerns'])


def test_export_scan_runs_over_the_exact_text_that_leaves():
    case, pay = dict(id='c1', owner='staff_1'), dict(id='p1', reference='ADD-1')
    env = datadna.open_envelope('staff_1', 'Investigator 1', case, pay, purpose_id='accountability_record', tools=['report_export'])
    ctx = make_ctx(envelope=env)
    ok = datadna.review_export(ctx, 'md', 'Debit of \u09f31,250.00 posted (ADD-1). Wallet \u2022\u20220172.')
    assert ok['decision'] == 'controlled' and ok['concerns'][0]['code'] == 'cross_org'
    bad = datadna.review_export(ctx, 'md', 'Customer phone 01711223344 is on file.')
    assert bad['decision'] == 'blocked' and bad['outcome'] == 'denied'


# ------------------------------------------------------------------ report, exports, privacy of the ledger itself
def test_report_carries_the_five_answers_the_concerns_and_a_compliance_plan(client):
    s = story(client, 'mapping_ambiguity')
    to_plan(client, s)
    h = s['staff']['headers']
    rep = client.get(f"/api/transfer/staff/cases/{s['pid']}/report", headers=h).json()['report']
    dp = rep['data_protection']
    assert dp['tally']['blocked'] >= 2 and dp['tally']['blocked_concerns'] >= 4 and dp['plan'] and dp['calls']
    assert all(c['dna'].keys() == {'why', 'who', 'where', 'how', 'until'} for c in dp['calls'])
    md = client.get(f"/api/transfer/staff/cases/{s['pid']}/report.md", headers=h).text
    assert '## Data protection (DataDNA)' in md and '### Compliance plan' in md and "Other wallet holders' data" in md
    assert 'Until when:' in md and 'BLOCKED at gate' in md


def test_exports_are_gated_logged_and_do_not_change_the_report(client):
    s = story(client, 'lost_ack')
    to_plan(client, s)
    h = s['staff']['headers']
    before = client.get(f"/api/transfer/staff/cases/{s['pid']}/report", headers=h).json()['sha256']
    assert client.get(f"/api/transfer/staff/cases/{s['pid']}/report.md", headers=h).status_code == 200
    assert client.get(f"/api/transfer/staff/cases/{s['pid']}/report.html", headers=h).status_code == 200
    exports = [r for r in calls(client, s) if r['kind'] == 'export']
    assert [r['label'] for r in exports] == ['Report export (MD)', 'Report export (HTML)']
    assert all(r['decision'] == 'controlled' and r['actor'] == 'staff_1' for r in exports)
    assert client.get(f"/api/transfer/staff/cases/{s['pid']}/report", headers=h).json()['sha256'] == before


def test_a_blocked_export_is_refused_but_still_recorded(client, monkeypatch):
    s = story(client, 'worker_fault')
    to_plan(client, s)
    monkeypatch.setattr(datadna, 'scan_export', lambda text: 2)
    r = client.get(f"/api/transfer/staff/cases/{s['pid']}/report.md", headers=s['staff']['headers'])
    assert r.status_code == 409 and 'DataDNA blocked this export' in r.json()['detail']
    last = [x for x in calls(client, s) if x['kind'] == 'export'][-1]
    assert last['decision'] == 'blocked' and last['outcome'] == 'denied'


def test_customers_never_receive_the_ledger(client):
    s = story(client, 'mapping_ambiguity')
    to_plan(client, s)
    r = client.get(f"/api/transfer/events?scope=payment:{s['pid']}&cursor=0", headers=s['cust']['headers'])
    body = json.dumps(r.json())
    assert r.status_code == 200 and 'DNA-' not in body and 'DATADNA' not in body and 'concern' not in body.lower()
    assert 'datadna' not in json.dumps(client.get(f"/api/transfer/payments/{s['pid']}", headers=s['cust']['headers']).json()).lower()


def test_correction_verification_reads_run_inside_their_own_envelope(client):
    s = story(client, 'worker_fault')
    snap = to_plan(client, s)
    assert approve(client, s, snap['plan']).status_code == 200
    engine.run_until_idle(s['run']['id'], 60000)
    events = snapshot(client, s)['events']
    envs = [e['payload'] for e in events if e['type'] == 'DATADNA_ENVELOPE']
    assert [e['kind'] for e in envs] == ['processing', 'investigation', 'verification']
    ver = [e['payload'] for e in events if e['type'] == 'DATADNA_REVIEWED' and e['payload']['origin'] == 'verification']
    assert len(ver) == 1 and ver[0]['purpose'] == 'Confirm an approved correction posted correctly' and ver[0]['actor'] == 'staff_1'


def test_ledger_records_are_immutable(client):
    s = story(client, 'worker_fault')
    to_plan(client, s)
    with sqlite3.connect(store.DB_PATH) as d:
        with pytest.raises(sqlite3.DatabaseError):
            d.execute("UPDATE tx_events SET payload='{}' WHERE type='DATADNA_REVIEWED'")


# ------------------------------------------------------------------ the payment itself passes through DataDNA, on the run clock
def played(c, scenario):
    """A payment whose scripted run has played out, with no investigation started."""
    s = story(c, scenario)
    engine.run_until_idle(s['run']['id'], 60000)
    return s


def flows(c, s):
    return [r for r in calls(c, s) if r['kind'] == 'flow']


def test_payment_hand_offs_are_reviewed_in_order_on_the_run_clock(client):
    s = played(client, 'worker_fault')
    fl = flows(client, s)
    hops = [r['hop'] for r in fl]
    assert hops[:3] == ['request', 'bank', 'partner'] and set(hops) <= set(datadna.HOP_ORDER)
    assert fl[0]['sim_ms'] < fl[1]['sim_ms'] < fl[2]['sim_ms']
    assert [r['sim_ms'] for r in fl] == sorted(r['sim_ms'] for r in fl)
    assert all(r['dna'].keys() == {'why', 'who', 'where', 'how', 'until'} and r['label'] for r in fl)
    env = [e['payload'] for e in ledger(client, s) if e['type'] == 'DATADNA_ENVELOPE']
    assert env[0]['kind'] == 'processing' and all(r['envelope_id'] == env[0]['id'] for r in fl)


def test_gate_terms_are_mfs_terms():
    terms = {g['id']: g['term'] for g in datadna.GATES}
    assert terms == {'why': 'Customer consent', 'who': 'Parties', 'where': 'Systems', 'how': 'Masking', 'until': 'Retention'}


def test_ambiguous_mapping_holds_the_partner_hand_off_at_systems(client):
    s = played(client, 'mapping_ambiguity')
    partner = next(r for r in flows(client, s) if r['hop'] == 'partner')
    assert partner['decision'] == 'blocked' and partner['blocked_at'] == 'where'
    assert any(c['code'] == 'third_party_data' and c['status'] == 'blocked' for c in partner['concerns'])
    wallet = next(f for f in partner['fields'] if f['name'].startswith('Destination wallet'))
    assert wallet['action'] == 'withhold'


@pytest.mark.parametrize('scenario', ['worker_fault', 'lost_ack'])
def test_other_scenarios_never_hold_a_hand_off(client, scenario):
    s = played(client, scenario)
    fl = flows(client, s)
    assert fl and all(r['decision'] != 'blocked' for r in fl)


def test_a_lost_acknowledgement_leaves_the_customer_told_not_confirmed(client):
    s = played(client, 'lost_ack')
    fl = flows(client, s)
    assert 'ack' not in {r['hop'] for r in fl}  # nothing came back to review: this is where it stopped
    cust = next(r for r in fl if r['hop'] == 'customer')
    assert cust['state'] == 'unconfirmed' and 'not confirmed' in cust['label']


def test_customers_never_receive_hand_off_reviews(client):
    s = played(client, 'mapping_ambiguity')
    r = client.get(f"/api/transfer/events?scope=payment:{s['pid']}&cursor=0", headers=s['cust']['headers'])
    body = json.dumps(r.json())
    assert r.status_code == 200 and 'DNA-' not in body and 'DATADNA' not in body and 'third_party' not in body
