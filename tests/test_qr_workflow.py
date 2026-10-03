"""QR evidence provenance, exact context, guarded decisions and synthetic outcomes."""
import base64
import hashlib
import json
import uuid
import pytest
from fastapi.testclient import TestClient
from tracefix.app import app
from tracefix import store
from tracefix.qr_receipt import sample_receipt


@pytest.fixture
def qr(tmp_path,monkeypatch):
    monkeypatch.setattr(store,'DB_PATH',tmp_path/'qr.sqlite3')
    monkeypatch.setenv('TRACEFIX_SIM_TICKER','0')
    with TestClient(app) as client:
        tokens={r:client.post('/api/session',json={'role':r}).json()['token'] for r in ('customer','other_customer','staff','other_staff')}
        yield client,tokens


def headers(qr,role='customer',key=None):
    return {'X-TraceFix-Session':qr[1][role],'Idempotency-Key':key or uuid.uuid4().hex}


def post(qr,path,body,role='customer',key=None,status=200):
    r=qr[0].post('/api'+path,json=body,headers=headers(qr,role,key))
    assert r.status_code==status,r.text
    return r.json()


def setup(qr,profile='confirmed',transcript=None):
    sim=post(qr,'/simulations',dict(customer_name='Amina',merchant='Rafi Store',item='Groceries',total_minor=50000,qr_amount_minor=50000,profile=profile))
    for action,extra in [('attempt_qr',{}),('pay_cash',dict(amount_minor=50000)),('observe_debit',{})]:
        sim=post(qr,'/simulations/'+sim['id']+'/action',dict(version=sim['version'],action=action,**extra))
    assert sim['qr_display_result']=='FAILED' and sim['customer_observed_debit']
    raw,_,text=sample_receipt(sim)
    r=qr[0].post('/api/simulations/'+sim['id']+'/receipt',headers=headers(qr),data=dict(version=sim['version'],transcript=text if transcript is None else transcript(text)),files={'file':('receipt.png',raw,'image/png')})
    assert r.status_code==200,r.text
    sim=r.json()
    result=post(qr,'/simulations/'+sim['id']+'/complaint',dict(version=sim['version'],description='The QR screen failed. Cash paid, then a late debit appeared.',receipt_evidence_id=sim['receipt_evidence_id']))
    case=qr[0].get('/api/cases/'+result['case']['id'],headers=headers(qr,'staff')).json()
    return sim,case,raw,text


def case_op(qr,c,op,body=None,key=None,status=200,role='staff'):
    return post(qr,'/cases/'+c['id']+'/'+op,dict(version=c['version'],evidence_version=c['evidence_version'],**(body or {})),role,key,status)


def verify(qr,c):
    c=case_op(qr,c,'check',dict(kind='receipt_scan'))
    return case_op(qr,c,'check',dict(kind='marketplace'))


def test_complete_customer_lifecycle_immutable_receipt_and_scan(qr):
    sim,c,raw,text=setup(qr)
    assert sim['customer_state']=='RECEIPT_ATTACHED'
    e=next(e for e in c['evidence'] if e.get('receipt_draft_id'))
    assert base64.b64decode(e['blob']['base64'])==raw
    assert e['original_hash']==hashlib.sha256(raw).hexdigest()
    assert e['kind']=='customer_supplied' and e['capability'] is None
    case_op(qr,c,'check',dict(kind='marketplace'),status=409)
    c=case_op(qr,c,'check',dict(kind='receipt_scan'))
    scan=c['qr_pipeline']['receipt_scan']
    assert scan['engine']=={'name':'opencv','version':'4.10.0'}
    assert scan['input_sha256']==e['original_hash'] and scan['source_evidence_id']==e['id']
    assert scan['fields']['purchase_id']==sim['purchase_id']
    assert all('bbox' in r and r['value_source']=='preserved_transcript' for r in scan['regions'])
    assert {'threshold','paper_contour','perspective_correction','region_detection'}<=set(scan['processing'])
    assert base64.b64decode(next(e for e in c['evidence'] if e.get('receipt_draft_id'))['blob']['base64'])==raw
    original=qr[0].get('/api/evidence/'+e['id']+'/file',headers=headers(qr)).content
    assert original==raw


def test_receipt_upload_is_idempotent_and_versioned(qr):
    sim=post(qr,'/simulations',dict(customer_name='A',merchant='B',item='C',total_minor=10000,qr_amount_minor=10000))
    for action,extra in [('attempt_qr',{}),('pay_cash',dict(amount_minor=10000))]:
        sim=post(qr,'/simulations/'+sim['id']+'/action',dict(version=sim['version'],action=action,**extra))
    raw,_,text=sample_receipt(sim)
    def upload(version,transcript=text,role='customer'):
        return qr[0].post('/api/simulations/'+sim['id']+'/receipt',headers=headers(qr,role,'upload-repeat'),data=dict(version=version,transcript=transcript),files={'file':('a.png',raw,'image/png')})
    a=upload(sim['version']);b=upload(sim['version'])
    assert a.status_code==200 and a.json()==b.json()
    assert upload(sim['version'],text+' changed').status_code==409
    assert upload(sim['version'],role='other_customer').status_code==404
    assert upload(sim['version'],role='staff').status_code==403
    attached=a.json()
    post(qr,'/simulations/'+sim['id']+'/complaint',dict(version=attached['version'],description='Complaint',receipt_evidence_id='receipt_wrong'),status=409)
    post(qr,'/simulations/'+sim['id']+'/complaint',dict(version=attached['version'],description='Complaint'),status=422)


@pytest.mark.parametrize('profile,expected',[('confirmed','LEGITIMATE'),('denied','REJECTED'),('unverified','UNCERTAIN'),('qr_failed','UNCERTAIN')])
def test_source_branch_and_refund_guards(qr,profile,expected):
    sim,c,_,_=setup(qr,profile)
    c=verify(qr,c)
    assert c['qr_pipeline']['marketplace']['outcome']==expected
    c=case_op(qr,c,'qr-action',dict(action='verdict',verdict=expected))
    if expected=='LEGITIMATE':
        case_op(qr,c,'qr-action',dict(action='complete_refund'),status=409)
        case_op(qr,c,'qr-action',dict(action='approve_refund'),role='customer',status=403)
        case_op(qr,c,'qr-action',dict(action='approve_refund'),role='other_staff',status=403)
        c=case_op(qr,c,'qr-action',dict(action='approve_refund'))
        assert c['qr_pipeline']['resolution']['state']=='REFUND_REQUESTED'
        safe=qr[0].get('/api/cases/'+c['id'],headers=headers(qr)).json()
        assert safe['qr_pipeline']['resolution']['state']!='REFUND_COMPLETED'
        c=case_op(qr,c,'qr-action',dict(action='complete_refund'),key='refund-repeat')
        assert c['qr_pipeline']['resolution']['state']=='REFUND_COMPLETED'
        old_version=c['version']-1
        repeat=post(qr,'/cases/'+c['id']+'/qr-action',dict(version=old_version,evidence_version=c['evidence_version'],action='complete_refund'),'staff','refund-repeat')
        assert repeat==c
        case_op(qr,c,'qr-action',dict(action='complete_refund'),status=409)
    else:
        assert 'resolution' not in c['qr_pipeline']
        case_op(qr,c,'qr-action',dict(action='approve_refund'),status=409)
        if expected=='UNCERTAIN':
            c=case_op(qr,c,'qr-action',dict(action='handoff'))
            h=c['qr_pipeline']['handoff']
            assert h['owner']=='staff_1' and h['destination']=='staff_2' and h['next_review'] and h['missing_evidence']
            assert c['status']=='ESCALATED'
            c=case_op(qr,c,'acknowledge',role='other_staff')
            assert c['owner']=='staff_2' and c['qr_pipeline']['handoff']['status']=='ACKNOWLEDGED'


@pytest.mark.parametrize('change',[
    lambda s:s.replace('Merchant: Rafi Store','Merchant: Different shop'),
    lambda s:s.replace('Amount: BDT 500.00','Amount: BDT 900.00'),
    lambda s:s.replace('Cash reference: CASH-','Cash reference: WRONG-'),
    lambda s:s.replace('Item: Groceries','Item: Shoes'),
])
def test_mismatched_receipt_never_approves_refund(qr,change):
    _,c,_,_=setup(qr,transcript=change)
    c=verify(qr,c)
    assert c['qr_pipeline']['marketplace']['outcome']=='REJECTED'
    case_op(qr,c,'qr-action',dict(action='verdict',verdict='LEGITIMATE'),status=409)


def test_missing_fields_and_unavailable_marketplace_are_uncertain(qr):
    _,c,_,_=setup(qr,transcript=lambda text:'Merchant: Rafi Store')
    c=verify(qr,c)
    assert c['qr_pipeline']['marketplace']['outcome']=='UNCERTAIN'
    case_op(qr,c,'qr-action',dict(action='verdict',verdict='REJECTED'),status=409)
    _,c,_,_=setup(qr)
    c=case_op(qr,c,'check',dict(kind='receipt_scan'))
    c=case_op(qr,c,'check',dict(kind='marketplace',simulate_unavailable=True))
    assert c['qr_pipeline']['marketplace']['outcome']=='UNCERTAIN'
    assert not c['verified_bank_record']['verified']


def test_new_evidence_invalidates_saved_verdict_and_customer_projection(qr):
    _,c,_,_=setup(qr)
    c=verify(qr,c)
    c=case_op(qr,c,'qr-action',dict(action='verdict',verdict='LEGITIMATE'))
    c=case_op(qr,c,'evidence',dict(kind='staff_supplied',text='Additional receipt context'))
    case_op(qr,c,'qr-action',dict(action='approve_refund'),status=409)
    case_op(qr,c,'check',dict(kind='marketplace'),status=409)
    safe=qr[0].get('/api/cases/'+c['id'],headers=headers(qr)).json()
    assert 'verdict' not in safe['qr_pipeline'] and 'resolution' not in safe['qr_pipeline']
    assert 'receipt_scan' not in safe['qr_pipeline'] and 'marketplace' not in safe['qr_pipeline']
    assert 'qr_events' not in safe and 'verified_bank_record' not in safe
    sim=qr[0].get('/api/simulations/'+c['simulation_id'],headers=headers(qr)).json()
    assert 'marketplace_record' not in sim and 'profile' not in sim and 'source_records' not in sim
    assert 'confidence' not in json.dumps(safe)


def test_scan_complaint_verdict_and_events_are_idempotent(qr):
    sim,c,_,_=setup(qr)
    original_version=c['version']
    c=case_op(qr,c,'check',dict(kind='receipt_scan'),key='scan-key')
    repeat=post(qr,'/cases/'+c['id']+'/check',dict(version=original_version,evidence_version=c['evidence_version'],kind='receipt_scan'),'staff','scan-key')
    assert repeat==c
    events=c['qr_events'][:]
    c=case_op(qr,c,'check',dict(kind='receipt_scan'))
    assert c['qr_events']==events
    c=case_op(qr,c,'check',dict(kind='marketplace'))
    before=c['version']
    c=case_op(qr,c,'qr-action',dict(action='verdict',verdict='LEGITIMATE'),key='verdict-repeat')
    repeat=post(qr,'/cases/'+c['id']+'/qr-action',dict(version=before,evidence_version=c['evidence_version'],action='verdict',verdict='LEGITIMATE'),'staff','verdict-repeat')
    assert repeat==c
    kinds=[e['kind'] for e in c['qr_events']]
    assert 'MARKETPLACE_QUERY_STARTED' in kinds and 'VERDICT_RECORDED' in kinds
    assert 'REFUND_COMPLETED' not in kinds
    assert [e['sequence'] for e in c['qr_events']]==list(range(1,len(c['qr_events'])+1))
    assert all(e['actor'] and e['at'] and e['source_identifiers'] and e['evidence_version'] and e['idempotency_key'] for e in c['qr_events'])
    repeat=post(qr,'/simulations/'+sim['id']+'/complaint',dict(version=sim['version'],description='Retry complaint'))
    assert repeat['case']['id']==c['id']


@pytest.mark.parametrize('source_change,expected',[
    ({'order_exists':False},'REJECTED'),
    ({'available':False},'UNCERTAIN'),
    ({'timeout':True},'UNCERTAIN'),
    ({'conflicting_records':True},'UNCERTAIN'),
    ({'refunded':True},'UNCERTAIN'),
    ({'bank_debit_reference':'BANK-OTHER'},'REJECTED'),
])
def test_bounded_marketplace_edge_cases(qr,source_change,expected):
    _,c,_,_=setup(qr)
    with store.transaction() as db:
        row=db.execute('SELECT body FROM simulations WHERE id=?',(c['simulation_id'],)).fetchone()
        sim=json.loads(row['body']);sim['marketplace_record'].update(source_change)
        db.execute('UPDATE simulations SET body=? WHERE id=?',(json.dumps(sim),sim['id']))
    c=verify(qr,c)
    assert c['qr_pipeline']['marketplace']['outcome']==expected
    if source_change.get('available') is False or source_change.get('timeout') or source_change.get('conflicting_records') or source_change.get('bank_debit_reference'):
        assert not c['verified_bank_record']['verified']
    case_op(qr,c,'qr-action',dict(action='verdict',verdict='LEGITIMATE'),status=409)


def test_changed_marketplace_result_invalidates_approval(qr):
    _,c,_,_=setup(qr)
    c=verify(qr,c)
    c=case_op(qr,c,'qr-action',dict(action='verdict',verdict='LEGITIMATE'))
    c=case_op(qr,c,'check',dict(kind='marketplace',simulate_unavailable=True))
    assert c['qr_pipeline']['verdict']['status']=='STALE'
    case_op(qr,c,'qr-action',dict(action='approve_refund'),status=409)
    safe=qr[0].get('/api/cases/'+c['id'],headers=headers(qr)).json()
    assert 'verdict' not in safe['qr_pipeline']


def test_export_provenance_and_no_preview_bytes(qr):
    _,c,raw,_=setup(qr)
    c=verify(qr,c)
    r=qr[0].get('/api/cases/'+c['id']+'/dossier',headers=headers(qr,'staff'))
    assert r.status_code==200
    assert hashlib.sha256(raw).hexdigest() in r.text
    assert 'OpenCV' in r.text and 'Append-only QR event history' in r.text
    assert 'preview_base64' not in r.text
    assert r.headers['X-Dossier-SHA256']==hashlib.sha256(r.content).hexdigest()
    assert qr[0].get('/api/cases/'+c['id']+'/dossier',headers=headers(qr)).status_code==403


def test_transcript_correction_keeps_original_and_invalidates_decision(qr):
    _,c,raw,text=setup(qr)
    c=verify(qr,c)
    c=case_op(qr,c,'qr-action',dict(action='verdict',verdict='LEGITIMATE'))
    e=next(e for e in c['evidence'] if e.get('receipt_draft_id'))
    c=case_op(qr,c,'correct',dict(evidence_id=e['id'],text=text.replace('500.00','700.00'),reason='Correct the supplied receipt wording'))
    same=next(v for v in c['evidence'] if v['id']==e['id'])
    assert same['original_hash']==hashlib.sha256(raw).hexdigest()
    assert base64.b64decode(same['blob']['base64'])==raw
    assert len(same['revisions'])==2 and c['qr_pipeline']['verdict']['status']=='STALE'
    case_op(qr,c,'qr-action',dict(action='approve_refund'),status=409)
    c=verify(qr,c)
    assert c['qr_pipeline']['marketplace']['outcome']=='REJECTED'


def test_receipt_size_mime_and_actual_bytes_are_validated(qr):
    sim=post(qr,'/simulations',dict(customer_name='A',merchant='B',item='C',total_minor=10000,qr_amount_minor=10000))
    path='/api/simulations/'+sim['id']+'/receipt'
    for content,mime in [(b'not-an-image','image/png'),(b'x'*(2*1024*1024+1),'image/png')]:
        r=qr[0].post(path,headers=headers(qr),data=dict(version=sim['version'],transcript='A receipt'),files={'file':('file.png',content,mime)})
        assert r.status_code in (413,422)
    raw,_,_=sample_receipt(dict(sim,cash_amount_minor=10000))
    r=qr[0].post(path,headers=headers(qr),data=dict(version=sim['version'],transcript='A receipt'),files={'file':('file.jpg',raw,'image/jpeg')})
    assert r.status_code==422
    r=qr[0].post(path,headers=headers(qr),data=dict(version=sim['version'],transcript=''),files={'file':('file.png',raw,'image/png')})
    assert r.status_code==422


def test_gets_and_graph_history_do_not_mutate_or_complete_refunds(qr):
    _,c,_,_=setup(qr)
    c=verify(qr,c)
    c=case_op(qr,c,'qr-action',dict(action='verdict',verdict='LEGITIMATE'))
    before=c['qr_events'][:]
    for _ in range(3):
        fetched=qr[0].get('/api/cases/'+c['id'],headers=headers(qr,'staff')).json()
        assert fetched['version']==c['version'] and fetched['qr_events']==before
        assert fetched['qr_pipeline']['resolution']['state']=='REFUND_PROPOSED'
    with store.connect() as db:
        row=db.execute('SELECT body FROM simulations WHERE id=?',(c['simulation_id'],)).fetchone()
        assert not json.loads(row['body'])['marketplace_record']['refunded']
