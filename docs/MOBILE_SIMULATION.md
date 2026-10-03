# Mobile simulation context and implementation plan

## Requested behavior

The website must run an interactive mobile wallet simulation. The customer enters a purchase, attempts QR payment, experiences an unclear result, records a second cash payment, sees the eventual QR outcome, and submits their own complaint. The investigator works on that exact persisted case and communicates with the customer. Each action must have a real saved result, clear navigation, loading/error states, and recovery after refresh.

## Interaction plan

1. Replace the static story with a phone app: purchase form, QR checkout, unclear result, cash entry, transaction receipts, complaint form, case tracking, conversation and evidence upload.
2. Add persisted simulated purchases and versioned/idempotent actions. Keep simulation source records separate from the case's visible evidence until an investigator checks them.
3. Give the two UI surfaces independent server-issued demo session tokens, so customer and investigator operations can coexist without silently switching each other's identity.
4. Add case messages and customer evidence-request responses. Refresh changed case data without erasing drafts, changing the selected tab, or repeating submissions.
5. Build an investigator inbox, source checks, grounded assessment, evidence viewer, request/reply/review actions, handoff and dossier export.
6. Support the last stage: record a resolution request, explicitly advance a fictional repayment source in simulation controls, check the record, and save a cited outcome. No real money moves.
7. Verify the server transitions, source boundaries, privacy, retries, conflicts, evidence freshness and the actual browser interaction at desktop and mobile sizes.

## Evidence and AI boundaries

The user previously selected synthetic prototype only. Customer cash entry and uploads remain supplied assertions. A documented mock merchant record can corroborate cash after a source check. Source matching and amount arithmetic determine whether visible records support a duplicate payment; the existing trained model reads claim/passage pairs and cannot confer source authority. Missing evidence must yield a request for evidence, rather than a rejection. Synthetic model performance remains disclosed; broader training or an Ollama model is not an accuracy shortcut.

The case assessment uses only current case evidence and is stale after any new evidence. Simulation profile names, future source events and hidden source data must never enter text-pair inference. Human investigation and financial eligibility remain separate.

## Persistence and navigation

SQLite owns simulation stages, reference/amount fields, case IDs, messages, tasks, evidence and outcomes. Browser state holds only the selected surface/tab, local drafts and independent demo session tokens. Refresh restores the latest owned simulation and case. New simulation creates another purchase and keeps prior cases accessible.

## Contract additions

- `POST /api/simulations`: create an owned fictional purchase.
- `GET /api/simulations`: list owned purchases with safe projections.
- `POST /api/simulations/{id}/action`: versioned QR attempt, cash entry and QR status refresh.
- `POST /api/simulations/{id}/complaint`: one stable complaint linked to that purchase.
- `POST /api/cases/{id}/messages`: shared customer/staff conversation and optional task response.
- `POST /api/cases/{id}/check`: QR, invoice, merchant and repayment source checks.
- `POST /api/cases/{id}/repayment-request`: save a fictional resolution request supported by a current assessment.
- `POST /api/simulations/{id}/repayment`: explicit staff/judge-only simulation control; a completed mock source becomes available without directly changing case evidence.
- `X-TraceFix-Session`: optional server-issued demo session credential, with existing cookie behavior preserved.

Implementation and validation results will be added to `MOBILE_VALIDATION.md` after checks actually run.
