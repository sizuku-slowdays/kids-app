# からだカレンダー：HOME本人連携と新規利用開始

2026-10-30 JST。HOME基準8235388019f27d409b542fd539456adc75a32b30。mainの画面不具合修正b6ef9e6とは別の追加改修。独立ブランチで実装し、本番未反映。

## 調査とバックアップ

利用者の2026-10-30 SQL export監査報告：home-db/calendar-dbともintegrity OK、FK問題0。period_users 3件、period_records 2件、period_requests/period_favorites各0件、period_inventory 5件。home active users 5、household行2。名前・ID・健康記録・SQLは受領/公開していない。

NOT NULLと一意インデックスを受領済み。実際のCHECK/defaultをリポジトリだけでは確定できないため、PCの実バックアップをメモリーSQLiteへ読み、追加SQLと新規プロフィール/記録/お願い/メモの合成INSERTを試すpreflightを用意。実ファイルや本番は更新しない。失敗なら停止し、推測で本番へ適用しない。

## 入口・認証・権限

予定URL https://cetus.fun/wagaya/apps/body-calendar/ 。HOMEのアプリ台帳にbody-calendarを登録し、固定の旧外部リンクを置き換える。既存の原ファミリーはアプリを利用可能とするが、大人の一般メンバーは初期表示OFF。既存祖父母の簡易HOMEを保つ。表示はアクセス権とは別。新しい家庭は管理者が利用アプリとして有効にできる。

HOMEセッションを再利用する。HOME→CALENDAR_SERVICE、calendar-worker→HOME_AUTHで、毎回本人・有効所属・対象家庭・役割を確認。新しいBinding/Secret/R2/Cronは不要。公開の偽造ヘッダー、URLの人物/家庭ID変更では本人になれない。本人情報はid/display_nameのみ返し、認証用フィールドを返さない。入力上限16KiB、JSON形式、Origin、期待したHOME利用者を検証。

本人は自分だけ。家庭owner/adminの大人は自分と同じ家庭の子どもを管理。一般大人/祖父母は、同居や大人という理由だけで子どもや別の大人の健康記録を取得できない。他家庭の管理者にも権限を与えない。ページ/APIの双方を保護。

## 既存の引き継ぎと新規利用

「設定」→HOMEに登録された対象の人→「既存アカウントを連携」。既存本人を明示選択し、パスワードで確認する。元のcalendar家庭設定と一致する家庭の管理者だけが引き継げる。名前から自動対応しない。保護者用の旧本人を子どもへ誤連携しない。初期設定前CHANGE_MEかつ記録/お願い/メモが全て空の子ども本人に限り、保護者による明示確認で連携可能。空でない既存データにこの例外を使わない。

本人ID・period_user_idの一対一リンクを追加し、既存のperiod本人ID、記録、お願い、メモ、在庫をそのまま使う。既存行のコピー/一括移動/初期化なし。誤連携を自動上書きしない。

「新しく利用開始」はHOME上の本人専用のperiodプロフィールを追加する。別パスワードは不要。氏名/人数を固定しない。新しい独立公開ユーザー登録ではなく、HOMEの既存アカウント/招待基盤で参加した人の利用開始。1 HOME利用者の健康プロフィールは1つの家庭に固定し、別家庭へ無断複製しない。

**安全な切替のため、追加表と新calendar-workerが反映された後は旧 /karada/* 認証を停止する。** 旧認証方式をHOME側の連携データへ持ち込まない。未連携の原家族もHOMEの設定から引き継ぐ。旧URL自体の転送はこの改修では行わず、旧APIはHOMEを開く案内を返す。切替中は短時間旧画面が利用できなくなるため、利用が少ない時間に反映する。

## 保存とAPI

HOME migration0026：apps、原家族のgroup_apps、body-calendar専用user_apps初期表示のみ追加。既存user_appsの行/並び順は変更しない。既存トリガーによるhome_layout_versionsの進行は意図したメタデータ変更。既存5人の所属・役割・端末・家族構造は変更しない。

calendar-dbの追加6表：home_karada_links、home_karada_inventory、home_karada_operations、home_karada_changes、home_karada_link_attempts、home_karada_record_trash。既存テーブル定義・既存行をmigrationで変更しない。リンク/操作/監査は不変トリガー付き。

HOME /api/body-calendar → 内部 /home-karada 。status/profiles/records/predict/requests/inventory/favoritesを提供。旧周期推定の方法を踏襲し、医学的な確定予測として扱わない。

記録/お願いの新規追加は家庭×実行者×event_idを一意とする。サーバーで正規化した内容のhashと確定IDを保存し、同じ内容の再送は同じ結果、違う内容は409。操作記録と実際のINSERTをD1 batchで原子的に確定。失敗時に片方だけ残さない。削除後もIDを再利用せず、旧event_idの再送で記録が復活しない。

編集・削除・在庫・メモ・確認は実行者と対象を監査。記録削除時は元JSONをD1の控えへ保存。復元UIは未実装で、必要時は管理手順による復元を別途用意する。お願いは対象家庭の本人/権限を持つ保護者の一覧にだけ表示。プッシュ通知/メール/既存通知設定は追加変更しない。

原ファミリーの在庫は元のperiod_inventory 5件を維持。他家庭はscoped inventoryを使用し、原家族の在庫を複製/公開しない。メモは本人ID単位。表示名はHOMEの現在の名前を使用する。

## 画面と検証

HOMEに馴染む画面、日付選択、記録追加/編集/削除、期間カレンダー、目安、お願い送信/保護者確認、メモ、在庫、連携設定を実装。入力失敗時は内容保持、初回登録から動作。送信を二重実行しない。画面復帰時、本人/権限が同じなら入力中のフォームを維持し、本人/権限が変われば古い私的表示を消す。健康記録をlocalStorageやService Worker cacheへ保存しない。

新機能のAPI/画面15件、既存の家庭招待/HOME並び替え/複数家庭カレンダー/予定公開/通知選択/現金・利息・プレゼント・通帳印刷・お手伝い取消を含む関連39件を確認。Pythonのバックアップ/移行確認2件、TypeScript、Worker dry-run、2種類JSの構文を確認。家族基盤試験のfixtureは0022保持試験を残し、依存する0026を後から適用してアプリ登録後の基準で家族操作を照合する順に調整。

実iPhone/Android/PC画面、本番の連携、実SQLバックアップでのtrial INSERTは利用者preflight/反映後確認待ち。本番へ試験記録を作成していない。リポジトリ全体の既知foundation/calendar-home旧fixture失敗は前件資料参照。この改修で別アプリの認証/予定/通知/金融ロジックを書き換えていない。

## 反映手順

1. 利用者PCでscripts/prepare-body-home.ps1 -SourceCommit <固定SHA> -Folder <今回のバックアップフォルダー> -Stage preflight。実バックアップの局所trial、現行calendar-worker全文のクリップボード退避/基準GitHub版照合、新版の構文確認。まだ反映しない。RESULTとフォルダーのみ共有。
2. 成功後、退避済みフォルダーのbody-home.sqlだけをcalendar-dbに適用。次にcalendar-worker-after-body.js全文へ貼り替えてDeploy。既存Bindings/Cronを変えない。
3. HOME正本のheadを再確認して統合し、既存Git自動反映（home-db migrations apply→home-worker deploy）を使用。
4. 利用開始前に同スクリプト -Stage verify。同じbeforeと新afterをSQLiteで照合。HOMEは0026だけをbeforeクローンへ適用した期待値と一致、calendarは追加6表のみで全て空、旧記録/全旧SQL一致。差は勝手にリセット/修復せず確認する。
5. ママが設定で3人それぞれの既存本人を確認して引き継ぐ。姉妹は自分のHOMEから開く。元の2件が適切な本人で見えること、別本人/祖父母/別家庭に見えないこと、実際の記録とお願いが保存されることを確認する。

おしゃべりの利用時間一括設定の実機確認、兄妹ファミリーのカレンダー実設定は保留を維持する。
