"""Observable, durable investigation of current records, independent repair policy."""
import asyncio
import copy
import json
import os
from . import store, payments, live_ai
from .domain import now, uid, facts, assessment, fresh, current_text
from ml.features import RULES_VERSION

PHASES=[
    ('initialize','Investigator initialized','Identify the case and the operational problem.'),
    ('context','Case context loaded','Separate the customer allegation from confirmed source facts.'),
    ('reconstruct','Transaction reconstructed','Match attempts, references and correlation identities.'),
    ('retrieve','Relevant records retrieved','Obtain the available records and identify missing sources.'),
    ('follow','Processing path followed','Locate the point where the payment became uncertain.'),
    ('compare','Evidence compared','Reconcile debit, settlement and wallet or merchant records.'),
    ('verify','Claim verified','Establish whether duplicate payment is supported, contradicted or inconclusive.'),
    ('causes','Possible causes evaluated','Update hypotheses from supporting, contradicting and unresolved evidence.'),
    ('eligibility','Repair eligibility checked','Determine whether a supported action is authorized by backend rules.'),
    ('recommend','Recommendation generated','Present an evidence-cited proposal and its constraints.'),
    ('decision','Operator decision required','Require approval or an owned handoff; investigation completion is not resolution.'),
]
TERMINAL={'COMPLETE','NEEDS_HUMAN_REVIEW','STALE','INTERRUPTED','SUPERSEDED','FAILED'}


def get_run(db,identifier):
    row=db.execute('SELECT body,status FROM investigations WHERE id=?',(identifier,)).fetchone()
    return (json.loads(row['body'])|dict(status=row['status'])) if row else None


def save_run(db,run):
    db.execute('INSERT INTO investigations VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET status=excluded.status,body=excluded.body',
               (run['id'],run['case_id'],run['status'],json.dumps(run,ensure_ascii=False)))
    for h in run.get('hypotheses',[]):
        db.execute('INSERT INTO hypotheses VALUES (?,?,?) ON CONFLICT(run_id,id) DO UPDATE SET body=excluded.body',(run['id'],h['id'],json.dumps(h,ensure_ascii=False)))


def run_events(db,run_id,after=0):
    return [json.loads(r['body']) for r in db.execute('SELECT body FROM investigation_events WHERE run_id=? AND sequence>? ORDER BY sequence',(run_id,after))]


def emit(db,run,phase,action,finding,ids=None,changed='',next_step='',state='completed',hypotheses=None):
    sequence=run.get('sequence',0)+1
    phase_info=next(x for x in PHASES if x[0]==phase)
    revisions={e['id']:e['revisions'][-1]['version'] for e in run.get('snapshot',{}).get('evidence',[])+run.get('resolution_evidence',[])}
    event=dict(sequence=sequence,id=uid('trace'),run_id=run['id'],case_id=run['case_id'],incident_id=run['incident_id'],
               timestamp=now(),phase=phase,title=phase_info[1],purpose=phase_info[2],action=action,finding=finding,
               evidence_ids=ids or [],evidence_revisions={i:revisions[i] for i in (ids or []) if i in revisions},
               changed=changed or finding,next_step=next_step,state=state,record_category='Derived Observation',
               uncertainty='Evidence incomplete' if run.get('verification')=='INCONCLUSIVE' else 'Scoped to checked synthetic records',
               hypotheses=copy.deepcopy(hypotheses) if hypotheses is not None else None)
    db.execute('INSERT INTO investigation_events VALUES (?,?,?)',(run['id'],sequence,json.dumps(event,ensure_ascii=False)))
    run.update(sequence=sequence,current_phase=phase,current_finding=finding,updated_at=now())
    save_run(db,run)
    return event


def recover():
    with store.transaction() as db:
        for row in db.execute("SELECT id FROM investigations WHERE status='RUNNING'").fetchall():
            run=get_run(db,row['id']);run.update(status='INTERRUPTED',error='Server restarted. Restart analysis explicitly.')
            save_run(db,run)
            c=store.get_case(db,run['case_id'])
            if c and c.get('current_run_id')==run['id']:
                c['status']='OPEN';c['investigation_stage']='INTERRUPTED';c['version']+=1
                store.save_case(db,c);store.audit(db,c,'system','investigation_interrupted',run['id'])


def verification(c):
    f=facts(c)
    if f['conflict'] or f['requirements']:return 'INCONCLUSIVE'
    if c.get('transaction_id'):
        if f['recorded_paid_minor']>c['reported_amount_minor']:return 'SUPPORTS_CLAIM'
        if c.get('issue_type')=='STUCK_TRANSFER' and not f['wallet_credit_minor'] and f['remaining_unsettled_minor']:return 'SUPPORTS_CLAIM'
        return 'CONTRADICTS_CLAIM'
    if f['purchase_total_minor'] is not None and f['recorded_paid_minor']>f['purchase_total_minor']:return 'SUPPORTS_CLAIM'
    return 'CONTRADICTS_CLAIM'


def hypotheses(c):
    f=facts(c);es=c['evidence']
    ids=lambda *caps:[e['id'] for e in es if e.get('capability') in caps and e['kind'].startswith('mock_')]
    def hypothesis(identifier,title,description,status,support,contradict,unresolved):
        return dict(id=identifier,title=title,description=description,status=status,supporting_evidence=support,
                    contradicting_evidence=contradict,unresolved_evidence=unresolved)
    if c.get('transaction_id'):
        caps=set(f['capabilities']);duplicate=f['recorded_paid_minor']>c['reported_amount_minor']
        settled=f['wallet_credit_minor']==c['reported_amount_minor'] and 'settlement_confirmed' in caps
        return [
            hypothesis('partner_timeout','Partner response delayed / missing','A response was unavailable when the path was first checked.',
                'SUPPORTED' if 'response_missing' in caps else 'CONTRADICTED' if 'partner_accepted' in caps else 'UNRESOLVED',
                ids('response_missing'),ids('partner_accepted') if 'response_missing' not in caps else [],[] if settled else ['Obtain final partner confirmation.']),
            hypothesis('duplicate_debit','Retry produced an additional debit','Two financial postings, rather than two request events, establish the discrepancy.',
                'SUPPORTED' if duplicate else 'CONTRADICTED' if f['bank_inventory_complete'] else 'UNRESOLVED',
                ids('bank_debit') if duplicate else [],ids('bank_inventory_complete','bank_debit') if not duplicate and f['bank_inventory_complete'] else [],
                [] if f['bank_inventory_complete'] else ['Check the complete bank posting inventory.']),
            hypothesis('settlement_complete','Intended settlement completed','A settlement and the corresponding wallet credit establish completion.',
                'SUPPORTED' if settled else 'CONTRADICTED' if 'settlement_rejected' in caps else 'UNRESOLVED',
                ids('settlement_confirmed','wallet_credit') if settled else [],ids('settlement_rejected'),[] if settled else f['requirements']),
            hypothesis('retry_idempotent','Retry retained one posting','Multiple requests can share one successful financial posting.',
                'CONTRADICTED' if duplicate else 'SUPPORTED' if settled and 'retry_observed' in caps and f['bank_inventory_complete'] else 'UNRESOLVED',
                ids('retry_observed','bank_inventory_complete') if settled and not duplicate else [],ids('bank_debit') if duplicate else [],[] if settled else ['Compare all attempt and posting identities.']),
            hypothesis('unsettled_debit','Debit remains unsettled','A complete negative wallet query and an explicit partner contract permit a bounded correction.',
                'SUPPORTED' if f['remaining_unsettled_minor'] and caps.intersection({'return_authorized','settlement_retry_authorized'}) else 'CONTRADICTED' if settled and not duplicate else 'UNRESOLVED',
                ids('wallet_not_credited','return_authorized','settlement_retry_authorized'),ids('wallet_credit') if settled and not duplicate else [],f['requirements']),
        ]
    duplicate=f['purchase_total_minor'] is not None and f['recorded_paid_minor']>f['purchase_total_minor']
    return [
        hypothesis('cash_received','Merchant received the reported cash','A customer receipt needs independent merchant corroboration.',
                   'SUPPORTED' if f['cash_confirmed'] else 'UNRESOLVED',ids('cash_received'),[],[] if f['cash_confirmed'] else ['Merchant confirmation of cash.']),
        hypothesis('duplicate_payment','Payments exceed this purchase total','Matching confirmed tenders must exceed the invoice, excluding split tender.',
                   'SUPPORTED' if duplicate and not f['requirements'] and not f['conflict'] else 'CONTRADICTED' if not f['requirements'] and not f['conflict'] else 'UNRESOLVED',
                   ids('qr_completed','cash_received','purchase_total') if duplicate else [],ids('qr_not_completed') if not duplicate else [],f['requirements']),
        hypothesis('repayment_complete','Repayment covered the excess','A resolution request does not establish returned money.',
                   'SUPPORTED' if f['recorded_repaid_minor'] and f['recorded_excess_minor']==0 else 'UNRESOLVED',
                   ids('repayment_completed'),[],[] if f['recorded_repaid_minor'] else ['Check completed repayment source.']),
    ]


def policy(db,c):
    f=facts(c);ids=f.get('evidence_ids') or [e['id'] for e in c['evidence'] if e['kind'].startswith('mock_')]
    base=dict(eligible=False,authorization='Repair Not Authorized',action='MANUAL_REVIEW',amount_minor=0,evidence_ids=ids,
              reason='Available evidence does not authorize an automatic correction.',missing=f['requirements'],
              risk='Synthetic sandbox only; exact posting identity, current evidence and operator approval required.',approval_required=True,
              team='Partner Operations',next_action='Verify the missing source records and retain an accountable owner.')
    if not c.get('transaction_id'):
        base.update(reason='Legacy evidence has no mapped sandbox postings. Use the existing evidence request or handoff workflow.',
                    missing=f['requirements'] or ['Map the confirmed source records to a valid sandbox posting contract.'])
        return base
    t=payments.load(db,c['transaction_id'])
    if not t or f['conflict'] or f['requirements']:return base
    ledger=payments.ledger(db,t)
    debit=sum(e['amount_minor'] for e in ledger['entries'] if e['kind']=='BANK_DEBIT')
    credit=sum(e['amount_minor'] for e in ledger['entries'] if e['kind']=='WALLET_CREDIT')
    reversed_amount=sum(e['amount_minor'] for e in ledger['entries'] if e['kind'] in ('REVERSAL','CORRECTION'))
    if not ledger['balanced'] or (debit,credit,reversed_amount)!=(f['recorded_paid_minor'],f['wallet_credit_minor'],f['recorded_repaid_minor']):
        base['reason']='Checked evidence and the current sandbox ledger do not reconcile.';return base
    caps=set(f['capabilities'])
    if f['recorded_excess_minor'] and credit==t['amount_minor'] and 'settlement_confirmed' in caps:
        base.update(action='REVERSE_DUPLICATE_DEBIT',amount_minor=f['recorded_excess_minor'],reason='Two exact bank postings and one wallet credit establish the extra debit.')
    elif 'settlement_retry_authorized' in caps and 'wallet_not_credited' in caps and debit==t['amount_minor'] and credit==0 and not reversed_amount:
        base.update(action='RETRY_SETTLEMENT',amount_minor=debit,reason='The partner explicitly authorizes one idempotent retry and a complete wallet query confirms no credit.')
    elif 'return_authorized' in caps and 'settlement_rejected' in caps and credit==0 and debit==t['amount_minor'] and not reversed_amount:
        base.update(action='SIMULATED_CORRECTION',amount_minor=debit,reason='Final partner rejection and a complete negative wallet query authorize return of the unsettled debit.')
    else:
        base.update(action='NO_ACTION',approval_required=False,reason='No eligible discrepancy remains in the checked sandbox records.',next_action='Record a cited human review of the verified outcome.')
        return base
    if any(t['status'] in ('OPEN','RESPONDED') for t in c['tasks']):
        base['reason']='Review outstanding evidence requests before authorizing a correction.';return base
    base.update(eligible=True,authorization='Eligible',missing=[],team='Settlement Operations',next_action='Operator reviews and approves this exact sandbox action.')
    return base


def current_eligibility(db,c,run):
    result=policy(db,c)
    if (not run or run['status'] not in ('COMPLETE','NEEDS_HUMAN_REVIEW') or
        c.get('current_run_id')!=run['id'] or not fresh(c) or
        c.get('source_version',0)!=run.get('source_version',0) or
        c['evidence_version']!=run.get('evidence_version') or c.get('resolution') or
        c['owner']!=run.get('owner_at_start',run.get('snapshot',{}).get('owner',c['owner']))):
        result.update(eligible=False,authorization='Repair Not Authorized',reason='Analysis is stale, interrupted, superseded or already resolved. Analyze current records again.')
    return result


def collect(db,c):
    checked=[]
    if c.get('transaction_id'):
        t=payments.load(db,c['transaction_id'])
        source_events=payments.events(db,t)
        for stage in payments.STAGES:
            records=[e['evidence'] for e in source_events if e['stage']==stage]
            for e in records:
                if not any(saved['id']==e['id'] for saved in c['evidence']):
                    c['evidence'].append(copy.deepcopy(e));c['evidence_version']+=1
            checked.append(dict(id=uid('check'),kind=stage,requested_at=now(),as_of=now(),state='COMPLETED' if records else 'UNAVAILABLE',
                                result=f'{len(records)} matching source record(s) inspected.' if records else 'No source record available; no financial conclusion follows.',
                                evidence_ids=[e['id'] for e in records],scope='Exact transaction and incident only',
                                states=[dict(state='RUNNING',at=now()),dict(state='COMPLETED' if records else 'UNAVAILABLE',at=now())]))
        c['source_version']=t['event_count']
    else:
        for kind in ('qr','invoice','merchant','repayment'):
            if c.get('simulation_id'):
                from .simulation import check_source
                value=check_source(db,c,kind)
            else:
                matching=[e for e in c['evidence'] if e['kind']=={'qr':'mock_payment','invoice':'mock_invoice','merchant':'mock_merchant','repayment':'mock_repayment'}[kind]]
                value=dict(state='COMPLETED' if matching else 'UNAVAILABLE',result='Current visible source records inspected.' if matching else 'Source evidence is unavailable.',evidence_ids=[e['id'] for e in matching])
            checked.append(dict(id=uid('check'),kind=kind,requested_at=now(),as_of=now(),scope='Exact purchase only',states=[dict(state=value['state'],at=now())],**value))
    c['checks'].extend(checked);c['version']+=1;c['updated_at']=now()
    store.save_case(db,c);store.audit(db,c,'investigator','records_retrieved',json.dumps([ch['id'] for ch in checked]))
    return checked


async def execute_run(run_id):
    delay=float(os.environ.get('TRACEFIX_PHASE_DELAY','0.35'))
    def update(phase,action,finding,ids=None,changed='',state='completed',hs=None):
        with store.transaction() as db:
            run=get_run(db,run_id)
            if run['status']!='RUNNING':raise asyncio.CancelledError()
            c=store.get_case(db,run['case_id'])
            c['investigation_stage']=phase;store.save_case(db,c)
            index=next(i for i,p in enumerate(PHASES) if p[0]==phase)
            emit(db,run,phase,action,finding,ids,changed,PHASES[min(index+1,len(PHASES)-1)][1],state,hs)
        return run
    try:
        with store.connect() as db:run=get_run(db,run_id);c=store.get_case(db,run['case_id'])
        update('initialize','Start an observable investigation','One existing incident and case selected; no additional case created.')
        await asyncio.sleep(delay)
        update('context','Load the saved complaint, owner and evidence','Customer statement preserved separately from confirmed system records.',[e['id'] for e in c['evidence'] if not e['kind'].startswith('mock_')])
        await asyncio.sleep(delay)
        update('reconstruct','Match transaction, purchase and attempt identities','Exact references define the scope. Equal amounts alone do not link payments.')
        await asyncio.sleep(delay)
        update('retrieve','Query the scoped synthetic sources','Retrieving the records available for this incident; no financial conclusion has been made.',state='active')
        with store.transaction() as db:
            run=get_run(db,run_id)
            if run['status']!='RUNNING':return
            c=store.get_case(db,run['case_id']);checks=collect(db,c)
            run.update(snapshot=copy.deepcopy(c),evidence_version=c['evidence_version'],source_version=c.get('source_version',0),
                       evidence_count=len(c['evidence']),source_checks=checks)
            save_run(db,run)
        es=c['evidence'];ids=[e['id'] for e in es]
        update('retrieve','Retrieve matching source records',f'{len(es)} distinct records available; {sum(ch["state"]=="UNAVAILABLE" for ch in checks)} source checks unavailable.',ids)
        await asyncio.sleep(delay)
        abnormal=[e for e in es if e.get('capability') in ('response_missing','retry_observed','settlement_unknown','return_authorized')]
        update('follow','Follow the observed processing path',('; '.join(current_text(e) for e in abnormal[:3])) or 'The available path has no unresolved response anomaly.',[e['id'] for e in abnormal])
        await asyncio.sleep(delay)
        from .verifier import verifier
        definitions=([('debit','The bank account was debited.'),('duplicate','Two bank debits occurred for the same transfer.'),('wallet','The wallet received the intended transfer.'),('repayment','The extra debit was reversed.')]
                     if c.get('transaction_id') else [('qr','The QR payment completed.'),('cash','A cash payment was received.' if c['second_method']=='cash' else 'A second QR payment completed.'),('same','Both payments are for the same purchase.'),('repayment','Repayment completed.')])
        definitions=[(key,c.get('claim_overrides',{}).get(key,{}).get('text',text)) for key,text in definitions]
        update('compare','Run the trained claim/passage verifier','Comparing wording with the trained advisory verifier and reconciling authoritative amounts independently.',ids,state='active')
        pairs=[(text,current_text(e)) for _,text in definitions for e in es]
        predictions=await asyncio.to_thread(verifier.predict,pairs)
        claims=[];position=0
        for key,text in definitions:
            links=[]
            for e in es:
                prediction=predictions[position];position+=1
                mismatch=e.get('purchase_id') not in (None,c['purchase_id'])
                links.append(dict(evidence_id=e['id'],excerpt=current_text(e),transcript_version=e['revisions'][-1]['version'],
                                  source_status=e['authority'],mismatches=['Exact purchase mismatch.'] if mismatch else [],
                                  **(prediction|dict(label='INSUFFICIENT_EVIDENCE') if mismatch else prediction)))
            claims.append(dict(id=key,text=text,links=links))
        f=facts(c)
        update('compare','Compare postings and assess claim/passage wording',
               f'Checked payments: BDT {f["recorded_paid_minor"]/100:.2f}; returned: BDT {f["recorded_repaid_minor"]/100:.2f}. Trained text readings remain advisory.',ids)
        await asyncio.sleep(delay)
        verdict=verification(c)
        with store.transaction() as db:
            run=get_run(db,run_id);run['verification']=verdict;save_run(db,run)
        update('verify','Verify the reported payment issue',verdict.replace('_',' ')+'. '+assessment(c)['headline'],ids)
        await asyncio.sleep(delay)
        hs=hypotheses(c)
        # Hypotheses appear individually, retaining every unresolved possibility.
        for h in hs:
            update('causes','Evaluate '+h['title'],h['status']+': '+h['description'],h['supporting_evidence']+h['contradicting_evidence'],state='attention' if h['status']=='UNRESOLVED' else 'completed',hs=hs[:hs.index(h)+1])
            await asyncio.sleep(delay)
        with store.connect() as db:recommendation=policy(db,c)
        with store.connect() as db:run=get_run(db,run_id)
        provider=dict(available=False,error='Demo mode explicitly selected.',model=None)
        if run['requested_mode']=='live':
            update('causes','Request a bounded local AI assessment','Local Qwen is evaluating reviewed evidence. Its proposals cannot authorize repairs.',ids,state='active')
            provider=await live_ai.assess(c,hs,verdict,recommendation['action'])
        with store.transaction() as db:
            run=get_run(db,run_id)
            if run['status']!='RUNNING':return
            run['provider']=provider
            run['mode']='LIVE' if provider['available'] else 'DEMO'
            run['mode_label']='LIVE AI INVESTIGATION' if provider['available'] else 'DEMO INVESTIGATION — SIMULATED AI TRACE'
            if provider['available']:
                order=provider['assessment']['hypothesis_order']
                hs.sort(key=lambda h:order.index(h['id']) if h['id'] in order else len(order))
            run['hypotheses']=hs;save_run(db,run)
            if not provider['available']:
                emit(db,run,'causes','Use deterministic evidence assessment',provider['error'],ids,'Mode explicitly changed to demo investigation.','Check backend eligibility.',state='attention')
            elif provider.get('blocked_action'):
                emit(db,run,'causes','Block unsupported model proposal','The model proposed '+provider['blocked_action']+' but checked facts authorize '+recommendation['action']+'.',provider['assessment']['evidence_ids'],
                     'Model proposal blocked. Backend policy remains authoritative.','Check backend eligibility.',state='attention')
        update('eligibility','Check backend eligibility and permissions',recommendation['authorization']+': '+recommendation['reason'],recommendation['evidence_ids'],state='completed' if recommendation['eligible'] else 'attention')
        await asyncio.sleep(delay)
        update('recommend','Generate a cited operator recommendation',recommendation['action'].replace('_',' ')+'. '+recommendation['next_action'],recommendation['evidence_ids'])
        await asyncio.sleep(delay)
        with store.transaction() as db:
            run=get_run(db,run_id)
            if run['status']!='RUNNING':return
            current=store.get_case(db,c['id'])
            stale=current['evidence_version']!=c['evidence_version'] or current.get('source_version',0)!=c.get('source_version',0)
            if not stale:recommendation=policy(db,current)
            recommendation.update(id=uid('recommendation'),run_id=run_id,case_id=c['id'],incident_id=c['incident_id'],at=now())
            if stale:recommendation.update(eligible=False,authorization='Repair Not Authorized',reason='New evidence or source records arrived during this run. Analyze again.')
            run.update(status='STALE' if stale else 'COMPLETE' if recommendation['eligible'] or verdict=='CONTRADICTS_CLAIM' else 'NEEDS_HUMAN_REVIEW',
                       recommendation=recommendation,hypotheses=hs,completed_at=now(),strength='Strong within checked source scope' if not f['requirements'] and not f['conflict'] else 'Insufficient / incomplete coverage')
            a=dict(id=uid('analysis'),run_id=run_id,at=now(),evidence_version=c['evidence_version'],source_version=c.get('source_version',0),
                   model=verifier.identity(),claims=claims,assessment=assessment(c),verification=verdict,unresolved=f['requirements'],rules_version=RULES_VERSION)
            if not stale:
                current['analysis']=a;current['analyses'].append(a)
                current['status']='REPAIR_ELIGIBLE' if recommendation['eligible'] else 'WAITING_EVIDENCE' if verdict=='INCONCLUSIVE' or any(t['status'] in ('OPEN','RESPONDED') for t in current['tasks']) else 'REVIEWED'
                current['investigation_stage']='decision'
                summary=assessment(c)['headline']
                from .localization import verified_headline
                bangla=verified_headline(c,assessment(c))
                current['last_verified_update']=dict(at=now(),text=summary,text_bn=bangla)
                current['notifications'].append(dict(at=now(),text=summary,text_bn=bangla))
            current['version']+=1;current['updated_at']=now();store.save_case(db,current)
            db.execute('INSERT INTO recommendations VALUES (?,?,?,?)',(recommendation['id'],run_id,c['id'],json.dumps(recommendation,ensure_ascii=False)))
            emit(db,run,'decision','Require an operator decision','New evidence requires another analysis.' if stale else 'Investigation finished. The payment is resolved only after a verified outcome or correction.',recommendation['evidence_ids'],
                 'Operator approval required.' if recommendation['eligible'] else 'Human review or evidence follow-up required.','Approve, reject, record review or hand off.',state='attention')
            store.audit(db,current,'investigator','investigation_completed',run_id)
    except asyncio.CancelledError:
        with store.transaction() as db:
            run=get_run(db,run_id)
            if run and run['status']=='RUNNING':
                run.update(status='INTERRUPTED',error='Investigation interrupted; restart explicitly.');save_run(db,run)
        raise
    except Exception as error:
        with store.transaction() as db:
            run=get_run(db,run_id)
            if run:
                run.update(status='FAILED',error=type(error).__name__+': investigation could not complete.');save_run(db,run)
                c=store.get_case(db,run['case_id']);c['status']='OPEN';c['investigation_stage']='FAILED';c['version']+=1
                store.save_case(db,c);store.audit(db,c,'system','investigation_failed',run['error'])
