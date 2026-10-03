"""Master operations API: one incident, observed investigations, approved sandbox actions."""
import asyncio
import copy
from datetime import datetime, timezone
import hashlib
import json
from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import JSONResponse, PlainTextResponse, StreamingResponse
from . import store, payments, investigation
from .domain import now, uid, customer_view, facts, fresh, assessment, evidence
from .simulation import operation_key, remember
from ml.features import RULES_VERSION

router=APIRouter()


def helpers():
    from . import app
    return app


def require_staff(request):
    s=helpers().session(request)
    if s['role']!='staff':raise HTTPException(403,'Operator permission required.')
    return s


def require_transaction(db,s,identifier):
    if s['role'] not in ('customer','staff'):raise HTTPException(403,'Use a customer or operator session.')
    t=payments.load(db,identifier)
    if not t or (s['role']=='customer' and t['customer_id']!=s['actor']):raise HTTPException(404,'Transaction not found.')
    return t


def expected_version(p,document):
    if type(p.get('version')) is not int or p['version']!=document['version']:raise HTTPException(409,'This record changed. Refresh before making a new change.')


@router.get('/api/scenarios')
def scenarios(request:Request):
    helpers().session(request)
    return dict(synthetic=True,scenarios=[dict(id=k,title=v[0],description=v[1]) for k,v in payments.SCENARIOS.items()])


@router.post('/api/incidents')
async def incident_draft(request:Request):
    s=helpers().session(request)
    if s['role']!='customer':raise HTTPException(403,'Customer session required.')
    p=await helpers().payload(request)
    draft=helpers().text_field(p,'draft_id',100)
    with store.transaction() as db:
        key,digest,old=operation_key(request,p,'incident:draft',s['actor'],db)
        if old is not None:return old
        row=db.execute('SELECT id FROM incidents WHERE customer_id=? AND subject=?',(s['actor'],'draft:'+draft)).fetchone()
        identifier=row['id'] if row else uid('incident')
        if not row:db.execute('INSERT INTO incidents VALUES (?,?,?,?)',(identifier,s['actor'],'draft:'+draft,now()))
        result=dict(incident_id=identifier,synthetic=True)
        remember(db,s['actor'],'incident:draft',key,digest,result)
        return result


@router.post('/api/transactions')
async def create_transaction(request:Request):
    s=helpers().session(request)
    if s['role']!='customer':raise HTTPException(403,'Customer session required.')
    p=await helpers().payload(request);amount=helpers().positive_int(p.get('amount_minor'))
    scenario=p.get('scenario','duplicate_payment')
    if scenario not in payments.SCENARIOS:raise HTTPException(422,'Choose an available synthetic scenario.')
    name=helpers().text_field(p,'customer_name',80,False) or 'Demo customer'
    with store.transaction() as db:
        key,digest,old=operation_key(request,p,'transaction:create',s['actor'],db)
        if old is not None:return old
        t=payments.create(db,s['actor'],amount,scenario,name)
        result=payments.project(db,t);remember(db,s['actor'],'transaction:create',key,digest,result)
        return result


@router.get('/api/transactions')
def transaction_list(request:Request):
    s=helpers().session(request)
    if s['role'] not in ('customer','staff'):raise HTTPException(403,'Use a customer or operator session.')
    with store.connect() as db:
        rows=db.execute('SELECT body FROM transactions ORDER BY rowid DESC').fetchall()
        return [payments.project(db,t,staff=s['role']=='staff') for t in (json.loads(r['body']) for r in rows) if s['role']=='staff' or t['customer_id']==s['actor']]


@router.get('/api/transactions/{identifier}')
def transaction_read(identifier:str,request:Request):
    s=helpers().session(request)
    with store.connect() as db:return payments.project(db,require_transaction(db,s,identifier),s['role']=='staff')


@router.post('/api/transactions/{identifier}/advance')
async def transaction_advance(identifier:str,request:Request):
    s=helpers().session(request)
    if s['role']!='customer':raise HTTPException(403,'Customer simulation control required.')
    p=await helpers().payload(request)
    with store.transaction() as db:
        t=require_transaction(db,s,identifier);scope='transaction:'+identifier+':advance'
        key,digest,old=operation_key(request,p,scope,s['actor'],db)
        if old is not None:return old
        expected_version(p,t);payments.advance(db,t)
        result=payments.project(db,t);remember(db,s['actor'],scope,key,digest,result)
        return result


@router.post('/api/transactions/{identifier}/complaint')
async def transfer_complaint(identifier:str,request:Request):
    s=helpers().session(request)
    if s['role']!='customer':raise HTTPException(403,'Customer session required.')
    p=await helpers().payload(request);description=helpers().text_field(p,'description')
    issue=p.get('issue_type','STUCK_TRANSFER')
    if issue not in ('STUCK_TRANSFER','PAID_TWICE'):raise HTTPException(422,'Choose Stuck Transfer or Paid Twice.')
    with store.transaction() as db:
        t=require_transaction(db,s,identifier);scope='transaction:'+identifier+':complaint'
        key,digest,old=operation_key(request,p,scope,s['actor'],db)
        if old is not None:return old
        if not t['case_id']:
            expected_version(p,t)
            if t['step']<2:raise HTTPException(409,'Advance the payment to the bank before reporting an incident.')
        context=dict(transaction_reference=t['id'],
                     merchant_information=helpers().text_field(p,'merchant_information',300,False),
                     approximate_time=helpers().text_field(p,'approximate_time',100,False))
        c=payments.make_case(db,t,description,issue,context,helpers().text_field(p,'supporting_text',4000,False))
        result=dict(transaction=payments.project(db,t),case=customer_view(c))
        remember(db,s['actor'],scope,key,digest,result);return result


@router.post('/api/demo/scenarios/{identifier}/reset')
async def reset_scenario(identifier:str,request:Request):
    s=require_staff(request);p=await helpers().payload(request)
    with store.transaction() as db:
        t=require_transaction(db,s,identifier);scope='transaction:'+identifier+':reset'
        key,digest,old=operation_key(request,p,scope,s['actor'],db)
        if old is not None:return old
        new=payments.create(db,t['customer_id'],t['amount_minor'],t['scenario'],t['customer_name'],reset_of=t['id'])
        if t['case_id']:
            c=store.get_case(db,t['case_id']);store.audit(db,c,s['actor'],'isolated_scenario_reset',new['id'])
        result=payments.project(db,new,staff=True);remember(db,s['actor'],scope,key,digest,result);return result


@router.get('/api/operations/overview')
def overview(request:Request):
    require_staff(request)
    with store.connect() as db:
        from .transfer import FAMILY as transfer_family
        cs=[c for r in db.execute('SELECT body FROM cases') if (c:=json.loads(r['body'])).get('family')!=transfer_family]
        counts=dict(open=sum(c['status'] not in ('RESOLVED','OUTCOME_RECORDED') for c in cs),
                    investigating=db.execute("SELECT COUNT(*) FROM investigations WHERE status='RUNNING'").fetchone()[0],
                    awaiting_evidence=sum(c['status']=='WAITING_EVIDENCE' for c in cs),
                    repair_eligible=0,handoff=sum(c['status']=='ESCALATED' for c in cs),
                    resolved=sum(c['status'] in ('RESOLVED','OUTCOME_RECORDED') for c in cs))
        rows=[]
        for c in cs:
            run=investigation.get_run(db,c.get('current_run_id',''))
            eligible=investigation.current_eligibility(db,c,run)['eligible'] if run else False
            counts['repair_eligible']+=eligible
            t=payments.load(db,c['transaction_id']) if c.get('transaction_id') else None
            audit=db.execute('SELECT action,at FROM audit WHERE case_id=? ORDER BY id DESC LIMIT 1',(c['id'],)).fetchone()
            rows.append(dict(id=c['id'],reference=c['reference'],incident_id=c.get('incident_id'),transaction_id=c.get('transaction_id') or c['qr_reference'],
                             issue_type=c.get('issue_type','PAID_TWICE'),customer=c.get('customer_name',c['customer_id']),amount_minor=c['reported_amount_minor'],
                             transaction_state=t['state'] if t else 'EVIDENCE_REVIEW',age_seconds=max(0,int((datetime.now(timezone.utc)-datetime.fromisoformat(c['created_at'])).total_seconds())),
                             priority=c.get('priority','NORMAL'),status=c['status'],owner=c['owner'],next_review=c['next_review'],
                             investigation_status=run['status'] if run else 'NOT_STARTED',last_event=dict(audit) if audit else None,repair_eligible=eligible,version=c['version']))
    rows.sort(key=lambda c:(c['status'] in ('RESOLVED','OUTCOME_RECORDED'),c['priority']!='HIGH',c['next_review']))
    return dict(counts=counts,cases=rows,synthetic=True)


@router.post('/api/cases/{case_id}/investigations')
async def start_investigation(case_id:str,request:Request):
    s=require_staff(request);p=await helpers().payload(request);mode=p.get('mode','live')
    if mode not in ('live','demo'):raise HTTPException(422,'Choose live or demo investigation.')
    created=False;superseded=None
    with store.transaction() as db:
        c=store.get_case(db,case_id);helpers().authorize(s,c,staff=True)
        scope=case_id+':investigation'
        key,digest,old=operation_key(request,p,scope,s['actor'],db)
        if old is not None:return JSONResponse(old,status_code=202)
        active=db.execute("SELECT id FROM investigations WHERE case_id=? AND status='RUNNING'",(case_id,)).fetchone()
        if active and not p.get('restart'):
            result=investigation.get_run(db,active['id'])
        else:
            expected_version(p,c)
            if active:
                previous=investigation.get_run(db,active['id']);previous['status']='SUPERSEDED';investigation.save_run(db,previous);superseded=previous['id']
            result=dict(id=uid('run'),case_id=case_id,incident_id=c['incident_id'],transaction_id=c.get('transaction_id'),
                        status='RUNNING',requested_mode=mode,mode='CONNECTING' if mode=='live' else 'DEMO',
                        mode_label='Connecting local AI…' if mode=='live' else 'DEMO INVESTIGATION — SIMULATED AI TRACE',
                        started_at=now(),updated_at=now(),actor=s['actor'],owner_at_start=c['owner'],snapshot=copy.deepcopy(c),
                        evidence_version=c['evidence_version'],source_version=c.get('source_version',0),sequence=0,hypotheses=[],evidence_count=0,current_phase='initialize')
            investigation.save_run(db,result)
            c.update(current_run_id=result['id'],status='INVESTIGATING',investigation_stage='initialize',version=c['version']+1,updated_at=now())
            db.execute("UPDATE approvals SET status='STALE' WHERE case_id=? AND status='APPROVED'",(case_id,))
            store.save_case(db,c);store.audit(db,c,s['actor'],'investigation_started',result['id']);created=True
        remember(db,s['actor'],scope,key,digest,result)
    tasks=request.app.state.investigation_tasks
    if superseded and superseded in tasks:tasks[superseded].cancel()
    if created:
        task=asyncio.create_task(investigation.execute_run(result['id']));tasks[result['id']]=task
        task.add_done_callback(lambda done:tasks.pop(result['id'],None))
    return JSONResponse(result,status_code=202)


def authorized_run(db,request,identifier):
    s=require_staff(request);run=investigation.get_run(db,identifier)
    if not run:raise HTTPException(404,'Investigation not found.')
    helpers().authorize(s,store.get_case(db,run['case_id']),staff=True)
    return run


@router.get('/api/investigations/{identifier}')
def investigation_read(identifier:str,request:Request):
    with store.connect() as db:
        run=authorized_run(db,request,identifier)
        run['events']=investigation.run_events(db,identifier)
        run['phases']=[dict(id=id,title=title,purpose=purpose) for id,title,purpose in investigation.PHASES]
        c=store.get_case(db,run['case_id'])
        run['input_fresh']=c.get('current_run_id')==identifier and c['evidence_version']==run.get('evidence_version') and c.get('source_version',0)==run.get('source_version',0) and c['owner']==run.get('owner_at_start',run['snapshot']['owner'])
        run['eligibility']=investigation.current_eligibility(db,c,run)
        run['approvals']=[json.loads(r['body'])|dict(status=r['status']) for r in db.execute('SELECT body,status FROM approvals WHERE case_id=? ORDER BY rowid',(c['id'],))]
        run['repair_attempts']=[json.loads(r['body']) for r in db.execute('SELECT body FROM repair_attempts WHERE case_id=? ORDER BY rowid',(c['id'],))]
        return run


@router.get('/api/investigations/{identifier}/events')
async def investigation_stream(identifier:str,request:Request,after:int=0):
    if after<0:raise HTTPException(422,'Sequence cursor must be nonnegative.')
    with store.connect() as db:authorized_run(db,request,identifier)
    if 'text/event-stream' not in request.headers.get('accept',''):
        with store.connect() as db:return dict(events=investigation.run_events(db,identifier,after),status=investigation.get_run(db,identifier)['status'])
    async def stream():
        cursor=after;heartbeat=0
        while not await request.is_disconnected():
            with store.connect() as db:
                authorized_run(db,request,identifier)
                items=investigation.run_events(db,identifier,cursor);run=investigation.get_run(db,identifier)
            for event in items:
                cursor=event['sequence']
                yield 'id: '+str(cursor)+'\nevent: investigation\ndata: '+json.dumps(event,ensure_ascii=False)+'\n\n'
            if run['status']!='RUNNING':
                yield 'event: complete\ndata: '+json.dumps(dict(status=run['status']))+'\n\n';break
            heartbeat+=1
            if heartbeat%20==0:yield ': heartbeat\n\n'
            await asyncio.sleep(.4)
    return StreamingResponse(stream(),media_type='text/event-stream',headers={'Cache-Control':'no-store','X-Accel-Buffering':'no'})


def recommended(db,c,p):
    run=investigation.get_run(db,p.get('run_id') or c.get('current_run_id',''))
    if not run or not run.get('recommendation'):raise HTTPException(409,'Complete an investigation first.')
    if p.get('recommendation_id') and p['recommendation_id']!=run['recommendation']['id']:raise HTTPException(409,'Recommendation does not belong to this investigation.')
    return run


@router.get('/api/cases/{case_id}/investigations')
def case_investigations(case_id:str,request:Request):
    s=require_staff(request)
    with store.connect() as db:
        c=store.get_case(db,case_id);helpers().authorize(s,c,staff=True)
        return [{k:run.get(k) for k in ('id','status','mode','mode_label','started_at','sequence','evidence_version','source_version')}
                for run in (investigation.get_run(db,r['id']) for r in db.execute('SELECT id FROM investigations WHERE case_id=? ORDER BY rowid DESC',(case_id,)))]


@router.post('/api/cases/{case_id}/pipeline-check')
async def pipeline_check(case_id:str,request:Request):
    p=await helpers().payload(request)
    def action(db,c,s,p):
        stage=p.get('stage')
        if not c.get('transaction_id') or stage not in payments.STAGES:raise HTTPException(422,'Choose a bank-transfer pipeline source.')
        t=payments.load(db,c['transaction_id'])
        records=[e for e in payments.events(db,t) if e['stage']==stage]
        imported=[]
        for record in records:
            e=record['evidence']
            if not any(old['id']==e['id'] for old in c['evidence']):
                helpers().new_evidence(c,copy.deepcopy(e));imported.append(e['id'])
        c['checks'].append(dict(id=uid('check'),kind=stage,requested_at=now(),as_of=now(),scope='exact synthetic transaction '+t['id'],
                               state='COMPLETED' if records else 'UNAVAILABLE',evidence_ids=[e['evidence']['id'] for e in records],
                               result=f'Inspected {len(records)} saved source records; imported {len(imported)}. Checking a source does not change the payment outcome.'))
        c['source_version']=t['event_count']
    return helpers().operation(request,p,case_id,'pipeline_check',action)


@router.post('/api/cases/{case_id}/repairs/eligibility')
async def repair_eligibility(case_id:str,request:Request):
    p=await helpers().payload(request)
    def action(db,c,s,p):
        run=recommended(db,c,p);result=investigation.current_eligibility(db,c,run)
        c['repair_eligibility']=result
        store.audit(db,c,s['actor'],'repair_eligibility_checked',json.dumps(result))
    return helpers().operation(request,p,case_id,'repair_eligibility',action)


@router.post('/api/cases/{case_id}/approvals')
async def approve(case_id:str,request:Request):
    p=await helpers().payload(request)
    def action(db,c,s,p):
        if s['actor']!=c['owner']:raise HTTPException(403,'Only the current case owner can approve this repair.')
        run=recommended(db,c,p);result=investigation.current_eligibility(db,c,run)
        if not result['eligible']:raise HTTPException(409,result['reason'])
        prior=db.execute('SELECT body,status FROM approvals WHERE recommendation_id=?',(run['recommendation']['id'],)).fetchone()
        if prior:
            if prior['status']=='APPROVED':return
            raise HTTPException(409,'This recommendation was already consumed or invalidated. Restart analysis for a new review.')
        approval=dict(id=uid('approval'),case_id=c['id'],incident_id=c['incident_id'],recommendation_id=run['recommendation']['id'],run_id=run['id'],
                      actor=s['actor'],at=now(),status='APPROVED',evidence_version=c['evidence_version'],source_version=c.get('source_version',0),
                      action=result['action'],amount_minor=result['amount_minor'],evidence_ids=result['evidence_ids'],note=helpers().text_field(p,'note',1000))
        db.execute('INSERT INTO approvals VALUES (?,?,?,?,?)',(approval['id'],c['id'],approval['recommendation_id'],'APPROVED',json.dumps(approval,ensure_ascii=False)))
        c['approval']=approval;c['status']='REPAIR_APPROVED'
        c['decisions'].append(dict(id=uid('decision'),decision='APPROVE_SANDBOX_REPAIR',note=approval['note'],evidence_ids=approval['evidence_ids'],evidence_version=c['evidence_version'],actor=s['actor'],at=now(),stale=False))
        investigation.emit(db,run,'decision','Record cited operator approval',approval['note'],approval['evidence_ids'],
                           'Approval saved; no financial posting applied.','Execute separately; current eligibility will be rechecked.')
    return helpers().operation(request,p,case_id,'approve_sandbox',action)


@router.post('/api/cases/{case_id}/repairs/execute')
async def execute_repair(case_id:str,request:Request):
    p=await helpers().payload(request)
    def action(db,c,s,p):
        row=db.execute('SELECT body,status FROM approvals WHERE id=? AND case_id=?',(p.get('approval_id'),case_id)).fetchone()
        if not row:raise HTTPException(409,'A recorded operator approval is required.')
        approval=json.loads(row['body'])
        if row['status']=='EXECUTED':return
        if row['status']!='APPROVED' or s['actor']!=c['owner'] or approval['actor']!=s['actor']:raise HTTPException(403,'A current approval by the case owner is required.')
        run=investigation.get_run(db,approval['run_id']);elig=investigation.current_eligibility(db,c,run)
        if (not elig['eligible'] or approval['evidence_version']!=c['evidence_version'] or approval['source_version']!=c.get('source_version',0) or
            (approval['action'],approval['amount_minor'])!=(elig['action'],elig['amount_minor'])):
            raise HTTPException(409,'Approval is stale or no longer eligible. Analyze and review current evidence.')
        attempt=dict(id=uid('repair'),approval_id=approval['id'],case_id=c['id'],incident_id=c['incident_id'],at=now(),actor=s['actor'],
                     action=elig['action'],amount_minor=elig['amount_minor'],synthetic=True)
        if p.get('simulate_failure'):
            attempt.update(status='FAILED',result='Sandbox source unavailable. No ledger posting was applied.')
            db.execute('INSERT INTO repair_attempts VALUES (?,?,?,?)',(attempt['id'],approval['id'],c['id'],json.dumps(attempt)))
            db.execute("UPDATE approvals SET status='FAILED' WHERE id=?",(approval['id'],))
            c['status']='REPAIR_FAILED';c['repair_result']=attempt
            investigation.emit(db,run,'decision','Sandbox repair failed',attempt['result'],elig['evidence_ids'],'Case remains open.','Restart analysis and review the source.',state='attention')
            return
        t=payments.load(db,c['transaction_id']);entries=payments.ledger(db,t)['entries'];amount=elig['amount_minor']
        if elig['action']=='RETRY_SETTLEMENT':
            posting=payments.postings(db,t,'intended-credit','WALLET_CREDIT',amount,'SUSPENSE','WALLET')
            payments.record(db,t,'settlement','completed','Approved sandbox settlement retry completed once.','settlement_confirmed',amount,posting_id=posting['id'])
            payments.record(db,t,'wallet','completed','Approved retry produced exactly one verified wallet credit.','wallet_credit',amount,posting_id=posting['id'])
        else:
            original=[e for e in entries if e['kind']=='BANK_DEBIT'][-1]
            if amount>original['amount_minor']:raise HTTPException(409,'Correction exceeds the original posting.')
            posting=payments.postings(db,t,'correction:'+original['id'],'REVERSAL' if elig['action']=='REVERSE_DUPLICATE_DEBIT' else 'CORRECTION',amount,'SUSPENSE','BANK',original['id'])
            payments.record(db,t,'bank','completed',f'Operator-approved sandbox correction returned BDT {amount/100:.2f} against posting {original["id"]}.','reversal_posted',amount,posting_id=posting['id'])
        t['state']='CORRECTED';t['version']+=1;payments.save(db,t)
        # Import and verify the actual resulting source records in the same atomic transaction.
        latest=store.get_case(db,c['id']);c['version']=latest['version']
        imported=[]
        for event in payments.events(db,t):
            e=event['evidence']
            if not any(old['id']==e['id'] for old in c['evidence']):
                c['evidence'].append(copy.deepcopy(e));c['evidence_version']+=1;imported.append(e)
        c['source_version']=t['event_count'];f=facts(c)
        if f['remaining_unsettled_minor'] or f['recorded_excess_minor'] or not payments.ledger(db,t)['balanced']:
            raise HTTPException(409,'Post-repair ledger verification failed; the atomic correction was rolled back.')
        attempt.update(status='SUCCEEDED',result='Balanced sandbox correction verified. No remaining unsettled or duplicate amount.',posting_id=posting['id'])
        db.execute('INSERT INTO repair_attempts VALUES (?,?,?,?)',(attempt['id'],approval['id'],c['id'],json.dumps(attempt)))
        db.execute("UPDATE approvals SET status='EXECUTED' WHERE id=?",(approval['id'],))
        c.update(status='RESOLVED',repair_result=attempt,resolution=attempt,investigation_stage='resolved')
        english='Your payment issue was verified and the approved sandbox correction completed. Your case is resolved.'
        bangla='আপনার লেনদেনের সমস্যা যাচাই করা হয়েছে এবং অনুমোদিত সিমুলেটেড সংশোধন সম্পন্ন হয়েছে। আপনার মামলাটি সমাধান হয়েছে।'
        c['last_verified_update']=dict(at=now(),text=english,text_bn=bangla)
        helpers().notify(c,english,bangla)
        a=dict(id=uid('analysis'),run_id=run['id'],at=now(),evidence_version=c['evidence_version'],source_version=c['source_version'],
               model=dict(engine='verified_sandbox_ledger',available=False),claims=[],assessment=assessment(c),rules_version=RULES_VERSION,verification=investigation.verification(c))
        c['analysis']=a;c['analyses'].append(a)
        run['resolution']=attempt;run['resolution_evidence']=copy.deepcopy(imported)
        investigation.emit(db,run,'decision','Verify the approved sandbox correction',english,[e['id'] for e in imported],
                           'Transaction, case, graph, history and bilingual customer update committed together.','Customer receives the verified resolution.')
    return helpers().operation(request,p,case_id,'execute_sandbox',action)


@router.post('/api/cases/{case_id}/operator-outcome')
async def operator_outcome(case_id:str,request:Request):
    p=await helpers().payload(request)
    def action(db,c,s,p):
        run=recommended(db,c,p)
        if s['actor']!=c['owner']:raise HTTPException(403,'Only the current owner can record this outcome.')
        if not fresh(c) or not run or c.get('current_run_id')!=run['id'] or not run.get('verification'):raise HTTPException(409,'A current completed investigation is required.')
        choice=p.get('decision')
        if choice not in ('REJECT_REPAIR','RESOLVED_NO_REPAIR'):raise HTTPException(422,'Choose reject repair or verified no-repair outcome.')
        if choice=='RESOLVED_NO_REPAIR':
            f=facts(c)
            if not c.get('transaction_id') or f['requirements'] or f['conflict'] or f['remaining_unsettled_minor'] or f['recorded_excess_minor']:
                raise HTTPException(409,'An unresolved amount or evidence gap prevents closure.')
            if any(t['status'] in ('OPEN','RESPONDED') for t in c['tasks']):raise HTTPException(409,'Review outstanding evidence requests first.')
        note=helpers().text_field(p,'note',2000)
        c['decisions'].append(dict(id=uid('decision'),decision=choice,note=note,evidence_ids=run['recommendation']['evidence_ids'],evidence_version=c['evidence_version'],actor=s['actor'],at=now(),stale=False))
        c['status']='RESOLVED' if choice=='RESOLVED_NO_REPAIR' else 'WAITING_EVIDENCE'
        if choice=='RESOLVED_NO_REPAIR':c['resolution']=dict(action='NO_ACTION',result=note,at=now(),synthetic=True)
        db.execute("UPDATE approvals SET status='STALE' WHERE case_id=? AND status='APPROVED'",(c['id'],))
        helpers().notify(c,note)
        investigation.emit(db,run,'decision','Record operator decision',note,run['recommendation']['evidence_ids'],choice,'Customer update or further evidence review.')
    return helpers().operation(request,p,case_id,'operator_outcome',action)


@router.get('/api/cases/{case_id}/report')
def report(case_id:str,request:Request,format:str='md'):
    s=require_staff(request)
    if format not in ('md','json'):raise HTTPException(422,'Choose md or json report.')
    with store.connect() as db:
        c=store.get_case(db,case_id);helpers().authorize(s,c,staff=True)
        runs=[investigation.get_run(db,r['id']) for r in db.execute('SELECT id FROM investigations WHERE case_id=? ORDER BY rowid',(case_id,))]
        for run in runs:run['events']=investigation.run_events(db,run['id']);run.pop('snapshot',None)
        t=payments.project(db,payments.load(db,c['transaction_id']),True) if c.get('transaction_id') else None
        data=dict(synthetic=True,case_information={k:c.get(k) for k in ('id','reference','incident_id','transaction_id','customer_name','reported_amount_minor','issue_type','owner','status','version')},
                  customer_statement=c['description'],customer_reported_context=c.get('reported_context',{}),transaction_reconstruction=t,
                  evidence_reviewed=[{k:e.get(k) for k in ('id','kind','category','reliability','authority','supplied_by','reference','event_at','received_at','scope','original_hash','revisions','transaction_id','event_id','purchase_id','amount_minor','capability','assertion','record')} for e in c['evidence']],
                  verifier_readings=[{k:a.get(k) for k in ('id','at','run_id','model','claims','assessment','verification','evidence_version','source_version')} for a in c['analyses']],
                  investigation_timeline=runs,findings=facts(c),possible_causes=runs[-1].get('hypotheses',[]) if runs else [],
                  verification_result=runs[-1].get('verification') if runs else None,recommended_action=runs[-1].get('recommendation') if runs else None,
                  operator_decisions=c['decisions'],approvals=[json.loads(r['body'])|dict(status=r['status']) for r in db.execute('SELECT body,status FROM approvals WHERE case_id=?',(case_id,))],
                  repair_results=[json.loads(r['body']) for r in db.execute('SELECT body FROM repair_attempts WHERE case_id=?',(case_id,))],
                  remaining_issues=dict(evidence_gaps=facts(c)['requirements'],remaining_duplicate_minor=facts(c)['recorded_excess_minor'],
                                        remaining_unsettled_minor=facts(c).get('remaining_unsettled_minor'),
                                        outstanding_requests=[t for t in c['tasks'] if t['status'] in ('OPEN','RESPONDED')],
                                        owner=c['owner'],next_review=c['next_review']),
                  tasks=c['tasks'],handoffs=c['handoffs'],customer_updates=c['notifications'],
                  case_history=[dict(r) for r in db.execute('SELECT * FROM audit WHERE case_id=? ORDER BY id',(case_id,))])
    if format=='json':body=json.dumps(data,ensure_ascii=False,indent=2);media='application/json'
    else:
        body='# DataUkil investigation report\n\n**Synthetic payment and sandbox correction records only.**\n'
        sections=[(key.replace('_',' ').title(),value) for key,value in data.items() if key!='synthetic']
        for title,value in sections:
            body+='\n## '+title+'\n\n'+(value if isinstance(value,str) else '```json\n'+json.dumps(value,ensure_ascii=False,indent=2)+'\n```')+'\n'
        media='text/markdown'
    return PlainTextResponse(body,media_type=media,headers={'Content-Disposition':f'attachment; filename="{c["reference"]}-v{c["version"]}.{format}"','X-Report-SHA256':hashlib.sha256(body.encode()).hexdigest()})
