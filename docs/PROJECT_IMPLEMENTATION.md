# DataUkil project implementation inventory

**Snapshot:** 4 October 2026, Asia/Dhaka, application implementation through commit `6cdd4fe`. This inventory covers the working project, rather than only the most recent UI changes. The repository's `tracefix` package name and `TRACEFIX_*` settings remain for compatibility; the product is **DataUkil**.

The project is a persistent, local synthetic transaction-investigation prototype. Bank, wallet, Marketplace and correction records are fictional. Actual model inference and image processing are implemented, but production provider integration and independently validated impact are not.

For the proposed production AI role and judge explanation, see [AI_VALUE_AND_JUDGES_GUIDE.md](AI_VALUE_AND_JUDGES_GUIDE.md).

## 1. Product and workspaces

| Page/route | Implemented experience |
| --- | --- |
| `/` | DataUkil homepage, supplied landscape hero, interactive 3D QR scanner, prominent Add money and QR + cash entry points, Workspaces navigation |
| `/customer` | Customer transfer dashboard, eight synthetic scenarios, saved transactions, complaints, evidence, customer-safe updates and English/বাংলা switching |
| `/operations` | Staff overview and case queue derived from persistent records, status/ownership information and links to investigation |
| `/operations/cases/{case_id}` | Case reconstruction, source records, operational details and Analyze Case entry |
| `/operations/cases/{case_id}/studio` | Dedicated investigation Studio with saved phases, graph, hypotheses, evidence citations, replay and separate approval/execution controls |
| `/qr-demo` | One QR + cash journey containing customer phone, receipt evidence, operator investigation, synthetic Marketplace verification and three outcome branches |
| `/mfs` | Five-stage Add money walkthrough with scenario selection, run-aware progression, resume and presentation details |
| `/demo` | Compatibility redirect to `/mfs` |
| `/customer/payment` | Add money amount/bank form and distinct review/confirmation step |
| `/customer/payment/{id}` | Saved Add money status, transfer progress, next action, complaint and updates |
| `/customer/cases/{id}` | Customer-safe Add money investigation status |
| `/admin/queue` | Role-scoped Add money investigation queue |
| `/admin/cases/{id}` | Existing Add money investigation board and mobile Board/Details/Activity surfaces |
| `/admin/cases/{id}/report` | Versioned Add money report, return navigation and Markdown/HTML export |

### Shared architecture

- FastAPI serves HTML/static assets and JSON APIs from the same origin.
- Browser clients use vanilla JavaScript, HTML and CSS; no frontend compilation service is needed to run the app.
- SQLite persists sessions, cases, incidents, simulations, transactions, events, evidence, recommendations, approvals, repairs and ledgers.
- Shared cases have distinct payment-family boundaries. Add money also has additive `tx_*` tables and its own processing contract.
- Ordinary writes use SQLite transactions; analysis inference runs outside the write transaction and freshness is checked before committing results.
- Default persistent storage is `runtime/tracefix.sqlite3`; `TRACEFIX_DB` selects an isolated database.
- Python connection contexts close handles explicitly and enable foreign keys.

## 2. Main transfer dashboard and payment engine

The main bank-to-upay payment engine implements these eight scenarios:

| Scenario | Saved behavior |
| --- | --- |
| `success` | One bank debit and one wallet credit |
| `delayed_response` | Uncertain response followed by late confirmation |
| `stuck_processing` | Debit held in settlement with an explicit retry contract |
| `confirmed_failure` | Partner rejection with checked return authority |
| `duplicate_payment` | A second debit from retry, with one intended wallet credit |
| `missing_partner_response` | Debit and retry observed, final settlement unknown |
| `retry` | Multiple requests retain one posting identity and complete once |
| `settlement_uncertain` | Partner acceptance without established final settlement |

The processing path contains customer, gateway, bank, queue, response, settlement and wallet stages. Stage records have saved events, attempt context and capabilities. A retry request is distinct from another debit. A missing response remains unknown unless later source records establish the outcome.

Bank/wallet sandbox postings use integer minor units, unique posting identities and balanced ledger entries. Corrective postings refer to the original transaction. Final repair verification checks the remaining unsettled/excess amount and ledger balance before resolving the case.

Customer complaint submission creates or reuses one incident/case for the exact subject. The customer can supply their own context and evidence; internal investigation details remain in staff views. Scenario reset creates an isolated new journey while retaining earlier records.

## 3. Shared case and evidence system

Implemented case features include generated references, exact purchase/QR/transaction context, customer ownership, staff owner, case version, evidence version, source version where applicable, status, next review and saved history.

Evidence features include:

- Immutable original text/file bytes and SHA-256 hash.
- Bounded PNG/JPEG/plain-text uploads and authorization-checked download.
- Preserved original transcript plus appended corrections, actor and reason.
- Exact references, amounts, purchase identifiers and source capability metadata.
- Source event/as-of/received timestamps where provided by the contract.
- Claims and claim corrections, explicit case linking and mismatch gates.
- Customer statements, supplied documents and authoritative mock-source records treated separately.
- Source authority never conferred by a role label, file extension, receipt wording or model score.

The staff claim/evidence matrix displays excerpts, revision, authority, reference mismatch and advisory labels. An unrelated purchase cannot become corroboration through equal amounts or semantic similarity.

Source checks include QR provider, purchase invoice, merchant cash record and repayment record, with saved requested/running/completed/unavailable status. A partial negative or unavailable query is not treated as proof that the transaction never occurred.

The case-level assessment distinguishes missing evidence, conflict, supported excess, no supported excess and recorded repayment. Recorded tender is compared with the exact invoice and returned amount; split tender is not automatically a duplicate payment.

## 4. Customer communication and operational ownership

Implemented communication includes complaints, additional details, case messages, staff replies, evidence requests, review dates and saved customer notifications.

An evidence request has an owner and lifecycle. Staff resolve it with evidence and rationale before a final outcome where required. Human review notes remain saved rather than disappearing on refresh.

Handoff is an explicit requested transfer to another investigator. The originating owner retains responsibility until the receiving investigator acknowledges. Unknown evidence and an owned follow-up remain visibly different from confirmed credit or repayment.

Customer projections are constructed on the server. They include permitted confirmed facts, customer-supplied wording where exposed by that workspace, unresolved requirements, safe verdict/resolution, owner, review and notifications. They omit other customers' cases, hidden scenario profiles, staff-only notes, raw source comparisons and internal model/scan confidence.

## 5. AI/ML implementation

### Trained claim/passage verifier

- Frozen `intfloat/multilingual-e5-small` encoder with normalized 384-dimensional embeddings.
- Trained `StandardScaler` plus class-balanced logistic regression classifier head.
- Features include claim/passage vectors, absolute difference, product and lexical features.
- Three labels: `SUPPORTED_BY_PASSAGE`, `CONTRADICTED_BY_PASSAGE`, `INSUFFICIENT_EVIDENCE`.
- Model inputs are bounded current claim/passage text, excluding scenario profiles and hidden future source records.
- Explicit token-limit abstention; original text is preserved separately.
- Classifier checksum verification, model metadata and explicit unavailable/inference-failed fallback.
- Runtime currently selects rules as the primary advisory path while retaining actual learned labels when inference succeeds.

Dataset/training tooling builds 1,944 synthetic pairs in 324 fictional bundles: 1,080 training, 432 development and 432 grouped test pairs. A separately authored challenge contains 37 pairs. Data cards, annotation guidance, manifests, hashes and blind-review packet tooling are present. Independent human review has not been performed.

The first preserved trained macro F1 is 0.827 on the grouped synthetic test and 0.471 on the authored challenge. Revised rules use the reused challenge and cannot claim an untouched-test score. These are passage-semantics results, not real incident/fraud/refund accuracy.

### Optional local language model

`tracefix/live_ai.py` calls an optional local Ollama provider, defaulting to `qwen3:4b-instruct`. The adapter uses bounded evidence, strict JSON output, a timeout and validation of known citation/hypothesis IDs.

The output schema contains verification, hypothesis order, allowlisted action proposal and evidence IDs. The model receives the already checked verdict and evidence-derived candidate action. It can assist hypothesis ordering and propose an action, but the backend blocks incompatible proposals and retains independent eligibility.

Successful provider use is labelled `LIVE AI INVESTIGATION`. Missing, invalid or timed-out provider output uses the explicitly labelled `DEMO INVESTIGATION — SIMULATED AI TRACE`. Private model reasoning is not stored or displayed.

## 6. AI Investigation Studio

The Studio persists eleven phases:

1. Initialize the investigator.
2. Load case context.
3. Reconstruct the transaction.
4. Retrieve relevant records.
5. Follow the processing path.
6. Compare evidence.
7. Verify claim support.
8. Evaluate possible causes.
9. Check repair eligibility.
10. Generate a cited recommendation.
11. Require an operator decision.

Each saved event contains phase, action, finding, cited evidence, changed state and next step. Hypotheses retain supporting, contradictory and unresolved evidence. The graph and live log reflect saved events, with selection, evidence inspection and camera controls.

Live updates use authenticated event streaming with cursor recovery/polling where implemented. Replay uses saved history and does not execute checks or change money. Interrupted/superseded/stale runs cannot be treated as fresh recommendations; a changed evidence/source snapshot requires another analysis.

## 7. Main Studio sandbox repairs

The implemented actions are `REVERSE_DUPLICATE_DEBIT`, `RETRY_SETTLEMENT` and `SIMULATED_CORRECTION`, together with manual review/no-action outcomes.

Eligibility derives from explicit source records, exact posting identities, contract capabilities, amounts and current evidence. Staff approve a current recommendation before a separate execution request. Execution revalidates ownership, approval state, evidence/source freshness and eligibility.

Balanced corrective postings and resulting source evidence are verified in the same transaction. Failed source operations record a failed attempt without a successful ledger posting. Repeated actions are idempotent. A remaining excess/unsettled amount prevents a successful final closure.

The prototype's synthetic repair is different from a production bank refund. No live financial institution is called and no real money moves.

## 8. Add money guided experience

Add money is independent of QR in homepage navigation, hero actions and its Bank → Wallet → Investigation → Outcome feature.

The walkthrough contains five customer/presenter stages: choose scenario, add money, track transfer, investigate, outcome/report. Backend financial progress remains separately labelled so completing a walkthrough step does not imply money arrived.

Implemented UI/navigation behavior includes:

- Scenario choice before a new run; automatically created empty runs do not imply an explicit selection.
- Four scenarios: worker fault, lost acknowledgement, ambiguous mapping/missing authority and late original completion.
- Same-tab document navigation across surfaces and explicit companion-view links.
- Exact `run` context in known status, investigation, report and return links.
- Resume derived from saved payment/investigation/decision state rather than a fresh form.
- Explicit unavailable-run recovery and readable archived journeys with active-only operations disabled.
- Native modifier clicks, new tabs, anchors and downloads retained.
- Amount presets, selected bank cards, large amount field and bank-to-wallet summary.
- Separate review with masked accounts, fee, confirm action and edit details.
- Draft/review persistence across navigation/refresh without automatic submission.
- Stable idempotency keys across uncertain request responses and retries.
- Complaint text/focus preservation while status updates arrive.
- Status hierarchy: current state, amount/accounts, next step, transfer progress, investigation and updates.

### Add money investigator

The rules-based policy runs a bounded read-only loop over bank record, wallet ledger, partner status, attempts, mapping, worker error and eligibility checks. Each observation is saved with source, scope, timestamp, evidence version and citations. Tool allowlists, budgets and no-repeat constraints are enforced independently of policy output.

The four fixture outcomes demonstrate one safely resumed credit, lost acknowledgement without another credit, blocked correction with owned follow-up, and late original completion. Correction approval and post-correction verification remain separate from investigation.

### Add money board and report

The board retains its topology, graph module, node/edge behavior, selection, pan/zoom, toolbar, queue, inspector Evidence/Hypotheses/Plan tabs, replay, approval and log. Its palette intentionally follows the later site-wide light-theme request.

At narrow widths, queue access uses a drawer and Board/Details/Activity views keep each panel reachable. Selecting a node opens Details; secondary actions are available from a menu. Controls wrap inside the viewport. Citation navigation repaints Evidence even when the cited node was already selected.

Reports include a clear outcome, evidence/checks, provenance, next action, return navigation and existing Markdown/HTML exports. Wide tables scroll within their own regions.

## 9. Unified QR + cash journey

`/qr-demo` is the canonical QR experience. The homepage links to it instead of maintaining a separate hard-coded QR walkthrough.

The phone journey saves purchase creation, QR attempt, failed/unconfirmed display, cash tender, receipt issuance, independently observed bank debit, receipt attachment and complaint. The complaint's saved status is the end of customer intake; the operator opens directly to the evidence stage.

The workspace combines a stage rail, current-stage banner, customer phone and operator panels. Important investigation/customer links are prominent, companion view is explicit, and navigation retains `simulation`, `case` and `view` context. A fresh visit offers start/resume instead of silently selecting a saved record. Refresh, exact bookmarks and browser history restore known context; unavailable/mismatched context gets explicit recovery.

The current-stage banner stays in document flow and scrolls away with the page at all tested widths. Mobile navigation is offset appropriately after removing banner stickiness.

### Receipt drafts and immutable evidence

- Multipart receipt upload is available before the complaint.
- The draft preserves image bytes, hash, MIME type, transcript and simulation association.
- Idempotent retry returns the saved evidence association.
- Complaint submission promotes the exact `receipt_evidence_id` atomically.
- A purchase-specific watermarked synthetic receipt and “Use sample receipt” option are provided.
- Additional post-complaint uploads and previous JSON complaint compatibility remain available.
- A receipt is customer evidence pending corroboration.

### OpenCV scan

Pinned `opencv-python-headless==4.10.0.84` performs image validation, decode, grayscale, normalization, thresholding, paper contour detection, perspective correction where possible, region detection and annotated preview generation.

The manifest records the original evidence ID/hash, engine/version, scan status, regions, displayed transcript values, value source, visual confidence, warnings, timestamp and evidence version. Originals remain immutable and the derived preview is bounded separately.

The operator sees original/annotated receipts, scan beam, staged field highlights, live progress and human-review flags. Reduced-motion mode removes animation and preserves the findings. Scan completion gates Marketplace checks.

OpenCV performs visual assistance, not OCR, authentication or proof of cash payment.

### Synthetic Marketplace and branches

The private, bounded catalog is keyed by the exact purchase. Checks compare purchase, merchant, item, amounts, QR reference, bank reference, timestamp, independent payment context and prior-refund state. There is no external Marketplace request.

| Branch | Implemented handling |
| --- | --- |
| Legitimate | Saved matching source result; refund proposal; current owner approval; saved request; separate simulated completed-refund event; customer update |
| Rejected | Documented explicit denial or exact-context conflict; saved verdict/customer explanation; no refund |
| Uncertain | Missing/unavailable/timeout/conflicting records or incomplete evidence; automation paused; owned human handoff with queue, review time and missing evidence; no refund |

The customer never initiates a refund. A proposed or requested refund is distinct from a completed one. Prior refund state blocks another completion. New evidence or changed source results invalidate earlier decisions.

### QR graph and provenance

The QR renderer has a separate topology and event reducer: Evidence, Marketplace, Payments, Decision and Resolution. Saved events alone drive replay state.

Active edges use thick blue/cyan strokes, glow, arrows and movement. Completed nodes have full tinted surfaces, checks and readable state; uncertainty is amber, rejection red and handoff violet. Reduced motion retains strong state indicators without animated probes. Selection, pan/zoom, fit, replay and evidence citations are implemented.

QR exports include original hashes, revisions, scan metadata, Marketplace results, verdict/resolution/handoff and event history, without embedding preview base64 in Markdown.

## 10. Site-wide visual and accessibility implementation

All six HTML entry documents use the shared default light stylesheet. Homepage, customer pages, QR workspace, Add money, boards, reports, operations and Studio use white/pale surfaces, slate text and blue primary actions.

The supplied landscape image is preserved unchanged at `static/img/hero-landscape.png`, with responsive cropping and white CSS overlays for text readability. The previous dark homepage WebGL background is inactive. The 3D QR scanner remains interactive.

The shared system uses Geist interface text, Plus Jakarta Sans headings and existing monospace references. Status semantics are retained with text/icons, not color alone. Focus styles, native light controls, readable amounts/metadata, reduced motion, responsive panels and local table/image scrolling are implemented.

Mobile QR navigation uses accessible native drawers for steps/sections, with keyboard focus trapping and focus restoration. Add money supports queue drawer and Board/Details/Activity views. Responsive validation covers 320, 390, 768, 1024, 1440 and 1920px.

## 11. Access, idempotency and state protections

- Server-issued opaque fixture sessions, with separate headers/bearer tokens or legacy cookie support.
- Server-side roles, exact customer ownership, case-family guards and staff owner checks where required.
- Idempotency scoped to actor/action/subject with payload digest and saved response; changed payload under one key is rejected.
- Version checks for mutations, evidence/source freshness checks and stale approvals blocked.
- Atomic case/audit/notification updates and preserved historical evidence.
- Original document access checks and bounded file types/sizes.
- No financial or model effects from ordinary case/report/replay reads.
- Separate approval, execution and completed-outcome states.
- Customer-safe projections that prevent internal records leaking through the UI.

Predefined demo-role switching is intentionally available locally. It is not production identity, regulatory certification or authorization to connect real accounts.

## 12. Reports, artifacts and development tooling

- Shared case dossier Markdown exports, Studio Markdown/JSON reports and Add money Markdown/HTML reports.
- Model metadata, classifier hashes, dataset/split manifests, raw predictions, confusion/evaluation artifacts and error analyses.
- Scripts for data generation, model download/training/evaluation, review-packet export and isolated API walkthroughs.
- Windows PowerShell launcher with restart/check/no-browser/reload/alternate-port options.
- Direct Uvicorn launch and locked Python dependencies.
- Browser runners for Add money, QR, site-wide light theme and Add money graph preservation.
- Saved representative screenshots and theme assertion results under `artifacts/ui/light-theme/`.
- README, API/domain contracts, handoffs, runbooks, route guides, narration and validation records.

## 13. Recorded verification and limits

These are recorded checks from the implementation work, not newly rerun results for this documentation-only update:

| Check | Recorded result |
| --- | --- |
| QR backend | 24 passed |
| Combined QR/simulation/workflow/integration/transfer/master suites | 141 passed |
| QR browser journeys | 112 assertions passed |
| Add money browser journeys | 192 assertions passed across four scenarios |
| Shared light theme | 86 assertions passed across ten page types and six widths |
| Desktop Add money graph comparison | Byte-identical 1440/1920 screenshots against baseline graph assets with the same new palette applied |
| Current-stage scroll repair | Browser check passed at all six required widths |

The latest full Python suite has two existing ML failures: dataset/manifest checksum mismatch and unavailable trained inference due to missing local `torch`. Earlier recorded validation on another prepared environment includes actual inference/local model use; that does not establish current provider availability.

Detailed records: [QR validation](QR_UI_VALIDATION.md), [light theme validation](LIGHT_THEME_VALIDATION.md), [Add money validation](ADD_MONEY_UI_VALIDATION.md) and [earlier integration validation](MAIN_SYNC_VALIDATION.md).

Still future work: authorized real source connectors, production authentication/deployment, independent bilingual labels, robust production OCR/voice, a learned next-check policy, operational anomaly learning, real provider correction contracts and measured customer/operator impact. Historical design prompts are scope documents, not evidence that these future capabilities exist.

## 14. Implementation map

| Files | Responsibility |
| --- | --- |
| `tracefix/app.py`, `auth.py`, `store.py`, `domain.py` | App routes, sessions, persistence, case/evidence contract and projections |
| `tracefix/payments.py`, `operations.py` | Main transfer simulation, queue, Studio APIs, approval/execution and reports |
| `tracefix/investigation.py`, `live_ai.py`, `verifier.py` | Durable Studio phases, bounded local model and advisory verifier |
| `tracefix/simulation.py`, `qr_receipt.py`, `qr_workflow.py` | QR customer lifecycle, receipt drafts, scan, Marketplace and outcomes |
| `tracefix/transfer/engine.py`, `contract.py`, `schema.py`, `journal.py` | Separate Add money simulator, source capabilities, storage and events |
| `tracefix/transfer/catalog.py`, `policy.py`, `tools.py`, `investigation.py` | Board topology, bounded policy, read-only checks and investigator loop |
| `tracefix/transfer/correction.py`, `report.py`, `routes.py` | Add money eligibility/approval/verification, reports and role-scoped APIs |
| `static/app.js`, `index.html`, `style.css`, `light-theme.css` | Main website/pages, shared visual theme and navigation |
| `static/console.html`, `console.js`, `console.css` | Dedicated Studio frontend |
| `static/legacy/index.html`, `app.js`, `qr.css`, `qr-graph.js` | Unified QR customer/operator workspace and separate graph reducer |
| `static/pay/` | Add money setup, customer, board, graph, reports and shared frontend helpers |
| `ml/`, `data/`, `models/`, `artifacts/` | Training/evaluation tooling, synthetic corpora, model metadata and recorded outputs |
| `tests/`, `scripts/`, `docs/` | Backend checks, browser/walkthrough tools, runbooks and evidence contracts |

## 15. API route index

The following index is extracted from route decorators in the reviewed application. Role/version/idempotency requirements remain defined by each handler and the linked contracts. Transfer-router paths include the `/api/transfer` prefix.

### app.py

| Method | Route |
| --- | --- |
| GET | `/` |
| GET | `/qr-demo` |
| GET | `/customer` |
| GET | `/operations` |
| GET | `/operations/cases/{case_id}` |
| GET | `/operations/cases/{case_id}/studio` |
| GET | `/admin` |
| GET | `/customer/{rest:path}` |
| GET | `/admin/{rest:path}` |
| GET | `/mfs` |
| GET | `/demo` |
| POST | `/api/session` |
| GET | `/api/session` |
| GET | `/api/payments/{reference}` |
| GET | `/api/cases` |
| POST | `/api/cases` |
| GET | `/api/cases/{case_id}` |
| POST | `/api/cases/{case_id}/details` |
| POST | `/api/cases/{case_id}/evidence` |
| POST | `/api/cases/{case_id}/upload` |
| GET | `/api/evidence/{evidence_id}/file` |
| POST | `/api/cases/{case_id}/correct` |
| POST | `/api/cases/{case_id}/analyze` |
| POST | `/api/cases/{case_id}/claim` |
| POST | `/api/cases/{case_id}/link` |
| POST | `/api/cases/{case_id}/resolve-task` |
| POST | `/api/cases/{case_id}/check` |
| POST | `/api/cases/{case_id}/qr-action` |
| POST | `/api/cases/{case_id}/task` |
| POST | `/api/cases/{case_id}/review` |
| POST | `/api/cases/{case_id}/handoff` |
| POST | `/api/cases/{case_id}/acknowledge` |
| POST | `/api/cases/{case_id}/decision` |
| GET | `/api/cases/{case_id}/dossier` |
| GET | `/api/demo` |
| POST | `/api/demo/advance` |
| GET | `/api/evaluation` |

### operations.py

| Method | Route |
| --- | --- |
| GET | `/api/scenarios` |
| POST | `/api/incidents` |
| POST | `/api/transactions` |
| GET | `/api/transactions` |
| GET | `/api/transactions/{identifier}` |
| POST | `/api/transactions/{identifier}/advance` |
| POST | `/api/transactions/{identifier}/complaint` |
| POST | `/api/demo/scenarios/{identifier}/reset` |
| GET | `/api/operations/overview` |
| POST | `/api/cases/{case_id}/investigations` |
| GET | `/api/investigations/{identifier}` |
| GET | `/api/investigations/{identifier}/events` |
| GET | `/api/cases/{case_id}/investigations` |
| POST | `/api/cases/{case_id}/pipeline-check` |
| POST | `/api/cases/{case_id}/repairs/eligibility` |
| POST | `/api/cases/{case_id}/approvals` |
| POST | `/api/cases/{case_id}/repairs/execute` |
| POST | `/api/cases/{case_id}/operator-outcome` |
| GET | `/api/cases/{case_id}/report` |

### simulation.py

| Method | Route |
| --- | --- |
| GET | `/api/simulations` |
| POST | `/api/simulations` |
| GET | `/api/simulation-inbox` |
| GET | `/api/simulations/{identifier}` |
| POST | `/api/simulations/{identifier}/action` |
| POST | `/api/simulations/{identifier}/complaint` |
| POST | `/api/simulations/{identifier}/receipt` |
| POST | `/api/cases/{case_id}/messages` |
| POST | `/api/cases/{case_id}/repayment-request` |
| POST | `/api/simulations/{identifier}/repayment` |

### transfer/routes.py

| Method | Route |
| --- | --- |
| POST | `/api/transfer/session` |
| GET | `/api/transfer/config` |
| GET | `/api/transfer/scenarios` |
| GET | `/api/transfer/runs` |
| POST | `/api/transfer/runs` |
| POST | `/api/transfer/runs/{run_id}/clock` |
| POST | `/api/transfer/payments` |
| GET | `/api/transfer/payments` |
| GET | `/api/transfer/payments/{payment_id}` |
| GET | `/api/transfer/customer/cases/{case_id}` |
| POST | `/api/transfer/payments/{payment_id}/report` |
| GET | `/api/transfer/staff/queue` |
| GET | `/api/transfer/staff/cases/{ident}` |
| POST | `/api/transfer/staff/cases/{ident}/investigate` |
| POST | `/api/transfer/staff/cases/{ident}/corrections/{plan_id}/approve` |
| GET | `/api/transfer/staff/cases/{ident}/report` |
| GET | `/api/transfer/staff/cases/{ident}/report.md` |
| GET | `/api/transfer/staff/cases/{ident}/report.html` |
| GET | `/api/transfer/events` |
| GET | `/api/transfer/stream` |
