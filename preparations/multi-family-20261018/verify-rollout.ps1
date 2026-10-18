param(
 [Parameter(Mandatory=$true)][string]$SourceRef,
 [string]$BackupFolder=(Join-Path $env:USERPROFILE 'wagaya-multi-family-20261018-103323')
)
$ErrorActionPreference='Stop'
try {
 if($SourceRef -notmatch '^[0-9a-f]{40}$'){throw 'A fixed Git commit is required.'}
 $familyFolder=(Resolve-Path -LiteralPath $BackupFolder).Path
 $familyManifest=Get-Content -Raw -LiteralPath (Join-Path $familyFolder 'rollout-preflight.json')|ConvertFrom-Json
 if(!$familyManifest.worker_matches -or $familyManifest.source_ref -ne $SourceRef){throw 'The preflight does not match this release.'}
 $familyAfterFolder=Join-Path $familyFolder ('after-'+(Get-Date -Format 'yyyyMMdd-HHmmss'))
 New-Item -ItemType Directory -Path $familyAfterFolder|Out-Null
 foreach($familyScript in @('audit-multi-family.py','check-multi-family-upgrade.py')){Invoke-WebRequest -Uri "https://raw.githubusercontent.com/sizuku-slowdays/kids-app/$SourceRef/scripts/$familyScript" -OutFile (Join-Path $familyAfterFolder $familyScript)}
 foreach($familyPair in @(@('home','fed5c0be-51b5-486f-935f-58678481f2a9'),@('calendar','6835690b-7a86-4576-b200-2355bac2d9c2'))){
  $familyName=$familyPair[0];$familyDb=$familyPair[1];$familyExport=Join-Path $familyAfterFolder ($familyName+'-after.sql')
  & npx.cmd wrangler d1 export $familyDb --remote --output $familyExport
  if($LASTEXITCODE -ne 0){throw 'Export failed. Existing backups were kept.'}
  $familyOutput=& py (Join-Path $familyAfterFolder 'check-multi-family-upgrade.py') --profile $familyName --before (Join-Path $familyFolder ($familyName+'-before.sql')) --after $familyExport
  $familyCheckExit=$LASTEXITCODE
  $familyOutput|Out-File (Join-Path $familyAfterFolder ($familyName+'-comparison-safe.json')) -Encoding utf8
  if($familyCheckExit -ne 0){$familyOutput|Write-Output;throw 'Comparison requires review. Keep invitations disabled. Do not restore or modify data.'}
 }
 Get-ChildItem -LiteralPath $familyAfterFolder -Filter '*.sql'|Get-FileHash -Algorithm SHA256|Format-List|Out-File (Join-Path $familyAfterFolder 'after-sha256.txt') -Encoding utf8
 Write-Host 'RESULT: POST-DEPLOY DATA ALL OK' -ForegroundColor Green
 Write-Host 'Existing HOME and calendar records match. Invitation activation is still a separate step.'
 Write-Host "Verification folder: $familyAfterFolder"
} catch {
 Write-Host 'RESULT: STOP' -ForegroundColor Red
 Write-Host $_.Exception.Message
 exit 1
}
