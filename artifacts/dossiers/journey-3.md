# TraceFix dossier — TF-260003

**SYNTHETIC DEMO. No financial action or liability determination.**

Case version: 3; evidence version: 1; analysis current: True.
Owner: staff_1; next review: 2026-10-03T22:46:44.813299+00:00; status: WAITING_EVIDENCE.
Customer-reported amount: BDT 500.00; payment reference: •••003

## Customer allegation (reported)
আমি QR এর পরে একই কেনাকাটার জন্য নগদ টাকা দিয়েছি।

## Record-scoped observations
{
  "qr_confirmed": true,
  "cash_confirmed": false,
  "purchase_total_minor": null,
  "recorded_paid_minor": 50000,
  "recorded_repaid_minor": 0,
  "recorded_excess_minor": null,
  "requirements": [
    "Obtain a merchant acknowledgement of the alleged cash payment and purchase reference.",
    "Obtain an invoice identifying this purchase and its total."
  ],
  "conflict": false,
  "split_tender": false
}

## Preserved evidence and timeline
### ev_34f7731be650 — customer_supplied
Status: supplied / unverified; method: unverified supplied assertion; scope: this fictional purchase only.
Received: 2026-10-02T22:46:37.710443+00:00; event: 2026-10-02T22:46:37.710443+00:00; as of: 2026-10-02T22:46:37.710443+00:00.
Original SHA256: e5b75c7589841368cd32634c6840e665a487ada39d4ac1df51cf408c12e06d7b; transcript version: 1.

আমি QR এর পরে একই কেনাকাটার জন্য নগদ টাকা দিয়েছি।

Revision history: [{"version": 1, "text": "আমি QR এর পরে একই কেনাকাটার জন্য নগদ টাকা দিয়েছি।", "actor": "fixture", "at": "2026-10-02T22:46:37.710443+00:00", "reason": "original"}]

### ev_b4f01c154b20 — mock_payment
Status: confirmed within simulated source contract; method: documented synthetic fixture contract; scope: this fictional purchase only.
Received: 2026-10-02T22:46:37.710456+00:00; event: 2026-10-02T22:46:37.710456+00:00; as of: 2026-10-02T22:46:37.710456+00:00.
Original SHA256: 7268347c2669eac0e26a79e443968ef87f012e945d08935b01f4a8a21d9000f5; transcript version: 1.

QR payment QR-DEMO-003 completed. BDT 500 was posted for purchase PUR-103.

Revision history: [{"version": 1, "text": "QR payment QR-DEMO-003 completed. BDT 500 was posted for purchase PUR-103.", "actor": "fixture", "at": "2026-10-02T22:46:37.710456+00:00", "reason": "original"}]

### ev_88f9a65305de — customer_supplied
Status: supplied / unverified; method: unverified supplied assertion; scope: this fictional purchase only.
Received: 2026-10-02T22:46:37.710466+00:00; event: 2026-10-02T22:46:37.710466+00:00; as of: 2026-10-02T22:46:37.710466+00:00.
Original SHA256: a9516eb81ab27582b5cd173f782208fe32f20fc3a651c5de83f61aeb027cb06b; transcript version: 1.

নগদ ৫০০ টাকা গ্রহণ করা হয়েছে। একই কেনাকাটার রসিদ।

Revision history: [{"version": 1, "text": "নগদ ৫০০ টাকা গ্রহণ করা হয়েছে। একই কেনাকাটার রসিদ।", "actor": "fixture", "at": "2026-10-02T22:46:37.710466+00:00", "reason": "original"}]

## Textual assessment (separate from provenance)
{"engine": "rules_primary_with_trained_advisory", "available": true, "metadata": {"task": "three-label visible claim/passage assessment", "architecture": "frozen multilingual E5-small + standardized logistic regression head", "encoder": {"repo": "intfloat/multilingual-e5-small", "revision": "614241f622f53c4eeff9890bdc4f31cfecc418b3", "license": "MIT", "encoder_frozen": true}, "labels": ["SUPPORTED_BY_PASSAGE", "CONTRADICTED_BY_PASSAGE", "INSUFFICIENT_EVIDENCE"], "classifier_sha256": "7ae461354e62671b66c06f32d83a7388410669dff3d1b7916b9e6edf1b1d6a5c", "dataset_sha256": "2da7c31503bb26ff41e6b9e4997892a02773728211a4ca66f90fe7f6c4445966", "challenge_sha256_before_selection": "9851d23bc7298d08b175b8bb8bbcc295b12ff1896f50f063aae18df4b83368a2", "preprocessing": {"normalization": "NFC + Bengali digits to ASCII for model only; originals preserved", "max_tokens": 256, "prefix": "query: ", "pooling": "masked mean, L2 normalization"}, "trained_component": "logistic regression head only", "encoder_finetuned": false, "calibrated": false, "training_pairs": 1080, "development_pairs": 432, "chosen_C": 1.0, "development_candidates": [{"C": 0.05, "dev_macro_f1": 0.6651168070660542}, {"C": 0.2, "dev_macro_f1": 0.6613563145184832}, {"C": 1.0, "dev_macro_f1": 0.6710291025643574}], "training_seconds": 27.02879670006223, "python": "3.13.7", "independent_human_review": false, "limitations": "Fictional agent-labelled corpus; no production/domain accuracy certification."}, "error": null, "runtime_policy": {"primary": "rules", "trained_advisory": true, "reason": "Select the more reliable measured path on the frozen authored challenge; this is not independent human validation.", "evaluation_version": 2, "rules_version": 2}, "rules_version": 2, "limitations": "Synthetic agent-labelled training; no independent human validation; not a financial truth score."}
Analyzed: 2026-10-02T22:46:44.805165+00:00
### The QR payment completed.
- [ev_34f7731be650] revision 1: INSUFFICIENT_EVIDENCE; supplied / unverified;
> আমি QR এর পরে একই কেনাকাটার জন্য নগদ টাকা দিয়েছি।
- [ev_b4f01c154b20] revision 1: SUPPORTED_BY_PASSAGE; confirmed within simulated source contract;
> QR payment QR-DEMO-003 completed. BDT 500 was posted for purchase PUR-103.
- [ev_88f9a65305de] revision 1: INSUFFICIENT_EVIDENCE; supplied / unverified;
> নগদ ৫০০ টাকা গ্রহণ করা হয়েছে। একই কেনাকাটার রসিদ।
### A cash payment was received.
- [ev_34f7731be650] revision 1: SUPPORTED_BY_PASSAGE; supplied / unverified;
> আমি QR এর পরে একই কেনাকাটার জন্য নগদ টাকা দিয়েছি।
- [ev_b4f01c154b20] revision 1: INSUFFICIENT_EVIDENCE; confirmed within simulated source contract;
> QR payment QR-DEMO-003 completed. BDT 500 was posted for purchase PUR-103.
- [ev_88f9a65305de] revision 1: SUPPORTED_BY_PASSAGE; supplied / unverified;
> নগদ ৫০০ টাকা গ্রহণ করা হয়েছে। একই কেনাকাটার রসিদ।
### Both payments are for the same purchase.
- [ev_34f7731be650] revision 1: SUPPORTED_BY_PASSAGE; supplied / unverified;
> আমি QR এর পরে একই কেনাকাটার জন্য নগদ টাকা দিয়েছি।
- [ev_b4f01c154b20] revision 1: INSUFFICIENT_EVIDENCE; confirmed within simulated source contract;
> QR payment QR-DEMO-003 completed. BDT 500 was posted for purchase PUR-103.
- [ev_88f9a65305de] revision 1: INSUFFICIENT_EVIDENCE; supplied / unverified;
> নগদ ৫০০ টাকা গ্রহণ করা হয়েছে। একই কেনাকাটার রসিদ।
### Repayment completed.
- [ev_34f7731be650] revision 1: INSUFFICIENT_EVIDENCE; supplied / unverified;
> আমি QR এর পরে একই কেনাকাটার জন্য নগদ টাকা দিয়েছি।
- [ev_b4f01c154b20] revision 1: INSUFFICIENT_EVIDENCE; confirmed within simulated source contract;
> QR payment QR-DEMO-003 completed. BDT 500 was posted for purchase PUR-103.
- [ev_88f9a65305de] revision 1: INSUFFICIENT_EVIDENCE; supplied / unverified;
> নগদ ৫০০ টাকা গ্রহণ করা হয়েছে। একই কেনাকাটার রসিদ।

## Missing evidence
[
  {
    "id": "task_903c87d2d6fc",
    "question": "Obtain a merchant acknowledgement of the alleged cash payment and purchase reference.",
    "owner": "staff_1",
    "created_at": "2026-10-02T22:46:44.821998+00:00",
    "next_review": "2026-10-03T22:46:44.813299+00:00",
    "status": "OPEN"
  }
]

## Attempted read-only checks
[]

## Handoff
[]

## Human review (no financial execution)
[]

## Claim and purchase-link corrections
[]
