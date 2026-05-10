$taskName = "EliteERP-Prod"
$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootDir = Split-Path -Parent $projectDir
$scriptPath = Join-Path $projectDir "startup_prod.bat"
$taskLogPath = Join-Path $projectDir "logs\task_scheduler.log"
$userId = "$env:USERDOMAIN\$env:USERNAME"

if (-not (Test-Path $scriptPath)) {
    Write-Error "startup_prod.bat not found at $scriptPath"
    exit 1
}

if (-not (Test-Path (Split-Path -Parent $taskLogPath))) {
    New-Item -ItemType Directory -Path (Split-Path -Parent $taskLogPath) -Force | Out-Null
}

# Keep cmd.exe explicit and append scheduler-level logs for easier troubleshooting.
$actionArgs = "/c `"`"$scriptPath`" 8010 >> `"$taskLogPath`" 2>&1`""
$action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument $actionArgs -WorkingDirectory $rootDir

# Run both at machine startup and at user logon.
$startupTrigger = New-ScheduledTaskTrigger -AtStartup
$startupTrigger.Delay = "PT45S"
$logonTrigger = New-ScheduledTaskTrigger -AtLogOn -User $userId
$logonTrigger.Delay = "PT30S"

$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -MultipleInstances IgnoreNew `
    -ExecutionTimeLimit (New-TimeSpan -Hours 0)

# S4U runs without requiring an interactive desktop session.
$principal = New-ScheduledTaskPrincipal -UserId $userId -LogonType S4U -RunLevel Highest

try {
    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger @($startupTrigger, $logonTrigger) -Settings $settings -Principal $principal -Description "Starts EliteERP production server at startup/logon." -Force -ErrorAction Stop | Out-Null
    Write-Host "[OK] Scheduled task '$taskName' registered successfully."
    Write-Host "Task Details:"
    Write-Host "  - Name: $taskName"
    Write-Host "  - Script: $scriptPath"
    Write-Host "  - Working Directory: $rootDir"
    Write-Host "  - Triggers: AtStartup (45s delay), AtLogOn (30s delay)"
    Write-Host "  - Run mode: Whether user is logged on or not (S4U)"
    Write-Host "  - User: $userId"
    Write-Host ""
    Write-Host "Check logs at:"
    Write-Host "  - $projectDir\logs\task_scheduler.log"
    Write-Host "  - $projectDir\logs\startup_8010.log"
    Write-Host "  - $projectDir\logs\server_8010.log"
} catch {
    Write-Error "Failed to register scheduled task. Run this script in an elevated PowerShell (Run as Administrator)."
    Write-Error $_
    exit 1
}

