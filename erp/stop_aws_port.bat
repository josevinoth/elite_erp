@echo off
setlocal

REM Usage: stop_aws_port.bat 8010
set "PORT=%~1"
if "%PORT%"=="" set "PORT=8010"

echo Stopping EliteERP on port %PORT%...

for /f "tokens=5" %%p in ('netstat -aon ^| findstr ":%PORT%" ^| findstr "LISTENING"') do (
    echo Found PID %%p on port %PORT%. Stopping...
    taskkill /PID %%p /F >nul 2>&1
)

echo Done.

