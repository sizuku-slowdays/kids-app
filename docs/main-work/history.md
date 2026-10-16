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

実装コミット：[7474e9c](https://github.com/sizuku-slowdays/kids-app/commit/7474e9c4ce056abef18e74593e02046b8f91c5f9)（feature/calendar-family-tree-20261011）。HOME稼働ブランチは9cf5cb2のまま。本台帳の更新だけをmainへ反映し、アプリコード・Worker設定をmainへコピーしない。

## 2026-10-11：本番前の追加調整（本番未反映）

作業ブランチfeature/calendar-family-tree-20261011、[PR #3](https://github.com/sizuku-slowdays/kids-app/pull/3)。通知を一律停止せず、新公開範囲の未対応対象だけ停止。従来共有＋表示名追加だけの通知は継続。閲覧できる予定に所有家庭の管理者の編集／削除を許可し、本人限定予定はAPIから管理者にも返さない。編集後も元の登録者を維持。家系図は2人を順に削除・復元した場合の関係復元を修正し、独立して削除した関係は自動復元しない。

関連ファイル：calendar-worker.js、public/calendar.html、family-tree.ts、calendar-home/calendar-visibility/family-tree各テスト、scripts/check-deployment-backups.py、scripts/test-deployment-backups.py、管理資料。追加migrationはない。TypeScript・Wrangler dry-run・既存含む17テスト、バックアップ照合用Python3テストを実施。本番DB/R2のバックアップ・件数照合・実機試験は未実施。[手順](preproduction-backup.md)。

追加調整コミット：[859e14d](https://github.com/sizuku-slowdays/kids-app/commit/859e14d89c650a485095ccc4d4629c367de206fd)。本番未反映。mainは管理資料だけを更新。


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


## 2026-10-16 プレゼント申請：準備完了・本番待ち

学校準備修正版の13:07 Build成功を利用者確認。続いてプレゼント機能を独立準備。26 HOMEテスト、通知gift/学校単体、gift/既存金融DOM、旧行保持と同件数改変検出を確認。本番変更なし。 [PR9](https://github.com/sizuku-slowdays/kids-app/pull/9)、[固定版の設計・試験・導入手順](https://github.com/sizuku-slowdays/kids-app/blob/350128ab01665a6a8bf9520bd0ce09a990ba9e3f/docs/main-work/passbook-gifts-20261016.md)。HOME本番ブランチへは未統合、SQL・Workerは未反映。


## 2026-10-16 ごほうびプレゼント：本番反映・利用者確認済み

PR9はHOMEへ統合済み（665da2e8537f64fcffa56cbf80fc38cc6659a470）。通知DB追加SQL・通知Worker更新完了、13:52のHOME Build成功（Version cd42c5d0-18c7-453f-836e-f1499317ca45）を利用者報告。13:55、最新バックアップとの前後照合はHOME・通知DBともすべてOK、既存データ・通知設定不変との結果。14:01、保護者への申請通知と承認後の加算の両方を利用者が確認し、問題なさそうと報告。これにより前述の本番反映・前後照合・基本実機確認待ちは解消。却下・複数端末・全ユーザー組合せの本番試験は未確認（権限・却下・再試行・重複はローカル試験済み）。別家庭共有・受渡し/精算・家計簿連携は引き続き未実装。


## 2026-10-16 通帳表示・A4印刷：独立準備・本番待ち

通帳表示/印刷を独立実装。28 HOMEテスト、127件/長文/長い氏名のChromium画面試験、A4横9ページPDFのレイアウト・画像目視確認済み。本番DB変更・Deployなし。 [PR10](https://github.com/sizuku-slowdays/kids-app/pull/10)、[固定版の仕様・検証・導入手順](https://github.com/sizuku-slowdays/kids-app/blob/0565653f263f4f7d9ce882edf02926a9dd535160/docs/main-work/passbook-book-20261016.md)。本番統合は最新home-dbバックアップの読み取り専用監査待ち。DB変更・通知Worker更新不要。


## 2026-10-16 家系図の日付選択・スラッシュ表示
生年月日・命日・関係の開始日/終了日にブラウザ標準date pickerの「📅 選ぶ」を追加。入力表示はYYYY/MM/DD、手入力の年/年月のみ・空欄も維持。API送信時は従来のハイフン形式へ変換し、既存保存データを更新しない。年齢表示はスラッシュ入力からも計算。DB/API/認証/R2変更なし。Chromiumで4項目のpicker、選択反映、スラッシュ正規化、既存値、年のみ、空欄、不正入力案内、保存形式、390px幅のはみ出しなし・選択欄46pxを確認。iOSの標準選択UIと本番Build成功は未確認。対象：family-tree/app.js,index.html,style.css。

HOME実装版：[8a52939](https://github.com/sizuku-slowdays/kids-app/commit/8a52939400c0d23b7d69ac769c2aa1f85aef8608)。直前の日付エラー改善も継承。通帳印刷PR10は29956eaでHOMEへマージ済み、Build成功は未確認。


## 2026-10-16 ヌルボン福重店・店舗間料金比較
[実装・公式料金の確認記録](dining-nurubon-20261016.md)。[PR11](https://github.com/sizuku-slowdays/kids-app/pull/11)をHOMEへマージ（a5c8d173c77a20c53125ee1897511f08c0a25a12）。同じ7区分の参加人数からウエストは従来5区分へ合算。既存メニュー保持・追加前JSONを既存D1バックアップ表へ自動保存。新規DBマイグレーションなし。TypeScript/dry-run・HOME29テスト、390/1366px操作確認済み。本番Build成功/実iPhone/中高生の専用料金は未確認。URL：https://cetus.fun/wagaya/apps/dining-prices/?view=compare 。


2026-10-16 本番反映確認：GitHub Checksの「Workers Builds: home-worker」がa5c8d173c77a20c53125ee1897511f08c0a25a12に対してcompleted/success。Build ID 4e782d95-9fb6-4352-8dc4-d1bb4250255c。実iPhoneでの操作と中高生専用料金の店舗確認は引き続き未確認。
