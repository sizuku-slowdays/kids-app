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

## 2026-10-11 カレンダー権限・家系図

[詳細仕様](https://github.com/sizuku-slowdays/kids-app/blob/feature/calendar-family-tree-20261011/docs/main-work/calendar-family-tree.md)。「全員」は承認済みカレンダー参加者全員。イベント範囲はカレンダー範囲とAND。家庭間は双方許可。旧設定なしの予定は既存の範囲を維持。人物はHOME user IDで連携し、表示名変更で予定タイトルを書き換えない。家系図は家庭別D1グラフ、明示adultのみ編集、soft delete、private R2、revisionガード。実装済み／本番未反映を区別する。

2026-10-11追加調整：編集・削除は登録者または閲覧できる所有家庭owner/admin。child設定の管理者と別家庭管理者は管理権限なし。本人限定予定は管理者にも返さない。通知停止対象を新公開範囲未対応のものに限定し、従来の共有予定の表示名のみの設定は通知を継続。家系図は情報・写真・ごみ箱・バックアップ・復元すべて家庭権限で検証。人物2人を削除した場合も両人物が戻ると付随関係を復元し、意図的に削除した関係は自動復元しない。


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

同家庭の明示大人が本人IDで申請し、子ども以外のowner/adminが承認。自己承認禁止。許可は子ども×申請者。承認時だけcash/choresへ原子的に加算、wallet/いいことは変更しない。 [PR9](https://github.com/sizuku-slowdays/kids-app/pull/9)、[固定版の設計・試験・導入手順](https://github.com/sizuku-slowdays/kids-app/blob/350128ab01665a6a8bf9520bd0ce09a990ba9e3f/docs/main-work/passbook-gifts-20261016.md)。HOME本番ブランチへは未統合、SQL・Workerは未反映。


## 2026-10-16 ごほうびプレゼント：本番反映・利用者確認済み

PR9はHOMEへ統合済み（665da2e8537f64fcffa56cbf80fc38cc6659a470）。通知DB追加SQL・通知Worker更新完了、13:52のHOME Build成功（Version cd42c5d0-18c7-453f-836e-f1499317ca45）を利用者報告。13:55、最新バックアップとの前後照合はHOME・通知DBともすべてOK、既存データ・通知設定不変との結果。14:01、保護者への申請通知と承認後の加算の両方を利用者が確認し、問題なさそうと報告。これにより前述の本番反映・前後照合・基本実機確認待ちは解消。却下・複数端末・全ユーザー組合せの本番試験は未確認（権限・却下・再試行・重複はローカル試験済み）。別家庭共有・受渡し/精算・家計簿連携は引き続き未実装。


## 2026-10-16 通帳表示・A4印刷：独立準備・本番待ち

本人と同家庭保護者だけがbook APIを利用。姉妹ポイント共有とプレゼント申請許可は全履歴印刷の権限にしない。JST範囲・期間前繰越・julianday→rowid順の各取引後残高・読込時snapshotを計算し、台帳に書き込まない。 [PR10](https://github.com/sizuku-slowdays/kids-app/pull/10)、[固定版の仕様・検証・導入手順](https://github.com/sizuku-slowdays/kids-app/blob/0565653f263f4f7d9ce882edf02926a9dd535160/docs/main-work/passbook-book-20261016.md)。本番統合は最新home-dbバックアップの読み取り専用監査待ち。DB変更・通知Worker更新不要。


## 2026-10-16 家系図の日付選択・スラッシュ表示
生年月日・命日・関係の開始日/終了日にブラウザ標準date pickerの「📅 選ぶ」を追加。入力表示はYYYY/MM/DD、手入力の年/年月のみ・空欄も維持。API送信時は従来のハイフン形式へ変換し、既存保存データを更新しない。年齢表示はスラッシュ入力からも計算。DB/API/認証/R2変更なし。Chromiumで4項目のpicker、選択反映、スラッシュ正規化、既存値、年のみ、空欄、不正入力案内、保存形式、390px幅のはみ出しなし・選択欄46pxを確認。iOSの標準選択UIと本番Build成功は未確認。対象：family-tree/app.js,index.html,style.css。

HOME実装版：[8a52939](https://github.com/sizuku-slowdays/kids-app/commit/8a52939400c0d23b7d69ac769c2aa1f85aef8608)。直前の日付エラー改善も継承。通帳印刷PR10は29956eaでHOMEへマージ済み、Build成功は未確認。


## 2026-10-16 ヌルボン福重店・店舗間料金比較
[実装・公式料金の確認記録](dining-nurubon-20261016.md)。[PR11](https://github.com/sizuku-slowdays/kids-app/pull/11)をHOMEへマージ（a5c8d173c77a20c53125ee1897511f08c0a25a12）。同じ7区分の参加人数からウエストは従来5区分へ合算。既存メニュー保持・追加前JSONを既存D1バックアップ表へ自動保存。新規DBマイグレーションなし。TypeScript/dry-run・HOME29テスト、390/1366px操作確認済み。本番Build成功/実iPhone/中高生の専用料金は未確認。URL：https://cetus.fun/wagaya/apps/dining-prices/?view=compare 。


## 2026-10-18 複数ファミリー改修：第1段階（本番未変更）
[調査・権限表・移行計画・バックアップ手順](multi-family-20261018.md)。現在の5人は同じ1家庭のまま維持。HOME正本a5c8d17を調査。単一家庭のcalendar_config、漢字の大人=保護者判定、旧家計簿の共通パスワード、HOME固定リンク/自動アプリ付与を変更対象に整理。既存の通帳とプレゼントは別家庭/共有ownerからの直接APIを拒否することを合成5人＋別家庭＋sharingのローカルD1で確認。家系図APIに登録者フィルターはなく、祖母の実データが見えない原因は未特定。バックアップ監査Python3件とAPI再現1件が合格。独立ブランチ、監査・資料・テストのみ。実DBのID/role、バックアップ取得は未確認のため第2段階以降は未実装。移動・権限一括変更・デプロイなし。

追跡：[Draft PR12](https://github.com/sizuku-slowdays/kids-app/pull/12)、準備版123cf9004be044aec37ccca533b42017d54524fe。現在は実DBバックアップ監査の確認待ち。
