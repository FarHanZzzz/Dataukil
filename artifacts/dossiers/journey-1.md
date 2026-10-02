# TraceFix dossier — TF-260001

**SYNTHETIC DEMO. No financial action or liability determination.**

Case version: 3; evidence version: 1; analysis current: True.
Owner: staff_1; next review: 2026-10-03T22:46:37.710234+00:00; status: REVIEWED.
Customer-reported amount: BDT 500.00; payment reference: •••001

## Customer allegation (reported)
QR was unclear, so I paid cash for invoice INV-101.

## Record-scoped observations
{
  "qr_confirmed": true,
  "cash_confirmed": true,
  "purchase_total_minor": 50000,
  "recorded_paid_minor": 100000,
  "recorded_repaid_minor": 0,
  "recorded_excess_minor": 50000,
  "requirements": [],
  "conflict": false,
  "split_tender": false
}

## Preserved evidence and timeline
### ev_e477af35f94c — customer_supplied
Status: supplied / unverified; method: unverified supplied assertion; scope: this fictional purchase only.
Received: 2026-10-02T22:46:37.710248+00:00; event: 2026-10-02T22:46:37.710248+00:00; as of: 2026-10-02T22:46:37.710248+00:00.
Original SHA256: 0d089c990308b67f2fac8833559664f98240175c47e42b49a32b164b0d1a83ea; transcript version: 1.

QR was unclear, so I paid cash for invoice INV-101.

Revision history: [{"version": 1, "text": "QR was unclear, so I paid cash for invoice INV-101.", "actor": "fixture", "at": "2026-10-02T22:46:37.710248+00:00", "reason": "original"}]

### ev_702819949160 — mock_payment
Status: confirmed within simulated source contract; method: documented synthetic fixture contract; scope: this fictional purchase only.
Received: 2026-10-02T22:46:37.710328+00:00; event: 2026-10-02T22:46:37.710328+00:00; as of: 2026-10-02T22:46:37.710328+00:00.
Original SHA256: de333d5566790b959f5e2fc834a7172025de53d3a6319dc684dfa654983c7fd8; transcript version: 1.

QR payment QR-DEMO-001 completed. BDT 500 was posted for purchase PUR-101.

Revision history: [{"version": 1, "text": "QR payment QR-DEMO-001 completed. BDT 500 was posted for purchase PUR-101.", "actor": "fixture", "at": "2026-10-02T22:46:37.710328+00:00", "reason": "original"}]

### ev_f8be8fd18015 — mock_invoice
Status: confirmed within simulated source contract; method: documented synthetic fixture contract; scope: this fictional purchase only.
Received: 2026-10-02T22:46:37.710348+00:00; event: 2026-10-02T22:46:37.710348+00:00; as of: 2026-10-02T22:46:37.710348+00:00.
Original SHA256: e3a2c2c8915f0d09dd2f78eb36f0e0f7233e3355ef035d713d88bf88b6879752; transcript version: 1.

Invoice for purchase PUR-101. Purchase total BDT 500.

Revision history: [{"version": 1, "text": "Invoice for purchase PUR-101. Purchase total BDT 500.", "actor": "fixture", "at": "2026-10-02T22:46:37.710348+00:00", "reason": "original"}]

### ev_6c55312a700a — mock_merchant
Status: confirmed within simulated source contract; method: documented synthetic fixture contract; scope: this fictional purchase only.
Received: 2026-10-02T22:46:37.710364+00:00; event: 2026-10-02T22:46:37.710364+00:00; as of: 2026-10-02T22:46:37.710364+00:00.
Original SHA256: 27a39df09d8ea0ec2ef833b18d607f4969c65193dd967d68f8b68ccf15064ec4; transcript version: 1.

Cash payment of BDT 500 was received for purchase PUR-101. Both payments are for the same purchase.

Revision history: [{"version": 1, "text": "Cash payment of BDT 500 was received for purchase PUR-101. Both payments are for the same purchase.", "actor": "fixture", "at": "2026-10-02T22:46:37.710364+00:00", "reason": "original"}]

## Textual assessment (separate from provenance)
{"engine": "rules_primary_with_trained_advisory", "available": true, "metadata": {"task": "three-label visible claim/passage assessment", "architecture": "frozen multilingual E5-small + standardized logistic regression head", "encoder": {"repo": "intfloat/multilingual-e5-small", "revision": "614241f622f53c4eeff9890bdc4f31cfecc418b3", "license": "MIT", "encoder_frozen": true}, "labels": ["SUPPORTED_BY_PASSAGE", "CONTRADICTED_BY_PASSAGE", "INSUFFICIENT_EVIDENCE"], "classifier_sha256": "7ae461354e62671b66c06f32d83a7388410669dff3d1b7916b9e6edf1b1d6a5c", "dataset_sha256": "2da7c31503bb26ff41e6b9e4997892a02773728211a4ca66f90fe7f6c4445966", "challenge_sha256_before_selection": "9851d23bc7298d08b175b8bb8bbcc295b12ff1896f50f063aae18df4b83368a2", "preprocessing": {"normalization": "NFC + Bengali digits to ASCII for model only; originals preserved", "max_tokens": 256, "prefix": "query: ", "pooling": "masked mean, L2 normalization"}, "trained_component": "logistic regression head only", "encoder_finetuned": false, "calibrated": false, "training_pairs": 1080, "development_pairs": 432, "chosen_C": 1.0, "development_candidates": [{"C": 0.05, "dev_macro_f1": 0.6651168070660542}, {"C": 0.2, "dev_macro_f1": 0.6613563145184832}, {"C": 1.0, "dev_macro_f1": 0.6710291025643574}], "training_seconds": 27.02879670006223, "python": "3.13.7", "independent_human_review": false, "limitations": "Fictional agent-labelled corpus; no production/domain accuracy certification."}, "error": null, "runtime_policy": {"primary": "rules", "trained_advisory": true, "reason": "Select the more reliable measured path on the frozen authored challenge; this is not independent human validation.", "evaluation_version": 2, "rules_version": 2}, "rules_version": 2, "limitations": "Synthetic agent-labelled training; no independent human validation; not a financial truth score."}
Analyzed: 2026-10-02T22:46:44.590355+00:00
### The QR payment completed.
- [ev_e477af35f94c] revision 1: INSUFFICIENT_EVIDENCE; supplied / unverified;
> QR was unclear, so I paid cash for invoice INV-101.
- [ev_702819949160] revision 1: SUPPORTED_BY_PASSAGE; confirmed within simulated source contract;
> QR payment QR-DEMO-001 completed. BDT 500 was posted for purchase PUR-101.
- [ev_f8be8fd18015] revision 1: INSUFFICIENT_EVIDENCE; confirmed within simulated source contract;
> Invoice for purchase PUR-101. Purchase total BDT 500.
- [ev_6c55312a700a] revision 1: INSUFFICIENT_EVIDENCE; confirmed within simulated source contract;
> Cash payment of BDT 500 was received for purchase PUR-101. Both payments are for the same purchase.
### A cash payment was received.
- [ev_e477af35f94c] revision 1: INSUFFICIENT_EVIDENCE; supplied / unverified;
> QR was unclear, so I paid cash for invoice INV-101.
- [ev_702819949160] revision 1: INSUFFICIENT_EVIDENCE; confirmed within simulated source contract;
> QR payment QR-DEMO-001 completed. BDT 500 was posted for purchase PUR-101.
- [ev_f8be8fd18015] revision 1: INSUFFICIENT_EVIDENCE; confirmed within simulated source contract;
> Invoice for purchase PUR-101. Purchase total BDT 500.
- [ev_6c55312a700a] revision 1: SUPPORTED_BY_PASSAGE; confirmed within simulated source contract;
> Cash payment of BDT 500 was received for purchase PUR-101. Both payments are for the same purchase.
### Both payments are for the same purchase.
- [ev_e477af35f94c] revision 1: INSUFFICIENT_EVIDENCE; supplied / unverified;
> QR was unclear, so I paid cash for invoice INV-101.
- [ev_702819949160] revision 1: INSUFFICIENT_EVIDENCE; confirmed within simulated source contract;
> QR payment QR-DEMO-001 completed. BDT 500 was posted for purchase PUR-101.
- [ev_f8be8fd18015] revision 1: INSUFFICIENT_EVIDENCE; confirmed within simulated source contract;
> Invoice for purchase PUR-101. Purchase total BDT 500.
- [ev_6c55312a700a] revision 1: SUPPORTED_BY_PASSAGE; confirmed within simulated source contract;
> Cash payment of BDT 500 was received for purchase PUR-101. Both payments are for the same purchase.
### Repayment completed.
- [ev_e477af35f94c] revision 1: INSUFFICIENT_EVIDENCE; supplied / unverified;
> QR was unclear, so I paid cash for invoice INV-101.
- [ev_702819949160] revision 1: INSUFFICIENT_EVIDENCE; confirmed within simulated source contract;
> QR payment QR-DEMO-001 completed. BDT 500 was posted for purchase PUR-101.
- [ev_f8be8fd18015] revision 1: INSUFFICIENT_EVIDENCE; confirmed within simulated source contract;
> Invoice for purchase PUR-101. Purchase total BDT 500.
- [ev_6c55312a700a] revision 1: INSUFFICIENT_EVIDENCE; confirmed within simulated source contract;
> Cash payment of BDT 500 was received for purchase PUR-101. Both payments are for the same purchase.

## Missing evidence
[]

## Attempted read-only checks
[]

## Handoff
[]

## Human review (no financial execution)
[
  {
    "id": "decision_d36cdbdcb64c",
    "decision": "EVIDENCE_ASSEMBLED",
    "note": "Synthetic evidence assembled for human review; no financial action.",
    "evidence_ids": [
      "ev_e477af35f94c",
      "ev_702819949160",
      "ev_f8be8fd18015",
      "ev_6c55312a700a"
    ],
    "evidence_version": 1,
    "actor": "staff_1",
    "at": "2026-10-02T22:46:44.608484+00:00",
    "stale": false
  }
]

## Claim and purchase-link corrections
[]
