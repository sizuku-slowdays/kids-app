param([Parameter(Mandatory=$true)][string]$BackupFolder)
$ErrorActionPreference='Stop'
try {
 $calendarDbs=@(@('home','fed5c0be-51b5-486f-935f-58678481f2a9'),@('calendar','6835690b-7a86-4576-b200-2355bac2d9c2'),@('notifications','fa30f8a0-965f-4752-868b-8b6065bd88a0'))
 $calendarStamp=Get-Date -Format 'yyyyMMdd-HHmmss'
 foreach($calendarDb in $calendarDbs) {
  $calendarBefore=Join-Path $BackupFolder ($calendarDb[0]+'-before.sql')
  $calendarAfter=Join-Path $BackupFolder ($calendarDb[0]+'-after-'+$calendarStamp+'.sql')
  if(!(Test-Path -LiteralPath $calendarBefore)){throw 'Before backup missing'}
  & npx.cmd wrangler d1 export $calendarDb[1] --remote --output $calendarAfter
  if($LASTEXITCODE -ne 0){throw ('Export failed: '+$calendarDb[0])}
  $calendarAudit=& py (Join-Path $BackupFolder 'check-calendar-multi-upgrade.py') --before $calendarBefore --after $calendarAfter --profile $calendarDb[0]
  $calendarCode=$LASTEXITCODE
  $calendarAudit | Out-File (Join-Path $BackupFolder ($calendarDb[0]+'-comparison-safe.json')) -Encoding utf8
  if($calendarCode -ne 0){$calendarAudit | Write-Host;throw ('Comparison needs review: '+$calendarDb[0]+'. Do not restore or rerun a migration.')}
 }
 Write-Host 'RESULT: EXISTING DATA ALL OK'
 Write-Host 'Original events, visibility, rules, subscriptions, school data, points and balances match.'
 Write-Host 'Only the additive calendar options table is expected. No test events were created.'
} catch {Write-Host ('RESULT: STOP - '+$_.Exception.Message);exit 1}
