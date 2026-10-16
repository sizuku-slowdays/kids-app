$ErrorActionPreference = 'Stop'
try {
    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $folder = Join-Path $env:USERPROFILE "wagaya-gifts-$stamp"
    New-Item -ItemType Directory -Path $folder | Out-Null
    $giftHomeBackupPath = Join-Path $folder 'home-before.sql'
    $notifications = Join-Path $folder 'notifications-before.sql'
    $verify = Join-Path $folder 'verify-backup.py'
    Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/sizuku-slowdays/kids-app/1c9d142a17f29226fc78d3eff8029b596aef0920/preparations/learning-20261015/verify-backup.py' -OutFile $verify

    Write-Host "`n[1/3] HOME backup"
    npx.cmd wrangler d1 export fed5c0be-51b5-486f-935f-58678481f2a9 --remote --output "$giftHomeBackupPath"
    if ($LASTEXITCODE -ne 0) { throw 'HOME export failed.' }
    py "$verify" "$giftHomeBackupPath"
    if ($LASTEXITCODE -ne 0) { throw 'HOME verification failed.' }

    Write-Host "`n[2/3] Notification backup"
    npx.cmd wrangler d1 export fa30f8a0-965f-4752-868b-8b6065bd88a0 --remote --output "$notifications"
    if ($LASTEXITCODE -ne 0) { throw 'Notification export failed.' }
    py "$verify" "$notifications"
    if ($LASTEXITCODE -ne 0) { throw 'Notification verification failed.' }

    Write-Host "`n[3/3] Notification Worker source backup"
    $worker = Join-Path $folder 'notification-center-api-before.js'
    Write-Host 'Open notification-center-api > Edit code. COPY all current code; do not edit or deploy.'
    Read-Host 'Press Enter AFTER copying current code' | Out-Null
    $giftWorkerCode = Get-Clipboard -Raw
    if (!$giftWorkerCode -or $giftWorkerCode -notmatch 'schoolPreparationPush') { throw 'Current notification source is missing.' }
    [System.IO.File]::WriteAllText($worker, $giftWorkerCode, [System.Text.UTF8Encoding]::new($false))
    $code = [System.IO.File]::ReadAllText($worker)
    node --check "$worker"
    if ($LASTEXITCODE -ne 0) { throw 'Worker syntax check failed.' }

    $reference = Join-Path $folder 'notification-center-api-github-reference.js'
    Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/sizuku-slowdays/kids-app/76195b24741ce7de26d8351c98e1fc17cb744a6c/cloudflare/notification-center-api/notification-center-api.js' -OutFile $reference
    function Get-NormalizedCodeHash([string]$value) {
        $normalized = $value.Replace("`r`n", "`n").TrimEnd()
        $sha = [System.Security.Cryptography.SHA256]::Create()
        try { return [BitConverter]::ToString($sha.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($normalized))).Replace('-','').ToLowerInvariant() }
        finally { $sha.Dispose() }
    }
    $sourceMatches = (Get-NormalizedCodeHash $code) -eq (Get-NormalizedCodeHash ([System.IO.File]::ReadAllText($reference)))
    Get-FileHash -LiteralPath $giftHomeBackupPath,$notifications,$worker -Algorithm SHA256 |
        Format-List | Out-File (Join-Path $folder 'sha256.txt') -Encoding utf8
    $manifest = [ordered]@{folder=$folder;home_before=$giftHomeBackupPath;notifications_before=$notifications;worker_before=$worker;worker_matches_github=$sourceMatches;worker_source_basis='current Worker clipboard copy compared with GitHub';created_at=(Get-Date -Format o)}
    $manifest | ConvertTo-Json | Out-File (Join-Path $folder 'manifest.json') -Encoding utf8
    if (!$sourceMatches) {
        throw "Backups saved, but live Worker differs from GitHub. STOP for code review. Folder: $folder"
    }
    Write-Host "`nRESULT: ALL OK" -ForegroundColor Green
    Write-Host "Backup folder: $folder"
    Write-Host 'Worker source: matches GitHub'
    Write-Host 'No production code, schema, subscriptions, points or balances were changed.'
}
catch {
    Write-Host "`nRESULT: STOP" -ForegroundColor Red
    Write-Host $_.Exception.Message
}
