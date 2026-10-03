"""Persisted fictional wallet interactions and bounded mock source adapters."""
from datetime import datetime, timezone, timedelta
import hashlib
import json
import secrets
import io
import base64
from functools import lru_cache
import qrcode
from fastapi import APIRouter, Request, HTTPException, UploadFile, File, Form
from PIL import Image
from . import store
from .domain import uid, now, evidence, current_text, customer_view, facts, fresh, assessment

router=APIRouter()
PROFILES={'confirmed','unverified','denied','qr_failed'}


def get_sim(db,identifier):
    row=db.execute('SELECT body FROM simulations WHERE id=?',(identifier,)).fetchone()
    return json.loads(row['body']) if row else None


def save_sim(db,sim):
    db.execute('INSERT OR REPLACE INTO simulations VALUES (?,?,?)',(sim['id'],sim['customer_id'],json.dumps(sim,ensure_ascii=False)))


def owned(s,sim):
    if not sim or sim['customer_id']!=s['actor']:
        raise HTTPException(404,'Purchase not found.')


@lru_cache(maxsize=128)
def qr_image(reference,purchase,amount):
    payload='tracefix-demo:'+json.dumps(dict(reference=reference,purchase_id=purchase,amount_minor=amount,currency='BDT'),separators=(',',':'))
    image=qrcode.make(payload,box_size=4,border=2)
    buffer=io.BytesIO();image.save(buffer,format='PNG')
    return 'data:image/png;base64,'+base64.b64encode(buffer.getvalue()).decode()


def project(sim):
    keys=['id','version','stage','customer_name','merchant','item','purchase_id','qr_reference','total_minor','qr_amount_minor','cash_amount_minor','case_id','created_at','events']
    return {k:sim[k] for k in keys} | dict(
        synthetic=True, workflow='qr_cash', currency='BDT',
        line_items=sim.get('line_items') or [dict(description=sim['item'],quantity=1,unit_price_minor=sim['total_minor'],line_total_minor=sim['total_minor'])],
        merchant_address=sim.get('merchant_address',''),subtotal_minor=sim.get('subtotal_minor',sim['total_minor']),tax_minor=sim.get('tax_minor',0),receipt_issued_at=sim.get('receipt_issued_at'),
        qr_status=sim.get('qr_status','NOT_ATTEMPTED'),
        qr_display_result=sim.get('qr_display_result','NOT_ATTEMPTED'),
        customer_observed_debit=bool(sim.get('customer_observed_debit')),
        receipt_draft=({k:sim['receipt_draft'].get(k) for k in ('id','transcript','mime','base64','hash','at')} if sim.get('receipt_draft') else None),
        issued_receipt=({k:sim['issued_receipt'].get(k) for k in ('mime','base64','transcript','hash','template_version')} if sim.get('issued_receipt') else None),
        customer_state=sim.get('customer_state',sim['stage']),
        receipt_evidence_id=(sim.get('receipt_draft') or {}).get('id'),
        qr_pipeline={},
        qr_image=qr_image(sim['qr_reference'],sim['purchase_id'],sim['qr_amount_minor']))


def operation_key(request,p,scope,actor,db):
    key=request.headers.get('Idempotency-Key','')
    if not key or len(key)>128:
        raise HTTPException(422,'A bounded Idempotency-Key is required.')
    digest=hashlib.sha256(json.dumps(p,sort_keys=True,ensure_ascii=False).encode()).hexdigest()
    previous=db.execute('SELECT * FROM operations WHERE actor=? AND scope=? AND key=?',(actor,scope,key)).fetchone()
    if previous:
        if previous['digest']!=digest:
            raise HTTPException(409,'This operation key was already used with different content.')
        return key,digest,json.loads(previous['response'])
    return key,digest,None


def remember(db,actor,scope,key,digest,result):
    db.execute('INSERT INTO operations VALUES (?,?,?,?,?)',(actor,scope,key,digest,json.dumps(result,ensure_ascii=False)))


def revision(p,sim):
    if type(p.get('version')) is not int or p['version']!=sim['version']:
        raise HTTPException(409,'This purchase changed. Refresh and try again.')


@router.get('/api/simulations')
def list_simulations(request:Request):
    from .app import session
    s=session(request)
    if s['role']!='customer':
        raise HTTPException(403,'Customer session required.')
    with store.connect() as db:
        rows=db.execute('SELECT body FROM simulations WHERE customer_id=?',(s['actor'],)).fetchall()
    return [project(v) for v in sorted((json.loads(r['body']) for r in rows),key=lambda v:v['created_at'],reverse=True)]


@router.post('/api/simulations')
async def create_simulation(request:Request):
    from .app import session,payload,text_field,positive_int
    s=session(request)
    if s['role']!='customer':
        raise HTTPException(403,'Customer session required.')
    p=await payload(request)
    name=text_field(p,'customer_name',80)
    merchant=text_field(p,'merchant',100)
    rows=p.get('line_items')
    address=text_field(p,'merchant_address',160,False) or 'Dhaka, Bangladesh'
    tax=p.get('tax_minor',0)
    if type(tax) is not int or not 0<=tax<=100000000:raise HTTPException(422,'Tax must be a nonnegative amount in poisha.')
    if rows is not None:
        if not isinstance(rows,list) or not 1<=len(rows)<=20:raise HTTPException(422,'Provide 1–20 purchase items.')
        items=[]
        for row in rows:
            if not isinstance(row,dict):raise HTTPException(422,'Each item needs description, quantity and unit price.')
            description=text_field(row,'description',80)
            quantity=row.get('quantity')
            if type(quantity) is not int or not 1<=quantity<=99:raise HTTPException(422,'Quantity must be an integer from 1–99.')
            price=positive_int(row.get('unit_price_minor'),'unit_price_minor')
            items.append(dict(description=description,quantity=quantity,unit_price_minor=price,line_total_minor=price*quantity))
        subtotal=sum(row['line_total_minor'] for row in items)
        total=positive_int(subtotal+tax,'total_minor')
        if 'total_minor' in p and (type(p['total_minor']) is not int or p['total_minor']!=total):raise HTTPException(422,'Invoice total does not match the basket and tax.')
        item=items[0]['description'] if len(items)==1 else f'{len(items)}-item basket'
    else:
        item=text_field(p,'item',120)
        total=positive_int(p.get('total_minor'),'total_minor')
        if tax:raise HTTPException(422,'Provide line items to include tax.')
        subtotal=total
        items=[dict(description=item,quantity=1,unit_price_minor=total,line_total_minor=total)]
    amount=positive_int(p.get('qr_amount_minor'),'qr_amount_minor')
    if amount>total:
        raise HTTPException(422,'The initial QR amount cannot exceed the invoice total.')
    profile=p.get('profile','confirmed')
    if profile not in PROFILES:
        raise HTTPException(422,'Unknown simulation source setup.')
    with store.transaction() as db:
        key,digest,old=operation_key(request,p,'simulation:create',s['actor'],db)
        if old is not None:return old
        suffix=secrets.token_hex(4).upper()
        sim=dict(id=uid('sim'),workflow='qr_cash',customer_id=s['actor'],customer_name=name,merchant=merchant,item=item,
                 purchase_id='PUR-'+suffix,qr_reference='QR-'+suffix,total_minor=total,qr_amount_minor=amount,
                 line_items=items,merchant_address=address,subtotal_minor=subtotal,tax_minor=tax,cash_amount_minor=0,case_id=None,version=1,stage='PURCHASE_CREATED',qr_status='NOT_ATTEMPTED',
                 created_at=now(),profile=profile,source_records={},receipt_draft=None,receipt_drafts=[],customer_state='PURCHASE_CREATED',
                 qr_display_result='NOT_ATTEMPTED',customer_observed_debit=False,qr_pipeline={},
                 events=[dict(at=now(),kind='purchase',text=f'Purchase created at {merchant}.')])
        sim['source_records']['invoice']=evidence(f'Invoice for purchase {sim["purchase_id"]}. Purchase total BDT {total/100:.2f}. Merchant: {merchant}. Item: {item}.',
                 'mock_invoice','INV-'+suffix,total,sim['purchase_id'],'purchase_total')
        for event in sim['events']:
            event.update(actor=s['actor'],version=1,evidence_version=0,idempotency_key=key,source_identifiers=dict(simulation_id=sim['id'],purchase_id=sim['purchase_id']))
        sim['marketplace_record']=dict(order_exists=True,available=profile not in ('unverified',),purchase_id=sim['purchase_id'],merchant=merchant,item=item,amount=f'{total/100:.2f}',cash_reference='CASH-'+sim['purchase_id'],qr_reference=sim['qr_reference'],bank_debit_reference='BANK-'+sim['qr_reference'],timestamp=sim['created_at'],bank_debit_verified=profile!='qr_failed',qr_posted_amount_minor=amount if profile!='qr_failed' else 0,cash_received=False,cash_amount_minor=None,payment_method='CASH',currency='BDT',line_items=items,subtotal_minor=subtotal,tax_minor=tax,invoice_total_minor=total,denial=profile=='denied',refunded=False)
        save_sim(db,sim)
        result=project(sim);remember(db,s['actor'],'simulation:create',key,digest,result)
        return result


@router.get('/api/simulation-inbox')
def incoming_purchases(request:Request):
    from .app import session
    if session(request)['role']!='staff':
        raise HTTPException(403,'Investigator session required.')
    with store.connect() as db:rows=db.execute('SELECT body FROM simulations').fetchall()
    sims=sorted((json.loads(r['body']) for r in rows),key=lambda s:s['created_at'],reverse=True)
    return [project(s) for s in sims]


@router.get('/api/simulations/{identifier}')
def read_simulation(identifier:str,request:Request):
    from .app import session
    s=session(request)
    if s['role'] not in ('customer','staff','judge'):
        raise HTTPException(403,'Use a customer, investigator or judge session.')
    with store.connect() as db:sim=get_sim(db,identifier)
    if s['role']=='customer':owned(s,sim)
    elif not sim:raise HTTPException(404,'Purchase not found.')
    return project(sim)


@router.post('/api/simulations/{identifier}/action')
async def simulation_action(identifier:str,request:Request):
    from .app import session,payload,positive_int
    s=session(request)
    if s['role']!='customer':
        raise HTTPException(403,'Customer session required.')
    p=await payload(request)
    with store.transaction() as db:
        sim=get_sim(db,identifier);owned(s,sim)
        scope='simulation:'+identifier+':action'
        key,digest,old=operation_key(request,p,scope,s['actor'],db)
        if old is not None:return old
        revision(p,sim)
        action=p.get('action')
        if action=='attempt_qr' and sim['stage']=='PURCHASE_CREATED':
            sim.update(stage='QR_UNCLEAR',qr_status='UNCLEAR',qr_display_result='FAILED',customer_state='QR_DISPLAY_FAILED_OR_UNCONFIRMED')
            sim['events'].append(dict(at=now(),kind='qr_attempted',customer_states=['QR_ATTEMPTED','QR_DISPLAY_FAILED_OR_UNCONFIRMED'],text='The payment screen showed a failed result and no confirmation was received.'))
        elif action=='pay_cash' and sim['stage']=='QR_UNCLEAR':
            amount=positive_int(p.get('amount_minor'))
            sim.update(stage='SECOND_PAID',cash_amount_minor=amount,customer_state='RECEIPT_ISSUED',receipt_issued_at=now())
            from .qr_receipt import render_receipt
            blob,transcript,layout=render_receipt(sim)
            sim['issued_receipt']=dict(mime='image/png',base64=base64.b64encode(blob).decode(),transcript=transcript,
                hash=hashlib.sha256(blob).hexdigest(),template_version=2,layout=layout)
            if sim.get('marketplace_record'):
                sim['marketplace_record'].update(cash_received=sim['profile'] in ('confirmed','qr_failed'),
                    cash_amount_minor=amount if sim['profile'] in ('confirmed','qr_failed') else None,
                    receipt_timestamp=sim['receipt_issued_at'])
            sim['events'].append(dict(at=now(),kind='cash_reported',customer_states=['CASH_PAID'],text=f'Customer recorded paying BDT {amount/100:.2f} cash at the counter.'))
            sim['events'].append(dict(at=now(),kind='receipt_issued',text='The merchant issued a receipt for the cash payment.'))
            if sim['profile']=='confirmed':
                sim['source_records']['merchant']=evidence(f'Cash payment of BDT {amount/100:.2f} was received for purchase {sim["purchase_id"]}. Both payments are for the same purchase. Merchant: {sim["merchant"]}.',
                    'mock_merchant','CASH-'+sim['purchase_id'],amount,sim['purchase_id'],'cash_received')
            elif sim['profile']=='denied':
                record=evidence(f'Merchant response for purchase {sim["purchase_id"]}: no cash was received. The merchant denies the reported cash payment.',
                    'mock_merchant','CASH-'+sim['purchase_id'],None,sim['purchase_id'],'merchant_response')
                record['assertion']='denial';sim['source_records']['merchant']=record
            # For the failed-QR profile the merchant still independently records cash.
            elif sim['profile']=='qr_failed':
                sim['source_records']['merchant']=evidence(f'Cash payment of BDT {amount/100:.2f} was received for purchase {sim["purchase_id"]}.',
                    'mock_merchant','CASH-'+sim['purchase_id'],amount,sim['purchase_id'],'cash_received')
        elif action=='observe_debit' and sim['stage'] in ('SECOND_PAID','QR_CONFIRMED'):
            if sim.get('customer_observed_debit'): raise HTTPException(409,'The bank activity update is already saved.')
            sim['customer_observed_debit']=True;sim['customer_state']='CUSTOMER_OBSERVED_BANK_DEBIT'
            sim['events'].append(dict(at=now(),kind='customer_debit_observed',text=f'Customer later saw a BDT {sim["qr_amount_minor"]/100:.2f} debit in bank activity.'))
        elif action=='attach_sample_receipt' and sim['stage'] in ('SECOND_PAID','QR_CONFIRMED'):
            if not sim.get('customer_observed_debit'): raise HTTPException(409,'Observe the later bank activity before attaching complaint evidence.')
            from .qr_receipt import sample_receipt
            if not sim.get('issued_receipt'):raise HTTPException(409,'No original receipt is available for this saved purchase. Upload your receipt instead.')
            blob, mime, transcript = sample_receipt(sim)
            sim['receipt_draft']=dict(id=uid('receipt'),simulation_id=identifier,actor=s['actor'],mime=mime,base64=base64.b64encode(blob).decode(),transcript=transcript,hash=hashlib.sha256(blob).hexdigest(),at=now())
            sim['stage']='RECEIPT_ATTACHED';sim['customer_state']='RECEIPT_ATTACHED'
            sim.setdefault('receipt_drafts',[]).append(sim['receipt_draft'])
            sim['events'].append(dict(at=now(),kind='receipt_attached',text='Synthetic receipt attached as customer evidence for review.'))
        elif action=='refresh_qr' and sim['stage'] in ('QR_UNCLEAR','SECOND_PAID'):
            completed=sim['profile']!='qr_failed'
            sim.update(stage='QR_CONFIRMED',qr_status='COMPLETED' if completed else 'NOT_COMPLETED')
            amount=sim['qr_amount_minor']
            text=f'QR payment {sim["qr_reference"]} completed. BDT {amount/100:.2f} was posted for purchase {sim["purchase_id"]}.' if completed else f'QR payment {sim["qr_reference"]} did not complete. No QR amount was posted for purchase {sim["purchase_id"]}.'
            sim['source_records']['qr']=evidence(text,'mock_payment',sim['qr_reference'],amount if completed else 0,sim['purchase_id'],'qr_completed' if completed else 'qr_not_completed')
            sim['events'].append(dict(at=now(),kind='qr_status',text=text))
        else:
            raise HTTPException(409,'That action is not available at this purchase stage.')
        for event in sim['events']:
            event.setdefault('idempotency_key',key)
            event.setdefault('evidence_version',1 if sim.get('receipt_draft') else 0);event.setdefault('evidence_ids',[sim['receipt_draft']['id']] if sim.get('receipt_draft') else []);event.setdefault('actor',s['actor']);event.setdefault('version',sim['version']+1);event.setdefault('source_identifiers',dict(simulation_id=sim['id'],purchase_id=sim['purchase_id']))
        sim['version']+=1;save_sim(db,sim)
        result=project(sim);remember(db,s['actor'],scope,key,digest,result)
        return result


@router.post('/api/simulations/{identifier}/complaint')
async def file_complaint(identifier:str,request:Request):
    from .app import session,payload,text_field,notify
    s=session(request)
    if s['role']!='customer':
        raise HTTPException(403,'Customer session required.')
    p=await payload(request)
    with store.transaction() as db:
        sim=get_sim(db,identifier);owned(s,sim)
        scope='simulation:'+identifier+':complaint'
        key,digest,old=operation_key(request,p,scope,s['actor'],db)
        if old is not None:return old
        # Another click/key still returns the same complaint, not a duplicate case.
        if sim['case_id']:
            result=dict(simulation=project(sim),case=customer_view(store.get_case(db,sim['case_id'])))
            remember(db,s['actor'],scope,key,digest,result);return result
        revision(p,sim)
        if not sim['cash_amount_minor'] or sim['stage'] not in ('SECOND_PAID','QR_CONFIRMED','RECEIPT_ATTACHED'):
            raise HTTPException(409,'Record the second payment before reporting a paid-twice complaint.')
        description=text_field(p,'description')
        supplied=text_field(p,'receipt_text',4000,False)
        case_id=uid('case')
        due=(datetime.now(timezone.utc)+timedelta(hours=24)).isoformat()
        c=dict(id=case_id,reference='TF-'+secrets.token_hex(4).upper(),customer_id=s['actor'],customer_name=sim['customer_name'],
               simulation_id=sim['id'],purchase_label=sim['merchant']+' · '+sim['item'],purchase_id=sim['purchase_id'],qr_reference=sim['qr_reference'],
               second_method='cash',description=description,reported_amount_minor=sim['cash_amount_minor'],qr_amount_minor=sim['qr_amount_minor'],owner='staff_1',status='OPEN',
               version=1,evidence_version=1,created_at=now(),updated_at=now(),next_review=due,
               evidence=[evidence(description,purchase=sim['purchase_id'])],analysis=None,analyses=[],checks=[],tasks=[],handoffs=[],decisions=[],notifications=[],
               messages=[dict(id=uid('msg'),at=now(),actor=s['actor'],role='customer',text=description)])
        c.update(workflow='qr_cash',operator_state='CASE_RECEIVED',customer_observed_debit=bool(sim.get('customer_observed_debit')),qr_events=[],qr_pipeline={})
        receipt_id=p.get('receipt_evidence_id')
        if sim['stage']=='RECEIPT_ATTACHED' and not receipt_id: raise HTTPException(422,'Cite the attached receipt_evidence_id when submitting the complaint.')
        if receipt_id and receipt_id != (sim.get('receipt_draft') or {}).get('id'): raise HTTPException(409,'The requested receipt artifact does not belong to this purchase.')
        if receipt_id and sim.get('receipt_draft') and receipt_id==sim['receipt_draft']['id']:
            draft=sim['receipt_draft']
            e=evidence(draft.get('transcript') or 'Synthetic receipt supplied for review.',reference='RECEIPT-'+sim['purchase_id'],amount=sim['cash_amount_minor'],purchase=sim['purchase_id'])
            e['blob']=dict(mime=draft['mime'],base64=draft['base64']);e['original_hash']=draft['hash'];e['transcription']='customer supplied transcript';e['receipt_draft_id']=receipt_id
            c['evidence'].append(e)
        if supplied:
            c['evidence'].append(evidence(supplied,reference='SUPPLIED-'+sim['purchase_id'],amount=sim['cash_amount_minor'],purchase=sim['purchase_id']))
        if receipt_id:
            from .qr_workflow import emit
            emit(c,s['actor'],'QR_RECEIPT_ATTACHED','receipt_received',evidence_ids=[next(e['id'] for e in c['evidence'] if e.get('receipt_draft_id')==receipt_id)],version=1)
            emit(c,s['actor'],'CASE_RECEIVED','receipt_received',evidence_ids=[next(e['id'] for e in c['evidence'] if e.get('receipt_draft_id')==receipt_id)],version=1)
            for event in c['qr_events']:
                event.update(idempotency_key=key,request_version=p['version'])
        notify(c,'Your complaint is saved. Investigator 1 will check both payments and the purchase records.')
        store.save_case(db,c);store.audit(db,c,s['actor'],'simulation_complaint')
        sim.update(stage='COMPLAINT_FILED',customer_state='COMPLAINT_FILED',case_id=case_id,version=sim['version']+1)
        sim['events'].append(dict(at=now(),actor=s['actor'],version=sim['version'],evidence_version=c['evidence_version'],evidence_ids=[e['id'] for e in c['evidence']],idempotency_key=key,source_identifiers=dict(simulation_id=sim['id'],case_id=case_id),kind='complaint',text='Complaint saved as '+c['reference']+'.'))
        save_sim(db,sim)
        result=dict(simulation=project(sim),case=customer_view(c));remember(db,s['actor'],scope,key,digest,result)
        return result


@router.post('/api/simulations/{identifier}/receipt')
async def save_receipt(identifier:str,request:Request,file:UploadFile=File(...),transcript:str=Form(''),version:int=Form(...)):
    from .app import session
    from .qr_receipt import validate_image
    s=session(request)
    if s['role']!='customer': raise HTTPException(403,'Customer session required.')
    content=await file.read(2*1024*1024+1)
    if len(content)>2*1024*1024: raise HTTPException(413,'Maximum upload is 2 MiB.')
    try: validate_image(content,file.content_type)
    except Exception as e: raise HTTPException(422,str(e))
    if not transcript.strip() or len(transcript)>4000: raise HTTPException(422,'Provide a receipt transcript of at most 4000 characters.')
    with store.transaction() as db:
        sim=get_sim(db,identifier);owned(s,sim)
        scope='simulation:'+identifier+':receipt'
        digest_body=dict(version=version,hash=hashlib.sha256(content).hexdigest(),transcript=transcript,mime=file.content_type)
        key,digest,old=operation_key(request,digest_body,scope,s['actor'],db)
        if old is not None:return old
        revision({'version':version},sim)
        if sim['case_id'] or not sim['cash_amount_minor']: raise HTTPException(409,'Attach a draft receipt after cash payment and before the complaint.')
        draft=dict(id=uid('receipt'),simulation_id=identifier,mime=file.content_type,base64=base64.b64encode(content).decode(),transcript=transcript.strip(),hash=digest_body['hash'],at=now(),actor=s['actor'])
        sim['receipt_draft']=draft;sim.setdefault('receipt_drafts',[]).append(draft);sim['stage']='RECEIPT_ATTACHED';sim['customer_state']='RECEIPT_ATTACHED';sim['version']+=1
        sim['events'].append(dict(at=now(),actor=s['actor'],version=sim['version'],evidence_version=1,evidence_ids=[draft['id']],idempotency_key=key,source_identifiers=dict(simulation_id=identifier,purchase_id=sim['purchase_id']),kind='receipt_attached',text='Customer attached an immutable receipt as evidence for review.'))
        save_sim(db,sim)
        result=project(sim)|dict(receipt_evidence_id=draft['id'])
        remember(db,s['actor'],scope,key,digest,result)
        return result


def check_source(db,c,kind):
    """Expose only the exact requested record, deduplicated by source identity."""
    from .app import new_evidence
    sim=get_sim(db,c['simulation_id'])
    record=sim['source_records'].get(kind) if sim else None
    if not record:
        return dict(state='UNAVAILABLE',result='No record is available in this bounded simulated source. Obtain the missing evidence; absence is not proof that the complaint is false.')
    if record['purchase_id']!=c['purchase_id']:
        return dict(state='UNAVAILABLE',result='Exact purchase reference mismatch. This record was not imported.')
    if not any(e['id']==record['id'] for e in c['evidence']):
        new_evidence(c,record)
    return dict(state='COMPLETED',result=current_text(record),evidence_id=record['id'])


@router.post('/api/cases/{case_id}/messages')
async def send_message(case_id:str,request:Request):
    from .app import payload,operation,text_field,new_evidence,notify
    p=await payload(request)
    def act(db,c,s,p):
        text=text_field(p,'text')
        t=None
        if p.get('task_id'):
            t=next((t for t in c['tasks'] if t['id']==p['task_id'] and t['status']=='OPEN' and t.get('audience','customer')=='customer'),None)
            if not t or s['role']!='customer':
                raise HTTPException(422,'Choose an open customer evidence request to answer.')
        msg=dict(id=uid('msg'),actor=s['actor'],role=s['role'],text=text,at=now())
        if s['role']=='customer':
            e=evidence(text,purchase=c['purchase_id']);e['supplied_by']=s['actor'];new_evidence(c,e)
            msg['evidence_id']=e['id']
            if t:
                t.update(status='RESPONDED',response_evidence_id=e['id'],responded_at=now())
                msg['task_id']=t['id']
        else:
            notify(c,'Your investigator sent a message: '+text)
        c.setdefault('messages',[]).append(msg)
    return operation(request,p,case_id,'messages',act,staff=False)


@router.post('/api/cases/{case_id}/repayment-request')
async def repayment_request(case_id:str,request:Request):
    from .app import payload,operation,text_field,new_evidence,notify
    p=await payload(request)
    def act(db,c,s,p):
        if not c.get('simulation_id') or not fresh(c) or assessment(c)['status']!='SUPPORTED':
            raise HTTPException(409,'A current, source-supported duplicate-payment assessment is required.')
        if c.get('qr_pipeline',{}).get('receipt_scan'): raise HTTPException(409,'Use the QR verdict and operator approval controls for this investigation.')
        if any(e['kind']=='repayment_request' for e in c['evidence']):
            raise HTTPException(409,'A resolution request is already recorded.')
        note=text_field(p,'note',1000)
        amount=facts(c)['recorded_excess_minor']
        new_evidence(c,evidence(f'Repayment of BDT {amount/100:.2f} requested. It is not completed yet. '+note,'repayment_request',c['qr_reference'],amount,c['purchase_id'],'repayment_requested'))
        c['status']='WAITING_EVIDENCE'
        c.setdefault('messages',[]).append(dict(id=uid('msg'),at=now(),actor=s['actor'],role='staff',text='A resolution review was requested. A request does not mean repayment has completed. '+note))
        notify(c,'Your investigator recorded a resolution request and is waiting for a completed source record.')
    return operation(request,p,case_id,'repayment-request',act)


@router.post('/api/simulations/{identifier}/repayment')
async def simulate_repayment(identifier:str,request:Request):
    from .app import session,payload
    s=session(request)
    if s['role'] not in ('staff','judge'):
        raise HTTPException(403,'Investigator or judge simulation control required.')
    p=await payload(request)
    with store.transaction() as db:
        sim=get_sim(db,identifier)
        if not sim or not sim['case_id']:
            raise HTTPException(404,'Reported purchase not found.')
        scope='simulation:'+identifier+':repayment'
        key,digest,old=operation_key(request,p,scope,s['actor'],db)
        if old is not None:return old
        revision(p,sim)
        c=store.get_case(db,sim['case_id'])
        if c.get('qr_pipeline',{}).get('receipt_scan'): raise HTTPException(409,'Use the guarded QR refund controls for this investigation.')
        req=next((e for e in c['evidence'] if e['kind']=='repayment_request'),None)
        if not req:
            raise HTTPException(409,'Record a supported resolution request before advancing the repayment source.')
        if 'repayment' not in sim['source_records']:
            sim['source_records']['repayment']=evidence(f'Repayment completed. BDT {req["amount_minor"]/100:.2f} returned against {sim["qr_reference"]} for purchase {sim["purchase_id"]}.',
                'mock_repayment',sim['qr_reference'],req['amount_minor'],sim['purchase_id'],'repayment_completed')
            sim['version']+=1;save_sim(db,sim)
        result=dict(saved=True,version=sim['version'],message='Fictional completed-repayment source is available. Run the repayment check to import it. No real payment was executed.')
        remember(db,s['actor'],scope,key,digest,result);return result
