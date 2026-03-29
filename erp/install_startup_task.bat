@echo off
setlocal

set "SCRIPT=C:\Users\Admin\PycharmProjects\elite_erp_v1.0\erp\register_startup_task.ps1"

powershell -NoProfile -Command "Start-Process powershell -Verb RunAs -ArgumentList '-ExecutionPolicy Bypass -File ""%SCRIPT%""' -Wait"
if %errorlevel% neq 0 (
    echo [ERROR] Could not run elevated task registration.
    exit /b 1
)

echo [INFO] If no error appeared, the scheduled task was registered.
exit /b 0

