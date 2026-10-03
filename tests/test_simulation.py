"""Verify actual simulated payment states, evidence boundaries and shared conversation."""
from datetime import datetime, timezone, timedelta
from concurrent.futures import ThreadPoolExecutor
import threading
import pytest
from fastapi.testclient import TestClient
from tracefix.app import app
from tracefix import store
from tracefix.verifier import verifier


@pytest.fixture
def demo(tmp_path,monkeypatch):
    monkeypatch.setattr(store,'DB_PATH',tmp_path/'simulation.sqlite3')
    monkeypatch.setattr(verifier,'predict',lambda pairs:[dict(label='SUPPORTED_BY_PASSAGE',engine='test_stub',model_available=False) for _ in pairs])
    with TestClient(app) as client:
        customer=client.post('/api/session',json={'role':'customer'}).json()['token']
        staff=client.post('/api/session',json={'role':'staff'}).json()['token']
        yield client,customer,staff


def call(demo,role,path,body=None,key=None):
    client,customer,staff=demo
    headers={'X-TraceFix-Session':customer if role=='customer' else staff}
    if body is None:return client.get('/api'+path,headers=headers)
    headers['Idempotency-Key']=key or str(call.counter)
    call.counter+=1
    return client.post('/api'+path,json=body,headers=headers)
call.counter=0


def purchase(demo,profile='confirmed',total=72550,qr=72550,cash=72550):
    r=call(demo,'customer','/simulations',dict(customer_name='Test customer',merchant='Test Store',item='Books',total_minor=total,qr_amount_minor=qr,profile=profile))
    assert r.status_code==200,r.text
    sim=r.json()
    for action,extra in [('attempt_qr',{}),('pay_cash',{'amount_minor':cash}),('refresh_qr',{})]:
        r=call(demo,'customer','/simulations/'+sim['id']+'/action',dict(version=sim['version'],action=action,**extra))
        assert r.status_code==200,r.text
        sim=r.json()
    r=call(demo,'customer','/simulations/'+sim['id']+'/complaint',dict(version=sim['version'],description='QR was unclear. I paid cash for the same purchase.',receipt_text='Cash receipt supplied by me.'))
    assert r.status_code==200,r.text
    return r.json()['simulation'],r.json()['case']


def case_post(demo,case_id,action,body=None,key=None,version=None,role='staff'):
    c=call(demo,role,'/cases/'+case_id).json()
    return call(demo,role,'/cases/'+case_id+'/'+action,dict(version=c['version'] if version is None else version,**(body or {})),key)


def test_independent_surface_tokens_do_not_follow_cookie_role(demo):
    # The shared cookie currently holds staff; header-bound customer calls still stay customer.
    assert call(demo,'customer','/session').json()['role']=='customer'
    assert call(demo,'staff','/session').json()['role']=='staff'
    assert call(demo,'customer','/cases/case_2').status_code==404
    assert call(demo,'customer','/cases/case_3/analyze',{'version':1}).status_code==403
    assert call(demo,'customer','/simulation-inbox').status_code==403


def test_stage_guards_idempotency_and_no_source_truth_in_projection(demo):
    body=dict(customer_name='A',merchant='B',item='C',total_minor=50000,qr_amount_minor=50000,profile='confirmed')
    a=call(demo,'customer','/simulations',body,'create-repeat').json()
    b=call(demo,'customer','/simulations',body,'create-repeat').json()
    assert a==b and a['qr_image'].startswith('data:image/png;base64,')
    assert 'profile' not in a and 'source_records' not in a
    incoming=call(demo,'staff','/simulation-inbox').json()
    assert incoming[0]['id']==a['id'] and 'source_records' not in incoming[0] and 'profile' not in incoming[0]
    path='/simulations/'+a['id']+'/action'
    assert call(demo,'customer',path,dict(version=1,action='pay_cash',amount_minor=50000)).status_code==409
    payload=dict(version=1,action='attempt_qr')
    first=call(demo,'customer',path,payload,'qr-repeat')
    repeat=call(demo,'customer',path,payload,'qr-repeat')
    assert first.json()==repeat.json() and len(first.json()['events'])==2
    assert call(demo,'customer',path,payload,'different-key').status_code==409
    assert call(demo,'staff',path,dict(version=2,action='pay_cash',amount_minor=50000)).status_code==403


@pytest.mark.parametrize('profile,total,qr,cash,expected',[
    ('confirmed',72550,72550,72550,'SUPPORTED'),
    ('unverified',50000,50000,50000,'NEEDS_EVIDENCE'),
    ('denied',50000,50000,50000,'CONFLICTING'),
    ('confirmed',100000,40000,60000,'NOT_SUPPORTED'),
    ('qr_failed',50000,50000,50000,'NOT_SUPPORTED'),
])
def test_assessment_uses_checked_visible_records_not_profile(demo,profile,total,qr,cash,expected):
    sim,c=purchase(demo,profile,total,qr,cash)
    saved=call(demo,'staff','/cases/'+c['id']).json()
    assert call(demo,'customer','/payments/'+sim['qr_reference']).json()['amount_minor']==qr
    assert all(not e['kind'].startswith('mock_') for e in saved['evidence'])
    before=case_post(demo,c['id'],'analyze').json()
    assert before['analysis']['assessment']['status']=='NEEDS_EVIDENCE'
    for kind in ('qr','invoice','merchant'):
        assert case_post(demo,c['id'],'check',{'kind':kind}).status_code==200
    analyzed=case_post(demo,c['id'],'analyze').json()
    assert analyzed['analysis']['assessment']['status']==expected
    assert call(demo,'customer','/cases/'+c['id']).json()['assessment']['status']==expected
    if expected=='SUPPORTED':assert analyzed['facts']['recorded_excess_minor']==cash
    if profile=='unverified':assert not analyzed['facts']['cash_confirmed']
    # Complaint submission stays one stable case even if a different key is used later.
    repeated=call(demo,'customer','/simulations/'+sim['id']+'/complaint',dict(version=sim['version'],description='Repeated click')).json()
    assert repeated['case']['id']==c['id']


def test_customer_reply_is_evidence_and_stales_assessment(demo):
    _,c=purchase(demo)
    case_post(demo,c['id'],'analyze')
    due=(datetime.now(timezone.utc)+timedelta(hours=3)).isoformat()
    requested=case_post(demo,c['id'],'task',{'question':'What was the cash receipt reference?','next_review':due,'audience':'customer'}).json()
    t=requested['tasks'][-1]
    customer=call(demo,'customer','/cases/'+c['id']).json()
    assert customer['requests'][-1]['id']==t['id'] and customer['messages'][-1]['text']==t['question']
    v=customer['version']
    reply=case_post(demo,c['id'],'messages',{'text':'Receipt R-123, handwritten by the cashier.','task_id':t['id']},key='reply-repeat',version=v,role='customer')
    repeated=case_post(demo,c['id'],'messages',{'text':'Receipt R-123, handwritten by the cashier.','task_id':t['id']},key='reply-repeat',version=v,role='customer')
    assert reply.json()==repeated.json()
    updated=call(demo,'staff','/cases/'+c['id']).json()
    assert not updated['analysis_fresh'] and updated['tasks'][-1]['status']=='RESPONDED'
    response_evidence=updated['tasks'][-1]['response_evidence_id']
    assert updated['messages'][-1]['evidence_id']==response_evidence
    assert case_post(demo,c['id'],'resolve-task',{'task_id':t['id'],'evidence_id':response_evidence,'reason':'Response reviewed; supplied wording is not a verified merchant record.'}).status_code==200
    assert case_post(demo,c['id'],'messages',{'text':'Thank you. I am checking the merchant record.'}).status_code==200
    assert call(demo,'customer','/cases/'+c['id']).json()['messages'][-1]['role']=='staff'


def test_complete_resolution_requires_request_check_analysis_and_cited_outcome(demo):
    sim,c=purchase(demo)
    assert call(demo,'customer','/simulations/'+sim['id']+'/repayment',{'version':sim['version']}).status_code==403
    assert call(demo,'staff','/simulations/'+sim['id']+'/repayment',{'version':sim['version']}).status_code==409
    for kind in ('qr','invoice','merchant'):case_post(demo,c['id'],'check',{'kind':kind})
    case_post(demo,c['id'],'analyze')
    assert case_post(demo,c['id'],'repayment-request',{'note':'Resolution review requested.'}).status_code==200
    before=call(demo,'staff','/cases/'+c['id']).json()
    assert before['facts']['recorded_repaid_minor']==0
    advanced=call(demo,'staff','/simulations/'+sim['id']+'/repayment',{'version':sim['version']},'advance-repay')
    assert advanced.status_code==200
    assert call(demo,'staff','/simulations/'+sim['id']+'/repayment',{'version':sim['version']},'advance-repay').json()==advanced.json()
    assert call(demo,'staff','/cases/'+c['id']).json()['version']==before['version']
    checked=case_post(demo,c['id'],'check',{'kind':'repayment'}).json()
    assert checked['facts']['recorded_repaid_minor']==72550 and not checked['analysis_fresh']
    current=case_post(demo,c['id'],'analyze').json()
    assert current['analysis']['assessment']['status']=='REPAID'
    ev=next(e for e in current['evidence'] if e['capability']=='repayment_completed')
    due=(datetime.now(timezone.utc)+timedelta(hours=3)).isoformat()
    task=case_post(demo,c['id'],'task',{'question':'Confirm the reported receipt reference.','next_review':due}).json()['tasks'][-1]
    assert case_post(demo,c['id'],'decision',{'decision':'OUTCOME_RECORDED','note':'Premature final review.','evidence_ids':[ev['id']]}).status_code==409
    assert case_post(demo,c['id'],'resolve-task',{'task_id':task['id'],'evidence_id':ev['id'],'reason':'The cited source addresses the outstanding amount; the request is reviewed.'}).status_code==200
    reviewed=case_post(demo,c['id'],'decision',{'decision':'OUTCOME_RECORDED','note':'The checked fictional source records the completed repayment.','evidence_ids':[ev['id']]})
    assert reviewed.status_code==200 and reviewed.json()['status']=='OUTCOME_RECORDED'
    customer=call(demo,'customer','/cases/'+c['id']).json()
    assert customer['status']=='OUTCOME_RECORDED' and customer['reviews'][-1]['note']==reviewed.json()['decisions'][-1]['note']


def test_new_customer_evidence_does_not_silently_complete_merchant_task(demo):
    _,c=purchase(demo,'unverified')
    due=(datetime.now(timezone.utc)+timedelta(hours=3)).isoformat()
    case_post(demo,c['id'],'task',{'question':'Get an independent merchant record.','next_review':due,'audience':'merchant'})
    assert not call(demo,'customer','/cases/'+c['id']).json()['requests']
    assert case_post(demo,c['id'],'messages',{'text':'I paid cash, trust me.'},role='customer').status_code==200
    updated=call(demo,'staff','/cases/'+c['id']).json()
    assert updated['tasks'][-1]['status']=='OPEN' and not updated['facts']['cash_confirmed']


def test_inference_allows_a_customer_reply_and_rejects_its_old_snapshot(demo,monkeypatch):
    _,c=purchase(demo)
    started=threading.Event();release=threading.Event()
    def slow(pairs):
        started.set()
        assert release.wait(10)
        return [dict(label='SUPPORTED_BY_PASSAGE',engine='test_stub',model_available=False) for _ in pairs]
    monkeypatch.setattr(verifier,'predict',slow)
    with ThreadPoolExecutor(max_workers=2) as pool:
        future=pool.submit(case_post,demo,c['id'],'analyze')
        assert started.wait(5)
        try:
            reply=case_post(demo,c['id'],'messages',{'text':'I have an additional receipt reference.'},role='customer')
            assert reply.status_code==200
            assert call(demo,'customer','/cases/'+c['id']).status_code==200
        finally:release.set()
        assert future.result().status_code==409
