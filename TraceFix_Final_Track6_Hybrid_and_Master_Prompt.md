# TraceFix: Final Track 6 Decision, Hybrid Specification and Master Build Prompt

Final scope decision: 3 October 2026, Asia/Dhaka.

This document supersedes the two compared design specifications for the competition scope. It is a researched specification, not an inspected application, trained model, measured pilot or awarded score.

## Part A — Comparison and final decision

### 1. Decision

Build **TraceFix — Paid-Twice Investigation Workspace**.

Use the previous proposal's primary problem and ML task: investigate QR merchant complaints about paying twice for one purchase, beginning with mixed cash/QR evidence.

Use the attached interaction guide's operational foundation: owned cases, investigator inbox, evidence timeline, saved reviews, escalation ownership, source freshness, versioned recommendations, customer-safe updates, idempotent operations and audit history.

Do not combine the complete bank-to-wallet recovery system with a complete merchant-dispute system. Those are different payment journeys and create two validation burdens. The hybrid is one investigation product with one primary learned task.

**The attachment is the better service-workflow specification. The paid-twice proposal is the better primary competition task for this build. The selective hybrid is the final recommendation.**

### 2. What each plan does better

| Dimension | Attached interaction guide | Previous paid-twice proposal | Final choice |
|---|---|---|---|
| Main problem | Uncertain bank-to-wallet add-money outcome | Possible double payment for one merchant purchase | Paid-twice merchant investigation |
| Main AI task | Predict causes and rank useful source checks | Assess claims against multilingual evidence | One claim/evidence verifier |
| Customer journey | Detailed intake, status, ownership and follow-up | Less complete service workflow | Retain and adapt the attachment's journey |
| Operational controls | Thorough source, freshness, retry and version handling | Strong provenance principle, fewer mechanics | Retain applicable controls |
| Need for learned behavior | Must beat a competent rules investigator across a small source set | Semantic interpretation is a more direct learned task | Verify the latter against strong baselines |
| Integration burden | Bank, provider, wallet and recovery/finality contracts | Records and documents for one merchant dispute family | Imports and read-only mock evidence checks |
| Money-moving risk | Explicit mock recovery and original-credit fencing | Human review dossier | No money-moving API in the competition release |
| Local specificity | upay's funding flow is publicly documented | Defined local merchant-dispute category | QR complaints with an explicit integration boundary |
| Novelty | Direct overlap with international payment-investigation platforms | Direct overlap with international dispute-evidence platforms | Modest workflow differentiation, supported by testing |
| Build risk | Extensive P0 and an optimistic five-hour schedule | Dataset quality, multilingual inference and documentary uncertainty | Small integrated workflow, then one evaluated model |

This comparison is architectural judgment, not evidence that either proposed system already performs better.

The attached model is not inherently pointless. Learned check selection can be useful when source outcomes, availability and costs vary materially. Here, however, it must outperform rules that already skip fresh checks, inspect authoritative records first and wait during outages. A simulated cost table cannot establish a real commercial advantage.

### 3. Evidence and its limits

**Local dispute category:** Bangladesh Bank's indexed official circular identifies reason code 2414 for an allegation that one purchase was paid for twice using QR or another payment method. [S1]

**Sponsor relevance:** upay's own app listing advertises QR payments at physical stores and bank/card funding. QR merchant payments are therefore a published product capability. This does not establish upay's exact Bangla QR routing, internal dispute procedure, case volume or API availability. [S2]

**Broader service problem:** TIB reports that 61.9% of surveyed complainants received no solution from MFS providers. Among respondents who experienced problems, 22.2% reported delays or failures in depositing funds into recipient accounts. These are survey subgroup findings, not upay-specific statistics or paid-twice prevalence. [S3]

**Competition:** EvonSys TracEI advertises AI-guided payment-investigation actions. Pega advertises guided dispute workflows and recommendations. Chargeflow documents AI-assisted evidence assembly and response preparation. These substantially overlap with both plans. [S4–S6]

**Existing Bangladesh components:** Islami Bank's portal supports ATM dispute filing and claim tracking; SSLCOMMERZ documents transaction/refund query capabilities. These are component precedents, not proof of an identical multilingual evidence verifier. [S7–S8]

I did not verify the exact proposed learned workflow as a deployed Bangladeshi product in the inspected sources. That bounded result does not prove that private internal systems are absent. Do not claim “first in Bangladesh.”

The official circular was available through indexed primary excerpts; complete direct PDF retrieval was unsuccessful. Verify the complete document and actual operator procedures before implementing regulatory deadlines or presenting compliance claims. The prototype uses clearly labelled service-policy assumptions.

### 4. The holes, with concrete changes

Some of these risks were already addressed in one or both input specifications. The table makes them explicit implementation requirements; it does not claim that the attachment permitted unsafe automated refunds.

| Hole | Change in the final design | Residual limit |
|---|---|---|
| QR success might wrongly close a paid-twice complaint | QR completion satisfies only its own claim. Purchase linkage, second-payment evidence and repayments remain separately reviewed. | Staff still needs evidence outside the QR record. |
| A receipt might be mistaken for authenticated cash movement | Separate semantic support, supplied provenance and verification method. Uploaded files never gain authority from the uploader's role alone. | Physical cash cannot be independently established from pixels. |
| Equal amounts might be called duplicates | Exact references and purchase mapping first; different invoices and split tender are hard negatives. | Ambiguous purchase linkage needs human review. |
| A merchant might deny payment | Preserve conflicting statements, identify the unresolved question and escalate to an owned queue. | AI cannot adjudicate absent facts or compel repayment. |
| Existing refund might be ignored | Keep repayment evidence separate; derive record-backed amounts with integer arithmetic. | An accepted refund request is not a completed repayment. |
| Complaint data might be incomplete | Accept intake, permit assisted entry and ask one useful evidence question at a time. | Missing evidence can limit the conclusion, but does not erase the complaint. |
| AI confidence might be called financial truth | Train evidence labels, not refund approval. Keep action eligibility independent of model scores. | A supported passage can still be false or unauthenticated. |
| Synthetic training might leak the answer | Separate hidden scenario truth from visible evidence; split entire dependent case/template groups. | Simulator results do not establish production accuracy. |
| Benchmark might favor AI artificially | Compare with strong rules and an LLM-only alternative at comparable evidence and usable coverage. | Small tests may remain inconclusive. |
| A stale recommendation might survive new evidence | Bind analysis and recommendations to evidence/case versions; invalidate them after a meaningful update. | Historical statements remain inspectable, not current conclusions. |
| Customer refreshing might run checks repeatedly | GET status returns saved state only; checks and analysis have explicit request identities. | The application still needs ordinary persistence and job handling. |
| Cases might wait forever without responsibility | Every open case has an owner plus a saved review or an acknowledged escalation follow-up. | Service targets require a real operating team. |
| Two products might double the workload | One case family, one main ML task, one active judge journey. | Bank-to-wallet investigation remains future scope. |
| Five hours might be promised unrealistically | Use that budget only as an emergency delivery constraint; inspect existing assets and compute first. | Full training, evaluation and deployment cannot be guaranteed from scratch. |

### 5. Scope freeze

**Essential:** owned customer intake; multilingual text; staff queue; timeline; document/source viewer; evidence matrix; actual verifier inference; correction and re-analysis; missing-evidence requests; saved follow-up; escalation/handoff; grounded dossier export; customer-safe status; audit; four demonstrations and an independent benchmark.

**Conditional:** receipt OCR if a working component can be integrated and checked; a grounded LLM draft if it materially helps and remains source-linked. Uploaded images with a clearly labelled human transcript are a supported fallback.

**Deferred:** learned next-check optimization, bank-to-wallet recovery, full wallet construction, automatic reimbursement, national dispute-system submission, external SMS/email, voice intake, incident clustering and more dispute categories.

The decision changes neither Track 6 nor the product family when a model underperforms. Improve the same evidence task or report the limitation. Do not open another track-selection exercise.

### 6. Honest rubric assessment

The official supplied handout assigns the following weights.

| Criterion | Weight | Why the hybrid is preferable | What is still unearned |
|---|---:|---|---|
| Problem relevance | 20% | One concrete operational dispute and a clear staff action | Exact upay workflow and case prevalence |
| AI/ML depth | 20% | A trainable multilingual evidence task with hard negatives and ablations | A trained checkpoint and independent results |
| Business/customer impact | 20% | Preparation effort, unsupported conclusions and customer comprehension can be measured | Real provider savings, retention or recovery outcomes |
| Prototype quality | 15% | The attachment's complete journey supports an integrated demonstration | Actual implementation evidence |
| Innovation | 10% | Specific mixed cash/QR evidence treatment and visible uncertainty | Category invention; substantial foreign overlap remains |
| Scale/integration | 10% | Read-only evidence contracts and dossier exports reduce the initial dependency burden | Approved partner access and production throughput |
| Responsible AI/security | 5% | Provenance, roles, audit and human financial decisions are explicit | Passing acceptance checks and production governance |

**Proceed with this hybrid.** It is a stronger build specification than either plan alone. There is no defensible numerical total for an unbuilt submission. A description cannot establish perfect tens, and adding more models would not fix that.

The most important commercial uncertainty is dispute volume and actual preparation effort. The most important technical uncertainty is whether the verifier improves useful evidence interpretation over strong rules and general-purpose prompting.

## Part B — Standalone master build prompt

Copy Part B into the development environment. Its scope is authoritative for this build; earlier documents are supporting references where they do not conflict.

### Your role and outcome

You are the engineering and ML implementation lead for TraceFix, a Track 6 Operations & Service Intelligence hackathon prototype for an upay-relevant merchant-payment investigation workflow.

Build a working **Paid-Twice Investigation Workspace** for one merchant purchase allegedly paid by cash and QR, with QR-plus-QR examples included in evaluation. Deliver one customer-to-investigator-to-customer journey and one primary trained evidence-verification capability.

Work autonomously on reversible implementation choices. Inspect the repository before deciding what to replace. Do not ask the user to pick another track or reopen the product decision. Resolve ordinary technical choices from the available code, runtime and time budget.

Produce implemented behavior, inspectable model artifacts and truthful evaluation. Never substitute a polished mock screen for functionality while describing it as completed.

### 1. Start with an implementation audit

Inspect repository instructions, current stack, routes, database, model code, fixtures, deployment setup and existing tests. A file named “AI” does not establish trained inference.

For each essential capability record:
- working and verified;
- present but incomplete;
- absent;
- not verifiable.

Retain working customer/staff UI, state handling and compatible APIs. Publish a mapping from required meanings to actual fields and routes before changing contracts. If an old bank-to-wallet path exists, preserve useful components and isolate that legacy journey from the active competition scope.

If no application exists, choose a minimal web UI, Python inference service and persistent database appropriate to the environment. Prefer one origin, one documented start sequence and the existing toolchain over introducing multiple services. Do not add a vector database, event bus or agent framework without a demonstrated requirement.

Check available compute, model download access and remaining build time before promising fine-tuning. Record what is actually feasible. A 300-minute budget is an emergency assumption from the attachment, not a verified competition limit or a guarantee.

### 2. Product definition and boundaries

Illustrative scenario: a customer attempts a ৳500 QR payment, sees an unclear response, and reports paying ৳500 cash for the same purchase. A QR record later shows completion. The investigator must review the alleged second payment, purchase relationship and any repayment.

This is a synthetic demonstration, not a verified customer incident.

The system:
1. collects and preserves the complaint and supplied evidence;
2. reconstructs record-backed events;
3. assesses textual support and contradiction with ML;
4. shows source provenance and missing evidence;
5. helps staff prepare and hand off the case;
6. communicates saved, authorized progress to the customer.

The system does not approve or execute refunds, trace money through inaccessible institutions, authenticate receipts from appearance, decide fraud, or certify legal eligibility.

Staff can record a review decision and attach supporting evidence. That workflow record never creates a financial posting. If repayment evidence later arrives, show exactly what the authoritative record establishes.

### 3. Users and journeys

**Customer**
- Open the portal in a server-issued fictional customer session.
- Find an owned QR payment by exact reference, or open unlinked support intake when an accessible match cannot be established.
- Report that they believe the purchase was paid twice.
- Provide approximate purchase details, payment methods and a Bangla/Banglish/English description. Do not require a formal receipt to accept intake.
- Add a receipt or other details if available.
- Receive one stable case reference, acknowledgement, owner and actual saved next review.
- Follow confirmed facts, unresolved questions and the next operational step.
- Ask for further review without creating a new financial transaction or silently replacing the original case.

**Investigator**
- Open the staff inbox and see owned, overdue, waiting and escalated work.
- Inspect the case, source timeline and documents.
- Run analysis on the current evidence version.
- Inspect each claim/evidence relationship and source authority separately.
- Correct an OCR transcript, evidence link or proposed claim; preserve the original.
- Perform a permitted read-only mock check or create an evidence-request task.
- See what changed and which prior analysis became stale.
- Save a review, hand off, escalate or export a dossier.
- Record a human review decision with cited evidence. Financial outcomes remain separate.

**Judge**
- Open an isolated demo area with explicit synthetic disclosure.
- Run four seeded journeys and inspect actual model identity, evidence versions and measured benchmark artifacts.
- Advance mock time or reveal an evidence response through demo controls.
- Never see hidden truth leak into ordinary inference inputs.
- See “Evaluation not yet run” until a real evaluation result exists.

### 4. Essential screens and interaction design

**Landing page:** one clear explanation, a purposeful purchase/payment illustration using fictional records, and primary actions to open the customer demo or staff demo. Show that the prototype uses synthetic money and mocked evidence. Avoid a generic “AI changes everything” hero.

**Customer intake:** a short sequential form; accessible reference lookup; one-purchase context; claimed second method; optional description and upload. Explain an unmatched reference without revealing another customer's records.

**My cases:** a simple list showing reference, status, last update and saved next step.

**Customer case:** amount claimed, permitted confirmed facts, unresolved question, next review and updates. “Your QR payment was confirmed” must not imply the paid-twice complaint is resolved.

**Staff inbox:** compact rows with owner, case age, unresolved requirement, analysis freshness and next review. Queue ordering is deterministic; no new priority model.

**Investigator workspace:** evidence matrix and timeline in the main area, source viewer beside them, action strip below. Clicking a claim opens its actual source passage or receipt. Make provenance, contradictions and required follow-up easy to inspect.

**Demo/evaluation:** scenario controls separate from customer/staff views; actual evaluation metadata and limitations; no decorative invented metrics.

Visual direction:
- Warm ivory background, dark ink text, deep teal for navigation/actions, amber for incomplete evidence and restrained red for conflicts.
- Use typography, rows, document surfaces and alignment to organize the workspace.
- Use cards only for bounded units such as a receipt preview, a single outstanding request or a small customer outcome summary.
- Keep source documents recognizable as documents, not a grid of interchangeable cards.
- Use readable Bengali-capable fonts and text labels alongside colors.
- Customer views must work at narrow mobile widths; staff desktop split views must collapse into an intelligible evidence/source sequence.
- Keep focus visible, labels explicit and error messages near their controls.
- Honor reduced-motion preferences. Use short transitions for opened source panels and saved-state feedback. Smooth scrolling can navigate to a selected claim, but must not hijack native scroll or keyboard behavior.
- A “checking” animation appears only while a real task is executing. A recommendation is not a running check.
- Preserve the last saved status on connection failure. Do not declare a new payment state when refresh fails.

Preserve an existing intentional visual system if it already works; adapt it to this investigation rather than redesigning every page.

### 5. Evidence and source-authority contract

Keep separate:
1. complaint/workflow state;
2. source-scoped financial facts;
3. document assertions and provenance;
4. analysis/check execution state;
5. human review decisions.

Every source contains a source ID, type, supplied-by role, received time, event/as-of time where applicable, scope, record reference and verification method. Every document has a content hash and immutable original. A hash establishes change detection, not authenticity.

Supported source examples:
- simulated authoritative issuer/payment records, under a documented fixture contract;
- simulated acquirer/merchant-completion records, if that mock source explicitly has that capability;
- customer-supplied receipt or screenshot;
- merchant-supplied statement, initially unverified;
- a merchant confirmation obtained through a declared mock verification process;
- supplied refund request versus authoritative completed-repayment record.

An issuer debit proves that source's debit, not automatically merchant receipt. A provider “success” response proves its reported status, not every downstream financial posting. Define source capabilities explicitly rather than treating all CSV rows as equivalent.

An uploaded CSV never becomes authenticated financial evidence merely because staff uploaded it. For a real deployment it needs an approved ingestion/verification contract. In the demo, distinguish source fixtures from arbitrary user uploads.

For model results show two independent dimensions:
- **textual assessment:** SUPPORTED_BY_PASSAGE, CONTRADICTED_BY_PASSAGE, INSUFFICIENT_EVIDENCE;
- **source status:** customer reported, merchant supplied/unverified, or confirmed within the documented simulated source contract.

Do not merge them into an authenticity, fraud or reimbursement score. Conflicting relevant passages remain visible. Staff resolves the investigation; ML does not promote evidence authority.

### 6. Purchase and payment semantics

Use unique purchase, logical payment, attempt and posting identities where available. A transport retry does not become a new purchase. A genuine second purchase remains distinct even when amount and time are similar.

Prefer exact references and verified mappings. Fuzzy retrieval may propose a document candidate; it cannot silently bind a different customer's transaction or make a financial conclusion.

Same amount plus nearby time is insufficient to establish duplication. Include:
- two legitimate equal-value purchases;
- split tender, such as ৳500 QR plus ৳500 cash for a ৳1,000 purchase;
- an alleged cash payment without corroboration;
- partial or complete repayment;
- unrelated, copied and conflicting receipts.

Store BDT amounts as integer minor units with explicit scale: ৳500 is 50000 at scale 2. Keep customer-reported amounts distinct from imported ledger amounts.

Use deterministic arithmetic for record-backed amounts. Do not calculate “refund owed” from an unverified cash allegation. The UI can show a claimed amount and separately confirmed postings without declaring legal or financial liability.

QR completion alone never completes a paid-twice investigation. A repayment request alone never establishes returned money.

### 7. Claim structure and evidence matrix

Start with a small fixed claim inventory for this case family:
- the relevant QR payment completed under the available source contract;
- the customer reports a second payment;
- supplied evidence describes a cash or second-QR payment;
- the alleged payments relate to the same purchase;
- a specified repayment is recorded, requested, or still unconfirmed.

Use the intake fields to anchor these claims. Preserve customer wording. A schema-checked LLM extractor is optional; it must return candidate claims with source spans, not financial conclusions.

For each claim store:
- case and claim ID;
- original text and normalized model text;
- relevant purchase/payment references;
- candidate evidence IDs and exact excerpts;
- source/transcript versions;
- deterministic reference/amount mismatch findings;
- model label and model version;
- provenance/authority status;
- unresolved conflicts or missing evidence;
- human corrections with actor/time/reason;
- case version and analysis freshness.

Source citations must resolve to actual preserved passages. Retain original Bengali characters and numbers; keep a mapping or separate source excerpt when normalization changes model text. Do not highlight invented OCR regions or fabricate bounding boxes.

Separate passage support from the overall case conclusion. One supporting customer statement does not eliminate a merchant denial. No model label can override a critical exact-reference mismatch.

### 8. Primary ML implementation

Train one multilingual text-pair verifier. Input is a claim plus a bounded evidence passage; output is one of the three textual-assessment labels. This is evidence interpretation, not financial decision prediction.

Preferred candidate when compute and time permit: fine-tune XLM-RoBERTa base for three-label sequence classification with text pairs. Its published card lists Bengali and an MIT license. These facts are a reuse starting point, not proof of financial or Banglish accuracy. [S9]

Lighter compute alternative: freeze a multilingual encoder such as E5-small, form claim/passage pair features, and train a small classifier. Describe the encoder as frozen and the classifier as trained. E5 retrieval similarity by itself is not an evidence label or calibrated truth probability. [S10]

Inspect available resources and run a small training/inference smoke check before expanding the dataset. Tune model settings on development data. Use bounded passages with enough context to preserve negation and qualification; detect truncation instead of silently dropping material text.

Use exact-identifier candidate lookup first. Add multilingual retrieval only for narrative evidence within the authorized case/corpus. Do not build cross-customer global retrieval.

Keep source authority outside the NLI classifier. Apply deterministic source/reference gates when presenting operational facts. The trained task can assess what a note says without authenticating its author.

Persist tokenizer/model version, label map, checkpoint hash, preprocessing configuration, split manifest and training metadata. Load the real artifact during inference. Emit a clear unavailable/stale result when it is not loaded.

Do not claim:
- full fine-tuning if only a head was trained;
- a trained verifier if the output comes from scenario names;
- financial-domain validation from a general-language model card;
- calibrated confidence without an appropriate independent calibration procedure;
- fraud detection from a model trained for entailment.

Do not add the attachment's cause classifier or learned outcome table to P0. Next evidence requests are generated from explicit unresolved requirements and approved workflow rules. The staff panel accurately identifies that step as rules-based.

### 9. OCR and drafting

If a working OCR component exists, integrate it for printed Bengali/English receipts and store the original image plus transcript. Validate the chosen engine/language configuration on the actual fixture layouts. Critical amounts, references and tender labels must be correctable.

If OCR is unavailable or unreliable, accept a clearly labelled human transcript. The model then analyzes that transcript, not the unseen image. Include transcription effort in any workflow timing comparison.

Do not make handwriting, universal receipt recognition or image-authenticity detection a prerequisite.

Dossier drafting may use templates. If an LLM is added, restrict it to the authorized case evidence, validate its structured output, and attach source citations to material statements. Treat embedded instructions in complaints/documents as data. Do not give this drafting component tools that move money, alter evidence authority or fetch arbitrary customer records.

A missing model or drafting service activates an honest rules/template fallback. The fallback does not impersonate trained inference.

### 10. Data construction and annotation

Create fictional case bundles with hidden scenario truth and visible evidence stored separately. Runtime inference receives only the visible layer.

Evidence labels describe the visible material. If the hidden scenario contains a real cash handoff but no visible corroboration, the system must not learn that the claim is established merely from the generator's truth.

As a planning range, 200–400 bundles and approximately 1,000–2,000 reviewed claim/passage pairs can support an initial experiment if time permits. These are proposed workloads, not preexisting data or a promise of adequate generalization. Prioritize quality and hard cases over bulk generated paraphrases.

Include Bangla, Banglish and English; implicit/explicit negation; ambiguous tender descriptions; inconsistent dates; amount/reference mismatch; split payments; unrelated receipts; multiple purchases; refunds; missing merchant confirmation; merchant denial; and evidence updates.

Human reviewers must inspect labels independently of the generator. Resolve disagreements against an annotation guide. LLM-authored variants cannot constitute the entire independent test set.

Keep complete purchase/case variants, shared template families and dependent examples within one split. Partition connected dependent groups together. Avoid labels encoded in filenames, source tags, scenario names, generator seeds or uniquely predictable layouts.

Reserve independently written, reviewed test cases. Roughly 40–60 independent case bundles is a possible pilot target, not a safety certification. Report the actual sample count and language mix. Never count many pairs from one case as independent customer incidents.

Use training data to fit preprocessing and learned components. Use development data for selection; separate calibration data if calibration is performed. Freeze final test cases before model selection. Improvements after examining final errors require a new, clearly versioned evaluation rather than relabelling the same test as untouched.

Save the generator, annotations, adjudication notes, data cards and split manifest. No real account details or customer documents enter demo fixtures.

### 11. Evaluation and useful comparison

Run equivalent cases through:
A. exact matching, OCR/transcripts and strong rules/templates;
B. multilingual retrieval plus templates;
C. an LLM-only evidence/dossier workflow, if available;
D. the proposed trained verifier plus deterministic gates and source handling.

Do not handicap the rules baseline by making it repeat irrelevant work. Give methods comparable evidence, case boundaries and stopping conditions. Include extraction/transcription effort consistently.

Report:
- evidence-link precision;
- unsupported claim rate;
- unsupported operational assertions, such as calling cash verified or repayment completed without an authoritative basis, separately from passage-label errors;
- recall of missing evidence and contradictions;
- three-class performance and confusion matrix;
- useful coverage and abstention;
- critical-field extraction errors, separately from verifier errors;
- source-citation correctness;
- language, document-quality and template slices;
- actual inference cost/latency;
- reviewer corrections and measured preparation time.

Perform ablations such as removing the verifier and removing retrieval. Demonstrate what the trained component adds, rather than attributing ordinary arithmetic or workflow automation to ML.

Run a small counterbalanced preparation study if feasible: the same quality checklist, comparable case difficulty, different task order, manual versus assisted preparation. Identify participants honestly. Student results are not bank staff validation.

Measure customer comprehension separately: can a user identify what is confirmed, what is unknown and the next saved update?

Do not equate a quicker generated answer with a quicker valid investigation. Count waiting, incomplete cases and correction work. Report sample counts, variability and limitations. Safe-looking abstention is not a win if almost no cases become useful.

A release benefit is faster preparation or better evidence interpretation without more unsupported conclusions at comparable useful coverage. Set acceptance criteria before final testing. No improvement percentage is preapproved as a result.

If ML does not beat simpler approaches, preserve the product, disclose the result and use the most reliable runtime path. Do not regenerate the simulator until ML wins or change tracks. Keep the measured learned-model result available for inspection.

### 12. Workflow, read-only checks and follow-up

Supported staff actions:
- analyze the current evidence snapshot;
- inspect or correct a document transcript;
- refresh a permitted mock QR or repayment source;
- create an in-app mock evidence-request task;
- save a next review;
- hand off or escalate;
- export a dossier;
- record a human review decision.

Evidence requests name the actual missing question, such as a purchase invoice or merchant acknowledgement. Present one actionable request rather than a generic list of every possible document.

A request has an owner, creation time, status and saved follow-up. Do not send external SMS/email or merchant messages in this build. A mock merchant response is clearly a supplied synthetic observation, not a verified external contact.

Permitted review decisions are evidence assembled for review, further evidence required, referral/escalation, or an outcome recorded with its supporting source. A referral remains an owned open follow-up until acknowledged. Do not implement automatic financial approval or rejection behind a generic decision button.

Read-only checks have REQUESTED, QUEUED, RUNNING, COMPLETED, UNAVAILABLE and FAILED states. A request does not appear to run before execution. Negative search results specify scope and as-of time; absence from a partial search does not establish that the event never happened.

New evidence invalidates current analysis and updates permitted next steps. Show a concise “What changed” notice tied to saved facts. Customer refresh reads the saved case and never launches a partner query, model run or action.

Every open case has an owner plus a saved next review or owned escalation follow-up. Mark overdue work honestly. A failed handoff retains responsibility with the original owner until acknowledgement.

Keep customer updates grounded in events. “Review scheduled” uses a persisted time. An investigation review time is never a refund promise.

### 13. Minimal persistence and API meanings

Use the actual repository's names where possible. The minimum domain objects are:
- demo session/user and role;
- case, owner and case version;
- purchase context and linked payment references;
- source record/document and transcript versions;
- customer claim and evidence relationship;
- analysis result and model identity;
- read-only check request/result;
- evidence request/review task;
- handoff/escalation;
- human review decision;
- audit and customer-safe notification event.

Useful route meanings, to map to an existing API:
- owned transaction lookup;
- create/reuse complaint;
- customer list/read/add details;
- staff list/read;
- add evidence or correction;
- run analysis;
- run permitted read-only check;
- schedule review/request evidence/handoff/escalate;
- record review decision;
- export dossier;
- isolated demo scenario/time control;
- completed evaluation retrieval.

No financial action route is added. Existing money-moving routes are not reachable from the active competition flow and must not become callable merely by hiding their buttons.

Use a separate server-side customer response schema. Do not send staff-only documents, counterpart identifiers, model probabilities or unrestricted notes and rely on the browser to conceal them.

Idempotency and concurrency:
1. authenticate and authorize;
2. check a scoped operation key and payload hash;
3. return an already completed authorized identical operation without repeating work;
4. for a new operation, validate the current case version and permissions;
5. atomically persist the operation and state change;
6. reject stale new writes and changed-payload key reuse.

A successful retry must not fail merely because its original operation advanced the case version. Two investigators cannot overwrite each other's reviewed state silently.

Intake deduplication uses exact owned mappings where available. Do not merge different purchases by amount/time. Unlinked complaints have stable request identities and can be explicitly linked later after authorized review.

### 14. Dossier export

Export a saved HTML/Markdown dossier first; PDF is optional if a reliable component already exists.

Include:
- case and evidence version;
- customer allegation, labelled as reported;
- masked purchase/payment summary;
- record-backed timeline;
- claim/evidence matrix with source excerpts and provenance;
- contradictions, missing proof and attempted checks;
- repayment observations without invented entitlement;
- owner, next review and handoff status;
- human corrections;
- model/rules identity and analysis time;
- reviewer decision, if any, clearly separate from financial execution;
- visible synthetic disclosure.

Export only an authorized case. Cite preserved evidence IDs or controlled links. A dossier hash/version helps track edits but does not authenticate the underlying financial story.

### 15. Four judge journeys and additional hard cases

**Journey 1 — Cash plus QR, linked purchase:** supply a completed QR record, matching invoice and merchant confirmation under the defined synthetic verification contract. The system links the evidence and prepares a review dossier; it does not execute reimbursement.

**Journey 2 — Legitimate repeated purchases:** supply two equal QR payments and distinct purchase evidence. Keep both purchases separate. Do not call amount similarity proof of duplicate payment.

**Journey 3 — Cash still unestablished:** supply the customer's complaint and an unverified cash receipt without merchant corroboration. Show textual support and unverified provenance separately. Accept the complaint and save a concrete follow-up.

**Journey 4 — Repayment update:** add a repayment request, then a matching completed-repayment observation through the mock read-only adapter. Keep requested and completed distinct; invalidate the prior analysis; show the new record-backed amount summary.

Additional acceptance cases include split tender; contradictory merchant response; blurry/wrong OCR amount; unrelated receipt; stale positive evidence; source unavailable; new evidence after a review decision; and malformed or prompt-like complaint text.

The four curated demonstrations are not the independent performance test set.

### 16. Security and meaningful acceptance checks

Enforce customer ownership and staff permissions on the server. A role selector requests a predefined server-issued fixture session; changing a URL or client variable does not grant authority.

Treat uploaded documents and complaint text as untrusted data. Bound file size and accepted types; prevent active content execution and unsafe rendering. Keep generated identifiers in public demos; mask sensitive fields and avoid raw complaint/account data in general logs.

Run meaningful checks:
- another customer's reference discloses no case details;
- a customer session cannot call staff actions;
- QR success does not resolve the remaining paid-twice questions;
- same-amount purchases and split tender remain distinct;
- a customer upload cannot grant source authority;
- a merchant denial stays visible and causes an owned follow-up;
- a refund request is not a confirmed repayment;
- stale analysis is rejected or labelled after an evidence update;
- duplicate authorized requests do not duplicate checks, uploads or notifications;
- changed-payload idempotency keys return a conflict;
- simultaneous investigators receive a safe conflict or prior saved operation;
- GET refresh has no query/inference/action side effects;
- missing model produces an honestly labelled fallback;
- hidden scenario truth and future events are absent from model/runtime responses;
- source citations point to the actual preserved evidence version;
- escalation failure retains the originating owner;
- unsupported complaint text cannot trigger tools or financial routes;
- missing benchmark files produce “Evaluation not yet run.”

Record commands and observed results. No test passes merely because this prompt lists it. Run repository checks appropriate to actual changes and inspect the mobile customer journey.

### 17. Ordered execution with exit gates

**Gate 1 — Audit and contract:** repository inspected, scope mapped, source capabilities defined, four fixtures and state meanings frozen.

**Gate 2 — Running deterministic journey:** persistent owned case, staff review, evidence/source viewer, saved follow-up and dossier work without a model inventing facts.

**Gate 3 — Benchmark foundation:** annotation guide, baseline and independent splits exist before model selection.

**Gate 4 — Actual ML:** trained artifact loads, inference uses current visible evidence and validation/error analysis is recorded.

**Gate 5 — Integrated hybrid:** evidence changes update analysis freshness, staff next steps and customer-safe saved status.

**Gate 6 — Competition evidence:** acceptance checks, four demonstrations, evaluation limitations and measured outcomes are available.

Do not spend the last hour adding animation, another model or another case family. If time is insufficient, preserve the working investigation and accurately label unfinished ML/evaluation. The scope stays fixed; implementation status stays truthful.

### 18. Business validation and judging materials

Prepare a short impact sheet:
- who currently assembles the case;
- which manual steps the prototype assists;
- measured preparation/correction differences, if available;
- case-volume assumptions, separately from measurements;
- model/infrastructure cost per case;
- customer comprehension and follow-up reliability;
- what authorized integration is needed next.

A future cost estimate is source-check cost plus measured staff time times staff cost per minute plus inference/infrastructure cost. Synthetic units are not BDT savings. Provider-wide savings require actual case volume.

Future validation starts with authorized retrospective cases, then shadow evaluation, then a limited supervised pilot. Confirm the real QR integration, evidence authorities, merchant contact process, internal case types and data permission before claiming production fit.

Map submission evidence to the supplied rubric: relevance 20%, AI/ML depth 20%, impact 20%, prototype 15%, innovation 10%, scale/integration 10%, responsible AI/security 5%.

State global overlap plainly. The distinctive claim is a tested local evidence workflow, not universal invention or automatic recovery.

### 19. Required final implementation handoff

Deliver:
1. the running application and exact start/deploy instructions;
2. the P0 audit with file/route evidence and remaining gaps;
3. training code, data schema, split manifest, model artifacts and licenses;
4. raw evaluation outputs with sample counts and actual measurements;
5. acceptance-check commands/results;
6. the four reproducible judge journeys and dossier exports;
7. a one-page factual pitch and likely judge objections;
8. a brief backlog limited to authorized data validation and clearly deferred features.

Clearly distinguish implemented and verified work from plans, fixtures and mock integrations. Preserve working code and finish the authorized reversible work. Do not publish or send external messages without the relevant authorization.

**End of standalone master prompt.**

## Source register

S1 — Bangladesh Bank, official Bangla QR dispute circular. Indexed primary excerpts reviewed; complete direct PDF retrieval unsuccessful.  
https://www.bb.org.bd/mediaroom/circulars/psd-2/sep272026psd-205.pdf

S2 — upay's official Google Play listing, published by UCB FINTECH COMPANY LIMITED. Product capability descriptions, not verified dispute volumes or an integration contract.  
https://play.google.com/store/apps/details?id=bd.com.upay.customer&hl=en

S3 — Transparency International Bangladesh, Governance Challenges in MFS, Extended Executive Summary, 27 May 2025. Survey denominators must be preserved.  
https://www.ti-bangladesh.org/images/2025/report/mfs/Executive-Summary-Mobile-Financial-Services-Sector-En.pdf

S4 — EvonSys TracEI, official capability description. Vendor claims establish overlap, not reproduced performance.  
https://www.evonsys.com/tracei-blogs/why-customer-experience-is-the-new-benchmark-in-payment-investigations

S5 — Pega Smart Dispute, official product page.  
https://www.pega.com/industries/financial-services/smart-dispute

S6 — Chargeflow, official dispute automation documentation.  
https://docs.chargeflow.io/docs/reference/concepts/dispute-automation

S7 — Islami Bank Bangladesh official website, Help Portal description. ATM/card dispute precedent, not proof of this QR verifier.  
https://islamibankbd.com/

S8 — SSLCOMMERZ official developer documentation v4. Legacy component precedent, not our current provider contract.  
https://developer.sslcommerz.com/doc/v4/

S9 — XLM-RoBERTa base model card, Bengali listed and MIT license declared. Domain performance remains to be tested.  
https://huggingface.co/FacebookAI/xlm-roberta-base  
https://huggingface.co/FacebookAI/xlm-roberta-base/raw/main/README.md

S10 — Multilingual E5-small model card, Bengali listed and MIT license declared. Retrieval/encoder reuse does not establish entailment accuracy.  
https://huggingface.co/intfloat/multilingual-e5-small  
https://huggingface.co/intfloat/multilingual-e5-small/raw/main/README.md

Training references:
- Official Transformers text-classification workflow: https://huggingface.co/docs/transformers/tasks/sequence_classification
- scikit-learn calibration: https://scikit-learn.org/stable/modules/calibration.html
- scikit-learn grouped evaluation: https://scikit-learn.org/stable/modules/cross_validation.html

Compared inputs:
- User-supplied TraceFix_User_Interaction_Guide.md, updated 3 October 2026.
- TraceFix_Track6_PaidTwice_Niche_and_Build_Plan.md, previous recommendation.
- Official user-provided DIU CPC × upay AI Hackathon 2026 student handout for Track 6 and rubric weights.

The exact upay internal workflow, prevalence of this dispute family, production APIs and model benefit remain unverified. Those are validation questions; they are not concealed as established facts.
