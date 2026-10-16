# Worker対応表

調査日：2026-10-09、追加照合：2026-10-11。GitHubと利用者提供のDashboard／スキーマを確認。提示されたBindingsは下記に反映。Cloudflareアカウントの全Worker一覧・公開ルート・Secret値・最新デプロイは未確認です。コードに参照があるWorkerだけを列挙し、アカウント全件とは扱いません。

| Worker名 | 担当アプリ／API | D1 | R2 | ソース・確認範囲 |
| --- | --- | --- | --- | --- |
| home-worker | HOME、つうちょう、HOME版筋肉貯金、食事チェック、カレンダープロキシ、遊ぶやくそく入口。/api/*、/media/*、/apps/* | DB→home-db、LEGACY_DB→mama-bank-db | PRIVATE_FILES→home-private | [cloudflare/home-worker/wrangler.jsonc](https://github.com/sizuku-slowdays/kids-app/blob/9cf5cb27197e851d91a5e9f9146da76cf9fc1dbb/cloudflare/home-worker/wrangler.jsonc)。設定と2026-10-11の提供Bindingsを確認。最新Version／公開ルート未確認 |
| calendar-worker | 家族カレンダー、からだカレンダー。https://calendar-worker.sslowdayss.workers.dev。HOMEからCALENDAR_SERVICEで呼出 | DB→calendar-db（2026-10-11提供設定）。DB ID：未確認 | このソースではR2 binding使用を確認できない。実設定：未確認 | [cloudflare/calendar-worker/calendar-worker.js](https://github.com/sizuku-slowdays/kids-app/blob/9cf5cb27197e851d91a5e9f9146da76cf9fc1dbb/cloudflare/calendar-worker/calendar-worker.js)。設定ファイルなし。HOME_AUTH接続が必要 |
| mama-bank-api | 旧銀行、家計簿、学校記録、日記、ビンゴ等。https://api.cetus.fun/api/* | env.DB使用。HOME側の旧DB参照はmama-bank-db。旧Workerの実binding先：未確認 | ソース上R2使用未確認。実設定：未確認 | [cloudflare/home-worker/legacy-retirement/mama-bank-api.js](https://github.com/sizuku-slowdays/kids-app/blob/9cf5cb27197e851d91a5e9f9146da76cf9fc1dbb/cloudflare/home-worker/legacy-retirement/mama-bank-api.js)と同READMEでWorker名・APIを対応付け |
| otetsudai-api | 旧お手伝い・ポイント・交換商品。https://otetsudai-api.sslowdayss.workers.dev/api/* | env.DB使用。実DB名・旧銀行と同一DBか：未確認 | 商品画像はrewards.image_url（data URL等）。商品画像用R2は旧実装にない | [cloudflare/home-worker/legacy-retirement/otetsudai-api.js](https://github.com/sizuku-slowdays/kids-app/blob/9cf5cb27197e851d91a5e9f9146da76cf9fc1dbb/cloudflare/home-worker/legacy-retirement/otetsudai-api.js)、REWARD_IMAGES.md |
| wagaya-album-api | アルバム。https://wagaya-album-api.sslowdayss.workers.dev | DB→wagaya-album-db（2026-10-11提供設定） | ALBUM_MEDIA→wagaya-album-media（同日提供設定）。公開設定未確認 | [wagaya/album/config.js](https://github.com/sizuku-slowdays/kids-app/blob/7afd93235cc6f4cfec2568e07819a028a95789a9/wagaya/album/config.js)、app.js。API側ソースはkids-appツリーに見つからない。2026-10-11の提供コードを調査。画像配信が認証前に分岐するため家系図ではそのURLを流用しない |
| notification-center-api | 通知センター・薬・学校／矯正からの通知。https://notification-center-api.sslowdayss.workers.dev | 未確認 | 未確認 | [kanriapp/notification-center.html](https://github.com/sizuku-slowdays/kids-app/blob/7afd93235cc6f4cfec2568e07819a028a95789a9/kanriapp/notification-center.html)。API側ソース・設定未確認 |
| iikoto-api | いいこと記録／管理。https://iikoto-api.sslowdayss.workers.dev | 未確認 | 未確認 | kanriapp/iikoto1.html、iikoto2.html、iikoto-admin.htmlで参照。API側未確認 |
| bar-api | 幻水酒場。https://bar-api.sslowdayss.workers.dev | 未確認 | 未確認 | mainのbar/index.htmlで参照。API側未確認 |
| rain-proxy | 草原のレイン。https://rain-proxy.sslowdayss.workers.dev | 未確認 | 未確認 | mainのbar2/index.htmlで参照。API側未確認 |
| rain-v2-proxy | 草原のレインv2。https://rain-v2-proxy.sslowdayss.workers.dev | 未確認 | 未確認 | mainのbar3/rain-v2.htmlで参照。API側未確認 |
| haro | はろーぼくじょう。https://haro.sslowdayss.workers.dev/api/chat | 未確認 | 未確認 | mainのharo/hello-bokujou.htmlで参照。API側未確認 |
| muscle-bank-worker | 独立版用の認証アダプター案。/api/muscle-bank | DB→muscle-bank-db。ただしIDがREPLACE_WITH_NEW_D1_ID | PHOTOS→muscle-bank-private（設定上の予定） | [cloudflare/muscle-bank-worker/wrangler.jsonc](https://github.com/sizuku-slowdays/kids-app/blob/7afd93235cc6f4cfec2568e07819a028a95789a9/cloudflare/muscle-bank-worker/wrangler.jsonc)。設定未完成。本番利用・リソース作成は未確認。HOME版と混同しない |
| 未確認（からだパワーAPI） | cetus.fun/api/karada-power（端末トークン使用） | UIにD1接続実装あり。DB名未確認 | 未確認 | [karada_power/app.js](https://github.com/sizuku-slowdays/kids-app/blob/7afd93235cc6f4cfec2568e07819a028a95789a9/karada_power/app.js)。URLからWorker名を推測しない |

## home-workerの接続と公開経路

| 設定項目 | GitHubで確認できた値 |
| --- | --- |
| エントリー | src/index.ts、compatibility_date=2026-10-01、nodejs_compat |
| 静的Assets | public、binding=ASSETS、run_worker_first=true |
| ルート | cetus.fun/wagaya/*、asobu.cetus.fun（custom_domain） |
| workers.dev | workers_dev=true |
| サービス | CALENDAR_SERVICE→calendar-worker、LEGACY_BANK_SERVICE→mama-bank-api、LEGACY_CHORE_SERVICE→otetsudai-api |
| 定期実行 | 15 18 * * *／0 15 * * *（UTC）。handlerはお手伝い進行と認証試行／期限切れセッションの掃除 |
| HOMEビルドの文書上の手順 | feat/home-auth-foundation、Root directory=cloudflare/home-worker、Deploy command=npx wrangler d1 migrations apply home-db --remote && npx wrangler deploy |

Build接続ブランチ・Root directory・Preview builds・実際のcron登録はDashboard未確認。READMEの手順と本番設定を区別してください。

calendar-workerはHOME_AUTH→home-workerを使用。通知連携はNOTIFICATION_API、NOTIFICATION_API_URL、NOTIFICATION_APP_PASSWORDをソースで参照していますが、接続先NOTIFICATION_API→notification-center-apiは2026-10-11提供設定で確認。URL・Secret値は未確認です。

`asobu.cetus.fun`はhome-worker内で外部Sitesへ代理転送する別経路です。HOMEアカウントのデータが外部サービスへ一体化しているとは扱いません。

## 反映方法と注意

HOMEはGitビルド用設定あり。calendar-workerと旧銀行／旧お手伝い2本はREADMEにDashboardへの全文配置手順あり。コミット成功だけでは手動Workerの反映完了としません。

旧2本のHOME_PASSBOOK_MIGRATED=1は対象銀行／ポイント経路を停止するゲートです。家計簿など他のapp-data利用経路まで停止する設定ではありません。現在の実設定値は未確認。稼働後にゲートを戻して二重管理しないでください。

## 2026-10-11 Dashboard提供情報で確認できた接続

home-workerのASSETS、CALENDAR_SERVICE→calendar-worker、LEGACY_BANK_SERVICE→mama-bank-api、LEGACY_CHORE_SERVICE→otetsudai-api、DB→home-db、LEGACY_DB→mama-bank-db、PRIVATE_FILES→home-privateを確認。home-privateはPublic Access Disabled。calendar-workerはDB→calendar-db、HOME_AUTH→home-worker、NOTIFICATION_API→notification-center-api。wagaya-album-apiはDB→wagaya-album-db、ALBUM_MEDIA→wagaya-album-media。DB UUID・未提示Secret・全Worker一覧等は[確認構成](https://github.com/sizuku-slowdays/kids-app/blob/feature/calendar-family-tree-20261011/docs/main-work/calendar-family-tree.md)に明記。

家系図はhome-worker内へ追加し、新規Worker/R2/別D1は作成しない。本番反映は未実施。

2026-10-11追加調整：新公開範囲が旧通知方式で扱えない対象だけ停止。既存通知と従来共有＋表示名のみの変更は継続。通知設定は保持し、停止理由を分離。新しいBinding・DB・R2の追加要求はない。本番未反映。


### 2026-10-12：notification-center-api（利用者提供コード・Bindings確認）
DB → notification-center-db。HOME_AUTH → home-workerを利用者が追加済み。HOME側のNOTIFICATION_SERVICE → notification-center-apiは今回Wrangler設定へ追加。既存Cron/VAPID/APP_PASSWORDを維持する手動Deploy方式。新コードは cloudflare/notification-center-api/notification-center-api.js。DB追加はHOME端末本人リンクのみ。Worker本番反映・実機通知は未確認。


### 2026-10-12：外食料金のWorker・保存先
既存home-worker内の /api/dining-prices と /apps/dining-prices/ を追加。DB=home-db、binding=DB。D1追加テーブル dining_price_states：household_id・stores_json・revision・updated_by・updated_at。新Worker/新D1/R2/Bindings/Secretsの追加なし。既存Gitビルドの migrations apply → deploy により0015_dining_prices.sqlを適用する。


### 2026-10-12：単品注文メニューの保存・初回追加
新Worker/Binding/R2なし。home-worker + home-db継続。0016_dining_order_imports.sqlで dining_price_imports（家庭別・取込版の一意印）、dining_price_backups（追加前の料金JSON・revision）を追加。既存JSONへ店舗を追記する前にD1内へスナップショット退避し、revision条件で競合時の上書きを防止する。元の焼肉ウエスト・ユーザー追加店舗はそのまま保持。取込済みの店を編集/削除しても再シードしない。バックアップの中身は公開リポジトリへ保存しない。


通知Worker追加テーブル：home_notification_only_endpoints（HOME専用端末の配信区分）。初回CREATE IF NOT EXISTS、既存push_subscriptionsをALTER/削除しない。recipientの実DB制約に対応。

### 2026-10-14：まいにち漢字3文字
home-workerに /api/daily-kanji と /apps/daily-kanji/ を追加。既存DB binding（home-db）のみ利用し、Worker・R2・Service binding・Cron・Secretsの追加なし。0017_daily_kanji.sqlで新規4テーブルを追加。既存の自動BuildのD1 migrations applyで反映する。既存のカレンダー/通知Workerの貼り替えは不要。



## 2026-10-15 つうちょう現金機能

home-worker/home-db/PRIVATE_FILESを継続利用。0018で10表と報酬トリガー拡張。既存Cron2本を保ち毎時05分の金融ジョブを追加。新Worker・Secretなし。作業ブランチのみ、本番反映なし。 詳細は[設計・検証・反映手順](passbook-cash-20261015.md)。

## 2026-10-15 キッズ一覧といいことポイント

新いいことは既存home-worker/home-dbへgood_deed_*3表で独立。新Worker/bindingは不要。旧HTMLの接続先iikoto-apiは確認できるが、Workerコード・実DB名・認証は未確認。旧API保護とバックアップまで切替保留。 [詳細と残作業](good-deeds-20261015.md)。


## 2026-10-16 00時台 JST 確認更新（上記の保留状態を更新）

つうちょうPR4は2a83a28で統合し、10月15日18:01の自動デプロイ成功を利用者が確認。変更前後の全既存passbook行照合はok=true/issues=[]。本人の大人現金口座作成・お手伝い報酬も利用者確認済み。お小遣い5回設定・利息ONの利用者報告あり。おさいふは利用者希望で後回し。10月14日3件の補填は根拠不足のため未処理を継続。初回月次自動処理は未確認。

旧いいことWorkerの提示コードはGET/POST/DELETEのiikoto_records操作のみ、owner固定コード照合でHOME認証なし。DashboardのDB bindingはmama-bank-dbと利用者確認。旧記録を残し、新しいgood_deed_*台帳を0開始する方式を維持。10月16日00:17、旧DBのiikotoテーブル確認・最新home-dbエクスポートと整合性・両バックアップハッシュ保存がすべてOKとの利用者報告。本番移行は未実施。

今回の統合は0018金融機能と0019いいことの両方を保持する。旧API保護・新画面の本番反映・実アカウント権限確認・旧リンク切替は残作業。旧DBやつうちょうへのリセットは実施しない。


## 2026-10-16 学校じゅんび（準備）

既存home-workerとnotification-center-apiを拡張。home-dbへ0020で5表、notification-center-dbへschool_push_deliveries 1表。新Binding/Secret/Cronなし。既存通知ルール/購読を更新しない。導入前に現行通知コード一致確認と両DBバックアップが必要。 詳細：[仕様・試験・導入ゲート](school-prep-20261016.md)。


## 2026-10-16 学校準備：登校日の既定値・宿題初期項目

- 通知Worker更新完了、HOME PR8のBuild成功（12:13）と実際の段階全完了通知到着を利用者が確認。通知DB前後照合ok、既存通知4表不変。HOME照合の家系図・user_apps差分は利用者が実操作を報告。つうちょう・いいことポイントは照合上不変。祖母登録人物の表示問題は別件として未解決。
- 今回の修正：次の登校日は月〜金を既定とし、登録済みの各日最新版の登校日／休み指定を優先。土曜授業は指定可能。未来の遠い登録が直近平日を飛ばさない。祝日・振替休日・長期休みの自動判定は未実装、保護者が各日を休みにして確定する。
- 夜の表示日・APIのチェック許可日を同じ判定に統一。未登録なら持ち物は未登録のまま、DBへ仮予定を作らない。新規日付の登校日チェックも平日のみ既定ON。
- 宿題新規入力欄に漢字：／計算：／音読：を初期表示。既存版は上書きしない。項目名だけの空行は確定対象から除外。
- DBマイグレーション・通知Worker・Cron・既存データの変更なし。HOMEのコード更新のみ。
- 検証：TypeScript、Wrangler dry-run、学校準備API統合、曜日・例外単体、DOM（初期項目・空項目除外・既存内容保持）合格。本修正の本番Build・実機確認は未確認。


## 2026-10-16 ごほうびプレゼント（本番未反映）

HOMEの0021追加3表/2view、通知DBにgift_push_deliveries追加SQL、通知Workerの専用内部送信を準備。新Binding/Secret/Cron式なし。既存HOME Cronでは金融処理後に未送信を再試行。 [設計・テスト・導入ゲート](passbook-gifts-20261016.md)。
