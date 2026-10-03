# One-page factual pitch

DataUkil helps a customer and investigator assemble a possible paid-twice complaint for one merchant purchase. The difficult distinction is between a completed QR payment, an alleged cash payment, their purchase relationship, and any actual repayment.

The local prototype accepts Bangla/Banglish/English complaints, preserves evidence and corrections, records an owner and follow-up, runs read-only mock source checks, keeps handoff responsibility until acknowledgement, and exports a cited dossier. Every financial observation is scoped to an explicit fictional source contract. QR completion alone does not close the investigation. A repayment request is not returned money.

AI depth: a frozen multilingual E5 encoder and a genuinely trained three-class classifier head assess claim/passage relationships. Training code, data manifest, raw predictions, hashes and benchmark results are inspectable. The first grouped synthetic test macro F1 was 0.827; the separately authored challenge was 0.471. Rules performed better on the challenge and are therefore the primary advisory path. Model predictions remain visible. Revised rule results reuse the challenge and are labelled accordingly.

Validation: meaningful server checks cover ownership, role enforcement, immutable originals, stale analyses, exact references, idempotency, concurrent edits, follow-up, repayment stages, GET purity and missing artifacts. Four complete API demo journeys and dossiers are saved. Mobile customer and desktop investigator views were exercised in Chrome.

Impact remains unmeasured: no bank/provider employee study, customer comprehension study, actual case volume, provider API access or BDT savings is claimed. The prototype assists assembly and follow-up; it does not adjudicate liability or execute reimbursement.

Likely objections:
* **Is the model ready for real cases?** No. Synthetic labels lack independent review and broader wording exposed weak performance. Authorized retrospective evidence and independent bilingual annotation come next.
* **Does a receipt prove cash payment?** No. Its text and supplied provenance are separate from a source-confirmed cash observation.
* **Why use AI if rules are stronger?** The experiment is inspectable and the operational path follows the more reliable measured option. Future independent evaluation must earn an ML benefit.
* **Is it unique?** International dispute/investigation products overlap. The contribution is a concrete local multilingual evidence workflow, not category invention.
* **What integrates next?** Approved exact-reference provider records, purchase/merchant acknowledgement contracts, production identity, supervised shadow evaluation and retention policy.

Rubric evidence: concrete problem/relevance; trained artifacts/AI depth; no invented impact; integrated prototype; bounded differentiation; read-only contracts for integration; provenance, roles and human financial decisions for responsible AI.
