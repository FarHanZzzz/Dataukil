# MASTER BUILD PROMPT

## AI Transaction Investigation & Operations Intelligence System for MFS

Build a polished, realistic, end-to-end **AI-powered Transaction Operations, Investigation, Dispute Resolution, and Safe Repair platform for an MFS environment**.

This is a **synthetic demo environment**. All payments, balances, transaction records, partner systems, and repairs use mock/synthetic data. Do not represent any simulated money movement as real financial activity.

The product has two connected interfaces:

1. **Customer Interface**
2. **Admin / Operations Interface**

Both interfaces operate on the same persistent transaction, complaint, investigation, evidence, and case data.

The core journey is:

**Customer initiates payment → payment becomes uncertain/fails → customer reports issue → one incident/case is created → operator receives case → operator launches AI investigation → AI reconstructs transaction journey → AI evaluates evidence and possible causes → AI proposes an eligible repair or operator handoff → operator approves supported repair → case and transaction state update → customer receives verified update.**

---

# 1. PRODUCT PURPOSE

The system should solve the operational problem of:

* stuck transactions
* uncertain transaction outcomes
* duplicate payments
* cash + QR double-payment claims
* missing partner responses
* retry-related inconsistencies
* disputed transaction states
* investigation delays
* fragmented evidence
* unsafe/manual corrective actions

The platform should transform a confusing payment incident into a:

**single case → structured investigation → evidence trail → explainable conclusion → controlled resolution**

The AI should behave like an **AI transaction operations investigator**, not merely a chatbot.

---

# 2. CUSTOMER EXPERIENCE

Create a customer dashboard where the customer can:

### Payment Demo

Allow the customer to start a simulated:

**Bank → upay transfer**

Use a transaction amount selector and realistic mock transaction metadata.

After submission, show:

* transaction ID
* amount
* source account
* destination wallet
* initiated timestamp
* current status
* processing stage
* transaction timeline

The demo must support scenarios such as:

* successful transaction
* delayed response
* stuck transaction
* failed transaction
* duplicate-payment scenario
* partner response missing
* retry occurred
* settlement uncertainty

The demo should intentionally allow an uncertain transaction state so the investigation workflow can be demonstrated.

---

# 3. CUSTOMER COMPLAINT REPORTING

Provide simple complaint flows.

Complaint types:

### A. Stuck Transfer

Example:

“My bank account was debited but the money has not reached the wallet.”

### B. Paid Twice

Example:

“I paid using QR and cash / or the same payment appears to have happened twice.”

The customer can provide:

* description
* receipt image
* transaction reference
* merchant information
* approximate time
* optional supporting evidence

Customer statements must always remain labelled as:

**Customer Statement**

Uploaded receipts must remain:

**Customer Evidence**

Confirmed backend/financial records must remain:

**Confirmed System Record**

Never mix these categories.

---

# 4. ONE INCIDENT = ONE CASE

Implement strict duplicate protection.

Every incident must have a single case.

Payments, complaints, investigation events, evidence, decisions, repairs, and customer updates must reference the same case/incident ID.

Do NOT create multiple cases when:

* the customer refreshes the page
* the customer presses submit twice
* the operator opens the case multiple times
* AI analysis is restarted
* a repair button is clicked repeatedly

Use persistent IDs and idempotent actions.

---

# 5. CUSTOMER CASE TRACKING

Customers should be able to see:

* Case ID
* Transaction ID
* confirmed payment facts
* current investigation stage
* case owner
* last verified update
* next expected update
* resolution status
* whether further evidence is required

Use simple language in:

**Bangla + English**

Customer-facing explanations should be understandable and non-technical.

Example:

> “Your payment was received by the bank but a final confirmation was not recorded. We are checking the transaction path.”

Do not expose technical internal logs to customers.

---

# 6. ADMIN / OPERATOR DASHBOARD

Create a professional operations dashboard.

Main sections:

### Overview

Cards showing:

* Open cases
* Investigating
* Awaiting evidence
* Repair eligible
* Operator handoff
* Resolved

### Unresolved Case Inbox

Show unresolved cases in a queue.

Each case card should display:

* Case ID
* Transaction ID
* issue type
* customer
* amount
* current transaction state
* age
* priority
* investigation status
* last event

Clicking a case opens the full investigation workspace.

---

# 7. PAYMENT PIPELINE VISUALIZATION

The case workspace must contain a highly visual transaction pipeline.

Use connected nodes such as:

**Customer Initiated**
↓
**MFS Gateway**
↓
**Bank/Partner**
↓
**Processing Queue**
↓
**Response**
↓
**Settlement**
↓
**Wallet / Merchant**

Nodes must visually communicate state.

### Node states

GREEN:
Completed successfully.

BLUE / ACTIVE:
Currently being investigated or processed.

RED:
Observed failure or confirmed abnormality.

YELLOW:
Needs attention / evidence incomplete.

GRAY:
Unknown or not yet observed.

Avoid claiming a failure merely because data is missing.

Connections between nodes should animate when the AI follows that path during investigation.

---

# 8. EXPANDABLE TRANSACTION DETAILS

Every node should be clickable.

Opening a node reveals a detailed evidence panel.

Show:

* event ID
* timestamp
* source
* request
* response
* status
* retry count
* timeout
* queue information
* partner response
* correlation ID
* related records
* failure/error message
* linked events

Use expandable accordions for technical information.

Keep the default view clean and readable.

---

# 9. THE ANALYZE CASE BUTTON

Place a highly visible:

**Analyze Case**

button in the operator workspace.

Clicking this button does NOT simply return a paragraph.

It launches the dedicated:

# AI INVESTIGATION STUDIO

This should be a dedicated page or full-screen workspace.

The Investigation Studio is the most visually impressive part of the demo.

---

# 10. AI INVESTIGATION STUDIO

The purpose of this screen is to let an operator visually observe the AI investigation as it proceeds.

The AI should appear like an intelligent automation agent moving through a transaction graph.

Create a visual workflow similar to:

**Agent Started**
→
**Case Context Loaded**
→
**Transaction Reconstructed**
→
**Relevant Records Retrieved**
→
**Processing Path Followed**
→
**Evidence Compared**
→
**Possible Causes Evaluated**
→
**Cause Narrowed**
→
**Repair Eligibility Checked**
→
**Recommendation Generated**
→
**Operator Decision Required**

This should feel like an advanced enterprise AI operations console.

---

# 11. IMPORTANT AI VISUALIZATION PRINCIPLE

Do NOT display hidden chain-of-thought or private internal reasoning.

Instead show:

### Observable Investigation Trace

For every AI action display:

* what the AI is doing
* which record/evidence category it is checking
* what was found
* what changed because of the finding
* confidence/uncertainty where appropriate
* the next investigation step

Examples:

> Checking transaction gateway records...

> Gateway record found.

> Matching transaction ID confirmed.

> Bank response not present.

> Checking retry events...

> Retry event found at 14:32:18.

> Comparing retry with settlement record...

> Settlement record does not confirm second successful settlement.

This creates transparency without exposing hidden model reasoning.

---

# 12. AI AUTOMATION GRAPH

The center of Investigation Studio should contain a large interactive graph.

Example:

```
            CASE
              |
       Context Loader
              |
    Transaction Reconstruction
         /          \
   Gateway        Partner
      |              |
    Queue          Response
       \             /
        Evidence Merge
              |
      Claim Verification
              |
      Cause Evaluation
              |
      Repair Eligibility
         /          \
      Repair       Handoff
```

Nodes should light up as the AI progresses.

When AI starts:

* first node activates
* animated connection moves to next node
* completed node becomes green
* active node becomes blue and animated
* observed failure becomes red
* unresolved hypothesis remains yellow
* unknown stage stays neutral gray

The graph should visibly progress during the investigation.

---

# 13. AI INVESTIGATION EVENT STREAM

Add a live event/activity panel beside or below the graph.

Display events chronologically.

Example:

**14:32:01**
Case loaded

**14:32:02**
Transaction record retrieved

**14:32:03**
Gateway request matched

**14:32:04**
Bank response missing

**14:32:05**
Retry event detected

**14:32:06**
Settlement record checked

**14:32:07**
Second settlement not confirmed

**14:32:08**
Duplicate-payment claim remains unresolved

**14:32:09**
Repair eligibility evaluated

Each item can be clicked to reveal supporting evidence.

---

# 14. INVESTIGATION SUMMARY PANEL

At the top of the AI Investigation Studio display a compact summary:

### Investigation Status

**RUNNING / COMPLETE / NEEDS HUMAN REVIEW**

### Current Finding

One or two concise sentences.

Example:

> “The payment was successfully initiated and retried after a missing partner response. Final settlement for the second attempt has not been confirmed.”

### Confidence

Use a clear confidence indicator only when the underlying evidence supports it.

### Evidence Coverage

Example:

**7 relevant records checked**

### Possible Causes

Show a ranked-by-evidence set of hypotheses, but do not present unsupported certainty.

Example:

**Possible Cause A**
Partner response timeout
Status: Supported

**Possible Cause B**
Duplicate retry without confirmed settlement
Status: Plausible

**Possible Cause C**
Successful second settlement
Status: Not supported by available records

When new evidence appears, update these statuses dynamically.

---

# 15. POSSIBLE-CAUSE TRACKING

Maintain an explicit hypothesis panel.

Each possible cause should have:

* title
* description
* supporting evidence
* contradicting evidence
* unresolved evidence
* current status

Use:

**SUPPORTED**
**CONTRADICTED**
**UNRESOLVED**

The investigation should show how evidence changes the status of each possible cause.

Do not silently delete uncertain possibilities.

---

# 16. EVIDENCE INSPECTION

Clicking an investigation node should open a side drawer.

For each piece of evidence show:

### Source

Gateway / Bank / Queue / Wallet / Merchant / Customer

### Timestamp

Exact synthetic timestamp.

### Evidence Type

System Record / Customer Evidence / External Record / Derived Observation

### Reliability Label

Confirmed / User-provided / Unverified

### Relationship

Which transaction/case/event it is connected to.

### Effect on Investigation

Example:

> “Supports the presence of a retry but does not confirm a second successful settlement.”

---

# 17. PAID-TWICE VERIFICATION

For duplicate-payment complaints, use the existing evidence-verification system.

The verifier must compare:

* customer statement
* uploaded receipt
* QR payment record
* cash-payment claim
* transaction records
* merchant confirmation
* settlement records

The result must clearly indicate:

### SUPPORTS CLAIM

Evidence supports that two payments occurred.

### CONTRADICTS CLAIM

Available records contradict the claim.

### INCONCLUSIVE

Evidence does not establish whether the second payment occurred.

Never treat a customer statement as equivalent to a confirmed financial transaction.

---

# 18. REPAIR RECOMMENDATION

After investigation, the AI can propose:

**Recommended Action**

Examples:

* reverse an eligible duplicate debit
* mark transaction for settlement retry
* issue simulated correction
* hold for manual review
* request missing evidence
* escalate to partner operations

Every recommendation must contain:

* proposed action
* reason
* evidence supporting it
* eligibility result
* risk/constraint
* whether operator approval is required

---

# 19. BACKEND REPAIR AUTHORIZATION

AI must NOT directly perform financial corrections.

Workflow:

**AI proposes action**
↓
**Backend checks permission/eligibility**
↓
**System returns Eligible / Ineligible**
↓
**Operator reviews**
↓
**Operator approves**
↓
**Synthetic sandbox repair executes**
↓
**Result recorded**
↓
**Graph updated**
↓
**Customer status updated**

If the action is not eligible:

Show:

**Repair Not Authorized**

Then explain:

* why it cannot be corrected automatically
* what evidence is missing
* which team/person should follow up
* next action

---

# 20. OPERATOR HANDOFF

Create a clear handoff workflow.

Example:

### Handoff Required

Reason:

> “The available records confirm the original debit but do not establish whether the second claimed payment settled successfully.”

Required follow-up:

> “Verify merchant settlement record and partner-side transaction response.”

Assign:

* team
* operator
* priority
* next action

Save the handoff to case history.

---

# 21. CASE HISTORY

Persist everything.

Case history should record:

* customer complaint
* payment events
* evidence uploaded
* AI investigations
* investigation findings
* hypothesis updates
* operator decisions
* repair attempts
* successful repairs
* failed repairs
* handoffs
* customer updates
* timestamps

Create a timeline view.

Example:

**09:12 Customer reported stuck transfer**

**09:13 Case created**

**09:14 AI investigation started**

**09:15 Bank response identified as missing**

**09:15 Retry detected**

**09:16 Repair eligibility failed**

**09:17 Case handed to Operations**

---

# 22. INVESTIGATION REPLAY

Add:

**Replay Investigation**

The operator can replay a previously completed investigation.

When replayed:

* graph activates node by node
* event stream appears chronologically
* evidence panels open as they were inspected
* investigation state changes are animated
* final conclusion appears at the end

This should make the demo visually impressive during presentation.

Also add:

**Reset Demo Scenario**

so judges can restart isolated scenarios without corrupting other cases.

---

# 23. PRESENTATION CONTROLS

Include:

* zoom in/out
* fit graph to screen
* expand node
* collapse node
* follow AI path
* replay investigation
* pause replay
* restart analysis
* reset scenario

When “Follow Investigation” is enabled, automatically move/focus the graph on the active AI node.

---

# 24. AI MODES

Support two modes.

### LIVE AI

When an AI service is connected:

Show:

**LIVE AI INVESTIGATION**

The AI uses the available case data and produces the investigation output.

### DEMO AI

When no live model is available:

Show a highly visible label:

**DEMO INVESTIGATION — SIMULATED AI TRACE**

The interface should still execute a realistic deterministic investigation sequence.

Never pretend the simulated output came from a live AI model.

---

# 25. CUSTOMER UPDATE AFTER RESOLUTION

After operator approval and successful sandbox repair:

Update:

* transaction state
* case state
* investigation summary
* payment graph
* case history

Then generate a customer-friendly message.

Example:

> “Your payment issue has been verified. We identified the transaction discrepancy and completed the available correction. Your case has now been resolved.”

For unresolved cases:

> “We verified the available payment records, but the current evidence is not enough to confirm the second payment. Your case has been sent for further review.”

---

# 26. INVESTIGATION REPORT EXPORT

Allow the operator to export a structured report.

Report sections:

### Case Information

Case ID, transaction ID, customer, amount, issue type

### Transaction Reconstruction

Full payment path

### Evidence Reviewed

All relevant records and sources

### Investigation Timeline

Chronological AI activity

### Findings

Confirmed observations

### Possible Causes

Supported / contradicted / unresolved

### Verification Result

Especially for duplicate-payment claims

### Recommended Action

AI proposal + eligibility result

### Operator Decision

Approve / Reject / Handoff

### Repair Result

Action, timestamp, synthetic result

### Remaining Issues

Anything unresolved

The report should be suitable for audit/review.

---

# 27. SECURITY / ACCESS CONTROL

Customers can only access their own cases.

Operators can access authorized operational cases.

Prevent duplicate actions.

Buttons such as:

**Submit Complaint**
**Start Investigation**
**Approve Repair**
**Execute Repair**

must be idempotent.

Multiple clicks should not create multiple records or multiple corrections.

---

# 28. UI / UX DESIGN

Use a professional enterprise fintech/operations aesthetic.

The application should feel like:

**MFS Operations Center + AI Agent Console + Transaction Observability Platform**

Prioritize:

* clean information hierarchy
* dark/light enterprise dashboard aesthetic
* strong data visualization
* readable typography
* subtle animations
* connected graph workflows
* status badges
* evidence drawers
* timelines
* cards
* expandable panels
* responsive layout

Avoid making it look like a generic chatbot.

The **AI Investigation Studio** should be the visual centerpiece.

---

# 29. MOST IMPORTANT DEMO SCENARIO

Create one polished end-to-end scenario for demonstration.

### Scenario

Customer initiates a simulated **৳1,000 bank-to-upay transfer**.

The transaction:

1. starts successfully
2. reaches gateway
3. is forwarded to bank partner
4. partner response is delayed/missing
5. system retries
6. one path becomes uncertain
7. customer sees an uncertain status
8. customer files a complaint
9. operator receives the case
10. operator clicks **Analyze Case**
11. AI Investigation Studio opens
12. AI progressively traverses the transaction graph
13. AI finds the missing response
14. AI detects the retry
15. AI checks settlement records
16. AI evaluates whether a duplicate debit is supported
17. AI updates possible-cause statuses
18. backend checks repair eligibility
19. if eligible, AI recommends correction
20. operator approves
21. sandbox repair executes
22. transaction graph updates
23. case history records the action
24. customer receives verified resolution

The entire workflow should feel connected.

---

# 30. THE “WOW” MOMENT

When the operator clicks:

**ANALYZE CASE**

do not immediately jump to a static answer.

Instead:

### Phase 1

Open the Investigation Studio.

### Phase 2

Show:

**Initializing AI Investigator...**

### Phase 3

Graph nodes progressively activate.

### Phase 4

AI traces the payment path.

### Phase 5

Relevant evidence cards appear.

### Phase 6

A missing response / retry / discrepancy is visually highlighted.

### Phase 7

Possible causes update dynamically.

### Phase 8

Repair eligibility is checked.

### Phase 9

Final investigation summary appears.

### Phase 10

Operator sees:

**RECOMMENDED ACTION**

with evidence and authorization status.

This should make it obvious to a judge that the AI is doing structured operational work rather than simply generating text.

---

# 31. ARCHITECTURE PRINCIPLE

Separate these layers:

### Data Layer

Transactions, cases, events, evidence, customers, partners

### Investigation Layer

Record retrieval, transaction reconstruction, evidence matching, verification

### AI Layer

Investigation orchestration, cause assessment, recommendation generation

### Control Layer

Eligibility, permissions, approval, idempotency

### Resolution Layer

Sandbox correction / handoff

### Presentation Layer

Customer dashboard + operator dashboard + AI Investigation Studio

Maintain a clear distinction between:

**Observed Facts**
**AI Interpretation**
**Operator Decision**
**System Action**

This distinction must be visible in the UI.

---

# 32. CORE PRODUCT MESSAGE

The product should communicate this idea throughout the experience:

> **“When a payment goes wrong, don't just open a ticket. Reconstruct what happened, verify the evidence, identify the likely cause, and safely resolve the incident.”**

The AI is not the replacement for the operator.

The AI is the operator's:

**investigation co-pilot.**

Its job is to reduce manual investigation effort, surface relevant evidence, maintain an auditable investigation trail, identify uncertainty, and recommend safe next actions.

---

# 33. SUCCESS CRITERIA

The final application must clearly demonstrate:

**1. One payment can create one persistent incident.**

**2. Customer and admin see the same underlying case state.**

**3. Operator can investigate visually.**

**4. AI investigation is observable through an animated investigation graph and event stream.**

**5. Evidence is distinguishable by source and reliability.**

**6. Possible causes evolve as evidence is checked.**

**7. Duplicate-payment claims are explicitly verified.**

**8. AI recommendations are separated from confirmed facts.**

**9. AI cannot directly execute an unauthorized repair.**

**10. Operator approval is required for eligible sandbox corrections.**

**11. Unsupported cases are handed off with clear reasons and required follow-up.**

**12. Every action remains in case history.**

**13. Customer receives a clear verified update.**

**14. Demo mode is explicitly labelled when live AI is unavailable.**

---

# FINAL EXPERIENCE

The final experience should tell a complete story:

### CUSTOMER

“I sent money. Something went wrong.”

↓

### SYSTEM

“We created one traceable incident.”

↓

### OPERATOR

“I can see exactly where the transaction became uncertain.”

↓

### AI

“I reconstructed the transaction and checked the relevant evidence.”

↓

### AI INVESTIGATION STUDIO

“Here is the investigation path, the evidence checked, the observed issue, the remaining uncertainty, and the possible resolution.”

↓

### OPERATOR

“I approve the supported action.”

↓

### SYSTEM

“The correction was validated and executed in the sandbox.”

↓

### CUSTOMER

“Here is what happened and what was resolved.”

The application should ultimately feel like an **AI-powered transaction observability and resolution control center for MFS operations**, with the **AI Investigation Studio as the core differentiating visual experience**.
