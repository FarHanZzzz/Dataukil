"""Reproduce both master endings with real trained inference and optional local Qwen."""
import argparse
import hashlib
import io
import json
import os
from pathlib import Path
import sys
import time
import uuid
from datetime import datetime, timezone
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from fastapi.testclient import TestClient
from tracefix.app import app
from tracefix import store


def run(live=False):
    store.DB_PATH=ROOT/'runtime'/('master-walkthrough-'+uuid.uuid4().hex+'.sqlite3')
    os.environ['TRACEFIX_PHASE_DELAY']='0.03'
    summary=dict(at=datetime.now(timezone.utc).isoformat(),synthetic=True,database=str(store.DB_PATH),real_trained_verifier=True,journeys=[])
    with TestClient(app) as client:
        tokens={role:client.post('/api/session',json={'role':role}).json()['token'] for role in ('customer','staff','other_staff')}
        def req(path,body=None,role='staff',expected=(200,202)):
            headers={'X-TraceFix-Session':tokens[role],'Idempotency-Key':uuid.uuid4().hex}
            response=client.get('/api'+path,headers=headers) if body is None else client.post('/api'+path,json=body,headers=headers)
            assert response.status_code in expected,(path,response.status_code,response.text)
            return response
        def get(path,role='staff'):return req(path,role=role).json()
        def change(cid,action,body=None,role='staff',expected=(200,202)):
            return req('/cases/'+cid+'/'+action,dict(version=get('/cases/'+cid,role)['version'],**(body or {})),role,expected)
        for scenario,mode in [('duplicate_payment','live' if live else 'demo'),('missing_partner_response','demo')]:
            t=req('/transactions',dict(amount_minor=100000,scenario=scenario,customer_name='Nadia — fictional QA'),role='customer').json()
            for _ in range(6):t=req('/transactions/'+t['id']+'/advance',dict(version=t['version']),role='customer').json()
            result=req('/transactions/'+t['id']+'/complaint',dict(version=t['version'],issue_type='PAID_TWICE',description='Please verify this ৳1,000 transfer and all exact postings.',
                       merchant_information='Fictional recipient wallet',approximate_time='03 October 2026, Bangladesh time',supporting_text='Customer screenshot wording: payment confirmation unclear.'),role='customer').json()
            cid=result['case']['id']
            if scenario=='duplicate_payment':
                image=io.BytesIO();Image.new('RGB',(180,90),'white').save(image,format='PNG');original=image.getvalue()
                uploaded=client.post('/api/cases/'+cid+'/upload',files={'file':('synthetic-receipt.png',original,'image/png')},
                          data={'version':str(result['case']['version']),'transcript':'Human transcript: synthetic transfer ৳1,000; result unclear.'},
                          headers={'X-TraceFix-Session':tokens['customer'],'Idempotency-Key':uuid.uuid4().hex})
                assert uploaded.status_code==200
                eid=uploaded.json()['evidence_receipts'][-1]['id']
                assert req('/evidence/'+eid+'/file',role='customer').content==original
            start=change(cid,'investigations',dict(mode=mode)).json()
            deadline=time.monotonic()+110
            while True:
                investigation=get('/investigations/'+start['id'])
                if investigation['status']!='RUNNING':break
                assert time.monotonic()<deadline,'Investigation did not finish.'
                time.sleep(.12)
            assert investigation['status'] not in ('FAILED','INTERRUPTED'),investigation
            case=get('/cases/'+cid)
            assert case['analysis']['model']['available'] is True,case['analysis']['model']
            advisory=case['analysis']['model']['engine']
            assert all(e['purpose'] and e['action'] and e['finding'] and e['changed'] and e['next_step'] for e in investigation['events'])
            assert set(e['phase'] for e in investigation['events'])==set(p['id'] for p in investigation['phases'])
            if scenario=='duplicate_payment':
                assert investigation['verification']=='SUPPORTS_CLAIM' and investigation['eligibility']['action']=='REVERSE_DUPLICATE_DEBIT'
                approval=change(cid,'approvals',dict(run_id=start['id'],note='Two bank debits and one intended wallet credit authorize returning exactly the extra debit.')).json()['approval']
                case=change(cid,'repairs/execute',dict(approval_id=approval['id'])).json()
                assert case['status']=='RESOLVED' and case['facts']['recorded_excess_minor']==case['facts']['remaining_unsettled_minor']==0
                entries=get('/transactions/'+t['id'])['ledger']['entries']
                assert len(entries)==4 and sum(e['kind']=='REVERSAL' for e in entries)==1
                assert get('/cases/'+cid,'customer')['last_verified_update']['text_bn']
            else:
                assert investigation['verification']=='INCONCLUSIVE' and not investigation['eligibility']['eligible']
                change(cid,'approvals',dict(note='Unsupported approval must be rejected.'),expected=(409,))
                case=change(cid,'handoff',dict(destination='staff_2',team='Partner Operations',priority='HIGH',
                           reason='Final response, wallet outcome and settlement evidence are incomplete.',next_action='Retrieve exact final partner and wallet confirmation.')).json()
                assert case['owner']=='staff_1'
                case=change(cid,'acknowledge',{},role='other_staff').json()
                assert case['owner']=='staff_2' and not case.get('resolution')
            transaction=get('/transactions/'+t['id'])
            assert transaction['ledger']['balanced']
            with store.connect() as db:before=list(db.iterdump())
            get('/investigations/'+start['id']);get('/investigations/'+start['id']+'/events?after=2')
            report=req('/cases/'+cid+'/report?format=json')
            markdown=req('/cases/'+cid+'/report?format=md')
            assert markdown.headers['x-report-sha256']==hashlib.sha256(markdown.content).hexdigest()
            with store.connect() as db:assert before==list(db.iterdump()),'Replay/report mutated financial or case state.'
            assert report.json()['transaction_reconstruction']['ledger']==transaction['ledger']
            reset=req('/demo/scenarios/'+t['id']+'/reset',{}).json()
            assert reset['incident_id']!=t['incident_id'] and get('/transactions/'+t['id'])==transaction
            final_run=get('/investigations/'+start['id'])
            summary['journeys'].append(dict(scenario=scenario,case_id=cid,case_reference=case['reference'],transaction_id=t['id'],run_id=start['id'],
                 case_status=case['status'],owner=case['owner'],transaction_state=transaction['state'],verification=investigation['verification'],
                 actual_ai_mode=final_run['mode'],provider=final_run.get('provider'),verifier=advisory,
                 financial_balances=transaction['ledger']['balances'],ledger_balanced=True,posting_count=len(transaction['ledger']['entries']),
                 event_count=len(final_run['events']),phase_count=len(final_run['phases']),replay_immutable=True,isolated_reset=True,
                 remaining_issues=report.json()['remaining_issues']))
            (ROOT/'artifacts'/('master-'+scenario+'-report.json')).write_text(report.text,encoding='utf-8')
            (ROOT/'artifacts'/('master-'+scenario+'-report.md')).write_text(markdown.text,encoding='utf-8')
    (ROOT/'artifacts'/'master_walkthrough.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(summary,ensure_ascii=True,indent=2))


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--live',action='store_true',help='Attempt bounded local Qwen for the supported duplicate case.')
    run(parser.parse_args().live)
