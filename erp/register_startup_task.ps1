$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
    [Security.Principal.WindowsBuiltInRole]::Administrator
)

if (-not $isAdmin) {
    Write-Host "[INFO] Elevation required. Relaunching this script as Administrator..."
    $argList = @(
        "-NoProfile"
        "-ExecutionPolicy", "Bypass"
        "-File", "`"$PSCommandPath`""
    )
    Start-Process -FilePath "powershell.exe" -ArgumentList $argList -Verb RunAs | Out-Null
    exit 0
}

$taskName = "EliteERP-Startup"

$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$startupScriptPath = Join-Path $projectDir "startup_prod.bat"
$userId = "$env:USERDOMAIN\$env:USERNAME"

if (-not (Test-Path $startupScriptPath)) {
    Write-Error "startup_prod.bat not found at $startupScriptPath"
    exit 1
}

# Single action: one .bat file that launches backend and tunnel.
$startupAction = New-ScheduledTaskAction -Execute $startupScriptPath -Argument "8010" -WorkingDirectory $projectDir

$startupTrigger = New-ScheduledTaskTrigger -AtStartup
$startupTrigger.Delay = "PT60S"

$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -MultipleInstances IgnoreNew `
    -ExecutionTimeLimit (New-TimeSpan -Hours 0)

$principal = New-ScheduledTaskPrincipal -UserId $userId -LogonType S4U -RunLevel Highest

try {
    foreach ($legacyTask in @("EliteERP-Backend", "EliteERP-Tunnel")) {
        if (Get-ScheduledTask -TaskName $legacyTask -ErrorAction SilentlyContinue) {
            Unregister-ScheduledTask -TaskName $legacyTask -Confirm:$false -ErrorAction SilentlyContinue
        }
    }

    Register-ScheduledTask -TaskName $taskName -Action $startupAction -Trigger $startupTrigger -Settings $settings -Principal $principal -Description "Starts EliteERP backend and Cloudflare tunnel at system startup." -Force -ErrorAction Stop | Out-Null

    Write-Host "[OK] Scheduled tasks registered successfully."
    Write-Host ""
    Write-Host "Task Details:"
    Write-Host "  - Startup Task: $taskName"
    Write-Host "    Program/script: $startupScriptPath"
    Write-Host "    Arguments: 8010"
    Write-Host "    Trigger: AtStartup (60s delay)"
    Write-Host "  - Working Directory: $projectDir"
    Write-Host "  - Run mode: Whether user is logged on or not (S4U)"
    Write-Host "  - User: $userId"
    Write-Host ""
    Write-Host "Check logs at:"
    Write-Host "  - $projectDir\logs\task_scheduler.log"
    Write-Host "  - $projectDir\logs\startup_8010.log"
    Write-Host "  - $projectDir\logs\server_8010.log"
} catch {
    Write-Error "Failed to register scheduled tasks. Run this script in an elevated PowerShell (Run as Administrator)."
    Write-Error $_
    exit 1
}

