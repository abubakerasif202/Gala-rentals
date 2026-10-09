param(
  [Parameter(Mandatory=$true)][string]$PrivateEnvironmentFile,
  [string]$DailyAt = '02:30'
)
$ErrorActionPreference = 'Stop'
$galaRoot = Split-Path $PSScriptRoot -Parent
if (-not (Test-Path $PrivateEnvironmentFile -PathType Leaf)) { throw 'Private GalaRentals environment file is missing.' }
if (Get-ScheduledTask -TaskName 'GalaRentals-Workbook-Preflight' -ErrorAction SilentlyContinue) { throw 'The GalaRentals preflight task already exists; inspect it before changing ownership.' }
$nodeExecutable = (Get-Command node.exe).Source
$scriptFile = Join-Path $PSScriptRoot 'workbook-operations.mjs'
$environmentArgument = "--env-file=$PrivateEnvironmentFile"
if ($environmentArgument.Contains('"')) { throw 'Environment file path cannot contain quote characters.' }
$arguments = "`"$scriptFile`" `"$environmentArgument`""
$action = New-ScheduledTaskAction -Execute $nodeExecutable -Argument $arguments -WorkingDirectory $galaRoot
$trigger = New-ScheduledTaskTrigger -Daily -At $DailyAt
$principal = New-ScheduledTaskPrincipal -UserId ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 30) -StartWhenAvailable
Register-ScheduledTask -TaskName 'GalaRentals-Workbook-Preflight' -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description 'Read-only GalaRentals workbook extraction. No database imports or production writes.' | Select-Object TaskName,State
Write-Output 'Installed read-only preflight. Excel requires the authorized interactive Windows session; this is not an unattended cloud worker.'
