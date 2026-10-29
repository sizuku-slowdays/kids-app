param(
    [Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{40}$')][string]$SourceCommit,
    [ValidateSet('backup','verify')][string]$Mode='backup',
    [string]$Folder
)
# Dedicated HOME export and LOCAL read-only comparison. No migration/deploy/test credit.
$ErrorActionPreference='Stop'
$chatStage='preparation'
try {
    if (!$env:CLOUDFLARE_API_TOKEN) { throw 'API token is not loaded.' }
    if ($Mode -eq 'backup') {
        $Folder=Join-Path $env:USERPROFILE ('wagaya-chore-repeat-'+(Get-Date -Format 'yyyyMMdd-HHmmss'))
        if (Test-Path -LiteralPath $Folder) { throw 'Folder already exists.' }
        New-Item -ItemType Directory -Path $Folder | Out-Null
    } elseif (!$Folder -or !(Test-Path -LiteralPath (Join-Path $Folder 'home-before.sql'))) { throw 'The verified BEFORE folder is required.' }
    $chatStage='download read-only checker'
    $checker=Join-Path $Folder 'check-chore-records-upgrade.py'
    Invoke-WebRequest -UseBasicParsing -Uri "https://raw.githubusercontent.com/sizuku-slowdays/kids-app/$SourceCommit/scripts/check-chore-records-upgrade.py" -OutFile $checker
    $chatStage='export HOME backup'
    $exportFile=if ($Mode -eq 'backup') { Join-Path $Folder 'home-before.sql' } else { Join-Path $Folder ('home-after-'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'.sql') }
    if (Test-Path -LiteralPath $exportFile) { throw 'Export path exists; it will not be overwritten.' }
    & npx.cmd wrangler d1 export fed5c0be-51b5-486f-935f-58678481f2a9 --remote --output $exportFile
    if ($LASTEXITCODE -ne 0) { throw 'Export failed.' }
    $chatStage='validate local backup'
    $checkArgs=@($checker,'--before',(Join-Path $Folder 'home-before.sql'))
    if ($Mode -eq 'verify') { $checkArgs+=@('--after',$exportFile) }
    & py @checkArgs
    if ($LASTEXITCODE -ne 0) { throw 'Comparison stopped; review without retrying deployment or resetting data.' }
    Get-FileHash -LiteralPath $exportFile -Algorithm SHA256 | Format-List | Out-File (Join-Path $Folder ($Mode+'-sha256.txt')) -Encoding utf8
    if ($Mode -eq 'backup') { Write-Host 'RESULT: BACKUP ALL OK' } else { Write-Host 'RESULT: EXISTING DATA ALL OK' }
    Write-Host "Backup folder: $Folder"
    Write-Host 'This script did not deploy, migrate, credit, change settings or repair records.'
    Write-Host 'Send RESULT and Backup folder only. Do not send SQL or private account data.'
} catch {
    Write-Host 'RESULT: STOP'
    Write-Host "Stage: $chatStage"
    Write-Host "Backup folder: $Folder"
    throw
}
