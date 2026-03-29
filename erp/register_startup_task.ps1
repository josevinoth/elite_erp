$taskName = "EliteERP-Prod"
$scriptPath = "C:\Users\Admin\PycharmProjects\elite_erp_v1.0\erp\start_prod.bat"
$projectDir = "C:\Users\Admin\PycharmProjects\elite_erp_v1.0\erp"
$rootDir = "C:\Users\Admin\PycharmProjects\elite_erp_v1.0"
$userId = "$env:USERDOMAIN\$env:USERNAME"

if (-not (Test-Path $scriptPath)) {
    Write-Error "start_prod.bat not found at $scriptPath"
    exit 1
}

# Run on logon with an explicit working directory and user context.
# Using /k instead of /c to keep the window open for debugging if needed
$action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c `"$scriptPath`"" -WorkingDirectory $rootDir
$trigger = New-ScheduledTaskTrigger -AtLogOn

# Increase delay to allow network to be fully ready
$trigger.Delay = "PT30S"

$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Hours 0)
$principal = New-ScheduledTaskPrincipal -UserId $userId -LogonType Interactive -RunLevel Highest

try {
    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description "Starts EliteERP production server on user logon." -Force -ErrorAction Stop | Out-Null
    Write-Host "[OK] Scheduled task '$taskName' registered successfully."
    Write-Host "Task Details:"
    Write-Host "  - Name: $taskName"
    Write-Host "  - Script: $scriptPath"
    Write-Host "  - Working Directory: $rootDir"
    Write-Host "  - Delay: 30 seconds"
    Write-Host "  - User: $userId"
    Write-Host ""
    Write-Host "Check the logs at: $projectDir\logs\startup.log"
} catch {
    Write-Error "Failed to register scheduled task. Run this script in an elevated PowerShell (Run as Administrator)."
    Write-Error $_
    exit 1
}

