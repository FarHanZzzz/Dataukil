@echo off
setlocal
cd /d "%~dp0"

REM ============================================
REM  DataUkil — double-click this file to start
REM ============================================
REM  Do NOT double-click run.ps1 or .md files.
REM  Windows opens those in Notepad.
REM ============================================

title DataUkil
echo.
echo  Starting DataUkil...
echo  When ready, open:  http://127.0.0.1:8000/
echo.
echo  Customer:    http://127.0.0.1:8000/customer
echo  Operations:  http://127.0.0.1:8000/operations
echo  QR + cash:   http://127.0.0.1:8000/qr-demo
echo.
echo  Leave this window open while you demo.
echo  Press Ctrl+C to stop the server.
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0run.ps1" -Restart
set "ERR=%ERRORLEVEL%"
if not "%ERR%"=="0" (
  echo.
  echo  Start failed with exit code %ERR%.
  echo  Fix dependencies in this folder:
  echo    uv venv .venv
  echo    uv pip install --python .venv\Scripts\python.exe -r requirements.lock.txt
  echo.
  pause
)
exit /b %ERR%
