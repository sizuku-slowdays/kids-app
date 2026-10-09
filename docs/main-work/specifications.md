# 現在の仕様とデータ保存先

調査日：2026-10-09。以下は固定コミットのコード仕様です。DBの実レコード・設定値・本番での権限確認は未確認です。

## 認証・利用者・グループ

[cloudflare/home-worker/migrations/0001_foundation.sql](https://github.com/sizuku-slowdays/kids-app/blob/9cf5cb27197e851d91a5e9f9146da76cf9fc1dbb/cloudflare/home-worker/migrations/0001_foundation.sql)、[cloudflare/home-worker/src/index.ts](https://github.com/sizuku-slowdays/kids-app/blob/9cf5cb27197e851d91a5e9f9146da76cf9fc1dbb/cloudflare/home-worker/src/index.ts)、[cloudflare/home-worker/src/security.ts](https://github.com/sizuku-slowdays/kids-app/blob/9cf5cb27197e851d91a5e9f9146da76cf9fc1dbb/cloudflare/home-worker/src/security.ts)を確認。

| 要素 | 実装・保存先 |
| --- | --- |
| 個人アカウント | home-db.users。login_nameは大文字小文字を区別しない一意ID。メール認証ではない。個人パスワード・display_name・active・platform_role |
| 初期登録／招待 | 初期管理者bootstrapと招待登録。invitationsにトークンのハッシュ・有効期限・消費／取消・家庭・任意の子どもID。公開自由登録の方式ではない |
| パスワード | scrypt-v1形式、N=16384/r=8/p=5。旧PBKDF2形式の検証処理もあり。Secret値・パスワード・ハッシュを管理資料へ記載しない |
| セッション | sessions。ランダムトークンをCookieへ、DBにはハッシュ。__Host-home_session、HttpOnly/Secure/SameSite=Lax。発行時の有効期間180日。端末名と失効日時を保持。端末単位の失効可能 |
| 家庭／共有グループ | groups.kind=household／sharing、memberships.role=owner／admin／member。全システムの固定家族一覧を作らない |
| 子ども | childrenに家庭ID、display_name、任意のuser_id。人数固定ではない。登録済み本人とのリンク・誤リンク訂正の専用処理あり |
| アプリ利用権限 | apps、group_apps、personal_app_access。user_apps.visibleは表示設定であり認可そのものではない |
| データ所有・共有 | resourcesは個人またはグループの所有者。resource_grantsは個人／グループへのread/write、承認・取消を保持。canReadは閲覧評価のみ |
| ファイル権限 | private_files→resource_id→所有／共有判定→home-private。/media/{file-id}でセッション・アプリ利用権限・所有／承認済共有を確認 |

任意共有グループ・グループ間共有を表現するデータ構造はありますが、全アプリで共有の作成・承認・取消UIが完成しているわけではありません。各アプリの専用権限は別途必要です。カレンダーの旧family_membersは全システムのユーザー正本ではありません。

## HOME表示・配信

`cetus.fun/wagaya/`は[cloudflare/home-worker/src/home-mount.ts](https://github.com/sizuku-slowdays/kids-app/blob/9cf5cb27197e851d91a5e9f9146da76cf9fc1dbb/cloudflare/home-worker/src/home-mount.ts)で同じURLのままHOMEを配信します。index.html／mama.htmlもHOMEとして扱います。認証後に本名表示可。API等はprivate,no-store。HOMEのサービスワーカーは旧wagaya-shellキャッシュを消し、非公開データをオフラインキャッシュしない方針です。

アプリ表示／順番はuser_apps、よく使うアプリはhome_preferences.favorite_app_ids。選んだアプリは通常一覧から重複を除く実装あり。非表示はデータ削除や権限取消ではありません。

**旧HTMLなど既知のHOME内部パスに該当しない/wagaya/配下は、元の静的配信へ通します。** HOMEでログインしただけで、旧時間割・旧アルバム・/kanriapp/全体が共通認証保護になるわけではありません。

## アプリ別の保存先

| アプリ | 主な保存先・テーブル | 画像・外部保存／境界 |
| --- | --- | --- |
| HOME | home-db：users/groups/memberships/children/apps/group_apps/user_apps/personal_app_access/invitations/sessions/home_preferences/auth_attempts/resources/resource_grants/private_files/legacy_links | 一般非公開メディアはhome-private。実R2公開設定は未確認 |
| つうちょう | home-db：passbook_units/settings/accounts/entries/credit_sources/legacy_events/activation/rewards/requests/imports/adult_accounts/adult_entries/chore_imports/chores/chore_days（各passbook_接頭辞） | 旧データの非公開バックアップはhome-private。商品画像はD1の既存image_url方式を流用（下記）。全画像をR2保存する方式ではない |
| 筋肉貯金・HOME版 | home-db.muscle_bank_states（所有者ごと） | home-privateのmuscle-bank/owners/{本人ID}/。認証済み専用APIで配信 |
| 筋肉貯金・端末版 | ブラウザIndexedDB。storage.js | 端末内画像・JSONバックアップ。HOMEへ自動移行しない |
| カレンダー | calendar-workerのenv.DB：users/calendars/calendar_events/family_members/family_settings/home_calendar_config/home_calendar_links/home_calendar_retired等 | 実DB名未確認。Google ICS設定は所有者ごと。HOME側home-dbと別のDB参照 |
| からだカレンダー | 同Workerのperiod_users/period_records/period_inventory/period_favorites等 | 旧本人認証。HOME共通認証移行未確認 |
| 家計簿 | ローカルキャッシュ＋api.cetus.fun/api/app-data。APP_KEY=kakeibo-app。旧APIソースではapp_data(app,data_key,data_json,updated_at) | API実D1 binding先未確認。Google Drive版は別ファイルで別方式。HOME台帳への自動変換はしない |
| 旧お手伝い・商品 | 旧Workerのenv.DB：chores／rewards／family_members等 | DB名未確認。旧rewards.image_urlにはdata URL／既存points静的URL。切替ゲート後の旧API停止が必要 |
| アルバム | IndexedDB wagaya-album v4（albums/albumFiles/farms/strategy/memories/files/piano/guides）＋専用API | access keyをlocalStorageに保持。クラウドのD1/R2・アクセス制御は未確認。GitHubのmedia/静的参考画像も別にある |
| 旧時間割 | api.cetus.fun/api/app-data-public（読取）、app-data（保存）。キーwagaya-timetable-grade4／grade2。localStorageバックアップ＋旧IndexedDB画像を参照 | 今週・先週。4年生／2年生固定。新timetables(child_id,week_start,file_id)は基盤SQLにあるが旧UIはこのテーブルへ移行していない |
| からだパワー | localStorage kp_*＋/api/karada-power。端末Bearerトークンで同期、記録・設定を扱う | 実Worker・DB名未確認。固定子ども選択が残る。HOMEユーザー／childrenとの連携未確認 |
| 通知センター | localStorageにAPI URL／合言葉／端末情報＋notification-center-api | サーバー側テーブル・push購読保存先・cron未確認 |
| 遊ぶやくそく | HOMEの認証済みランチャー、管理用接続情報は端末localStorage。asobu.cetus.fun/admin/へ進む | 外部Sitesが実処理を担当。HOME D1で約束データを保存する実装は確認できない。外部保存先・認証は未確認 |

保存先の根拠：[cloudflare/home-worker/wrangler.jsonc](https://github.com/sizuku-slowdays/kids-app/blob/9cf5cb27197e851d91a5e9f9146da76cf9fc1dbb/cloudflare/home-worker/wrangler.jsonc)、[SQL一覧](https://github.com/sizuku-slowdays/kids-app/tree/9cf5cb27197e851d91a5e9f9146da76cf9fc1dbb/cloudflare/home-worker/migrations)、各アプリのソースは[アプリ一覧](apps.md)・[Worker表](workers.md)参照。商品画像は[cloudflare/home-worker/REWARD_IMAGES.md](https://github.com/sizuku-slowdays/kids-app/blob/9cf5cb27197e851d91a5e9f9146da76cf9fc1dbb/cloudflare/home-worker/REWARD_IMAGES.md)、通帳移行は[cloudflare/home-worker/PASSBOOK_MIGRATION.md](https://github.com/sizuku-slowdays/kids-app/blob/9cf5cb27197e851d91a5e9f9146da76cf9fc1dbb/cloudflare/home-worker/PASSBOOK_MIGRATION.md)。

## つうちょうの操作と整合性

現金とポイントは別unit。passbook_units等に種別を持ち、お手伝い1種類に固定しません。「いいこと」等の別機能からの自動加算は今回の確認範囲では未実装です。

親は家庭の子どもの残高・履歴・入出金／ポイント調整・交換管理。子どもは本人中心の残高・履歴・交換。姉妹ポイントの共有可否は家庭設定で扱います。親の入口では子どもの現金・ポイントを先に表示する変更あり。

台帳は冪等性／重複加算防止を持ち、交換申請・承認・取消を扱います。旧データの保存・取込・照合・旧API停止確認とactivationを経て本番を有効化する構成です。利用者から切替・運用開始報告あり。今回、実残高や申請状態は読み取っていません。

交換商品は画像／名前／必要ポイントのカード。管理者が画像を選択・変更・削除できます。新画像もD1へ保存し、旧画像はLEGACY_DBの元商品に限定して参照。認証済み家庭向け `/api/passbook/rewards/{id}/image` で取得し、画像なしは固定枠。旧pointsの許可した静的画像のみ代理取得し、任意URLを代理取得しません。旧公開画像そのものの公開状態はこれだけでは変わりません。

## カレンダーの権限と選択操作

[cloudflare/calendar-worker/README.md](https://github.com/sizuku-slowdays/kids-app/blob/9cf5cb27197e851d91a5e9f9146da76cf9fc1dbb/cloudflare/calendar-worker/README.md)とWorkerソースを確認。

- HOME本人と旧プロフィールは一対一の明示リンク。家庭を1つ既存DBに紐づける現段階の構成。他家庭を同じ旧共有カレンダーへ自動参加させない。
- 個人カレンダーは所有者が閲覧／投稿。共通カレンダーは紐付いた家庭の利用者が閲覧／投稿。予定の編集／削除はcreated_by_google_idの登録者本人だけ。
- 他人の予定があるカレンダーは所有者でも削除不可。繰り返し予定の変更／削除も登録者制限。初回の終日繰り返し重複表示の修正あり。
- 空の日付タップは日別表示の選択。＋は選択日で作成。携帯幅の修正とプロフィール内の本人連携設定あり。
- Googleの非公開ICSは所有者別。過去の旧共通カレンダー1件だけを特定しhome_calendar_retiredへ保存して廃止する限定処理あり。この処理を新しい任意共通カレンダー全件削除へ拡大しない。

HOMEへのコミットとcalendar-workerのDashboard反映は別です。最新の投稿・編集制限が本番で有効かは未確認です。
