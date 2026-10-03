# TraceFix — Paid-Twice Investigation Workspace

Working local **synthetic prototype** of the final Track 6 specification. Persistent customer intake, investigator evidence review, source/transcript versions, read-only mock checks, owned follow-up, handoff, human review and Markdown dossiers. No financial action routes.

Run on Windows / PowerShell:

```powershell
cd D:\dataukil
uv venv .venv
uv pip install --python .venv\Scripts\python.exe -r requirements.lock.txt
.venv\Scripts\python.exe -m uvicorn tracefix.app:app --host 127.0.0.1 --port 8000
```

Open http://127.0.0.1:8000. The current workspace already has the environment and trained artifact. If the port is in use, the local app may already be running.

Fresh checkout ML preparation:

```powershell
.venv\Scripts\python.exe -m ml.download
.venv\Scripts\python.exe -m ml.build_data
.venv\Scripts\python.exe -m ml.train
.venv\Scripts\python.exe -m ml.evaluate
.venv\Scripts\python.exe scripts\demo_walkthrough.py
.venv\Scripts\python.exe -m pytest -q
```

The encoder is frozen; a logistic regression classifier head is actually trained. First-run grouped synthetic macro F1: **0.827**; separately authored challenge macro F1: **0.471**. All labels are agent-authored and lack independent human review. Rules are the primary advisory path, with actual trained labels separately visible. Revised rules reuse the challenge test; the original results are preserved. These scores are not real-world accuracy claims.

The stalled add-money investigation starts at **`/mfs`** (also linked in the site navigation) and opens the customer and operations pages (`/customer`, `/admin`). It is documented in [docs/ADD_MONEY_INVESTIGATION.md](docs/ADD_MONEY_INVESTIGATION.md).

Start with [the context index](docs/CONTEXT.md), [runbook](docs/RUNBOOK.md), [implementation handoff](docs/HANDOFF.md), and [ML/data context](docs/ML.md). The supplied [final specification](TraceFix_Final_Track6_Hybrid_and_Master_Prompt.md) is preserved. Archive transaction data was not used for evidence-verifier training.
