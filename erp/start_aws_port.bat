@echo off
setlocal enabledelayedexpansion

REM Usage: start_aws_port.bat 8010
set "PORT=%~1"
if "%PORT%"=="" set "PORT=8010"
set "HOST=0.0.0.0"

set "SCRIPT_DIR=%~dp0"
for %%i in ("%SCRIPT_DIR%..") do set "ROOT_DIR=%%~fi"
set "VENV_PY=%ROOT_DIR%\.venv\Scripts\python.exe"
set "LOG_DIR=%SCRIPT_DIR%logs"
set "SERVER_LOG=%LOG_DIR%\server_%PORT%.log"
set "STARTUP_LOG=%LOG_DIR%\startup_%PORT%.log"

if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

echo [INFO] Root dir: %ROOT_DIR%>> "%STARTUP_LOG%"
echo [INFO] Target URL: http://%HOST%:%PORT%>> "%STARTUP_LOG%"

if exist "%VENV_PY%" (
    set "PY_CMD=%VENV_PY%"
) else (
    REM Manual fallback if venv path is not available on server
    set "PY_CMD=python"
)

cd /d "%ROOT_DIR%"

echo [INFO] Running migrations...>> "%STARTUP_LOG%"
"%PY_CMD%" erp\manage.py migrate --noinput >> "%STARTUP_LOG%" 2>&1

echo [INFO] Running collectstatic...>> "%STARTUP_LOG%"
"%PY_CMD%" erp\manage.py collectstatic --noinput >> "%STARTUP_LOG%" 2>&1

set "DJANGO_SETTINGS_MODULE=erp.settings"
set "PYTHONUNBUFFERED=1"
set "ERP_HOST=%HOST%"
set "ERP_PORT=%PORT%"

echo [INFO] Starting EliteERP on %HOST%:%PORT% ...
echo [INFO] Starting EliteERP on %HOST%:%PORT%>> "%STARTUP_LOG%"
"%PY_CMD%" "%SCRIPT_DIR%serve.py" >> "%SERVER_LOG%" 2>&1

