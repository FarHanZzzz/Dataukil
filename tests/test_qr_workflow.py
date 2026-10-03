"""QR evidence provenance, exact context, guarded decisions and synthetic outcomes."""
import base64
import hashlib
import json
import uuid
import pytest
from fastapi.testclient import TestClient
from tracefix.app import app
from tracefix import store
from tracefix.qr_receipt import sample_receipt, render_receipt, annotate, DEFAULT_ITEMS, parse_transcript


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


def setup(qr,profile='confirmed',transcript=None,purchase=None,cash_minor=50000):
    sim=post(qr,'/simulations',dict(customer_name='Amina',merchant='Rafi Store',item='Groceries',total_minor=50000,qr_amount_minor=50000,profile=profile)|(purchase or {}))
    for action,extra in [('attempt_qr',{}),('pay_cash',dict(amount_minor=cash_minor)),('observe_debit',{})]:
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


def review(qr,c,**extra):
    scan=c['qr_pipeline']['receipt_scan']
    fields=[f for f in scan['field_associations'] if f['field']!='barcode']
    missing=[f['field'] for f in fields if not f['region_ids'] or f['displayed_value'] is None]
    return case_op(qr,c,'qr-action',dict(action='review_receipt',scan_id=scan['scan_id'],
        field_regions={f['field']:[] if f['field'] in missing else f['region_ids'] for f in fields},
        reviewed_fields=[f['field'] for f in fields],missing_fields=missing,reason='Reviewed original and acknowledged missing fields',**extra))


def verify(qr,c):
    c=case_op(qr,c,'check',dict(kind='receipt_scan'))
    c=review(qr,c)
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
    lambda s:s.replace('Total: BDT 500.00','Total: BDT 900.00'),
    lambda s:s.replace('Cash reference: CASH-','Cash reference: WRONG-'),
    lambda s:s.replace('"Groceries"','"Shoes"'),
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
    c=review(qr,c)
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
    c=review(qr,c)
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


@pytest.mark.parametrize('total,qr_amount,cash,outcome,refund',[
    (50000,50000,50000,'LEGITIMATE',50000),
    (100000,40000,60000,'REJECTED',None),
    (50000,20000,45000,'LEGITIMATE',15000),
    (50000,50000,70000,'UNCERTAIN',None),
    (50000,20000,20000,'REJECTED',None),
])
def test_verified_excess_not_full_qr_refund(qr,total,qr_amount,cash,outcome,refund):
    _,c,_,_=setup(qr,purchase=dict(total_minor=total,qr_amount_minor=qr_amount),cash_minor=cash)
    c=verify(qr,c);market=c['qr_pipeline']['marketplace']
    assert market['outcome']==outcome and market['refund_amount_minor']==refund
    assert market['verified_excess_minor']==qr_amount+cash-total
    c=case_op(qr,c,'qr-action',dict(action='verdict',verdict=outcome))
    if refund:
        assert c['qr_pipeline']['resolution']['amount_minor']==refund
        c=case_op(qr,c,'qr-action',dict(action='approve_refund'))
        c=case_op(qr,c,'qr-action',dict(action='complete_refund'))
        assert c['qr_pipeline']['resolution']['amount_minor']==refund
    else:
        assert not c['qr_pipeline'].get('resolution')
        case_op(qr,c,'qr-action',dict(action='approve_refund'),status=409)
        if outcome=='REJECTED':assert market['reason_code']=='NO_OVERPAYMENT'


def test_itemized_snapshot_tax_and_exact_issued_artifact(qr):
    sim=post(qr,'/simulations',dict(customer_name='Amina',merchant='FreshMart Demo',line_items=DEFAULT_ITEMS,
        qr_amount_minor=50000,tax_minor=0))
    assert sim['total_minor']==50000 and sim['subtotal_minor']==50000 and len(sim['line_items'])==9
    for action,extra in [('attempt_qr',{}),('pay_cash',dict(amount_minor=50000)),('observe_debit',{}),('attach_sample_receipt',{})]:
        sim=post(qr,'/simulations/'+sim['id']+'/action',dict(version=sim['version'],action=action,**extra))
    issued=sim['issued_receipt'];draft=sim['receipt_draft']
    assert issued['base64']==draft['base64'] and issued['hash']==draft['hash']
    fields=parse_transcript(issued['transcript'])
    assert len(fields['line_items'])==9 and fields['total']=='500.00' and fields['cash_paid']=='500.00'
    result=post(qr,'/simulations/'+sim['id']+'/complaint',dict(version=sim['version'],description='Paid twice',receipt_evidence_id=draft['id']))
    c=qr[0].get('/api/cases/'+result['case']['id'],headers=headers(qr,'staff')).json()
    c=verify(qr,c)
    assert c['qr_pipeline']['marketplace']['outcome']=='LEGITIMATE'
    assert c['qr_pipeline']['receipt_scan']['manifest_version']==2
    assert all(f['region_ids'] for f in c['qr_pipeline']['receipt_scan']['field_associations'])
    taxed=post(qr,'/simulations',dict(customer_name='A',merchant='B',line_items=[dict(description='Rice',quantity=2,unit_price_minor=8000)],tax_minor=123,qr_amount_minor=16123))
    assert taxed['total_minor']==16123 and taxed['subtotal_minor']==16000


@pytest.mark.parametrize('fields',[
    dict(line_items=[]),dict(line_items=[dict(description='x',quantity=1.5,unit_price_minor=100)]),
    dict(line_items=[dict(description='x',quantity=1,unit_price_minor=1.5)]),
    dict(line_items=[dict(description='x',quantity=True,unit_price_minor=100)]),
    dict(line_items=DEFAULT_ITEMS,total_minor=49999),dict(line_items=DEFAULT_ITEMS,tax_minor=-1),
    dict(line_items=DEFAULT_ITEMS*3),dict(line_items=[dict(description='x'*81,quantity=1,unit_price_minor=100)]),
])
def test_item_validation(qr,fields):
    post(qr,'/simulations',dict(customer_name='A',merchant='B',qr_amount_minor=100)|fields,status=422)


def test_review_gate_ids_ownership_idempotency_and_stale_verdict(qr):
    _,c,_,_=setup(qr);c=case_op(qr,c,'check',dict(kind='receipt_scan'))
    case_op(qr,c,'check',dict(kind='marketplace'),status=409)
    scan=c['qr_pipeline']['receipt_scan'];fields=[f for f in scan['field_associations'] if f['field']!='barcode']
    payload=dict(action='review_receipt',scan_id=scan['scan_id'],field_regions={f['field']:f['region_ids'] for f in fields},
        reviewed_fields=[f['field'] for f in fields],missing_fields=[],reason='Reviewed printed fields')
    case_op(qr,c,'qr-action',payload,role='customer',status=403)
    case_op(qr,c,'qr-action',payload,role='other_staff',status=403)
    case_op(qr,c,'qr-action',payload|dict(scan_id='wrong'),status=409)
    case_op(qr,c,'qr-action',payload|dict(field_regions=payload['field_regions']|dict(total=['not-a-region'])),status=422)
    old=c['version'];c=case_op(qr,c,'qr-action',payload,key='review-idempotent')
    repeat=post(qr,'/cases/'+c['id']+'/qr-action',dict(version=old,evidence_version=c['evidence_version'],**payload),'staff','review-idempotent')
    assert repeat==c and c['qr_events'][-1]['kind']=='RECEIPT_REVIEW_SAVED'
    c=case_op(qr,c,'check',dict(kind='marketplace'));c=case_op(qr,c,'qr-action',dict(action='verdict',verdict='LEGITIMATE'))
    c=case_op(qr,c,'qr-action',payload|dict(field_regions=payload['field_regions']|dict(cash_paid=[]),missing_fields=['cash_paid']))
    assert c['qr_pipeline']['marketplace']['status']=='STALE' and c['qr_pipeline']['verdict']['status']=='STALE'
    case_op(qr,c,'qr-action',dict(action='approve_refund'),status=409)
    c=case_op(qr,c,'check',dict(kind='marketplace'))
    assert c['qr_pipeline']['marketplace']['outcome']=='UNCERTAIN'
    safe=qr[0].get('/api/cases/'+c['id'],headers=headers(qr)).json()
    assert 'receipt_review' not in safe['qr_pipeline']


def test_blank_upload_has_no_invented_regions():
    import io
    from PIL import Image
    out=io.BytesIO();Image.new('RGB',(500,800),'white').save(out,format='PNG')
    manifest=annotate(out.getvalue(),'Merchant: FreshMart')
    assert manifest['regions']==[] and manifest['status']=='NEEDS_REVIEW'
    assert all(not f['region_ids'] for f in manifest['field_associations'])
    assert manifest['input_sha256']==hashlib.sha256(out.getvalue()).hexdigest()


def test_geometry_roundtrip_and_fixture_boxes():
    import numpy as np
    sim=dict(merchant='FreshMart Demo',item='Groceries',total_minor=50000,cash_amount_minor=20000,
        purchase_id='PUR-GEOMETRY',created_at='2026-10-04T00:00:00+00:00',line_items=DEFAULT_ITEMS)
    raw,_,layout=render_receipt(sim);scan=annotate(raw,sample_receipt(sim)[2],template=layout)
    matrix=np.array(scan['geometry']['original_to_preview']);inverse=np.array(scan['geometry']['preview_to_original'])
    assert np.allclose(matrix@inverse,np.eye(3))
    w,h=scan['geometry']['preview_dimensions']
    assert all(x>=0 and y>=0 and x+bw<=w+1 and y+bh<=h+1 for x,y,bw,bh in (r['bbox'] for r in scan['regions']))
    assert scan['fields']['total']=='500.00' and scan['fields']['cash_paid']=='200.00'
    assert all(f['region_ids'] for f in scan['field_associations'])
    # A fixture's labels are permitted only alongside its trusted measured template.
    arbitrary=annotate(raw,sample_receipt(sim)[2])
    assert all(r['semantic_source']=='unassigned' for r in arbitrary['regions'])
    assert all(not f['region_ids'] for f in arbitrary['field_associations'])


def test_exif_orientation_and_perspective_geometry():
    import io
    import cv2
    import numpy as np
    from PIL import Image
    sim=dict(merchant='FreshMart Demo',item='Rice',total_minor=50000,cash_amount_minor=50000,
        purchase_id='PUR-PHOTO',created_at='2026-10-04T00:00:00+00:00')
    raw,text,_=render_receipt(sim)
    with Image.open(io.BytesIO(raw)) as image:
        image=image.rotate(90,expand=True);exif=image.getexif();exif[274]=6
        out=io.BytesIO();image.save(out,format='JPEG',exif=exif)
    rotated=annotate(out.getvalue(),text,'image/jpeg')
    assert rotated['geometry']['exif_orientation']==6
    assert rotated['geometry']['oriented_dimensions'][0]<rotated['geometry']['oriented_dimensions'][1]
    image=cv2.imdecode(np.frombuffer(raw,dtype='uint8'),cv2.IMREAD_COLOR);h,w=image.shape[:2]
    transform=cv2.getPerspectiveTransform(np.array([[0,0],[w-1,0],[w-1,h-1],[0,h-1]],dtype='float32'),
        np.array([[80,60],[w+30,110],[w+65,h+60],[25,h+30]],dtype='float32'))
    skew=cv2.warpPerspective(image,transform,(w+160,h+160),borderValue=(240,240,240))
    ok,buffer=cv2.imencode('.png',skew);assert ok
    manifest=annotate(buffer.tobytes(),text)
    assert manifest['geometry']['paper_quadrilateral'] is not None and manifest['regions']
    assert np.allclose(np.array(manifest['geometry']['original_to_preview'])@np.array(manifest['geometry']['preview_to_original']),np.eye(3))


def test_changed_review_archives_pending_proposal_and_allows_handoff(qr):
    _,c,_,_=setup(qr);c=verify(qr,c)
    c=case_op(qr,c,'qr-action',dict(action='verdict',verdict='LEGITIMATE'))
    old=c['qr_pipeline']['resolution']
    scan=c['qr_pipeline']['receipt_scan'];fields=[f for f in scan['field_associations'] if f['field']!='barcode']
    c=case_op(qr,c,'qr-action',dict(action='review_receipt',scan_id=scan['scan_id'],
        field_regions={f['field']:[] if f['field']=='cash_paid' else f['region_ids'] for f in fields},
        reviewed_fields=[f['field'] for f in fields],missing_fields=['cash_paid'],reason='Cash amount cannot be confidently located'))
    assert 'resolution' not in c['qr_pipeline']
    assert c['qr_pipeline']['resolution_history'][-1]['amount_minor']==old['amount_minor']
    assert c['qr_pipeline']['resolution_history'][-1]['status']=='STALE'
    c=case_op(qr,c,'check',dict(kind='marketplace'))
    c=case_op(qr,c,'qr-action',dict(action='verdict',verdict='UNCERTAIN'))
    c=case_op(qr,c,'qr-action',dict(action='handoff'))
    assert c['qr_pipeline']['handoff']['next_review']


def test_completed_refund_remains_visible_after_additional_evidence(qr):
    _,c,_,_=setup(qr);c=verify(qr,c)
    for action,extra in [('verdict',dict(verdict='LEGITIMATE')),('approve_refund',{}),('complete_refund',{})]:
        c=case_op(qr,c,'qr-action',dict(action=action,**extra))
    c=case_op(qr,c,'evidence',dict(kind='staff_supplied',text='Additional historical context'))
    safe=qr[0].get('/api/cases/'+c['id'],headers=headers(qr)).json()
    assert safe['qr_pipeline']['resolution']['state']=='REFUND_COMPLETED'
    assert safe['qr_pipeline']['resolution']['amount_minor']==50000
    case_op(qr,c,'check',dict(kind='receipt_scan'),status=409)
    case_op(qr,c,'check',dict(kind='marketplace'),status=409)
    assert c['qr_pipeline']['resolution']['state']=='REFUND_COMPLETED'


@pytest.mark.parametrize('edit,expected',[
    (lambda text:text.replace('Currency: BDT','Currency: USD'),'REJECTED'),
    (lambda text:text.replace('Payment: CASH','Payment: CARD'),'REJECTED'),
    (lambda text:text.replace(' +0600',''),'UNCERTAIN'),
])
def test_currency_tender_and_ambiguous_timestamp(qr,edit,expected):
    _,c,_,_=setup(qr,transcript=edit);c=verify(qr,c)
    assert c['qr_pipeline']['marketplace']['outcome']==expected


def test_long_itemized_receipt_bangla_and_preview_scaling():
    import numpy as np
    rows=[dict(description=('দুধ ' if i==0 else 'Long product description ')+('x'*55),quantity=2,unit_price_minor=835) for i in range(20)]
    sim=dict(merchant='দোকান',merchant_address='Dhaka, Bangladesh',line_items=rows,item='Basket',
        total_minor=33400,subtotal_minor=33400,tax_minor=0,cash_amount_minor=33400,
        purchase_id='PUR-LONG',created_at='2026-10-04T00:00:00+00:00')
    raw,text,layout=render_receipt(sim)
    assert len(text)<=4000 and len(raw)<2*1024*1024
    assert render_receipt(sim)[0]==raw
    scan=annotate(raw,text,template=layout)
    assert max(scan['geometry']['preview_dimensions'])==1600
    assert scan['geometry']['rectified_dimensions'][1]>1600
    assert len(scan['fields']['line_items'])==20
    assert np.allclose(np.array(scan['geometry']['original_to_preview'])@np.array(scan['geometry']['preview_to_original']),np.eye(3))
    # Low contrast and cropped photos remain actual generic detections, not template guesses.
    import io
    from PIL import Image,ImageEnhance
    with Image.open(io.BytesIO(raw)) as image:
        cropped=ImageEnhance.Contrast(image.crop((75,100,image.width-75,image.height-80))).enhance(.25)
        out=io.BytesIO();cropped.save(out,format='PNG')
    generic=annotate(out.getvalue(),text)
    assert generic['regions'] and all(r['semantic_source']=='unassigned' for r in generic['regions'])
    assert all(not f['region_ids'] for f in generic['field_associations'])
