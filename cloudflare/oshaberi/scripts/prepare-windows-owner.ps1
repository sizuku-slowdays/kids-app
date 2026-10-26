param(
    [Parameter(Mandatory = $true)][ValidatePattern('^[a-f0-9]{64}$')][string]$Audience,
    [Parameter(Mandatory = $true)][ValidatePattern('^[a-f0-9-]{36}$')][string]$DatabaseId,
    [Parameter(Mandatory = $true)][ValidatePattern('^https://[a-z0-9-]+\.cloudflareaccess\.com$')][string]$Issuer,
    [Parameter(Mandatory = $true)][ValidatePattern('^https://oshaberi\.[a-z0-9-]+\.workers\.dev$')][string]$Origin
)
# PREPARATION ONLY. No Wrangler/Cloudflare API calls, no remote writes.
$ErrorActionPreference = 'Stop'
$sourceCommit = '02eec0408024d89aa16b271f1eea6c555fd7f59b'
$taskFolder = Join-Path $env:USERPROFILE ('wagaya-oshaberi-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
$utf8 = New-Object System.Text.UTF8Encoding($false)
try {
    $nodeVersion = & node --version
    if ($LASTEXITCODE -ne 0 -or [int](($nodeVersion -replace '^v', '').Split('.')[0]) -lt 22) { throw 'Node.js 22 or later is required.' }
    if (Test-Path -LiteralPath $taskFolder) { throw 'Preparation folder already exists. Run again after one second.' }
    New-Item -ItemType Directory -Path $taskFolder | Out-Null
    $archive = Join-Path $taskFolder 'source.zip'
    Write-Host '[1/4] Download fixed source version (no deployment)'
    Invoke-WebRequest -UseBasicParsing -Uri "https://github.com/sizuku-slowdays/kids-app/archive/$sourceCommit.zip" -OutFile $archive
    Expand-Archive -LiteralPath $archive -DestinationPath (Join-Path $taskFolder 'source')
    $appFolder = Join-Path $taskFolder "source\kids-app-$sourceCommit\cloudflare\oshaberi"
    if (!(Test-Path -LiteralPath (Join-Path $appFolder 'migrations\0001_chat.sql'))) { throw 'Expected isolated app source was not found.' }
    Write-Host '[2/4] Check JavaScript syntax'
    $jsFiles = @(Get-ChildItem -LiteralPath (Join-Path $appFolder 'src') -Filter '*.js')
    $jsFiles += @(Get-ChildItem -LiteralPath (Join-Path $appFolder 'public') -Filter '*.js')
    foreach ($file in $jsFiles) {
        & node --check $file.FullName
        if ($LASTEXITCODE -ne 0) { throw 'JavaScript syntax check failed.' }
    }
    Write-Host '[3/4] Prepare four fictional logins locally'
    $fixtureFolder = Join-Path $taskFolder 'PRIVATE-fixture'
    & node (Join-Path $appFolder 'scripts\prepare-owner-test.mjs') $fixtureFolder
    if ($LASTEXITCODE -ne 0) { throw 'Fictional account preparation failed.' }
    Write-Host '[4/4] Save closed deployment configuration locally'
    $ownerEmail = (Read-Host 'Enter the owner email used in the Access allow policy').Trim().ToLowerInvariant()
    if ($ownerEmail -notmatch '^[^@\s]+@[^@\s]+\.[^@\s]+$') { throw 'Owner email format is invalid.' }
    $sha256 = [System.Security.Cryptography.SHA256]::Create()
    try { $ownerHash = -join ($sha256.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($ownerEmail)) | ForEach-Object { $_.ToString('x2') }) } finally { $sha256.Dispose() }
    $random = New-Object byte[] 32
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($random) } finally { $rng.Dispose() }
    $rateSecret = -join ($random | ForEach-Object { $_.ToString('x2') })
    # A seven-day test window; expired access fails closed. No external registration/invitations.
    $expires = [DateTimeOffset]::UtcNow.AddDays(7).ToUnixTimeSeconds().ToString()
    $config = [ordered]@{
        name = 'oshaberi'; main = 'src/index.js'; compatibility_date = '2026-10-01'
        compatibility_flags = @('nodejs_compat'); workers_dev = $true; preview_urls = $false
        assets = @{ directory = 'public'; binding = 'ASSETS'; run_worker_first = $true }
        vars = [ordered]@{ RELEASE_ENABLED = '0'; REGISTRATION_ENABLED = '0'; INVITATIONS_ENABLED = '0'; PRIVATE_TEST_MODE = '1'; PRIVATE_TEST_ORIGIN = $Origin; ACCESS_ISSUER = $Issuer; ACCESS_AUD = $Audience; TEST_EXPIRES_AT = $expires }
        d1_databases = @(@{ binding = 'CHAT_DB'; database_name = 'oshaberi'; database_id = $DatabaseId; migrations_dir = 'migrations' })
        r2_buckets = @(@{ binding = 'CHAT_FILES'; bucket_name = 'oshaberi' })
    }
    $configFile = Join-Path $appFolder '.private-test-config.jsonc'
    [System.IO.File]::WriteAllText($configFile, ($config | ConvertTo-Json -Depth 10), $utf8)
    $secretFile = Join-Path $fixtureFolder 'worker-secrets.PRIVATE.json'
    [System.IO.File]::WriteAllText($secretFile, (@{ RATE_SECRET = $rateSecret; TEST_OWNER_EMAIL_SHA256 = $ownerHash } | ConvertTo-Json), $utf8)
    $planFile = Join-Path $taskFolder 'owner-deployment-plan.PRIVATE.json'
    [System.IO.File]::WriteAllText($planFile, (@{ app = $appFolder; config = $configFile; fixture = $fixtureFolder; source_commit = $sourceCommit; origin = $Origin; database_id = $DatabaseId; expires_at = $expires; stage = 'prepared_only' } | ConvertTo-Json), $utf8)
    Remove-Variable ownerEmail, rateSecret, random -ErrorAction SilentlyContinue
    Write-Host 'RESULT: LOCAL PREPARATION ALL OK'
    Write-Host "Folder: $taskFolder"
    Write-Host 'No deployment, DB import, migration, invite, HOME or Cloudflare settings changed.'
    Write-Host 'Send only RESULT and Folder. Never send PRIVATE files or login passwords.'
} catch {
    Write-Host 'RESULT: STOP'
    Write-Host $_.Exception.Message
    Write-Host "Folder: $taskFolder"
    throw
}
