param([Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{40}$')][string]$SourceCommit)
$ErrorActionPreference='Stop'
try {
 if (!$env:CLOUDFLARE_API_TOKEN) { throw 'Cloudflare API token is not loaded.' }
 $bodyFolder=Join-Path $env:USERPROFILE ('wagaya-body-calendar-'+(Get-Date -Format 'yyyyMMdd-HHmmss'))
 if(Test-Path -LiteralPath $bodyFolder){throw 'Backup folder exists; stop without overwriting.'}
 New-Item -ItemType Directory -Path $bodyFolder | Out-Null
 $bodyChecker=Join-Path $bodyFolder 'audit-body-calendar-backups.py'
 Invoke-WebRequest -UseBasicParsing -Uri "https://raw.githubusercontent.com/sizuku-slowdays/kids-app/$SourceCommit/scripts/audit-body-calendar-backups.py" -OutFile $bodyChecker
 $bodyDatabases=@(@('fed5c0be-51b5-486f-935f-58678481f2a9','home-before.sql'),@('6835690b-7a86-4576-b200-2355bac2d9c2','calendar-before.sql'))
 foreach($bodyDatabase in $bodyDatabases){
  $bodyDatabaseId=$bodyDatabase[0]
  $bodyExportPath=Join-Path $bodyFolder $bodyDatabase[1]
  & npx.cmd wrangler d1 export $bodyDatabaseId --remote --output $bodyExportPath
  if($LASTEXITCODE -ne 0){throw 'Export failed. No migration or deployment was performed.'}
 }
 & py $bodyChecker --folder $bodyFolder
 if($LASTEXITCODE -ne 0){throw 'Backup/schema validation stopped.'}
 Get-FileHash -Path (Join-Path $bodyFolder '*-before.sql') -Algorithm SHA256 | Format-List | Out-File (Join-Path $bodyFolder 'backup-sha256.txt') -Encoding utf8
 Write-Host "Backup folder: $bodyFolder"
 Write-Host 'No migration, deployment, account link, records, requests, permissions, points or balances changed.'
 Write-Host 'Send summary-safe-to-share.json only. Do NOT send SQL exports, passwords or PRIVATE files.'
} catch { Write-Host 'RESULT: STOP'; throw }
