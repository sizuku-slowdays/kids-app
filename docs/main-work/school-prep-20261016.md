# 学校じゅんび：手入力版と段階完了通知

2026-10-16 JST。HOME基点8389d7a、独立ブランチ `feature/school-prep-20261016`。**本番未反映**。英語フラッシュのPR7は今回統合しない。

## 今回決めた範囲

利用者が選択：AI読み取りは後から、保護者の手入力版を先に利用。宿題・夜・朝がそれぞれ全完了した時に通知。30登校日の達成集計を先行し、ランク・ポイントは後から決める。旧時間割画像・school-check・現金/ポイント台帳の移行や変更はしない。

入口 `/wagaya/apps/school-prep/`、Worker直URLでは `/apps/school-prep/`。API `/api/school-prep` はHOME session/appAllowedで保護。未認証API401 JSON、静的ページはログインへ誘導。家庭、ユーザー名、児童はHOMEのgroups/memberships/children.user_id/usersから取得。人数・学年・氏名を固定しない。

保護者は家庭owner/adminで、child属性や登録児童本人ではない人。自家庭の登録児童を選んで確定・閲覧する。子どもは自分の内容とチェックだけ。別家庭・別児童・未割当成人はAPIで拒否。保護者は本人の代わりにハンコを押せない。

## 画面と日付

保護者は日付、登校日/休み、宿題、持ち物（それぞれ1行1項目）、下校時刻（空欄可）を入力し確定。確定済み内容だけを子どもへ表示。宿題・朝は日本時間の今日、夜は登録された次の登校日。未登録なら翌日の空表示。休校や欠席を推測しない。

持ち物は「夜に用意した」「朝に持った」を別保存。未完了を上に表示し、完了は赤いハンコ。本人でも過去日や未来の朝を先回りしてチェックすることはAPIで拒否。休みや未登録に減点はない。

直近30登校日は、最新確定版が登校日で今日以前の30日。1項目以上あり、各宿題と各持ち物の夜/朝が全完了した日を集計。空リストと休みは達成日にしない。初日の前夜分がない場合もある。ランクや報酬を決める確定基準ではなく、今回承認された状況表示のみ。

## DB・保存・再送

0020_school_preparation.sqlでhome-dbへ次の5表を追加。apps/group_appsにschool-prepを追加するが、既存データ・user_apps・お気に入りを更新/削除しない。

| 表 | 用途 |
| --- | --- |
| learning_school_versions | 家庭/児童/日付ごとの確定版と確認者 |
| learning_school_checks | 版/項目/宿題・夜・朝のチェック |
| learning_school_receipts | 操作IDと元payload、再送防止 |
| learning_school_preferences | 保護者本人の通知ON/OFF（初期OFF） |
| learning_school_deliveries | 段階完了通知outbox、配信結果 |

変更時は新版を追記し、旧版・旧チェックを残す。expected_revisionで同時更新を409拒否。再確定で新しい版のチェックが空になることを画面で確認する。receipt挿入とチェック反映はSQL triggerで同一処理。古い再送で後のチェックを巻き戻さず、同じ操作IDの別内容は拒否する。通知失敗でも保存済みチェックを消さない。

## 通知の接続

既存NOTIFICATION_SERVICE→notification-center-api、HOME_AUTH→home-workerを利用。新Secret・新Cronなし。保護者が自分への通知を明示ONにした場合だけ、登録済みHOME端末へ送る。従来recipient/allへフォールバックしない。

notification-center-dbに `school-preparation.sql` でschool_push_deliveries 1表のみ追加。既存notification_rules/push_subscriptions・購読設定・Cronを変更しない。新 `/internal/school-prep/send` はnotification.internalのみ。HOMEへのcallbackで通知ID、現在の家庭管理権限・学校/通知アプリ権限・児童の所属・通知設定・最新の版と全完了を再検証。各端末についてユーザーとHOMEセッションの有効期限/失効も検証する。

通知文は宿題/夜/朝の全完了のみ。氏名や具体的内容は出さず、タップ先の認証付き学校画面で確認する。1家庭/児童/日/版/段階/保護者で通知を一意にし、端末別の成功記録と安定したtagを使う。通常再送で成功端末へ二重送信しない。ただしPush成功直後・記録保存前の障害での厳密なexactly-onceは保証できない。

失敗はoutboxへ保持し、保護者の「送信待ちをもう一度送る」や後続の本人操作で再試行する。24時間経過したものや公開権限/版/完了状態が変わったものは送信しない。古い通知Workerのままでも学校のチェック保存は成功させ、通知だけ待機する。

## 検証・導入ゲート

- TypeScript、Wrangler dry-run、HOME・学校・金融・いいこと・既存カレンダー通知の合成データ試験。
- 学校試験：未認証、家庭/児童境界、保護者と本人、版競合、宿題/夜/朝、過去/未来のチェック拒否、再送、旧版保持、全完了通知と取消、つうちょう現金行不変更。
- 通知試験：保護者本人端末限定、セッション再検証、外部ホスト拒否、成功端末の再送防止、失敗再実行。既存ルール/購読の全行不変更。
- DOM試験：本人だけ、保護者選択と確定、ハンコ、次の登校日の夜チェック、正しい/wagaya URL、危険なHTMLの文字表示。
- 0020適用前後の全旧表スキーマ/行をローカルSQLで比較。照合スクリプトは同件数の改変も検出。実機・実Pushは本番反映後に利用者確認する。本番へテスト記録は作っていない。

導入順序：

1. preparations/school-prep-20261016/backup-before.ps1で最新home-dbとnotification-center-dbを取得・検証。現在の通知WorkerコードをPCへ保管し、GitHub基点と比較。差異があれば停止してレビュー。
2. 通知専用SQLを適用し、通知Workerを更新。既存Bindings/Secrets/Cronを維持。
3. HOMEのPRを統合し、0020のみ新規適用して自動デプロイ。
4. 使用前にscripts/check-school-upgrade.pyでbefore/after SQLを比較。認証活動等を除くHOME全旧表、既存通知ルール/購読の保持を確認。
5. HOME入口、保護者の確定と通知ON、各児童の本人チェック、各段階完了の実Pushを確認。

## 残作業と他案件

本番の新しいバックアップ/通知Worker照合、実デプロイ、実機確認はまだ。AI提供元・画像所有権/既存時間割の接続・費用は未確認のまま接続しない。ランク/報酬は未決定、英語PR7は保留。つうちょう10/14補填は根拠不足で保留、おさいふは後回し。

いいことPR5は00:28のデプロイ成功・既存通帳保持・保護者画面の0開始を利用者確認。PR6の一覧と旧APIのlegacy_api_retired応答も01:11に確認。子ども本人の実機権限確認は別途残る。


2026-10-16 修正：backup-before.ps1の$homeがPowerShellの読み取り専用$HOMEと衝突し、エクスポート前に停止したとの利用者報告。$schoolHomeBackupPathへ統一。今回の失敗で本番DB/Workerの変更は実行されていない。修正版でバックアップ取得から再開する。
