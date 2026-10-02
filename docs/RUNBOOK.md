# Runbook

## Start the existing workspace

```powershell
cd D:\dataukil
.venv\Scripts\python.exe -m uvicorn tracefix.app:app --host 127.0.0.1 --port 8000
```

Open http://127.0.0.1:8000. The local background server may already own port 8000; do not start a duplicate server. `Get-NetTCPConnection -LocalPort 8000 -State Listen` identifies its actual process. Inspect its command before stopping it; do not stop unrelated Python processes. Logs of the agent-started server: runtime/server.out.log and server.err.log. Alternatively run scripts/start.ps1 in a terminal.

## Reproduce environment and training

```powershell
uv venv .venv
uv pip install --python .venv\Scripts\python.exe -r requirements.lock.txt
.venv\Scripts\python.exe -m ml.download
.venv\Scripts\python.exe -m ml.build_data
.venv\Scripts\python.exe -m ml.train
.venv\Scripts\python.exe -m ml.evaluate
```

The current workspace already contains the model and encoder. Download needs network and ~500 MiB for encoder files, plus the Python environment. Inference is offline after setup. The application still works with an explicitly labelled rules fallback if model files are absent. The encoder is pinned by upstream revision. Training reconstructs the fictional corpus; it does not download real customer data. First historical v1 evaluation artifacts are retained; a fresh current-code evaluation uses rule v2 and cannot reproduce the retired v1 baseline implementation.

## Verify

```powershell
.venv\Scripts\python.exe -m pytest -q
node --check static\app.js
.venv\Scripts\python.exe -m compileall -q tracefix ml scripts
.venv\Scripts\python.exe scripts\demo_walkthrough.py
```

The walkthrough uses a newly generated isolated database in runtime/, invokes the actual trained artifact, and writes five dossiers to artifacts/dossiers/ plus demo_results.json. It leaves the browser demo database intact. SQLite startup seeds only an empty database; an explicit `TRACEFIX_DB` path can create a separate fresh demo without deleting existing work.

## Four judge journeys

1. Open Demo & evaluation, then the linked cash+QR case. Analyze, inspect mock QR/invoice/merchant source authority, and record evidence assembled with citations. No repayment executes.
2. Open equal-value purchases. Inspect the different purchase reference and its mismatch gate. The recorded tender for this case stays BDT 500.
3. Open unestablished cash. Inspect the Bangla transcript and unverified provenance, then save the merchant acknowledgement request and next review. Customer portal displays the saved step.
4. Open repayment case before advancing the source. Requested does not mean completed. In judge view reveal source availability, then staff runs repayment check. Analysis becomes stale, source-backed returned amount becomes BDT 500, and re-analysis enables a cited human outcome record.

Useful fixture references: QR-DEMO-001, 003 and 004 for Customer 1; QR-DEMO-002 for Customer 2. Switch Investigator 2 to acknowledge an explicit handoff addressed to staff_2. A failed or unauthorized acknowledgement retains the old owner.

## Independent annotation rehearsal

```powershell
.venv\Scripts\python.exe scripts\export_review_packet.py
```

data/blind_review_packet.jsonl omits candidate labels and predictions. REVIEW_PROTOCOL.md describes real independent review; running this script does not perform it.

SQLite and uploaded originals live in ignored `runtime/`; downloaded encoder lives in ignored `models/encoder/`. Application startup initializes fixtures only when database is empty. Restart preserves saved state. No reset-on-refresh.

The user explicitly selected **synthetic prototype only for now**. Fixture session switching intentionally offers predefined roles. A production identity provider, approved financial evidence ingestion and independent human review are separate future release gates. No public hosting or external messages were requested or performed.
