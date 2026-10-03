"""Synthetic bank-to-wallet state machine. Ledger postings are always balanced."""
from datetime import datetime, timezone, timedelta
import json
from . import store
from .domain import now, uid, evidence

SCENARIOS = {
    'success': ('Successful transfer', 'One bank debit and one wallet credit.'),
    'delayed_response': ('Delayed response', 'A late confirmation arrives after an uncertain result.'),
    'stuck_processing': ('Stuck processing', 'A confirmed debit is held in the settlement queue; an explicit retry contract is available.'),
    'confirmed_failure': ('Confirmed failure', 'The partner rejects a debited transfer; checked records authorize returning the debit.'),
    'duplicate_payment': ('Verified duplicate · repair ending', 'A retry posts a second debit; one wallet credit is confirmed.'),
    'missing_partner_response': ('Missing response · handoff ending', 'A debit and retry are observed; final partner settlement remains unknown.'),
    'retry': ('Retry with one payment', 'Two requests retain one posting identity and complete once.'),
    'settlement_uncertain': ('Settlement uncertainty', 'Partner acceptance is known but final settlement cannot be established.'),
}
STAGES = ['customer','gateway','bank','queue','response','settlement','wallet']
TITLES = ['Customer initiated','MFS gateway','Bank / partner','Processing queue','Response','Settlement','upay wallet']
PURPOSES = [
    'Identify the intended amount, source account and destination wallet.',
    'Accept the request and assign one correlation identity.',
    'Record the bank debit under the exact transfer reference.',
    'Track queued processing and retry attempts without assuming another payment.',
    'Check whether the partner returned a verified outcome.',
    'Reconcile the bank posting with final settlement.',
    'Confirm the intended wallet credit or retain the unresolved outcome.',
]


def load(db, transaction_id):
    row=db.execute('SELECT body FROM transactions WHERE id=?',(transaction_id,)).fetchone()
    return json.loads(row['body']) if row else None


def save(db, t):
    db.execute('INSERT INTO transactions VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body',
               (t['id'],t['incident_id'],t['customer_id'],json.dumps(t,ensure_ascii=False)))


def postings(db,t,identity,kind,amount,source,destination,original=None):
    old=db.execute('SELECT body FROM ledger WHERE identity=?',(t['id']+':'+identity,)).fetchone()
    if old:return json.loads(old['body'])
    entry=dict(id=uid('posting'),transaction_id=t['id'],incident_id=t['incident_id'],at=now(),
               kind=kind,amount_minor=amount,postings={source:-amount,destination:amount},original_posting_id=original,synthetic=True)
    assert sum(entry['postings'].values())==0
    db.execute('INSERT INTO ledger VALUES (?,?,?,?)',(entry['id'],t['id'],t['id']+':'+identity,json.dumps(entry)))
    return entry


def ledger(db,t):
    entries=[json.loads(r['body']) for r in db.execute('SELECT body FROM ledger WHERE transaction_id=? ORDER BY rowid',(t['id'],))]
    balances=dict(t['opening_balances'])
    for entry in entries:
        for account,delta in entry['postings'].items():balances[account]=balances.get(account,0)+delta
    return dict(entries=entries,balances=balances,balanced=all(sum(e['postings'].values())==0 for e in entries))


def record(db,t,stage,status,text,capability=None,amount=None,attempt=1,**details):
    stamp=(datetime.fromisoformat(t['initiated_at'])+timedelta(seconds=t['event_count']*2)).isoformat()
    event=dict(id=uid('event'),transaction_id=t['id'],incident_id=t['incident_id'],case_id=t.get('case_id'),
               sequence=t['event_count']+1,timestamp=stamp,recorded_at=now(),stage=stage,source=stage,
               status=status,text=text,purpose=PURPOSES[STAGES.index(stage)],attempt_id=t['id']+':attempt:'+str(attempt),
               correlation_id=t['correlation_id'],retry_count=max(0,attempt-1),timeout_ms=details.pop('timeout_ms',None),
               request=dict(transaction_id=t['id'],amount_minor=t['amount_minor'],destination=t['destination_wallet']),
               response=details.pop('response',None),queue=details.pop('queue',None),related_event_ids=[t['last_event_id']] if t.get('last_event_id') else [],
               error=details.pop('error',None),synthetic=True,**details)
    e=evidence(text,'mock_pipeline',t['id'],amount,t['incident_id'],capability)
    e.update(transaction_id=t['id'],event_id=event['id'],source=stage,event_at=stamp,as_of=stamp,
             category='Confirmed System Record',reliability='Confirmed',record=event.copy())
    event['evidence']=e
    db.execute('INSERT INTO transaction_events VALUES (?,?,?,?)',(event['id'],t['id'],event['sequence'],json.dumps(event,ensure_ascii=False)))
    t['event_count']+=1;t['last_event_id']=event['id'];t['updated_at']=now()
    if t.get('case_id'):
        c=store.get_case(db,t['case_id'])
        c['version']+=1;c['updated_at']=now()
        # A new financial source event invalidates authorizations before a later source check.
        c['source_version']=t['event_count']
        for d in c['decisions']:d['stale']=True
        db.execute("UPDATE approvals SET status='STALE' WHERE case_id=? AND status='APPROVED'",(c['id'],))
        store.save_case(db,c);store.audit(db,c,'sandbox','transaction_event',event['id'])
    return event


def events(db,t):
    return [json.loads(r['body']) for r in db.execute('SELECT body FROM transaction_events WHERE transaction_id=? ORDER BY sequence',(t['id'],))]


def create(db,customer,amount,scenario,name='Demo customer',reset_of=None):
    incident=uid('incident');identifier=uid('txn')
    db.execute('INSERT INTO incidents VALUES (?,?,?,?)',(incident,customer,'transaction:'+identifier,now()))
    t=dict(id=identifier,incident_id=incident,customer_id=customer,customer_name=name,case_id=None,
           amount_minor=amount,currency='BDT',scale=2,source_account='DEMO-BANK-'+customer[-1]+'-0042',
           destination_wallet='DEMO-UPAY-'+customer[-1]+'-0187',scenario=scenario,version=1,step=0,
           state='PROCESSING',current_stage='customer',initiated_at=now(),updated_at=now(),correlation_id=uid('corr'),
           event_count=0,opening_balances={'BANK':amount*10,'WALLET':amount*2,'SUSPENSE':0},reset_of=reset_of)
    save(db,t)
    record(db,t,'customer','completed',f'Simulated bank-to-upay transfer BDT {amount/100:.2f} initiated.','transfer_intent',amount)
    save(db,t)
    return t


def advance(db,t):
    scenario=t['scenario'];amount=t['amount_minor'];step=t['step']+1
    if step>6 and not (step==7 and scenario=='delayed_response'):
        from fastapi import HTTPException
        raise HTTPException(409,'This simulation has reached its recorded outcome.')
    if step==1:
        record(db,t,'gateway','completed','Gateway request accepted and exact transaction reference matched.','gateway_accepted')
    elif step==2:
        posting=postings(db,t,'original-debit','BANK_DEBIT',amount,'BANK','SUSPENSE')
        record(db,t,'bank','completed',f'Bank posting {posting["id"]} confirms BDT {amount/100:.2f} debited.','bank_debit',amount,posting_id=posting['id'])
    elif step==3:
        retry=scenario in ('duplicate_payment','missing_partner_response','retry')
        record(db,t,'queue','attention' if scenario=='stuck_processing' else 'completed',
               'Retry request recorded under the same transaction.' if retry else 'Transfer entered the processing queue.',
               'retry_observed' if retry else 'queued',attempt=2 if retry else 1,queue={'name':'sandbox-settlement','depth':1,'held':scenario=='stuck_processing'})
        if scenario=='duplicate_payment':
            p=postings(db,t,'extra-debit','BANK_DEBIT',amount,'BANK','SUSPENSE')
            record(db,t,'bank','failure',f'A second confirmed bank debit {p["id"]} posted BDT {amount/100:.2f} for this same transfer.','bank_debit',amount,attempt=2,posting_id=p['id'],error='DUPLICATE_POSTING')
    elif step==4:
        if scenario=='confirmed_failure':
            record(db,t,'response','failure','Partner explicitly rejected the transfer after debit. A return of the unsettled debit is authorized in the sandbox contract.','return_authorized',response={'code':'REJECTED'},error='PARTNER_REJECTED')
        elif scenario in ('missing_partner_response','delayed_response','stuck_processing'):
            record(db,t,'response','unknown','Final partner response is not available. This does not establish a failed or duplicate settlement.','response_missing',timeout_ms=30000)
        else:
            record(db,t,'response','completed','Partner response accepted the exact transfer reference.','partner_accepted',response={'code':'ACCEPTED'})
    elif step==5:
        if scenario in ('success','duplicate_payment','retry'):
            record(db,t,'settlement','completed','One intended settlement is confirmed for this transfer.','settlement_confirmed',amount)
        elif scenario=='stuck_processing':
            record(db,t,'settlement','attention','The partner confirms an unsettled debit and explicitly permits one idempotent settlement retry.','settlement_retry_authorized',amount)
        elif scenario=='confirmed_failure':
            record(db,t,'settlement','failure','Partner final rejection confirms that no wallet settlement was made.','settlement_rejected',0)
        else:
            record(db,t,'settlement','unknown','Final settlement is not confirmed by the available records.','settlement_unknown')
    elif step==6:
        if scenario in ('success','duplicate_payment','retry'):
            p=postings(db,t,'intended-credit','WALLET_CREDIT',amount,'SUSPENSE','WALLET')
            record(db,t,'wallet','completed',f'Wallet posting {p["id"]} confirms one BDT {amount/100:.2f} credit.','wallet_credit',amount,posting_id=p['id'])
            t['state']='UNCERTAIN' if scenario=='duplicate_payment' else 'SUCCEEDED'
        else:
            record(db,t,'wallet','unknown' if scenario not in ('stuck_processing','confirmed_failure') else 'attention',
                   'The complete sandbox wallet query confirms no credit for this reference.' if scenario in ('stuck_processing','confirmed_failure') else 'Wallet completion remains unknown; further verification is required.',
                   'wallet_not_credited' if scenario in ('stuck_processing','confirmed_failure') else 'wallet_unknown',0)
            t['state']='FAILED' if scenario=='confirmed_failure' else 'UNCERTAIN'
        record(db,t,'bank','completed','The bank posting inventory for this exact reference is complete as of this recorded check.','bank_inventory_complete')
    elif step==7:
        record(db,t,'response','completed','A delayed matching partner confirmation has now arrived.','partner_accepted',response={'code':'LATE_ACCEPTED'})
        record(db,t,'settlement','completed','Late final settlement confirms one successful transfer.','settlement_confirmed',amount)
        p=postings(db,t,'intended-credit','WALLET_CREDIT',amount,'SUSPENSE','WALLET')
        record(db,t,'wallet','completed','The delayed transfer is now credited once to the wallet.','wallet_credit',amount,posting_id=p['id'])
        t['state']='SUCCEEDED'
    t['step']=step;t['current_stage']=STAGES[min(step,6)];t['version']+=1
    save(db,t)


def project(db,t,staff=False):
    all_events=events(db,t)
    pipeline=[]
    for stage,title in zip(STAGES,TITLES):
        matching=[e for e in all_events if e['stage']==stage]
        last=matching[-1] if matching else None
        # Do not hide an unreversed duplicate posting behind a successful inventory query.
        abnormal=next((e for e in matching if e.get('error')=='DUPLICATE_POSTING'),None)
        status='failure' if abnormal and t['state']!='CORRECTED' else last['status'] if last else 'unknown'
        pipeline.append(dict(id=stage,title=title,status=status,purpose=PURPOSES[STAGES.index(stage)],event_ids=[e['id'] for e in matching],summary=last['text'] if last else 'Not yet observed.'))
    result={k:t[k] for k in ['id','incident_id','case_id','amount_minor','currency','scale','source_account','destination_wallet','state','current_stage','initiated_at','updated_at','version','step','customer_name','reset_of']}
    result.update(pipeline=pipeline,synthetic=True,can_advance=t['step']<6 or (t['step']==6 and t['scenario']=='delayed_response'),
                  balances=ledger(db,t)['balances'],timeline=[{k:e[k] for k in ('id','timestamp','stage','status','text','purpose')} for e in all_events])
    if staff:result.update(events=all_events,ledger=ledger(db,t))
    return result


def make_case(db,t,description,issue,reported_context=None,supporting_text=''):
    existing=db.execute('SELECT case_id FROM case_incidents WHERE incident_id=?',(t['incident_id'],)).fetchone()
    if existing:return store.get_case(db,existing['case_id'])
    from .app import notify
    c=dict(id=uid('case'),reference='TF-'+uid('ref')[4:].upper(),incident_id=t['incident_id'],transaction_id=t['id'],
           customer_id=t['customer_id'],customer_name=t['customer_name'],purchase_id=t['incident_id'],qr_reference=t['id'],
           second_method='qr',issue_type=issue,description=description,reported_amount_minor=t['amount_minor'],owner='staff_1',priority='HIGH' if issue=='PAID_TWICE' else 'NORMAL',
           purchase_label='Bank → upay transfer',status='OPEN',version=1,evidence_version=1,source_version=t['event_count'],
           created_at=now(),updated_at=now(),next_review=(datetime.now(timezone.utc)+timedelta(hours=4)).isoformat(),
           evidence=[evidence(description,purchase=t['incident_id'])],analysis=None,analyses=[],checks=[],tasks=[],handoffs=[],decisions=[],notifications=[],
           messages=[dict(id=uid('msg'),at=now(),actor=t['customer_id'],role='customer',text=description)],investigation_stage='NOT_STARTED')
    c['evidence'][0].update(category='Customer Statement',supplied_by=t['customer_id'])
    c['reported_context']=reported_context or dict(transaction_reference=t['id'])
    if supporting_text:
        c['evidence'].append(evidence(supporting_text,purchase=t['incident_id']))
        c['evidence_version']+=1
    notify(c,'Your transfer complaint is saved under one incident. An operator will verify the payment records.')
    store.save_case(db,c);store.audit(db,c,t['customer_id'],'transfer_complaint')
    t['case_id']=c['id'];t['version']+=1;save(db,t)
    return c


def transfer_facts(c):
    valid=[e for e in c['evidence'] if e['kind']=='mock_pipeline' and e.get('transaction_id')==c['transaction_id'] and e['purchase_id']==c['incident_id']]
    caps={e['capability'] for e in valid}
    amounts=lambda cap:sum(e.get('amount_minor') or 0 for e in valid if e['capability']==cap)
    debit=amounts('bank_debit');credit=amounts('wallet_credit');returned=amounts('reversal_posted');expected=c['reported_amount_minor']
    missing=[]
    if 'bank_inventory_complete' not in caps:missing.append('Check the complete bank posting inventory for the exact transaction.')
    if not credit and 'wallet_not_credited' not in caps:missing.append('Obtain the final wallet outcome for the exact transaction.')
    if 'settlement_confirmed' not in caps and not caps.intersection({'settlement_retry_authorized','settlement_rejected'}):missing.append('Obtain the final partner response and settlement record.')
    excess=max(0,debit-expected-returned)
    conflict=credit>expected or debit-returned<credit
    return dict(qr_confirmed=False,qr_not_completed=False,cash_confirmed=False,purchase_total_minor=expected,
                recorded_paid_minor=debit,recorded_repaid_minor=returned,recorded_excess_minor=excess,
                requirements=missing,conflict=conflict,split_tender=False,bank_debit_minor=debit,wallet_credit_minor=credit,
                capabilities=sorted(x for x in caps if x),bank_inventory_complete='bank_inventory_complete' in caps,
                remaining_unsettled_minor=max(0,debit-returned-credit),evidence_ids=[e['id'] for e in valid])


def transfer_assessment(c):
    f=transfer_facts(c)
    if f['conflict']:status,headline='CONFLICTING','The checked postings require human review'
    elif f['requirements']:status,headline='NEEDS_EVIDENCE','Final transfer evidence is incomplete'
    elif f['recorded_repaid_minor'] and f['remaining_unsettled_minor']==0:status,headline='REPAID','The sandbox correction is verified'
    elif f['recorded_excess_minor']:status,headline='SUPPORTED','Two bank debits support a duplicate-payment discrepancy'
    elif f['wallet_credit_minor']:status,headline='NOT_SUPPORTED','One intended bank-to-upay transfer is confirmed'
    else:status,headline='NEEDS_REPAIR','An unsettled debit has an explicit sandbox repair contract'
    return dict(status=status,headline=headline,summary=headline+'. Customer statements and retries alone do not establish another debit.',
                evidence_ids=f['evidence_ids'],missing=f['requirements'],recorded_excess_minor=f['recorded_excess_minor'],
                engine='source-grounded rules and balanced sandbox ledger checks',limitations='Synthetic source records only.')
