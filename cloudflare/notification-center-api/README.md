# 通知センターWorker：HOMEカレンダー通知

2026-10-12、利用者提供の現行Workerコード（Markdownの書式を除去）を基に追加。既存のお薬・習慣ルール、Web Push暗号化、VAPID設定は維持。

## 確認済み構成
- Worker `notification-center-api`、`DB` → `notification-center-db`。
- Service binding `HOME_AUTH` → `home-worker`：利用者がDashboardで追加済み。
- HOMEに `NOTIFICATION_SERVICE` → `notification-center-api` をWrangler設定で追加。
- カレンダーの既存 `NOTIFICATION_API` / URL / password はそのまま使用。秘密値は記録しない。
- notification DBのSQLバックアップは利用者PCへ保存・SQLite整合性ok、外部キー問題0、4テーブル、441764バイトを確認。SHA256ファイル保存済み。

## 追加データと権限
`home_notification_subscriptions` は初回HOME端末登録で作成するサイドカーテーブル。endpoint、HOMEユーザーID、HOMEセッションID、更新日時を保存。既存の4テーブルは削除・初期化しない。

HOMEセッションをWorker間で確認し、本文に入れた他人のIDは採用しない。既存endpointの旧recipientは維持。新しいHOME専用端末は `home_notification_only_endpoints` の区分で旧「全員」通知から除外する。既存DBのrecipient CHECK（mama/child1/child2/all）を維持し、recipient値はallを使うが旧配信の検索から除外する。解除後も区分を維持する。

カレンダーの新しい通知先は `home-all` または `home:<user_id>`。通知直前にHOME経由でカレンダーの最新閲覧権限を確認する。HOME利用権限、アカウント有効性、登録セッションの有効期限・失効、家庭参加・共有範囲、予定個別範囲を確認。失敗・通信障害・対象外・削除済みなら送らない。新旧の「全員」は混ぜない。HOME予定の予約には汎用文だけを保存し、予定名は許可を確認した配信直前に取得する。HOME形式のルールは旧管理APIの一覧・詳細・編集から除外する。

旧形式の予定は保存するまで通知先を変更しない。新しい公開設定に未対応の旧通知の停止も維持。新形式の予約は公開範囲の変更時に消さず、配信直前の確認で対象を絞る。

## 導入順序
1. HOMEのGitビルド成功を確認（UI/proxyと内部認可API）。旧カレンダーへの新通知保存はサーバーでも拒否。
2. 本ファイル `notification-center-api.js` 全文を同名Workerへ貼り替えてDeploy。既存Bindings/Secrets/Cronを保持。
3. `cloudflare/calendar-worker/calendar-worker.js` 全文をcalendar-workerへ貼り替えてDeploy。
4. HOME設定で最新版に更新し、各ユーザーがカレンダーの予定登録画面で「この端末で、自分として通知を受け取る」を1回押す。iPhoneはホーム画面に追加したHOMEから操作。
5. 予定を保存し、通知先が閲覧できる実ユーザーだけであること、指定した対象端末に届き、対象外端末へ届かないことを実機確認。

通知Workerのhealthで `home_notification_protocol: home-v1` が確認できるまでカレンダーは新形式の通知を同期しない。貼り替え順が逆でも旧Workerへ新IDを送り「全員」に変換させない。

## テストと未確認
TypeScript、HOME dry-run、カレンダー認証・共有・繰返しの回帰試験、通知配信直前ACL、ユーザー/セッション失効、個別端末登録、旧端末維持、通信障害時の配信停止を自動確認。実際のWeb Push配信、iPhoneの許可・購読、DB追加後の照合は本番導入後に利用者と確認する。

旧通知センター全体のHOME認証移行は今回の対象外。通知Workerの既存管理APIは従来の合言葉方式を維持している。

## 2026-10-13：実DBの制約対応
利用者提供CREATE TABLEでrecipientがmama/child1/child2/allに限定されていることを確認。home-only文字列の保存を止め、HOME専用端末区分テーブルを追加する。旧端末のrecipient・購読データは保持。旧全員配信除外、HOME本人リンク、解除/再登録を制約付きテストで確認。再度通知Workerのみ手動Deployが必要。
