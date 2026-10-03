# Evidence assessment in the mobile simulation

## Inputs and responsibility

The trained multilingual E5-small encoder and logistic regression head still receive only current claim/passage text pairs. The application does not pass the simulation profile, hidden source records, a future repayment event, customer identity or scenario labels into inference. The actual classifier checksum is verified before loading.

The customer can supply complaint wording, messages and receipt files. These are assertions, not verified cash movement. A read-only simulated adapter imports matching QR, invoice, merchant and repayment records when the investigator explicitly checks a source. Original documents and transcript revisions remain preserved.

## Case-level assessment

The case-level result uses current visible records, exact purchase/reference matching and integer BDT minor-unit arithmetic. It is not a learned fraud or eligibility model:

| Result | Visible evidence condition | Interaction |
| --- | --- | --- |
| NEEDS_EVIDENCE | Required provider, invoice or second-payment evidence is missing | Accept the complaint and request the missing evidence |
| CONFLICTING | A merchant denial conflicts with the customer cash allegation | Keep the complaint open for further review |
| SUPPORTED | Matching checked postings exceed the invoice total | Investigator can record a cited review and resolution request |
| NOT_SUPPORTED | Complete checked records show no excess, including split tender or uncompleted QR | Explain the checked records; allow additional evidence and review |
| REPAID | A checked completed-repayment record covers the recorded excess | Investigator reviews outstanding requests and saves a cited outcome |

A repayment request is not a completed repayment. Advancing the fictional source does not itself change case evidence. A repayment check imports the source record, and re-analysis is required before a final review. Outstanding evidence requests must be reviewed before recording the final outcome.

## Model accuracy and training

The existing model was genuinely trained on 1,080 synthetic claim/passage pairs. Its grouped synthetic macro F1 was 0.827; its separately authored challenge macro F1 was 0.471. Because broader wording performance is weak, the primary text-label path remains rules with inspectable trained advisory labels. The revised challenge rules score is exploratory because the challenge set was reused. There is no independent human/real-case accuracy claim.

No retraining was performed for the UI revamp. The archive transaction/fraud CSV does not contain the purchase-level cash/receipt language labels needed for this task. Installing or selecting an Ollama language model would not validate source facts or fix missing grounding. Ollama is therefore not a dependency of the interaction prototype. Future learned-model improvements need suitable independently reviewed claim/evidence labels and a fresh held-out evaluation; the previous user-approved scope remains synthetic only.

## Concurrency

Inference runs in a worker thread outside the SQLite write transaction. Customers can read and reply while inference is running. The saved analysis is committed only if the case version still matches its input snapshot; changed evidence triggers a refresh and another analysis, never a stale result marked current.

Reproduce actual artifact-backed inference with `python scripts/simulation_walkthrough.py`. The observed output is saved in `artifacts/mobile_walkthrough.json`; tests use an intentionally overconfident stub to verify that source authority does not come from model labels.
