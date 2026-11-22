$ErrorActionPreference = "Stop"

$projectDir = Split-Path -Parent $PSCommandPath
$batchPath = Join-Path $projectDir "erp_app\sub_db\erp_auto_backup.bat"
if (-not (Test-Path -LiteralPath $batchPath)) {
    throw "Backup batch file not found: $batchPath"
}

$userId = [Security.Principal.WindowsIdentity]::GetCurrent().Name
$escapedUser = [Security.SecurityElement]::Escape($userId)
$escapedCommand = [Security.SecurityElement]::Escape($env:ComSpec)
$escapedArguments = [Security.SecurityElement]::Escape("/d /c `"`"$batchPath`"`"")
$escapedDirectory = [Security.SecurityElement]::Escape($projectDir)

# Explicit offsets keep these daily times in IST even on a UTC Windows server.
$xml = @"
<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo>
    <Description>Local PostgreSQL backup at 11:00 and 18:00 IST; retain three per configured database. No Git upload.</Description>
  </RegistrationInfo>
  <Triggers>
    <CalendarTrigger>
      <StartBoundary>2026-01-01T11:00:00+05:30</StartBoundary>
      <Enabled>true</Enabled>
      <ScheduleByDay><DaysInterval>1</DaysInterval></ScheduleByDay>
    </CalendarTrigger>
    <CalendarTrigger>
      <StartBoundary>2026-01-01T18:00:00+05:30</StartBoundary>
      <Enabled>true</Enabled>
      <ScheduleByDay><DaysInterval>1</DaysInterval></ScheduleByDay>
    </CalendarTrigger>
  </Triggers>
  <Principals>
    <Principal id="BackupUser">
      <UserId>$escapedUser</UserId>
      <LogonType>S4U</LogonType>
      <RunLevel>LeastPrivilege</RunLevel>
    </Principal>
  </Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <StartWhenAvailable>true</StartWhenAvailable>
    <Enabled>true</Enabled>
    <ExecutionTimeLimit>PT2H</ExecutionTimeLimit>
  </Settings>
  <Actions Context="BackupUser">
    <Exec>
      <Command>$escapedCommand</Command>
      <Arguments>$escapedArguments</Arguments>
      <WorkingDirectory>$escapedDirectory</WorkingDirectory>
    </Exec>
  </Actions>
</Task>
"@

Register-ScheduledTask -TaskName "EliteERP-DatabaseBackup" -Xml $xml -Force | Out-Null
Get-ScheduledTaskInfo -TaskName "EliteERP-DatabaseBackup" |
    Select-Object TaskName, NextRunTime, LastTaskResult
