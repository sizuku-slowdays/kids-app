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


## 2026-10-16 反映・利用者確認（最新状態）

- つうちょう：PR4/2a83a28を10月15日18:01に本番反映。全既存passbook行照合はOK。本人の大人現金口座・お手伝い報酬、お小遣い5回設定・利息ONを利用者確認。おさいふは後回し。10月14日3件の補填は実記録不足で未処理。初回月次自動処理は未確認。
- いいこと：PR5/8389d7aを10月16日00:28に本番反映したBuild成功を利用者確認。最新バックアップとのpassbook全行照合は変更なし。保護者画面で姉妹のHOME表示名・選択・0開始を利用者確認。子ども本人ログイン/実モバイル操作は追加確認待ち。
- 旧保存先：利用者提示のiikoto-apiコードはDBのiikoto_recordsを操作し、固定owner文字列照合のみ。DashboardでDB→mama-bank-dbを確認。旧SQLと最新home-dbのバックアップ/整合性/SHA256保存は利用者PCで完了。実データを公開リポジトリへ置かない。
- 旧API：DBを一切参照しない410応答コードへの切替を00:45に利用者が完了報告。こちらのHTTP試験は実行環境から403となり、実際の410応答は独立確認できていない。旧DBは削除/リセットしない。
- 一覧：PR6で旧2いいことカードをgood-deeds 1枚へ統合し、旧iikoto1/2を /wagaya/apps/good-deeds/ へ転送。旧銀行/旧ポイントの削除と新つうちょうを維持。他アプリの全フィールド不変更を検証。Pagesの反映は利用者確認待ち。
- 引き続き保留：学校準備・英語フラッシュはPR7の準備コード（本番未統合）。デモアカウント案も保留。ポイント付与ルールなど未決定仕様を本番へ確定しない。


## 2026-10-16 学校準備の再開位置

[PR8](https://github.com/sizuku-slowdays/kids-app/pull/8)、[仕様・導入ゲート](https://github.com/sizuku-slowdays/kids-app/blob/3c49b905e451bc6b06bae5d3f08dab5cebf2814d/docs/main-work/school-prep-20261016.md)に手入力版を実装して保存。利用者がAI後回し・各段階の全完了通知・30登校日の集計先行を選択。HOME認証と家庭/児童権限、保護者の版付き確定、本人の宿題/夜/朝チェックと赤ハンコ、本人のHOME端末への通知を追加。既存台帳・時間割・カレンダー通知設定は変更しない。HOME5表＋通知専用1表を新設する案で、新Cron/Secret/Bindingなし。

TypeScript、dry-run、関連22テスト、通知単体、DOM、旧データ保持/同件数改変検知に合格。本番は未反映。両DBの新しいバックアップ・通知Workerソース保存/照合から再開する。通知SQL/Worker→HOME反映→前後照合→実機確認の順。AI・ランク/報酬・英語PR7は保留。いいことの一覧と旧API停止応答は01:11の利用者報告で確認済み。子ども本人ログインでの実機権限確認は残る。つうちょう10/14補填は根拠不足で保留、おさいふ後回しを維持。


## 2026-10-16 学校準備の反映と曜日修正

学校準備PR8はHOMEへ統合、利用者が12:13 Build成功・本人の全完了通知受信を確認。通知DB前後照合ok、つうちょう／いいことポイント不変。家系図とHOME表示設定の差分は利用者による操作報告あり。祖母登録人物の表示問題は別途未解決。

HOME修正 [76195b2](https://github.com/sizuku-slowdays/kids-app/commit/76195b24741ce7de26d8351c98e1fc17cb744a6c)：夜の対象日は月〜金既定＋各日最新版の明示登校日／休み指定を優先。土曜授業対応、金曜→月曜。祝日・振替休日・長期休みは保護者が休みに設定。未登録日は内容未登録表示で仮予定は保存しない。新規宿題欄は漢字：／計算：／音読：、空の項目名は登録対象外、既存宿題は保持。DB・通知Worker・Cron変更なし。TypeScript／dry-run／曜日単体／学校準備API／DOMテスト合格。修正版Buildと実機確認は未確認。AI抽出・ランク／ポイント付与・英語は引き続き未反映。


## 2026-10-16 プレゼント申請：準備完了・本番待ち

HOMEの0021追加3表/2view、通知DBにgift_push_deliveries追加SQL、通知Workerの専用内部送信を準備。新Binding/Secret/Cron式なし。既存HOME Cronでは金融処理後に未送信を再試行。 [PR9](https://github.com/sizuku-slowdays/kids-app/pull/9)、[固定版の設計・試験・導入手順](https://github.com/sizuku-slowdays/kids-app/blob/350128ab01665a6a8bf9520bd0ce09a990ba9e3f/docs/main-work/passbook-gifts-20261016.md)。HOME本番ブランチへは未統合、SQL・Workerは未反映。


## 2026-10-16 ごほうびプレゼント：本番反映・利用者確認済み

PR9はHOMEへ統合済み（665da2e8537f64fcffa56cbf80fc38cc6659a470）。通知DB追加SQL・通知Worker更新完了、13:52のHOME Build成功（Version cd42c5d0-18c7-453f-836e-f1499317ca45）を利用者報告。13:55、最新バックアップとの前後照合はHOME・通知DBともすべてOK、既存データ・通知設定不変との結果。14:01、保護者への申請通知と承認後の加算の両方を利用者が確認し、問題なさそうと報告。これにより前述の本番反映・前後照合・基本実機確認待ちは解消。却下・複数端末・全ユーザー組合せの本番試験は未確認（権限・却下・再試行・重複はローカル試験済み）。別家庭共有・受渡し/精算・家計簿連携は引き続き未実装。


## 2026-10-16 通帳表示・A4印刷：独立準備・本番待ち

HOMEへ読み取り専用book APIと認証済み静的ページを準備。DBマイグレーション・通知Worker・Cron・Binding・Secret・R2変更なし。HOME Git Buildのみ反映待ち。 [PR10](https://github.com/sizuku-slowdays/kids-app/pull/10)、[固定版の仕様・検証・導入手順](https://github.com/sizuku-slowdays/kids-app/blob/0565653f263f4f7d9ce882edf02926a9dd535160/docs/main-work/passbook-book-20261016.md)。本番統合は最新home-dbバックアップの読み取り専用監査待ち。DB変更・通知Worker更新不要。
