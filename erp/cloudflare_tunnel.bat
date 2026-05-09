@echo off
setlocal

REM Runs the already-configured Cloudflare tunnel for EliteERP.
set "CLOUDFLARED=C:\cloudflared\cloudflared.exe"
set "CONFIG_FILE=%USERPROFILE%\.cloudflared\config.yml"
set "TUNNEL_NAME=elite-erp"

if not exist "%CLOUDFLARED%" (
    echo [ERROR] cloudflared.exe not found at "%CLOUDFLARED%"
    exit /b 1
)

if not exist "%CONFIG_FILE%" (
    echo [ERROR] Missing config file: "%CONFIG_FILE%"
    echo [INFO] Create tunnel config first, then run this script again.
    exit /b 1
)

echo [INFO] Starting Cloudflare Tunnel "%TUNNEL_NAME%"...
echo [INFO] Using config: %CONFIG_FILE%
"%CLOUDFLARED%" --config "%CONFIG_FILE%" tunnel run "%TUNNEL_NAME%"

exit /b %errorlevel%
