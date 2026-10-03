# TraceFix — Transaction Investigation & Operations Intelligence

The new [master build prompt](docs/MASTER_BUILD_PROMPT.md) supersedes the earlier paid-twice-only scope. This remains a local **synthetic prototype**: payment and correction records are fictional. The existing paid-twice workspace is preserved while the master integration is implemented.

Implementation progress (3 October 2026, Asia/Dhaka):

| Phase | Status | Result |
|---|---|---|
| 1 — Correctness and identity | Implemented; 61 regression checks passed | Stable incident mapping, private internal follow-up, full repayment closure gate, closing SQLite connections, additive tables |
| 2 — Synthetic transfers and customer dashboard | Implemented; browser validation in progress | Eight persistent bank-to-upay fixtures, saved processing events, owned complaints, balance conservation, English/বাংলা switching |
| 3 — Operations and reconstruction | Implemented; browser validation in progress | Server-derived queue/cards, expandable payment sources, unknown states retained |
| 4 — Durable investigation and local AI | Implemented; backend contracts passed | Saved runs/events, trained advisory verifier, local Qwen structured output, blocked proposals and explicit fallback |
| 5–6 — Studio and controlled outcomes | Implemented; browser validation in progress | Evidence graph, hypotheses, replay, isolated reset, three approved atomic sandbox actions and owned handoff |
| 7 — Coverage, reports and final verification | In progress | Markdown/JSON exports implemented; final validation and coverage documentation being completed |

The website now runs a **mobile wallet simulation** beside a live investigator desk. Enter a purchase and your own amounts, attempt QR, record cash, check the eventual QR outcome, and file a linked complaint. Customer/investigator messages, evidence requests, source checks, assessments and cited outcomes are saved to the same case. Refresh restores progress. Simulation controls provide different fictional source behaviors and a clearly marked repayment stage.

Interaction context: [mobile simulation](docs/MOBILE_SIMULATION.md), [assessment behavior](docs/SIMULATION_AI.md), and [observed validation](docs/MOBILE_VALIDATION.md).

Run on Windows / PowerShell:

```powershell
cd D:\dataukil
.\run.ps1 -Restart
```

Open [Customer](http://127.0.0.1:8000/customer), [Operations](http://127.0.0.1:8000/operations), or the retained [QR/cash demo](http://127.0.0.1:8000/demo).

The workspace already has its environment and trained artifact. The launcher checks application imports and, with `-Restart`, replaces only this workspace's existing TraceFix server. It leaves unrelated applications running. Saved cases and uploads stay in `runtime/`. Press **Ctrl+C** in your terminal to stop. Write `-Restart` as one argument; the launcher also accepts the accidental spelling `- Restart`. Both spellings were verified with `-Check`.

Use `.\run.ps1 -Check` for an installation/port check without starting or stopping a server. For development, use `.\run.ps1 -Restart -Reload`; a reload interrupts active investigations, which require an explicit analysis restart. If another application owns port 8000, choose a free port with `.\run.ps1 -Port 8001`.

Direct launch, after stopping any older TraceFix server:

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

Start with [the context index](docs/CONTEXT.md), [runbook](docs/RUNBOOK.md), [implementation handoff](docs/HANDOFF.md), and [ML/data context](docs/ML.md). The supplied [final specification](TraceFix_Final_Track6_Hybrid_and_Master_Prompt.md) is preserved. Archive transaction data was not used for evidence-verifier training.
