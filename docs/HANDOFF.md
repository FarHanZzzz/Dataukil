# Implementation handoff

Current extension (3 October 2026): the [master prompt](MASTER_BUILD_PROMPT.md), [coverage matrix](MASTER_COVERAGE.md) and [main integration validation](MAIN_SYNC_VALIDATION.md) supersede the narrower historical scope below. The homepage opens automatically through `run.ps1`. Bank-to-upay Studio cases, QR/cash cases and the newer add-money workspace share persistent storage while retaining separate financial authority and routes. Sandbox corrections require backend eligibility and operator approval; the Studio also requires a separate execute action.

Status: **implemented and verified as a local synthetic prototype**, as explicitly selected by the user. The final hybrid specification is authoritative. No public deployment or real provider integration was requested.

Running app: http://127.0.0.1:8000. Exact commands: RUNBOOK.md. Persistent database and original uploads are under ignored runtime/. Start does not reset saved cases. The trained head is models/verifier.joblib (57,669 bytes), with metadata, source revision and labels. Downloaded encoder is ignored for size, reproducible with ml/download.py; the head and small artifacts are retained in the project.

## Capability evidence

| Essential capability | Status and evidence |
|---|---|
| Customer intake / exact owned lookup / unlinked acceptance / stable reference | Implemented in tracefix/app.py; ownership, idempotency, exact reuse and amount tests; mobile Chrome intake exercised |
| Customer list, safe status, details and further review | Separate server projection in domain.py; no staff documents/notes/probabilities in customer JSON; live Bangla follow-up verified |
| Staff inbox and saved ownership/follow-up | Persistent cases, deterministic next-review ordering, overdue markers, saved tasks; API and browser verified |
| Timeline, source viewer, evidence matrix | Current/saved analysis, actual passage IDs/revisions, source capabilities and exact mismatch flags; historical citations resolve their preserved revision |
| Immutable document originals and transcript corrections | PNG/JPEG/text bounds/content validation, SHA256, original blob/text and revision history; image, correction, invalid upload and staleness checks |
| Claim and link correction / re-analysis | claim/link endpoints preserve actor/reason/history; exact owned mapping only; analyzed fixed inventory supports human revision |
| Actual trained inference | Frozen E5 + trained logistic head loaded from disk; model hash checked; real inference and explicit token-limit abstention tested |
| Missing evidence request / saved review / task resolution | In-app tasks with actual question, owner and review; cited resolution; Dhaka time picker; no external messages |
| Read-only mock source check | QR/repayment lifecycle stored; bounded scope/as-of; unavailable sources give no new financial conclusion |
| Handoff / escalation / human review | Original owner retained until destination acknowledges; cited decisions; completed repayment required for repayment outcome; no money movement |
| Grounded dossier | Authorized Markdown export with saved version, allegation, source timeline, excerpts/provenance, revisions, checks, missing questions, handoffs and human decisions |
| Judge demo and evaluation | Four isolated actual-inference API journeys and five dossiers; live judge metrics, v1 archive link, v2 reused-test disclosure |
| Security / concurrency / refresh purity | Server sessions and roles, escaped browser text, same-origin writes, bounded input, scoped operation hashes, BEGIN IMMEDIATE writes; meaningful tests |

## Actual validation

46 pytest checks passed, including actual model load. JavaScript syntax and Python compilation passed. Four actual-inference demonstration journeys passed; warm case analysis ~80–101 ms and first loaded case ~6.88 s in the isolated local walkthrough. Results: artifacts/demo_results.json; dossiers: artifacts/dossiers/.

First-run learned macro F1: 0.827 on 432 grouped synthetic pairs, 0.471 on 37 authored challenge pairs. All annotations are agent-authored and unreviewed independently. The wider wording failure is retained in ERROR_ANALYSIS_v1.md. Rules are primary advisory text assessments, actual trained outputs remain visible. Rule v2 fixes a browser-discovered scope error; its reused challenge macro F1 0.972 does not establish independent accuracy. Original benchmark and predictions are preserved. Artifact hashes: artifacts/artifact_manifest.json.

Chrome verified mobile customer intake/owned lookup/Bangla follow-up, desktop inbox/source inspection/inference, correction with stale analysis, saved request, Dhaka review-time picker and actual evaluation disclosure. Historical matrix citations opened the preserved old transcript while the current transcript stayed separately available. Evidence survived server restart. Browser logs showed no current UI warning/error. Temporary mobile viewport restored. The running tab is retained; proof screenshot: artifacts/screenshots/workspace.jpg. VALIDATION.md records commands and limits.

## Boundaries and remaining work

The approved synthetic-only scope is delivered. Independent human labels, authorized real cases, provider APIs, OCR, external LLM baseline, customer comprehension/staff preparation measurements, production identity/load/retention and real financial benefits are **not verified**. Those remain future gates in REVIEW_PROTOCOL.md and BACKLOG.md. Passing tests and a running demo do not establish universally flawless behavior.

No archive transaction labels were used to train entailment. No reimbursement/fraud classifier, financial action route, external message, publishing action, or invented business metrics were added. Original repository files are preserved; changes have not been committed.

Pitch and likely objections: PITCH.md. Plan/context per area: CONTEXT.md and PLAN.md.
# Latest handoff: interactive mobile simulation

The customer story is now an actual persisted form and payment flow. `tracefix/simulation.py` owns synthetic purchase actions, stable complaint linkage, bounded mock source adapters, case messaging and the explicit repayment-source control. `static/app.js`, `index.html` and `style.css` were replaced with a responsive phone app and investigator desk. Two header-bound server-issued demo sessions keep the two surfaces independent even when browser cookies change.

Customer replies become unverified evidence and invalidate old analysis/decisions. Model inference runs outside the SQLite write transaction; stale input snapshots cannot be committed. A final repayment outcome needs current analysis, a completed source citation and reviewed outstanding requests. Existing records survive restart; no reset-on-refresh or destructive database migration was introduced.

Read [MOBILE_SIMULATION.md](MOBILE_SIMULATION.md), [SIMULATION_AI.md](SIMULATION_AI.md), [MOBILE_VALIDATION.md](MOBILE_VALIDATION.md) and the updated [RUNBOOK.md](RUNBOOK.md). Reproduce actual inference with `scripts/simulation_walkthrough.py`; its output is `artifacts/mobile_walkthrough.json`. Historical handoff details below remain background for the original four seeded examples.
