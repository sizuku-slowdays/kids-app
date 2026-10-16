param([string]$SourceRef = 'feature/passbook-book-20261016')
$ErrorActionPreference = 'Stop'
try {
    $printStamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $printBackupFolder = Join-Path $env:USERPROFILE "wagaya-passbook-print-$printStamp"
    New-Item -ItemType Directory -Path $printBackupFolder | Out-Null
    $printSqlPath = Join-Path $printBackupFolder 'home-before.sql'
    $printAuditPath = Join-Path $printBackupFolder 'audit-passbook-book.py'
    Invoke-WebRequest -Uri "https://raw.githubusercontent.com/sizuku-slowdays/kids-app/$SourceRef/scripts/audit-passbook-book.py" -OutFile $printAuditPath
    npx.cmd wrangler d1 export fed5c0be-51b5-486f-935f-58678481f2a9 --remote --output "$printSqlPath"
    if ($LASTEXITCODE -ne 0) { throw 'HOME backup export failed.' }
    py "$printAuditPath" "$printSqlPath"
    if ($LASTEXITCODE -ne 0) { throw 'Local audit found an issue. STOP and send the result; do not repair records.' }
    Get-FileHash -LiteralPath $printSqlPath,$printAuditPath -Algorithm SHA256 | Format-List | Out-File (Join-Path $printBackupFolder 'sha256.txt') -Encoding utf8
    [ordered]@{folder=$printBackupFolder;home_before=$printSqlPath;source_ref=$SourceRef;created_at=(Get-Date -Format o)} | ConvertTo-Json | Out-File (Join-Path $printBackupFolder 'manifest.json') -Encoding utf8
    Write-Host "`nRESULT: ALL OK" -ForegroundColor Green
    Write-Host "Backup folder: $printBackupFolder"
    Write-Host 'Legacy adjustments and date warnings are reported, never repaired.'
    Write-Host 'No production code, schema, entries, points or balances were changed.'
}
catch {
    Write-Host "`nRESULT: STOP" -ForegroundColor Red
    Write-Host $_.Exception.Message
}
