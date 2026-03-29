@echo off
setlocal enabledelayedexpansion
set "VENV_PY=C:\Users\Admin\PycharmProjects\elite_erp_v1.0\.venv\Scripts\python.exe"
set "PROJECT_DIR=C:\Users\Admin\PycharmProjects\elite_erp_v1.0\erp"
set "SERVER_LOG=%PROJECT_DIR%\logs\server.log"
set "LOG_DIR=%PROJECT_DIR%\logs"

REM Ensure logs directory exists
if not exist "!LOG_DIR!" mkdir "!LOG_DIR!"

REM Verify Python exists (robust error handling for Task Scheduler)
if not exist "%VENV_PY%" (
    echo [ERROR] Python not found at: %VENV_PY% >> "%SERVER_LOG%" 2>&1
    echo Please ensure virtual environment is activated >> "%SERVER_LOG%" 2>&1
    exit /b 1
)

REM Change to project directory
cd /d "%PROJECT_DIR%"

REM Change to parent directory where Django manage.py expects to run from
cd /d "C:\Users\Admin\PycharmProjects\elite_erp_v1.0"

REM Set Django settings module explicitly
set "DJANGO_SETTINGS_MODULE=erp.settings"
set "PYTHONUNBUFFERED=1"

REM Add timestamp to log
for /f "tokens=2-4 delims=/ " %%a in ('date /t') do (set mydate=%%c-%%a-%%b)
for /f "tokens=1-2 delims=/:" %%a in ('time /t') do (set mytime=%%a:%%b)
echo. >> "%SERVER_LOG%"
echo ==================== %mydate% %mytime% ==================== >> "%SERVER_LOG%"

REM Run the server (output is logged to file)
"%VENV_PY%" "%PROJECT_DIR%\serve.py" >> "%SERVER_LOG%" 2>&1

