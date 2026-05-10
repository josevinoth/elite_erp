@echo off
setlocal

REM Single Task Scheduler launcher for EliteERP backend + Cloudflare tunnel.
REM Usage:
REM   startup_prod.bat [port]
REM   startup_prod.bat --check

set "ARG1=%~1"
set "PORT=%~1"
if "%PORT%"=="" set "PORT=8010"

set "SCRIPT_DIR=%~dp0"
set "CONTROL_BAT=%SCRIPT_DIR%erp_control.bat"
set "TUNNEL_BAT=%SCRIPT_DIR%cloudflare_tunnel.bat"
set "LOG_DIR=%SCRIPT_DIR%logs"
set "TASK_LOG=%LOG_DIR%\task_scheduler.log"

if not exist "%CONTROL_BAT%" (
  echo [ERROR] Missing control script: %CONTROL_BAT%
  exit /b 1
)

if not exist "%TUNNEL_BAT%" (
  echo [ERROR] Missing tunnel script: %TUNNEL_BAT%
  exit /b 1
)

if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

if /i "%ARG1%"=="--check" goto :check

echo [%DATE% %TIME%] Startup trigger received for port %PORT%.>> "%TASK_LOG%"

REM Start backend hidden in a detached process so Task Scheduler can exit cleanly.
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath 'cmd.exe' -ArgumentList '/c call \"%CONTROL_BAT%\" start %PORT%' -WindowStyle Hidden" >> "%TASK_LOG%" 2>&1
if errorlevel 1 (
  echo [%DATE% %TIME%] [ERROR] Failed to start backend launcher.>> "%TASK_LOG%"
  exit /b 1
)

REM Start Cloudflare tunnel hidden in a detached process.
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath 'cmd.exe' -ArgumentList '/c call \"%TUNNEL_BAT%\"' -WindowStyle Hidden" >> "%TASK_LOG%" 2>&1
if errorlevel 1 (
  echo [%DATE% %TIME%] [ERROR] Failed to start tunnel launcher.>> "%TASK_LOG%"
  exit /b 1
)

echo [%DATE% %TIME%] Startup command dispatched (backend + tunnel) for port %PORT%.>> "%TASK_LOG%"
exit /b 0

:check
echo [CHECK] startup_prod.bat validation
echo [CHECK] CONTROL_BAT=%CONTROL_BAT%
echo [CHECK] TUNNEL_BAT=%TUNNEL_BAT%
echo [CHECK] LOG_DIR=%LOG_DIR%
echo [CHECK] TASK_LOG=%TASK_LOG%
echo [CHECK] OK
exit /b 0

