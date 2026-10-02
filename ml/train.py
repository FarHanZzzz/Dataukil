from pathlib import Path
import json
import hashlib
import time
import platform
import joblib
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import f1_score
from .features import Encoder,LABELS

ROOT=Path(__file__).resolve().parents[1]


def main():
    start=time.perf_counter()
    rows=[json.loads(l) for l in (ROOT/'data'/'pairs.jsonl').read_text(encoding='utf-8').splitlines()]
    print('Encoding',len(rows),'pairs; frozen encoder.',flush=True)
    encoder=Encoder()
    # Only train/dev are accessed before model selection. Final tests are evaluated later.
    fitting=[r for r in rows if r['split'] in ('train','dev')]
    x=encoder.features([(r['claim'],r['passage']) for r in fitting]);y=np.array([r['label'] for r in fitting])
    tr=np.array([r['split']=='train' for r in fitting]);dv=~tr
    candidates=[];best=None
    for c in [0.05,0.2,1.0]:
        clf=make_pipeline(StandardScaler(),LogisticRegression(C=c,max_iter=1500,class_weight='balanced',random_state=42))
        clf.fit(x[tr],y[tr]);score=f1_score(y[dv],clf.predict(x[dv]),labels=LABELS,average='macro')
        candidates.append(dict(C=c,dev_macro_f1=float(score)))
        print(c,score,flush=True)
        if best is None or score>best[0]:best=(score,c,clf)
    root=ROOT/'models';root.mkdir(exist_ok=True)
    artifact=root/'verifier.joblib';joblib.dump(best[2],artifact)
    source=json.loads((root/'encoder_source.json').read_text())
    metadata=dict(task='three-label visible claim/passage assessment',architecture='frozen multilingual E5-small + standardized logistic regression head',
        encoder=source,labels=LABELS,classifier_sha256=hashlib.sha256(artifact.read_bytes()).hexdigest(),
        dataset_sha256=hashlib.sha256((ROOT/'data'/'pairs.jsonl').read_bytes()).hexdigest(),
        challenge_sha256_before_selection=hashlib.sha256((ROOT/'data'/'challenge.json').read_bytes()).hexdigest(),
        preprocessing=dict(normalization='NFC + Bengali digits to ASCII for model only; originals preserved',max_tokens=256,prefix='query: ',pooling='masked mean, L2 normalization'),
        trained_component='logistic regression head only',encoder_finetuned=False,calibrated=False,training_pairs=int(tr.sum()),development_pairs=int(dv.sum()),
        chosen_C=best[1],development_candidates=candidates,training_seconds=time.perf_counter()-start,python=platform.python_version(),
        independent_human_review=False,limitations='Fictional agent-labelled corpus; no production/domain accuracy certification.')
    (root/'metadata.json').write_text(json.dumps(metadata,indent=2),encoding='utf-8')
    print('Saved trained artifact:',artifact,flush=True)

if __name__=='__main__':main()
