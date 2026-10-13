# 作業履歴

調査日：2026-10-09。GitHubのコミット日時・メッセージ・変更ファイルから確認した主要履歴。日付はJST。コードへの保存履歴であり、各Workerの本番反映済みを示しません。全履歴の代替ではなく、引き継ぎ上の主要変更を抽出しています。

| 日付（JST） | 変更 | ブランチ／コミット | 関連ファイル（抜粋） |
| --- | --- | --- | --- |
| 2026-10-02 | 招待制HOME共通認証の独立基盤を追加 | feat/home-auth-foundation / [05c501e](https://github.com/sizuku-slowdays/kids-app/commit/05c501e294b7f89d3eb8e81143e12e9e54569162) | [cloudflare/home-worker/migrations/0001_foundation.sql](https://github.com/sizuku-slowdays/kids-app/blob/05c501e294b7f89d3eb8e81143e12e9e54569162/cloudflare/home-worker/migrations/0001_foundation.sql)<br>[cloudflare/home-worker/migrations/0002_integrity.sql](https://github.com/sizuku-slowdays/kids-app/blob/05c501e294b7f89d3eb8e81143e12e9e54569162/cloudflare/home-worker/migrations/0002_integrity.sql)<br>[cloudflare/home-worker/src/index.ts](https://github.com/sizuku-slowdays/kids-app/blob/05c501e294b7f89d3eb8e81143e12e9e54569162/cloudflare/home-worker/src/index.ts) |
| 2026-10-02 | 本番で拒否されたPBKDF2反復数からscrypt形式へ変更 | feat/home-auth-foundation / [a6ed02f](https://github.com/sizuku-slowdays/kids-app/commit/a6ed02f81beaf069171ea2e844b3a8303a9e18bd) | [cloudflare/home-worker/src/security.ts](https://github.com/sizuku-slowdays/kids-app/blob/a6ed02f81beaf069171ea2e844b3a8303a9e18bd/cloudflare/home-worker/src/security.ts) |
| 2026-10-02 | 筋肉貯金をHOME本人認証・非公開保存へ接続 | feat/home-auth-foundation / [a0f7b6c](https://github.com/sizuku-slowdays/kids-app/commit/a0f7b6c066841beb640493f75f685cfe1a33ac0f) | [cloudflare/home-worker/migrations/0003_muscle_bank.sql](https://github.com/sizuku-slowdays/kids-app/blob/a0f7b6c066841beb640493f75f685cfe1a33ac0f/cloudflare/home-worker/migrations/0003_muscle_bank.sql)<br>[cloudflare/home-worker/src/index.ts](https://github.com/sizuku-slowdays/kids-app/blob/a0f7b6c066841beb640493f75f685cfe1a33ac0f/cloudflare/home-worker/src/index.ts)<br>[cloudflare/home-worker/src/muscle-bank.d.ts](https://github.com/sizuku-slowdays/kids-app/blob/a0f7b6c066841beb640493f75f685cfe1a33ac0f/cloudflare/home-worker/src/muscle-bank.d.ts) |
| 2026-10-03 | 旧データ非公開バックアップ・照合取込・大人用ポイント口座 | feat/home-auth-foundation / [283140e](https://github.com/sizuku-slowdays/kids-app/commit/283140e9f318c05f831ea54850f4a8525c9cff2a) | [cloudflare/home-worker/migrations/0005_passbook_migration.sql](https://github.com/sizuku-slowdays/kids-app/blob/283140e9f318c05f831ea54850f4a8525c9cff2a/cloudflare/home-worker/migrations/0005_passbook_migration.sql)<br>[cloudflare/home-worker/src/passbook-import.ts](https://github.com/sizuku-slowdays/kids-app/blob/283140e9f318c05f831ea54850f4a8525c9cff2a/cloudflare/home-worker/src/passbook-import.ts)<br>[cloudflare/home-worker/src/passbook.ts](https://github.com/sizuku-slowdays/kids-app/blob/283140e9f318c05f831ea54850f4a8525c9cff2a/cloudflare/home-worker/src/passbook.ts) |
| 2026-10-03 | 旧API停止確認をService bindingに変更 | feat/home-auth-foundation / [cca787d](https://github.com/sizuku-slowdays/kids-app/commit/cca787dc23584d8b8dd1052874dfbfcca0189403) | [cloudflare/home-worker/src/passbook-cutover.ts](https://github.com/sizuku-slowdays/kids-app/blob/cca787dc23584d8b8dd1052874dfbfcca0189403/cloudflare/home-worker/src/passbook-cutover.ts)<br>[cloudflare/home-worker/src/passbook.ts](https://github.com/sizuku-slowdays/kids-app/blob/cca787dc23584d8b8dd1052874dfbfcca0189403/cloudflare/home-worker/src/passbook.ts) |
| 2026-10-04 | 日々の当番ローテーションと重複しないポイント加算 | feat/home-auth-foundation / [406b045](https://github.com/sizuku-slowdays/kids-app/commit/406b0455208027937b7082bf5583da9f805d5025) | [cloudflare/home-worker/migrations/0007_passbook_chores.sql](https://github.com/sizuku-slowdays/kids-app/blob/406b0455208027937b7082bf5583da9f805d5025/cloudflare/home-worker/migrations/0007_passbook_chores.sql)<br>[cloudflare/home-worker/src/index.ts](https://github.com/sizuku-slowdays/kids-app/blob/406b0455208027937b7082bf5583da9f805d5025/cloudflare/home-worker/src/index.ts)<br>[cloudflare/home-worker/src/passbook-chores.ts](https://github.com/sizuku-slowdays/kids-app/blob/406b0455208027937b7082bf5583da9f805d5025/cloudflare/home-worker/src/passbook-chores.ts) |
| 2026-10-04 | 既存画像方式を再利用した交換商品カード・画像編集 | feat/home-auth-foundation / [7d42a99](https://github.com/sizuku-slowdays/kids-app/commit/7d42a99e5fa48f249d56d5988cd8ac7cffbcf390) | [cloudflare/home-worker/migrations/0010_passbook_reward_images.sql](https://github.com/sizuku-slowdays/kids-app/blob/7d42a99e5fa48f249d56d5988cd8ac7cffbcf390/cloudflare/home-worker/migrations/0010_passbook_reward_images.sql)<br>[cloudflare/home-worker/src/index.ts](https://github.com/sizuku-slowdays/kids-app/blob/7d42a99e5fa48f249d56d5988cd8ac7cffbcf390/cloudflare/home-worker/src/index.ts)<br>[cloudflare/home-worker/src/passbook-reward-images.ts](https://github.com/sizuku-slowdays/kids-app/blob/7d42a99e5fa48f249d56d5988cd8ac7cffbcf390/cloudflare/home-worker/src/passbook-reward-images.ts) |
| 2026-10-04 | 家計簿の資金繰りページ追加 | main / [ed5a574](https://github.com/sizuku-slowdays/kids-app/commit/ed5a5743f85213e2b71faf453722899a3f9f3236) | [kanriapp/kakeibo-cashflow.html](https://github.com/sizuku-slowdays/kids-app/blob/ed5a5743f85213e2b71faf453722899a3f9f3236/kanriapp/kakeibo-cashflow.html) |
| 2026-10-04 | cetus.fun/wagaya/でHOMEを同じURLのまま配信 | feat/home-auth-foundation / [019dc47](https://github.com/sizuku-slowdays/kids-app/commit/019dc4724d9edf94cea915bd412270dd499f7156) | [cloudflare/home-worker/src/home-mount.ts](https://github.com/sizuku-slowdays/kids-app/blob/019dc4724d9edf94cea915bd412270dd499f7156/cloudflare/home-worker/src/home-mount.ts)<br>[cloudflare/home-worker/src/index.ts](https://github.com/sizuku-slowdays/kids-app/blob/019dc4724d9edf94cea915bd412270dd499f7156/cloudflare/home-worker/src/index.ts) |
| 2026-10-05 | カレンダーのHOME本人連携と所有者限定閲覧 | feat/home-auth-foundation / [15d6a7a](https://github.com/sizuku-slowdays/kids-app/commit/15d6a7ad2db861bdde8871f30e47269d393e87e2) | [cloudflare/calendar-worker/calendar-worker.js](https://github.com/sizuku-slowdays/kids-app/blob/15d6a7ad2db861bdde8871f30e47269d393e87e2/cloudflare/calendar-worker/calendar-worker.js)<br>[cloudflare/home-worker/src/calendar.ts](https://github.com/sizuku-slowdays/kids-app/blob/15d6a7ad2db861bdde8871f30e47269d393e87e2/cloudflare/home-worker/src/calendar.ts)<br>[cloudflare/home-worker/src/index.ts](https://github.com/sizuku-slowdays/kids-app/blob/15d6a7ad2db861bdde8871f30e47269d393e87e2/cloudflare/home-worker/src/index.ts) |
| 2026-10-05 | 特定済み旧共通カレンダーのバックアップ付き廃止処理を修正 | feat/home-auth-foundation / [b21bdf7](https://github.com/sizuku-slowdays/kids-app/commit/b21bdf7fd579891b1f8841365992224e511afb9b) | [cloudflare/calendar-worker/calendar-worker.js](https://github.com/sizuku-slowdays/kids-app/blob/b21bdf7fd579891b1f8841365992224e511afb9b/cloudflare/calendar-worker/calendar-worker.js) |
| 2026-10-05 | アルバム再接続・アップロード修正の関連HTML更新 | main / [2538201](https://github.com/sizuku-slowdays/kids-app/commit/25382013ce57b64b4f0dddad2d047994e7eff50c) | [wagaya/album/index.html](https://github.com/sizuku-slowdays/kids-app/blob/25382013ce57b64b4f0dddad2d047994e7eff50c/wagaya/album/index.html) |
| 2026-10-05 | 携帯幅へカレンダーを収め、本人設定をプロフィールへ移動 | feat/home-auth-foundation / [5812b70](https://github.com/sizuku-slowdays/kids-app/commit/5812b7015e51386461dc5c37ce731867e6093099) | [cloudflare/home-worker/public/calendar.html](https://github.com/sizuku-slowdays/kids-app/blob/5812b7015e51386461dc5c37ce731867e6093099/cloudflare/home-worker/public/calendar.html) |
| 2026-10-05 | 本人ごとのHOMEアプリ順変更 | feat/home-auth-foundation / [adf7583](https://github.com/sizuku-slowdays/kids-app/commit/adf7583c16dfabbd5f6ad9e86760a0f5728bf0dd) | [cloudflare/home-worker/src/index.ts](https://github.com/sizuku-slowdays/kids-app/blob/adf7583c16dfabbd5f6ad9e86760a0f5728bf0dd/cloudflare/home-worker/src/index.ts) |
| 2026-10-05 | 家計簿の支払方法をまたぐ直近10件表示 | main / [56b7f76](https://github.com/sizuku-slowdays/kids-app/commit/56b7f7626ea1bd54b066b8d0b4cbc0f21c4aea43) | [kanriapp/kakeibo-app.html](https://github.com/sizuku-slowdays/kids-app/blob/56b7f7626ea1bd54b066b8d0b4cbc0f21c4aea43/kanriapp/kakeibo-app.html) |
| 2026-10-05 | 新HOMEでの時間割画像フォールバック修正 | main / [84d42af](https://github.com/sizuku-slowdays/kids-app/commit/84d42afe7ab4e5539332f14bbdc837fe7ad00455) | [wagaya/timetable.html](https://github.com/sizuku-slowdays/kids-app/blob/84d42afe7ab4e5539332f14bbdc837fe7ad00455/wagaya/timetable.html) |
| 2026-10-05 | よく使うアプリを選択・重複排除、通帳の家庭残高を先に表示 | feat/home-auth-foundation / [a6627ff](https://github.com/sizuku-slowdays/kids-app/commit/a6627ffefe74c158df3c0fb3774c566a946afabd) | [cloudflare/home-worker/migrations/0011_home_favorites.sql](https://github.com/sizuku-slowdays/kids-app/blob/a6627ffefe74c158df3c0fb3774c566a946afabd/cloudflare/home-worker/migrations/0011_home_favorites.sql)<br>[cloudflare/home-worker/src/index.ts](https://github.com/sizuku-slowdays/kids-app/blob/a6627ffefe74c158df3c0fb3774c566a946afabd/cloudflare/home-worker/src/index.ts) |
| 2026-10-05 | からだパワーの食品データ更新 | main / [7afd932](https://github.com/sizuku-slowdays/kids-app/commit/7afd93235cc6f4cfec2568e07819a028a95789a9) | [karada_power/data.js](https://github.com/sizuku-slowdays/kids-app/blob/7afd93235cc6f4cfec2568e07819a028a95789a9/karada_power/data.js) |
| 2026-10-05 | 食事チェックをじいちゃん／ばあちゃん別に分離 | feat/home-auth-foundation / [6088794](https://github.com/sizuku-slowdays/kids-app/commit/6088794d62adaa3ab5e33c190d8ad0993296fae8) | [cloudflare/home-worker/migrations/0012_kidney_people.sql](https://github.com/sizuku-slowdays/kids-app/blob/6088794d62adaa3ab5e33c190d8ad0993296fae8/cloudflare/home-worker/migrations/0012_kidney_people.sql)<br>[cloudflare/home-worker/src/index.ts](https://github.com/sizuku-slowdays/kids-app/blob/6088794d62adaa3ab5e33c190d8ad0993296fae8/cloudflare/home-worker/src/index.ts)<br>[cloudflare/home-worker/src/kidney.ts](https://github.com/sizuku-slowdays/kids-app/blob/6088794d62adaa3ab5e33c190d8ad0993296fae8/cloudflare/home-worker/src/kidney.ts) |
| 2026-10-06 | 日付タップで作成画面を開かず、＋で選択日の作成 | feat/home-auth-foundation / [4fae49d](https://github.com/sizuku-slowdays/kids-app/commit/4fae49d20af228c4f1030e0419b800785c524ac4) | [cloudflare/home-worker/public/calendar.html](https://github.com/sizuku-slowdays/kids-app/blob/4fae49d20af228c4f1030e0419b800785c524ac4/cloudflare/home-worker/public/calendar.html) |
| 2026-10-06 | 終日繰り返しの初回重複を防止・除外日を反映 | feat/home-auth-foundation / [d98faeb](https://github.com/sizuku-slowdays/kids-app/commit/d98faebf08e725c826ccd72f0b964cdbbc7cb3f8) | [cloudflare/calendar-worker/calendar-worker.js](https://github.com/sizuku-slowdays/kids-app/blob/d98faebf08e725c826ccd72f0b964cdbbc7cb3f8/cloudflare/calendar-worker/calendar-worker.js) |
| 2026-10-06 | 共通カレンダーへ全員投稿可、変更／削除は登録者本人のみ | feat/home-auth-foundation / [9cf5cb2](https://github.com/sizuku-slowdays/kids-app/commit/9cf5cb27197e851d91a5e9f9146da76cf9fc1dbb) | [cloudflare/calendar-worker/calendar-worker.js](https://github.com/sizuku-slowdays/kids-app/blob/9cf5cb27197e851d91a5e9f9146da76cf9fc1dbb/cloudflare/calendar-worker/calendar-worker.js) |

アルバム修正はmainのf1e871b／09d7914／2538201とHOMEブランチのfb90f00／a0ae7f5／446bf39に分かれます。単一HTMLコミットだけを全修正の正本にしないでください。

## 元の履歴と検証記録

主要変更の関連ファイル全件は各コミットリンクを参照。さらに前の履歴は[mainの履歴](https://github.com/sizuku-slowdays/kids-app/commits/main/)と[HOMEブランチの履歴](https://github.com/sizuku-slowdays/kids-app/commits/feat/home-auth-foundation/)を確認します。今回各ブランチの直近100コミットと上表の変更ファイルを調査しました。

HOMEにはfoundation、home-mount、passbook、passbook-import、calendar-home、calendar-recurrence等のテストファイルがあります。今回の管理資料作成ではアプリテストを再実行していません。過去READMEの「通過」記載は当時の記録であり、最新本番の全動作確認とは扱いません。

## 2026-10-09：メインWork管理資料を追加

- kids-appのmain／HOME作業ブランチ、他3リポジトリの一覧・READMEを調査。
- アプリ一覧、Worker表、仕様・保存先、履歴、未完了事項、更新手順をdocs/main-work/へ作成。rootのAGENTS.mdに今後の資料更新ルールを追加。
- コード・Worker設定・SQL・実データは変更なし。管理資料のリンク・表・変更ファイル範囲を検証。
- 本番の新規デプロイ・DB照会・ログイン権限試験は今回実施せず、未確認として整理。

## 2026-10-11（作業ブランチ・本番未反映）

利用者提供のHOME／カレンダーD1スキーマとDashboard Bindingsを照合。既存36／13業務テーブル。旧アルバムの画像配信が認証前に分岐するため、その公開URL方式は家系図に再利用しない。

変更：cloudflare/home-worker/src/index.ts、calendar.ts、household-people.ts、family-tree.ts、migrations/0013_family_tree.sql、public/calendar.html、public/apps/family-tree/*、test/calendar-home.test.mjs、calendar-visibility.test.mjs、family-tree.test.mjs、kinship.test.mjs。cloudflare/calendar-worker/calendar-worker.js、migrations/0001_calendar_visibility.sql。管理資料docs/main-work/*更新。

既存のカレンダー・つうちょう・残高・アルバム保存データを初期化するSQLは実行していない。既存テーブルの移し替えは不要。追加スキーマの本番適用・デプロイは未実施。検証：TypeScript、構文、Wrangler dry-run、既存含む17テスト成功。実機は未確認。詳細：[導入手順と残り](https://github.com/sizuku-slowdays/kids-app/blob/feature/calendar-family-tree-20261011/docs/main-work/calendar-family-tree.md)。

## 2026-10-11：本番前の追加調整（本番未反映）

作業ブランチfeature/calendar-family-tree-20261011、[PR #3](https://github.com/sizuku-slowdays/kids-app/pull/3)。通知を一律停止せず、新公開範囲の未対応対象だけ停止。従来共有＋表示名追加だけの通知は継続。閲覧できる予定に所有家庭の管理者の編集／削除を許可し、本人限定予定はAPIから管理者にも返さない。編集後も元の登録者を維持。家系図は2人を順に削除・復元した場合の関係復元を修正し、独立して削除した関係は自動復元しない。

関連ファイル：calendar-worker.js、public/calendar.html、family-tree.ts、calendar-home/calendar-visibility/family-tree各テスト、scripts/check-deployment-backups.py、scripts/test-deployment-backups.py、管理資料。追加migrationはない。TypeScript・Wrangler dry-run・既存含む17テスト、バックアップ照合用Python3テストを実施。本番DB/R2のバックアップ・件数照合・実機試験は未実施。[手順](preproduction-backup.md)。

## 2026-10-11 22時台 JST：変更前バックアップ確認

利用者がhome-db/calendar-dbをSQLエクスポートし、ローカルメモリ内SQLiteで読み込み・整合性OK、外部キー不整合0を報告。両Workerの稼働コード保存・構文チェック・SHA-256、Bindingsと設定のスクリーンショット保存を報告。GitHubには実データ・Secret値・Bookmark実値を保存しない。R2コピー、本番反映後照合、実機権限試験は未実施。詳細：[バックアップ記録](preproduction-backup.md)。

## 2026-10-11 23時台 JST：本番反映と照合・カレンダー表示負荷の修正

利用者報告：f56cf5dのHOMEビルド成功（Version 5f3f63d5-28c2-44b3-bccc-bf20a12677fd）、calendar-workerの全文貼り替え・Deploy完了。反映後SQLを取得し、照合ツールのhome/calendar両プロファイルok=true、issues=[]。HOMEは予定した8テーブルと家系図アプリのみ追加。Calendar初回アクセス前の照合では新テーブルなし。既存レコードの件数・内容維持を利用者端末で確認。写真/R2コピーと家庭別権限の実機検証は未完了。

カレンダー再表示も遅いと利用者報告。表示処理で本人プロフィールを繰り返し問い合わせ、予定ごとに通知公開範囲を再照会していたため、リクエスト内で本人取得Promiseを共有し、通知の表示情報には既に取得したACLとカレンダーを使用するよう変更。別リクエスト・別利用者へキャッシュしない。通知配信時は従来どおりDBの最新状態を確認。既存データ・スキーマ・HOME実装は変更なし。calendar-read-performance/calendar-home/calendar-visibility/calendar-recurrenceの計6テスト成功。実環境の速度改善は未確認。関連：cloudflare/calendar-worker/calendar-worker.js、cloudflare/home-worker/test/calendar-read-performance.test.mjs。

## 2026-10-11 23:13 JST：家系図の配信JavaScript構文を修正

利用者が送ったブラウザ配信app.jsとGitHub f56cf5dのapp.jsを照合し、recenter内のconstがonstになっていることを確認。ローカル検証用ファイルにはこの欠落がなかったため従来チェックでは検出できなかった。GitHub取得内容を直接修正し、修正後の内容をNode module構文チェックで確認。人物・関係・写真・権限・DBスキーマは変更なし。ブラウザ初期表示の再確認は未完了。カレンダー速度修正版は利用者が手動Deployし、若干改善したと報告、現状を了承。

## 2026-10-11：家系図に人物一覧を追加

関係がまだない人物はツリーの表示範囲から外れて登録確認しづらいとの利用者報告に対応。家系図上部に全人物の一覧と人数を追加し、関係未登録を明示。名前から人物情報、中心に表示からツリー移動。APIで許可された現在の家庭のpeopleだけを表示し、子どもの閲覧専用動作を維持。セッション失効時の一覧消去も追加。人物・関係・写真の実データ、DB・Worker権限処理は変更なし。関連：public/apps/family-tree/index.html、app.js、style.css。GitHub取得内容を修正後にmodule構文確認。本番表示は反映後確認待ち。

## 2026-10-11：続柄の表示基準切り替えと人物一覧の省スペース化

人物選択／一覧の「この人から見る」で、ツリーの中心と続柄の基準人物を切り替え。「自分から見る」でHOMEに紐づく本人へ戻す。ログインユーザーやAPI権限は変えず、表示だけを切り替える。初期表示はHOME本人が基準。家庭変更・認証失効時に表示基準を消去。人物一覧は初期折りたたみ、展開時も高さ240pxの内部スクロールに制限。関連：public/apps/family-tree/app.js、index.html、style.css。DB・API・保存済み人物情報の変更なし。修正した配信対象JSのmodule構文確認。本番操作確認は待ち。

## 2026-10-11：人物追加と最初の関係を一括保存

人物追加フォームで登録済みの相手と「その人の親／子ども／配偶者／きょうだい／養親／養子／育てる人／パートナー」を選択可能。新規人物POSTのinitial_relationshipをAPI側で検証し、同家庭の活動中の相手のみ許可。人物と関係を同じrevisionガード付きD1 batchで保存し、失敗時に片方だけ残さない。既存人物の編集は元の関係を変更しない。関係欄は折りたたみ、選択人物の関係だけを表示し、全員表示を任意で切り替え。別の関係追加も選択人物を初期選択。既存データ・スキーマの変更／移行なし。関連：src/family-tree.ts、public/apps/family-tree/app.js・index.html、family-tree.test.mjs。

検証：TypeScriptチェック、Wrangler dry-run、配信対象JS構文、family-tree/kinship計2テスト成功。追加試験で相手不明・revision競合時に人物が残らないこと、子どもの403、成功時に親子関係と人物が同一revisionで作成されることを確認。本番のフォーム操作は反映後確認待ち。

## 2026-10-12 JST：きょうだいの出生順・自動年齢表示

家系図の同世代で、親を共有する人物／明示きょうだい関係の並びを年上から左へ変更。生年月日不明時の手動birth_order（1〜1000）を人物に追加し、両者に設定があるときは順番優先。既存人物の未指定値はNULL。0014_family_tree_birth_order.sqlは列追加のみ、既存データを更新・削除しない。年齢は保存せず、日本時間の今日と生年月日から表示時に計算し、開いたままでも日付変更を60秒間隔で確認。年月日不明は年齢空欄、命日ありは命日時点の年齢。人物カード・一覧・詳細に表示。バックアップ／復元はbirth_orderを含め、旧バックアップの未指定はNULLとして読み込む。本番確認は反映後。

TypeScript・配信対象JS構文・Wrangler dry-run・family-tree/kinship計3テスト成功。新しく登録された家系図データを含む反映直前HOME SQLの取得確認まで本番ブランチを変更しない。作業ブランチへの保存のみ。

2026-10-12 00:04 JST利用者報告：登録済み家系図を含むhome-db-before-birth-order.sqlの追加エクスポート成功。ローカルメモリ内SQLiteへ読み込み、integrity_check=ok、foreign_key_check問題0。バックアップ実データと署名URLはGitHubへ保存していない。これを確認して出生順追加の本番ビルド対象ブランチへ反映する。本番ビルド成功・実機表示は確認待ち。

## 2026-10-12：家系図の家庭ごとの枝分け・いとこの表示

同じ世代を一列に均等配置していた表示を変更し、親ごとに子どもの枝をまとめ、異なる家庭の間隔を広げる。表示範囲の初期値を4段階（いとこまで）にし、本人切替でいとこが消える問題を修正。明示きょうだい関係から親をたどる表示用の推定辺を作り、兄視点で妹の親が親せきになる問題と、祖父母未登録時のいとこ判定を修正。推定関係はDBへ保存せず点線で表示。元の人物・関係・権限は変更なし。関連：public/apps/family-tree/kinship.js、app.js、index.html、kinship.test.mjs。本番再確認待ち。

検証：配信対象JS構文、kinship計3テスト成功。ママ・長女・次女・兄の各表示基準で、いとこが残ること、兄がママの左、その子が姉妹の枝と分離、きょうだいの年齢順、兄から見た親の呼び名、元のrelations配列を変更しないことを確認。

## 2026-10-12：夫婦・パートナーを隣に配置

きょうだいをまとめたあと配偶者だけが右端になる問題を修正。同世代の現在の婚姻／パートナー関係も配置単位に含め、出生順のきょうだい各人の横に現在の相手を配置する。私・妹・夫・妹夫の入力順でも、私・夫・妹・妹夫となることを本人／妹／夫視点で検証。離婚・終了関係は隣合わせの対象にしない。データ・API・権限・DB変更なし。関連：public/apps/family-tree/kinship.js、test/kinship.test.mjs。構文・kinship計4テスト成功、本番画面の再確認待ち。

## 2026-10-12：伯父・伯母／叔父・叔母と読みを表示

続柄の表示に親のきょうだいの出生順判定を追加。親より年上は伯父（おじ）／伯母（おば）、年下は叔父（おじ）／叔母（おば）。手動birth_orderを優先、次いで判定できる生年月日を使用。順番不明は「おじ／おば（年上・年下は未設定）」とし、推測で伯／叔を確定しない。現在の配偶者にも血縁側の年齢関係を適用。DB・登録データ変更なし。関連：kinship.js、kinship.test.mjs。構文・kinship計5テスト成功。本番確認は反映後。

## 2026-10-12：婚姻とパートナーの続柄表示を区別

現在の婚姻関係は相手の人物区分に応じ夫／妻／配偶者と表示。partnershipはパートナーのまま。離婚した婚姻は元夫／元妻／元配偶者。きょうだいの婚姻相手は血縁側のきょうだい順から義兄（ぎけい）／義弟（ぎてい）／義姉（ぎし）／義妹（ぎまい）、順番不明はきょうだいの夫／妻として推測を避ける。DB・関係の登録値・API権限変更なし。関連：kinship.js、kinship.test.mjs。構文・kinship計6テスト成功。本番再確認待ち。

## 2026-10-12：人物の登録・編集で両親を選択

人物フォームに親①・親②の登録済み人物選択を追加。既存人物は登録済みの血縁親を選択済みとして表示し、もう一方の親を選んで保存できる。新規登録でも両親を同時選択。婚姻相手を自動的に親と見なさず、利用者が選んだ親だけをparent_idsでAPIへ送り、人物と親子関係を同じrevision付きD1 batchで保存。同家庭・活動中・自己参照・重複・循環を検証。既存の同一親子関係は重複追加せず、既存関係の削除・置換は行わない。DB列追加や移行なし。関連：src/family-tree.ts、public/apps/family-tree/app.js・index.html、test/family-tree.test.mjs。本番操作確認待ち。

検証：TypeScript・JS構文・Wrangler dry-run・family-tree/kinship計7テスト成功。既存子どもに2人目の親を追加でき、1人目を重複させず、再保存で増殖しないこと、親子循環の入力時は人物と関係を変更せず失敗することを追加確認。

## 2026-10-12：親を設定し直しても出生順を維持

親を追加したあと兄が右端へ移る利用者報告に対応。取得順で先に来る配偶者を起点に夫婦をまとめると、後から更新された血縁側の出生順が崩れるケースを確認。明示きょうだい・親を共有するきょうだいを夫婦配置の起点として優先し、配偶者の先行取得に左右されないよう修正。父母を全員へ設定したモデルで、4種類の取得順でも兄夫婦・本人夫婦・妹夫婦の順序を維持するテストを追加。DB/API/人物・関係データは変更なし。kinship.js、kinship.test.mjs。構文とkinship計7テスト成功。本番操作確認待ち。


## 2026-10-12：カレンダー通知先をHOME個人と閲覧範囲へ接続

旧の固定家族recipient一覧を、HOMEの表示名とカレンダー/予定の閲覧可能者から選ぶ方式へ変更。端末はHOME本人として明示登録し、配信時に最新の家庭・予定権限と登録セッション有効性を確認。新旧通知の全員扱いを分離し、旧Workerへの新ID同期を防止。提供された通知Workerコードを `cloudflare/notification-center-api/` に保存。既存の通知ルール、銀行・ポイント・画像は初期化しない。通知DBバックアップを利用者が取得・整合性ok/外部キー問題0/4テーブル・SHA保存を確認。既存HOME bootstrapの `nv.DB` 誤記も `env.DB` に修正。

関連：HOME src/index.ts・notifications.ts・calendar.ts・home-mount.ts・public/calendar.html・notify-sw.js・wrangler.jsonc、calendar-worker.js、notification-center-api.js、通知/共有テスト。DB追加は通知DBの端末本人リンク1テーブル（初回登録時CREATE IF NOT EXISTS）のみ。既存予定の通知先は保存前には変更しない。

実装と自動試験済み。HOMEはGit更新後のビルド確認が必要。calendar-worker / notification-center-apiは利用者による手動Deployと実機配信確認待ち。導入・復旧判断は `cloudflare/notification-center-api/README.md` を参照。

追加検証：通知DBへHOME予定名・詳細を予約文として保存せず汎用文にし、許可された配信時だけ最新の予定名を取得。旧管理APIからHOME通知ルールを除外。


## 2026-10-12：子ども世帯が増えても夫婦の間隔を保つ家系図配置

現婚姻/パートナーの双方に子孫用の幅を別々に割り当てていたため、祖父母に3つの子ども世帯があると夫婦カードが大きく離れる不具合を再現。現夫婦を配置ブロックとして扱い、共通の子孫の幅は1回だけ予約し、夫婦カードは近くに配置。子ども世帯ごとの余白と、きょうだいの出生順は維持。人物・関係・写真・DB・権限の変更なし。

変更：public/apps/family-tree/kinship.js と test/kinship.test.mjs（HOME配下）。子ども人数1/2/3の3世帯を持つ祖父母、6人の視点、入力順反転、カード重なり、既存続柄/出生順を含む8試験通過。修正前は祖父母間隔1296、修正後は180（論理座標）。HOMEのGit自動ビルド反映待ち、利用者の実画面確認は未確認。


## 2026-10-12：翌日利用向けの外食料金アプリ新規実装

HOME内に外食料金→店舗一覧→店舗別シミュレーターを新設。提示されたウエスト橋本店の税込価格20セルを初期登録し、人数5区分の増減と全コース/コース間差を即時計算。店舗・コース・料金の編集は家庭別D1永続保存、revisionで同時更新を保護。既存アプリ・予定・通帳・画像への更新処理は追加していない。

変更：HOME src/dining-prices.ts、src/index.ts、public/app.js、public/apps/dining-prices/{index.html,app.js,calculator.js,style.css}、migrations/0015_dining_prices.sql、test/dining-prices.test.mjs、関連管理資料。移行は新テーブル1個と新アプリ/家庭利用権限の追加のみ。既存テーブルを削除・ALTER・置換しない。既存HOMEのWrangler・Bindings・R2設定は変更していない。

検証：TypeScript・JS構文・HOME dry-run、提示表の全区分・1大人2小学生/8人構成の合計/差額・永続追加/削除・空状態保持・競合保存・未認証/子ども/別家庭の権限・HOME導線/API・既存認証/URLの回帰試験通過。本番反映はGitビルド確認待ち。クラウドブラウザのHOMEはログイン画面であり、ログイン後と実機iPhoneの操作確認は未完了。

外食料金のスマホ編集グリッドにminmax(0,1fr)/min-width:0を指定し、数値入力で画面が横に広がらないよう調整。本番入口は確認用ブラウザでHOMEログインへ移動することを確認。ログイン後・実機iPhoneは未確認。GitHubのcommit status/check-runにはCloudflareのビルド結果が掲載されておらず、本番ビルドSuccessは利用者確認待ち。


## 2026-10-12：婚姻未登録の両親の家系図配置を補完

利用者の匿名化スクリーンショットでは上段の父母カードが両端にあり、下段3家族への親子線が長いことを確認。ただし写真だけで婚姻の登録有無は確定できない。前の配置修正が婚姻/パートナー登録だけを対象としていた対象漏れを修正し、同じ登録済み子どもの集合を持つ一意な両親2人も同じ配置ブロックにする。婚姻/続柄を推定登録せず、API/DBデータは変更しない。明示の離婚/関係終了・別の現配偶者・3人以上の候補・保護者のみの関係は自動近接の対象外。kinship.jsの読み込みURLへ版を付け、古いモジュールの再利用を防ぐ。9件の配置/続柄試験通過。画像・本名・人物情報はGitHubへ保存しない。本番Gitビルドと利用者画面での確認待ち。

利用者報告：外食料金はiPhoneで使用し問題なし（2026-10-12）。本番で利用可能との報告として記録。


## 2026-10-12：ビフテキうえすたん姪浜店・全単品メニューを追加

公式の店舗専用menu-arita.pdfを直接取得し、6ページの文字抽出とPNG目視を照合。店舗ページwestern-aritaはウエストコート姪浜店であることを確認。他店舗・共通Web料金から補完しない。106商品/189税込価格選択肢を登録用データ化し、紙面ページ別集計と同数照合。画像のみの5ページ（お得なセット5品）も登録。読み取り不能0。取得PDFの内部ModDateは2025-05-27、紙面改訂日は記載なし。2026-10-12時点で指定された公式公開ファイルの内容として記録し、2026年版に改訂されたとは断定しない。

既存料金のD1内スナップショット・取込一意印を追加し、家庭ごとに既存店舗へ追記。旧食べ放題の価格・人数・合計機能を維持。APIは従来の家庭認証・大人編集権限・CAS更新を継続。商品管理/カテゴリ/サイズ/価格/非表示、通常/ランチ/持帰切替、検索/ページ送り、数量/注文欄/小計/合計を実装。

変更：src/dining-prices.ts・dining-western.ts・index.ts、public/apps/dining-prices/{index.html,app.js,order.js,calculator.js,style.css}、migrations/0016_dining_order_imports.sql、外食料金試験・DOM操作確認スクリプト、western-menu-audit.json、管理資料。新Worker/既存Bindings/旧アプリ/R2の変更なし。

検証：TypeScript・JS構文・HOME dry-run、料金/全商品数/画像ページの商品数/時間帯別価格/合計/小計、API永続保存・旧料金退避/保持・削除後非再取込・家庭/子ども権限・同時更新、既存HOME/家系図を含む15試験通過。Node DOM操作で2店舗、食べ放題9416円、サイズ選択、単品5260円、カテゴリ/店舗変更の保持、注文全削除、価格編集・保存の操作を確認。PC/iPhoneの実ブラウザ描画・本番ログイン後は未確認。Gitビルド反映確認待ち。


2026-10-13：利用者が姪浜店で食べたことを確認し、公式共通メニュー掲載キッズプレート（税込700円）を追加。既存家庭には1回だけ追記し、料金編集や後の非表示・削除を上書きしない。


2026-10-13：カレンダー通知端末登録のnotify-sw.jsがWorker直接URLで404となる配信ルート漏れを修正。公開するのは個人情報を含まない通知スクリプトのみ。通知API500を操作・HTTP・匿名化理由で診断可能に変更。iPhoneのサーバーエラー原因と実通知到着は未確認。


2026-10-13：本番push_subscriptionsのrecipient CHECK（mama/child1/child2/all）によりhome-only保存が失敗することを利用者提供DDLで確定。旧テーブルの構造と既存端末は維持し、home_notification_only_endpoints区分テーブルで旧全員配信を除外する方式へ修正。通知Worker再Deploy・実通知確認待ち。


2026-10-13：スマホの月カレンダーで日付と予定を誤タップする問題を改善。日付ボタン44px高・18px文字、一日一覧の予定を64px高・17px文字に拡大。スマホ月枠内は予定文字を含め日付選択に統一し、詳細は下の大きな一覧で開く。PCの月予定直接選択は維持。DB・通知配信処理の変更なし。


2026-10-13追加修正：利用者確認で月枠内の拡大が予定一覧性を下げたため、月の日付・予定文字・セル高を拡大前に復元。月枠内の予定クリックは全端末で日付選択のみ。下の一日予定一覧は大きな行/文字を維持し詳細選択可能。
