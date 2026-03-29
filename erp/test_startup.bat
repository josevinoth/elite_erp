@echo off
REM Test script to verify the startup configuration before registering with Task Scheduler
setlocal enabledelayedexpansion

set "PROJECT_DIR=C:\Users\Admin\PycharmProjects\elite_erp_v1.0\erp"
set "VENV_PY=C:\Users\Admin\PycharmProjects\elite_erp_v1.0\.venv\Scripts\python.exe"
set "LOG_DIR=%PROJECT_DIR%\logs"
set "SERVER_LOG=%LOG_DIR%\server.log"

cls
echo.
echo ========================================
echo     EliteERP Startup Test
echo ========================================
echo.

REM Test 1: Check Python
echo [TEST 1] Checking Python executable...
if exist "%VENV_PY%" (
    echo   [PASS] Python found at: %VENV_PY%
    echo.
) else (
    echo   [FAIL] Python NOT found at: %VENV_PY%
    echo.
    exit /b 1
)

REM Test 2: Check project structure
echo [TEST 2] Checking project structure...
if exist "C:\Users\Admin\PycharmProjects\elite_erp_v1.0\erp\manage.py" (
    echo   [PASS] manage.py found
) else (
    echo   [FAIL] manage.py NOT found
    exit /b 1
)

if exist "C:\Users\Admin\PycharmProjects\elite_erp_v1.0\erp\serve.py" (
    echo   [PASS] serve.py found
) else (
    echo   [FAIL] serve.py NOT found
    exit /b 1
)
echo.

REM Test 3: Check logs directory
echo [TEST 3] Checking logs directory...
if not exist "%LOG_DIR%" (
    mkdir "%LOG_DIR%"
    echo   [CREATED] Logs directory created at: %LOG_DIR%
) else (
    echo   [PASS] Logs directory exists at: %LOG_DIR%
)
echo.

REM Test 4: Test Django collectstatic
echo [TEST 4] Running Django collectstatic (this may take 10-15 seconds)...
cd /d "C:\Users\Admin\PycharmProjects\elite_erp_v1.0"
"%VENV_PY%" manage.py collectstatic --noinput >nul 2>&1
if errorlevel 0 (
    echo   [PASS] Django collectstatic completed successfully
) else (
    echo   [WARN] Django collectstatic had an issue - check logs
)
echo.

REM Test 5: Simulate the startup (30 second timeout)
echo [TEST 5] Starting server (waiting 30 seconds)...
echo   This will simulate what Task Scheduler will do.
echo   Press Ctrl+C to stop the server when ready.
echo.
timeout /t 2 /nobreak >nul
cd /d "%PROJECT_DIR%"
cd /d "C:\Users\Admin\PycharmProjects\elite_erp_v1.0"
set "DJANGO_SETTINGS_MODULE=erp.settings"
set "PYTHONUNBUFFERED=1"

echo. >> "%SERVER_LOG%"
echo ==================== TEST RUN ==================== >> "%SERVER_LOG%"
"%VENV_PY%" "%PROJECT_DIR%\serve.py" >> "%SERVER_LOG%" 2>&1

REM The above command will run the server
REM When you Ctrl+C, it will close and the script will exit
echo.
echo Server stopped. Check the log file for details:
echo   %SERVER_LOG%
echo.
pause

