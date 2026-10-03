from contextlib import asynccontextmanager
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
from . import store
from .auth import read_session
from .domain import now, uid, evidence, current_text, facts, fresh, customer_view
from .transfer import FAMILY as TRANSFER_FAMILY, router as transfer_router, start_ticker, stop_ticker

ROOT=Path(__file__).resolve().parents[1]
ROLES={'customer':'customer_1','other_customer':'customer_2','staff':'staff_1','other_staff':'staff_2','judge':'judge_1'}
MAX_FILE=2*1024*1024


@asynccontextmanager
async def lifespan(app):
    store.initialize()
    ticker = start_ticker()
    try:
        yield
    finally:
        await stop_ticker(ticker)


app=FastAPI(title='TraceFix synthetic investigation workspace',lifespan=lifespan)
app.mount('/static',StaticFiles(directory=ROOT/'static'),name='static')
app.include_router(transfer_router)


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
        fn(db,c,s,p)
        c['version']+=1
        c['updated_at']=now()
        store.save_case(db,c)
        store.audit(db,c,s['actor'],action)
        result=customer_view(c) if s['role']=='customer' else staff_view(db,c)
        db.execute('INSERT INTO operations VALUES (?,?,?,?,?)',(s['actor'],scope,key,digest,json.dumps(result,ensure_ascii=False)))
        return result


def notify(c,message):
    c['notifications'].append(dict(at=now(),text=message))


def new_evidence(c,e):
    c['evidence'].append(e)
    c['evidence_version']+=1
    c['status']='OPEN'
    for d in c['decisions']:
        d['stale']=True
    notify(c,'New evidence was saved. The assigned investigator will review what changed.')


def staff_view(db,c):
    return c | dict(facts=facts(c),analysis_fresh=fresh(c),
       audit=[dict(r) for r in db.execute('SELECT * FROM audit WHERE case_id=? ORDER BY id',(c['id'],))],synthetic=True)


@app.get('/')
def home():
    return FileResponse(ROOT/'static'/'index.html')


# The add-money investigation lives on its own standalone pages (never inside the legacy single-page app).
PAY_PAGES=ROOT/'static'/'pay'


@app.get('/customer')
def customer_root():
    return RedirectResponse('/customer/payment')


@app.get('/customer/{rest:path}')
def customer_page(rest:str):
    return FileResponse(PAY_PAGES/'customer.html')


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
    return dict(actor=actor,role=actual,synthetic=True)


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
                return dict(reference=reference,purchase_id=c['purchase_id'],amount_minor=50000,currency='BDT',scale=2,synthetic=True)
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
                authorize(s,c,staff=True)
                if e['blob']:
                    return Response(base64.b64decode(e['blob']['base64']),media_type=e['blob']['mime'])
                return PlainTextResponse(e['original'])
    raise HTTPException(404,'Record not found.')


@app.post('/api/cases/{case_id}/correct')
async def correct(case_id:str,request:Request):
    p=await payload(request)
    def act(db,c,s,p):
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
        notify(c,'An evidence transcript was corrected. The investigation is awaiting updated review.')
    return operation(request,p,case_id,'correct',act)


@app.post('/api/cases/{case_id}/analyze')
async def analyze(case_id:str,request:Request):
    p=await payload(request)
    def act(db,c,s,p):
        from .verifier import verifier
        from ml.features import RULES_VERSION
        claim_defs=[('qr','The QR payment completed.'),('cash','A cash payment was received.' if c['second_method']=='cash' else 'A second QR payment completed.'),
                    ('same','Both payments are for the same purchase.'),('repayment','Repayment completed.')]
        claims=[]
        originals=dict(claim_defs)
        claim_defs=[(key,c.get('claim_overrides',{}).get(key,{}).get('text',text)) for key,text in claim_defs]
        pairs=[(text,current_text(e)) for key,text in claim_defs for e in c['evidence']]
        predictions=verifier.predict(pairs)
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
        a=dict(id=uid('analysis'),at=now(),case_version=c['version']+1,evidence_version=c['evidence_version'],model=verifier.identity(),claims=claims,
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
        t=next((t for t in c['tasks'] if t['id']==p.get('task_id') and t['status']=='OPEN'),None)
        if not t:
            raise HTTPException(404,'Open task not found.')
        e=next((e for e in c['evidence'] if e['id']==p.get('evidence_id')),None)
        if not e:
            raise HTTPException(422,'Cite the evidence addressing this request.')
        t.update(status='RESOLVED',resolved_at=now(),resolved_by=s['actor'],evidence_id=e['id'],resolution=text_field(p,'reason',1000))
        c['status']='OPEN'
        notify(c,'An evidence request was reviewed. Your investigator continues the saved follow-up.')
    return operation(request,p,case_id,'resolve-task',act)


@app.post('/api/cases/{case_id}/check')
async def check(case_id:str,request:Request):
    p=await payload(request)
    def act(db,c,s,p):
        kind=p.get('kind')
        if kind not in ('qr','repayment'):
            raise HTTPException(422,'Only read-only mock QR and repayment checks are available.')
        ch=dict(id=uid('check'),kind=kind,requested_at=now(),scope='exact case QR reference only',as_of=now(),
                states=[dict(state='REQUESTED',at=now()),dict(state='QUEUED',at=now()),dict(state='RUNNING',at=now())])
        available=db.execute("SELECT value FROM demo WHERE key='repayment_available'").fetchone()['value']=='true'
        if not c['qr_reference']:
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


@app.post('/api/cases/{case_id}/task')
async def task(case_id:str,request:Request):
    p=await payload(request)
    def act(db,c,s,p):
        question=text_field(p,'question',1000)
        due=future_time(p.get('next_review'))
        c['tasks'].append(dict(id=uid('task'),question=question,owner=c['owner'],created_at=now(),next_review=due,status='OPEN'))
        c['next_review']=due
        c['status']='WAITING_EVIDENCE'
        notify(c,'Additional evidence was requested in the demo: '+question)
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
        c['handoffs'].append(dict(id=uid('handoff'),origin=c['owner'],destination=destination,reason=reason,at=now(),status='REQUESTED'))
        c['status']='ESCALATED'
        notify(c,'Further review was requested. Your current investigator retains responsibility until the handoff is accepted.')
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
        for t in c['tasks']:
            if t['status']=='OPEN':
                t['owner']=s['actor']
        notify(c,'The handoff was accepted by your new investigator.')
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
        note=text_field(p,'note',2000)
        c['decisions'].append(dict(id=uid('decision'),decision=kind,note=note,evidence_ids=ids,evidence_version=c['evidence_version'],actor=s['actor'],at=now(),stale=False))
        c['status']='REVIEWED' if kind=='EVIDENCE_ASSEMBLED' else 'WAITING_EVIDENCE' if kind=='FURTHER_EVIDENCE' else 'ESCALATED' if kind=='REFERRAL' else 'OUTCOME_RECORDED'
        notify(c,'An investigator saved a human review. No financial transaction was executed.')
    return operation(request,p,case_id,'decision',act)


@app.get('/api/cases/{case_id}/dossier')
def dossier(case_id:str,request:Request):
    s=session(request)
    with store.connect() as db:
        c=store.get_case(db,case_id);authorize(s,c,staff=True)
    f=facts(c)
    lines=[f'# TraceFix dossier — {c["reference"]}','', '**SYNTHETIC DEMO. No financial action or liability determination.**','',
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
        lines += ['',f'## {title}',json.dumps(c[key],ensure_ascii=False,indent=2)]
    lines += ['', '## Claim and purchase-link corrections',json.dumps(c.get('claim_corrections',[])+c.get('links',[]),ensure_ascii=False,indent=2)]
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
