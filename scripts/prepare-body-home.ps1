param([Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{40}$')][string]$SourceCommit,
 [Parameter(Mandatory=$true)][string]$Folder,[ValidateSet('preflight','verify')][string]$Stage='preflight')
$ErrorActionPreference='Stop'
$bodyStage='prepare files'
try {
 foreach($name in @('home-before.sql','calendar-before.sql')){if(!(Test-Path -LiteralPath (Join-Path $Folder $name))){throw 'Verified backups are missing.'}}
 $bodyFiles=@{
  'scripts/check-body-home-upgrade.py'='check-body-home-upgrade.py'
  'cloudflare/calendar-worker/body-home.sql'='body-home.sql'
  'cloudflare/home-worker/migrations/0026_body_calendar.sql'='0026_body_calendar.sql'
  'cloudflare/calendar-worker/calendar-worker.js'='calendar-worker-after-body.js'
 }
 foreach($source in $bodyFiles.Keys){Invoke-WebRequest -UseBasicParsing -Uri "https://raw.githubusercontent.com/sizuku-slowdays/kids-app/$SourceCommit/$source" -OutFile (Join-Path $Folder $bodyFiles[$source])}
 if($Stage -eq 'verify'){
  $bodyStage='export after backups'
  foreach($database in @(@('fed5c0be-51b5-486f-935f-58678481f2a9','home-after-body.sql'),@('6835690b-7a86-4576-b200-2355bac2d9c2','calendar-after-body.sql'))){
   $bodyId=$database[0];$bodyPath=Join-Path $Folder $database[1]
   if(Test-Path -LiteralPath $bodyPath){throw 'An after export already exists; stop without overwriting.'}
   & npx.cmd wrangler d1 export $bodyId --remote --output $bodyPath
   if($LASTEXITCODE -ne 0){throw 'Export failed.'}
  }
 }
 $bodyStage='validate local backups and trial schema'
 & py (Join-Path $Folder 'check-body-home-upgrade.py') --folder $Folder --mode $Stage
 if($LASTEXITCODE -ne 0){throw 'Local backup/schema check stopped. No deployment was performed.'}
 if($Stage -eq 'preflight'){
  $bodyStage='backup existing calendar Worker source'
  Write-Host 'Open Cloudflare > calendar-worker > Edit code. COPY ALL current code (do NOT paste or Deploy).'
  [void](Read-Host 'Return here and press Enter AFTER copying the current Worker code')
  $bodyCurrent=Get-Clipboard -Raw
  if(!$bodyCurrent -or $bodyCurrent.Length -lt 15000){throw 'The clipboard is not the complete current calendar Worker.'}
  $bodyBefore=Join-Path $Folder 'calendar-worker-before-body.js'
  if(Test-Path -LiteralPath $bodyBefore){throw 'Worker source backup exists; stop without overwriting.'}
  [IO.File]::WriteAllText($bodyBefore,$bodyCurrent,[Text.UTF8Encoding]::new($false))
  $bodyExpectedPath=Join-Path $Folder 'calendar-worker-expected-before.js'
  Invoke-WebRequest -UseBasicParsing -Uri 'https://raw.githubusercontent.com/sizuku-slowdays/kids-app/8235388019f27d409b542fd539456adc75a32b30/cloudflare/calendar-worker/calendar-worker.js' -OutFile $bodyExpectedPath
  $bodyExpected=[IO.File]::ReadAllText($bodyExpectedPath).Replace("`r`n","`n").Trim()
  if($bodyCurrent.Replace("`r`n","`n").Trim() -cne $bodyExpected){throw 'Current calendar Worker differs from the reviewed GitHub base. Stop without Deploy.'}
  & node --check $bodyBefore
  if($LASTEXITCODE -ne 0){throw 'Current Worker syntax check failed.'}
  & node --check (Join-Path $Folder 'calendar-worker-after-body.js')
  if($LASTEXITCODE -ne 0){throw 'New Worker syntax check failed.'}
  Get-FileHash -Path (Join-Path $Folder '*-body.js'),(Join-Path $Folder 'body-home.sql'),(Join-Path $Folder '0026_body_calendar.sql') -Algorithm SHA256 | Format-List | Out-File (Join-Path $Folder 'body-preflight-sha256.txt') -Encoding utf8
  Write-Host 'RESULT: PREFLIGHT ALL OK'
  Write-Host 'Current calendar Worker matches GitHub. New source syntax and real backup trial inserts passed.'
 }
 Write-Host "Backup folder: $Folder"
 Write-Host 'No deployment, migrations, account links, records, requests, permissions, points or balances changed.'
 Write-Host 'Send RESULT and Backup folder only. Do not send SQL, source, passwords or clipboard contents.'
} catch {Write-Host 'RESULT: STOP';Write-Host "Stage: $bodyStage";throw}
