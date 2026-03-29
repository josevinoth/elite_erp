@echo off
REM Stop EliteERP server gracefully
setlocal

set "PORT=8000"
set "PROJECT_DIR=C:\Users\Admin\PycharmProjects\elite_erp_v1.0\erp"
set "STARTUP_LOG=%PROJECT_DIR%\logs\startup.log"

echo.
echo Stopping EliteERP server on port %PORT%...
echo.

REM Check if server is running
for /f "tokens=5" %%p in ('netstat -aon ^| findstr ":%PORT%" ^| findstr "LISTENING"') do (
    echo Found process on PID %%p. Terminating...
    taskkill /PID %%p /F
    timeout /t 2 /nobreak >nul

    REM Verify it's closed
    for /f "tokens=5" %%q in ('netstat -aon ^| findstr ":%PORT%" ^| findstr "LISTENING"') do (
        echo [WARNING] Process still running on PID %%q. Force killing...
        taskkill /PID %%q /F /T
    )

    echo [OK] EliteERP server stopped.
    echo. >> "%STARTUP_LOG%"
    echo [STOP] EliteERP stopped by user >> "%STARTUP_LOG%"
    goto :end
)

echo [INFO] No EliteERP server found running on port %PORT%

:end
echo.
pause

