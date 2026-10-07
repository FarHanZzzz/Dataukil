# DataDNA in the QR and Add Money simulations

DataDNA is a versioned, deterministic access policy around investigation reads. It checks the case, actor, purpose, synthetic processing basis and destination before invoking the relevant source adapter. It records field names, the decision and the reason; its audit entry does not duplicate source values. The current policy is `DNA-DEMO-2026.1` in `tracefix/data_dna.py`.

This demonstrates controls that support privacy compliance. It does not certify PDPA compliance: the processing basis is an explicit synthetic fixture assumption, the records and accounts are fictional, and production legal, security and lifecycle reviews remain required. In Bangladesh, the current statutory reference is the [Personal Data Protection Act, 2026](https://bdlaws.minlaw.gov.bd/act-print-1692.html); production policy owners must validate the applicable Act, rules and institutional obligations.

## What the judge can follow

| Step | QR + cash | Add Money |
| --- | --- | --- |
| Detect a problem | Customer reports a paid-twice purchase and supplies a receipt. | The missing acknowledgement passes the incident threshold; this identifies a symptom, not its root cause. |
| Authorize data | Original receipt processing is permitted locally. Marketplace retrieval is checked against the linked purchase. | Each bounded source check obtains a saved DataDNA decision before its adapter runs. |
| Minimize | Marketplace comparison receives permitted payment and purchase fields; unrestricted identity fields and original image content are withheld from the investigator request. | Posting IDs, candidate account identities and unrestricted diagnostic text are excluded from new tool results. |
| Investigate | Human-reviewed receipt fields are compared to exact synthetic purchase and payment records. OpenCV identifies visual regions; it does not authenticate a receipt or perform OCR. | Bank, wallet, partner, mapping and worker observations support or rule out hypotheses. The next check has a saved rationale and citations. |
| Propose | A cited verdict supports refund eligibility, rejection or an owned evidence handoff. | Observations support a status refresh, a permitted replay of the same intent, or an owned follow-up/handoff. |
| Approve and verify | The case owner approves an eligible simulated outcome; refund approval and completed refund are separate saved events. | An operator approves a current plan. Current source eligibility and policy are checked again; the executor verifies the ledger outcome. |
| Explain and retain evidence | The graph, privacy panel, event replay and dossier show source and policy decisions. | The Privacy inspector, activity log, replay and report show saved decisions and the remaining assurance owners. |

The Add Money investigator is a deterministic policy over returned observations. The QR pipeline uses local visual processing and exact comparisons. Neither workflow gives a language model permission to move money or to determine a lawful processing basis. A future model integration must receive only permitted structured data through an approved recipient contract.

## Decisions and boundary demonstrations

- **Allowed:** required structured fields are released within the case and purpose.
- **Minimized:** useful structured fields are released and unnecessary fields are withheld.
- **Blocked:** a request has no permitted scope, purpose or destination; its source adapter is not called.
- **Needs review:** the processing basis is not approved; retrieval pauses for a privacy owner.

The Privacy panel can save an explicit demonstration of an unrelated-data request, unapproved external-model recipient or missing processing basis. These requests actually stop at the gate without reading a source. They are marked `demonstration: true` and `affects_case: false`, so they do not change the incident evidence, financial eligibility or case outcome. They remain visible in the saved event history and exports.

For Add Money the authenticated demonstration endpoint is `POST /api/transfer/staff/cases/{case-or-payment-id}/privacy-probe`, with an `Idempotency-Key` and a `probe` of `unrelated_history`, `external_model` or `missing_basis`. Customer projections expose a short owned-payment summary rather than staff policy events or other-account metadata.

Plans carry the policy version and relevant DataDNA decision IDs alongside the evidence version. Add Money refuses an old plan without current authorization and revalidates at approval. Replay renders decisions from saved events at the selected point; it performs no new investigation or data retrieval.

## Remaining assurance

| Responsibility | Owner | Why the gate alone is insufficient |
| --- | --- | --- |
| Legal basis, notices, rights and policy changes | Institutional privacy owner | A technical rule cannot establish the real institution's lawful basis or satisfy organizational obligations by itself. |
| Authentication, privileges, integrations and recipient security | Security team | A production deployment needs proof that unauthorized paths cannot bypass the gate. |
| Retention and deletion across copies | Data owner | Original evidence, observations, reports, exports and cached responses need an approved lifecycle and rights-handling process. The simulation does not implement automatic retention or deletion. |
| Diagnosis, overrides and outcome quality | Operations lead | Permitted access does not establish that a diagnosis or financial action is correct. |
| Required independent assurance | Relevant institutional owner and auditor | Audit obligations depend on the applicable law, rules and institutional category. An application's event log is not an independent audit. |

The implementation gates the new investigation adapters and local QR receipt processing; it does not claim that all legacy APIs, storage, exports or organizational practices already form a production-wide privacy funnel.

## Suggested demonstration narration

“An unconfirmed payment forces an operator to reconcile records across several systems. Our investigator requests only the records relevant to this case, and DataDNA decides what it can see before the source is read. Each observation explains the next check and supports a bounded plan; the operator reviews a cited proposal rather than repeating the entire investigation. Approval remains with the operator, execution remains with the payment engine, and the outcome is verified. The same trace records privacy decisions and the reviews still needed before real data is connected.”
