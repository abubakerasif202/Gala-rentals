param(
    [string]$EnvFile = 'render.env.production',
    [string]$AdminPassword = '',
    [switch]$SeedIfMissing
)

$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot\..

if (-not (Test-Path -LiteralPath $EnvFile)) {
    throw "Missing env file: $EnvFile"
}

Get-Content -LiteralPath $EnvFile | ForEach-Object {
    $line = $_.Trim()
    if ($line.Length -eq 0 -or $line.StartsWith('#')) {
        return
    }

    $parts = $line -split '=', 2
    if ($parts.Length -ne 2) {
        return
    }

    [System.Environment]::SetEnvironmentVariable($parts[0].Trim(), $parts[1].Trim(), 'Process')
}

if ($AdminPassword) {
    [System.Environment]::SetEnvironmentVariable('ADMIN_PASSWORD', $AdminPassword, 'Process')
}

if (-not [System.Environment]::GetEnvironmentVariable('ADMIN_PASSWORD', 'Process') -and (Test-Path -LiteralPath '.env')) {
    Get-Content -LiteralPath '.env' | ForEach-Object {
        $line = $_.Trim()
        if ($line -notmatch '^ADMIN_PASSWORD=') {
            return
        }

        $password = ($line -split '=', 2)[1].Trim()
        [System.Environment]::SetEnvironmentVariable('ADMIN_PASSWORD', $password, 'Process')
    }
}

$requiredKeys = @(
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'ADMIN_EMAIL',
    'ADMIN_PASSWORD'
)

$missing = $requiredKeys | Where-Object { -not [System.Environment]::GetEnvironmentVariable($_, 'Process') }
if ($missing.Count -gt 0) {
    throw "Missing required values in ${EnvFile}: $($missing -join ', ')"
}

if ($SeedIfMissing) {
    node scripts/reset-admin.js --create-if-missing
    exit $LASTEXITCODE
}

node scripts/reset-admin.js
