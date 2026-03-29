@echo off
setlocal

set "PROJECT_DIR=C:\Users\Admin\PycharmProjects\elite_erp_v1.0\erp"
set "LOG_DIR=%PROJECT_DIR%\logs"
set "PID_FILE=%LOG_DIR%\serve.pid"
set "PORT=8000"

if exist "%PID_FILE%" (
    set /p PID=<"%PID_FILE%"
    if not "%PID%"=="" (
        taskkill /PID %PID% /F >nul 2>&1
        if %errorlevel%==0 (
            echo [OK] Stopped PID %PID%.
            del "%PID_FILE%" >nul 2>&1
            exit /b 0
        )
    )
)

REM Fallback: stop anything listening on port 8000.
for /f "tokens=5" %%p in ('netstat -aon ^| findstr ":%PORT%" ^| findstr "LISTENING"') do (
    taskkill /PID %%p /F >nul 2>&1
    echo [OK] Stopped PID %%p using port %PORT%.
)

del "%PID_FILE%" >nul 2>&1
exit /b 0

