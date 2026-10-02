$ErrorActionPreference = 'Stop'
$tracefixRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $tracefixRoot
& "$tracefixRoot\.venv\Scripts\python.exe" -m uvicorn tracefix.app:app --host 127.0.0.1 --port 8000
