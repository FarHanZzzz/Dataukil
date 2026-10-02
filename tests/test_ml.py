import json
from pathlib import Path
import hashlib
from ml.features import LABELS

ROOT=Path(__file__).resolve().parents[1]


def test_groups_and_cases_disjoint_and_hashes_recorded():
    rows=[json.loads(s) for s in (ROOT/'data'/'pairs.jsonl').read_text(encoding='utf-8').splitlines()]
    split_groups={s:{r['group'] for r in rows if r['split']==s} for s in ['train','dev','test']}
    split_cases={s:{r['case_id'] for r in rows if r['split']==s} for s in ['train','dev','test']}
    for a,b in [('train','dev'),('train','test'),('dev','test')]:
        assert not split_groups[a]&split_groups[b] and not split_cases[a]&split_cases[b]
    manifest=json.loads((ROOT/'data'/'split_manifest.json').read_text())
    assert manifest['dataset_sha256']==hashlib.sha256((ROOT/'data'/'pairs.jsonl').read_bytes()).hexdigest()
    assert set(r['label'] for r in rows)==set(LABELS)


def test_real_artifact_inference_and_explicit_token_abstention():
    from tracefix.verifier import Verifier
    v=Verifier()
    result=v.predict([('The QR payment completed.','QR payment completed.'),('Repayment completed.','word '*1000)])
    assert result[0]['model_available'] and result[0]['label'] in LABELS and 'learned_label' in result[0]
    assert v.identity()['metadata']['encoder_finetuned'] is False
    assert result[1]['engine']=='input_limit_abstention' and result[1]['label']==LABELS[2]


def test_evaluation_is_actual_and_discloses_data_limitations():
    result=json.loads((ROOT/'artifacts'/'evaluation.json').read_text(encoding='utf-8'))
    assert result['status']=='completed' and result['independent_human_review'] is False
    assert result['suites']['grouped_synthetic']['trained_verifier']['pairs']==432
    assert result['suites']['authored_challenge']['trained_verifier']['case_bundles']==36


def test_rules_do_not_attribute_cash_predicates_to_qr_or_single_payment_to_linkage():
    from ml.features import rules
    pairs=[('The QR payment completed.','QR was unclear, so I paid cash.'),
           ('The QR payment completed.','আমি QR এর পরে একই কেনাকাটার জন্য নগদ টাকা দিয়েছি।'),
           ('Both payments are for the same purchase.','QR payment completed for purchase P-1.'),
           ('Repayment completed.','Funds have been returned in full, not merely requested.'),
           ('The QR payment completed.','QR payment QR-DEMO-003 completed. BDT 500 was posted.'),
           ('A cash payment was received.','We did not receive cash. The only tender was QR.')]
    assert rules(pairs)==[LABELS[2],LABELS[2],LABELS[2],LABELS[0],LABELS[0],LABELS[1]]
