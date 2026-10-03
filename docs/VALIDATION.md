# Validation context

Current browser validation: [QR + cash](QR_UI_VALIDATION.md) and [site-wide light theme](LIGHT_THEME_VALIDATION.md). The results below describe the earlier build.

Predeclared operational gates: no ownership leak; customer cannot execute staff mutations; arbitrary uploads never verified; no automatic financial routes; QR completion never resolves second-payment question; repayment request != completion; evidence changes make analyses/decisions stale; exact mismatch gates; successful duplicate operations replay; changed keys/new stale writes conflict; GET purity; failed handoff retains owner; missing model/evaluation honest; citations match stored evidence versions.

Predeclared exploratory ML report: three-class macro F1, confusion matrices, per-language metrics, unsupported support fraction, contradiction recall, insufficient-evidence recall, latency and baseline differences. No fixed accuracy target justifies deployment on unreviewed synthetic data. Production gate requires independently reviewed authorized real cases and operational evaluation.

Browser checks: landing, narrow customer intake/case, staff matrix/source selection, correction+staleness, task/review, handoff, export and judge results. Keyboard labels/focus, reduced motion, escaped hostile text and preserving saved status on failed fetch.

## Observed results

3 October 2026, Asia/Dhaka:

* `.venv\Scripts\python.exe -m pytest -q`: **46 passed** in 10.33 s after rule-v2 changes. One Starlette warning about future httpx TestClient deprecation; it does not affect the deployed app. Tests include actual artifact load/abstention; most workflow tests use an intentionally overconfident stub to check that labels cannot elevate source authority.
* `node --check static\app.js`: passed.
* `.venv\Scripts\python.exe -m compileall -q tracefix ml scripts`: passed.
* Training: artifact written and reloaded; development-only C selection; ~27.0 s CPU training/embedding time.
* Evaluation: v1 first-run results preserved; v2 revised rule results marked test_reused. Raw predictions and error analyses are saved.
* `scripts/demo_walkthrough.py`: four actual-inference journeys passed. Completed repayment invalidated prior analysis, then a cited human outcome was saved. Five grounded dossier snapshots exported. Latest warm case analyses about 0.080–0.101 s, first loaded analysis about 6.878 s; these are local API measurements with fictional cases, not operational preparation time.
* Chrome: mobile viewport requested 390×844; measured effective CSS width 417 px due browser scaling. Customer list/intake/exact lookup/Bangla follow-up/saved status had content width equal to viewport width. Desktop inbox/source matrix/actual inference/transcript correction with staleness/persisted evidence request/evaluation limitations inspected. Browser console warning/error log empty after current UI. Temporary viewport restored. Evidence survived application restart. Source selection now resolves the explicitly cited historical transcript revision; newer text is separate.

Important: passing acceptance tests is not proof of all possible interactions or production correctness. The synthetic-only scope is implemented; real-data accuracy, independent human review, provider contracts and production load are future validation.
