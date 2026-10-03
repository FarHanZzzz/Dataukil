# QR + cash validation

Validated locally on 3–4 October 2026, Asia/Dhaka, using isolated SQLite databases and Chrome. This is a synthetic demonstration.

| Check | Observed result |
| --- | --- |
| QR backend | 24 tests passed: lifecycle, receipt drafts, original hashes, OpenCV manifests, idempotency, exact source checks, stale evidence, privacy, owner approval and all branches |
| Combined non-ML backend suites | 141 passed: QR, simulation, workflow, integration, transfer and master suites |
| QR browser acceptance | 112 assertions passed, including actual image upload, scan and Marketplace animations, legitimate/rejected/uncertain branches, replay, keyboard controls and native drawer focus |
| Responsive | 320, 390, 768, 1024, 1440 and 1920px: no page or panel overflow; table and graph scrolling stays local |
| Navigation | Same tab, companion tab, exact IDs, refresh, Back/Forward, explicit resume and unavailable-context recovery passed |
| Add money regression | 192 browser assertions passed across all four scenarios and all six widths |

Browser results were saved in `/tmp/dataukil-qr-ui-eza63q/results.json` with screenshots and traces. The later light-theme checks and current screenshot artifacts are documented in [LIGHT_THEME_VALIDATION.md](LIGHT_THEME_VALIDATION.md).

The original desktop Add money board comparison was byte-identical at 1440px and 1920px before the subsequent site-wide light-theme request. The board now intentionally uses the requested light palette. Its graph module and financial contracts remain intact.

The full Python suite also has two pre-existing ML failures: `test_groups_and_cases_disjoint_and_hashes_recorded` reports a dataset/manifest checksum mismatch; `test_real_artifact_inference_and_explicit_token_abstention` cannot load the trained verifier because this local environment lacks `torch`. The tracked dataset and ML files were not changed to suppress these failures. The QR OpenCV and synthetic Marketplace pipeline does not depend on that model.

Reproduction:

```bash
PYTHONPATH=. .venv/bin/pytest -q tests/test_qr_workflow.py tests/test_simulation.py tests/test_workflow.py tests/test_integration.py tests/test_transfer.py tests/test_master.py
PLAYWRIGHT_MODULE=/path/to/playwright TRACEFIX_CHROME=/path/to/chrome node scripts/check_qr_ui.mjs
PLAYWRIGHT_MODULE=/path/to/playwright TRACEFIX_CHROME=/path/to/chrome TRACEFIX_KEEP_UI_ARTIFACTS=1 node scripts/check_add_money_ui.mjs
```

Each browser runner creates an isolated server/database and shuts down its server afterward. No real Marketplace service or financial transfer is involved.
