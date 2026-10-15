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



## 2026-10-15 キッズ一覧といいことポイント

新いいことは既存home-worker/home-dbへgood_deed_*3表で独立。新Worker/bindingは不要。旧HTMLの接続先iikoto-apiは確認できるが、Workerコード・実DB名・認証は未確認。旧API保護とバックアップまで切替保留。 [詳細と残作業](good-deeds-20261015.md)。
