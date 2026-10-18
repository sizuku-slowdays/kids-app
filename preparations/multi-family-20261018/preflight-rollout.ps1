param(
 [Parameter(Mandatory=$true)][string]$SourceRef,
 [string]$BackupFolder=(Join-Path $env:USERPROFILE 'wagaya-multi-family-20261018-103323')
)
$ErrorActionPreference='Stop'
try {
 if($SourceRef -notmatch '^[0-9a-f]{40}$'){throw 'A fixed 40-character Git commit is required.'}
 $familyFolder=(Resolve-Path -LiteralPath $BackupFolder).Path
 $familySqls=@('home-before.sql','calendar-before.sql','notifications-before.sql')|ForEach-Object {Join-Path $familyFolder $_}
 foreach($familySql in $familySqls){if(!(Test-Path -LiteralPath $familySql)){throw "Missing backup: $familySql"}}
 $familyScript=Join-Path $familyFolder 'audit-multi-family-preflight.py'
 Invoke-WebRequest -Uri "https://raw.githubusercontent.com/sizuku-slowdays/kids-app/$SourceRef/scripts/audit-multi-family.py" -OutFile $familyScript
 $familyReport=& py $familyScript --home $familySqls[0] --calendar $familySqls[1] --notifications $familySqls[2] --private-report (Join-Path $familyFolder 'PRIVATE-preflight.json') --summary (Join-Path $familyFolder 'preflight-summary-safe.json')
 if($LASTEXITCODE -ne 0){throw 'The saved SQL backups failed their offline audit. Stop; do not deploy.'}
 $familyResult=($familyReport -join "`n")|ConvertFrom-Json
 if(!$familyResult.ok){throw 'The offline backup audit did not pass.'}
 Write-Host 'SQL backups: integrity and foreign keys OK. No new export was made.'
 $familyLegacyRef='a5c8d173c77a20c53125ee1897511f08c0a25a12'
 $familyExpected=Join-Path $familyFolder 'calendar-worker-expected-before.js'
 $familyBefore=Join-Path $familyFolder 'calendar-worker-before-multi-family.js'
 $familyAfter=Join-Path $familyFolder 'calendar-worker-after-multi-family.js'
 Invoke-WebRequest -Uri "https://raw.githubusercontent.com/sizuku-slowdays/kids-app/$familyLegacyRef/cloudflare/calendar-worker/calendar-worker.js" -OutFile $familyExpected
 Write-Host ''
 Write-Host 'Cloudflare > calendar-worker > Edit code を開いてください。'
 Write-Host '現在のコードをすべて選択し、コピーしてください。貼り付けは不要です。'
 [void](Read-Host 'コピーしたらここへ戻ってEnter（コードをPowerShellに貼り付けない）')
 $familySource=Get-Clipboard -Raw
 if([string]::IsNullOrWhiteSpace($familySource)){throw 'The clipboard is empty.'}
 if((Test-Path -LiteralPath $familyBefore) -and ([IO.File]::ReadAllText($familyBefore) -ne $familySource)){throw 'A different Worker backup already exists. It was not overwritten.'}
 [IO.File]::WriteAllText($familyBefore,$familySource,[Text.UTF8Encoding]::new($false))
 function Get-FamilyNormalizedHash([string]$Value){
  $familyNormalized=$Value.TrimStart([char]0xFEFF).Replace("`r`n","`n").TrimEnd([char[]]"`r`n")
  $familyHasher=[Security.Cryptography.SHA256]::Create()
  try{return [BitConverter]::ToString($familyHasher.ComputeHash([Text.Encoding]::UTF8.GetBytes($familyNormalized))).Replace('-','').ToLowerInvariant()}finally{$familyHasher.Dispose()}
 }
 if((Get-FamilyNormalizedHash $familySource) -ne (Get-FamilyNormalizedHash ([IO.File]::ReadAllText($familyExpected)))){throw 'Current calendar Worker differs from the reviewed GitHub version. The backup was kept. Do not replace or deploy it; send only this mismatch message.'}
 Invoke-WebRequest -Uri "https://raw.githubusercontent.com/sizuku-slowdays/kids-app/$SourceRef/cloudflare/calendar-worker/calendar-worker.js" -OutFile $familyAfter
 & node --check $familyBefore
 if($LASTEXITCODE -ne 0){throw 'The old Worker failed its syntax check.'}
 & node --check $familyAfter
 if($LASTEXITCODE -ne 0){throw 'The new Worker failed its syntax check.'}
 Get-FileHash -LiteralPath ($familySqls+@($familyBefore,$familyExpected,$familyAfter)) -Algorithm SHA256|Format-List|Out-File (Join-Path $familyFolder 'rollout-sha256.txt') -Encoding utf8
 [ordered]@{source_ref=$SourceRef;legacy_ref=$familyLegacyRef;checked_at=(Get-Date -Format o);backup_folder=$familyFolder;worker_matches=$true;production_changed=$false}|ConvertTo-Json|Out-File (Join-Path $familyFolder 'rollout-preflight.json') -Encoding utf8
 Write-Host ''
 Write-Host 'RESULT: PREFLIGHT ALL OK' -ForegroundColor Green
 Write-Host "Backup folder: $familyFolder"
 Write-Host 'Current calendar Worker matches GitHub. New Worker downloaded and syntax checked.'
 Write-Host 'No deployment, migrations, roles, users, notifications, points or balances were changed.'
 Write-Host 'Send only RESULT. Do not send SQL files, PRIVATE reports or clipboard contents.'
} catch {
 Write-Host 'RESULT: STOP' -ForegroundColor Red
 Write-Host $_.Exception.Message
 exit 1
}
