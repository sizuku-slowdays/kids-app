param(
    [Parameter(Mandatory = $true)][string]$SourceRef,
    [string]$ExistingFolder = ''
)
$ErrorActionPreference = 'Stop'
try {
    if ($SourceRef -notmatch '^[0-9a-f]{40}$') { throw 'SourceRef must be the fixed 40-character Git commit supplied by Work.' }
    $familyAuditOnly = -not [string]::IsNullOrWhiteSpace($ExistingFolder)
    if ($familyAuditOnly) {
        $familyBackupFolder = (Resolve-Path -LiteralPath $ExistingFolder).Path
    } else {
        $familyStamp = Get-Date -Format 'yyyyMMdd-HHmmss'
        $familyBackupFolder = Join-Path $env:USERPROFILE "wagaya-multi-family-$familyStamp"
        New-Item -ItemType Directory -Path $familyBackupFolder | Out-Null
    }
    $familyHomeSql = Join-Path $familyBackupFolder 'home-before.sql'
    $familyCalendarSql = Join-Path $familyBackupFolder 'calendar-before.sql'
    $familyNotificationSql = Join-Path $familyBackupFolder 'notifications-before.sql'
    $familyAuditScript = Join-Path $familyBackupFolder 'audit-multi-family.py'
    $familySummaryPath = Join-Path $familyBackupFolder 'summary-safe-to-share.json'
    $familyPrivatePath = Join-Path $familyBackupFolder 'PRIVATE-ids-and-memberships.json'
    Invoke-WebRequest -Uri "https://raw.githubusercontent.com/sizuku-slowdays/kids-app/$SourceRef/scripts/audit-multi-family.py" -OutFile $familyAuditScript
    if (-not $familyAuditOnly) {
        Write-Host '[1/3] HOME backup (read only export)'
        npx.cmd wrangler d1 export fed5c0be-51b5-486f-935f-58678481f2a9 --remote --output "$familyHomeSql"
        if ($LASTEXITCODE -ne 0) { throw 'HOME export failed. Stop; do not deploy.' }
        Write-Host '[2/3] Calendar backup (read only export)'
        npx.cmd wrangler d1 export 6835690b-7a86-4576-b200-2355bac2d9c2 --remote --output "$familyCalendarSql"
        if ($LASTEXITCODE -ne 0) { throw 'Calendar export failed. Stop; do not deploy.' }
        Write-Host '[3/3] Notifications backup (read only export)'
        npx.cmd wrangler d1 export fa30f8a0-965f-4752-868b-8b6065bd88a0 --remote --output "$familyNotificationSql"
        if ($LASTEXITCODE -ne 0) { throw 'Notification export failed. Stop; do not deploy.' }
    }
    foreach ($familyFile in @($familyHomeSql,$familyCalendarSql,$familyNotificationSql)) {
        if (-not (Test-Path -LiteralPath $familyFile)) { throw 'A required SQL backup is missing. Keep the existing files and ask Work for the remaining export.' }
    }
    $familyOutput = & py "$familyAuditScript" --home "$familyHomeSql" --calendar "$familyCalendarSql" --notifications "$familyNotificationSql" --private-report "$familyPrivatePath" --summary "$familySummaryPath"
    $familyAuditExit = $LASTEXITCODE
    $familyOutput | Write-Output
    if ($familyAuditExit -ne 0) { throw 'Local audit stopped. Do not change data or deploy. Send only the error summary.' }
    Get-FileHash -LiteralPath $familyHomeSql,$familyCalendarSql,$familyNotificationSql,$familyAuditScript -Algorithm SHA256 | Format-List | Out-File (Join-Path $familyBackupFolder 'sha256.txt') -Encoding utf8
    [ordered]@{folder=$familyBackupFolder;source_ref=$SourceRef;created_at=(Get-Date -Format o);mode='audit-only-no-deploy';summary=$familySummaryPath} | ConvertTo-Json | Out-File (Join-Path $familyBackupFolder 'manifest.json') -Encoding utf8
    Write-Host "`nRESULT: BACKUPS AND AUDIT OK (role review still required)" -ForegroundColor Green
    Write-Host "Backup folder: $familyBackupFolder"
    Write-Host "Send only: $familySummaryPath"
    Write-Host 'Do NOT send SQL exports or PRIVATE-ids-and-memberships.json.'
    Write-Host 'No deployment, migrations, user changes, permissions, balances, points, events or subscriptions were changed.'
} catch {
    Write-Host "`nRESULT: STOP" -ForegroundColor Red
    Write-Host $_.Exception.Message
    if ($familyBackupFolder) { Write-Host "Keep existing backups: $familyBackupFolder" }
    exit 1
}
