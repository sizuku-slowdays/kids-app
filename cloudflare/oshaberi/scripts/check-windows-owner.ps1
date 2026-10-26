param(
    [Parameter(Mandatory = $true)][string]$Folder,
    [Parameter(Mandatory = $true)][ValidatePattern('^[a-f0-9]{32}$')][string]$AccountId
)
# READ-ONLY Cloudflare checks plus LOCAL build/tests. Never deploys/imports.
$ErrorActionPreference = 'Stop'
$stage = 'local configuration'
try {
    $planFile = Join-Path $Folder 'owner-deployment-plan.PRIVATE.json'
    $plan = Get-Content -LiteralPath $planFile -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($plan.source_commit -ne '02eec0408024d89aa16b271f1eea6c555fd7f59b' -or $plan.stage -ne 'prepared_only') { throw 'Unexpected preparation version or stage.' }
    $config = Get-Content -LiteralPath $plan.config -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($config.name -ne 'oshaberi' -or $config.vars.RELEASE_ENABLED -ne '0' -or $config.vars.PRIVATE_TEST_MODE -ne '1' -or $config.vars.REGISTRATION_ENABLED -ne '0' -or $config.vars.INVITATIONS_ENABLED -ne '0') { throw 'The app must remain closed and owner-only.' }
    if (@($config.d1_databases).Count -ne 1 -or $config.d1_databases[0].database_name -ne 'oshaberi' -or $config.d1_databases[0].binding -ne 'CHAT_DB' -or $config.d1_databases[0].database_id -ne $plan.database_id -or @($config.r2_buckets).Count -ne 1 -or $config.r2_buckets[0].bucket_name -ne 'oshaberi' -or $config.r2_buckets[0].binding -ne 'CHAT_FILES') { throw 'Unexpected DB or R2 destination.' }
    foreach ($forbidden in @('routes', 'route', 'services', 'triggers')) { if ($config.PSObject.Properties.Name -contains $forbidden) { throw 'Unexpected routes, services or schedules.' } }
    if ($config.vars.PRIVATE_TEST_ORIGIN -ne $plan.origin -or $plan.origin -notmatch '^https://oshaberi\.[a-z0-9-]+\.workers\.dev$') { throw 'Unexpected Worker URL.' }
    if ([long]$config.vars.TEST_EXPIRES_AT -le [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()) { throw 'The private test period has expired.' }
    Write-Host '[1/4] Check anonymous access without cookies'
    $stage = 'anonymous Access protection'
    Add-Type -AssemblyName System.Net.Http
    $handler = New-Object System.Net.Http.HttpClientHandler
    $handler.AllowAutoRedirect = $false
    $handler.UseCookies = $false
    $client = [System.Net.Http.HttpClient]::new($handler)
    try {
        $client.Timeout = [TimeSpan]::FromSeconds(30)
        $response = $client.GetAsync($plan.origin + '/').GetAwaiter().GetResult()
        try {
            $location = $response.Headers.Location
            if ([int]$response.StatusCode -notin @(302, 303, 307) -or !$location -or !$location.IsAbsoluteUri -or $location.Scheme -ne 'https' -or $location.Host -ne ([Uri]$config.vars.ACCESS_ISSUER).Host -or !$location.AbsolutePath.StartsWith('/cdn-cgi/access/login/')) { throw 'Anonymous access did not redirect to the expected Access login. Do not deploy.' }
        } finally { $response.Dispose() }
    } finally { $client.Dispose(); $handler.Dispose() }
    Write-Host '[2/4] Verify only the new oshaberi D1 (SELECT only)'
    $stage = 'new D1 read-only check'
    if (!$env:CLOUDFLARE_API_TOKEN) { throw 'CLOUDFLARE_API_TOKEN is missing. Open the PowerShell profile-enabled window used for D1.' }
    $apiHeaders = @{ Authorization = 'Bearer ' + $env:CLOUDFLARE_API_TOKEN }
    $databaseUrl = 'https://api.cloudflare.com/client/v4/accounts/' + $AccountId + '/d1/database/' + $plan.database_id
    $database = Invoke-RestMethod -Method Get -Uri $databaseUrl -Headers $apiHeaders
    if (!$database.success -or $database.result.name -ne 'oshaberi' -or $database.result.uuid -ne $plan.database_id) { throw 'The DB ID does not belong to the dedicated oshaberi database.' }
    $readQuery = @{ sql = "SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND substr(name,1,7)<>'sqlite_' AND substr(name,1,4)<>'_cf_';" } | ConvertTo-Json -Compress
    $query = Invoke-RestMethod -Method Post -Uri ($databaseUrl + '/query') -Headers $apiHeaders -ContentType 'application/json' -Body $readQuery
    if (!$query.success -or @($query.result).Count -ne 1 -or !$query.result[0].success -or @($query.result[0].results).Count -ne 1 -or [int]$query.result[0].results[0].n -ne 0 -or [int]$query.result[0].meta.rows_written -ne 0) { throw 'The dedicated DB is not empty or its read-only check failed. Do not import.' }
    Remove-Variable apiHeaders -ErrorAction SilentlyContinue
    Write-Host '[3/4] Install pinned local dependencies (may take several minutes)'
    $stage = 'local dependency installation'
    $savedEnvironment = @{}
    $environmentNames = @('CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_API_KEY', 'CLOUDFLARE_EMAIL', 'CLOUDFLARE_ACCOUNT_ID', 'WRANGLER_SEND_METRICS')
    foreach ($name in $environmentNames) { $savedEnvironment[$name] = [Environment]::GetEnvironmentVariable($name, 'Process'); [Environment]::SetEnvironmentVariable($name, $null, 'Process') }
    try {
        $env:WRANGLER_SEND_METRICS = 'false'
        Push-Location -LiteralPath $plan.app
        try {
            & npm.cmd ci --ignore-scripts --no-audit --no-fund
            if ($LASTEXITCODE -ne 0) { throw 'npm ci failed.' }
            Write-Host '[4/4] LOCAL build and isolated tests (dry-run only)'
            $stage = 'local build/tests'
            & npm.cmd test
            if ($LASTEXITCODE -ne 0) { throw 'Local tests failed. No deployment performed.' }
        } finally { Pop-Location }
    } finally { foreach ($name in $environmentNames) { [Environment]::SetEnvironmentVariable($name, $savedEnvironment[$name], 'Process') } }
    $report = @{ ok = $true; stage = 'read_only_preflight'; checked_at = [DateTimeOffset]::UtcNow.ToString('o'); anonymous_redirect_to_access = $true; dedicated_db_name_matches = $true; dedicated_db_empty = $true; local_tests_passed = $true; r2_api_check = 'not_performed'; deployment = 'not_performed' }
    $reportFile = Join-Path $Folder 'preflight-safe.json'
    [System.IO.File]::WriteAllText($reportFile, ($report | ConvertTo-Json), (New-Object System.Text.UTF8Encoding($false)))
    Write-Host 'RESULT: READ-ONLY PREFLIGHT AND LOCAL TESTS ALL OK'
    Write-Host "Folder: $Folder"
    Write-Host 'No deployment, SQL import, migration, invitations, HOME changes or Cloudflare settings changes.'
    Write-Host 'Send only RESULT and Folder. Do not send PRIVATE files or credentials.'
} catch {
    Write-Host "RESULT: STOP ($stage)"
    Write-Host $_.Exception.Message
    throw
}
