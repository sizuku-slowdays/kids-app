# キッズ一覧整理といいことポイントのHOME本人対応

2026-10-15 JST。

## 状態

- 一覧整理：mainの `a0c12416e4762bd25525a0934499459a267a4e8b` へ反映。公開JSONのHTTP取得でも、mama-bank/pointsがなくpassbookがあることを確認。
- HOME本人対応：`feature/good-deeds-home-20261015` に実装・テスト。PR5/8389d7aを本番反映。00:28 Build成功・通帳データ保持・保護者から見た姉妹0開始を利用者確認済み。
- 一覧のいいことリンク統合と旧HTMLの転送：`feature/good-deeds-links-20261015` に準備。HOME新画面の配信・旧API保護・バックアップ後に適用する。
- つうちょう現金拡張：PR4は2a83a28で本番反映済み、全旧台帳の照合・本人現金口座と報酬を利用者確認済み。今回の統合でも0018・金融Cron・既存処理を保持。

## 確認済みの旧構成

`wagaya/apps.html` → `wagaya/js/apps.js` → `wagaya/data/apps.json` が共通一覧。kids/mamaの両方に対応。mama-bank/pointsの2カードを消し、現在の認証付きつうちょうを1つ表示。他のカードの全フィールドは維持。DB・履歴の削除なし。

旧いいことは `kanriapp/iikoto1.html` / `iikoto2.html`。それぞれ固定OWNER=saru/unicornを付け、`https://iikoto-api.sslowdayss.workers.dev/api/iikoto` へGET/POST/DELETEする。HTMLはHOME認証情報を送っていない。APIのレスポンス期待形式は records[{id,owner,title,point,memo,created_at}]。合計/今日/月/回数、登録、任意ポイントと10/50/100/500/1000の簡単選択、削除がある。

旧Workerコード全文は2026-10-15に利用者が提示。GET/POST/DELETE `/api/iikoto` が `env.DB` の `iikoto_records(id,owner,title,point,memo,created_at)` を操作する。owner=saru/unicornの文字列照合だけでHOME認証なし。CORSは*。利用者がDashboardで `DB → mama-bank-db` を確認（既存旧銀行と同じDB）。提示コードにpassbook台帳操作はない。旧人物コードを新しいユーザーへ推測で紐付ける必要はない。新台帳へ旧残高は移行しない。

10月16日00:17 JST、利用者のPCで旧DBの整合性・iikoto_recordsの存在/列/件数確認、最新home-dbのエクスポートと整合性、両SQLのSHA256保存がすべてOKとの報告。バックアップは利用者PCにあり、内容をGitHubへ保存しない。件数の数値自体は未報告。

旧公開API停止用 `cloudflare/iikoto-api/retired-worker.js` を準備した。該当ルートは410、OPTIONSは204、その他404。DBには一切アクセスせず、旧記録を保持する。HOME新画面の本番確認後にiikoto-apiへ別途反映するため、このファイルの追加だけでは旧API停止済みとは扱わない。

## 新しい方式

- 既存home-worker/DB=home-dbのHOMEセッションを利用。`/apps/good-deeds/` と `/api/good-deeds`。cetus.funでは `/wagaya/` 配下。
- 家庭membership・group_apps・children.user_id・users.display_nameをサーバーで照合。保護者=家庭owner/admin。子ども=自分のchildren行。祖父母等、子ども連携がなく管理者でもない人はAPI403。
- 子どもは自分の記録だけ閲覧・登録・削除。保護者は自分の家庭の登録済み子ども全員を選択して閲覧・登録・削除・復元。子ども数を固定しない。
- APIでhousehold/child/履歴カーソル/レコードの所有者を検証。ownerやuser_idパラメータは拒否し、投稿者はセッションから固定。別家庭や別の子のID、URL改変では取得・変更できない。
- 未認証API401、HTML/JS/CSSへの直接アクセスはHOMEログインへ誘導。私的データはno-store。APIのHTML誤解析を避ける。URLは相対解決し二重/wagayaを防止。
- 0019_good_deeds.sqlで `good_deed_starts` / `good_deed_records` / `good_deed_changes` の3表だけを新設。旧いいこと・つうちょうの表にはUPDATE/DELETE/INSERTしない。
- 初回の許可された閲覧時に、閲覧できる子どもに対して一度だけ新しい開始ID・開始日時を作る。新テーブルには旧データを取り込まないので0から始まる。
- 開始はchild_id一意で再実行しても既存の開始日やポイントを上書きしない。開始行は更新・削除禁止。後日積んだ新ポイントもリセットしない。
- 記録はchild_id/event_id一意。同時再送・上限到達時の再送でも1回だけ。ポイント1〜100,000,000、合計上限100,000,000をAPI・DBで検証。
- 削除は非表示化し、合計から除外。原本と監査履歴は保管。保護者の復元時も合計上限を検証。タイトル・ポイント等の原本は書き換え不可。
- 名前はHOMEユーザーのdisplay_name。旧うさぎ/ユニコーンコードは新データの所有者判定に使わない。
- 新画面は登録、簡単ポイント選択、最近・全履歴（50件ずつ）、今日/月/全体の集計、回数、開始日を維持。保護者の選択を素早く変えても古いリクエストの応答で表示を取り違えない。

## 切替時のリンク

一覧の旧2いいことカードを1つのgood-deedsカードへ置換し、旧iikoto1/2.htmlも新HOMEの同じ入口へ転送する。URLに古いOWNER/ユーザーIDを引き継がない。新入口がセッションで本人判定。これらは**未反映の準備**であり、現行旧画面へのリンクは一覧整理時には変更していない。

## 検証

- TypeScript、Wrangler dry-run、関連16テスト（HOME、通帳/交換、漢字、カレンダー共有/通知、家系図、外食、いいこと）。
- テスト用D1で姉妹2名が0から開始し、開始処理再実行後も新しく付与したポイントを維持。
- 本人名、保護者の2名選択、本人以外の子ども/家庭/レコード/カーソルへの403、未認証401/ログイン転送、owner偽装拒否、登録/削除/復元、同時再送と合計上限を検証。
- cash/choresの既存passbook_entriesを入れたテストDBで全行が前後同一。実データへのリセットやテスト付与なし。
- DOM操作：子ども画面に他の子の選択肢なし、HOME名、0開始、保護者選択、登録、/wagaya API URLを確認。スマホ用48pxボタン・レスポンシブCSSを実装。実iPhone/Android/PCでの目視は未確認。
- 全SQLをSQLite適用しintegrity=ok、foreign_key_issues=0。

## 統合検証と残作業（2026-10-16 JST）

- 現行HOME 2a83a28を基準にPR5を統合。0018金融機能・自動処理を残し、0019のみ新規追加。TypeScript、Wrangler dry-run、関連21テスト、子ども/保護者DOM試験を合格。旧API停止用2テストも合格。
- home-dbの変更前バックアップ：利用者PC `home-db-before-good-deeds-20261016-001714.sql`。旧mama-bank-dbも取得・検証済み。
- HOMEへ反映後、自動Build成功、既存passbookの全行保持、実アカウントごとの0開始と権限を確認する。Build成功・passbook全行保持・保護者画面の0開始は利用者確認済み。子ども本人の実機操作は未確認。
- 次にiikoto-apiへretired-worker.jsを反映し、旧公開経路が情報を返さないことを確認する。旧DBは削除・初期化しない。
- 新入口と旧API保護を確認した後、別PR6の一覧リンク統合と旧HTML転送を反映する。
- 実iPhone/Androidでの操作は利用者確認待ち。
- 10月14日の報酬補填は証拠不足のため保留。おさいふは利用者希望で後回し。学校準備・英語フラッシュは別PR7の準備に保持し本番未反映。


## 2026-10-16 反映・利用者確認（最新状態）

- つうちょう：PR4/2a83a28を10月15日18:01に本番反映。全既存passbook行照合はOK。本人の大人現金口座・お手伝い報酬、お小遣い5回設定・利息ONを利用者確認。おさいふは後回し。10月14日3件の補填は実記録不足で未処理。初回月次自動処理は未確認。
- いいこと：PR5/8389d7aを10月16日00:28に本番反映したBuild成功を利用者確認。最新バックアップとのpassbook全行照合は変更なし。保護者画面で姉妹のHOME表示名・選択・0開始を利用者確認。子ども本人ログイン/実モバイル操作は追加確認待ち。
- 旧保存先：利用者提示のiikoto-apiコードはDBのiikoto_recordsを操作し、固定owner文字列照合のみ。DashboardでDB→mama-bank-dbを確認。旧SQLと最新home-dbのバックアップ/整合性/SHA256保存は利用者PCで完了。実データを公開リポジトリへ置かない。
- 旧API：DBを一切参照しない410応答コードへの切替を00:45に利用者が完了報告。こちらのHTTP試験は実行環境から403となり、実際の410応答は独立確認できていない。旧DBは削除/リセットしない。
- 一覧：PR6で旧2いいことカードをgood-deeds 1枚へ統合し、旧iikoto1/2を /wagaya/apps/good-deeds/ へ転送。旧銀行/旧ポイントの削除と新つうちょうを維持。他アプリの全フィールド不変更を検証。Pagesの反映は利用者確認待ち。
- 引き続き保留：学校準備・英語フラッシュはPR7の準備コード（本番未統合）。デモアカウント案も保留。ポイント付与ルールなど未決定仕様を本番へ確定しない。
