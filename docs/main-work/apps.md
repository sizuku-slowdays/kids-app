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


## 2026-10-15 キッズ一覧の旧通帳リンク整理

`wagaya/data/apps.json` の旧mama-bank/pointsを削除し、HOME認証のつうちょうへ統一。共通JSONのためkids/mama両一覧に適用。他のカードは全フィールド維持。apps.jsとapps.htmlの版番号を更新し、旧DB・履歴・通帳の現金/ポイントには変更なし。いいことポイントの本人対応は別途調査・作業中。

未完了の引き継ぎ：つうちょう現金改修は[PR #4](https://github.com/sizuku-slowdays/kids-app/pull/4)でテスト済み。本番反映前の新しいhome-dbバックアップ・10月14日の未払い3件の実データ照合待ち。外出中のため保留し、今回の一覧整理に混ぜない。



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
