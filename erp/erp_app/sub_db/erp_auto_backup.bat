@echo off
setlocal
set "PYTHON=%~dp0..\..\..\.venv\Scripts\python.exe"
if not exist "%PYTHON%" (
    echo [ERROR] Missing virtual environment: "%PYTHON%"
    exit /b 1
)
"%PYTHON%" "%~dp0backup_database.py"
exit /b %ERRORLEVEL%
