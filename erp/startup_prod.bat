@echo off
setlocal

REM Task Scheduler friendly launcher for EliteERP.
REM Usage:
REM   startup_prod.bat [port]

set "PORT=%~1"
if "%PORT%"=="" set "PORT=8010"

set "SCRIPT_DIR=%~dp0"
set "CONTROL_BAT=%SCRIPT_DIR%erp_control.bat"
set "LOG_DIR=%SCRIPT_DIR%logs"
set "TASK_LOG=%LOG_DIR%\task_scheduler.log"

if not exist "%CONTROL_BAT%" (
  echo [ERROR] Missing control script: %CONTROL_BAT%
  exit /b 1
)

if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

echo [%DATE% %TIME%] Startup trigger received for port %PORT%.>> "%TASK_LOG%"

REM Launch erp_control in a separate minimized cmd window and return immediately.
start "EliteERP Startup %PORT%" /min cmd /c "call "%CONTROL_BAT%" start %PORT% >> "%TASK_LOG%" 2>&1"

echo [%DATE% %TIME%] Startup command dispatched for port %PORT%.>> "%TASK_LOG%"
exit /b 0

