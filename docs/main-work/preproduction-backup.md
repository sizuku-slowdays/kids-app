# 本番反映前のバックアップ・照合（2026-10-11）

対象：カレンダー公開権限と家系図の作業PR #3。**本番のバックアップ・件数照合は未実施**。現在のWorkからCloudflare本番DB/R2を操作する接続は確認できないため、取得済みとは記録しない。コードは作業ブランチに保存し、本番反映前にこの手順を完了する。

## 保存するもの

- home-db、calendar-dbそれぞれの**スキーマ＋全データ**のSQLエクスポート。CREATE TABLE一覧や件数だけでは復元用バックアップにならない。
- 反映前のhome-worker/calendar-workerのVersion ID、ソース、Bindings・ルート・cron・変数名。Secret値をGitや画面コピーへ貼らない。
- home-privateのオブジェクト一覧（キー・サイズ・更新時刻・ETag）と、必要な画像の非公開コピー。既存キーは今回の実装で削除・上書きしないが、一覧だけでは画像のバックアップにならない。
- 既存アルバムWorker/D1/R2は今回変更しない。別途画像を移す場合は、その作業前に該当DB/R2もバックアップする。

バックアップはリポジトリの外の、本人だけがアクセスできる場所へ保存する。実名、パスワードハッシュ、セッション情報、残高、写真等を含むため、公開GitHubへアップロードしない。ファイルサイズ、取得時刻、チェックサムとローカル復元確認の結果を記録する。

## SQLエクスポート

Cloudflareへ認証済みのWranglerが使える端末で取得する。既存HOMEプロジェクトの `cloudflare/home-worker` にはhome-dbの設定がある。次の保存先は例であり、自分の非公開フォルダーの絶対パスへ置き換える。

```sh
npx wrangler d1 export home-db --remote --output=/PRIVATE_BACKUP/home-before.sql
```

calendar-dbのUUIDは未確認。Dashboardのcalendar-dbで実際のUUIDを確認してから、リポジトリ外の一時設定ファイルを用意する。推測のUUIDを使用しない。設定例（プレースホルダーを実際の値へ置き換える）：

```json
{
  "name": "calendar-backup-only",
  "compatibility_date": "2026-10-01",
  "d1_databases": [{"binding": "DB", "database_name": "calendar-db", "database_id": "ACTUAL_CALENDAR_DB_UUID"}]
}
```

```sh
npx wrangler d1 export calendar-db --remote --config=/PRIVATE_BACKUP/calendar-backup.json --output=/PRIVATE_BACKUP/calendar-before.sql
```

この一時設定でdeployは行わない。公式手順：[D1 export](https://developers.cloudflare.com/d1/best-practices/import-export-data/#export-an-existing-d1-database)、[Wranglerコマンド](https://developers.cloudflare.com/d1/wrangler-commands/)。エクスポート中はDB要求をブロックするため、家族が利用していない短い時間を選ぶ。提供されたスキーマには仮想テーブルは確認していないが、実DBがエクスポートできない場合はテーブルを削除せず停止して調査する。

## 反映前後の照合

全DBのエクスポートが読み込めることを確認してから反映する。比較前に通常操作を再開しない。ログインによるsessions.last_seen_at更新やcronの掃除も差分として検出されるので、差分を見て機械的に上書き・復元せず、実際の原因を確認する。

反映後に同じ2つのDBを `home-after.sql`、`calendar-after.sql` としてエクスポートし、リポジトリのルートで以下を実行する（Python標準ライブラリのみ）：

```sh
python scripts/check-deployment-backups.py --profile home --before /PRIVATE_BACKUP/home-before.sql --after /PRIVATE_BACKUP/home-after.sql
python scripts/check-deployment-backups.py --profile calendar --before /PRIVATE_BACKUP/calendar-before.sql --after /PRIVATE_BACKUP/calendar-after.sql
```

スクリプトは作業ブランチ `feature/calendar-family-tree-20261011` の [照合ツール](https://github.com/sizuku-slowdays/kids-app/blob/feature/calendar-family-tree-20261011/scripts/check-deployment-backups.py) を使用する（mainには管理資料だけを保存）。本番用HOMEブランチを変更せず、この作業ブランチの別チェックアウトで実行する。

スクリプトはSQLエクスポートをメモリ内SQLiteへ読み込み、元の全業務テーブルの件数・列定義・各行のハッシュを照合する。同じ件数でも金額や予定内容が変われば失敗する。DB・R2・ファイル原本を変更しない。結果にレコード内容は出力しない。

許可する変更は今回の追加8 HOMEテーブル、追加5 calendarテーブル、apps/group_appsのfamily-tree追加だけ。D1の内部テーブルとmigration履歴は比較対象外。未想定の新テーブルや元データの変更は失敗とする。結果は非公開保存し、本番状態を確認してから台帳へ「照合済み」と記録する。

反映前のSQLはローカルSQLiteで読み込み／整合性を確認し、R2コピーも開けることを確認する。本番DBへの全量復元は別の破壊的操作となるため、この手順から自動実行しない。必要になった時点で現在のDBも退避し、対象版・停止時間・復元範囲を確認する。

## 家庭・ユーザー別の実環境確認

以下はローカルの架空データでテスト済み。本番でのログイン・Safari・ホーム画面起動は未確認。実ユーザーのIDや内容を公開資料へ記載しない。

| 利用者・条件 | 期待する動作 |
| --- | --- |
| 未ログイン／失効端末 | カレンダーAPI・家系図・写真を取得できない |
| 同家庭の一般メンバー | 許可された予定と家系図を閲覧。人の予定を編集・削除不可 |
| 登録者本人 | 許可されたカレンダーの自分の予定を編集・削除 |
| カレンダー所有家庭のowner/admin | 閲覧できる予定を編集・削除。本人限定・対象外予定は取得／変更／削除不可 |
| child設定の管理ロール | 他人の予定の管理権限を使用不可。家系図は閲覧のみ |
| 別家庭の管理者 | 共有承認前は予定閲覧不可。承認後も他家庭の管理権限は持たない |
| 予定対象外の大人／子ども | IDを直接指定しても件名・詳細・IDを返さない |
| 明示adultの家庭メンバー | 自分の家庭の家系図だけ編集・ごみ箱・バックアップ・復元 |
| 他家庭／未許可ユーザー | 人物ID・写真ID・家庭IDを知っていても非公開情報を取得・変更不可 |
| 人物2人を順に削除して復元 | 両人物が戻った時点で、人物削除に伴った関係も復元 |
| 関係だけを意図的に削除 | 人物の復元で勝手に戻らず、ごみ箱から別途復元 |
| 通知対象 | 従来設定の通知は継続。新公開範囲の未対応対象だけ停止。件名を旧通知APIへ漏らさない |
