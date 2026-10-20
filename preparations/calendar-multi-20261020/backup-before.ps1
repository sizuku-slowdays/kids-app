param([Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{40}$')][string]$SourceRef)
$ErrorActionPreference='Stop'
try {
 $calendarRoot=Join-Path $env:USERPROFILE ('wagaya-calendar-multi-'+(Get-Date -Format 'yyyyMMdd-HHmmss'))
 New-Item -ItemType Directory -Path $calendarRoot | Out-Null
 $calendarRepo='https://raw.githubusercontent.com/sizuku-slowdays/kids-app'
 $calendarBaseline='576fdc2699125a7d17073b0f79dd886a8db2cf48'
 foreach($calendarFile in @('audit-multi-family.py','check-calendar-multi-upgrade.py')) {
  Invoke-WebRequest -UseBasicParsing -Uri "$calendarRepo/$SourceRef/scripts/$calendarFile" -OutFile (Join-Path $calendarRoot $calendarFile)
 }
 $calendarDbs=@(@('home','fed5c0be-51b5-486f-935f-58678481f2a9'),@('calendar','6835690b-7a86-4576-b200-2355bac2d9c2'),@('notifications','fa30f8a0-965f-4752-868b-8b6065bd88a0'))
 foreach($calendarDb in $calendarDbs) {
  $calendarOut=Join-Path $calendarRoot ($calendarDb[0]+'-before.sql')
  & npx.cmd wrangler d1 export $calendarDb[1] --remote --output $calendarOut
  if($LASTEXITCODE -ne 0){throw ('Export failed: '+$calendarDb[0])}
  $calendarAudit=& py (Join-Path $calendarRoot 'check-calendar-multi-upgrade.py') --before $calendarOut --profile $calendarDb[0]
  if($LASTEXITCODE -ne 0){throw ('Backup verification failed: '+$calendarDb[0])}
  $calendarAudit | Out-File (Join-Path $calendarRoot ($calendarDb[0]+'-safe.json')) -Encoding utf8
 }
 $calendarUtf8=New-Object System.Text.UTF8Encoding($false)
 $calendarWorkers=@(@('notification-center-api','cloudflare/notification-center-api/notification-center-api.js'),@('calendar-worker','cloudflare/calendar-worker/calendar-worker.js'))
 foreach($calendarWorker in $calendarWorkers) {
  $calendarName=$calendarWorker[0]
  $calendarOld=Join-Path $calendarRoot ($calendarName+'-expected-before.js')
  $calendarNew=Join-Path $calendarRoot ($calendarName+'-after.js')
  Invoke-WebRequest -UseBasicParsing -Uri "$calendarRepo/$calendarBaseline/$($calendarWorker[1])" -OutFile $calendarOld
  Invoke-WebRequest -UseBasicParsing -Uri "$calendarRepo/$SourceRef/$($calendarWorker[1])" -OutFile $calendarNew
  & node --check $calendarNew
  if($LASTEXITCODE -ne 0){throw ('New Worker syntax failed: '+$calendarName)}
  Write-Host "Open $calendarName > Edit code in Cloudflare. DO NOT edit or deploy yet."
  Write-Host 'Select ALL existing Worker code and COPY it (Ctrl+A, Ctrl+C).'
  Read-Host 'Return here and press Enter AFTER copying. DO NOT paste code into PowerShell' | Out-Null
  $calendarCopied=Get-Clipboard -Raw
  if([string]::IsNullOrWhiteSpace($calendarCopied)){throw ('Clipboard empty: '+$calendarName)}
  [System.IO.File]::WriteAllText((Join-Path $calendarRoot ($calendarName+'-before.js')),$calendarCopied,$calendarUtf8)
  $calendarExpected=[System.IO.File]::ReadAllText($calendarOld)
  if($calendarCopied.Replace("`r`n","`n").Trim() -cne $calendarExpected.Replace("`r`n","`n").Trim()){throw ('Worker differs from GitHub; stop for review: '+$calendarName)}
 }
 Get-ChildItem -LiteralPath $calendarRoot -File | Where-Object {$_.Extension -in @('.sql','.js','.py')} | Get-FileHash -Algorithm SHA256 | Format-List | Out-File (Join-Path $calendarRoot 'sha256.txt') -Encoding utf8
 @{source_ref=$SourceRef;baseline_ref=$calendarBaseline;backup_folder=$calendarRoot;verified_at=(Get-Date -Format o)} | ConvertTo-Json | Out-File (Join-Path $calendarRoot 'manifest.json') -Encoding utf8
 Write-Host 'RESULT: BACKUPS AND WORKER SOURCES ALL OK'
 Write-Host "Backup folder: $calendarRoot"
 Write-Host 'Both current Worker sources match GitHub. New sources downloaded and syntax checked.'
 Write-Host 'No deployment, migrations, events, rules, subscriptions, checks, points or balances changed.'
 Write-Host 'Send RESULT and Backup folder only. Do not send SQL, source code or clipboard contents.'
} catch {Write-Host ('RESULT: STOP - '+$_.Exception.Message);exit 1}
