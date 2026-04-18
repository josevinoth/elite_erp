@echo off
setlocal enabledelayedexpansion

REM Unified control script for EliteERP.
REM Usage:
REM   erp_control.bat start [port]
REM   erp_control.bat stop [port]
REM   erp_control.bat status [port]
REM   erp_control.bat restart [port]
REM   erp_control.bat logs [port]

set "ACTION=%~1"
if "%ACTION%"=="" set "ACTION=status"
set "PORT=%~2"
if "%PORT%"=="" set "PORT=8010"
set "HOST=0.0.0.0"

set "SCRIPT_DIR=%~dp0"
for %%i in ("%SCRIPT_DIR%..") do set "ROOT_DIR=%%~fi"
set "VENV_DOT_PY=%ROOT_DIR%\.venv\Scripts\python.exe"
set "VENV_PY=%ROOT_DIR%\venv\Scripts\python.exe"
set "LOG_DIR=%SCRIPT_DIR%logs"
set "SERVER_LOG=%LOG_DIR%\server_%PORT%.log"
set "STARTUP_LOG=%LOG_DIR%\startup_%PORT%.log"

if /i "%ACTION%"=="start" goto :start
if /i "%ACTION%"=="stop" goto :stop
if /i "%ACTION%"=="status" goto :status
if /i "%ACTION%"=="restart" goto :restart
if /i "%ACTION%"=="logs" goto :logs

echo [ERROR] Unknown action: %ACTION%
echo Usage: %~nx0 ^<start^|stop^|status^|restart^|logs^> [port]
exit /b 1

:start
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

echo [INFO] Starting EliteERP on %HOST%:%PORT% ...
echo [INFO] Root dir: %ROOT_DIR%>> "%STARTUP_LOG%"
echo [INFO] Target URL: http://%HOST%:%PORT%>> "%STARTUP_LOG%"

if exist "%VENV_DOT_PY%" (
    set "PY_CMD=%VENV_DOT_PY%"
) else if exist "%VENV_PY%" (
    set "PY_CMD=%VENV_PY%"
) else (
    set "PY_CMD=python"
)

"%PY_CMD%" --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python runtime not found. Check .venv, venv, or PATH.
    echo [ERROR] Python runtime not found. Check .venv, venv, or PATH.>> "%STARTUP_LOG%"
    exit /b 1
)

"%PY_CMD%" -c "import waitress" >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Missing dependency: waitress. Install with: "%PY_CMD%" -m pip install waitress
    echo [ERROR] Missing dependency: waitress. Install with: "%PY_CMD%" -m pip install waitress>> "%STARTUP_LOG%"
    exit /b 1
)

cd /d "%ROOT_DIR%"

if not exist "%SCRIPT_DIR%frontend\dist\index.html" (
    echo [WARN] Frontend build not found: %SCRIPT_DIR%frontend\dist\index.html
    echo [WARN] Frontend build not found: %SCRIPT_DIR%frontend\dist\index.html>> "%STARTUP_LOG%"
)

echo [INFO] Running migrations...>> "%STARTUP_LOG%"
"%PY_CMD%" erp\manage.py migrate --noinput >> "%STARTUP_LOG%" 2>&1
if errorlevel 1 (
    echo [ERROR] Migration failed. Check "%STARTUP_LOG%"
    exit /b 1
)

echo [INFO] Running collectstatic...>> "%STARTUP_LOG%"
"%PY_CMD%" erp\manage.py collectstatic --noinput >> "%STARTUP_LOG%" 2>&1
if errorlevel 1 (
    echo [ERROR] collectstatic failed. Check "%STARTUP_LOG%"
    exit /b 1
)

set "DJANGO_SETTINGS_MODULE=erp.settings"
set "PYTHONUNBUFFERED=1"
set "ERP_HOST=%HOST%"
set "ERP_PORT=%PORT%"

echo [INFO] Starting server process...>> "%STARTUP_LOG%"
"%PY_CMD%" "%SCRIPT_DIR%serve.py" >> "%SERVER_LOG%" 2>&1
exit /b %errorlevel%

:stop
echo [INFO] Stopping EliteERP on port %PORT% ...
set "FOUND=0"
for /f "tokens=5" %%p in ('netstat -aon ^| findstr ":%PORT%" ^| findstr "LISTENING"') do (
    set "FOUND=1"
    echo [INFO] Stopping PID %%p
    taskkill /PID %%p /F >nul 2>&1
)
if "%FOUND%"=="0" (
    echo [INFO] No process is listening on port %PORT%.
) else (
    echo [OK] Stop command completed for port %PORT%.
)
exit /b 0

:status
echo [INFO] Checking status on port %PORT% ...
netstat -aon | findstr ":%PORT%" | findstr "LISTENING"
if errorlevel 1 (
    echo [INFO] EliteERP is not listening on port %PORT%.
) else (
    echo [OK] A process is listening on port %PORT%.
)
exit /b 0

:restart
call "%~f0" stop %PORT%
timeout /t 1 /nobreak >nul
call "%~f0" start %PORT%
exit /b %errorlevel%

:logs
echo [INFO] Showing logs for port %PORT% ...
if exist "%STARTUP_LOG%" (
    echo ----- %STARTUP_LOG% -----
    type "%STARTUP_LOG%"
) else (
    echo [INFO] Startup log not found: %STARTUP_LOG%
)

if exist "%SERVER_LOG%" (
    echo.
    echo ----- %SERVER_LOG% -----
    type "%SERVER_LOG%"
) else (
    echo [INFO] Server log not found: %SERVER_LOG%
)
exit /b 0

