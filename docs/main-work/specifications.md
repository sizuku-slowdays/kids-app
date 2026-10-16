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


### 2026-10-12：HOME連携カレンダー通知
通知先はHOMEの表示名で、所属カレンダーと予定の両方を閲覧できる利用者から選ぶ。全員=閲覧可能者全員。本人限定予定を管理者へ通知しない。端末のHOME本人/セッション対応は通知DBの home_notification_subscriptions に分離保存し、既存recipientを推測変換しない。配信直前の権限検証に失敗した通知は停止。旧のお薬・習慣通知の方式は維持。実機配信は導入後確認。


### 2026-10-12：家系図の夫婦配置
現婚姻・現パートナーは同世代の配置ブロックとして、共有する子孫用の余白を1回確保する。子どもの世帯数や人数が増えても夫婦カードの間隔は広げない。離婚・過去の関係はこの近接配置の対象外。人物や関係データは変更しない。


### 2026-10-12：外食料金
HOME認証済みの家庭メンバーが閲覧・計算できる。料金編集は家庭の大人、または子ども区分でないowner/adminのみ。アプリ側に独立した認証は作らず、APIと静的ファイルを既存セッション/アプリ権限で保護。家庭ごとに店舗・コース・整数の税込価格5区分をD1 JSONで保存し、revisionの一致した更新のみ受理する（競合409）。子ども・別家庭・未ログインの書込を拒否。
初回だけウエスト橋本店の2026年9月チラシ料金を利用者提示表から登録。各家庭の既存状態があれば再初期化しない。全店舗を削除した場合も勝手に再登録しない。人数はページ内で維持し、ページ再読込で全区分0に戻る。大人/65歳以上シニア/中高生/小学生/幼児。＋−の44px以上の操作ボタン、直接整数入力、最安との差と任意コース間差をローカル即時計算。店舗とコースは大人が追加・編集・確認後に削除できる。料金は店舗あたり30コース、100店舗まで保存可能。


### 2026-10-12：同じ子どもの両親の表示ブロック
婚姻の登録がなくても、登録済みの実親/養親の子ども集合が同一で候補が2人だけの場合、表示上のブロックを共有して近接配置する。明示の離婚・終了・他の現配偶者がある場合、3人以上の候補がある場合は対象外。続柄・婚姻の意味や保存データは変更しない。保護者関係や表示だけで補った親子関係から婚姻/配置を推測しない。


### 2026-10-12：外食料金の2計算方式
計算方式はbuffet（未指定の旧店舗も同じ扱い）/orderを店舗ごとに選択。単品型にはカテゴリ文字列と商品（id/name/category/period/time_note/note/hidden/variants）を保存。サイズ等のvariantsはid/label/整数税込price。通常・ランチの同名商品は別登録し、持帰専用価格も別モードへ分離。提供時刻が書かれていない品は記載なしと表示し、独自の時間や割引を推測しない。通常/ランチ切替では時間帯記載なしのサイド/ドリンクも表示、テイクアウトでは持帰専用品のみ。異なる時間帯が注文に混ざる場合は注文欄で注意を表示する。
数量は家庭×店舗×商品×サイズごとのページ内状態。カテゴリ・検索・ページ・店舗を変えても保持し、読み直しでリセット（履歴は保存しない）。非表示/削除済み商品は課金対象にしない。数量×現在単価で小計/合計を即時計算し、下部ボタンから注文全件を確認/増減/全削除する。管理ではカテゴリ名変更時に該当商品のカテゴリも同時更新し、SKUの非表示・価格変更・サイズ追加を家庭共通で永続保存。画面を再表示した際に最新状態を読み込む。
公式PDFのSHA・ページごとの商品/価格数は western-menu-audit.json、登録全件のデータはsrc/dining-western.ts。過去PDFを元にした既存家庭の編集を次回読込で自動リセットしない。新しい改訂メニューの反映は別途確認し、管理画面または明示の移行で行う。


キッズプレート：税込700円、キッズカテゴリ、通常・ランチ表示。提供時間の明記はない。共通メニュー https://western-fukuoka.jp/menu が出典、姪浜店での利用は利用者確認。D1の既存追記・バックアップ方式を流用し新規テーブルは追加しない。


通知SW：/apps/calendar/notify-sw.js は個人情報なしJavaScriptを未認証でもGET/HEAD配信。cetus.funの/wagaya/sw.jsは従来通り。予定・画像・APIの認証と閲覧権限は維持。通知500ログはoperation/status/分類reasonのみ、Cookie・endpoint・氏名・例外原文は記録しない。


HOME専用端末はrecipient=allでDB制約を満たすが、home_notification_only_endpointsで旧全員配信から除外。既存旧端末は従来recipientを保持。HOMEリンク解除後も専用区分を維持し、旧通知へ漏れない。


スマホ月表示：日付/予定文字のどこをタップしても一日一覧を選択する。日付ボタン高44px、日付文字18px。下の予定一覧は最低64pxのボタンで詳細を開く。PC月表示は予定直接クリック可。


月表示のサイズは従来通り（日付13px/スマホ11px、予定10px/スマホ9px、セル高82px/スマホ58px）。枠内の予定も日付選択として扱い詳細は開かない。詳細選択は下の一日一覧（最低64px行、17px予定文字）を使う。前記の月日付拡大仕様を置き換える。


HOME通知予約：notification_rules.recipientは既存制約に適合するall。texts.__home_calendar_recipientにhome-all/home:IDを記録する。配信時に必ずHOME宛先を復元し、HOMEリンクと最新ACLを確認。旧通知管理の一覧・個別変更から除外。既存旧予約は変更しない。

### まいにち漢字3文字（2026-10-14）
- kanji_school_profiles：HOMEユーザーID、設定元家庭ID、基準学年/年度、自動進級、設定者。現在年度はJST4月区切り。4/2等の誕生日による推測はしない。保護者が初回学年を設定。小1は1年生80文字を練習、小2〜小6は前学年まで（80/240/440/642/835字）。小6の翌年度は中1に進級し、小学校1〜6年の全1026文字を復習する。学年の値7〜9は中学1〜3年に相当し、小学校漢字の復習を継続。中学新出漢字は今回の対象外。
- kanji_daily_sets：user_id＋study_dayが一意。同じ日に学年を変更しても3文字は固定。未習得を優先し各群を乱択。日付・文字はサーバーで検証。
- kanji_mastery：user_id＋characterが一意、初回学習日/最終確認日/確認回数。kanji_learning_events：user_id＋study_day＋character＋kindが一意。学習・復習の履歴を保持（UIは最新300件、保護者は30件）。復習の記録は同じ日同じ字1件、既存履歴は削除しない。
- POST confirmはD1 batchで習得と履歴を原子的に保存、二重押し/複数端末で確認回数が二重加算されない。未知/当日セット外の漢字は拒否。図鑑から追加の習得印は付けず、今日の3字を超えない。
- 保護者確認/学年設定は参加家庭内のchildren.user_idで紐付く子どもだけ。家庭管理者またはadult区分のメンバーに許可し、子ども本人は他ユーザー情報や設定にアクセス不可。本人の学習データはユーザー単位で完全分離。
- 教材全1026文字（80/160/200/202/193/191）、書き順path抽出JSONを学年ごとに同一オリジンから配信。外部CDNへの実行時依存なし。KanjiVG CC BY-SA 3.0、KANJIDIC2の音訓補完 CC BY-SA 4.0、出典/変更点を画面とlicenses.txtに記載。SKIP/辞書番号/他言語意味は使用しない。
- UIは今日3字/図鑑/保護者。再読み込み・復帰でD1を読み直し、深夜は30秒以内または次の保存時に日付更新を検知。ネット不通時は保存成功扱いにしない。休んだ日に出題/ペナルティは付けない。



## 2026-10-15 漢字アプリのHOME導線

daily-kanji はHOME上部の「まなぶ」に表示（APIで許可・表示され、よく使う未指定の場合）。よく使う指定なら従来のよく使う欄に表示。非表示や未許可のアプリは出さない。画面復帰時はHOME画面に限り一覧を再取得し、設定画面の操作を中断しない。


## 2026-10-15 漢字アプリのデータ取得URL修正

漢字クライアントのAPI/ログイン先はアプリディレクトリから ../../api/daily-kanji、../../login をURL解決する。mountの文字列書き換えとの二重prefixを避け、cetus.fun/wagaya とworkers.devの両方に対応。JSON応答のContent-Typeを確認し、HTMLをJSONとして解析しない。



## 2026-10-15 つうちょう現金機能

子どものcashだけに12回お小遣い・日次残高/年利/端数繰越/年間上限の複利利息。walletは既存通貨/台帳へ追加、振替は原子的。大人cashは本人ID・0円で明示作成。未払いを記録し再精算。過去3件は実記録がないと推測で入金しない。 詳細は[設計・検証・反映手順](passbook-cash-20261015.md)。

## 2026-10-15 キッズ一覧といいことポイント

いいことポイントはchildren.user_idとHOME表示名で本人専用。家庭owner/adminのみ同家庭の全子ども管理。新開始日時と0残高を独立保存し、再開始APIも既存新ポイントを消さない。旧残高を移行せず、passbook台帳に一切書き込まない。 [詳細と残作業](good-deeds-20261015.md)。


## 2026-10-16 00時台 JST 確認更新（上記の保留状態を更新）

つうちょうPR4は2a83a28で統合し、10月15日18:01の自動デプロイ成功を利用者が確認。変更前後の全既存passbook行照合はok=true/issues=[]。本人の大人現金口座作成・お手伝い報酬も利用者確認済み。お小遣い5回設定・利息ONの利用者報告あり。おさいふは利用者希望で後回し。10月14日3件の補填は根拠不足のため未処理を継続。初回月次自動処理は未確認。

旧いいことWorkerの提示コードはGET/POST/DELETEのiikoto_records操作のみ、owner固定コード照合でHOME認証なし。DashboardのDB bindingはmama-bank-dbと利用者確認。旧記録を残し、新しいgood_deed_*台帳を0開始する方式を維持。10月16日00:17、旧DBのiikotoテーブル確認・最新home-dbエクスポートと整合性・両バックアップハッシュ保存がすべてOKとの利用者報告。本番移行は未実施。

今回の統合は0018金融機能と0019いいことの両方を保持する。旧API保護・新画面の本番反映・実アカウント権限確認・旧リンク切替は残作業。旧DBやつうちょうへのリセットは実施しない。


## 2026-10-16 学校じゅんび（準備）

家庭とHOME child/userの認可。保護者の確定版追記、本人の宿題/夜/朝の独立チェック。赤ハンコ・未完了優先。通知は保護者本人が明示ON、現在の権限/版/全完了/端末セッションを再検証。既存台帳へポイントを付与しない。 詳細：[仕様・試験・導入ゲート](school-prep-20261016.md)。


## 2026-10-16 学校準備：登校日の既定値・宿題初期項目

- 通知Worker更新完了、HOME PR8のBuild成功（12:13）と実際の段階全完了通知到着を利用者が確認。通知DB前後照合ok、既存通知4表不変。HOME照合の家系図・user_apps差分は利用者が実操作を報告。つうちょう・いいことポイントは照合上不変。祖母登録人物の表示問題は別件として未解決。
- 今回の修正：次の登校日は月〜金を既定とし、登録済みの各日最新版の登校日／休み指定を優先。土曜授業は指定可能。未来の遠い登録が直近平日を飛ばさない。祝日・振替休日・長期休みの自動判定は未実装、保護者が各日を休みにして確定する。
- 夜の表示日・APIのチェック許可日を同じ判定に統一。未登録なら持ち物は未登録のまま、DBへ仮予定を作らない。新規日付の登校日チェックも平日のみ既定ON。
- 宿題新規入力欄に漢字：／計算：／音読：を初期表示。既存版は上書きしない。項目名だけの空行は確定対象から除外。
- DBマイグレーション・通知Worker・Cron・既存データの変更なし。HOMEのコード更新のみ。
- 検証：TypeScript、Wrangler dry-run、学校準備API統合、曜日・例外単体、DOM（初期項目・空項目除外・既存内容保持）合格。本修正の本番Build・実機確認は未確認。


## 2026-10-16 ごほうびプレゼント（本番未反映）

同家庭の明示大人が本人IDで申請し、子ども以外のowner/adminが承認。自己承認禁止。許可は子ども×申請者。承認時だけcash/choresへ原子的に加算、wallet/いいことは変更しない。 [設計・テスト・導入ゲート](passbook-gifts-20261016.md)。


## 2026-10-16 通帳表示・A4印刷（本番未反映）

本人と同家庭保護者だけがbook APIを利用。姉妹ポイント共有とプレゼント申請許可は全履歴印刷の権限にしない。JST範囲・期間前繰越・julianday→rowid順の各取引後残高・読込時snapshotを計算し、台帳に書き込まない。 [設計・検証・導入手順](passbook-book-20261016.md)。


## 2026-10-16 家系図の日付入力改善
人物・関係の日付入力で月日1桁/スラッシュ/全角数字を既存のYYYY-MM-DD形式へ正規化。年・年月のみと空欄も維持。西暦なし・存在しない日付は項目名と具体的な案内をダイアログ内に表示し、APIエラーも保存ボタン付近に表示。既存DB・権限・API・R2の変更なし。日付検証12ケース通過。対象：family-tree/app.js,index.html。HOME自動Build成功・実機確認は未確認。


## 2026-10-16 家系図の日付選択・スラッシュ表示
生年月日・命日・関係の開始日/終了日にブラウザ標準date pickerの「📅 選ぶ」を追加。入力表示はYYYY/MM/DD、手入力の年/年月のみ・空欄も維持。API送信時は従来のハイフン形式へ変換し、既存保存データを更新しない。年齢表示はスラッシュ入力からも計算。DB/API/認証/R2変更なし。Chromiumで4項目のpicker、選択反映、スラッシュ正規化、既存値、年のみ、空欄、不正入力案内、保存形式、390px幅のはみ出しなし・選択欄46pxを確認。iOSの標準選択UIと本番Build成功は未確認。対象：family-tree/app.js,index.html,style.css。
