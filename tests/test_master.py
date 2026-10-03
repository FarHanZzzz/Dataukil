"""Master workflow contracts: actual events, source grounding and atomic sandbox repairs."""
import asyncio
import json
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
import pytest
import httpx
from fastapi.testclient import TestClient
from tracefix.app import app
from tracefix import store, payments, live_ai
from tracefix.verifier import verifier


@pytest.fixture
def master(tmp_path,monkeypatch):
    monkeypatch.setattr(store,'DB_PATH',tmp_path/'master.sqlite3')
    monkeypatch.setenv('TRACEFIX_PHASE_DELAY','0')
    monkeypatch.setattr(verifier,'predict',lambda pairs:[dict(label='SUPPORTED_BY_PASSAGE',engine='test_stub',model_available=False) for _ in pairs])
    with TestClient(app) as client:
        tokens={role:client.post('/api/session',json={'role':role}).json()['token'] for role in ('customer','staff','other_customer','other_staff')}
        yield client,tokens


def call(master,path,body=None,role='staff',key=None):
    client,tokens=master;headers={'X-TraceFix-Session':tokens[role]}
    if body is None:return client.get('/api'+path,headers=headers)
    headers['Idempotency-Key']=key or uuid.uuid4().hex
    return client.post('/api'+path,json=body,headers=headers)


def transfer(master,scenario='duplicate_payment',issue='PAID_TWICE'):
    r=call(master,'/transactions',dict(amount_minor=100000,scenario=scenario,customer_name='Fictional Nadia'),role='customer')
    assert r.status_code==200,r.text
    t=r.json()
    for _ in range(6):
        r=call(master,'/transactions/'+t['id']+'/advance',{'version':t['version']},role='customer')
        assert r.status_code==200,r.text
        t=r.json()
    r=call(master,'/transactions/'+t['id']+'/complaint',dict(version=t['version'],description='Please verify the exact transfer and payment postings.',issue_type=issue),role='customer')
    assert r.status_code==200,r.text
    return r.json()['transaction'],r.json()['case']


def change(master,cid,action,extra=None,role='staff',key=None,version=None):
    c=call(master,'/cases/'+cid,role=role).json()
    return call(master,'/cases/'+cid+'/'+action,dict(version=c['version'] if version is None else version,**(extra or {})),role,key)


def analyze(master,cid,mode='demo'):
    r=change(master,cid,'investigations',{'mode':mode})
    assert r.status_code==202,r.text
    identifier=r.json()['id']
    for _ in range(500):
        r=call(master,'/investigations/'+identifier)
        assert r.status_code==200,r.text
        if r.json()['status']!='RUNNING':
            assert r.json()['status'] not in ('FAILED','INTERRUPTED'),r.text
            return r.json()
        time.sleep(.01)
    raise AssertionError('Investigation did not finish.')


@pytest.mark.parametrize('scenario,state',[
    ('success','SUCCEEDED'),('delayed_response','UNCERTAIN'),('stuck_processing','UNCERTAIN'),
    ('confirmed_failure','FAILED'),('duplicate_payment','UNCERTAIN'),('missing_partner_response','UNCERTAIN'),
    ('retry','SUCCEEDED'),('settlement_uncertain','UNCERTAIN')])
def test_eight_scenarios_persist_balanced_records(master,scenario,state):
    t,c=transfer(master,scenario)
    assert t['state']==state and t['case_id']==c['id'] and t['incident_id']==c['incident_id']
    assert 'scenario' not in t and 'events' not in t
    raw=call(master,'/transactions/'+t['id']).json()
    assert raw['ledger']['balanced']
    assert all(sum(e['postings'].values())==0 for e in raw['ledger']['entries'])
    assert len({e['id'] for e in raw['events']})==len(raw['events'])
    customer=call(master,'/transactions/'+t['id'],role='other_customer')
    assert customer.status_code==404


def test_draft_and_complaint_reuse_incident_across_keys(master):
    draft={'draft_id':'stable-unlinked-browser-draft'}
    a=call(master,'/incidents',draft,role='customer').json()
    b=call(master,'/incidents',draft,role='customer').json()
    assert a==b
    body=dict(incident_id=a['incident_id'],description='Unlinked cash complaint.',amount_minor=100000,second_method='cash')
    first=call(master,'/cases',body,role='customer').json()
    second=call(master,'/cases',body,role='customer').json()
    assert first['id']==second['id']
    assert call(master,'/cases',body,role='other_customer').status_code==404


def test_transaction_action_retries_and_complaints_are_idempotent(master):
    body=dict(amount_minor=100000,scenario='duplicate_payment')
    a=call(master,'/transactions',body,role='customer',key='same-create')
    b=call(master,'/transactions',body,role='customer',key='same-create')
    assert a.json()==b.json()
    t,c=transfer(master)
    repeat=call(master,'/transactions/'+t['id']+'/complaint',dict(version=1,description='Repeat with another key.',issue_type='PAID_TWICE'),role='customer')
    assert repeat.json()['case']['id']==c['id']
    assert call(master,'/transactions',body|dict(amount_minor=100001),role='customer',key='same-create').status_code==409


@pytest.mark.parametrize('scenario,expected_action',[
    ('duplicate_payment','REVERSE_DUPLICATE_DEBIT'),('stuck_processing','RETRY_SETTLEMENT'),
    ('confirmed_failure','SIMULATED_CORRECTION')])
def test_approved_repairs_execute_once_and_balance_amounts(master,scenario,expected_action):
    t,c=transfer(master,scenario,issue='STUCK_TRANSFER' if scenario!='duplicate_payment' else 'PAID_TWICE')
    run=analyze(master,c['id'])
    assert run['eligibility']['eligible'] and run['recommendation']['action']==expected_action
    assert not call(master,'/cases/'+c['id'],role='customer').json()['resolution']
    assert change(master,c['id'],'repairs/execute',{'approval_id':'invented'}).status_code==409
    assert change(master,c['id'],'approvals',{'note':'Wrong role.'},role='customer').status_code==403
    approved=change(master,c['id'],'approvals',{'run_id':run['id'],'note':'I reviewed the cited source records.'})
    assert approved.status_code==200,approved.text
    cid=c['id'];aid=approved.json()['approval']['id'];version=approved.json()['version']
    result=change(master,cid,'repairs/execute',{'approval_id':aid},key='execute-once',version=version)
    assert result.status_code==200,result.text
    assert result.json()['status']=='RESOLVED' and result.json()['resolution']['status']=='SUCCEEDED'
    replay=change(master,cid,'repairs/execute',{'approval_id':aid},key='execute-once',version=version)
    assert replay.json()==result.json()
    another=change(master,cid,'repairs/execute',{'approval_id':aid})
    assert another.status_code==200
    raw=call(master,'/transactions/'+t['id']).json()
    assert raw['ledger']['balanced'] and raw['ledger']['balances']['SUSPENSE']==0
    expected_wallet=t['amount_minor']*2+(0 if scenario=='confirmed_failure' else t['amount_minor'])
    assert raw['ledger']['balances']['WALLET']==expected_wallet
    assert len(call(master,'/investigations/'+run['id']).json()['repair_attempts'])==1
    customer=call(master,'/cases/'+cid,role='customer').json()
    assert customer['status']=='RESOLVED' and customer['last_verified_update']['text_bn']


def test_missing_response_retried_request_is_not_second_payment(master):
    t,c=transfer(master,'missing_partner_response')
    run=analyze(master,c['id'])
    assert run['verification']=='INCONCLUSIVE' and not run['eligibility']['eligible']
    assert run['mode_label']=='DEMO INVESTIGATION — SIMULATED AI TRACE'
    stages={e['phase'] for e in run['events']}
    assert stages=={'initialize','context','reconstruct','retrieve','follow','compare','verify','causes','eligibility','recommend','decision'}
    assert all(e['purpose'] and e['action'] and e['finding'] and e['changed'] and e['next_step'] for e in run['events'])
    assert next(h for h in run['hypotheses'] if h['id']=='duplicate_debit')['status']=='CONTRADICTED'
    assert next(h for h in run['hypotheses'] if h['id']=='settlement_complete')['status']=='UNRESOLVED'
    assert change(master,c['id'],'approvals',{'note':'Unsupported repair.'}).status_code==409
    assert call(master,'/investigations/'+run['id'],role='customer').status_code==403


def test_source_arrival_stales_analysis_and_late_response_resolves_without_repair(master):
    t,c=transfer(master,'delayed_response')
    run=analyze(master,c['id'])
    assert run['verification']=='INCONCLUSIVE'
    advanced=call(master,'/transactions/'+t['id']+'/advance',{'version':t['version']},role='customer')
    assert advanced.json()['state']=='SUCCEEDED'
    assert not call(master,'/cases/'+c['id']).json()['analysis_fresh']
    newrun=analyze(master,c['id'])
    assert newrun['verification']=='CONTRADICTS_CLAIM' and newrun['recommendation']['action']=='NO_ACTION'
    final=change(master,c['id'],'operator-outcome',{'decision':'RESOLVED_NO_REPAIR','note':'The late source confirms one completed transfer.'})
    assert final.status_code==200 and final.json()['status']=='RESOLVED'


def test_new_evidence_invalidates_approval_and_failed_attempt_is_saved(master):
    t,c=transfer(master);run=analyze(master,c['id'])
    approved=change(master,c['id'],'approvals',{'note':'Reviewed.'}).json()
    failed=change(master,c['id'],'repairs/execute',{'approval_id':approved['approval']['id'],'simulate_failure':True})
    assert failed.status_code==200 and failed.json()['repair_result']['status']=='FAILED'
    assert not failed.json().get('resolution')
    with store.connect() as db:assert db.execute("SELECT COUNT(*) FROM ledger WHERE identity LIKE '%correction%'").fetchone()[0]==0
    newrun=analyze(master,c['id'])
    approved=change(master,c['id'],'approvals',{'note':'Reviewed again.'}).json()
    assert change(master,c['id'],'messages',{'text':'Additional receipt claim.'},role='customer').status_code==200
    blocked=change(master,c['id'],'repairs/execute',{'approval_id':approved['approval']['id']})
    assert blocked.status_code in (403,409)


def test_replay_gets_are_pure_and_reset_keeps_history(master):
    t,c=transfer(master);run=analyze(master,c['id'])
    with store.connect() as db:before=list(db.iterdump())
    for path in ('/investigations/'+run['id'],'/investigations/'+run['id']+'/events?after=3','/cases/'+c['id']+'/report?format=md','/cases/'+c['id']+'/report?format=json'):
        assert call(master,path).status_code==200
    with store.connect() as db:assert before==list(db.iterdump())
    original=call(master,'/transactions/'+t['id']).json()
    reset=call(master,'/demo/scenarios/'+t['id']+'/reset',{}).json()
    assert reset['id']!=t['id'] and reset['incident_id']!=t['incident_id'] and reset['reset_of']==t['id']
    assert call(master,'/transactions/'+t['id']).json()==original
    assert call(master,'/cases/'+c['id']).status_code==200
    assert call(master,'/cases/'+c['id']+'/report',role='customer').status_code==403


def test_legacy_case_can_be_investigated_but_cannot_gain_sandbox_authority(master):
    run=analyze(master,'case_1')
    assert run['verification']=='SUPPORTS_CLAIM' and not run['eligibility']['eligible']
    assert 'mapped sandbox postings' in run['eligibility']['reason']


def test_live_adapter_blocks_inconsistent_proposal_and_discards_thinking(master,monkeypatch):
    t,c=transfer(master,'missing_partner_response')
    actual_client=httpx.AsyncClient
    def reply(request):
        body=dict(verification='INCONCLUSIVE',hypothesis_order=['partner_timeout'],action='REVERSE_DUPLICATE_DEBIT',evidence_ids=[captured['id']])
        return httpx.Response(200,json={'message':{'content':json.dumps(body),'thinking':'PRIVATE_REASONING_MUST_NOT_APPEAR'}})
    captured={}
    original=live_ai.assess
    async def invoke(case,*args):
        captured['id']=case['evidence'][0]['id']
        return await original(case,*args)
    monkeypatch.setattr(live_ai,'assess',invoke)
    monkeypatch.setattr(live_ai.httpx,'AsyncClient',lambda **kwargs:actual_client(transport=httpx.MockTransport(reply),**kwargs))
    run=analyze(master,c['id'],'live')
    assert run['mode']=='LIVE' and run['provider']['blocked_action']=='REVERSE_DUPLICATE_DEBIT'
    assert not run['eligibility']['eligible'] and run['recommendation']['action']=='MANUAL_REVIEW'
    assert 'PRIVATE_REASONING_MUST_NOT_APPEAR' not in json.dumps(run)
    assert any('Block unsupported model proposal'==e['action'] for e in run['events'])


def test_model_outage_is_explicit_demo_fallback(master,monkeypatch):
    async def unavailable(*args):return dict(available=False,error='Local model timeout.',model='test')
    monkeypatch.setattr(live_ai,'assess',unavailable)
    t,c=transfer(master)
    run=analyze(master,c['id'],'live')
    assert run['mode']=='DEMO' and 'SIMULATED AI TRACE' in run['mode_label']
    assert any(e['finding']=='Local model timeout.' for e in run['events'])


@pytest.mark.parametrize('fault',['malformed','invented_citation','invented_hypothesis','contradictory_verdict','timeout','offline'])
def test_provider_validation_and_deadline_abstain(master,monkeypatch,fault):
    t,c=transfer(master);run=analyze(master,c['id'])
    case=call(master,'/cases/'+c['id']).json()
    actual_client=httpx.AsyncClient
    def reply(request):
        if fault=='timeout':raise httpx.ReadTimeout('provider deadline',request=request)
        if fault=='offline':raise httpx.ConnectError('unavailable',request=request)
        content=dict(verification='SUPPORTS_CLAIM',hypothesis_order=['duplicate_debit'],action='REVERSE_DUPLICATE_DEBIT',evidence_ids=[case['evidence'][-1]['id']])
        if fault=='invented_citation':content['evidence_ids']=['not-reviewed']
        if fault=='invented_hypothesis':content['hypothesis_order']=['invented']
        if fault=='contradictory_verdict':content['verification']='CONTRADICTS_CLAIM'
        return httpx.Response(200,json={'message':{'content':'{invalid' if fault=='malformed' else json.dumps(content)}})
    monkeypatch.setattr(live_ai.httpx,'AsyncClient',lambda **kwargs:actual_client(transport=httpx.MockTransport(reply),**kwargs))
    outcome=asyncio.run(live_ai.assess(case,run['hypotheses'],run['verification'],run['recommendation']['action']))
    assert not outcome['available'] and outcome['private_reasoning_stored'] is False
    if fault=='timeout':assert 'timeout' in outcome['error']


def test_concurrent_complaint_and_repair_apply_once(master):
    t,c=transfer(master)
    complaint=dict(version=t['version'],description='Repeated same logical transfer.',issue_type='PAID_TWICE')
    with ThreadPoolExecutor(max_workers=4) as pool:
        results=list(pool.map(lambda _:call(master,'/transactions/'+t['id']+'/complaint',complaint,role='customer'),range(4)))
    assert all(r.status_code==200 and r.json()['case']['id']==c['id'] for r in results)
    run=analyze(master,c['id'])
    approved=change(master,c['id'],'approvals',{'note':'Reviewed exact debit, settlement and credit references.'}).json()
    body=dict(version=approved['version'],approval_id=approved['approval']['id'])
    with ThreadPoolExecutor(max_workers=3) as pool:
        results=list(pool.map(lambda _:call(master,'/cases/'+c['id']+'/repairs/execute',body),range(3)))
    assert sum(r.status_code==200 for r in results)==1
    assert all(r.status_code in (200,409) for r in results)
    transaction=call(master,'/transactions/'+t['id']).json()
    assert transaction['ledger']['balanced']
    assert sum(e['kind']=='REVERSAL' for e in transaction['ledger']['entries'])==1
    report=call(master,'/cases/'+c['id']+'/report?format=json').json()
    assert report['findings']['recorded_excess_minor']==0
    assert len(report['repair_results'])==1 and report['repair_results'][0]['status']=='SUCCEEDED'
    assert report['transaction_reconstruction']['ledger']==transaction['ledger']


def test_source_inspection_does_not_resolve_unknown_nodes(master):
    t,c=transfer(master,'missing_partner_response')
    before=call(master,'/transactions/'+t['id']).json()
    checked=change(master,c['id'],'pipeline-check',{'stage':'settlement'})
    assert checked.status_code==200 and checked.json()['checks'][-1]['state']=='COMPLETED'
    after=call(master,'/transactions/'+t['id']).json()
    assert before==after
    assert next(n for n in after['pipeline'] if n['id']=='settlement')['status']=='unknown'
    assert change(master,c['id'],'pipeline-check',{'stage':'settlement'},role='customer').status_code==403


def test_handoff_retains_owner_and_tasks_until_acknowledgement(master):
    t,c=transfer(master,'missing_partner_response');run=analyze(master,c['id'])
    result=change(master,c['id'],'handoff',dict(destination='staff_2',team='Partner Operations',priority='HIGH',
                  reason='Exact final settlement is missing.',next_action='Obtain partner response and wallet outcome.'))
    assert result.status_code==200 and result.json()['owner']=='staff_1'
    assert change(master,c['id'],'acknowledge',{}).status_code==403
    received=change(master,c['id'],'acknowledge',{},role='other_staff')
    assert received.status_code==200 and received.json()['owner']=='staff_2'
    assert received.json()['handoffs'][-1]['status']=='ACKNOWLEDGED'


def test_interrupted_run_requires_new_explicit_start(master):
    from tracefix import investigation
    t,c=transfer(master)
    run=analyze(master,c['id'])
    with store.transaction() as db:
        saved=investigation.get_run(db,run['id']);saved['status']='RUNNING';investigation.save_run(db,saved)
    investigation.recover()
    old=call(master,'/investigations/'+run['id']).json()
    assert old['status']=='INTERRUPTED' and not old['eligibility']['eligible']
    assert call(master,'/cases/'+c['id']).json()['status']=='OPEN'
    restarted=analyze(master,c['id'])
    assert restarted['id']!=run['id']
    history=call(master,'/cases/'+c['id']+'/investigations').json()
    assert len(history)==2 and history[-1]['status']=='INTERRUPTED'


def test_role_views_and_console_routes(master):
    t,c=transfer(master)
    for url in ('/customer','/operations','/operations/cases/'+c['id'],'/operations/cases/'+c['id']+'/studio','/demo'):
        response=master[0].get(url)
        assert response.status_code==200
        assert "script-src 'self'" in response.headers['Content-Security-Policy']
    case=call(master,'/cases/'+c['id']).json()
    raw=case['evidence'][0]
    assert call(master,'/evidence/'+raw['id']+'/file',role='customer').status_code==200
    assert call(master,'/evidence/'+raw['id']+'/file',role='other_customer').status_code==404
    run=analyze(master,c['id'])
    source=call(master,'/cases/'+c['id']).json()['evidence'][-1]
    assert call(master,'/evidence/'+source['id']+'/file',role='customer').status_code==404
    for key in ('audit','decisions','handoffs','checks','evidence','analysis','approval','provider'):
        assert key not in call(master,'/cases/'+c['id'],role='customer').json()
    assert call(master,'/operations/overview',role='customer').status_code==403


def test_supplied_context_stays_an_allegation_and_bangla_uses_checked_facts(master):
    r=call(master,'/transactions',dict(amount_minor=100000,scenario='duplicate_payment'),role='customer');t=r.json()
    for _ in range(6):t=call(master,'/transactions/'+t['id']+'/advance',{'version':t['version']},role='customer').json()
    complaint=call(master,'/transactions/'+t['id']+'/complaint',dict(version=t['version'],description='দুইবার ডেবিট হয়েছে কি না যাচাই করুন।',issue_type='PAID_TWICE',
                   merchant_information='Customer-provided shop name',approximate_time='about 10 am',supporting_text='I think both attempts completed.'),role='customer').json()
    c=call(master,'/cases/'+complaint['case']['id']).json()
    assert c['reported_context']['approximate_time']=='about 10 am'
    assert c['evidence'][0]['category']=='Customer Statement' and c['evidence'][1]['category']=='Customer Evidence'
    assert c['facts']['bank_debit_minor']==0 and not c['analysis_fresh']
    run=analyze(master,c['id'])
    view=call(master,'/cases/'+c['id'],role='customer').json()
    assert len(view['confirmed_facts_bn'])==len(view['confirmed_facts'])==2
    assert '2,000.00' in view['confirmed_facts_bn'][0]
    assert view['last_verified_update']['text_bn'] in [n['text_bn'] for n in view['notifications']]


def test_owner_change_invalidates_approval_and_requires_restart(master):
    t,c=transfer(master);run=analyze(master,c['id'])
    approved=change(master,c['id'],'approvals',{'note':'Checked the exact extra debit.'}).json()
    change(master,c['id'],'handoff',dict(destination='staff_2',reason='Receiving team owns the next action.'))
    change(master,c['id'],'acknowledge',{},role='other_staff')
    current=call(master,'/investigations/'+run['id']).json()
    assert not current['eligibility']['eligible'] and current['approvals'][0]['status']=='STALE'
    assert change(master,c['id'],'repairs/execute',{'approval_id':approved['approval']['id']},role='other_staff').status_code in (403,409)
    newrun=analyze(master,c['id'])
    assert newrun['eligibility']['eligible']
    assert change(master,c['id'],'approvals',{'note':'Current owner review.'},role='other_staff').status_code==200
