# Observed mobile simulation validation

Date: 3 October 2026. Scope: local synthetic prototype.

## Automated server checks

`python -m pytest -q`: **57 passed**. The original 46 tests remain passing; 11 simulation tests exercise independent customer/staff header tokens, stage guards, idempotency, duplicate complaint prevention, exact amount handling, hidden-source projection, source checks, evidence requests/replies, stale analysis, role restrictions, the repayment sequence and final outcome gates.

An intentionally overconfident text-model stub cannot grant cash authority. The scenario checks cover matching cash+QR overpayment, uncorroborated cash, merchant denial, unequal split tender and an uncompleted QR payment. A concurrent inference test pauses the verifier while a customer reply is accepted, then verifies that the old analysis snapshot is rejected.

Existing upload tests cover actual PNG/text bytes, preserved SHA-256/originals, MIME mismatch, malformed images, size bounds, role access and repeat requests. These are API checks, not claims that the automated browser file chooser completed.

`node --check static/app.js` and Python compilation passed. Frontend files were formatted with Prettier 3.6.2.

## Actual trained inference

`python scripts/simulation_walkthrough.py` completed with the real artifact available and engine `rules_primary_with_trained_advisory`. Output is persisted in `artifacts/mobile_walkthrough.json`.

The fictional purchase total was 72,550 BDT minor units. Two matching checked postings totaled 145,100; a later checked repayment recorded 72,550 returned. The sequence was **NEEDS_EVIDENCE → SUPPORTED → REPAID → OUTCOME_RECORDED**, with four source checks, six saved conversation messages, reviewed customer evidence and accepted ownership transfer to Investigator 2. The source advance itself left the case's returned amount unchanged until a repayment check imported the record.

This is one synthetic integration rehearsal, not an independently validated accuracy benchmark. The existing weak broader-wording model result remains disclosed in `SIMULATION_AI.md`.

## Browser walkthrough

Chrome was used against the running single-origin application. A customer-created purchase at Campus Bookshop, custom item and ৳725.50 amounts persisted through QR uncertainty, cash entry, the eventual provider result and a newly submitted complaint. That exact complaint appeared in the investigator workspace.

The investigator's typed request appeared in the phone. The customer's typed reply was saved as supplied evidence and marked the earlier assessment stale. The investigator's reply appeared in the same phone conversation. Source checks and actual inference produced a supported assessment. The clearly marked simulation repayment control, a repayment check and re-analysis enabled a cited outcome. The request was reviewed, a receiving investigator accepted the handoff, and the final review appeared on the customer overview and in the shared conversation. Reload preserved the case, owner and outcome.

The mobile breakpoint was inspected with a requested 390 × 844 viewport. Browser zoom/window constraints reported a 417 CSS-pixel document viewport, with `scrollWidth == clientWidth`; no horizontal page overflow was observed. Customer-only and investigator views were exercised. The temporary viewport override was reset. Desktop proof is saved in `artifacts/screenshots/mobile-simulation-desktop.jpg`.

## Browser upload limitation

The receipt file chooser opened, but ChatGPT's Chrome automation could not attach a local file because the extension's “Allow access to file URLs” setting is disabled. It was not changed. Actual browser selection/submission of a receipt remains a manual verification step; the API validation above passed. This extension setting affects the automation attachment step, rather than being an application permission requirement for a person using the ordinary file picker.

## Practical limits

No absolute flawlessness or production accuracy claim is made. Sources, purchases and financial outcomes are fictional; no external messages or real financial transfers occur. Independent human-grounded training data, a production identity provider and real financial integrations remain future scope. Ollama was not needed for the interaction revamp.
