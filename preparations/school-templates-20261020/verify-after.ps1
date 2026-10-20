param([Parameter(Mandatory=$true)][string]$BackupFolder)
$ErrorActionPreference = 'Stop'
try {
    $schoolBefore = Join-Path $BackupFolder 'home-before.sql'
    $schoolAfter = Join-Path $BackupFolder ('home-after-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.sql')
    if (!(Test-Path -LiteralPath $schoolBefore)) { throw 'Before backup missing' }
    & npx.cmd wrangler d1 export fed5c0be-51b5-486f-935f-58678481f2a9 --remote --output $schoolAfter
    if ($LASTEXITCODE -ne 0) { throw 'After export failed' }
    $schoolAudit = & py (Join-Path $BackupFolder 'check-school-template-upgrade.py') --before $schoolBefore --after $schoolAfter
    $schoolCode = $LASTEXITCODE
    $schoolAudit | Out-File (Join-Path $BackupFolder 'comparison-safe.json') -Encoding utf8
    if ($schoolCode -ne 0) { $schoolAudit | Write-Host; throw 'Comparison needs review. Do not restore or repeat migration.' }
    Get-FileHash -LiteralPath $schoolAfter -Algorithm SHA256 | Format-List | Out-File (Join-Path $BackupFolder 'after-sha256.txt') -Encoding utf8
    Write-Host 'RESULT: EXISTING DATA ALL OK'
    Write-Host 'Existing data and schemas match. Two additive school tables verified.'
    Write-Host 'No homework, checks, notifications, points or balances were changed by this verification.'
} catch {
    Write-Host ('RESULT: STOP - ' + $_.Exception.Message)
    exit 1
}
