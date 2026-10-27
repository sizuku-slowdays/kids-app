# おしゃべり — 独立アプリ設計・開発記録

作成：2026-10-26 JST。段階：独立ローカル実装・合成テスト。本番未公開。実名・実データ・既存HOMEのDBを使用しない。

## 1. 既存環境を確認した結果と分離方法

GitHub `sizuku-slowdays/kids-app` のHOME正本 `feat/home-auth-foundation` の先頭をAPIで再取得。調査版 `338aee5b2d60c806389f3ce9bd830c61ffa49c56`。AGENTSと管理資料、既存home-workerのwranglerを確認した。
既存HOMEにはDB/LEGACY_DB、PRIVATE_FILES、通知/カレンダー/旧銀行/旧お手伝いのService binding、既存URLへのroutes、Cronがある。これらのファイル・binding・ID・routeは変更しない。Cloudflare Dashboardの現在の全リソース一覧やプラン契約内容はこの作業では未確認。

| 要素 | 今回の開発構成 | 本番の扱い |
|---|---|---|
| コード | `cloudflare/oshaberi/`、独立作業ブランチ | HOME本番ブランチへマージしない |
| Worker | `oshaberi-development-only` | 名前は案。未作成・未Deploy |
| DB | `CHAT_DB`、新規ローカルD1のみ | 新規専用D1を作成後に実IDを設定。既存DBの再利用禁止 |
| 写真 | `CHAT_FILES`、新規ローカルR2のみ | 新規非公開R2。r2.dev/公開custom domainを有効にしない |
| 静的画面 | 同じWorkerのStatic Assets | 別オリジンを選ぶ。HOMEのcookie・scopeと分離 |
| ドメイン | 未決定 | cetus.fun/wagaya配下やHOMEの既存routeを使わない |
| 通知 | 作らない | Web Push/メール/通知センター/外部メッセージ配信なし |
| 将来のHOME連携 | 認証主体の明示的な連携を後日設計 | HOMEのDBや家族データへ自動アクセスしない |

wranglerはworkers_dev/preview_urlsをfalse、全releaseフラグを0、DBはゼロUUID、R2はlocal-only、routes/Cron/サービスbindingなし。明示的な公開承認後に専用設定を準備する。現時点のURLはローカルだけ。

## 2. DB構成

`migrations/0001_chat.sql` は新規DB専用。既存HOME用migrationsフォルダに置かない。

| テーブル | 用途・重要な境界 |
|---|---|
| accounts | guardian/childを分けたID、本人のlogin、呼び名、saltとパスワードhash、active。親子で資格情報を共有しない |
| families / family_guardians | 家庭IDと保護者の対応。固定人数・名前なし |
| guardian_children | 保護者が管理できる子の明示的な対応と家庭ID。初期画面で他の家庭の子を追加するAPIなし |
| consent_events | 説明版・保護者ID・対象児童ID・同意日時 |
| child_settings | 一時停止、写真許可、曜日別の時間帯、timezone、revision |
| sessions | 各端末のランダムtokenのhash、アカウント、端末の呼び名、作成/期限、失効。token原文はDBに保存しない |
| rate_buckets | ログイン/登録/送信/upload/APIの時間枠ごとの件数。IPは秘密値を加えたhashで保存 |
| invitations | token hash、発行者/対象児童、3日間、1回、取り消し |
| friendships | 子ども2人の対応、双方の承認、pending/active/ended/blocked。現在の1対1conversationを兼ねる |
| blocks | ブロックした子・相手の子。解除してもトークは自動再開しない |
| messages | UUID、単調増加seq、トーク/送信者、種類、本文またはmedia参照、サーバー時刻、nonce/payload hash |
| read_cursors | トークと子どもごとの既読位置。保護者からの更新は禁止 |
| media | 所有児童、photo/stamp、非公開object key、pending等の状態、寸法/bytes、期限、承認者。本人用スタンプ以外の公開ライブラリなし |
| audit_events | 操作・主体ID・対象ID・時刻。メッセージ本文/画像/tokenを格納しない |

未来のグループトークはconversationと参加者表を追加する移行で扱う。現行friendshipsのACLを安易に全員公開へ転用しない。将来の外部identity連携にはprovider/subjectの一意な対応表を追加し、パスワードやHOMEセッションのコピーで実現しない。

## 3. 認証・権限

- パスワード12〜128文字、ログインID3〜40英数字等。PBKDF2-SHA256 100,000回、個別256bit salt。Workersの既存暗号制限を考慮した開発値。公開前にCPUとハッシュ強度の再評価を行う。
- セッションは256bit乱数、hashのみDB保存。`__Host-oshaberi` cookieはSecure/HttpOnly/SameSite=Strict/Path=/。30日固定期限。ログアウト・端末失効・子どものpassword変更時はサーバーで取り消す。
- state変更は同一Originと専用headerを必須。CORSを開かない。CSP、nosniff、no-referrer、frame拒否。ブラウザの位置/カメラ/マイクAPIを許可しない（写真ライブラリ入力は可能）。
- 招待URLはfragmentにtokenを置き、URL参照元へ渡さず、ページ読込時にアドレス欄から除去。tokenをログやlocalStorageへ書かない。QRはローカル同梱ライブラリで生成し、外部QRサービスへ送らない。
- 保護者の新規登録は運営の初期コードまたは有効招待を必須。招待受諾で双方承認は付けない。発行保護者も、受諾した相手の子を確認後に別途承認する。
- 子どもの公開検索、公開プロフィール、他人をIDで追加するAPIはない。
- 保護者は自分の管理対象児童が参加する、現在許可されたトークだけを閲覧。相手の保護者の別の子・別トーク・login・設定を返さない。
- 子どもは自分が参加するactiveトークだけ送受信。投稿直前にDB triggerで双方承認/停止/ブロック/画像承認も再検証する。
- 本文は文字列として保持してDOMのtextContentで表示する。HTMLを解釈しない。文字リンクの自動変換はしない。
- 登録した人物が実際の親権者であることをアカウント技術だけで証明できるわけではない。初回2家庭の運営では保護者同士の別経路での確認が必要。

## 4. 招待と友だちの流れ

1. 運営が最初の保護者へ登録用コードを安全な別経路で渡す。
2. 保護者Aが別アカウントの子Aを作り、利用時間を設定。
3. Aが子A向け招待URL/QRを作り、知っている保護者Bへ自分で渡す。
4. Bが保護者アカウントを登録/ログインし、子Bを作り、自分の子を選んで受諾。
5. 招待を1回だけ消費してpendingの組を作る。双方が相手の子を確認し、それぞれ承認。
6. 2つの承認が揃ってactive。その後だけ1対1トークが可能。
7. 解除/ブロック後は双方のトーク履歴・相手側画像のAPIアクセスを停止。自分の画像管理は可能。ブロック解除後も再招待と再承認が必要。

招待受諾はD1 batchの条件付きUPDATEとINSERT、部分一意indexで消費/二重登録を防止。メッセージは(author,nonce)一意とpayload hashで安全に再試行可能。写真承認はmedia状態更新と一意nonce付きmessage追加を同じbatchに入れる。

## 5. 新着・未読・既読

- visibleなトークで10秒間隔の差分polling。隠れたタブは通信しない。DOMの実際に見えている範囲を確認した子どもだけ、明示POSTで既読を進める。
- 保護者のGETに既読更新の副作用はない。保護者による既読APIは403。
- 初回は最新60件、過去60件ずつのページング。新着はseqで差分取得、重複DOM追加なし。
- 子どもの一覧も表示中に未読を更新する。通知音・push・メールなし。SWはインストール用のみでfetchキャッシュを作らない。
- メッセージの編集・送信取消は初期版に設けない。退会/保存期限切れの削除は本文を消すか履歴を削除し、監査イベントと矛盾させない。

## 6. 画像とスタンプ

- 標準スタンプは自作の絵文字＋短い言葉6種。外部キャラクター画像を転載しない。
- オリジナルは本人専用。子どものupload→pending→自分の保護者が承認→繰り返し使用。未承認は送信できず相手は取得できない。無効化で以後の送信・サーバー取得を停止。
- 写真は送信ごとに別mediaを作り承認する。本人と自分の保護者以外はpendingを取得できない。承認後に初めてmessageを追加する。却下で相手にmessageは作らない。
- ブラウザでJPEG/PNGを長辺384px（stamp256）に縮小し、固定ヘッダーとRGBA画素だけを送信する。サーバーで形式・寸法・厳密なbyte数を検証し、IHDR/IDAT/IENDのみの新PNGを生成する。圧縮デコード/再圧縮をWorkerから除き、元画像・EXIF等を保存しない。透明画像は白背景。
- サーバー受信は12+384×384×4 bytesまで、写真384px・stamp256pxまで。動画/GIF/SVG/HEICなどは直接受け付けない。iPhoneのライブラリからの画像選択/変換は実機で要確認。HEICを読めなければJPEG/PNGへの変換を案内する。
- R2 objectは推測困難なkey。公開URL・署名URLを発行せず、`/media/:id`で毎回認証/関係/状態/期限を確認、no-storeで配信。
- 一度相手端末に届いた画像のスクリーンショットや保存、既に表示済みの画像の取り消しまでは保証できない。保護者の承認は自動安全判定や完全保証ではない。

## 7. 時間・制限・保存期間（開発既定案）

| 項目 | 開発値 |
|---|---|
| 利用時間 | 全曜日未設定（子どもはトーク不可）。保護者が曜日別設定。APIは1日3帯まで、初期UIは1帯 |
| 時刻 | サーバー時刻＋設定timezone、初期Asia/Tokyo。日をまたぐ帯は2日に分割 |
| 送信 | 12回/分、240回/日、本文2000文字まで |
| upload | 10回/日・2MB/回 |
| 招待発行 | 5回/日・3日・1回 |
| 認証試行 | IP秘密hash20回/15分、アカウント10回/15分 |
| API全体 | 本人240回/分 |
| pending画像 | 72時間で取得/承認不可、cleanupで物理削除 |
| 本文・承認済み写真 | 180日で取得不可、cleanupで削除 |
| 承認済み本人スタンプ | 無効化/本人削除まで保管 |
| セッション | 30日。失効後は利用不可、cleanupで削除 |
| 監査 | 90日。本文/画像/tokenなし |
| 取り消し/期限切れ招待 | token認証不可、期限後7日で削除 |

保護者は時間外でも管理・承認可。子どもへの写真配信は承認時点、閲覧は子どもの許可時間に限定。送信者または相手が一時停止中なら子どものトーク取得/送信も停止する。自分の子の保護者による見守り閲覧は一時停止中・時間外でも可能。友達登録解除・ブロック後のトークは保護者にも配信しない。

cleanupは開発実装済みだがCronは設定していない。本番では承認後に専用Workerへcleanup定期実行を設定し、実削除と失敗時の再実行を検証する。期限のAPI拒否はCronが遅れても有効。写真upload失敗時のrowは失効させ、削除待ちとする。

## 8. 削除・復旧

- 子どもの削除：保護者password再認証＋確認。active=0、全セッション失効、トーク停止、本人が送った本文とmedia参照を消去、画像を即時取得不能/cleanup削除対象にする。相手のaccountや別の子は削除しない。
- 保護者退会：管理児童を同様に削除し、本人の資格情報/呼び名を消去、セッションと招待を失効。監査に仮名IDは90日、参照整合性のための停止済みアカウント情報は最大180日残し、関係・同意・設定・アカウントの順でcleanupが物理削除する。画像削除が失敗した場合は取得拒否を保ったまま再試行し、完了するまで参照行を残す。即時の行物理削除と同義ではないことを説明する。
- 保護者password復旧：登録時の256bit復旧コードを一度だけ表示。hashを保存、使用後は新しいコードに置換、全セッション失効。子どもの復旧は自分の保護者がpasswordを再設定する。本人確認を省略した運営手動リセットはしない。
- バックアップは専用DB/R2だけを対象に運営が非公開保管。SQLを公開Gitへ置かない。復元時は削除済み利用者・期限・取り消し/ブロックを再適用してから再公開し、古いセッションを全失効させる。
- R2/D1は同一トランザクションではない。削除は期限判定で即時遮断してからobjectを削除し、cleanup再試行可能にする。運用前にR2 object inventoryとDB対応を確認する。

## 9. 画面

1. ログイン：子ども/保護者共通、役割はサーバーが判定。招待を持つ保護者登録・同意・復旧コード。
2. 子ども：友だち一覧＋未読、吹き出し、日時/既読、テキスト/絵文字、標準/本人承認スタンプ、写真の承認依頼。
3. 保護者：自分の子を選択、見守り、友だち双方承認/解除/ブロック、写真/スタンプreview、利用時間・一時停止・写真ON/OFF、端末失効/password再設定、削除。
4. プライバシー：データ項目・用途・相手家庭への提供・親の閲覧・保存期間・保存可能性・同意撤回。

## 10. 実装段階と公開ゲート

- 第1〜6段階は独立ソースとローカルD1/R2/ブラウザで実装・試験する。既存HOMEへ取り込まない。
- 第7段階の実iPhone/Android・外部招待・実Cloudflareは公開承認後の別段階。
- 本番前に、使用ドメイン/運営者名/問い合わせ窓口/保存期間/保護者確認方法を決定する。
- Cloudflareの現プランCPU/メモリ/課金を確認。公式Worker FreeのCPU制限と、JSによる画像再生成・password計算の実測を照合する。合成1200×900画像のNode CPU実測は約251ms（user231.5ms＋system19.1ms）で、Freeの10ms/req以内とは確認できていない。この数値はCloudflare本番CPU測定ではないが、画像機能をこのままFreeで公開できると判断しない。ローカル成功をFree実運用成功とみなさない。必要なら画像処理の効率化または課金の承認を別途相談し、勝手に有料化しない。
- 未知利用者の一般公開前に個人情報の利用目的/第三者提供/保有・削除の案内、同意証跡、セキュリティ/事故対応、国外クラウド取扱い、適用法令を再確認する。現在の説明案だけで法令適合済みとしない。
- 現初期版の対象は日本の2家庭の閉じた試験。販売・国外提供時は対象地域/年齢に応じた再評価が必要。

## 11. 一次情報（2026-10-26確認）

- 個人情報保護委員会 Q1-62（子どもの同意能力、法定代理人等の同意）：https://www.ppc.go.jp/all_faq_index/faq1-q1-62/
- 同ガイドライン（利用目的・安全管理・第三者提供等）：https://www.ppc.go.jp/personalinfo/legal/guidelines_tsusoku/
- Worker routes無効化：https://developers.cloudflare.com/workers/configuration/routing/workers-dev/
- Static Assets run_worker_first：https://developers.cloudflare.com/workers/static-assets/binding/
- CPU/メモリ等：https://developers.cloudflare.com/workers/platform/limits/
- JPEG処理：https://github.com/jpeg-js/jpeg-js （BSD-3-Clause、由来decoder Apache-2.0/encoder Adobe BSD。licenseを同梱）
- PNG処理：https://github.com/pngjs/pngjs （MIT）
- QR：https://github.com/soldair/node-qrcode （MIT。QR生成データは外部送信しない）

保護者同意の実装は安全・法令対応の一部であり、適用法令の最終確認や実際の保護者の確認を置き換えない。

無料枠向け画像再設計・本人限定試験：[調査と手順](free-images-private-test.md)。実CloudflareのCPU適合・実機は未確認。
