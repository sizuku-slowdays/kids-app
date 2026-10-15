$ErrorActionPreference = 'Stop'
try {
    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $folder = Join-Path $env:USERPROFILE "wagaya-school-prep-$stamp"
    New-Item -ItemType Directory -Path $folder | Out-Null
    $home = Join-Path $folder 'home-before.sql'
    $notifications = Join-Path $folder 'notifications-before.sql'
    $verify = Join-Path $folder 'verify-backup.py'
    Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/sizuku-slowdays/kids-app/1c9d142a17f29226fc78d3eff8029b596aef0920/preparations/learning-20261015/verify-backup.py' -OutFile $verify

    Write-Host "`n[1/3] HOME backup"
    npx.cmd wrangler d1 export fed5c0be-51b5-486f-935f-58678481f2a9 --remote --output "$home"
    if ($LASTEXITCODE -ne 0) { throw 'HOME export failed.' }
    py "$verify" "$home"
    if ($LASTEXITCODE -ne 0) { throw 'HOME verification failed.' }

    Write-Host "`n[2/3] Notification backup"
    npx.cmd wrangler d1 export fa30f8a0-965f-4752-868b-8b6065bd88a0 --remote --output "$notifications"
    if ($LASTEXITCODE -ne 0) { throw 'Notification export failed.' }
    py "$verify" "$notifications"
    if ($LASTEXITCODE -ne 0) { throw 'Notification verification failed.' }

    Write-Host "`n[3/3] Worker source backup (DO NOT edit or deploy)"
    Write-Host 'Open notification-center-api > Edit code in Cloudflare.'
    Write-Host 'Select ALL existing Worker code and COPY it. Return here and press Enter.'
    Read-Host 'Press Enter AFTER copying existing Worker code' | Out-Null
    $code = Get-Clipboard -Raw
    if (!$code -or $code -notmatch 'export default' -or $code -notmatch 'homeNotificationRoute') {
        throw 'Clipboard does not contain the existing notification Worker code. Nothing has been deployed.'
    }
    $worker = Join-Path $folder 'notification-center-api-before.js'
    [System.IO.File]::WriteAllText($worker, $code, [System.Text.UTF8Encoding]::new($false))
    node --check "$worker"
    if ($LASTEXITCODE -ne 0) { throw 'Worker syntax check failed.' }

    $reference = Join-Path $folder 'notification-center-api-github-reference.js'
    Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/sizuku-slowdays/kids-app/8389d7a0d4e0e9027804ba2abd55a7669026cda3/cloudflare/notification-center-api/notification-center-api.js' -OutFile $reference
    function Get-NormalizedCodeHash([string]$value) {
        $normalized = $value.Replace("`r`n", "`n").TrimEnd()
        $sha = [System.Security.Cryptography.SHA256]::Create()
        try { return [BitConverter]::ToString($sha.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($normalized))).Replace('-','').ToLowerInvariant() }
        finally { $sha.Dispose() }
    }
    $sourceMatches = (Get-NormalizedCodeHash $code) -eq (Get-NormalizedCodeHash ([System.IO.File]::ReadAllText($reference)))
    Get-FileHash -LiteralPath $home,$notifications,$worker -Algorithm SHA256 |
        Format-List | Out-File (Join-Path $folder 'sha256.txt') -Encoding utf8
    $manifest = [ordered]@{folder=$folder;home_before=$home;notifications_before=$notifications;worker_before=$worker;worker_matches_github=$sourceMatches;created_at=(Get-Date -Format o)}
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
