"""Reproduce the mobile case journey through real artifact-backed inference."""
from pathlib import Path
import sys
import json
import uuid
from datetime import datetime, timezone, timedelta

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from fastapi.testclient import TestClient
from tracefix import store
from tracefix.app import app


def run():
    store.DB_PATH=ROOT/'runtime'/('mobile-walkthrough-'+uuid.uuid4().hex+'.sqlite3')
    serial=0;tokens={};stages=[]
    with TestClient(app) as client:
        for role in ('customer','staff','other_staff'):
            tokens[role]=client.post('/api/session',json={'role':role}).json()['token']
        def request(role,path,body=None):
            nonlocal serial
            serial+=1
            headers={'X-TraceFix-Session':tokens[role],'Idempotency-Key':f'walkthrough-{serial}'}
            result=client.get('/api'+path,headers=headers) if body is None else client.post('/api'+path,json=body,headers=headers)
            if result.status_code!=200:raise RuntimeError(f'{path}: {result.status_code}: {result.text}')
            return result.json()
        def change(action,body=None,role='staff'):
            current=request(role,'/cases/'+case_id)
            return request(role,'/cases/'+case_id+'/'+action,{'version':current['version'],**(body or {})})
        sim=request('customer','/simulations',dict(customer_name='Nadia (fictional)',merchant='Campus Bookshop',item='Study notebooks',total_minor=72550,qr_amount_minor=72550,profile='confirmed'))
        for action,extra in [('attempt_qr',{}),('pay_cash',{'amount_minor':72550}),('refresh_qr',{})]:
            sim=request('customer','/simulations/'+sim['id']+'/action',dict(version=sim['version'],action=action,**extra))
            stages.append(sim['stage'])
        complaint=request('customer','/simulations/'+sim['id']+'/complaint',dict(version=sim['version'],description='The QR response was unclear. I then paid BDT 725.50 cash for the same notebooks. Please check both payments.',receipt_text='Supplied handwritten receipt: cash BDT 725.50.'))
        sim=complaint['simulation'];case_id=complaint['case']['id']
        initial=change('analyze')
        assert initial['analysis']['assessment']['status']=='NEEDS_EVIDENCE'
        due=(datetime.now(timezone.utc)+timedelta(hours=24)).isoformat()
        task=change('task',dict(question='Please share the cash receipt reference.',audience='customer',next_review=due))['tasks'][-1]
        reply=change('messages',dict(text='The receipt reference is CASH-NADIA-17, for this same purchase.',task_id=task['id']),role='customer')
        assert not reply['analysis_fresh']
        change('messages',dict(text='Thank you. I will check the exact provider, invoice and merchant records.'))
        for kind in ('qr','invoice','merchant'):change('check',dict(kind=kind))
        supported=change('analyze')
        assert supported['analysis']['assessment']['status']=='SUPPORTED'
        assert supported['facts']['recorded_excess_minor']==72550
        current=request('staff','/cases/'+case_id)
        t=next(t for t in current['tasks'] if t['id']==task['id'])
        change('resolve-task',dict(task_id=t['id'],evidence_id=t['response_evidence_id'],reason='Customer response reviewed; independent matching source records establish the payment facts.'))
        handoff=change('handoff',dict(destination='staff_2',reason='Review the supported resolution request and completed source outcome.'))
        assert handoff['owner']=='staff_1'
        assert change('acknowledge',role='other_staff')['owner']=='staff_2'
        change('repayment-request',dict(note='Resolution review requested based on the matching purchase records.'),role='other_staff')
        request('other_staff','/simulations/'+sim['id']+'/repayment',{'version':sim['version']})
        assert request('staff','/cases/'+case_id)['facts']['recorded_repaid_minor']==0
        change('check',{'kind':'repayment'},role='other_staff')
        repaid=change('analyze',role='other_staff')
        assert repaid['analysis']['assessment']['status']=='REPAID'
        record=next(e for e in repaid['evidence'] if e['capability']=='repayment_completed')
        final=change('decision',dict(decision='OUTCOME_RECORDED',note='The checked fictional source records BDT 725.50 returned against this purchase.',evidence_ids=[record['id']]),role='other_staff')
        customer=request('customer','/cases/'+case_id)
        assert customer['status']=='OUTCOME_RECORDED' and customer['owner']=='staff_2'
        readings=[dict(claim=claim['text'],passage=l['excerpt'],label=l['label'],learned_label=l.get('learned_label'),engine=l['engine'],source_status=l['source_status']) for claim in repaid['analysis']['claims'] for l in claim['links']]
        result=dict(synthetic=True,observed_at=datetime.now(timezone.utc).isoformat(),simulation_stages=stages,
                    assessments=[initial['analysis']['assessment']['status'],supported['analysis']['assessment']['status'],repaid['analysis']['assessment']['status']],
                    final_status=final['status'],owner=final['owner'],facts=final['facts'],messages=len(final['messages']),source_checks=len(final['checks']),
                    model=repaid['analysis']['model'],text_readings=readings,customer_projection_verified=True,
                    limitations='One actual-inference synthetic integration rehearsal; no independent human/real-case accuracy validation.')
        destination=ROOT/'artifacts'/'mobile_walkthrough.json'
        destination.write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
        print(json.dumps({k:v for k,v in result.items() if k not in ('model','text_readings')},ensure_ascii=False,indent=2))
        print('Model:',result['model']['engine'],'available:',result['model']['available'])
        print('Saved:',destination)


if __name__=='__main__':run()
