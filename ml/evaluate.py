"""Frozen first-run evaluation. Saves raw predictions and honest unavailable measures."""
from pathlib import Path
import json
import time
import hashlib
import numpy as np
import joblib
from sklearn.metrics import classification_report,confusion_matrix,f1_score,accuracy_score
from .features import Encoder,LABELS,rules,RULES_VERSION

ROOT=Path(__file__).resolve().parents[1]


def metrics(rows,pred,seconds):
    y=[r['label'] for r in rows]
    supported=[i for i,p in enumerate(pred) if p==LABELS[0]]
    return dict(pairs=len(rows),case_bundles=len({r['case_id'] for r in rows}),accuracy=float(accuracy_score(y,pred)),
        macro_f1=float(f1_score(y,pred,labels=LABELS,average='macro')),confusion_matrix=confusion_matrix(y,pred,labels=LABELS).tolist(),
        label_order=LABELS,report=classification_report(y,pred,labels=LABELS,output_dict=True,zero_division=0),
        unsupported_support_fraction=sum(y[i]!=LABELS[0] for i in supported)/max(1,len(supported)),
        non_insufficient_coverage=sum(p!=LABELS[2] for p in pred)/len(pred),
        seconds=seconds,mean_ms_per_pair=seconds*1000/len(rows),
        language_slices={l:dict(pairs=sum(r['language']==l for r in rows),macro_f1=float(f1_score(
            [r['label'] for r in rows if r['language']==l],[p for r,p in zip(rows,pred) if r['language']==l],labels=LABELS,average='macro')))
            for l in sorted({r['language'] for r in rows})})


def main():
    meta=json.loads((ROOT/'models'/'metadata.json').read_text())
    challenge_path=ROOT/'data'/'challenge.json'
    if hashlib.sha256(challenge_path.read_bytes()).hexdigest()!=meta['challenge_sha256_before_selection']:
        raise ValueError('Challenge changed since model selection; create a new evaluation version.')
    artifact=ROOT/'models'/'verifier.joblib'
    if hashlib.sha256(artifact.read_bytes()).hexdigest()!=meta['classifier_sha256']:
        raise ValueError('Classifier hash mismatch')
    clf=joblib.load(artifact);encoder=Encoder()
    suites=dict(grouped_synthetic=[json.loads(l) for l in (ROOT/'data'/'pairs.jsonl').read_text(encoding='utf-8').splitlines() if json.loads(l)['split']=='test'],
                authored_challenge=json.loads(challenge_path.read_text(encoding='utf-8')))
    result=dict(status='completed',version=RULES_VERSION,rules_version=RULES_VERSION,synthetic=True,independent_human_review=False,
                test_reused=RULES_VERSION>1,test_status='Reused frozen test for revised rule version; original first-run results preserved.' if RULES_VERSION>1 else 'First evaluation after model selection.',
                model=meta,suites={},limitations=[
                    'All labels authored by the implementation agent; no independent human review.',
                    'Rule version 2 was revised after first-run/browser inspection and reuses the frozen test. Its score is diagnostic, not an untouched-test estimate.' if RULES_VERSION>1 else 'Version 1 first-run evaluation after development-only model selection.',
                    'Template-disjoint synthetic tests are not production incidents.',
                    'Separately authored challenge is frozen before selection but not an independent human test.',
                    'No external LLM baseline: no service configured.',
                    'OCR, reviewer correction/preparation time, customer comprehension, financial benefit and real partner accuracy not measured.',
                    'Latency is local CPU batch inference; no hosted billing or production load test.'],
                operational_assertions='Measured separately by API acceptance tests; classifier labels never grant source authority.')
    raw=[]
    for name,rows in suites.items():
        pairs=[(r['claim'],r['passage']) for r in rows]
        start=time.perf_counter();rp=rules(pairs);rt=time.perf_counter()-start
        start=time.perf_counter();x=encoder.features(pairs);pred=clf.predict(x).tolist();mt=time.perf_counter()-start
        # Retrieval ablation: cosine supports similar passages but cannot identify contradiction.
        a=x[:,:384];b=x[:,384:768];sim=(a*b).sum(axis=1)
        retrieval=[LABELS[0] if s>=0.85 else LABELS[2] for s in sim]
        result['suites'][name]=dict(rules=metrics(rows,rp,rt),retrieval_only=metrics(rows,retrieval,mt),trained_verifier=metrics(rows,pred,mt))
        raw.extend([r|dict(suite=name,rules_prediction=rul,retrieval_prediction=ret,model_prediction=p) for r,rul,ret,p in zip(rows,rp,retrieval,pred)])
        print(name,'rules',result['suites'][name]['rules']['macro_f1'],'trained',result['suites'][name]['trained_verifier']['macro_f1'],flush=True)
    path=ROOT/'artifacts';path.mkdir(exist_ok=True)
    if RULES_VERSION>1 and (path/'evaluation.json').exists() and not (path/'evaluation_v1.json').exists():
        import shutil
        for source,target in [('evaluation.json','evaluation_v1.json'),('predictions.jsonl','predictions_v1.jsonl'),('ERROR_ANALYSIS.md','ERROR_ANALYSIS_v1.md')]:
            if (path/source).exists():shutil.copyfile(path/source,path/target)
    (path/'evaluation.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
    challenge=result['suites']['authored_challenge']
    prefer_rules=challenge['rules']['macro_f1']>=challenge['trained_verifier']['macro_f1']
    (path/'runtime_policy.json').write_text(json.dumps(dict(primary='rules' if prefer_rules else 'trained_verifier',
        trained_advisory=True,reason='Select the more reliable measured path on the frozen authored challenge; this is not independent human validation.',
        evaluation_version=RULES_VERSION,rules_version=RULES_VERSION),indent=2),encoding='utf-8')
    (path/'predictions.jsonl').write_text('\n'.join(json.dumps(r,ensure_ascii=False) for r in raw)+'\n',encoding='utf-8')
    errors=[r for r in raw if r['label']!=r['model_prediction']]
    lines=['# Exploratory model error analysis','',f'Evaluation version {RULES_VERSION}. {len(errors)} incorrect predictions from {len(raw)} pairs. Labels are agent-authored, not independently reviewed.','',
           'The trained model and test labels are unchanged. Rule version 2 corrects a browser-discovered predicate attribution error; its test is reused and is not an untouched new test. Original version 1 results remain saved. Runtime treats model labels as advisory; source authority remains deterministic.','']
    for e in errors[:40]:
        lines += [f'- {e["case_id"]} ({e["language"]}): expected {e["label"]}, predicted {e["model_prediction"]}. Claim: {e["claim"]} Passage: {e["passage"]}']
    (path/'ERROR_ANALYSIS.md').write_text('\n'.join(lines),encoding='utf-8')

if __name__=='__main__':main()
