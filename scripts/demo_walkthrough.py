"""Reproducible four-journey API demonstration with actual inference and isolated DB."""
from pathlib import Path
import sys
import os
import json
import time
import uuid
from datetime import datetime,timezone,timedelta

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
os.environ['TRACEFIX_DB']=str(ROOT/'runtime'/('walkthrough-'+uuid.uuid4().hex[:8]+'.sqlite3'))
from fastapi.testclient import TestClient
from tracefix.app import app


def run():
    path=ROOT/'artifacts'/'dossiers';path.mkdir(parents=True,exist_ok=True)
    report=dict(synthetic=True,actual_artifact_inference=True,database=os.environ['TRACEFIX_DB'],journeys=[])
    with TestClient(app) as client:
        def login(role):
            assert client.post('/api/session',json={'role':role}).status_code==200
        def get(n):return client.get(f'/api/cases/case_{n}').json()
        def post(n,action,**payload):
            c=get(n);r=client.post(f'/api/cases/case_{n}/{action}',json={'version':c['version'],**payload},headers={'Idempotency-Key':str(uuid.uuid4())})
            if r.status_code!=200:raise RuntimeError(r.text)
            return r.json()
        def export(n,name):
            r=client.get(f'/api/cases/case_{n}/dossier');assert r.status_code==200
            (path/(name+'.md')).write_bytes(r.content)
        login('staff')
        for n in range(1,5):
            start=time.perf_counter();c=post(n,'analyze');elapsed=time.perf_counter()-start
            assert c['analysis']['model']['available']
            if n==1:
                assert c['facts']['cash_confirmed'] and c['facts']['recorded_paid_minor']==100000
                c=post(n,'decision',decision='EVIDENCE_ASSEMBLED',note='Synthetic evidence assembled for human review; no financial action.',evidence_ids=[e['id'] for e in c['evidence']])
            if n==2:
                assert c['facts']['recorded_paid_minor']==50000
                assert any(l['mismatches'] for cl in c['analysis']['claims'] for l in cl['links'])
            if n==3:
                assert not c['facts']['cash_confirmed']
                c=post(n,'task',question=c['facts']['requirements'][0],next_review=(datetime.now(timezone.utc)+timedelta(hours=24)).isoformat())
            if n==4:assert c['facts']['recorded_repaid_minor']==0
            export(n,f'journey-{n}'+('-requested' if n==4 else ''))
            report['journeys'].append(dict(journey=n,case_version=c['version'],evidence_version=c['evidence_version'],facts=c['facts'],
                  analysis_seconds_including_load=elapsed,model_engine=c['analysis']['model']['engine'],status='verified'))
        login('judge');assert client.post('/api/demo/advance',json={}).status_code==200
        login('staff');c=post(4,'check',kind='repayment')
        assert c['facts']['recorded_repaid_minor']==50000 and not c['analysis_fresh']
        c=post(4,'analyze');completed=next(e for e in c['evidence'] if e['capability']=='repayment_completed')
        c=post(4,'decision',decision='OUTCOME_RECORDED',note='Recorded the completed fictional repayment source; no payment executed.',evidence_ids=[completed['id']])
        export(4,'journey-4-completed')
        report['repayment_update']=dict(stale_analysis_invalidated=True,recorded_repaid_minor=c['facts']['recorded_repaid_minor'],human_review_cited=True)
    (ROOT/'artifacts'/'demo_results.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(report,ensure_ascii=False,indent=2))

if __name__=='__main__':run()
