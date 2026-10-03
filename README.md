# DataUkil — Transaction Investigation & Operations Intelligence

DataUkil is the website's product name. Existing `tracefix` Python paths, `TRACEFIX_*` settings, session headers/cookies and saved case references remain stable for compatibility.

Every website surface now uses the shared **light theme**: white cards, pale blue backgrounds, slate text and blue actions. The homepage hero uses the supplied landscape image. Customer, QR, Add money, operations, Studio and report pages share the same palette and typography. See [light-theme validation](docs/LIGHT_THEME_VALIDATION.md).

The [master build prompt](docs/MASTER_BUILD_PROMPT.md) is the authoritative scope. DataUkil is a local **synthetic prototype**: payment and correction records are fictional. Persistent bank-to-upay transfers, the AI Investigation Studio and approved sandbox repairs now run alongside the unified QR + cash investigation and the add-money walkthrough pulled from `main`.

Implementation progress (3 October 2026, Asia/Dhaka):

Merged verification: **121 tests passed**, followed by **27 passing add-money/integration checks** after the handoff-label fix. Actual trained inference and local Qwen reproduced both flagship endings; see the [validation record](docs/MAIN_SYNC_VALIDATION.md).

| Phase | Status | Result |
|---|---|---|
| 1 — Correctness and identity | Implemented; 61 regression checks passed | Stable incident mapping, private internal follow-up, full repayment closure gate, closing SQLite connections, additive tables |
| 2 — Synthetic transfers and customer dashboard | Implemented; scenario/API checks passed | Eight persistent bank-to-upay fixtures, saved processing events, owned complaints, balance conservation, English/বাংলা switching |
| 3 — Operations and reconstruction | Implemented; queue/source checks passed | Server-derived queue/cards, expandable payment sources, unknown states retained |
| 4 — Durable investigation and local AI | Implemented; backend contracts passed | Saved runs/events, trained advisory verifier, local Qwen structured output, blocked proposals and explicit fallback |
| 5–6 — Studio and controlled outcomes | Implemented; both saved endings verified | Evidence graph, hypotheses, replay, isolated reset, three approved atomic sandbox actions and owned handoff |
| 7 — Coverage, reports and final verification | Implementation documented; validation recorded | Markdown/JSON exports, [33-section coverage matrix](docs/MASTER_COVERAGE.md) and [integration validation](docs/MAIN_SYNC_VALIDATION.md) |

The **QR + cash investigation** at `/qr-demo` keeps the customer phone and operator workflow in one saved journey: QR failure → cash receipt → later observed debit → receipt attachment and complaint → OpenCV visual scan → synthetic Marketplace comparison → verdict. Matching records propose an operator-approved simulated refund; rejected cases create no refund, while uncertain cases remain owned and open for human review. Refresh and exact-context bookmarks restore progress. [Workflow and API contract](docs/QR_CASH_INVESTIGATION.md).

Interaction context: [mobile simulation](docs/MOBILE_SIMULATION.md), [assessment behavior](docs/SIMULATION_AI.md), and [observed validation](docs/MOBILE_VALIDATION.md).

Run on Windows / PowerShell:

```powershell
cd D:\dataukil
.\run.ps1 -Restart
```

The launcher automatically opens the [homepage](http://127.0.0.1:8000/) when the server responds. **Add money** is directly accessible from the header, hero and dedicated Bank → Wallet → Investigation → Outcome section on desktop and mobile. **QR + cash** opens the unified customer/operator investigation at `/qr-demo`; **Workspaces** contains the transfer dashboard and operations links.

| Page | Purpose |
|---|---|
| `/` | Redesigned homepage; links to all workspaces |
| `/customer` | Eight bank-to-upay scenarios, complaints, evidence and verified English/বাংলা updates |
| `/operations` | Persistent queue, overview and case workspace |
| `/operations/cases/{case_id}/studio` | Dedicated AI investigation, hypotheses, citations, replay and separate approval/execution |
| `/qr-demo` | Unified QR + cash customer, receipt scan, Marketplace, verdict and simulated resolution journey |
| `/mfs` (also `/demo`) | Five-stage Add money guide: explicit scenario choice, same-tab progression and exact-run resume |
| `/customer/payment[/{id}]`, `/customer/cases/{id}` | Add money form, saved review, customer-safe status and investigation updates |
| `/admin/queue`, `/admin/cases/{id}[ /report]` | Light investigation board with existing topology and controls, mobile Board/Details/Activity views, report and exports |

The two payment workspaces have distinct case families and ledgers in the shared SQLite database. Their routes enforce those boundaries. The add-money walkthrough uses its own rules-based investigation; the Studio uses the trained advisory verifier and optional local Qwen.

The workspace already has its environment and trained artifact. The launcher checks application imports and, with `-Restart`, replaces only this workspace's existing DataUkil server. It leaves unrelated applications running. Saved cases and uploads stay in `runtime/`. Press **Ctrl+C** in your terminal to stop. Write `-Restart` as one argument; the launcher also accepts the accidental spelling `- Restart`. Both spellings were verified with `-Check`.

Use `.\run.ps1 -Check` for an installation/port check without starting, stopping or opening a browser. Use `-NoBrowser` to start without opening the homepage. For development, use `.\run.ps1 -Restart -Reload`; a reload interrupts active investigations, which require an explicit analysis restart. If another application owns port 8000, choose a free port with `.\run.ps1 -Port 8001`.

Direct launch, after stopping any older DataUkil server:

```powershell
.\.venv\Scripts\python.exe -m uvicorn tracefix.app:app --host 127.0.0.1 --port 8000
```

Only for a fresh checkout without `.venv`, install first:

```powershell
uv venv .venv
uv pip install --python .venv\Scripts\python.exe -r requirements.lock.txt
```

Fresh checkout ML preparation:

```powershell
.venv\Scripts\python.exe -m ml.download
.venv\Scripts\python.exe -m ml.build_data
.venv\Scripts\python.exe -m ml.train
.venv\Scripts\python.exe -m ml.evaluate
.venv\Scripts\python.exe scripts\demo_walkthrough.py
.venv\Scripts\python.exe scripts\simulation_walkthrough.py
.venv\Scripts\python.exe -m pytest -q
```

The encoder is frozen; a logistic regression classifier head is actually trained. First-run grouped synthetic macro F1: **0.827**; separately authored challenge macro F1: **0.471**. All labels are agent-authored and lack independent human review. Rules are the primary advisory path, with actual trained labels separately visible. Revised rules reuse the challenge test; the original results are preserved. These scores are not real-world accuracy claims.

The separate add-money investigation remains available at `/mfs`, with `/customer/payment` and `/admin/queue` pages, as documented in [docs/ADD_MONEY_INVESTIGATION.md](docs/ADD_MONEY_INVESTIGATION.md).

Copy-ready ElevenLabs narration for each customer-facing, operations, investigation, and demonstration page is available in [docs/ELEVENLABS_PAGE_NARRATION.md](docs/ELEVENLABS_PAGE_NARRATION.md).

Start with [the context index](docs/CONTEXT.md), [runbook](docs/RUNBOOK.md), [implementation handoff](docs/HANDOFF.md), and [ML/data context](docs/ML.md). The supplied [final specification](TraceFix_Final_Track6_Hybrid_and_Master_Prompt.md) is preserved. Archive transaction data was not used for evidence-verifier training.

For live Studio proposals, start Ollama with `qwen3:4b-instruct` installed at `http://127.0.0.1:11434`. Valid provider use is labelled **LIVE AI INVESTIGATION**. Unavailable, timed-out or invalid output produces **DEMO INVESTIGATION — SIMULATED AI TRACE** with a saved fallback event. Private reasoning is not displayed. Model output cannot authorize a correction; the backend rechecks evidence, ownership, posting references, amount and freshness at approval and execution.

Reproduce both flagship endings with actual trained inference and optional local Qwen:

```powershell
.\.venv\Scripts\python.exe scripts\master_walkthrough.py --live
```

The walkthrough uses a new isolated database, uploads a real synthetic PNG receipt, verifies source-grounded verdicts, balanced corrections, handoff, replay purity and retained history, and exports its results under `artifacts/`. See [coverage and architecture](docs/MASTER_COVERAGE.md), [current validation](docs/MAIN_SYNC_VALIDATION.md) and the [add-money workflow](docs/ADD_MONEY_INVESTIGATION.md).
