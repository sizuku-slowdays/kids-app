# 帰宅後のPowerShell操作（まだ実行していません）

まずは確認・ローカル試験・バックアップまで。**この資料には本番デプロイや本番SQL適用のコマンドを入れていません。** つうちょうも学校/英語も、帰宅の報告・バックアップ検証・残り仕様確認後に順番に案内します。

## 1. ソースを別のフォルダーへ取得

既存の作業フォルダーには上書きしません。Gitが利用できるか確認：

```powershell
git --version
```

Gitがある場合だけ、新規フォルダーへclone：

```powershell
git clone --single-branch --branch feature/learning-preparation-20261015 https://github.com/sizuku-slowdays/kids-app.git "$env:USERPROFILE\wagaya-learning-prep-20261015"
```

すでにフォルダーがある場合は停止してWorkへ報告。削除や上書き不要。Gitがない場合は導入を急がずWorkへ報告し、ZIP取得手順へ切り替えます。

```powershell
Set-Location "$env:USERPROFILE\wagaya-learning-prep-20261015"
```

```powershell
git rev-parse HEAD
```

## 2. ローカルの依存関係と試験

```powershell
Set-Location "$env:USERPROFILE\wagaya-learning-prep-20261015\cloudflare\home-worker"
```

```powershell
npm.cmd ci
```

```powershell
Set-Location "$env:USERPROFILE\wagaya-learning-prep-20261015\preparations\learning-20261015"
```

```powershell
npm.cmd install
```

```powershell
py .\test\split-schema.py
```

```powershell
npm.cmd test
```

```powershell
py .\test\schema-preservation.py
```

これらはローカルの合成データだけを使います。新しい依存関係は準備ディレクトリだけです。既存HOMEのpackage/lockやCloudflareは変更しません。

画面試作をPCで見る場合（別ターミナルを使ってよい）：

```powershell
py -m http.server 8765 --bind 127.0.0.1
```

ブラウザーで http://127.0.0.1:8765/preview/ を開く。停止はCtrl+C。画面操作はサンプルだけで保存されません。127.0.0.1だけで待ち受け、外部公開しません。

## 3. 新しいhome-dbバックアップ

バックアップはリポジトリ外へ。D1 exportはエクスポート中に一時的にDBを利用できなくなる旨の確認が出るため、家族が使っていないときに実施してください。

```powershell
$backupDir = Join-Path $env:USERPROFILE ("wagaya-before-next-" + (Get-Date -Format "yyyyMMdd-HHmmss"))
```

```powershell
New-Item -ItemType Directory -Path $backupDir
```

```powershell
npx.cmd wrangler d1 export fed5c0be-51b5-486f-935f-58678481f2a9 --remote --output "$backupDir\home-db-before.sql"
```

正常保存メッセージを確認してから：

```powershell
py .\verify-backup.py "$backupDir\home-db-before.sql"
```

```powershell
Get-FileHash "$backupDir\home-db-before.sql" -Algorithm SHA256 | Format-List | Out-File "$backupDir\backup-sha256.txt" -Encoding utf8
```

バックアップファイルの中身・秘密値・実名はGitHubへ載せないでください。検証結果（integrity/FK/件数/保存完了）だけWorkへ報告。

## アプリ別の次の操作

| アプリ | 次の段階 | 今は実行しないもの |
| --- | --- | --- |
| つうちょう | バックアップ検証→PR #4の監査スクリプトで10/14実記録/既入金を照合→反映版レビュー | 0018適用、金融Cron、未払い入金、既存残高への試験 |
| 学校準備 | 旧時間割・学校APIのWorkerとbinding確認→バックアップ→画像の子/週を確認→AI/報酬/通知条件決定 | 旧app-data移動/削除、AI有効化、通知送信、ポイント付与 |
| 英語 | プレビュー確認→HOME通信層/認証の組込→実機音声試験→正式SQL/入口レビュー | 本番アプリ登録、migration適用、デプロイ |

学校の旧DB名は未確認なので、推測したexportコマンドは作っていません。calendar-dbは今回の準備で変更しないため、この段階のexport対象にしていません。対象が増えたらWorkが確認後に案内します。
