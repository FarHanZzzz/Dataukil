# TraceFix dossier — TF-260004

**SYNTHETIC DEMO. No financial action or liability determination.**

Case version: 5; evidence version: 2; analysis current: True.
Owner: staff_1; next review: 2026-10-03T22:46:37.710482+00:00; status: OUTCOME_RECORDED.
Customer-reported amount: BDT 500.00; payment reference: •••004

## Customer allegation (reported)
Cash and QR were both paid. A repayment was requested.

## Record-scoped observations
{
  "qr_confirmed": true,
  "cash_confirmed": true,
  "purchase_total_minor": 50000,
  "recorded_paid_minor": 100000,
  "recorded_repaid_minor": 50000,
  "recorded_excess_minor": 0,
  "requirements": [],
  "conflict": false,
  "split_tender": false
}

## Preserved evidence and timeline
### ev_f5044a08fb52 — customer_supplied
Status: supplied / unverified; method: unverified supplied assertion; scope: this fictional purchase only.
Received: 2026-10-02T22:46:37.710487+00:00; event: 2026-10-02T22:46:37.710487+00:00; as of: 2026-10-02T22:46:37.710487+00:00.
Original SHA256: c256be2fc8dbdbb4617788f7cb18c34b55fed154c82d873569bb4ad133154dd2; transcript version: 1.

Cash and QR were both paid. A repayment was requested.

Revision history: [{"version": 1, "text": "Cash and QR were both paid. A repayment was requested.", "actor": "fixture", "at": "2026-10-02T22:46:37.710487+00:00", "reason": "original"}]

### ev_9868ce96c638 — mock_payment
Status: confirmed within simulated source contract; method: documented synthetic fixture contract; scope: this fictional purchase only.
Received: 2026-10-02T22:46:37.710496+00:00; event: 2026-10-02T22:46:37.710496+00:00; as of: 2026-10-02T22:46:37.710496+00:00.
Original SHA256: ea37477502ccd76f60b25de1fe87d9d165955cb52056b6386971899a438b527a; transcript version: 1.

QR payment QR-DEMO-004 completed. BDT 500 was posted for purchase PUR-104.

Revision history: [{"version": 1, "text": "QR payment QR-DEMO-004 completed. BDT 500 was posted for purchase PUR-104.", "actor": "fixture", "at": "2026-10-02T22:46:37.710496+00:00", "reason": "original"}]

### ev_8bb78de10300 — mock_invoice
Status: confirmed within simulated source contract; method: documented synthetic fixture contract; scope: this fictional purchase only.
Received: 2026-10-02T22:46:37.710510+00:00; event: 2026-10-02T22:46:37.710510+00:00; as of: 2026-10-02T22:46:37.710510+00:00.
Original SHA256: 0366952b6b6bbb95335e5d47be69fb0804386482e2ef891ae4df75ff4c7b9e69; transcript version: 1.

Invoice for purchase PUR-104. Purchase total BDT 500.

Revision history: [{"version": 1, "text": "Invoice for purchase PUR-104. Purchase total BDT 500.", "actor": "fixture", "at": "2026-10-02T22:46:37.710510+00:00", "reason": "original"}]

### ev_224e7a5e6ee8 — mock_merchant
Status: confirmed within simulated source contract; method: documented synthetic fixture contract; scope: this fictional purchase only.
Received: 2026-10-02T22:46:37.710526+00:00; event: 2026-10-02T22:46:37.710526+00:00; as of: 2026-10-02T22:46:37.710526+00:00.
Original SHA256: e255b1a319ee4fe46cfddfb9f690dcf4a243c2908e4ea970ade1bd91c6af1181; transcript version: 1.

Cash payment of BDT 500 was received for purchase PUR-104. Both payments are for the same purchase.

Revision history: [{"version": 1, "text": "Cash payment of BDT 500 was received for purchase PUR-104. Both payments are for the same purchase.", "actor": "fixture", "at": "2026-10-02T22:46:37.710526+00:00", "reason": "original"}]

### ev_41780aa944db — repayment_request
Status: supplied / unverified; method: unverified supplied assertion; scope: this fictional purchase only.
Received: 2026-10-02T22:46:37.710542+00:00; event: 2026-10-02T22:46:37.710542+00:00; as of: 2026-10-02T22:46:37.710542+00:00.
Original SHA256: c91393cdddc42ecf5abd1692e23327e541c640559e7dd1401eafa4f7bccb3bdf; transcript version: 1.

Repayment of BDT 500 requested. It is not completed yet.

Revision history: [{"version": 1, "text": "Repayment of BDT 500 requested. It is not completed yet.", "actor": "fixture", "at": "2026-10-02T22:46:37.710542+00:00", "reason": "original"}]

### ev_05b5785c02d4 — mock_repayment
Status: confirmed within simulated source contract; method: documented synthetic fixture contract; scope: this fictional purchase only.
Received: 2026-10-02T22:46:44.966288+00:00; event: 2026-10-02T22:46:44.966288+00:00; as of: 2026-10-02T22:46:44.966288+00:00.
Original SHA256: b54fda94912da96e31b4c27d850cca309f89c7bed86a7d61d6d802bfaa9a8b72; transcript version: 1.

Repayment completed. BDT 500 returned against QR-DEMO-004.

Revision history: [{"version": 1, "text": "Repayment completed. BDT 500 returned against QR-DEMO-004.", "actor": "fixture", "at": "2026-10-02T22:46:44.966288+00:00", "reason": "original"}]

## Textual assessment (separate from provenance)
{"engine": "rules_primary_with_trained_advisory", "available": true, "metadata": {"task": "three-label visible claim/passage assessment", "architecture": "frozen multilingual E5-small + standardized logistic regression head", "encoder": {"repo": "intfloat/multilingual-e5-small", "revision": "614241f622f53c4eeff9890bdc4f31cfecc418b3", "license": "MIT", "encoder_frozen": true}, "labels": ["SUPPORTED_BY_PASSAGE", "CONTRADICTED_BY_PASSAGE", "INSUFFICIENT_EVIDENCE"], "classifier_sha256": "7ae461354e62671b66c06f32d83a7388410669dff3d1b7916b9e6edf1b1d6a5c", "dataset_sha256": "2da7c31503bb26ff41e6b9e4997892a02773728211a4ca66f90fe7f6c4445966", "challenge_sha256_before_selection": "9851d23bc7298d08b175b8bb8bbcc295b12ff1896f50f063aae18df4b83368a2", "preprocessing": {"normalization": "NFC + Bengali digits to ASCII for model only; originals preserved", "max_tokens": 256, "prefix": "query: ", "pooling": "masked mean, L2 normalization"}, "trained_component": "logistic regression head only", "encoder_finetuned": false, "calibrated": false, "training_pairs": 1080, "development_pairs": 432, "chosen_C": 1.0, "development_candidates": [{"C": 0.05, "dev_macro_f1": 0.6651168070660542}, {"C": 0.2, "dev_macro_f1": 0.6613563145184832}, {"C": 1.0, "dev_macro_f1": 0.6710291025643574}], "training_seconds": 27.02879670006223, "python": "3.13.7", "independent_human_review": false, "limitations": "Fictional agent-labelled corpus; no production/domain accuracy certification."}, "error": null, "runtime_policy": {"primary": "rules", "trained_advisory": true, "reason": "Select the more reliable measured path on the frozen authored challenge; this is not independent human validation.", "evaluation_version": 2, "rules_version": 2}, "rules_version": 2, "limitations": "Synthetic agent-labelled training; no independent human validation; not a financial truth score."}
Analyzed: 2026-10-02T22:46:45.163664+00:00
### The QR payment completed.
- [ev_f5044a08fb52] revision 1: INSUFFICIENT_EVIDENCE; supplied / unverified;
> Cash and QR were both paid. A repayment was requested.
- [ev_9868ce96c638] revision 1: SUPPORTED_BY_PASSAGE; confirmed within simulated source contract;
> QR payment QR-DEMO-004 completed. BDT 500 was posted for purchase PUR-104.
- [ev_8bb78de10300] revision 1: INSUFFICIENT_EVIDENCE; confirmed within simulated source contract;
> Invoice for purchase PUR-104. Purchase total BDT 500.
- [ev_224e7a5e6ee8] revision 1: INSUFFICIENT_EVIDENCE; confirmed within simulated source contract;
> Cash payment of BDT 500 was received for purchase PUR-104. Both payments are for the same purchase.
- [ev_41780aa944db] revision 1: INSUFFICIENT_EVIDENCE; supplied / unverified;
> Repayment of BDT 500 requested. It is not completed yet.
- [ev_05b5785c02d4] revision 1: INSUFFICIENT_EVIDENCE; confirmed within simulated source contract;
> Repayment completed. BDT 500 returned against QR-DEMO-004.
### A cash payment was received.
- [ev_f5044a08fb52] revision 1: SUPPORTED_BY_PASSAGE; supplied / unverified;
> Cash and QR were both paid. A repayment was requested.
- [ev_9868ce96c638] revision 1: INSUFFICIENT_EVIDENCE; confirmed within simulated source contract;
> QR payment QR-DEMO-004 completed. BDT 500 was posted for purchase PUR-104.
- [ev_8bb78de10300] revision 1: INSUFFICIENT_EVIDENCE; confirmed within simulated source contract;
> Invoice for purchase PUR-104. Purchase total BDT 500.
- [ev_224e7a5e6ee8] revision 1: SUPPORTED_BY_PASSAGE; confirmed within simulated source contract;
> Cash payment of BDT 500 was received for purchase PUR-104. Both payments are for the same purchase.
- [ev_41780aa944db] revision 1: INSUFFICIENT_EVIDENCE; supplied / unverified;
> Repayment of BDT 500 requested. It is not completed yet.
- [ev_05b5785c02d4] revision 1: INSUFFICIENT_EVIDENCE; confirmed within simulated source contract;
> Repayment completed. BDT 500 returned against QR-DEMO-004.
### Both payments are for the same purchase.
- [ev_f5044a08fb52] revision 1: INSUFFICIENT_EVIDENCE; supplied / unverified;
> Cash and QR were both paid. A repayment was requested.
- [ev_9868ce96c638] revision 1: INSUFFICIENT_EVIDENCE; confirmed within simulated source contract;
> QR payment QR-DEMO-004 completed. BDT 500 was posted for purchase PUR-104.
- [ev_8bb78de10300] revision 1: INSUFFICIENT_EVIDENCE; confirmed within simulated source contract;
> Invoice for purchase PUR-104. Purchase total BDT 500.
- [ev_224e7a5e6ee8] revision 1: SUPPORTED_BY_PASSAGE; confirmed within simulated source contract;
> Cash payment of BDT 500 was received for purchase PUR-104. Both payments are for the same purchase.
- [ev_41780aa944db] revision 1: INSUFFICIENT_EVIDENCE; supplied / unverified;
> Repayment of BDT 500 requested. It is not completed yet.
- [ev_05b5785c02d4] revision 1: INSUFFICIENT_EVIDENCE; confirmed within simulated source contract;
> Repayment completed. BDT 500 returned against QR-DEMO-004.
### Repayment completed.
- [ev_f5044a08fb52] revision 1: INSUFFICIENT_EVIDENCE; supplied / unverified;
> Cash and QR were both paid. A repayment was requested.
- [ev_9868ce96c638] revision 1: INSUFFICIENT_EVIDENCE; confirmed within simulated source contract;
> QR payment QR-DEMO-004 completed. BDT 500 was posted for purchase PUR-104.
- [ev_8bb78de10300] revision 1: INSUFFICIENT_EVIDENCE; confirmed within simulated source contract;
> Invoice for purchase PUR-104. Purchase total BDT 500.
- [ev_224e7a5e6ee8] revision 1: INSUFFICIENT_EVIDENCE; confirmed within simulated source contract;
> Cash payment of BDT 500 was received for purchase PUR-104. Both payments are for the same purchase.
- [ev_41780aa944db] revision 1: INSUFFICIENT_EVIDENCE; supplied / unverified;
> Repayment of BDT 500 requested. It is not completed yet.
- [ev_05b5785c02d4] revision 1: SUPPORTED_BY_PASSAGE; confirmed within simulated source contract;
> Repayment completed. BDT 500 returned against QR-DEMO-004.

## Missing evidence
[]

## Attempted read-only checks
[
  {
    "id": "check_31c9182ffa0d",
    "kind": "repayment",
    "requested_at": "2026-10-02T22:46:44.966241+00:00",
    "scope": "exact case QR reference only",
    "as_of": "2026-10-02T22:46:44.966249+00:00",
    "states": [
      {
        "state": "REQUESTED",
        "at": "2026-10-02T22:46:44.966252+00:00"
      },
      {
        "state": "QUEUED",
        "at": "2026-10-02T22:46:44.966255+00:00"
      },
      {
        "state": "RUNNING",
        "at": "2026-10-02T22:46:44.966257+00:00"
      },
      {
        "state": "COMPLETED",
        "at": "2026-10-02T22:46:44.966322+00:00"
      }
    ],
    "state": "COMPLETED",
    "result": "Completed repayment observed under the simulated repayment contract."
  }
]

## Handoff
[]

## Human review (no financial execution)
[
  {
    "id": "decision_156e2a8c6c88",
    "decision": "OUTCOME_RECORDED",
    "note": "Recorded the completed fictional repayment source; no payment executed.",
    "evidence_ids": [
      "ev_05b5785c02d4"
    ],
    "evidence_version": 2,
    "actor": "staff_1",
    "at": "2026-10-02T22:46:45.192400+00:00",
    "stale": false
  }
]

## Claim and purchase-link corrections
[]
