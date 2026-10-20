# カレンダー：通知タイミング・予定対象者の複数選択

2026-10-20 JST。基準：HOME正本 `feat/home-auth-foundation` / 576fdc2699125a7d17073b0f79dd886a8db2cf48。独立作業ブランチで実装・合成テスト済み、**本番未反映**。

## 確認した要望

利用者が通知の複数選択は「通知のタイミング」と回答。通知先の単一選択や公開範囲の設定を勝手に変更しない。「誰の予定？」は複数人を選択する。

## 既存構成

- HOME `public/calendar.html` → 認証付き `src/calendar.ts` → service binding CALENDAR_SERVICE / calendar-worker。
- calendar-dbにcalendar_eventsとACL sidecar。閲覧可否・登録者/管理者・本人限定予定の判定を保持。
- calendar-worker → NOTIFICATION_API / notification-center-api の `/api/calendar-sync` が予定IDに対応する予約を置換。通知配信直前にもHOMEの現在の所属/セッション/公開権限を再検証。
- 本番Worker実コードは今回まだ未照合。反映前スクリプトで2本の現行コードを利用者PCに保存し、基準SHAのGitHubソースと照合する。Dashboard最新設定・実DB内容はバックアップ待ち。

## 保存・画面

- 通知はチェック式で開始時刻/5分/10分/30分/1時間/1日前。通知なしで全解除。元の1件を開けばその1件だけ選択済み。通常は6選択肢、既存の独自分数も編集時に保持。サーバーは重複なし最大7件の整数分（新規0〜1440分、既存の独自設定は保持）を検証。
- 「誰の予定？」は現カレンダー参加者から複数チェック。選択なしは指定なし。本名/ニックネームは既存のHOME人物表示名を利用。月表示・日別一覧・詳細は従来のsubject_nameに複数名を結合して表示。
- 家庭・人数・名前を固定しない。予定の対象者を選んでも閲覧対象者や通知先は増えない。現在のカレンダー参加者でない人物はAPIで拒否する。
- calendar-dbに `home_event_options(event_id,notify_befores_json,subject_user_ids_json,updated_at)` を追加。既存ACLと同様、更新版WorkerのHOME APIアクセス時に冪等CREATE。参考SQLは `cloudflare/calendar-worker/event-options.sql`。home-db/通知DBのマイグレーションはない。
- calendar_events.notify_beforeに最初の値（なしは-1）、既存subject_user_idに最初の対象者を互換保存。全選択はsidecarに原子的に保存。既存行の移行・一括書換えをしない。旧クライアントが新配列を省略して同じ先頭値を送る編集でも複数選択を維持する。
- event_id外部キーのON DELETE CASCADEで削除時は該当optionsだけ除去。共有設定変更時の既存policy backupにeventOptionsも含める。
- 繰り返しの全体・その回だけ・以後の変更に既存の保存経路を利用。新規/単独/分割イベントには対応する複数選択をコピー。旧版の予定は消さない。
- 読み出しはリクエストごとのACL取得にoptionsをまとめて取得し、表示イベントごとの追加D1問い合わせをしない。

## 通知

- 1つの予定ID/外部キーに全タイミング分の予約をまとめる。時刻は既存のJST壁時計計算を利用。同一予定の同一通知日時は繰り返し間で重なっても1予約にする。
- 通知APIの旧上限500件では複数タイミング×長期繰り返しを切り捨てるため、上限を3500へ変更。超過は旧予約の削除前に400で拒否し、黙って切り捨てない。内部の繰り返し展開は最大500インスタンス、選択最大7件なので上限3500に収まる。
- HOME通知は既存どおり予約側に予定の私的本文を保存せず、配信直前に現在の権限と最新タイトルを検証。新規の通知予約の汎用本文は「予定のお知らせです」とし、事前通知なのに開始時刻と誤認させない。今回、通知先選択/端末登録/サブスクリプション/通知の認証処理は変更しない。
- 終日予定の通知は従来どおりなし。通知先の複数選択は今回の範囲外。
- 能力確認：calendar-workerは `event_options_protocol=multi-v1`、通知Worker healthは `calendar_multi_protocol=multi-v1`。旧calendar-workerに新配列を送る操作はHOMEが拒否。旧通知Workerで複数タイミングを保存する場合もDB書込前に503で拒否。既存の単一通知は維持。

## 反映順序とゲート

1. `preparations/calendar-multi-20261020/backup-before.ps1`：home/calendar/notificationsの最新SQLエクスポート、オフライン整合性/FK/ハッシュ保存。通知→カレンダーの順に現行Workerの全文をCOPY（PowerShellへ貼らない）して保存・基準Gitソースと照合。新しい2ソースはダウンロード・構文確認だけ。停止理由があれば実行を進めない。
2. バックアップALL OK確認後に、利用者が `notification-center-api-after.js` を notification-center-apiへ貼り替えDeploy。
3. 次に `calendar-worker-after.js` を calendar-workerへ貼り替えDeploy。
4. HOMEの作業PRを本番ブランチへ統合。既存Git連携でhome-workerを自動Deploy。新HOME migrationなし、R2/Cron/bindings変更なし。
5. ログイン中のブラウザで `https://cetus.fun/wagaya/api/calendar/home/status` を開いて状態確認だけ行う（新表のCREATEが実行される）。返された名前等はチャットへ送らない。カレンダー本体の画面は旧予約の自動再同期を避けるためまだ開かず、新しい予定の保存前に `verify-after.ps1` で前後比較。calendarに新options表だけを許可し、旧全行/スキーマの不変を確認。HOMEのauth活動、通知の実行ログ/習慣チェックは比較対象外。通知予約/サブスクリプション、予定/公開範囲、通帳/ポイント/学校記録は比較する。
6. 利用者の実機で2タイミングと複数対象者を試す。本番残高や本物の予定へテスト入金・テスト書換えをしない。

利用開始後に旧Workerへ戻すと全選択を解釈できない。データ・sidecarを削除する復旧は行わず、バックアップと対応版を使って確認する。反映中は予定の登録・編集を待ってもらい、比較の差分を実操作と混同しない。

## 検証

- Node API/モデル全体39件＋追加ペイロード1件（計40件）合格。TypeScript、Worker dry-run、2Worker構文確認合格。
- 複数タイミングのJST日時、繰り返しのその回だけ変更、重複時刻の予約抑止、通知解除、旧クライアント編集、subjectと公開範囲の分離、不正な対象者/重複分数の拒否、旧通知Workerで保存前停止、削除時options除去、元の予定不変を検証。
- 通知APIは501予約を切り捨てず保存し、3501件は旧ルールを消さず拒否することを検証。
- Chromium390/768/1280幅で複数チェック・旧単一設定・通知解除・44px以上の選択欄・公開対象が増えないこと・横はみ出しなしを確認。全て合成データ。
- バックアップ比較2件合格。実iPhone/Android、現在の本番ソース一致、本番DB照合、実通知到達は未確認。

URLは既存の https://cetus.fun/wagaya/apps/calendar/ を維持。兄妹招待・親族共有の実設定は保留のまま。
