# カレンダー共有・家系図（2026-10-11）

状態：作業ブランチで実装・ローカル検証済み。本番未反映。既存データの移行・削除・本番SQL実行は未実施。

## 確認した現行構成

GitHub基準：HOME稼働用 `feat/home-auth-foundation` の `9cf5cb27197e851d91a5e9f9146da76cf9fc1dbb`。提供されたcalendar-workerのコードは空白を正規化すると一致。mainは別の開発が進行しているため、HOMEブランチと混同しない。

利用者が2026-10-11に提供したDashboardのBindings、R2設定、D1 CREATE TABLE一覧を照合。home-dbは既存36業務テーブル、calendar-dbは13業務テーブル（_cf_KV・d1_migrationsを除く）。スキーマだけを確認し、実レコード・本番件数・本番バックアップは未確認。

| Worker | 種類 | 変数 | 接続先 |
| --- | --- | --- | --- |
| home-worker | Assets | ASSETS | Assets |
| home-worker | Service | CALENDAR_SERVICE | calendar-worker |
| home-worker | Service | LEGACY_BANK_SERVICE | mama-bank-api |
| home-worker | Service | LEGACY_CHORE_SERVICE | otetsudai-api |
| home-worker | D1 | DB | home-db（fed5c0be-51b5-486f-935f-58678481f2a9） |
| home-worker | D1 | LEGACY_DB | mama-bank-db（17c4957a-fb76-44f9-a909-3f343049aeb3） |
| home-worker | R2 | PRIVATE_FILES | home-private。Public Access Disabledを確認 |
| calendar-worker | D1 | DB | calendar-db。DB UUIDは未確認 |
| calendar-worker | Service | HOME_AUTH | home-worker |
| calendar-worker | Service | NOTIFICATION_API | notification-center-api |
| wagaya-album-api | D1 | DB | wagaya-album-db。DB UUIDは未確認 |
| wagaya-album-api | R2 | ALBUM_MEDIA | wagaya-album-media。公開設定は未確認 |

通知用のNOTIFICATION_API_URL・NOTIFICATION_APP_PASSWORDの本番設定値、全Worker一覧、Cloudflareの最新Version ID・ビルド設定・ルートは未確認。Secret値を管理資料へ記載しない。

## カレンダー

既存 calendars/calendar_events を変更せず、公開設定を追加テーブルに保存する。追加設定のない既存カレンダー／予定は従来の家庭・所有者ルールを維持。予定のタイトル・所有者・日付・繰り返し・履歴を一括変換しない。

「全員」は利用者確認により **そのカレンダーの参加者全員**。HOMEの全登録者ではない。参加者は所有家庭のメンバーと、共有の申し出を家庭のowner/adminが承認した別家庭のメンバー。新しい家庭がHOMEへ招待されただけでは既存予定を閲覧できない。

カレンダー公開範囲：参加者全員／所有家庭／指定メンバー／所有者のみ。登録権限：閲覧できる参加者全員／指定メンバー／所有者のみ。設定変更は所有者。予定の変更・削除は登録した本人かつ現在の登録権限がある人のみ。所有者も他人の予定を変更しない。

予定の公開範囲：カレンダーに従う／大人／指定メンバー／本人のみ。本人はカレンダーを閲覧できる限り自分の予定を閲覧できる。予定公開範囲はカレンダー閲覧権限と常にANDで判定する。APIで判定してから繰り返し展開し、拒否された予定のID・件名・詳細を返さない。一日だけの変更は予定と例外日と公開設定をD1.batchで保存する。

「誰の予定か」は HOME user ID を subject_user_id に保存。表示名はHOME本名／home_person_namesのニックネームから取得し、タイトルを書き換えない。home_person_aliasesは将来の閲覧者別の呼び名用で、今回のUIでは未使用。

家庭間共有は申し出→受信家庭の管理者が「共有の招待」から許可。取消後に再招待する場合も改めて承認が必要。最初のUIは家庭IDを入力する方式。招待ユーザーや他家庭を今回勝手に作成しない。

### 通知

旧通知センターは固定受信者の方式で、新しい公開権限を理解しない。このため共有設定を追加したカレンダー、個別公開設定／subjectを追加した予定は旧通知を停止する。既存設定なしの通知は維持。新しいHOME権限による通知配信は別作業。

公開範囲の変更前に旧通知を削除し、通知の発行と設定保存をカレンダー単位のD1ロックで直列化する。旧通知の停止に失敗した場合は設定変更を503で停止。通知APIへ新しい非公開件名を送らない。

異常終了で home_calendar_notification_locks が残る場合はfail-closedとなる。自動の期限切れ解除はしない。管理者は該当リクエストが終了していること・通知処理状況を確認し、バックアップしてから対象calendar_id/tokenのロックだけ解除する。他テーブルを削除したり一括解除しない。

## 家系図

専用Workerを増やさず home-worker＋home-db＋非公開home-privateで実装。家庭のHOME認証とアプリ利用権限、家庭membershipを毎リクエスト検証。R2オブジェクトキーや公開URLは返さず、/api/family-tree/photos/{id}?household={id} で認証付き配信（no-store）。

家庭ごとに独立した人物・関係グラフ。同じ人物をHOME user IDに明示連携した場合、ログイン本人を続柄の基準にする。中心人物の選択と続柄の基準人物は別。血縁／養子／育てる人／婚姻／パートナー／兄弟姉妹、離婚・終了・不明、開始／終了日を保存。親子の循環を拒否。人物・関係に人数や世代数の固定列を設けない。

不明な項目は空欄。生年月日・命日は年だけ・年月・年月日を許可。年齢や姉妹の上下関係が不明なら推測しない。大人／子どもを氏名や管理ロールから推測しない。初期値unknownは閲覧のみ。家庭owner/adminまたは運営者が明示設定できる（既にchildと設定された本人は管理設定不可）。adultだけ人物・関係・写真の変更／ごみ箱／バックアップ／復元を利用できる。

人物・関係はsoft delete。人物の削除に伴う関係を記録し、関係先の人物が有効なら復元できる。revisionをD1.batchのCHECKガードで確認し、同時更新は409で止める。写真は元オブジェクトを削除せず、新しい保存先で復元する。

バックアップ：大人の「バックアップ」で家庭の人物・関係（ごみ箱含む）＋使用写真をJSONに保存。復元は同じ家庭のファイルのみ。UIが現状バックアップをダウンロードしてから確認済みファイルを送信し、サーバーもconfirm_replaceとrevisionと家庭を検証する。写真1枚2MB、写真合計20MB、送信JSON30MB、復元処理最大900 SQL文の運用上限あり。人数・世代の固定モデルとは異なる。バックアップは個人情報を含むため安全な場所に保管する。

### 旧アルバムの再利用判断

提供された旧アルバムWorkerには、/api/album/files/{id}をauthより先に処理する経路がある。R2が非公開でもこのWorker経由の画像取得が認証付きとはいえない。X-Album-Keyの既存共有キーを家系図の写真URLに使わない。今回、旧アルバムの動作・保存データ・Workerは変更していない。家系図は既存のHOME用非公開R2を利用し、旧アルバム写真の参照／コピーは認証方式・家庭権限を確認してから別途実装する。Markdownで受け取ったアルバムコードはエスケープされているため、そのままデプロイしない。

## 導入前の手順（まだ未実施）

1. 本番のhome-db/calendar-dbのDBエクスポートを保存。calendar-dbのcalendars/calendar_eventsの件数、HOMEの既存つうちょう・ポイント等の関連テーブル件数を保存する。R2既存オブジェクトの一覧も控える。実データをGitへ保存しない。
2. HOME稼働ブランチ、Cloudflareビルドと手動calendar-worker更新順序を利用者に確認。別のmain変更をHOMEへまとめて取り込まない。
3. 許可後、作業ブランチの変更だけをHOMEブランチへ適用し、通常のhome-db migrations apply→home-worker deploy。0013_family_tree.sqlは追加テーブル・アプリの追加のみ。既存残高・予定を移し替えない。
4. calendar-worker全文を作業ブランチから反映。既存DB/HOME_AUTH/NOTIFICATION_API/既存Secretは保持。新テーブル5個はWorkerが初回HOMEアクセス時にIF NOT EXISTSで作成する。同一SQLを管理用migrationsにも保存。HOMEが新公開設定を送る場合はWorkerのACL versionを検証し、旧Workerが公開設定を無視することを防ぐ。
5. 移行前後の既存テーブル件数を照合。calendarのDB全件エクスポートとバックアップを保存し、既存予定のタイトル・日付・所有者・繰り返しを確認する。
6. HOMEから家系図を開き、管理者が大人／子ども区分を確認して設定。本人の人物を追加してHOMEの本人を紐づけ、親子関係を明示入力する。名前から関係を自動推測しない。
7. ママ・子ども・別家庭・未ログイン、Safari・ホーム画面起動で実機確認。まず既存家庭だけで確認し、他家庭の実登録や既存アルバム移行は別の確認後。

公開URL（反映後）：カレンダー https://cetus.fun/wagaya/apps/calendar/ 、家系図 https://cetus.fun/wagaya/apps/family-tree/ 。現時点では新機能の本番利用可能とは扱わない。

## 検証と残り

TypeScript check、Wrangler dry-run、node --check、Miniflareの認証・D1・R2・Service bindingの統合テストを実施。既存14件＋追加3件＝17件成功。新しい予定の件名／詳細／IDが子ども・別家庭へ返らないこと、参加の双方許可、取消後の再許可、登録者のみ変更、一日だけの繰り返しと公開設定の維持、通知失敗時に変更を止めることを検証。家系図の本人基準、任意世代、大人のみ編集、家庭・写真の隔離、ごみ箱復元、バックアップと復元、同時更新409、旧アカウント件数維持を検証。

未完了：本番のバックアップと件数照合、実デプロイ、Safari／ホーム画面でのスマホ実機・見た目確認、家庭間共有の実ユーザー運用、旧アルバム写真の安全な再利用、閲覧者別呼び名のUI、新公開権限対応の通知配信。ローカルテストを本番・実機確認済みと表現しない。
