from contextlib import asynccontextmanager
import asyncio
from datetime import datetime, timezone, timedelta
from pathlib import Path
import hashlib
import json
import secrets
import re
import io
import base64
from fastapi import FastAPI, Request, Response, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse, JSONResponse, PlainTextResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from PIL import Image
from starlette.concurrency import run_in_threadpool
from . import data_dna, store
from .auth import read_session
from .domain import now, uid, evidence, current_text, facts, fresh, customer_view
from .transfer import FAMILY as TRANSFER_FAMILY, router as transfer_router, start_ticker, stop_ticker
from .transfer.chat import router as chat_router

ROOT=Path(__file__).resolve().parents[1]
ROLES={'customer':'customer_1','other_customer':'customer_2','staff':'staff_1','other_staff':'staff_2','judge':'judge_1'}
MAX_FILE=2*1024*1024


@asynccontextmanager
async def lifespan(app):
    store.initialize()
    from .investigation import recover
    recover()
    app.state.investigation_tasks={}
    ticker = start_ticker()
    try:
        yield
    finally:
        tasks=list(app.state.investigation_tasks.values())
        for task in tasks:task.cancel()
        if tasks:await asyncio.gather(*tasks,return_exceptions=True)
        await stop_ticker(ticker)


app=FastAPI(title='DataUkil synthetic investigation workspace',lifespan=lifespan)
app.mount('/static',StaticFiles(directory=ROOT/'static'),name='static')
app.include_router(transfer_router)
app.include_router(chat_router)


@app.middleware('http')
async def headers(request,call_next):
    if request.method not in ('GET','HEAD','OPTIONS'):
        origin=request.headers.get('origin')
        if origin and origin != str(request.base_url).rstrip('/'):
            return JSONResponse({'detail':'Cross-origin writes are not permitted.'},status_code=403)
    response=await call_next(request)
    response.headers['X-Content-Type-Options']='nosniff'
    response.headers['Referrer-Policy']='no-referrer'
    response.headers['Content-Security-Policy']="default-src 'self'; img-src 'self' blob: data:; style-src 'self' 'sha256-yhlpZVZMy2vXExwTGihUWVSrOxyhMuvj+Ygg7pyBWek='; script-src 'self'; connect-src 'self' blob:; worker-src 'self' blob:; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
    if request.url.path.startswith('/api'):
        response.headers['Cache-Control']='no-store'
    elif response.headers.get('content-type','').startswith('text/html'):
        response.headers['Cache-Control']='no-cache'
    return response


def session(request):
    return read_session(request)


def authorize(s,c,staff=False):
    if not c:
        raise HTTPException(404,'Record not found.')
    if c.get('family')==TRANSFER_FAMILY:
        # Add-money incidents have their own role-scoped API; the QR case routes must never act on them.
        raise HTTPException(409,'This incident is managed in the add-money workspace.')
    if staff and s['role']!='staff':
        raise HTTPException(403,'Investigator permission required.')
    if s['role']=='customer' and c['customer_id']!=s['actor']:
        raise HTTPException(404,'Record not found.')
    if s['role'] in ('judge','presenter'):
        raise HTTPException(403,'Use an investigator or customer session for case work.')


def positive_int(value,field='amount_minor'):
    if isinstance(value,bool) or not isinstance(value,int) or value<1 or value>100000000:
        raise HTTPException(422,f'{field} must be an integer minor-unit amount from 1 to 100000000.')
    return value


def text_field(p,key,max_len=4000,required=True):
    v=p.get(key,'')
    if not isinstance(v,str) or len(v)>max_len or (required and not v.strip()):
        raise HTTPException(422,f'{key} is required and must be at most {max_len} characters.')
    return v.strip()


def future_time(value):
    try:
        t=datetime.fromisoformat(value.replace('Z','+00:00'))
        if t.tzinfo is None or t<=datetime.now(timezone.utc):
            raise ValueError()
        return t.astimezone(timezone.utc).isoformat()
    except (ValueError,TypeError,AttributeError):
        raise HTTPException(422,'Review time must be a future time with timezone.')


async def payload(request):
    try:
        p=await request.json()
    except Exception:
        raise HTTPException(422,'Provide a JSON object.')
    if not isinstance(p,dict) or len(json.dumps(p))>30000:
        raise HTTPException(422,'Invalid or oversized request.')
    return p


def operation(request,p,case_id,action,fn,staff=True):
    s=session(request)
    key=request.headers.get('Idempotency-Key','')
    if not key or len(key)>128:
        raise HTTPException(422,'A bounded Idempotency-Key is required.')
    digest=hashlib.sha256(json.dumps(p,sort_keys=True,ensure_ascii=False).encode()).hexdigest()
    scope=f'{case_id}:{action}'
    with store.transaction() as db:
        c=store.get_case(db,case_id)
        authorize(s,c,staff)
        old=db.execute('SELECT * FROM operations WHERE actor=? AND scope=? AND key=?',(s['actor'],scope,key)).fetchone()
        if old:
            if old['digest']!=digest:
                raise HTTPException(409,'This operation key was already used with different content.')
            return json.loads(old['response'])
        if type(p.get('version')) is not int or p['version']!=c['version']:
            raise HTTPException(409,'This case changed. Refresh before making a new change.')
        qr_event_count=len(c.get('qr_events',[]))
        fn(db,c,s,p)
        for event in c.get('qr_events',[])[qr_event_count:]:
            event.update(actor=s['actor'],idempotency_key=key,request_version=p['version'])
        if c.get('analysis') and not fresh(c):
            db.execute("UPDATE approvals SET status='STALE' WHERE case_id=? AND status='APPROVED'",(case_id,))
        c['version']+=1
        c['updated_at']=now()
        store.save_case(db,c)
        store.audit(db,c,s['actor'],action)
        result=customer_view(c) if s['role']=='customer' else staff_view(db,c)
        db.execute('INSERT INTO operations VALUES (?,?,?,?,?)',(s['actor'],scope,key,digest,json.dumps(result,ensure_ascii=False)))
        return result


def notify(c,message,text_bn=None):
    c['notifications'].append(dict(at=now(),text=message,text_bn=text_bn or 'আপনার মামলার নতুন আপডেট সংরক্ষণ করা হয়েছে। তদন্তকারী বিস্তারিত পর্যালোচনা করবেন।'))


def trace_operator_action(db,c,action,finding,next_step):
    from . import investigation
    run=investigation.get_run(db,c.get('current_run_id',''))
    if run and run['status']!='RUNNING':
        investigation.emit(db,run,'decision',action,finding,run.get('recommendation',{}).get('evidence_ids',[]),
                           'Operator action saved in case history.',next_step,state='attention' if c['status']!='RESOLVED' else 'completed')


def new_evidence(c,e):
    c['evidence'].append(e)
    c['evidence_version']+=1
    c['status']='OPEN'
    if c.get('workflow')=='qr_cash':
        pipeline=c.get('qr_pipeline',{})
        from .qr_workflow import invalidate_downstream
        invalidate_downstream(c,'New evidence requires another investigation.')
        c.setdefault('qr_events',[]).append(dict(id=uid('qre'),sequence=len(c.get('qr_events',[]))+1,workflow='qr_cash',kind='EVIDENCE_CHANGED',node='annotated_fields',state='uncertain',actor=e.get('supplied_by','customer'),at=now(),version=c['version']+1,evidence_version=c['evidence_version'],evidence_ids=[e['id']],source_identifiers=dict(purchase_id=c['purchase_id']),detail='New evidence invalidated the saved scan and verdict.'))
    for d in c['decisions']:
        d['stale']=True
    notify(c,'New evidence was saved. The assigned investigator will review what changed.')


def staff_view(db,c):
    return c | dict(facts=facts(c),analysis_fresh=fresh(c),
       data_dna=data_dna.summary(c.get('data_dna',{}).get('decisions',[])),
       audit=[dict(r) for r in db.execute('SELECT * FROM audit WHERE case_id=? ORDER BY id',(c['id'],))],synthetic=True)


@app.get('/')
def home():
    return FileResponse(ROOT/'static'/'index.html')


@app.get('/qr-demo')
def legacy_demo():
    return FileResponse(ROOT/'static'/'legacy'/'index.html')


@app.get('/customer')
@app.get('/operations')
@app.get('/operations/cases/{case_id}')
@app.get('/operations/cases/{case_id}/studio')
def console_page():
    return FileResponse(ROOT/'static'/'console.html')
# The add-money investigation lives on its own standalone pages (never inside the legacy single-page app).
PAY_PAGES=ROOT/'static'/'pay'


@app.get('/chat')
def chat_page():
    return FileResponse(PAY_PAGES/'chat.html')


@app.get('/admin')
def admin_root():
    return RedirectResponse('/admin/queue')


@app.get('/customer/{rest:path}')
def customer_page(rest:str):
    return FileResponse(PAY_PAGES/'customer.html')


@app.get('/admin/{rest:path}')
def admin_page(rest:str):
    return FileResponse(PAY_PAGES/'admin.html')


@app.get('/mfs')
def mfs_page():
    return FileResponse(PAY_PAGES/'mfs.html')


@app.get('/demo')
def demo_page():
    return RedirectResponse('/mfs')


@app.post('/api/session')
async def start_session(request:Request,response:Response):
    p=await payload(request)
    role=p.get('role')
    if role not in ROLES:
        raise HTTPException(422,'Unknown predefined demo session.')
    actor=ROLES[role]
    actual='customer' if 'customer' in role else 'staff' if 'staff' in role else 'judge'
    token=secrets.token_urlsafe(32)
    with store.transaction() as db:
        db.execute('INSERT INTO sessions VALUES (?,?,?,?)',(token,actor,actual,(datetime.now(timezone.utc)+timedelta(hours=8)).isoformat()))
    response.set_cookie('tracefix_session',token,httponly=True,samesite='strict',max_age=28800)
    return dict(actor=actor,role=actual,synthetic=True,token=token)


@app.get('/api/session')
def get_session(request:Request):
    s=session(request)
    return dict(actor=s['actor'],role=s['role'],synthetic=True)


@app.get('/api/payments/{reference}')
def lookup(reference:str,request:Request):
    s=session(request)
    if s['role']!='customer':
        raise HTTPException(403,'Customer session required.')
    with store.connect() as db:
        for r in db.execute('SELECT body FROM cases'):
            c=json.loads(r['body'])
            if c['customer_id']==s['actor'] and c['qr_reference']==reference:
                amount=next((e['amount_minor'] for e in c['evidence'] if e['capability']=='qr_completed' and e['reference']==reference),c.get('qr_amount_minor',c['reported_amount_minor']))
                return dict(reference=reference,purchase_id=c['purchase_id'],amount_minor=amount,currency='BDT',scale=2,synthetic=True)
    raise HTTPException(404,'No accessible exact match. You can still submit an unlinked complaint.')


@app.get('/api/cases')
def cases(request:Request):
    s=session(request)
    if s['role'] in ('judge','presenter'):
        raise HTTPException(403,'Use demo controls in this session.')
    with store.connect() as db:
        cs=[c for c in (json.loads(r['body']) for r in db.execute('SELECT body FROM cases')) if c.get('family')!=TRANSFER_FAMILY]
    if s['role']=='customer':
        return [customer_view(c) for c in cs if c['customer_id']==s['actor']]
    return [c | dict(analysis_fresh=fresh(c),facts=facts(c),overdue=c['next_review']<now())
            for c in sorted(cs,key=lambda c:(c['next_review'],c['created_at'],c['id']))]


@app.post('/api/cases')
async def intake(request:Request):
    s=session(request)
    if s['role']!='customer':
        raise HTTPException(403,'Customer session required.')
    p=await payload(request)
    key=request.headers.get('Idempotency-Key','')
    if not key or len(key)>128:
        raise HTTPException(422,'A bounded Idempotency-Key is required.')
    digest=hashlib.sha256(json.dumps(p,sort_keys=True).encode()).hexdigest()
    description=text_field(p,'description',4000,False)
    claimed=positive_int(p.get('amount_minor'))
    method=p.get('second_method')
    if method not in ('cash','qr','other'):
        raise HTTPException(422,'Choose cash, qr or other.')
    requested=text_field(p,'qr_reference',100,False)
    purchase=text_field(p,'purchase_id',100,False)
    with store.transaction() as db:
        old=db.execute("SELECT * FROM operations WHERE actor=? AND scope='intake' AND key=?",(s['actor'],key)).fetchone()
        if old:
            if old['digest']!=digest:
                raise HTTPException(409,'This operation key was already used with different content.')
            return json.loads(old['response'])
        all_cases=[json.loads(r['body']) for r in db.execute('SELECT body FROM cases')]
        owned=next((c for c in all_cases if c['customer_id']==s['actor'] and requested and c['qr_reference']==requested),None)
        incident_id=p.get('incident_id')
        if incident_id:
            incident=db.execute('SELECT * FROM incidents WHERE id=? AND customer_id=?',(incident_id,s['actor'])).fetchone()
            if not incident:raise HTTPException(404,'Incident not found.')
            existing=db.execute('SELECT case_id FROM case_incidents WHERE incident_id=?',(incident_id,)).fetchone()
            if existing:owned=store.get_case(db,existing['case_id'])
            elif db.execute('SELECT id FROM transactions WHERE incident_id=?',(incident_id,)).fetchone():
                raise HTTPException(409,'Report this transfer through its transaction complaint endpoint so posting references remain linked.')
        elif not owned and requested and purchase:
            owned=next((c for c in all_cases if c['customer_id']==s['actor'] and c.get('unlinked_reference')==requested and c.get('reported_purchase')==purchase),None)
        if owned:
            # Exact owned logical mapping; never deduplicate on amount/time.
            if description and not any(current_text(e)==description for e in owned['evidence']):
                new_evidence(owned,evidence(description,purchase=owned['purchase_id']))
                owned['version']+=1
                owned['updated_at']=now()
                store.save_case(db,owned)
                store.audit(db,owned,s['actor'],'intake_reused_with_additional_details')
            result=customer_view(owned)
        else:
            c=dict(id=uid('case'),reference='TF-'+secrets.token_hex(4).upper(),customer_id=s['actor'],
              purchase_id=uid('unlinked'),qr_reference=None,unlinked_reference=requested,reported_purchase= purchase,
              second_method=method,description=description,reported_amount_minor=claimed,owner='staff_1',status='OPEN',
              version=1,evidence_version=1,created_at=now(),updated_at=now(),next_review=(datetime.now(timezone.utc)+timedelta(hours=24)).isoformat(),
              evidence=[evidence(description or 'Customer reports a second payment.',purchase=None)],analysis=None,analyses=[],checks=[],tasks=[],handoffs=[],decisions=[],notifications=[])
            if incident_id:c['incident_id']=incident_id
            notify(c,'Your complaint was accepted, including any unmatched reference. An investigator and next review are saved.')
            store.save_case(db,c)
            store.audit(db,c,s['actor'],'intake')
            result=customer_view(c)
        db.execute('INSERT INTO operations VALUES (?,?,?,?,?)',(s['actor'],'intake',key,digest,json.dumps(result,ensure_ascii=False)))
        return result


@app.get('/api/cases/{case_id}')
def case(case_id:str,request:Request):
    s=session(request)
    with store.connect() as db:
        c=store.get_case(db,case_id)
        authorize(s,c)
        return customer_view(c) if s['role']=='customer' else staff_view(db,c)


@app.post('/api/cases/{case_id}/details')
async def details(case_id:str,request:Request):
    p=await payload(request)
    def act(db,c,s,p):
        e=evidence(text_field(p,'text'),purchase=c['purchase_id'])
        e['supplied_by']=s['actor']
        new_evidence(c,e)
    return operation(request,p,case_id,'details',act,staff=False)


@app.post('/api/cases/{case_id}/evidence')
async def add_evidence(case_id:str,request:Request):
    p=await payload(request)
    def act(db,c,s,p):
        kind=p.get('kind','staff_supplied')
        if kind not in ('staff_supplied','merchant_supplied','customer_supplied','repayment_request'):
            raise HTTPException(422,'Uploaded assertions cannot grant mock-source authority.')
        e=evidence(text_field(p,'text'),kind,text_field(p,'reference',100,False) or None,
                   p.get('amount_minor'),text_field(p,'purchase_id',100,False) or c['purchase_id'])
        if e['amount_minor'] is not None:
            positive_int(e['amount_minor'])
        e['supplied_by']=s['actor']
        if p.get('assertion')=='denial' and kind=='merchant_supplied':
            e['assertion']='denial'
        new_evidence(c,e)
    return operation(request,p,case_id,'evidence',act)


@app.post('/api/cases/{case_id}/upload')
async def upload(case_id:str,request:Request,file:UploadFile=File(...),transcript:str=Form(''),version:int=Form(...)):
    # Validate ownership before consuming uploaded content.
    s=session(request)
    with store.connect() as db:
        authorize(s,store.get_case(db,case_id))
    content=await file.read(MAX_FILE+1)
    if len(content)>MAX_FILE:
        raise HTTPException(413,'Maximum upload is 2 MiB.')
    mime=file.content_type
    if mime not in ('image/png','image/jpeg','text/plain'):
        raise HTTPException(415,'Use PNG, JPEG or UTF-8 plain text. A labelled human transcript is supported.')
    if mime=='text/plain':
        try:
            original=content.decode('utf-8')
        except UnicodeError:
            raise HTTPException(422,'Plain text must be UTF-8.')
        if len(original)>4000:
            raise HTTPException(422,'Text documents are limited to 4000 characters.')
    else:
        try:
            with Image.open(io.BytesIO(content)) as im:
                if im.width*im.height>16000000 or im.format not in ('PNG','JPEG'):
                    raise ValueError()
                if mime != ('image/png' if im.format=='PNG' else 'image/jpeg'):
                    raise ValueError()
                im.verify()
        except Exception:
            raise HTTPException(422,'Image content is invalid or exceeds the pixel limit.')
        original=transcript
        if not original.strip() or len(original)>4000:
            raise HTTPException(422,'Provide a human transcript of at most 4000 characters; automatic OCR is unavailable.')
    p=dict(version=version,transcript=transcript,hash=hashlib.sha256(content).hexdigest(),mime=mime)
    def act(db,c,s,p):
        e=evidence(original,purchase=c['purchase_id'])
        e['supplied_by']=s['actor']
        e['original_hash']=p['hash']
        e['blob']=dict(mime=mime,base64=base64.b64encode(content).decode())
        e['transcription']='human transcript' if mime!='text/plain' else 'supplied text'
        new_evidence(c,e)
    return operation(request,p,case_id,'upload',act,staff=False)


@app.get('/api/evidence/{evidence_id}/file')
def evidence_file(evidence_id:str,request:Request):
    s=session(request)
    with store.connect() as db:
        for r in db.execute('SELECT body FROM cases'):
            c=json.loads(r['body'])
            e=next((e for e in c['evidence'] if e['id']==evidence_id),None)
            if e:
                authorize(s,c)
                if s['role']=='customer' and e['kind']!='customer_supplied':
                    raise HTTPException(404,'Record not found.')
                if e['blob']:
                    return Response(base64.b64decode(e['blob']['base64']),media_type=e['blob']['mime'])
                return PlainTextResponse(e['original'])
    raise HTTPException(404,'Record not found.')


@app.post('/api/cases/{case_id}/correct')
async def correct(case_id:str,request:Request):
    p=await payload(request)
    def act(db,c,s,p):
        if c.get('workflow')=='qr_cash':
            if s['actor']!=c['owner']:raise HTTPException(403,'Only the case owner can revise this receipt transcript.')
            if p.get('evidence_version')!=c['evidence_version']:raise HTTPException(409,'Use the current receipt evidence version.')
        e=next((e for e in c['evidence'] if e['id']==p.get('evidence_id')),None)
        if not e:
            raise HTTPException(404,'Evidence not found.')
        if e['kind'].startswith('mock_'):
            raise HTTPException(422,'A source record cannot be edited as a transcript. Add a conflicting assertion instead.')
        text=text_field(p,'text')
        reason=text_field(p,'reason',1000)
        e['revisions'].append(dict(version=len(e['revisions'])+1,text=text,actor=s['actor'],at=now(),reason=reason))
        if 'reference' in p:
            e.setdefault('reference_history',[]).append(e['reference'])
            e['reference']=text_field(p,'reference',100,False) or None
        c['evidence_version']+=1
        c['status']='OPEN'
        for d in c['decisions']:
            d['stale']=True
        if c.get('workflow')=='qr_cash':
            from .qr_workflow import emit,invalidate_downstream
            invalidate_downstream(c,'Receipt transcript corrected.')
            emit(c,s['actor'],'RECEIPT_TRANSCRIPT_CORRECTED','annotated_fields','uncertain',[e['id']],reason)
        notify(c,'An evidence transcript was corrected. The investigation is awaiting updated review.')
    return operation(request,p,case_id,'correct',act)


@app.post('/api/cases/{case_id}/analyze')
async def analyze(case_id:str,request:Request):
    p=await payload(request)
    # Model inference uses a visible snapshot outside a write transaction. Customer
    # replies and reads remain available; operation() rejects a stale snapshot.
    s=session(request)
    key=request.headers.get('Idempotency-Key','')
    if not key or len(key)>128:
        raise HTTPException(422,'A bounded Idempotency-Key is required.')
    digest=hashlib.sha256(json.dumps(p,sort_keys=True,ensure_ascii=False).encode()).hexdigest()
    with store.connect() as db:
        snapshot=store.get_case(db,case_id);authorize(s,snapshot,staff=True)
        old=db.execute('SELECT * FROM operations WHERE actor=? AND scope=? AND key=?',(s['actor'],f'{case_id}:analyze',key)).fetchone()
        if old:
            if old['digest']!=digest:
                raise HTTPException(409,'This operation key was already used with different content.')
            return json.loads(old['response'])
    if type(p.get('version')) is not int or p['version']!=snapshot['version']:
        raise HTTPException(409,'This case changed. Refresh before making a new change.')
    from .verifier import verifier
    claim_defs=[('qr','The QR payment completed.'),('cash','A cash payment was received.' if snapshot['second_method']=='cash' else 'A second QR payment completed.'),
                ('same','Both payments are for the same purchase.'),('repayment','Repayment completed.')]
    originals=dict(claim_defs)
    claim_defs=[(key,snapshot.get('claim_overrides',{}).get(key,{}).get('text',text)) for key,text in claim_defs]
    pairs=[(text,current_text(e)) for key,text in claim_defs for e in snapshot['evidence']]
    predictions=await run_in_threadpool(verifier.predict,pairs)
    def act(db,c,s,p):
        from ml.features import RULES_VERSION
        claims=[]
        index=0
        for key,text in claim_defs:
            links=[]
            for e in c['evidence']:
                result=predictions[index];index+=1
                mismatches=[]
                if e['purchase_id'] and e['purchase_id']!=c['purchase_id']:
                    mismatches.append('Exact purchase reference mismatch; not evidence of this purchase.')
                if key in ('qr','repayment') and e['kind'] in ('mock_payment','mock_repayment') and e['reference']!=c['qr_reference']:
                    mismatches.append('Exact QR reference mismatch.')
                links.append(dict(evidence_id=e['id'],excerpt=current_text(e),transcript_version=e['revisions'][-1]['version'],
                    label=result['label'] if not mismatches else 'INSUFFICIENT_EVIDENCE',raw_model_label=result['label'],
                    source_status=e['authority'],mismatches=mismatches,**{k:v for k,v in result.items() if k!='label'}))
            claims.append(dict(id=key,text=text,original_text=originals[key],normalized_model_text=text,purchase_id=c['purchase_id'],links=links))
        from .domain import assessment
        a=dict(id=uid('analysis'),at=now(),case_version=c['version']+1,evidence_version=c['evidence_version'],model=verifier.identity(),claims=claims,assessment=assessment(c),
               unresolved=facts(c)['requirements'],next_step_engine='explicit workflow rules',rules_version=RULES_VERSION)
        c['analysis']=a
        c['analyses'].append(a)
    return operation(request,p,case_id,'analyze',act)


@app.post('/api/cases/{case_id}/claim')
async def correct_claim(case_id:str,request:Request):
    p=await payload(request)
    def act(db,c,s,p):
        if p.get('claim_id') not in ('qr','cash','same','repayment'):
            raise HTTPException(422,'Choose an existing claim.')
        revised=dict(text=text_field(p,'text',500),reason=text_field(p,'reason',1000),actor=s['actor'],at=now())
        c.setdefault('claim_corrections',[]).append(dict(claim_id=p['claim_id'],previous=c.get('claim_overrides',{}).get(p['claim_id']),**revised))
        c.setdefault('claim_overrides',{})[p['claim_id']]=revised
        c['evidence_version']+=1
        for d in c['decisions']:d['stale']=True
        c['status']='OPEN'
    return operation(request,p,case_id,'claim',act)


@app.post('/api/cases/{case_id}/link')
async def link_case(case_id:str,request:Request):
    p=await payload(request)
    def act(db,c,s,p):
        import copy
        if c['qr_reference']:
            raise HTTPException(409,'This case already has an exact linked payment.')
        reference=text_field(p,'reference',100)
        reason=text_field(p,'reason',1000)
        candidates=[json.loads(r['body']) for r in db.execute('SELECT body FROM cases')]
        source=next((v for v in candidates if v['customer_id']==c['customer_id'] and v['qr_reference']==reference),None)
        if not source:
            raise HTTPException(404,'No accessible exact owned mapping.')
        old_purchase=c['purchase_id']
        c['qr_reference']=reference;c['purchase_id']=source['purchase_id']
        for e in c['evidence']:
            if e['purchase_id']==old_purchase:
                e['purchase_mapping_history']=[dict(previous=old_purchase,actor=s['actor'],reason=reason,at=now())]
                e['purchase_id']=source['purchase_id']
        for e in source['evidence']:
            if e['kind']=='mock_payment' and e['reference']==reference:
                linked=copy.deepcopy(e);linked['id']=uid('ev');linked['linked_from']=e['id']
                new_evidence(c,linked)
        c.setdefault('links',[]).append(dict(reference=reference,actor=s['actor'],reason=reason,at=now()))
    return operation(request,p,case_id,'link',act)


@app.post('/api/cases/{case_id}/resolve-task')
async def resolve_task(case_id:str,request:Request):
    p=await payload(request)
    def act(db,c,s,p):
        t=next((t for t in c['tasks'] if t['id']==p.get('task_id') and t['status'] in ('OPEN','RESPONDED')),None)
        if not t:
            raise HTTPException(404,'Open task not found.')
        e=next((e for e in c['evidence'] if e['id']==p.get('evidence_id')),None)
        if not e:
            raise HTTPException(422,'Cite the evidence addressing this request.')
        t.update(status='RESOLVED',resolved_at=now(),resolved_by=s['actor'],evidence_id=e['id'],resolution=text_field(p,'reason',1000))
        if c['status'] not in ('REVIEWED','OUTCOME_RECORDED'):
            c['status']='OPEN'
        notify(c,'An evidence request was reviewed. Your investigator continues the saved follow-up.')
    return operation(request,p,case_id,'resolve-task',act)


@app.post('/api/cases/{case_id}/check')
async def check(case_id:str,request:Request):
    p=await payload(request)
    def act(db,c,s,p):
        kind=p.get('kind')
        if kind in ('receipt_scan','marketplace'):
            if c.get('workflow')!='qr_cash': raise HTTPException(409,'This check requires a QR + cash workflow case.')
            if c.get('qr_pipeline',{}).get('resolution',{}).get('state')=='REFUND_COMPLETED':raise HTTPException(409,'The completed refund and its cited investigation are historical. No further financial check can replace them.')
            if s['actor']!=c['owner']: raise HTTPException(403,'Only the case owner can advance the QR investigation.')
            if p.get('evidence_version')!=c['evidence_version']: raise HTTPException(409,'Use the current evidence version for QR investigation checks.')
        if kind not in ('qr','repayment','merchant','invoice','receipt_scan','marketplace'):
            raise HTTPException(422,'Choose a QR, invoice, merchant, receipt, Marketplace or repayment source check.')
        ch=dict(id=uid('check'),kind=kind,requested_at=now(),scope='exact purchase and linked receipt context' if kind in ('receipt_scan','marketplace') else 'exact case QR reference only',as_of=now(),
                states=[dict(state='REQUESTED',at=now()),dict(state='QUEUED',at=now()),dict(state='RUNNING',at=now())])
        available=db.execute("SELECT value FROM demo WHERE key='repayment_available'").fetchone()['value']=='true'
        if kind == 'receipt_scan':
            existing=c.get('qr_pipeline',{}).get('receipt_scan')
            if existing and existing.get('evidence_version')==c['evidence_version'] and existing.get('manifest_version')==2 and existing.get('data_dna_policy_version')==data_dna.POLICY_VERSION:
                return
            receipt=next((e for e in reversed(c['evidence']) if e.get('blob') and e['blob']['mime'].startswith('image/') and e.get('kind')=='customer_supplied'),None)
            if not receipt: raise HTTPException(409,'Attach an original receipt image before scanning.')
            from .qr_receipt import annotate
            from .qr_workflow import emit, record_data_access
            access = record_data_access(c,s['actor'],source='Customer receipt original',
                fields=['receipt_image_for_local_processing','receipt_transcript','original_hash'],recipient='local_receipt_processor',node='receipt_scan')
            if access['decision'] not in ('ALLOWED','MINIMIZED'):
                ch.update(state='UNAVAILABLE',result=access['reason'])
                ch['states'].append(dict(state='UNAVAILABLE',at=now()))
                c['checks'].append(ch)
                return
            emit(c,s['actor'],'RECEIPT_SCAN_STARTED','receipt_scan','active',[receipt['id']])
            from .simulation import get_sim
            sim=get_sim(db,c.get('simulation_id','')) or {}
            issued=sim.get('issued_receipt',{})
            template=issued.get('layout') if issued.get('hash')==receipt['original_hash'] else None
            try: scan=annotate(base64.b64decode(receipt['blob']['base64']),current_text(receipt),receipt['blob']['mime'],template=template)
            except ValueError as e: raise HTTPException(422,str(e))
            pipe=c.setdefault('qr_pipeline',{})
            if existing:pipe.setdefault('receipt_scans',[]).append(existing)
            from .qr_workflow import invalidate_downstream
            invalidate_downstream(c,'A replacement visual scan was saved.')
            pipe['receipt_scan']=dict(evidence_id=receipt['id'],source_evidence_id=receipt['id'],**scan,
                evidence_version=c['evidence_version'],transcript_revision=receipt['revisions'][-1]['version'],
                data_dna_id=access['id'],data_dna_policy_version=access['policy_version'])
            for region in scan['regions']: emit(c,s['actor'],'RECEIPT_REGION_ANNOTATED','annotated_fields','completed',[receipt['id']],region['field'])
            c['operator_state']='RECEIPT_SCAN_ANNOTATED'
            emit(c,s['actor'],'RECEIPT_SCAN_ANNOTATED','receipt_scan','completed',[receipt['id']])
            ch.update(state='COMPLETED',result='OpenCV visual regions saved. Values come from the preserved transcript, not OCR.',artifact=c['qr_pipeline']['receipt_scan'])
        elif kind == 'marketplace':
            from .qr_workflow import marketplace_check
            result=marketplace_check(db,c,s['actor'],bool(p.get('simulate_unavailable')))
            ch.update(state='UNAVAILABLE' if result['outcome']=='UNCERTAIN' else 'COMPLETED',result=result['reason'])
        elif p.get('simulate_unavailable'):
            ch.update(state='UNAVAILABLE',result='Synthetic source unavailable; no financial conclusion follows.')
        elif c.get('simulation_id'):
            from .simulation import check_source
            ch.update(**check_source(db,c,kind))
        elif kind in ('merchant','invoice'):
            matches=[e for e in c['evidence'] if e['kind']==('mock_merchant' if kind=='merchant' else 'mock_invoice') and e['purchase_id']==c['purchase_id']]
            ch.update(state='COMPLETED' if matches else 'UNAVAILABLE',result='Existing simulated source record inspected.' if matches else 'No record is available for this source. Request the missing evidence.')
        elif not c['qr_reference']:
            ch.update(state='UNAVAILABLE',result='No verified exact reference is linked. No external query was made.')
        elif p.get('simulate_unavailable'):
            ch.update(state='UNAVAILABLE',result='Synthetic source unavailable; no financial conclusion follows.')
        elif kind=='repayment' and available and c['id']=='case_4':
            if not any(e['capability']=='repayment_completed' for e in c['evidence']):
                new_evidence(c,evidence(f'Repayment completed. BDT 500 returned against {c["qr_reference"]}.',
                           'mock_repayment',c['qr_reference'],50000,c['purchase_id'],'repayment_completed'))
            ch.update(state='COMPLETED',result='Completed repayment observed under the simulated repayment contract.')
        else:
            ch.update(state='COMPLETED',result='Current mock QR source confirms completion.' if kind=='qr' else 'No completed repayment found in the bounded mock source as of this check. This does not prove no repayment exists elsewhere.')
        ch['states'].append(dict(state=ch['state'],at=now()))
        c['checks'].append(ch)
    return operation(request,p,case_id,'check',act)


@app.post('/api/cases/{case_id}/qr-action')
async def qr_action(case_id:str,request:Request):
    p=await payload(request)
    def act(db,c,s,p):
        if c.get('workflow')!='qr_cash': raise HTTPException(409,'Use the original case controls for this case.')
        if c['owner']!=s['actor']: raise HTTPException(403,'The current case owner must approve this QR operation.')
        if p.get('evidence_version')!=c['evidence_version']: raise HTTPException(409,'Use the current evidence version for QR decisions.')
        from .qr_workflow import action
        message=action(db,c,s['actor'],p)
        notify(c,message)
    return operation(request,p,case_id,'qr-action',act)


@app.post('/api/cases/{case_id}/task')
async def task(case_id:str,request:Request):
    p=await payload(request)
    def act(db,c,s,p):
        question=text_field(p,'question',1000)
        due=future_time(p.get('next_review'))
        audience=p.get('audience','customer')
        if audience not in ('customer','merchant','internal'):
            raise HTTPException(422,'Choose a customer, merchant or internal request.')
        c['tasks'].append(dict(id=uid('task'),question=question,owner=c['owner'],created_at=now(),next_review=due,status='OPEN',audience=audience))
        if audience=='customer':
            c.setdefault('messages',[]).append(dict(id=uid('msg'),at=now(),actor=s['actor'],role='staff',text=question,task_id=c['tasks'][-1]['id']))
        c['next_review']=due
        c['status']='WAITING_EVIDENCE'
        if audience=='customer':notify(c,'Additional evidence was requested in the demo: '+question)
    return operation(request,p,case_id,'task',act)


@app.post('/api/cases/{case_id}/review')
async def review(case_id:str,request:Request):
    p=await payload(request)
    def act(db,c,s,p):
        c['next_review']=future_time(p.get('next_review'))
        notify(c,'A next investigation review is scheduled. This is not a repayment promise.')
    return operation(request,p,case_id,'review',act)


@app.post('/api/cases/{case_id}/handoff')
async def handoff(case_id:str,request:Request):
    p=await payload(request)
    def act(db,c,s,p):
        destination=p.get('destination')
        if destination not in ('staff_1','staff_2') or destination==c['owner']:
            raise HTTPException(422,'Choose another predefined investigator.')
        if any(h['status']=='REQUESTED' for h in c['handoffs']):
            raise HTTPException(409,'A handoff is already awaiting acknowledgement.')
        reason=text_field(p,'reason',1000)
        team=p.get('team','Partner Operations')
        if team not in ('Operations','Partner Operations','Settlement Operations','Merchant Support'):
            raise HTTPException(422,'Choose an operational team.')
        priority=p.get('priority',c.get('priority','NORMAL'))
        if priority not in ('HIGH','NORMAL','LOW'):raise HTTPException(422,'Choose a valid priority.')
        c['handoffs'].append(dict(id=uid('handoff'),origin=c['owner'],destination=destination,reason=reason,at=now(),status='REQUESTED',
                                 team=team,priority=priority,next_action=p.get('next_action') or reason))
        c['priority']=priority
        c['status']='ESCALATED'
        notify(c,'Further review was requested. Your current investigator retains responsibility until the handoff is accepted.')
        trace_operator_action(db,c,'Request an owned handoff',team+': '+reason,'Current owner remains accountable until '+destination+' acknowledges. '+c['handoffs'][-1]['next_action'])
    return operation(request,p,case_id,'handoff',act)


@app.post('/api/cases/{case_id}/acknowledge')
async def acknowledge(case_id:str,request:Request):
    p=await payload(request)
    def act(db,c,s,p):
        h=next((h for h in reversed(c['handoffs']) if h['status']=='REQUESTED'),None)
        if not h or h['destination']!=s['actor']:
            raise HTTPException(403,'Only the receiving investigator can acknowledge this handoff.')
        h['status']='ACKNOWLEDGED';h['acknowledged_at']=now()
        c['owner']=s['actor']
        if c.get('workflow')=='qr_cash':
            c.get('qr_pipeline',{}).get('handoff',{}).update(status='ACKNOWLEDGED',owner=s['actor'])
            from .qr_workflow import emit
            emit(c,s['actor'],'HANDOFF_ACCEPTED','human_handoff','handoff',detail='Receiving investigator accepted ownership.')
        db.execute("UPDATE approvals SET status='STALE' WHERE case_id=? AND status='APPROVED'",(c['id'],))
        for t in c['tasks']:
            if t['status'] in ('OPEN','RESPONDED'):
                t['owner']=s['actor']
        notify(c,'The handoff was accepted by your new investigator.')
        trace_operator_action(db,c,'Acknowledge the handoff','Ownership changed to '+s['actor']+'.',h.get('next_action',h['reason']))
    return operation(request,p,case_id,'acknowledge',act)


@app.post('/api/cases/{case_id}/decision')
async def decision(case_id:str,request:Request):
    p=await payload(request)
    def act(db,c,s,p):
        if not fresh(c):
            raise HTTPException(409,'Analyze the current evidence before recording a review.')
        kind=p.get('decision')
        if kind not in ('EVIDENCE_ASSEMBLED','FURTHER_EVIDENCE','REFERRAL','OUTCOME_RECORDED'):
            raise HTTPException(422,'Choose a permitted human review decision.')
        ids=p.get('evidence_ids',[])
        if not isinstance(ids,list) or not ids or not all(isinstance(i,str) and any(e['id']==i for e in c['evidence']) for i in ids):
            raise HTTPException(422,'Cite actual evidence in this case.')
        if kind=='OUTCOME_RECORDED' and not any(e['id'] in ids and e['capability']=='repayment_completed' and e['kind']=='mock_repayment' for e in c['evidence']):
            raise HTTPException(422,'A recorded repayment outcome requires a completed source record; a request is insufficient.')
        if kind=='OUTCOME_RECORDED' and any(t['status'] in ('OPEN','RESPONDED') for t in c['tasks']):
            raise HTTPException(409,'Review and resolve outstanding evidence requests before recording the final outcome.')
        if kind=='OUTCOME_RECORDED':
            f=facts(c)
            if f['requirements'] or f['conflict'] or f['recorded_excess_minor']!=0 or not f['recorded_repaid_minor']:
                raise HTTPException(409,'The evidence does not establish a complete repayment. Keep remaining amounts and follow-up open.')
        note=text_field(p,'note',2000)
        c['decisions'].append(dict(id=uid('decision'),decision=kind,note=note,evidence_ids=ids,evidence_version=c['evidence_version'],actor=s['actor'],at=now(),stale=False))
        c['status']='REVIEWED' if kind=='EVIDENCE_ASSEMBLED' else 'WAITING_EVIDENCE' if kind=='FURTHER_EVIDENCE' else 'ESCALATED' if kind=='REFERRAL' else 'OUTCOME_RECORDED'
        c.setdefault('messages',[]).append(dict(id=uid('msg'),at=now(),actor=s['actor'],role='staff',text=note,decision=kind))
        notify(c,'Your investigator saved a review: '+note)
    return operation(request,p,case_id,'decision',act)


@app.get('/api/cases/{case_id}/dossier')
def dossier(case_id:str,request:Request):
    s=session(request)
    with store.connect() as db:
        c=store.get_case(db,case_id);authorize(s,c,staff=True)
    f=facts(c)
    lines=[f'# DataUkil dossier — {c["reference"]}','', '**SYNTHETIC DEMO. No financial action or liability determination.**','',
           f'Case version: {c["version"]}; evidence version: {c["evidence_version"]}; analysis current: {fresh(c)}.',
           f'Owner: {c["owner"]}; next review: {c["next_review"]}; status: {c["status"]}.',
           f'Customer-reported amount: BDT {c["reported_amount_minor"]/100:.2f}; payment reference: •••'+(c['qr_reference'] or '')[-3:],
           '', '## Customer allegation (reported)',c['description'],'','## Record-scoped observations',json.dumps(f,ensure_ascii=False,indent=2),
           '', '## Preserved evidence and timeline']
    for e in sorted(c['evidence'],key=lambda e:e['received_at']):
        lines += [f'### {e["id"]} — {e["kind"]}',f'Status: {e["authority"]}; method: {e["verification"]}; scope: {e["scope"]}.',
                  f'Received: {e["received_at"]}; event: {e["event_at"]}; as of: {e["as_of"]}.',
                  f'Original SHA256: {e["original_hash"]}; transcript version: {e["revisions"][-1]["version"]}.','',current_text(e),
                  '', 'Revision history: '+json.dumps(e['revisions'],ensure_ascii=False),'']
    if c['analysis']:
        lines += ['## Textual assessment (separate from provenance)',json.dumps(c['analysis']['model'],ensure_ascii=False),f'Analyzed: {c["analysis"]["at"]}']
        for claim in c['analysis']['claims']:
            lines += [f'### {claim["text"]}']
            for link in claim['links']:
                lines += [f'- [{link["evidence_id"]}] revision {link["transcript_version"]}: {link["label"]}; {link["source_status"]}'+ ('; '+ '; '.join(link['mismatches']) if link['mismatches'] else ''),
                          '> '+link['excerpt'].replace('\n','\n> ')]
    for title,key in [('Missing evidence','tasks'),('Attempted read-only checks','checks'),('Handoff','handoffs'),('Human review (no financial execution)','decisions')]:
        lines += ['',f'## {title}',json.dumps([{**ch, 'artifact':{k:v for k,v in ch['artifact'].items() if not k.endswith('base64')}} if ch.get('artifact') else ch for ch in c[key]] if key=='checks' else c[key],ensure_ascii=False,indent=2)]
    lines += ['', '## Shared case conversation',json.dumps(c.get('messages',[]),ensure_ascii=False,indent=2)]
    lines += ['', '## Claim and purchase-link corrections',json.dumps(c.get('claim_corrections',[])+c.get('links',[]),ensure_ascii=False,indent=2)]
    if c.get('workflow')=='qr_cash':
        def without_images(value):
            if isinstance(value,dict):return {k:without_images(v) for k,v in value.items() if not k.endswith('base64')}
            if isinstance(value,list):return [without_images(v) for v in value]
            return value
        pipeline=without_images(c.get('qr_pipeline',{}))
        lines += ['', '## QR + cash visual assistance and synthetic outcome', 'OpenCV regions are visual assistance, not OCR or receipt authentication. Marketplace and refund records are synthetic. Approval is separate from completed refund.', json.dumps(pipeline,ensure_ascii=False,indent=2), '', '## Append-only QR event history', json.dumps(c.get('qr_events',[]),ensure_ascii=False,indent=2)]
        lines += data_dna.report_lines(c.get('data_dna',{}).get('decisions',[]))
    body='\n'.join(lines)
    return PlainTextResponse(body,media_type='text/markdown',headers={'Content-Disposition':f'attachment; filename="{c["reference"]}-v{c["version"]}.md"',
         'X-Dossier-SHA256':hashlib.sha256(body.encode()).hexdigest()})


@app.get('/api/demo')
def demo(request:Request):
    s=session(request)
    if s['role']!='judge':
        raise HTTPException(403,'Judge demo session required.')
    # No hidden truth or future payloads returned.
    return dict(synthetic=True,journeys=[dict(case_id=f'case_{n}',title=t) for n,t in enumerate([
        'Cash + QR linked purchase','Separate equal-value purchases','Cash still unestablished','Repayment request then completion'],1)],
        controls=['Reveal synthetic repayment availability, then switch to staff and run the repayment check.'])


@app.post('/api/demo/advance')
async def advance(request:Request):
    s=session(request)
    if s['role']!='judge':
        raise HTTPException(403,'Judge demo session required.')
    with store.transaction() as db:
        db.execute("UPDATE demo SET value='true' WHERE key='repayment_available'")
    return dict(saved=True,message='Synthetic source availability advanced. Case evidence changes only after an investigator check.')


@app.get('/api/evaluation')
def evaluation(request:Request,version:int|None=None):
    s=session(request)
    if s['role'] not in ('staff','judge'):
        raise HTTPException(403,'Staff or judge session required.')
    if version not in (None,1,2):
        raise HTTPException(422,'Known evaluation versions are 1 and 2.')
    p=ROOT/'artifacts'/('evaluation_v1.json' if version==1 else 'evaluation.json')
    return json.loads(p.read_text(encoding='utf-8')) if p.exists() else dict(status='Evaluation not yet run')


from .simulation import router as simulation_router
app.include_router(simulation_router)

from .operations import router as operations_router
app.include_router(operations_router)
