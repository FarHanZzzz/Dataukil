# Domain and API contract

One origin: FastAPI serves `/` and `/static`, JSON under `/api`. SQLite transactions use BEGIN IMMEDIATE for writes. Server issues random HTTP-only fixture session cookies; role labels in browser are never authorization. Judge demo intentionally permits a predefined staff/customer/judge session locally, not arbitrary identity impersonation. Bind localhost only.

Case: generated reference, fictional customer, purchase and QR references, reported amount (minor units scale 2), version, owner, status, persisted next review, human decision, analysis snapshot. Evidence: immutable original blob/text hash, original text, revision history, actor/reason, reference, event/as-of/received times, scope, verification method, capability. Current analysis carries evidence revisions and snapshot version. Original and corrections remain inspectable.

Source capabilities:
* mock_payment: QR completion only under fictional provider-record contract.
* mock_merchant: cash tender/purchase acknowledgement under declared mock verification.
* mock_repayment: completed repayment observation only.
* mock_invoice: purchase total/mapping under fictional verified purchase fixture.
* customer/merchant/staff uploads: supplied assertions, never verified by role or file extension.
* repayment_request: request only, no returned money.

Customer responses are constructed server-side with reported amount, permitted confirmed facts, unresolved requirements, owner, saved review, safe notifications. They omit evidence texts, staff notes, classifier scores and other customers.

Route map:
* POST /api/session — predefined local demo role; GET /api/session.
* GET /api/payments/{reference} — exact owned lookup, generic 404.
* GET/POST /api/cases — role-scoped list / customer intake.
* GET /api/cases/{id} — explicit customer or staff schema.
* POST /api/cases/{id}/details — customer additional text.
* POST /api/cases/{id}/evidence — staff supplied assertion/transcript.
* POST /api/cases/{id}/upload — bounded PNG/JPEG/plain-text immutable blob; labelled human transcript, no OCR claim.
* POST /api/cases/{id}/correct — append transcript revision.
* POST /api/cases/{id}/claim — revise an existing proposed claim with actor/reason/history.
* POST /api/cases/{id}/link — explicitly link an unlinked case to an exact mapping for the same customer, with rationale.
* POST /api/cases/{id}/analyze — current visible evidence only.
* POST /api/cases/{id}/check — permitted synchronous persisted mock check lifecycle.
* POST /api/cases/{id}/task — question + owned follow-up.
* POST /api/cases/{id}/resolve-task — cite actual evidence and preserve resolution rationale.
* POST /api/cases/{id}/review — saved next review.
* POST /api/cases/{id}/handoff — requested destination, original owner retained.
* POST /api/cases/{id}/acknowledge — receiving staff claims handoff.
* POST /api/cases/{id}/decision — cited current human review, no financial execution.
* GET /api/cases/{id}/dossier — grounded Markdown download.
* GET /api/evidence/{id}/file — authorization-checked immutable original.
* GET /api/demo; POST /api/demo/advance — judge only; future repayment response remains out of case/model inputs until check.
* GET /api/evaluation — saved actual result or evaluation-not-run.
* GET /api/evaluation?version=1 — preserved first-run benchmark; current version is explicitly test-reused.

Every mutation: authorize -> scoped idempotency key + payload digest -> successful identical retry -> expected-version check for new writes -> atomic mutation/audit/notification -> persisted response. Changed payload returns 409. All GETs have no model/source/action side effects.
