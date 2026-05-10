@echo off
setlocal ENABLEDELAYEDEXPANSION

REM ================== CONFIGURE THESE ==================
SET "DB_NAME=erp_002"
SET "DB_USER=postgres"
SET "PG_BIN=C:\Program Files\PostgreSQL\18\bin"
SET "BACKUP_DIR=C:\Users\Admin\PycharmProjects\elite_erp_v1.0\erp\erp_app\sub_db"
SET "RETENTION_DAYS=7"
SET "PGPASSWORD=244613"
SET "PGHOST=localhost"
SET "PGPORT=5432"
REM =====================================================

echo ====================================================
echo PostgreSQL Auto Backup
echo Time: %DATE% %TIME%
echo DB: %DB_NAME%   User: %DB_USER%
echo PG_BIN: %PG_BIN%
echo Backup dir: %BACKUP_DIR%
echo Retention: %RETENTION_DAYS% days
echo ====================================================
echo.

REM --- Validate PG_BIN ---
IF NOT EXIST "%PG_BIN%\pg_dump.exe" (
    echo [ERROR] pg_dump.exe NOT FOUND at: "%PG_BIN%\pg_dump.exe"
    goto :end_fail
)

REM --- Ensure backup dir exists ---
IF NOT EXIST "%BACKUP_DIR%" (
    echo [INFO] Creating backup directory: "%BACKUP_DIR%"
    mkdir "%BACKUP_DIR%"
)

REM --- Locale-Independent Timestamp via PowerShell ---
for /f %%t in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd_HHmmss"') do set DATESTAMP=%%t

SET "OUTFILE=%BACKUP_DIR%\%DB_NAME%_%DATESTAMP%.backup"

echo [INFO] Running pg_dump to: "%OUTFILE%"
"%PG_BIN%\pg_dump.exe" -h "%PGHOST%" -p "%PGPORT%" -U "%DB_USER%" -F c -b -v -f "%OUTFILE%" "%DB_NAME%"
IF ERRORLEVEL 1 (
    echo [ERROR] pg_dump failed.
    goto :end_fail
)

REM --- Cleanup old backups ---
