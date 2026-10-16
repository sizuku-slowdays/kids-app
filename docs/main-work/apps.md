# アプリ一覧

調査日：2026-10-09。版・確認区分は[台帳入口](README.md)参照。URLはコード／設定に基づく入口です。全件の本番疎通・利用中かどうかは未確認です。

## 主なアプリ

| 名前 | URL | GitHubリポジトリ・主な関連パス | 現在の状態 |
| --- | --- | --- | --- |
| 我が家 HOME | [https://cetus.fun/wagaya/](https://cetus.fun/wagaya/) | kids-app / [cloudflare/home-worker/](https://github.com/sizuku-slowdays/kids-app/tree/9cf5cb27197e851d91a5e9f9146da76cf9fc1dbb/cloudflare/home-worker/) | HOME認証・表示・設定の実装あり。利用者からログイン／ホーム画面利用の報告あり。現在の本番版は未確認 |
| つうちょう | [https://cetus.fun/wagaya/apps/passbook/](https://cetus.fun/wagaya/apps/passbook/) | kids-app / [cloudflare/home-worker/src/passbook.ts](https://github.com/sizuku-slowdays/kids-app/blob/9cf5cb27197e851d91a5e9f9146da76cf9fc1dbb/cloudflare/home-worker/src/passbook.ts) | 銀行＋お手伝いポイント統合の実装あり。利用者から運用開始の報告あり。実DB残高・最新版反映は未確認 |
| カレンダー | [https://cetus.fun/wagaya/apps/calendar/](https://cetus.fun/wagaya/apps/calendar/) | kids-app / [cloudflare/home-worker/src/calendar.ts](https://github.com/sizuku-slowdays/kids-app/blob/9cf5cb27197e851d91a5e9f9146da76cf9fc1dbb/cloudflare/home-worker/src/calendar.ts) | HOME本人連携・共有予定の投稿／登録者のみ編集の実装あり。最新calendar-workerの手動反映は未確認 |
| 筋肉貯金（HOME版） | [https://cetus.fun/wagaya/apps/muscle-bank/](https://cetus.fun/wagaya/apps/muscle-bank/) | kids-app / [cloudflare/home-worker/src/muscle-bank.js](https://github.com/sizuku-slowdays/kids-app/blob/9cf5cb27197e851d91a5e9f9146da76cf9fc1dbb/cloudflare/home-worker/src/muscle-bank.js) | 本人限定のクラウド保存・画像・日替わり運動の実装あり。本番の実データは未確認 |
| じいちゃん／ばあちゃん | [https://cetus.fun/wagaya/apps/kidney/](https://cetus.fun/wagaya/apps/kidney/) | kids-app / [cloudflare/home-worker/src/kidney.ts](https://github.com/sizuku-slowdays/kids-app/blob/9cf5cb27197e851d91a5e9f9146da76cf9fc1dbb/cloudflare/home-worker/src/kidney.ts) | person=grandpa／grandmaで食事記録を分離。家庭共有。実機確認は未確認 |
| 遊ぶやくそく（HOME入口） | [https://cetus.fun/wagaya/apps/play-agreement/](https://cetus.fun/wagaya/apps/play-agreement/) | kids-app / [cloudflare/home-worker/public/apps/play-agreement/](https://github.com/sizuku-slowdays/kids-app/tree/9cf5cb27197e851d91a5e9f9146da76cf9fc1dbb/cloudflare/home-worker/public/apps/play-agreement/) | HOME認証付きの管理入口。外部Sitesの管理画面へ接続。外部サービスの内部実装は未確認 |
| 家計簿 | [https://cetus.fun/kanriapp/kakeibo-index.html](https://cetus.fun/kanriapp/kakeibo-index.html) | kids-app / [kanriapp/kakeibo-index.html](https://github.com/sizuku-slowdays/kids-app/blob/7afd93235cc6f4cfec2568e07819a028a95789a9/kanriapp/kakeibo-index.html) | 入力・一覧・予算・固定費・資金繰りの静的ページあり。HOME共通認証への移行完了は確認できない |
| アルバム | [https://cetus.fun/wagaya/album/](https://cetus.fun/wagaya/album/) | kids-app / [wagaya/album/app.js](https://github.com/sizuku-slowdays/kids-app/blob/7afd93235cc6f4cfec2568e07819a028a95789a9/wagaya/album/app.js) | IndexedDB＋専用API方式。アクセスキー使用。HOME共通認証・データ共有権限への移行完了は未確認 |
| 通知センター | [https://cetus.fun/kanriapp/notification-center.html](https://cetus.fun/kanriapp/notification-center.html) | kids-app / [kanriapp/notification-center.html](https://github.com/sizuku-slowdays/kids-app/blob/7afd93235cc6f4cfec2568e07819a028a95789a9/kanriapp/notification-center.html) | 専用API・合言葉・端末登録の方式。HOME共通認証への移行完了は未確認 |
| 時間割 | [https://cetus.fun/wagaya/timetable.html](https://cetus.fun/wagaya/timetable.html) | kids-app / [wagaya/timetable.html](https://github.com/sizuku-slowdays/kids-app/blob/7afd93235cc6f4cfec2568e07819a028a95789a9/wagaya/timetable.html) | 旧app-data方式、4年生／2年生を固定表示。先週／今週あり。人数可変の新HOME版は未実装 |
| からだパワー | [https://cetus.fun/karada_power/](https://cetus.fun/karada_power/) | kids-app / [karada_power/app.js](https://github.com/sizuku-slowdays/kids-app/blob/7afd93235cc6f4cfec2568e07819a028a95789a9/karada_power/app.js) | 端末保存＋端末トークンでクラウド接続する実装あり。APIのWorkerソース／実DB名は未確認 |
| 筋肉貯金（端末版） | [https://cetus.fun/muscle-bank/](https://cetus.fun/muscle-bank/) | kids-app / [muscle-bank/storage.js](https://github.com/sizuku-slowdays/kids-app/blob/7afd93235cc6f4cfec2568e07819a028a95789a9/muscle-bank/storage.js) | IndexedDB保存。HOME版と別保存先。自動同期ではない |
| からだカレンダー | [https://cetus.fun/kanriapp/karada_calendar.html](https://cetus.fun/kanriapp/karada_calendar.html) | kids-app / [kanriapp/karada_calendar.html](https://github.com/sizuku-slowdays/kids-app/blob/7afd93235cc6f4cfec2568e07819a028a95789a9/kanriapp/karada_calendar.html) | calendar-workerのperiod系API、旧認証のまま。HOME連携カレンダーとは別機能 |
| 学習・ゲーム／プリント | [https://cetus.fun/kids-app/](https://cetus.fun/kids-app/) | kids-app / [kids-app/index.html](https://github.com/sizuku-slowdays/kids-app/blob/7afd93235cc6f4cfec2568e07819a028a95789a9/kids-app/index.html) | 静的ページ多数。maker／wagaya/keisan／quiz-labにもあり。全件は下表 |

`home-worker.sslowdayss.workers.dev`のHOMEも設定上有効。cetus.funとはCookieのホストが異なるため、ログイン状態が自動共有される前提にしません。旧入口`/kanriapp/calendar.html`はmainでHOME入口へ誘導する変更履歴があります。

## mainの静的HTML全件（diaryを除く）

調査した89ファイルを列挙します。名前はHTMLのtitle。バックアップ／試験／別版を含むので、全件を現役アプリとみなしてはいけません。ソースがあることを確認した一覧であり、公開中・利用中・正常稼働は未確認です。外部JS側のAPIがある場合、HTMLだけでは表示されません。

| 名前（title） | 想定URL／ソース | リポジトリ | コード上の区分・本番状態 |
| --- | --- | --- | --- |
| 幻水酒場 | [開く](https://cetus.fun/bar/index.html) / [bar/index.html](https://github.com/sizuku-slowdays/kids-app/blob/7afd93235cc6f4cfec2568e07819a028a95789a9/bar/index.html) | kids-app / main | 静的HTMLあり。本番・利用状況：未確認 |
| 草原のレイン | [開く](https://cetus.fun/bar2/index.html) / [bar2/index.html](https://github.com/sizuku-slowdays/kids-app/blob/7afd93235cc6f4cfec2568e07819a028a95789a9/bar2/index.html) | kids-app / main | 静的HTMLあり。本番・利用状況：未確認 |
| 草原のレイン v2 | [開く](https://cetus.fun/bar3/index.html) / [bar3/index.html](https://github.com/sizuku-slowdays/kids-app/blob/7afd93235cc6f4cfec2568e07819a028a95789a9/bar3/index.html) | kids-app / main | 静的HTMLあり。本番・利用状況：未確認 |
| 草原のレイン v2 | [開く](https://cetus.fun/bar3/rain-v2.html) / [bar3/rain-v2.html](https://github.com/sizuku-slowdays/kids-app/blob/7afd93235cc6f4cfec2568e07819a028a95789a9/bar3/rain-v2.html) | kids-app / main | 静的HTMLあり。本番・利用状況：未確認 |
| はろーぼくじょう こうみんかん | [開く](https://cetus.fun/haro/hello-bokujou.html) / [haro/hello-bokujou.html](https://github.com/sizuku-slowdays/kids-app/blob/7afd93235cc6f4cfec2568e07819a028a95789a9/haro/hello-bokujou.html) | kids-app / main | 静的HTMLあり。本番・利用状況：未確認 |
| cetus.fun | [開く](https://cetus.fun/index.html) / [index.html](https://github.com/sizuku-slowdays/kids-app/blob/7afd93235cc6f4cfec2568e07819a028a95789a9/index.html) | kids-app / main | 静的HTMLあり。本番・利用状況：未確認 |
| ママ銀行 👀 | [開く](https://cetus.fun/kanriapp/BUmama-bank-view.html) / [kanriapp/BUmama-bank-view.html](https://github.com/sizuku-slowdays/kids-app/blob/7afd93235cc6f4cfec2568e07819a028a95789a9/kanriapp/BUmama-bank-view.html) | kids-app / main | バックアップ候補（BU接頭辞）。本番・利用状況：未確認 |
| ママ銀行 | [開く](https://cetus.fun/kanriapp/BUmama-bank.html) / [kanriapp/BUmama-bank.html](https://github.com/sizuku-slowdays/kids-app/blob/7afd93235cc6f4cfec2568e07819a028a95789a9/kanriapp/BUmama-bank.html) | kids-app / main | バックアップ候補（BU接頭辞）。本番・利用状況：未確認 |
| 家族カレンダー | [開く](https://cetus.fun/kanriapp/calendar.html) / [kanriapp/calendar.html](https://github.com/sizuku-slowdays/kids-app/blob/7afd93235cc6f4cfec2568e07819a028a95789a9/kanriapp/calendar.html) | kids-app / main | 静的HTMLあり。本番・利用状況：未確認 |
| いいことポイント 管理画面 | [開く](https://cetus.fun/kanriapp/iikoto-admin.html) / [kanriapp/iikoto-admin.html](https://github.com/sizuku-slowdays/kids-app/blob/7afd93235cc6f4cfec2568e07819a028a95789a9/kanriapp/iikoto-admin.html) | kids-app / main | 静的HTMLあり。本番・利用状況：未確認 |
| きょうのいいこと 🌸 | [開く](https://cetus.fun/kanriapp/iikoto1.html) / [kanriapp/iikoto1.html](https://github.com/sizuku-slowdays/kids-app/blob/7afd93235cc6f4cfec2568e07819a028a95789a9/kanriapp/iikoto1.html) | kids-app / main | 静的HTMLあり。本番・利用状況：未確認 |
| きょうのいいこと 🦄 | [開く](https://cetus.fun/kanriapp/iikoto2.html) / [kanriapp/iikoto2.html](https://github.com/sizuku-slowdays/kids-app/blob/7afd93235cc6f4cfec2568e07819a028a95789a9/kanriapp/iikoto2.html) | kids-app / main | 静的HTMLあり。本番・利用状況：未確認 |
| 管理アプリ | [開く](https://cetus.fun/kanriapp/index.html) / [kanriapp/index.html](https://github.com/sizuku-slowdays/kids-app/blob/7afd93235cc6f4cfec2568e07819a028a95789a9/kanriapp/index.html) | kids-app / main | 静的HTMLあり。本番・利用状況：未確認 |
| 家計簿 | [開く](https://cetus.fun/kanriapp/kakeibo-app.html) / [kanriapp/kakeibo-app.html](https://github.com/sizuku-slowdays/kids-app/blob/7afd93235cc6f4cfec2568e07819a028a95789a9/kanriapp/kakeibo-app.html) | kids-app / main | 静的HTMLあり。本番・利用状況：未確認 |
| 家計簿 | [開く](https://cetus.fun/kanriapp/kakeibo-app2.html) / [kanriapp/kakeibo-app2.html](https://github.com/sizuku-slowdays/kids-app/blob/7afd93235cc6f4cfec2568e07819a028a95789a9/kanriapp/kakeibo-app2.html) | kids-app / main | 静的HTMLあり。本番・利用状況：未確認 |
| 資金繰り | [開く](https://cetus.fun/kanriapp/kakeibo-cashflow.html) / [kanriapp/kakeibo-cashflow.html](https://github.com/sizuku-slowdays/kids-app/blob/7afd93235cc6f4cfec2568e07819a028a95789a9/kanriapp/kakeibo-cashflow.html) | kids-app / main | 静的HTMLあり。本番・利用状況：未確認 |
| 固定費設定 | [開く](https://cetus.fun/kanriapp/kakeibo-fixed-master.html) / [kanriapp/kakeibo-fixed-master.html](https://github.com/sizuku-slowdays/kids-app/blob/7afd93235cc6f4cfec2568e07819a028a95789a9/kanriapp/kakeibo-fixed-master.html) | kids-app / main | 静的HTMLあり。本番・利用状況：未確認 |
| 家計簿メニュー | [開く](https://cetus.fun/kanriapp/kakeibo-index.html) / [kanriapp/kakeibo-index.html](https://github.com/sizuku-slowdays/kids-app/blob/7afd93235cc6f4cfec2568e07819a028a95789a9/kanriapp/kakeibo-index.html) | kids-app / main | 静的HTMLあり。本番・利用状況：未確認 |
| 支出を入力 | [開く](https://cetus.fun/kanriapp/kakeibo-input.html) / [kanriapp/kakeibo-input.html](https://github.com/sizuku-slowdays/kids-app/blob/7afd93235cc6f4cfec2568e07819a028a95789a9/kanriapp/kakeibo-input.html) | kids-app / main | 静的HTMLあり。本番・利用状況：未確認 |
| 予算・積み立て | [開く](https://cetus.fun/kanriapp/kakeibo-plan.html) / [kanriapp/kakeibo-plan.html](https://github.com/sizuku-slowdays/kids-app/blob/7afd93235cc6f4cfec2568e07819a028a95789a9/kanriapp/kakeibo-plan.html) | kids-app / main | 静的HTMLあり。本番・利用状況：未確認 |
| 家計簿 | [開く](https://cetus.fun/kanriapp/kakeibo_gdrive.html) / [kanriapp/kakeibo_gdrive.html](https://github.com/sizuku-slowdays/kids-app/blob/7afd93235cc6f4cfec2568e07819a028a95789a9/kanriapp/kakeibo_gdrive.html) | kids-app / main | 静的HTMLあり。本番・利用状況：未確認 |
| からだカレンダー | [開く](https://cetus.fun/kanriapp/karada_calendar.html) / [kanriapp/karada_calendar.html](https://github.com/sizuku-slowdays/kids-app/blob/7afd93235cc6f4cfec2568e07819a028a95789a9/kanriapp/karada_calendar.html) | kids-app / main | 静的HTMLあり。本番・利用状況：未確認 |
| 矯正チェック日記 🦷 | [開く](https://cetus.fun/kanriapp/kyosei-check.html) / [kanriapp/kyosei-check.html](https://github.com/sizuku-slowdays/kids-app/blob/7afd93235cc6f4cfec2568e07819a028a95789a9/kanriapp/kyosei-check.html) | kids-app / main | 静的HTMLあり。本番・利用状況：未確認 |
| ママ銀行 👀 | [開く](https://cetus.fun/kanriapp/mama-bank-view.html) / [kanriapp/mama-bank-view.html](https://github.com/sizuku-slowdays/kids-app/blob/7afd93235cc6f4cfec2568e07819a028a95789a9/kanriapp/mama-bank-view.html) | kids-app / main | 静的HTMLあり。本番・利用状況：未確認 |
| ママ銀行 | [開く](https://cetus.fun/kanriapp/mama-bank.html) / [kanriapp/mama-bank.html](https://github.com/sizuku-slowdays/kids-app/blob/7afd93235cc6f4cfec2568e07819a028a95789a9/kanriapp/mama-bank.html) | kids-app / main | 静的HTMLあり。本番・利用状況：未確認 |
| 通知センター | [開く](https://cetus.fun/kanriapp/notification-center.html) / [kanriapp/notification-center.html](https://github.com/sizuku-slowdays/kids-app/blob/7afd93235cc6f4cfec2568e07819a028a95789a9/kanriapp/notification-center.html) | kids-app / main | 静的HTMLあり。本番・利用状況：未確認 |
| きょうの記録 | [開く](https://cetus.fun/kanriapp/notification-today.html) / [kanriapp/notification-today.html](https://github.com/sizuku-slowdays/kids-app/blob/7afd93235cc6f4cfec2568e07819a028a95789a9/kanriapp/notification-today.html) | kids-app / main | 静的HTMLあり。本番・利用状況：未確認 |
| おてつだいポイント | [開く](https://cetus.fun/kanriapp/otetsuday-points.html) / [kanriapp/otetsuday-points.html](https://github.com/sizuku-slowdays/kids-app/blob/7afd93235cc6f4cfec2568e07819a028a95789a9/kanriapp/otetsuday-points.html) | kids-app / main | 静的HTMLあり。本番・利用状況：未確認 |
| おてつだい当番 | [開く](https://cetus.fun/kanriapp/otetsuday-toban.html) / [kanriapp/otetsuday-toban.html](https://github.com/sizuku-slowdays/kids-app/blob/7afd93235cc6f4cfec2568e07819a028a95789a9/kanriapp/otetsuday-toban.html) | kids-app / main | 静的HTMLあり。本番・利用状況：未確認 |
| 学校チェック 管理画面 | [開く](https://cetus.fun/kanriapp/school-check-admin.html) / [kanriapp/school-check-admin.html](https://github.com/sizuku-slowdays/kids-app/blob/7afd93235cc6f4cfec2568e07819a028a95789a9/kanriapp/school-check-admin.html) | kids-app / main | 静的HTMLあり。本番・利用状況：未確認 |
| 学校チェック送信テスト | [開く](https://cetus.fun/kanriapp/school-check-test.html) / [kanriapp/school-check-test.html](https://github.com/sizuku-slowdays/kids-app/blob/7afd93235cc6f4cfec2568e07819a028a95789a9/kanriapp/school-check-test.html) | kids-app / main | 試験ページ（ファイル名）。本番・利用状況：未確認 |
| 学校チェック | [開く](https://cetus.fun/kanriapp/school-check.html) / [kanriapp/school-check.html](https://github.com/sizuku-slowdays/kids-app/blob/7afd93235cc6f4cfec2568e07819a028a95789a9/kanriapp/school-check.html) | kids-app / main | 静的HTMLあり。本番・利用状況：未確認 |
| からだパワー | [開く](https://cetus.fun/karada_power/index.html) / [karada_power/index.html](https://github.com/sizuku-slowdays/kids-app/blob/7afd93235cc6f4cfec2568e07819a028a95789a9/karada_power/index.html) | kids-app / main | 静的HTMLあり。本番・利用状況：未確認 |
| 🎱 BINGO 抽選機 | [開く](https://cetus.fun/kids-app/bingo.html) / [kids-app/bingo.html](https://github.com/sizuku-slowdays/kids-app/blob/7afd93235cc6f4cfec2568e07819a028a95789a9/kids-app/bingo.html) | kids-app / main | 静的HTMLあり。本番・利用状況：未確認 |
| 🎱 ビンゴカード | [開く](https://cetus.fun/kids-app/bingocard.html) / [kids-app/bingocard.html](https://github.com/sizuku-slowdays/kids-app/blob/7afd93235cc6f4cfec2568e07819a028a95789a9/kids-app/bingocard.html) | kids-app / main | 静的HTMLあり。本番・利用状況：未確認 |
| ちいさい「っ」みつけ | [開く](https://cetus.fun/kids-app/chiisai-tsu.html) / [kids-app/chiisai-tsu.html](https://github.com/sizuku-slowdays/kids-app/blob/7afd93235cc6f4cfec2568e07819a028a95789a9/kids-app/chiisai-tsu.html) | kids-app / main | 静的HTMLあり。本番・利用状況：未確認 |
| ひっ算れんしゅう | [開く](https://cetus.fun/kids-app/hissan.html) / [kids-app/hissan.html](https://github.com/sizuku-slowdays/kids-app/blob/7afd93235cc6f4cfec2568e07819a028a95789a9/kids-app/hissan.html) | kids-app / main | 静的HTMLあり。本番・利用状況：未確認 |
| キッズアプリ | [開く](https://cetus.fun/kids-app/index.html) / [kids-app/index.html](https://github.com/sizuku-slowdays/kids-app/blob/7afd93235cc6f4cfec2568e07819a028a95789a9/kids-app/index.html) | kids-app / main | 静的HTMLあり。本番・利用状況：未確認 |
| 都道府県パズル | [開く](https://cetus.fun/kids-app/japan_map_quiz_v5.html) / [kids-app/japan_map_quiz_v5.html](https://github.com/sizuku-slowdays/kids-app/blob/7afd93235cc6f4cfec2568e07819a028a95789a9/kids-app/japan_map_quiz_v5.html) | kids-app / main | 静的HTMLあり。本番・利用状況：未確認 |
| かんじ書き順マスター | [開く](https://cetus.fun/kids-app/kanji-stroke-app.html) / [kids-app/kanji-stroke-app.html](https://github.com/sizuku-slowdays/kids-app/blob/7afd93235cc6f4cfec2568e07819a028a95789a9/kids-app/kanji-stroke-app.html) | kids-app / main | 静的HTMLあり。本番・利用状況：未確認 |
| 漢字れんしゅう | [開く](https://cetus.fun/kids-app/kanji_review.html) / [kids-app/kanji_review.html](https://github.com/sizuku-slowdays/kids-app/blob/7afd93235cc6f4cfec2568e07819a028a95789a9/kids-app/kanji_review.html) | kids-app / main | 静的HTMLあり。本番・利用状況：未確認 |
| 漢字れんしゅう | [開く](https://cetus.fun/kids-app/kanji_review_multi_grade_v1.html) / [kids-app/kanji_review_multi_grade_v1.html](https://github.com/sizuku-slowdays/kids-app/blob/7afd93235cc6f4cfec2568e07819a028a95789a9/kids-app/kanji_review_multi_grade_v1.html) | kids-app / main | 静的HTMLあり。本番・利用状況：未確認 |
| 5もんチャレンジ | [開く](https://cetus.fun/kids-app/keisan/5mon-challenge.html) / [kids-app/keisan/5mon-challenge.html](https://github.com/sizuku-slowdays/kids-app/blob/7afd93235cc6f4cfec2568e07819a028a95789a9/kids-app/keisan/5mon-challenge.html) | kids-app / main | 静的HTMLあり。本番・利用状況：未確認 |
| 計算フラッシュ | [開く](https://cetus.fun/kids-app/keisan/keisan-flash.html) / [kids-app/keisan/keisan-flash.html](https://github.com/sizuku-slowdays/kids-app/blob/7afd93235cc6f4cfec2568e07819a028a95789a9/kids-app/keisan/keisan-flash.html) | kids-app / main | 静的HTMLあり。本番・利用状況：未確認 |
| けいさんドリル | [開く](https://cetus.fun/kids-app/keisan_drill.html) / [kids-app/keisan_drill.html](https://github.com/sizuku-slowdays/kids-app/blob/7afd93235cc6f4cfec2568e07819a028a95789a9/kids-app/keisan_drill.html) | kids-app / main | 静的HTMLあり。本番・利用状況：未確認 |
| ことばあつめゲーム | [開く](https://cetus.fun/kids-app/kotoba-atsume.html) / [kids-app/kotoba-atsume.html](https://github.com/sizuku-slowdays/kids-app/blob/7afd93235cc6f4cfec2568e07819a028a95789a9/kids-app/kotoba-atsume.html) | kids-app / main | 静的HTMLあり。本番・利用状況：未確認 |
| ことばクイズ🌟 | [開く](https://cetus.fun/kids-app/kotoba-quiz.html) / [kids-app/kotoba-quiz.html](https://github.com/sizuku-slowdays/kids-app/blob/7afd93235cc6f4cfec2568e07819a028a95789a9/kids-app/kotoba-quiz.html) | kids-app / main | 静的HTMLあり。本番・利用状況：未確認 |
| 99×99マスター | [開く](https://cetus.fun/kids-app/kuku-99.html) / [kids-app/kuku-99.html](https://github.com/sizuku-slowdays/kids-app/blob/7afd93235cc6f4cfec2568e07819a028a95789a9/kids-app/kuku-99.html) | kids-app / main | 静的HTMLあり。本番・利用状況：未確認 |
| 九九マスター | [開く](https://cetus.fun/kids-app/kuku-app-v3.html) / [kids-app/kuku-app-v3.html](https://github.com/sizuku-slowdays/kids-app/blob/7afd93235cc6f4cfec2568e07819a028a95789a9/kids-app/kuku-app-v3.html) | kids-app / main | 静的HTMLあり。本番・利用状況：未確認 |
| 九九マスター | [開く](https://cetus.fun/kids-app/kuku-app.html) / [kids-app/kuku-app.html](https://github.com/sizuku-slowdays/kids-app/blob/7afd93235cc6f4cfec2568e07819a028a95789a9/kids-app/kuku-app.html) | kids-app / main | 静的HTMLあり。本番・利用状況：未確認 |
| おくすりタイマー🌈 | [開く](https://cetus.fun/kids-app/medicine-game.html) / [kids-app/medicine-game.html](https://github.com/sizuku-slowdays/kids-app/blob/7afd93235cc6f4cfec2568e07819a028a95789a9/kids-app/medicine-game.html) | kids-app / main | 静的HTMLあり。本番・利用状況：未確認 |
| ピンポンブザー | [開く](https://cetus.fun/kids-app/pinpon-buzzer.html) / [kids-app/pinpon-buzzer.html](https://github.com/sizuku-slowdays/kids-app/blob/7afd93235cc6f4cfec2568e07819a028a95789a9/kids-app/pinpon-buzzer.html) | kids-app / main | 静的HTMLあり。本番・利用状況：未確認 |
| ポイっ | [開く](https://cetus.fun/kids-app/poiQ.html) / [kids-app/poiQ.html](https://github.com/sizuku-slowdays/kids-app/blob/7afd93235cc6f4cfec2568e07819a028a95789a9/kids-app/poiQ.html) | kids-app / main | 静的HTMLあり。本番・利用状況：未確認 |
| ルーレット 1〜9 | [開く](https://cetus.fun/kids-app/roulette.html) / [kids-app/roulette.html](https://github.com/sizuku-slowdays/kids-app/blob/7afd93235cc6f4cfec2568e07819a028a95789a9/kids-app/roulette.html) | kids-app / main | 静的HTMLあり。本番・利用状況：未確認 |
| 世界の国と首都クイズ | [開く](https://cetus.fun/kids-app/sekai-quiz.html) / [kids-app/sekai-quiz.html](https://github.com/sizuku-slowdays/kids-app/blob/7afd93235cc6f4cfec2568e07819a028a95789a9/kids-app/sekai-quiz.html) | kids-app / main | 静的HTMLあり。本番・利用状況：未確認 |
| おみせやさん けいさんゲーム | [開く](https://cetus.fun/kids-app/shop_calc.html) / [kids-app/shop_calc.html](https://github.com/sizuku-slowdays/kids-app/blob/7afd93235cc6f4cfec2568e07819a028a95789a9/kids-app/shop_calc.html) | kids-app / main | 静的HTMLあり。本番・利用状況：未確認 |
| おみせやさん けいさんゲーム | [開く](https://cetus.fun/kids-app/shop_calc1.html) / [kids-app/shop_calc1.html](https://github.com/sizuku-slowdays/kids-app/blob/7afd93235cc6f4cfec2568e07819a028a95789a9/kids-app/shop_calc1.html) | kids-app / main | 静的HTMLあり。本番・利用状況：未確認 |
| とけい はじめてまなぶ | [開く](https://cetus.fun/kids-app/tokei-nyumon.html) / [kids-app/tokei-nyumon.html](https://github.com/sizuku-slowdays/kids-app/blob/7afd93235cc6f4cfec2568e07819a028a95789a9/kids-app/tokei-nyumon.html) | kids-app / main | 静的HTMLあり。本番・利用状況：未確認 |
| とけいタイムマシン | [開く](https://cetus.fun/kids-app/tokei-time.html) / [kids-app/tokei-time.html](https://github.com/sizuku-slowdays/kids-app/blob/7afd93235cc6f4cfec2568e07819a028a95789a9/kids-app/tokei-time.html) | kids-app / main | 静的HTMLあり。本番・利用状況：未確認 |
| 時計れんしゅう | [開く](https://cetus.fun/kids-app/tokei.html) / [kids-app/tokei.html](https://github.com/sizuku-slowdays/kids-app/blob/7afd93235cc6f4cfec2568e07819a028a95789a9/kids-app/tokei.html) | kids-app / main | 静的HTMLあり。本番・利用状況：未確認 |
| 漢字書き順プリントメーカー | [開く](https://cetus.fun/maker/10kanji-stroke-print-maker.html) / [maker/10kanji-stroke-print-maker.html](https://github.com/sizuku-slowdays/kids-app/blob/7afd93235cc6f4cfec2568e07819a028a95789a9/maker/10kanji-stroke-print-maker.html) | kids-app / main | 静的HTMLあり。本番・利用状況：未確認 |
| ひっ算プリントメーカー 明朝体版 | [開く](https://cetus.fun/maker/1hissan-print-maker-mincho.html) / [maker/1hissan-print-maker-mincho.html](https://github.com/sizuku-slowdays/kids-app/blob/7afd93235cc6f4cfec2568e07819a028a95789a9/maker/1hissan-print-maker-mincho.html) | kids-app / main | 静的HTMLあり。本番・利用状況：未確認 |
| ひっ算プリントメーカー | [開く](https://cetus.fun/maker/1hissan-print-maker.html) / [maker/1hissan-print-maker.html](https://github.com/sizuku-slowdays/kids-app/blob/7afd93235cc6f4cfec2568e07819a028a95789a9/maker/1hissan-print-maker.html) | kids-app / main | 静的HTMLあり。本番・利用状況：未確認 |
| 九九プリントメーカー 明朝体版 | [開く](https://cetus.fun/maker/2kuku-print-maker-mincho.html) / [maker/2kuku-print-maker-mincho.html](https://github.com/sizuku-slowdays/kids-app/blob/7afd93235cc6f4cfec2568e07819a028a95789a9/maker/2kuku-print-maker-mincho.html) | kids-app / main | 静的HTMLあり。本番・利用状況：未確認 |
| 九九プリントメーカー | [開く](https://cetus.fun/maker/2kuku-print-maker.html) / [maker/2kuku-print-maker.html](https://github.com/sizuku-slowdays/kids-app/blob/7afd93235cc6f4cfec2568e07819a028a95789a9/maker/2kuku-print-maker.html) | kids-app / main | 静的HTMLあり。本番・利用状況：未確認 |
| 時計よみプリントメーカー | [開く](https://cetus.fun/maker/3clock-print-maker.html) / [maker/3clock-print-maker.html](https://github.com/sizuku-slowdays/kids-app/blob/7afd93235cc6f4cfec2568e07819a028a95789a9/maker/3clock-print-maker.html) | kids-app / main | 静的HTMLあり。本番・利用状況：未確認 |
| お金・お買い物計算プリントメーカー | [開く](https://cetus.fun/maker/4money-print-maker.html) / [maker/4money-print-maker.html](https://github.com/sizuku-slowdays/kids-app/blob/7afd93235cc6f4cfec2568e07819a028a95789a9/maker/4money-print-maker.html) | kids-app / main | 静的HTMLあり。本番・利用状況：未確認 |
| 都道府県プリントメーカー | [開く](https://cetus.fun/maker/5prefecture-print-maker.html) / [maker/5prefecture-print-maker.html](https://github.com/sizuku-slowdays/kids-app/blob/7afd93235cc6f4cfec2568e07819a028a95789a9/maker/5prefecture-print-maker.html) | kids-app / main | 静的HTMLあり。本番・利用状況：未確認 |
| ことばプリントメーカー | [開く](https://cetus.fun/maker/6kotoba-print-maker.html) / [maker/6kotoba-print-maker.html](https://github.com/sizuku-slowdays/kids-app/blob/7afd93235cc6f4cfec2568e07819a028a95789a9/maker/6kotoba-print-maker.html) | kids-app / main | 静的HTMLあり。本番・利用状況：未確認 |
| わり算筆算プリントメーカー | [開く](https://cetus.fun/maker/7warizan-print-maker.html) / [maker/7warizan-print-maker.html](https://github.com/sizuku-slowdays/kids-app/blob/7afd93235cc6f4cfec2568e07819a028a95789a9/maker/7warizan-print-maker.html) | kids-app / main | 静的HTMLあり。本番・利用状況：未確認 |
| 文章問題プリントメーカー | [開く](https://cetus.fun/maker/8bunsho-print-maker.html) / [maker/8bunsho-print-maker.html](https://github.com/sizuku-slowdays/kids-app/blob/7afd93235cc6f4cfec2568e07819a028a95789a9/maker/8bunsho-print-maker.html) | kids-app / main | 静的HTMLあり。本番・利用状況：未確認 |
| 計算プリントメーカー 明朝体版 | [開く](https://cetus.fun/maker/9keisanprint-maker.html) / [maker/9keisanprint-maker.html](https://github.com/sizuku-slowdays/kids-app/blob/7afd93235cc6f4cfec2568e07819a028a95789a9/maker/9keisanprint-maker.html) | kids-app / main | 静的HTMLあり。本番・利用状況：未確認 |
| プリントメーカー | [開く](https://cetus.fun/maker/index.html) / [maker/index.html](https://github.com/sizuku-slowdays/kids-app/blob/7afd93235cc6f4cfec2568e07819a028a95789a9/maker/index.html) | kids-app / main | 静的HTMLあり。本番・利用状況：未確認 |
| 筋肉貯金 | [開く](https://cetus.fun/muscle-bank/index.html) / [muscle-bank/index.html](https://github.com/sizuku-slowdays/kids-app/blob/7afd93235cc6f4cfec2568e07819a028a95789a9/muscle-bank/index.html) | kids-app / main | 静的HTMLあり。本番・利用状況：未確認 |
| 家族用ポータル | [開く](https://cetus.fun/portal/index.html) / [portal/index.html](https://github.com/sizuku-slowdays/kids-app/blob/7afd93235cc6f4cfec2568e07819a028a95789a9/portal/index.html) | kids-app / main | 静的HTMLあり。本番・利用状況：未確認 |
| クイズラボ | [開く](https://cetus.fun/quiz-lab/index.html) / [quiz-lab/index.html](https://github.com/sizuku-slowdays/kids-app/blob/7afd93235cc6f4cfec2568e07819a028a95789a9/quiz-lab/index.html) | kids-app / main | 静的HTMLあり。本番・利用状況：未確認 |
| 大人の数学チャレンジ | [開く](https://cetus.fun/quiz-lab/math-quiz.html) / [quiz-lab/math-quiz.html](https://github.com/sizuku-slowdays/kids-app/blob/7afd93235cc6f4cfec2568e07819a028a95789a9/quiz-lab/math-quiz.html) | kids-app / main | 静的HTMLあり。本番・利用状況：未確認 |
| S-BOX | [開く](https://cetus.fun/s-box/index.html) / [s-box/index.html](https://github.com/sizuku-slowdays/kids-app/blob/7afd93235cc6f4cfec2568e07819a028a95789a9/s-box/index.html) | kids-app / main | 静的HTMLあり。本番・利用状況：未確認 |
| おうちアルバム｜わが家アプリ | [開く](https://cetus.fun/wagaya/album/index.html) / [wagaya/album/index.html](https://github.com/sizuku-slowdays/kids-app/blob/7afd93235cc6f4cfec2568e07819a028a95789a9/wagaya/album/index.html) | kids-app / main | 静的HTMLあり。本番・利用状況：未確認 |
| アプリ一覧｜わが家アプリ | [開く](https://cetus.fun/wagaya/apps.html) / [wagaya/apps.html](https://github.com/sizuku-slowdays/kids-app/blob/7afd93235cc6f4cfec2568e07819a028a95789a9/wagaya/apps.html) | kids-app / main | 静的HTMLあり。本番・利用状況：未確認 |
| わが家アプリ | [開く](https://cetus.fun/wagaya/index.html) / [wagaya/index.html](https://github.com/sizuku-slowdays/kids-app/blob/7afd93235cc6f4cfec2568e07819a028a95789a9/wagaya/index.html) | kids-app / main | 静的HTMLあり。本番・利用状況：未確認 |
| 5もんチャレンジ | [開く](https://cetus.fun/wagaya/keisan/5mon-challenge.html) / [wagaya/keisan/5mon-challenge.html](https://github.com/sizuku-slowdays/kids-app/blob/7afd93235cc6f4cfec2568e07819a028a95789a9/wagaya/keisan/5mon-challenge.html) | kids-app / main | 静的HTMLあり。本番・利用状況：未確認 |
| 計算アプリ | [開く](https://cetus.fun/wagaya/keisan/index.html) / [wagaya/keisan/index.html](https://github.com/sizuku-slowdays/kids-app/blob/7afd93235cc6f4cfec2568e07819a028a95789a9/wagaya/keisan/index.html) | kids-app / main | 静的HTMLあり。本番・利用状況：未確認 |
| 計算フラッシュ | [開く](https://cetus.fun/wagaya/keisan/keisan-flash.html) / [wagaya/keisan/keisan-flash.html](https://github.com/sizuku-slowdays/kids-app/blob/7afd93235cc6f4cfec2568e07819a028a95789a9/wagaya/keisan/keisan-flash.html) | kids-app / main | 静的HTMLあり。本番・利用状況：未確認 |
| おはじき暗算 | [開く](https://cetus.fun/wagaya/keisan/ohajiki-anzan.html) / [wagaya/keisan/ohajiki-anzan.html](https://github.com/sizuku-slowdays/kids-app/blob/7afd93235cc6f4cfec2568e07819a028a95789a9/wagaya/keisan/ohajiki-anzan.html) | kids-app / main | 静的HTMLあり。本番・利用状況：未確認 |
| わが家アプリ | [開く](https://cetus.fun/wagaya/kids.html) / [wagaya/kids.html](https://github.com/sizuku-slowdays/kids-app/blob/7afd93235cc6f4cfec2568e07819a028a95789a9/wagaya/kids.html) | kids-app / main | 静的HTMLあり。本番・利用状況：未確認 |
| わが家アプリ｜ママ | [開く](https://cetus.fun/wagaya/mama.html) / [wagaya/mama.html](https://github.com/sizuku-slowdays/kids-app/blob/7afd93235cc6f4cfec2568e07819a028a95789a9/wagaya/mama.html) | kids-app / main | 静的HTMLあり。本番・利用状況：未確認 |
| わが家アプリ | [開く](https://cetus.fun/wagaya/old-home.html) / [wagaya/old-home.html](https://github.com/sizuku-slowdays/kids-app/blob/7afd93235cc6f4cfec2568e07819a028a95789a9/wagaya/old-home.html) | kids-app / main | 静的HTMLあり。本番・利用状況：未確認 |
| 時間割｜わが家アプリ | [開く](https://cetus.fun/wagaya/timetable.html) / [wagaya/timetable.html](https://github.com/sizuku-slowdays/kids-app/blob/7afd93235cc6f4cfec2568e07819a028a95789a9/wagaya/timetable.html) | kids-app / main | 静的HTMLあり。本番・利用状況：未確認 |

## その他のリポジトリ・サイト

| 対象 | リポジトリ・関連ファイル | URL・状態 |
| --- | --- | --- |
| 日記・サイト | kids-appのdiary/（README・diary.html・hane/・social.html・js/等） | CNAMEファイルあり。現用URL・配信方法・保存APIは未確認。バックアップJSONを公開管理資料へ転載しない |
| 銀行・家計簿等の別コピー | nobankapp / mama-bank.html、mama-bank-view.html、kakeibo-app.html、kakeibo_gdrive.html、school-check.html、kyosei-check.html、iikoto1.html、iikoto2.html | 非公開。HTMLファイルの存在のみ確認。現用URL・移行／保管位置付けは未確認 |
| 日記等の別コピー | nosizuku-slowdays.github.io / index.html、diary.html、hane/、social.html、s-box/ | 非公開。現用URL・位置付けは未確認 |
| からだパワーの別コピー | test / karada_power/ | 公開repo。試験・本番どちらかは未確認 |

旧HOMEの`wagaya/data/apps.json`は旧銀行・旧ポイントを含みます。新HOMEの現用アプリ登録情報はhome-dbのapps等で管理されるため、このJSONを新HOMEの正本として編集しません。

## 2026-10-11 追加・改修予定

| アプリ | 利用URL（反映後） | 保存先・状態 |
| --- | --- | --- |
| 家系図 | https://cetus.fun/wagaya/apps/family-tree/ | kids-appの作業ブランチ。home-worker、home-db、非公開home-private。実装・ローカルテスト済み、本番未反映 |
| カレンダー共有拡張 | https://cetus.fun/wagaya/apps/calendar/ | 既存calendar-dbを維持し追加権限テーブルを使用。実装・ローカルテスト済み、本番未反映 |

詳細：[設計と導入手順](https://github.com/sizuku-slowdays/kids-app/blob/feature/calendar-family-tree-20261011/docs/main-work/calendar-family-tree.md)。既存アプリの状態表を本番反映済みへ変更しない。

カレンダーの追加改修：閲覧できる予定は登録者または所有家庭の管理者が変更可能。本人限定予定は管理者にも非公開。家系図の公開範囲は許可された家庭メンバーのみ。作業PR #3で実装、本番未反映。


### 2026-10-12：カレンダー通知のHOME連携
カレンダーの予定編集画面でHOME表示名による通知先と、HOME本人として端末を通知登録する入口を追加。URLは従来の /wagaya/apps/calendar/ を維持。旧通知センター自体は既存URL・機能を維持。本番Worker手動更新・端末配信確認待ち。


### 2026-10-12：家系図の夫婦間隔の修正
子ども3人が別世帯を持つ場合でも、祖父母を近くに表示する配置へ改修。自動試験8件通過。HOME Gitビルド後に家系図を再読込して確認。利用URL・DB・写真保存先の変更なし。実画面は利用者確認待ち。


### 2026-10-12：外食料金（新規HOMEアプリ）
名前：外食料金。通常URL：https://cetus.fun/wagaya/apps/dining-prices/ 。home-worker直URL：https://home-worker.sslowdayss.workers.dev/apps/dining-prices/ 。リポジトリ：kids-app / feat/home-auth-foundation。ソース：cloudflare/home-worker/public/apps/dining-prices/、src/dining-prices.ts。HOMEの個人セッション認証と家庭アプリ権限を使用。5区分・人数0人開始・店舗切替時の人数維持・全コース税込合計/最安差/任意2コース差・店舗/コース/価格編集。Git自動ビルドへの反映待ち。本番ログイン後と実機iPhoneの確認は未確認。


### 2026-10-12：外食料金・単品注文型
外食料金へ「ビフテキうえすたん ウエストコート姪浜店」を2店舗目として追加。通常/ランチ/テイクアウトのモード、カテゴリ、検索、12商品単位のページ送り、サイズ/種類選択、数量、小計、合計、画面下の注文入口。106商品・189価格選択肢（PDF6ページ全部）。商品/カテゴリ/価格/表示・非表示/計算方式を大人が編集しD1へ保存する。URLは同じ /wagaya/apps/dining-prices/。コード試験済み、Git自動ビルド後の本番実機は確認待ち。


外食料金：うえすたんにキッズプレート700円を共通メニューから追加。店舗専用PDF106商品とは別の補足1商品。

### 2026-10-14：まいにち漢字3文字
- 利用URL：https://cetus.fun/wagaya/apps/daily-kanji/。
- 正本：sizuku-slowdays/kids-app / feat/home-auth-foundation / cloudflare/home-worker。
- HOME共通認証、1日3文字、日本時間、ユーザー別D1。図鑑・書き順再生・保護者の学年/学習確認。
- 1〜3年440文字＋進級用4〜6年を含む全1026文字。既存の漢字アプリを再利用した新規教材で、旧アプリは上書きしない。
- コード/ローカル試験済み。本番ビルド・ログイン済みiPhone/Android/PCでの表示確認は未確認。


## 2026-10-15 HOME下部リンク

HOME下部の「以前のHOME」を「🎮 キッズアプリ一覧」に変更。リンク先は https://cetus.fun/kids-app/ （HTTP取得・title「キッズアプリ」を確認）。旧HOME自体や既存アプリ・認証・DBは変更なし。home-mountテストの期待リンクも更新。漢字アプリ小学4年生の表示は利用者確認済み。



## 2026-10-15 つうちょう現金機能

つうちょうの既存URLに、お小遣い自動入金・利息・おさいふ・本人の大人cash口座・未払い照合を追加実装。作業ブランチ feature/passbook-cash-20261015。テスト済み、本番未反映。 詳細は[設計・検証・反映手順](passbook-cash-20261015.md)。

## 2026-10-15 キッズ一覧といいことポイント

旧ママ銀行/旧ポイントの一覧はmainで整理済み。いいことはHOME認証の新入口 /wagaya/apps/good-deeds/ を作業ブランチに実装し、未反映。旧2カード統合・旧HTML転送も別ブランチで準備。 [詳細と残作業](good-deeds-20261015.md)。


## 2026-10-16 00時台 JST 確認更新（上記の保留状態を更新）

つうちょうPR4は2a83a28で統合し、10月15日18:01の自動デプロイ成功を利用者が確認。変更前後の全既存passbook行照合はok=true/issues=[]。本人の大人現金口座作成・お手伝い報酬も利用者確認済み。お小遣い5回設定・利息ONの利用者報告あり。おさいふは利用者希望で後回し。10月14日3件の補填は根拠不足のため未処理を継続。初回月次自動処理は未確認。

旧いいことWorkerの提示コードはGET/POST/DELETEのiikoto_records操作のみ、owner固定コード照合でHOME認証なし。DashboardのDB bindingはmama-bank-dbと利用者確認。旧記録を残し、新しいgood_deed_*台帳を0開始する方式を維持。10月16日00:17、旧DBのiikotoテーブル確認・最新home-dbエクスポートと整合性・両バックアップハッシュ保存がすべてOKとの利用者報告。本番移行は未実施。

今回の統合は0018金融機能と0019いいことの両方を保持する。旧API保護・新画面の本番反映・実アカウント権限確認・旧リンク切替は残作業。旧DBやつうちょうへのリセットは実施しない。


## 2026-10-16 学校じゅんび（準備）

学校じゅんび `/wagaya/apps/school-prep/` を独立ブランチで実装。HOME認証・本人/保護者・手入力確定・宿題/夜/朝のチェック・30登校日集計。AI/ランク/報酬は今回保留。本番未反映。 詳細：[仕様・試験・導入ゲート](school-prep-20261016.md)。


## 2026-10-16 学校準備：登校日の既定値・宿題初期項目

- 通知Worker更新完了、HOME PR8のBuild成功（12:13）と実際の段階全完了通知到着を利用者が確認。通知DB前後照合ok、既存通知4表不変。HOME照合の家系図・user_apps差分は利用者が実操作を報告。つうちょう・いいことポイントは照合上不変。祖母登録人物の表示問題は別件として未解決。
- 今回の修正：次の登校日は月〜金を既定とし、登録済みの各日最新版の登校日／休み指定を優先。土曜授業は指定可能。未来の遠い登録が直近平日を飛ばさない。祝日・振替休日・長期休みの自動判定は未実装、保護者が各日を休みにして確定する。
- 夜の表示日・APIのチェック許可日を同じ判定に統一。未登録なら持ち物は未登録のまま、DBへ仮予定を作らない。新規日付の登校日チェックも平日のみ既定ON。
- 宿題新規入力欄に漢字：／計算：／音読：を初期表示。既存版は上書きしない。項目名だけの空行は確定対象から除外。
- DBマイグレーション・通知Worker・Cron・既存データの変更なし。HOMEのコード更新のみ。
- 検証：TypeScript、Wrangler dry-run、学校準備API統合、曜日・例外単体、DOM（初期項目・空項目除外・既存内容保持）合格。本修正の本番Build・実機確認は未確認。


## 2026-10-16 ごほうびプレゼント（本番未反映）

つうちょうの既存URLへごほうびプレゼント申請/承認を準備。独立ブランチのみ、本番未反映。 [設計・テスト・導入ゲート](passbook-gifts-20261016.md)。


## 2026-10-16 通帳表示・A4印刷（本番未反映）

既存つうちょうに「通帳表示・印刷」を準備。独立ブランチのみ、本番未反映。ママ銀行/おさいふ/ポイント別の帳面、全履歴/年月/期間、A4横片面二つ折りに対応。 [設計・検証・導入手順](passbook-book-20261016.md)。


## 2026-10-16 家系図の日付入力改善
人物・関係の日付入力で月日1桁/スラッシュ/全角数字を既存のYYYY-MM-DD形式へ正規化。年・年月のみと空欄も維持。西暦なし・存在しない日付は項目名と具体的な案内をダイアログ内に表示し、APIエラーも保存ボタン付近に表示。既存DB・権限・API・R2の変更なし。日付検証12ケース通過。対象：family-tree/app.js,index.html。HOME自動Build成功・実機確認は未確認。


## 2026-10-16 家系図の日付選択・スラッシュ表示
生年月日・命日・関係の開始日/終了日にブラウザ標準date pickerの「📅 選ぶ」を追加。入力表示はYYYY/MM/DD、手入力の年/年月のみ・空欄も維持。API送信時は従来のハイフン形式へ変換し、既存保存データを更新しない。年齢表示はスラッシュ入力からも計算。DB/API/認証/R2変更なし。Chromiumで4項目のpicker、選択反映、スラッシュ正規化、既存値、年のみ、空欄、不正入力案内、保存形式、390px幅のはみ出しなし・選択欄46pxを確認。iOSの標準選択UIと本番Build成功は未確認。対象：family-tree/app.js,index.html,style.css。
