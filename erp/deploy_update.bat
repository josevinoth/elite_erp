@echo off
setlocal

REM Apply latest code updates and restart EliteERP server.
REM Usage:
REM   deploy_update.bat [port]

set "PORT=%~1"
if "%PORT%"=="" set "PORT=8010"

set "SCRIPT_DIR=%~dp0"
set "CONTROL_BAT=%SCRIPT_DIR%erp_control.bat"

if not exist "%CONTROL_BAT%" (
  echo [ERROR] Missing control script: %CONTROL_BAT%
  exit /b 1
)

echo [INFO] Applying update and restarting EliteERP on port %PORT%...
call "%CONTROL_BAT%" stop %PORT% >nul 2>&1

REM Start in a detached minimized window so this script can exit cleanly.
start "EliteERP %PORT%" /min cmd /c "call "%CONTROL_BAT%" start %PORT%"

echo [OK] Restart triggered.
echo [INFO] Check startup logs in: %SCRIPT_DIR%logs
echo [INFO] Verify with: "%CONTROL_BAT%" status %PORT%

exit /b 0

