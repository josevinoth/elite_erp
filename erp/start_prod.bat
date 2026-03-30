@echo off
setlocal enabledelayedexpansion

set "PROJECT_DIR=C:\Users\Admin\PycharmProjects\elite_erp_v1.0\erp"
set "VENV_PY=C:\Users\Admin\PycharmProjects\elite_erp_v1.0\.venv\Scripts\python.exe"
set "LOG_DIR=%PROJECT_DIR%\logs"
set "SERVER_LOG=%LOG_DIR%\server.log"
set "STARTUP_LOG=%LOG_DIR%\startup.log"
set "PORT=8000"

REM Wait for network to be ready (important for Task Scheduler at logon)
timeout /t 5 /nobreak >nul

if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

if not exist "%VENV_PY%" (
    echo [ERROR] Python not found: %VENV_PY% >> "%STARTUP_LOG%"
    exit /b 1
)

REM Change to project root directory
cd /d "C:\Users\Admin\PycharmProjects\elite_erp_v1.0"

REM Build frontend (React/Vite) so latest changes are served
echo [INFO] Building frontend...>> "%STARTUP_LOG%"
cd /d "C:\Users\Admin\PycharmProjects\elite_erp_v1.0\erp\frontend"
call npm run build >> "%STARTUP_LOG%" 2>&1
cd /d "C:\Users\Admin\PycharmProjects\elite_erp_v1.0"

REM Ensure DB schema is up to date (prevents missing-table 500 errors)
echo [INFO] Running migrations...>> "%STARTUP_LOG%"
"%VENV_PY%" erp\manage.py migrate --noinput >> "%STARTUP_LOG%" 2>&1

REM Run collectstatic
echo [INFO] Running collectstatic...>> "%STARTUP_LOG%"
"%VENV_PY%" erp\manage.py collectstatic --noinput >> "%STARTUP_LOG%" 2>&1

REM Now run the server directly
echo [INFO] Starting EliteERP server on port %PORT%>> "%STARTUP_LOG%"
set "DJANGO_SETTINGS_MODULE=erp.settings"
set "PYTHONUNBUFFERED=1"
"%VENV_PY%" "%PROJECT_DIR%\serve.py" >> "%SERVER_LOG%" 2>&1

