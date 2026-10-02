# TraceFix dossier — TF-260002

**SYNTHETIC DEMO. No financial action or liability determination.**

Case version: 2; evidence version: 1; analysis current: True.
Owner: staff_1; next review: 2026-10-03T22:46:37.710385+00:00; status: OPEN.
Customer-reported amount: BDT 500.00; payment reference: •••002

## Customer allegation (reported)
Two payments have the same amount. Please check their purchases.

## Record-scoped observations
{
  "qr_confirmed": true,
  "cash_confirmed": false,
  "purchase_total_minor": 50000,
  "recorded_paid_minor": 50000,
  "recorded_repaid_minor": 0,
  "recorded_excess_minor": 0,
  "requirements": [
    "Establish whether the second QR reference belongs to the same purchase."
  ],
  "conflict": false,
  "split_tender": false
}

## Preserved evidence and timeline
### ev_1330e8bb1392 — customer_supplied
Status: supplied / unverified; method: unverified supplied assertion; scope: this fictional purchase only.
Received: 2026-10-02T22:46:37.710392+00:00; event: 2026-10-02T22:46:37.710392+00:00; as of: 2026-10-02T22:46:37.710392+00:00.
Original SHA256: 70ec7a528d28bdfa5281de368f9f6b26dbfd3e2b09b85284499cdc7cbb871179; transcript version: 1.

Two payments have the same amount. Please check their purchases.

Revision history: [{"version": 1, "text": "Two payments have the same amount. Please check their purchases.", "actor": "fixture", "at": "2026-10-02T22:46:37.710392+00:00", "reason": "original"}]

### ev_7b09a6197f28 — mock_payment
Status: confirmed within simulated source contract; method: documented synthetic fixture contract; scope: this fictional purchase only.
Received: 2026-10-02T22:46:37.710402+00:00; event: 2026-10-02T22:46:37.710402+00:00; as of: 2026-10-02T22:46:37.710402+00:00.
Original SHA256: 38e6a7afdd9b77aec34df5c03c2a1d2f989bfb4deeaeb1d7d7cb5c2363cd4543; transcript version: 1.

QR payment QR-DEMO-002 completed. BDT 500 was posted for purchase PUR-102.

Revision history: [{"version": 1, "text": "QR payment QR-DEMO-002 completed. BDT 500 was posted for purchase PUR-102.", "actor": "fixture", "at": "2026-10-02T22:46:37.710402+00:00", "reason": "original"}]

### ev_ae088251de14 — mock_invoice
Status: confirmed within simulated source contract; method: documented synthetic fixture contract; scope: this fictional purchase only.
Received: 2026-10-02T22:46:37.710411+00:00; event: 2026-10-02T22:46:37.710411+00:00; as of: 2026-10-02T22:46:37.710411+00:00.
Original SHA256: 1d5f1c0ed30ea0959ad2c159813d4067877d3bd467e5ded23eb04c2babc3862d; transcript version: 1.

Invoice for purchase PUR-102. Purchase total BDT 500.

Revision history: [{"version": 1, "text": "Invoice for purchase PUR-102. Purchase total BDT 500.", "actor": "fixture", "at": "2026-10-02T22:46:37.710411+00:00", "reason": "original"}]

### ev_fe84a10cf7ac — mock_payment
Status: confirmed within simulated source contract; method: documented synthetic fixture contract; scope: this fictional purchase only.
Received: 2026-10-02T22:46:37.710420+00:00; event: 2026-10-02T22:46:37.710420+00:00; as of: 2026-10-02T22:46:37.710420+00:00.
Original SHA256: 0e11525a98f5587b425294843a119f4f8ee5902e001d88ee15158a882aaa84e0; transcript version: 1.

The second QR payment QR-DEMO-202 belongs to a different purchase PUR-202. These are two separate purchases.

Revision history: [{"version": 1, "text": "The second QR payment QR-DEMO-202 belongs to a different purchase PUR-202. These are two separate purchases.", "actor": "fixture", "at": "2026-10-02T22:46:37.710420+00:00", "reason": "original"}]

## Textual assessment (separate from provenance)
{"engine": "rules_primary_with_trained_advisory", "available": true, "metadata": {"task": "three-label visible claim/passage assessment", "architecture": "frozen multilingual E5-small + standardized logistic regression head", "encoder": {"repo": "intfloat/multilingual-e5-small", "revision": "614241f622f53c4eeff9890bdc4f31cfecc418b3", "license": "MIT", "encoder_frozen": true}, "labels": ["SUPPORTED_BY_PASSAGE", "CONTRADICTED_BY_PASSAGE", "INSUFFICIENT_EVIDENCE"], "classifier_sha256": "7ae461354e62671b66c06f32d83a7388410669dff3d1b7916b9e6edf1b1d6a5c", "dataset_sha256": "2da7c31503bb26ff41e6b9e4997892a02773728211a4ca66f90fe7f6c4445966", "challenge_sha256_before_selection": "9851d23bc7298d08b175b8bb8bbcc295b12ff1896f50f063aae18df4b83368a2", "preprocessing": {"normalization": "NFC + Bengali digits to ASCII for model only; originals preserved", "max_tokens": 256, "prefix": "query: ", "pooling": "masked mean, L2 normalization"}, "trained_component": "logistic regression head only", "encoder_finetuned": false, "calibrated": false, "training_pairs": 1080, "development_pairs": 432, "chosen_C": 1.0, "development_candidates": [{"C": 0.05, "dev_macro_f1": 0.6651168070660542}, {"C": 0.2, "dev_macro_f1": 0.6613563145184832}, {"C": 1.0, "dev_macro_f1": 0.6710291025643574}], "training_seconds": 27.02879670006223, "python": "3.13.7", "independent_human_review": false, "limitations": "Fictional agent-labelled corpus; no production/domain accuracy certification."}, "error": null, "runtime_policy": {"primary": "rules", "trained_advisory": true, "reason": "Select the more reliable measured path on the frozen authored challenge; this is not independent human validation.", "evaluation_version": 2, "rules_version": 2}, "rules_version": 2, "limitations": "Synthetic agent-labelled training; no independent human validation; not a financial truth score."}
Analyzed: 2026-10-02T22:46:44.721021+00:00
### The QR payment completed.
- [ev_1330e8bb1392] revision 1: INSUFFICIENT_EVIDENCE; supplied / unverified;
> Two payments have the same amount. Please check their purchases.
- [ev_7b09a6197f28] revision 1: SUPPORTED_BY_PASSAGE; confirmed within simulated source contract;
> QR payment QR-DEMO-002 completed. BDT 500 was posted for purchase PUR-102.
- [ev_ae088251de14] revision 1: INSUFFICIENT_EVIDENCE; confirmed within simulated source contract;
> Invoice for purchase PUR-102. Purchase total BDT 500.
- [ev_fe84a10cf7ac] revision 1: INSUFFICIENT_EVIDENCE; confirmed within simulated source contract; Exact purchase reference mismatch; not evidence of this purchase.; Exact QR reference mismatch.
> The second QR payment QR-DEMO-202 belongs to a different purchase PUR-202. These are two separate purchases.
### A second QR payment completed.
- [ev_1330e8bb1392] revision 1: INSUFFICIENT_EVIDENCE; supplied / unverified;
> Two payments have the same amount. Please check their purchases.
- [ev_7b09a6197f28] revision 1: SUPPORTED_BY_PASSAGE; confirmed within simulated source contract;
> QR payment QR-DEMO-002 completed. BDT 500 was posted for purchase PUR-102.
- [ev_ae088251de14] revision 1: INSUFFICIENT_EVIDENCE; confirmed within simulated source contract;
> Invoice for purchase PUR-102. Purchase total BDT 500.
- [ev_fe84a10cf7ac] revision 1: INSUFFICIENT_EVIDENCE; confirmed within simulated source contract; Exact purchase reference mismatch; not evidence of this purchase.
> The second QR payment QR-DEMO-202 belongs to a different purchase PUR-202. These are two separate purchases.
### Both payments are for the same purchase.
- [ev_1330e8bb1392] revision 1: INSUFFICIENT_EVIDENCE; supplied / unverified;
> Two payments have the same amount. Please check their purchases.
- [ev_7b09a6197f28] revision 1: INSUFFICIENT_EVIDENCE; confirmed within simulated source contract;
> QR payment QR-DEMO-002 completed. BDT 500 was posted for purchase PUR-102.
- [ev_ae088251de14] revision 1: INSUFFICIENT_EVIDENCE; confirmed within simulated source contract;
> Invoice for purchase PUR-102. Purchase total BDT 500.
- [ev_fe84a10cf7ac] revision 1: INSUFFICIENT_EVIDENCE; confirmed within simulated source contract; Exact purchase reference mismatch; not evidence of this purchase.
> The second QR payment QR-DEMO-202 belongs to a different purchase PUR-202. These are two separate purchases.
### Repayment completed.
- [ev_1330e8bb1392] revision 1: INSUFFICIENT_EVIDENCE; supplied / unverified;
> Two payments have the same amount. Please check their purchases.
- [ev_7b09a6197f28] revision 1: INSUFFICIENT_EVIDENCE; confirmed within simulated source contract;
> QR payment QR-DEMO-002 completed. BDT 500 was posted for purchase PUR-102.
- [ev_ae088251de14] revision 1: INSUFFICIENT_EVIDENCE; confirmed within simulated source contract;
> Invoice for purchase PUR-102. Purchase total BDT 500.
- [ev_fe84a10cf7ac] revision 1: INSUFFICIENT_EVIDENCE; confirmed within simulated source contract; Exact purchase reference mismatch; not evidence of this purchase.; Exact QR reference mismatch.
> The second QR payment QR-DEMO-202 belongs to a different purchase PUR-202. These are two separate purchases.

## Missing evidence
[]

## Attempted read-only checks
[]

## Handoff
[]

## Human review (no financial execution)
[]

## Claim and purchase-link corrections
[]
