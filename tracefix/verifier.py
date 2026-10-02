"""Artifact-backed verifier; inference sees claim/passages only, never scenario IDs."""
from pathlib import Path
import hashlib
import json
import threading
from ml.features import LABELS,rules,RULES_VERSION

ROOT=Path(__file__).resolve().parents[1]


class Verifier:
    def __init__(self):
        self.encoder=None;self.classifier=None;self.metadata=None;self.error=None
        self.lock=threading.Lock()

    def load(self):
        if self.classifier is not None:return
        try:
            import joblib
            from ml.features import Encoder
            meta=json.loads((ROOT/'models'/'metadata.json').read_text(encoding='utf-8'))
            artifact=ROOT/'models'/'verifier.joblib'
            if hashlib.sha256(artifact.read_bytes()).hexdigest()!=meta['classifier_sha256']:
                raise ValueError('Classifier checksum mismatch.')
            self.encoder=Encoder();self.classifier=joblib.load(artifact);self.metadata=meta;self.error=None
        except Exception as e:
            self.encoder=None;self.classifier=None;self.error=type(e).__name__+': '+str(e)[:200]

    def predict(self,pairs):
        with self.lock:
            self.load()
            if self.classifier is None:
                return [dict(label=l,engine='rules_fallback',model_available=False,reason='Trained artifact unavailable; rules are not learned inference.') for l in rules(pairs)]
            bounded=[];indices=[]
            output=[None]*len(pairs)
            for i,(c,p) in enumerate(pairs):
                ids=self.encoder.tokenizer('query: '+p,add_special_tokens=True)['input_ids']
                claim_ids=self.encoder.tokenizer('query: '+c,add_special_tokens=True)['input_ids']
                if len(ids)>256 or len(claim_ids)>256:
                    output[i]=dict(label=LABELS[2],engine='input_limit_abstention',model_available=True,reason='Material text exceeds token limit; no silent truncation.')
                else:
                    bounded.append((c,p));indices.append(i)
            if bounded:
                try:
                    x=self.encoder.features(bounded)
                    predicted=self.classifier.predict(x)
                    policy_path=ROOT/'artifacts'/'runtime_policy.json'
                    policy=json.loads(policy_path.read_text()) if policy_path.exists() else {'primary':'trained_verifier'}
                    rule_labels=rules(bounded)
                    for i,label,rule_label in zip(indices,predicted,rule_labels):
                        primary=policy['primary']=='rules'
                        output[i]=dict(label=rule_label if primary else str(label),learned_label=str(label),
                            engine='rules_primary_with_trained_advisory' if primary else 'frozen_encoder_trained_head',model_available=True,
                            reason='Rules selected after stronger challenge result; trained label remains inspectable.' if primary else 'Passage assessment only; not authenticity or financial eligibility.')
                except Exception as e:
                    self.error=type(e).__name__
                    for i,label in zip(indices,rules(bounded)):
                        output[i]=dict(label=label,engine='rules_fallback',model_available=False,reason='Inference failed; explicit rules fallback.')
            return output

    def identity(self):
        policy_path=ROOT/'artifacts'/'runtime_policy.json'
        policy=json.loads(policy_path.read_text()) if policy_path.exists() else None
        return dict(engine='rules_primary_with_trained_advisory' if self.classifier and policy and policy['primary']=='rules' else 'frozen_encoder_trained_head' if self.classifier else 'rules_fallback',
                    available=self.classifier is not None,metadata=self.metadata,error=self.error,
                    runtime_policy=policy,rules_version=RULES_VERSION,
                    limitations='Synthetic agent-labelled training; no independent human validation; not a financial truth score.')


verifier=Verifier()
