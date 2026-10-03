# Main-branch integration validation

Updated 3 October 2026, Asia/Dhaka. The local master integration was committed before merging the 12 newer commits through `origin/main` at `e5a9f6e`. A local recovery branch, `backup/local-master-integration-20261003`, preserves that pre-merge implementation. SQLite was backed up separately under ignored `runtime/` before restarting the application.

## Merge decisions

- Keep the newer Nexus homepage and its self-hosted assets at `/`.
- Preserve the local QR/cash UI under `static/legacy/`, served at `/qr-demo`.
- Retain `/customer`, `/operations` and the dedicated Studio for master-prompt investigations. The newer add-money pages remain `/customer/payment`, `/admin/queue` and `/mfs`; `/demo` retains its newer redirect to `/mfs`.
- Combine both application lifecycle handlers, additive SQLite schemas and session-header formats. Both background engines shut down through the shared lifespan.
- Prevent add-money cases from entering QR/Studio routes or overview calculations. Prevent presenter sessions from reading the other workspace's financial/case projections.
- Retain source freshness, stable incident identity, notification privacy and partial-repayment fixes.
- Open the homepage automatically after readiness, including when the project server is already running. `-Check` never launches a browser; `-NoBrowser` suppresses opening.

## Automated evidence

| Check | Observed result |
|---|---|
| Full combined suite | **121 passed**, one dependency deprecation warning, 74.47 seconds; `artifacts/main_sync_pytest.txt` |
| Add-money and merge follow-up tests | **27 passed**, 16.57 seconds; `artifacts/main_sync_followup_pytest.txt` |
| Original combined suite before added integration tests | 119 passed |
| JavaScript syntax | Homepage, console, legacy UI and changed add-money modules passed `node --check` |
| Python compilation | `compileall -q tracefix scripts` passed |
| Launcher | Correct and spaced restart spelling passed `-Check`; actual restart opened the homepage in Chrome and served HTTP 200 |
| Shared storage | Two case families coexist, restart preserves both and existing posting records, each API rejects the other family's case |
| Handoff semantics | Unconfirmed add-money handoff now reports the `handoff` phase, without claiming payment resolution |

The full suite covers all eight bank-transfer fixtures, the four add-money fixtures, real trained-verifier loading, evidence authority, customer privacy, upload/download, incident idempotency, concurrent repairs, amount conservation, stale approvals, ownership transfer, failed attempts, model grounding and provider failure modes. Follow-up tests validate the final add-money handoff change; later layout/cache changes were checked through syntax, routes and browser observations.

## Actual trained and live-model walkthrough

`scripts/master_walkthrough.py --live` completed against a new isolated database. Both cases used the actual frozen multilingual encoder and trained classifier head. The duplicate case used actual local `qwen3:4b-instruct`, returning validated output in **16.22 seconds**. The uncertain case explicitly selected demo mode.

| Ending | Result | Financial invariant |
|---|---|---|
| Verified duplicate | SUPPORTS CLAIM; separately approved and executed reversal; RESOLVED / CORRECTED | Exactly one intended transfer remains; balanced postings; zero remaining duplicate |
| Missing partner response | INCONCLUSIVE; repair blocked; ESCALATED; receiving owner acknowledged | One known debit, unconfirmed wallet/settlement; ৳1,000 remains unsettled |

Both runs saved all **11 phases** and **20 events**, with purpose, action, finding, change and next-step explanations. The script uploaded actual synthetic PNG bytes, retrieved the original, verified report hashes and ledger agreement, proved replay/report reads leave the database unchanged, and proved isolated reset preserves earlier records. Reports and the summary are under `artifacts/master-*`.

## Browser observations

- The launcher opened the actual homepage at `http://127.0.0.1:8000/` after readiness. The user subsequently requested removal of the Customer, Investigator, Judge and MFS navigation shortcuts; the header now offers Overview, How it works, Payments and Operations, and duplicate footer shortcuts were removed.
- On an isolated browser database at port 18004, a ৳1,000 add-money request progressed into an automatic incident. The investigator graph showed real saved check requests, observations, hypotheses and an eligible resume proposal. Approval produced one confirmed wallet credit, and the open customer page updated to **Your wallet credit is confirmed**.
- The master customer dashboard created a separate missing-response transfer, ran all saved stages, kept response/settlement/wallet unknown, saved a Bangla complaint and restored it after refresh. The operations queue showed that same transaction and complaint; Analyze Case opened the dedicated Studio. The Studio completed all eleven phases with eighteen investigation events, an inconclusive verdict and blocked repair. Replay started at zero events; pause, resume, 4× speed and exit controls worked. No console errors or warnings were recorded on this console tab.
- A requested 390×844 viewport produced an effective Chrome content width of 434 pixels on this system. The dashboard had no document-width overflow. The payment graph was changed from tiny scaled nodes to readable rows, and the settlement drawer opened from its node. Desktop sizing was restored afterwards.
- The app marks its bilingual console `translate="no"` so the browser's automatic translation cannot rewrite source statements or the interface's chosen language. English/বাংলা switching remains under the app's control.

Screenshots are stored locally under ignored `artifacts/screenshots/`. Browser file-chooser upload automation was limited by the browser extension's existing file-access setting; the actual upload endpoint and original-byte retrieval are verified. No security setting was weakened.

## Reproduce

```powershell
cd D:\dataukil
.\run.ps1 -Restart
.\.venv\Scripts\python.exe -m pytest -q
.\.venv\Scripts\python.exe scripts\master_walkthrough.py --live
```

All payments, source records and corrections remain synthetic. The unchanged synthetic model evaluation is not independent real-case accuracy evidence. This record establishes the observed checks and outcomes; it does not promise every possible deployment or failure condition is covered.
