# キッズ一覧整理といいことポイントのHOME本人対応

2026-10-15 JST。

## 状態

- 一覧整理：mainの `a0c12416e4762bd25525a0934499459a267a4e8b` へ反映。公開JSONのHTTP取得でも、mama-bank/pointsがなくpassbookがあることを確認。
- HOME本人対応：`feature/good-deeds-home-20261015` に実装・テスト。**本番未反映。実際の姉妹の新残高への切替も未実施。**
- 一覧のいいことリンク統合と旧HTMLの転送：`feature/good-deeds-links-20261015` に準備。HOME新画面の配信・旧API保護・バックアップ後に適用する。
- つうちょう現金拡張：[PR #4](https://github.com/sizuku-slowdays/kids-app/pull/4)は**本番反映前home-dbバックアップ・2026-10-14未払い3件の実照合待ち**。今回の実装へ混ぜず保留。

## 確認済みの旧構成

`wagaya/apps.html` → `wagaya/js/apps.js` → `wagaya/data/apps.json` が共通一覧。kids/mamaの両方に対応。mama-bank/pointsの2カードを消し、現在の認証付きつうちょうを1つ表示。他のカードの全フィールドは維持。DB・履歴の削除なし。

旧いいことは `kanriapp/iikoto1.html` / `iikoto2.html`。それぞれ固定OWNER=saru/unicornを付け、`https://iikoto-api.sslowdayss.workers.dev/api/iikoto` へGET/POST/DELETEする。HTMLはHOME認証情報を送っていない。APIのレスポンス期待形式は records[{id,owner,title,point,memo,created_at}]。合計/今日/月/回数、登録、任意ポイントと10/50/100/500/1000の簡単選択、削除がある。

**旧Workerのコード、Bindings、実際のDB/KV等の保存先・テーブル名・認証実装・旧件数は未確認。** GitHubのmain/cloudflareはmuscle-bank-workerのみ、HOMEブランチ/cloudflareはcalendar-worker/home-worker/notification-center-apiで、iikoto Workerコードがない。つうちょうのpassbook台帳へ送るコードは旧いいことHTMLにはない。saruがどのHOMEユーザーかを推測して紐付けない。旧APIの一般公開防止は、新URLへのリンク変更だけでは完了と扱わない。

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

## 残作業・必要な事実

1. 利用者が帰宅後、Cloudflare `iikoto-api` のWorkerコードとBindings（保存先名）を確認。旧APIの公開経路や他用途を推測で停止しない。
2. 実保存先が判明したら旧いいことDB/データのバックアップを取得・件数検証。旧記録を新しい残高へ入れない。旧名コードの人物対応付けも不要。
3. home-dbの新しい全体バックアップと整合性確認。保留のPR4とまとめて取得できるが、本番反映はそれぞれの差分を再照合。
4. 旧APIの未認証アクセスを止める方法を、実コードを見て実装。HOME新画面からの接続先は旧APIではないので、新画面を守るだけで旧API保護済みと報告しない。
5. HOME本人対応を先に配信して、実アカウントごとの0開始・権限を確認。その後にリンク/旧HTMLを切替。旧記録は保管。
6. PR4は別件として復帰。HOME共通ファイル・管理資料・マイグレーションの差分を再統合し、本番反映前バックアップ、10/14の実記録照合を省略しない。

この作業中の本番変更は、旧銀行・旧お手伝いポイントの一覧カード整理だけ。いいことの実データ・つうちょうの残高や履歴は変更していない。
