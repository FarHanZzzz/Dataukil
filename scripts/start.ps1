[CmdletBinding()]
param(
    [ValidateRange(1024,65535)][int]$Port = 8000,
    [switch]$Restart,
    [switch]$Reload,
    [switch]$Check
)
$ErrorActionPreference = 'Stop'
$tracefixRoot = Split-Path -Parent $PSScriptRoot
$tracefixPython = Join-Path $tracefixRoot '.venv\Scripts\python.exe'
Set-Location -LiteralPath $tracefixRoot
if (-not (Test-Path -LiteralPath $tracefixPython -PathType Leaf)) {
    throw "The local Python environment is missing. In $tracefixRoot, run uv venv .venv, then uv pip install --python .venv\Scripts\python.exe -r requirements.lock.txt"
}
& $tracefixPython -c "import fastapi, uvicorn, httpx, pydantic, PIL, multipart; from tracefix.app import app"
if ($LASTEXITCODE -ne 0) {
    throw 'Application imports failed. Repair dependencies with: uv pip install --python .venv\Scripts\python.exe -r requirements.lock.txt'
}
$tracefixListeners = @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
if ($tracefixListeners.Count -gt 0) {
    $tracefixOwnerIds = @($tracefixListeners | Select-Object -ExpandProperty OwningProcess -Unique)
    foreach ($tracefixOwnerId in $tracefixOwnerIds) {
        $tracefixProcess = Get-CimInstance Win32_Process -Filter "ProcessId = $tracefixOwnerId"
        $tracefixIsOwnServer = $tracefixProcess -and
            ($tracefixProcess.CommandLine -match [regex]::Escape($tracefixRoot)) -and
            ($tracefixProcess.CommandLine -match '-m\s+uvicorn\s+tracefix\.app:app(?:\s|$)')
        if (-not $tracefixIsOwnServer) {
            throw "Port $Port belongs to another application (PID $tracefixOwnerId). It was left running. Choose a free port with: .\run.ps1 -Port 8001"
        }
        if ($Check) {
            Write-Host "Dependencies and application imports OK. TraceFix already owns port $Port (PID $tracefixOwnerId)."
            Write-Host 'To load current code in this terminal: .\run.ps1 -Restart'
            exit 0
        }
        if (-not $Restart) {
            Write-Host "TraceFix is already listening on port $Port (PID $tracefixOwnerId)."
            Write-Host "Open http://127.0.0.1:$Port/customer or http://127.0.0.1:$Port/operations"
            Write-Host 'To restart it with current code in this terminal: .\run.ps1 -Restart'
            exit 0
        }
        Write-Host "Stopping this workspace's TraceFix server (PID $tracefixOwnerId); saved cases and uploads remain on disk."
        Stop-Process -Id $tracefixOwnerId -ErrorAction Stop
        Wait-Process -Id $tracefixOwnerId -Timeout 10 -ErrorAction SilentlyContinue
    }
}
if ($Check) {
    Write-Host "Dependencies and application imports OK. Port $Port is available."
    exit 0
}
$tracefixArguments = @('-m','uvicorn','tracefix.app:app','--host','127.0.0.1','--port',"$Port")
if ($Reload) {
    $tracefixArguments += '--reload'
    Write-Host 'Development reload enabled. Reload interrupts active investigations; restart their analysis explicitly.'
}
Write-Host "Customer:   http://127.0.0.1:$Port/customer"
Write-Host "Operations: http://127.0.0.1:$Port/operations"
Write-Host "QR/cash:    http://127.0.0.1:$Port/demo"
Write-Host 'Press Ctrl+C to stop. Restarting preserves the saved database and uploaded evidence.'
& $tracefixPython @tracefixArguments
exit $LASTEXITCODE
