# DataUkil — Project Report

**AI-assisted payment investigation & accountable resolution**

Prepared 4 October 2026.

A product vision for connecting customer complaints, transaction evidence and the right next action across Bangladesh’s MFS ecosystem.

## Abstract & report guide

A shared intelligence layer for clearer, faster and more accountable payment resolution.

DataUkil is an AI-assisted transaction investigation and operations intelligence platform designed for Bangladesh’s Mobile Financial Services ecosystem. It addresses situations in which a customer’s bank is debited while a wallet credit or payment confirmation remains unclear. The product vision brings complaints, transaction records, supporting documents and operational findings into one understandable case.

Its two flagship journeys are bank-to-wallet Add money transfers and QR payments followed by cash. DataUkil distinguishes the customer’s experience from the underlying financial events, reconstructs the transaction across relevant systems and helps the operator determine a justified next action. A missing acknowledgement, an interrupted credit and a delayed original transfer can therefore receive different responses.

The envisioned AI layer understands multilingual complaints, structures claims, interprets evidence, ranks possible causes and proposes useful permitted checks. It prepares cited recommendations and customer explanations, while independent software enforces identity, financial eligibility and authorization. The product combines this intelligence with an interactive investigation workspace, controlled correction workflows and an owned escalation path.

| Section | Page |
| --- | --- |
| Problem, stakeholders and objectives | 3 |
| Add money investigation | 4 |
| QR + cash investigation | 5 |
| AI depth and investigation intelligence | 6 |
| System architecture | 7 |
| Financial governance and evidence integrity | 8 |
| Customer and operator experience | 9 |
| Evaluation and success measures | 10 |
| Scenario coverage and operational assurance | 11 |
| Delivery and integration roadmap | 12 |
| Value proposition and conclusion | 13 |
| Glossary and technical references | 14–15 |

## When payment status and financial reality diverge

The investigation must establish what happened before choosing how to fix it.

### The customer’s problem

A customer initiates an Add money transfer, sees a deduction at the bank and finds no wallet confirmation. The immediate questions are simple: Where is my money? Will it arrive? What should I do next? A confusing status screen and repeated requests for the same details can intensify anxiety even when the original instruction remains recoverable.

### The operator’s problem

The useful evidence may be distributed across bank postings, payment connectors, wallet ledgers, processing attempts, callbacks and worker records. An operator needs the exact transfer identity, chronology and source status to distinguish a processing failure from a communication failure. The same complaint wording does not establish the same technical cause.

| Stakeholder | What DataUkil should enable |
| --- | --- |
| Customer | Understand current status, provide evidence once and follow an accountable case. |
| First-line operator | Receive a prepared case with relevant sources, findings and a next action. |
| Specialist investigator | Inspect conflicting records, missing prerequisites and the history of checks. |
| Provider operations team | Apply authorized remedies, monitor unresolved cases and examine recurring failure patterns. |

### Project objectives

- Unify complaint intake, transaction context and investigation evidence.
- Separate observed symptoms from confirmed ledger events.
- Reduce manual case reconstruction through AI-assisted interpretation.
- Support eligible recovery without creating duplicate financial effects.
- Keep uncertain cases open with ownership and a clear next review.

> **Scope**
> The product investigates payment exceptions and supports controlled resolution. It complements existing bank and wallet transaction systems; financial authority remains with the responsible institutions.

## Add money: diagnose, recover and confirm

A bank debit and missing wallet confirmation are the beginning of the investigation.

Bank debit → Connector checks → Wallet ledger → Diagnosis → Approved outcome

The customer enters an amount, selects the bank source, reviews the details and confirms the transfer. Saved progress follows the same payment through processing, investigation and outcome. If confirmation remains absent, the operator opens the exact case rather than asking the customer to start another transfer.

### Evidence collected for the case

The investigation checks bank funding, wallet posting, partner status, attempt history, reference mapping, worker errors and correction eligibility. Each observation retains its source, scope, timestamp and evidence version. Findings become visible on the investigation board and support or rule out the competing explanations.

| Finding | Appropriate response |
| --- | --- |
| Worker failed before wallet credit | Propose resuming the original instruction once, when exact mapping and recovery authority are established. |
| Wallet credit exists; acknowledgement was lost | Refresh the customer’s confirmed status. Do not create another credit. |
| Original transfer is delayed and can still complete | Monitor original processing and invalidate a conflicting correction plan. |
| Mapping or source authority is incomplete | Block the correction and create an owned follow-up with missing evidence. |

### Resolution is a separate stage

A proposal identifies the exact instruction, amount, evidence and permitted operation. Approval rechecks current eligibility. Execution is followed by outcome verification, so a submitted recovery request is never presented as a confirmed wallet credit.

> **Presentation example**
> For a BDT 1,000 transfer, the strongest demonstration is that identical customer symptoms can lead to a status update, an approved single credit, a wait decision or human escalation. The value lies in choosing the correct response.

## QR + cash: investigate the possible overpayment

One purchase can produce several payment facts that must be evaluated independently.

QR attempt → Cash receipt → Late debit → Complaint → Investigation

The customer attempts a QR payment, receives a failed or unconfirmed screen result, pays cash and receives a receipt. Later bank activity shows a debit. The customer attaches that receipt and files a complaint linked to the exact purchase. The operator’s first task is evidence review, followed by source comparison and a recorded outcome.

### Receipt evidence and visual assistance

The receipt is an itemized paper artifact with merchant details, timestamp, invoice values and printed cash information. Its original bytes and hash remain preserved. OpenCV normalizes orientation, detects the paper, corrects perspective and locates visual regions. The operator reviews the associated transcript values and missing fields before starting Marketplace verification.

### Corroborate the purchase and payment context

The investigation compares merchant and purchase identity, itemization, currency, subtotal, tax, invoice total, available references, cash records, posted QR/bank amount and prior refund history. A receipt contributes evidence; independently checked records establish the relevant financial facts.

> **Refund eligibility arithmetic**
> Verified excess = posted QR amount + independently confirmed cash amount − invoice total. An eligible proposal uses the established excess, rather than automatically refunding the entire QR amount.

| Outcome | Resolution path |
| --- | --- |
| Legitimate overpayment | Propose the eligible excess; obtain operator approval; request the remedy; confirm completion separately. |
| Unsupported duplicate claim or explicit source mismatch | Record the reason and explain the result. A valid split payment may have no excess. |
| Incomplete or unavailable information | Pause the correction path and assign human review with owner, missing evidence and review time. |

In the deployed product, merchant and payment adapters would provide authorized source records. The existing Marketplace adapter supplies a reproducible reference workflow for implementing those connections.

## AI that prepares a better investigation

The useful output is a cited case packet and a justified next question.

| Capability | Role in the envisioned product |
| --- | --- |
| Multilingual complaint understanding | Interpret Bangla, Banglish and English; extract amounts, timing, references and reported symptoms for customer confirmation. |
| Evidence interpretation | Compare each claim with relevant passages; identify support, contradiction or insufficient information. |
| Hypothesis ranking | Maintain possible explanations such as lost acknowledgement, interrupted credit or delayed processing. |
| Adaptive investigation planning | Propose the next allowed check based on findings, missing prerequisites and the value of additional evidence. |
| Recommendation drafting | Summarize the diagnosis, cited records, proposed operation and remaining uncertainty. |
| Customer communication | Explain confirmed facts, outstanding checks, ownership and the next step in clear language. |

### The hypothesis-driven loop

Understand → Retrieve → Compare → Choose check → Update findings

If the exact wallet credit exists, the next useful question concerns acknowledgement and customer status. If it does not appear, the investigator checks the original instruction’s processing state and whether safe recovery is allowed. Each observation changes the investigation; the system does not need to repeat every check mechanically.

### The technical foundation and development path

The current Add money policy implements a bounded read-only investigation loop using explicit rules. The separate AI Studio includes a multilingual embedding-based advisory classifier and an optional local Qwen adapter for structured assessment and hypothesis ordering. The product roadmap extends those learned capabilities into multilingual intake and adaptive investigation within the same controlled interfaces.

> **AI’s contribution**
> AI reduces the work of interpreting varied language, organizing evidence and preparing the case. Exact record matching, accounting, source permissions and financial execution remain independently enforced.

## A coherent case built from trustworthy components

Keep intelligence, source authority and execution as distinct responsibilities.

Customer / operator UI → Case orchestration → Scoped sources → Evidence history → Controlled resolution

| Layer | Responsibility and foundation |
| --- | --- |
| Experience | HTML, CSS and JavaScript customer, operations, QR and Add money surfaces; persistent navigation context. |
| Application services | FastAPI APIs for payments, complaints, evidence, investigations, approvals and reports. |
| Persistence | SQLite case and payment records, saved events, evidence versions and ledger boundaries; transactional writes. |
| Source adapters | Bank, connector, wallet and merchant lookups scoped to the exact transaction or purchase. |
| Intelligence | Rules policy, advisory verifier, optional local language model and proposed learned investigation planner. |
| Execution controls | Independent eligibility checks, ownership checks, approval, idempotent operations and verified outcomes. |

### Case and evidence model

A case connects its customer and transaction identity to evidence artifacts, observations, checks, findings, recommendations and resolution history. Financial records preserve amounts and posting references; evidence records preserve originals, revisions and provenance. Separate case families prevent a QR operation from reaching the Add money payment engine.

### Event-driven presentation

Saved events drive the investigation visualization. Replay reconstructs what was known at a selected point without rerunning checks or executing a payment. Evidence changes invalidate outdated recommendations while retaining the historical record. A customer-facing projection exposes approved progress and outcomes without internal source data or operator notes.

### Production evolution

The delivery path adds authorized provider adapters, durable background jobs, operational monitoring and a storage design sized to measured workload. The same contract boundaries let teams evolve infrastructure while preserving case identity, evidence freshness and financial controls.

## Financial safety is part of the product

An effective investigation must also produce a controlled, accountable resolution.

| Control | Purpose |
| --- | --- |
| Role and ownership isolation | Limit records and operations to the customer or authorized case owner. |
| Exact transaction identity | Bind findings and corrections to the intended purchase or transfer, rather than a similar amount or timestamp. |
| Evidence freshness | Invalidate stale proposals when material records, transcripts or review results change. |
| Human approval | Separate preparation of a recommendation from authorization of a financial operation. |
| Idempotency | Return the same operation result on safe retries and prevent repeat processing. |
| Finality and race protection | Account for an original transfer that can complete while a correction is being considered. |
| Verified completion | Show a credit or refund as complete only after the relevant saved financial event. |
| Owned escalation | Retain the responsible owner, receiving queue, missing evidence and next review. |

### Protect evidence and its meaning

Original receipt bytes remain unchanged and are linked to their SHA-256 hash. Derived previews, field mappings and transcript revisions carry their own identifiers. Visual confidence, semantic interpretation and financial authority are separate attributes: detecting a region or reading a statement does not establish that money moved.

### Protect amounts and ledger effects

Amounts are represented in integer minor units. Unique posting identities, transactional updates and balanced ledger checks constrain financial effects. In the Add money workflow, investigator tools are read-only; an eligible correction is separately authorized and executed against the original instruction.

> **A defensible outcome**
> A customer explanation should state what is confirmed, what remains unknown and what will happen next. Neither a confident model answer nor completion of the visual workflow substitutes for a confirmed financial record.

## One journey, two perspectives

Customers need clarity; operators need evidence and an actionable next step.

### Customer experience

The customer follows a guided journey from payment details to saved status and complaint submission. Amount, source and destination remain visible. Drafts survive navigation and refresh, and repeated confirmation requests retain their operation identity. Progress distinguishes processing, investigation, approval and confirmed completion.

### Operator experience

A prepared case brings customer context, relevant source records, current hypotheses and a proposed next action together. The investigation board connects the processing path to evidence citations and saved observations. Receipt review stays connected to the exact uploaded artifact, and uncertainty leads to a useful handoff packet rather than an unexplained dead end.

| Experience principle | Product implication |
| --- | --- |
| One clear current task | Use a prominent stage explanation and primary action. |
| Financial states in plain language | Distinguish unconfirmed, confirmed credit, requested refund and completed refund. |
| Evidence close to the decision | Keep source details, receipt fields and cited findings directly inspectable. |
| Continuity | Preserve the exact payment, simulation and case across refresh, links and companion views. |
| Accessibility | Provide readable text, keyboard controls, visible focus, status announcements and reduced-motion alternatives. |
| Responsive presentation | Keep customer and operator views together when space permits; expose reachable panels on small screens. |

### Communication as an operational feature

The envisioned language layer turns approved findings into concise Bangla or English updates. It explains whether the customer should wait, provide another record or expect an approved action. The goal is to reduce repeated explanations while giving customers a reliable understanding of their case.

> **North-star experience**
> One complaint, one accountable case, a visible investigation and a verified next outcome.

## Measure investigation quality and operational value

The AI layer should earn its place through better case preparation and decisions.

### Compare against the same workflow

Evaluation should compare rules-only investigation with AI-assisted investigation using the same evidence and mandatory controls. This separates the value of a unified workflow from the additional value of learned interpretation. Measurements should include unfamiliar wording, ambiguous evidence, delayed outcomes and cases that require escalation.

| Measure | What a useful evaluation examines |
| --- | --- |
| Preparation time | Time to assemble a complete, cited case packet. |
| Diagnosis quality | Correct cause identification and inappropriate remedy recommendations. |
| Evidence grounding | Citation validity, exact-case linkage and unsupported conclusions. |
| Language quality | Claim interpretation across Bangla, Banglish and English. |
| Operator effort | Manual corrections, source lookups and repeated reading. |
| Resolution integrity | Duplicate effects, stale approvals, prior-refund conflicts and verified completion. |
| Customer comprehension | Whether users understand current status, ownership and next steps. |
| Operational cost | Source calls, latency, model runtime and cost per prepared case. |

> **Impact discipline**
> Time and cost savings are product objectives to measure. This report does not present projected savings as already achieved field results.

## Scenario coverage & operational assurance

Test the complete decision path, including cases that should remain open.

### Add money acceptance

- Worker fault: an eligible approved recovery produces one wallet credit.
- Lost acknowledgement: the existing credit is confirmed without moving money again.
- Ambiguous mapping: financial correction stays blocked and an owned follow-up is saved.
- Late completion: the original instruction can complete and an outdated plan cannot create another credit.

### QR + cash financial examples

| Invoice / QR / cash | Expected investigation result |
| --- | --- |
| BDT 500 / 500 / 500 | Established excess of BDT 500; eligible proposal subject to approval. |
| BDT 1,000 / 400 / 600 | No excess; explain the valid split payment. |
| BDT 500 / 200 / 450 | Established excess of BDT 150, when corroborated. |
| Excess above the QR amount | Human review; do not automatically refund. |
| Missing source information | Uncertainty and owned review, without a new refund. |

### Interaction and control coverage

Exercise idempotent retries, ownership, evidence revision, stale approvals, preserved drafts and customer privacy. Check exact bookmarks, refresh, Back/Forward, companion views, keyboard operation, readable small-screen panels and reduced-motion behavior.

The repository includes backend, integration and browser validation for the implemented workflows. Provider pilots should add controlled tests for source outages, changing finality signals and delayed acknowledgements, using institution-approved records and procedures.

> **Release principle**
> Validate both the action taken and the actions correctly withheld. A case that remains owned and open can be the appropriate outcome.

## From working foundation to integrated service

Advance through explicit capability and quality gates.

| Stage | Deliverable | Readiness gate |
| --- | --- | --- |
| 1. Workflow foundation | Customer journeys, saved cases, evidence provenance, investigation boards and controlled outcomes. | Representative scenarios and safety controls pass reproducible checks. |
| 2. Authorized source integration | Adapters for provider bank, wallet, connector and merchant records. | Exact identity, permission scope, freshness and failure handling are validated. |
| 3. Language intelligence | Multilingual intake, evidence interpretation and cited case drafting. | Independent reviewed cases show useful quality and operator benefit. |
| 4. Adaptive investigation | Learned ranking of hypotheses and permitted next checks. | Improves preparation without bypassing mandatory checks or increasing unsupported conclusions. |
| 5. Controlled pilot | Selected dispute categories with trained operators and monitored outcomes. | Measured latency, intervention, customer comprehension and correction integrity meet agreed targets. |
| 6. Operational expansion | Additional partners, durable jobs, workload-based infrastructure and continuous evaluation. | Operational readiness, incident response and model-change controls are demonstrated. |

### Integration priorities

Start with the Add money exceptions for which source identity and correction authority can be established. Introduce broader dispute categories as the required evidence and policy contracts become available. Provider onboarding should specify record semantics, finality signals, supported remedies and escalation ownership.

### Model and system change management

Version models, prompts, policies and evidence-processing components. Evaluate updates before rollout, retain their provenance with investigation records and monitor operator corrections. Model uncertainty and source unavailability should have explicit handling paths.

> **Expansion principle**
> Scale the categories and partners for which the product can produce a useful, supported investigation. Maintain the same controlled financial boundary as the intelligence layer grows.

## Clearer cases. Safer recovery. Greater confidence.

DataUkil turns a fragmented payment exception into an accountable investigation.

### Value for customers

Customers receive understandable progress, an opportunity to provide evidence once and a clear owner for unresolved cases. A missing confirmation is handled as a specific investigation rather than an unexplained failure. The product aims to make payment support as coherent as the original payment journey.

### Value for operators and providers

Operators gain a prepared transaction timeline, relevant evidence, ranked explanations and a justified next step. Providers gain a consistent case history, traceable approvals and a foundation for identifying recurring operational issues. Standardized evidence preparation supports specialist review even when the final remedy requires another institution’s response.

### What distinguishes the approach

- Diagnosis precedes correction: similar symptoms can require different remedies.
- AI works with cited, scoped evidence rather than treating complaint wording as financial truth.
- The platform combines the customer journey and operator investigation around the same case.
- Uncertainty becomes an owned work item with a next review.
- The result remains traceable through source observations, approvals and verified outcomes.

### Operating model

The envisioned deployment is an institution-integrated operations platform. Each provider supplies authorized records and applicable remedy rules; DataUkil coordinates case preparation, investigation and approved resolution. Commercial packaging should follow validated provider needs and integration economics.

### Conclusion

DataUkil’s end-product vision is a trusted investigation layer for Bangladesh’s digital payments ecosystem. By combining cross-system reconciliation, multilingual AI assistance, visual evidence review and controlled financial operations, it aims to shorten the distance between a customer’s complaint and a justified outcome. Success means a customer receives a clear answer, an operator can defend the decision and every unresolved case retains accountable ownership.

> **Project proposition**
> Turn “my money was deducted, but I do not know what happened” into a traceable investigation and the right next action.

## Investigation vocabulary

Terms for explaining the product to customers, operators and judges.

| Term | Meaning in this project |
| --- | --- |
| Cross-system reconciliation | Compare linked bank, connector and wallet records for one transfer. |
| Provenance | The source, identity, time and revision behind an observation or document. |
| Idempotency | A repeat of the same operation does not create another financial effect. |
| Transaction finality | Whether the original instruction has finished or can still complete. |
| Hypothesis-driven investigation | Maintain possible causes and test them against new evidence. |
| Bounded agentic workflow | An investigation loop restricted by allowed tools, case scope, budgets and permissions. |
| Evidence version | An identifier used to detect findings or proposals made against older information. |
| Owned handoff | An unresolved case with an accountable owner, destination and next review. |

These terms connect the product explanation to its operational design. In particular, semantic interpretation, visual evidence and financial authority remain distinct throughout the investigation.

## Technical basis & report references

Repository documentation supporting the implementation and proposed delivery path.

### Repository references

- README.md — project entry points, architecture and operating context.
- docs/ADD_MONEY_INVESTIGATION.md — Add money journeys, source checks and correction controls.
- docs/QR_CASH_INVESTIGATION.md — receipt lifecycle, Marketplace checks and outcome branches.
- docs/AI_VALUE_AND_JUDGES_GUIDE.md — proposed AI capabilities and implementation boundaries.
- docs/PROJECT_IMPLEMENTATION.md — delivered components and route inventory.
- docs/ML.md — advisory classifier, dataset and evaluation context.
- docs/ADD_MONEY_UI_VALIDATION.md and docs/QR_UI_VALIDATION.md — recorded workflow checks.

### Report basis

Prepared 4 October 2026. Technical descriptions are based on the restored application at commit 73916ee90554e0e7b81784c4840743afc9e3669a. End-product sections describe the proposed integrated service and its delivery path. No numerical national incident claim or achieved field-impact estimate is used in this report.

> **Reading note**
> OpenCV supplies visual region detection; receipt values remain reviewable evidence. Provider records and policy establish eligibility. AI assists interpretation and preparation; it does not independently authorize financial corrections.
