# Runbook

## Start the existing workspace

**Easiest on Windows:** double-click `run.bat` in `D:\dataukil`.
Do **not** double-click `run.ps1` — Windows often opens `.ps1` files in Notepad.

```powershell
cd D:\dataukil
.\run.bat
# or:
.\run.ps1 -Restart
```

The launcher opens http://127.0.0.1:8000/ automatically after the server responds. **Add money** opens `/mfs`; **QR + cash** opens `/qr-demo`; **Workspaces** contains the transfer dashboard (`/customer`) and operations (`/operations`). The launcher checks imports and `-Restart` replaces only this workspace's existing DataUkil server. Saved cases and uploads remain on disk. **Ctrl+C** stops it. `-NoBrowser` suppresses automatic opening.

Use `.\run.ps1 -Check` to check imports and port status without launching. `.\run.ps1 -Restart -Reload` enables development reload; an interrupted investigation needs an explicit restart. An unrelated application on port 8000 is left alone; choose another port with `.\run.ps1 -Port 8001`. The same switches work with `scripts/start.ps1`.

The unified QR + cash investigation is at `/qr-demo`; it retains exact purchase/case bookmarks and has separate receipt scan, synthetic Marketplace and operator outcome stages. See [QR investigation](QR_CASH_INVESTIGATION.md). `/demo` redirects to `/mfs`: choose an Add money scenario and start the five-stage journey in the same tab. Review before confirming; returning to the guide resumes the saved payment or investigation. Use **Open companion investigation view** for a separate demonstration tab. On mobile, the board's Queue drawer and Board/Details/Activity controls keep every panel reachable. See [Add money](ADD_MONEY_INVESTIGATION.md) for scenarios and verification. At `/customer`, create a synthetic bank-to-upay transfer, run its stages and report the issue. Open its case from Operations and click **Analyze Case** to enter the Studio. **Verified duplicate** supports a separately approved sandbox reversal. **Missing response** blocks repair and requires an owned handoff.

## Run the mobile app simulation

1. Open **Live simulation**, or choose **Customer app** for the phone alone. Use **Simulation controls → New simulation** to create another purchase while preserving previous work.
2. Enter name, merchant, item, invoice total and QR amount. Continue to payment, choose **Pay by QR**, then record the cash payment in the unclear-result screen.
3. Check the QR status, choose **Report paying twice**, and submit your own complaint wording. The saved case appears in the phone and investigator desk; an initial evidence assessment runs.
4. In the investigator overview, check the **QR provider**, **Purchase invoice** and **Merchant cash record**, then **Update assessment**. Missing records yield a concrete request for evidence. No missing cash record is automatically classified as a false complaint.
5. **Request evidence** saves a question and review time. In the phone, **Reply to request** sends a real case message. Staff see it in **Conversation** and as supplied **Evidence**. Review and resolve the request before recording a final outcome.
6. On a supported assessment, **Request resolution** records a request only. In the separate simulation controls, **Advance repayment source** creates a fictional source record. Staff then check **Repayment record**, update the assessment and **Save review → Record the checked repayment outcome**, citing the completed source record.
7. The phone displays the investigator's exact review note and confirmed source observations. **Back** returns to all complaints; **Activity** displays the selected purchase's saved events. The staff **Inbox** and simulation purchase selector restore earlier work.

The optional source setup is selected before creating a purchase: independent cash acknowledgement, only a customer assertion, merchant denial or a failed QR. For split tender, enter an invoice total above the QR amount and record the remainder as cash. Model metadata and measured scores are available through **Simulation controls → Model evaluation**. **Evidence → Add supplied evidence** lets staff record additional wording; it stays unverified. Uploaded images have an original-image viewer and separately labelled human transcript.

Reproduce the complete new journey with actual inference:

```powershell
.venv\Scripts\python.exe scripts\simulation_walkthrough.py
```

The script uses a new isolated SQLite database in `runtime/`, preserves the browser's database, and writes `artifacts/mobile_walkthrough.json`.

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

1. Open **Simulation controls → Open seeded example cases**, then the linked cash+QR case. Analyze, inspect mock QR/invoice/merchant source authority, and record evidence assembled with citations. No repayment executes.
2. Open equal-value purchases. Inspect the different purchase reference and its mismatch gate. The recorded tender for this case stays BDT 500.
3. Open unestablished cash. Inspect the Bangla transcript and unverified provenance, then save the merchant acknowledgement request and next review. Customer portal displays the saved step.
4. Open the seeded repayment case before advancing the source. Requested does not mean completed. In simulation controls choose **Advance seeded repayment example**, then staff runs the repayment check. Analysis becomes stale, source-backed returned amount becomes BDT 500, and re-analysis enables a cited human outcome record.

Useful fixture references: QR-DEMO-001, 003 and 004 for Customer 1; QR-DEMO-002 for Customer 2. Switch Investigator 2 to acknowledge an explicit handoff addressed to staff_2. A failed or unauthorized acknowledgement retains the old owner.

## Independent annotation rehearsal

```powershell
.venv\Scripts\python.exe scripts\export_review_packet.py
```

data/blind_review_packet.jsonl omits candidate labels and predictions. REVIEW_PROTOCOL.md describes real independent review; running this script does not perform it.

SQLite and uploaded originals live in ignored `runtime/`; downloaded encoder lives in ignored `models/encoder/`. Application startup initializes fixtures only when database is empty. Restart preserves saved state. No reset-on-refresh.

The user explicitly selected **synthetic prototype only for now**. Fixture session switching intentionally offers predefined roles. A production identity provider, approved financial evidence ingestion and independent human review are separate future release gates. No public hosting or external messages were requested or performed.
