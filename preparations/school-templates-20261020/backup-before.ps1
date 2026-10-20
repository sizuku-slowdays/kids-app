param([Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{40}$')][string]$SourceRef)
$ErrorActionPreference = 'Stop'
try {
    $schoolRoot = Join-Path $env:USERPROFILE ('wagaya-school-templates-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
    New-Item -ItemType Directory -Path $schoolRoot -ErrorAction Stop | Out-Null
    $schoolBase = "https://raw.githubusercontent.com/sizuku-slowdays/kids-app/$SourceRef/scripts"
    foreach ($schoolFile in @('audit-multi-family.py','check-school-template-upgrade.py')) {
        Invoke-WebRequest -UseBasicParsing -Uri "$schoolBase/$schoolFile" -OutFile (Join-Path $schoolRoot $schoolFile)
    }
    $schoolBefore = Join-Path $schoolRoot 'home-before.sql'
    & npx.cmd wrangler d1 export fed5c0be-51b5-486f-935f-58678481f2a9 --remote --output $schoolBefore
    if ($LASTEXITCODE -ne 0) { throw 'D1 export failed' }
    $schoolAudit = & py (Join-Path $schoolRoot 'check-school-template-upgrade.py') --before $schoolBefore
    if ($LASTEXITCODE -ne 0) { throw 'Backup verification failed' }
    $schoolAudit | Out-File (Join-Path $schoolRoot 'before-safe.json') -Encoding utf8
    Get-FileHash -LiteralPath $schoolBefore -Algorithm SHA256 | Format-List | Out-File (Join-Path $schoolRoot 'sha256.txt') -Encoding utf8
    @{source_ref=$SourceRef;backup_folder=$schoolRoot;verified_at=(Get-Date -Format o)} | ConvertTo-Json | Out-File (Join-Path $schoolRoot 'manifest.json') -Encoding utf8
    Write-Host 'RESULT: BACKUP ALL OK'
    Write-Host "Backup folder: $schoolRoot"
    Write-Host 'No deployment, migrations, homework, checks, notifications, points or balances changed.'
    Write-Host 'Send RESULT and Backup folder only. Do not send SQL exports.'
} catch {
    Write-Host ('RESULT: STOP - ' + $_.Exception.Message)
    exit 1
}
