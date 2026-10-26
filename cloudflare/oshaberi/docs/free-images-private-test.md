# 無料画像処理と本人だけのスマホ試験

2026-10-26調査。コードは未公開ブランチ `feature/oshaberi-independent-20261026`、Draft PR #18。本番デプロイ、実D1/R2作成、URL有効化、外部招待、既存HOME変更は実施していない。

## 1. CPU制限と採用案

Workers Freeは1呼出10ms CPU・1日100,000リクエスト。待ち時間とCPU時間は別物。従来のJS JPEG/PNGデコード→JPEG再圧縮は、合成1200×900画像の旧試験でNode CPU約251ms、今回384×384ノイズでもp95約179ms。Free運用の根拠にはならず、従来処理を公開経路から外した。旧実装は `scripts/legacy-image-baseline.js` に性能比較用としてのみ残す。画像コーデックはdevDependency。

新方式：

1. スマホのブラウザがJPEG/PNGをネイティブデコード。写真は長辺384px・スタンプ256pxまで縮小し、白背景へ描画する。
2. 圧縮画像ではなく、固定12byteヘッダー＋幅×高さ×4byteの画素だけを送る。
3. Workerがmagic/version、正の寸法、用途ごとの上限、受信総byte数と厳密な一致を検証する。透明画素（alpha≠255）はサーバーで拒否し、見えない色の埋め込みを許さない。JPEG/PNG/SVG/HTML等の元ファイルはこのAPIでは受け付けない。
4. WorkerがIHDR・IDAT・IENDだけの新PNGを作る。各行filter=0、DEFLATE非圧縮block、CRC32・Adler32を自前で構成し、攻撃者指定の圧縮データを解凍しない。メタデータを入れる余地は設けない。
5. 新PNGだけを非公開R2へ保存。保護者が最終PNGを見て承認した後、相手に認証・認可済みWorker経由で配信する。

クライアントの変換結果を「安全な画像だ」と信用して保存する方式ではない。サーバー側で任意ファイルから画素の数値列に入力を限定し、画像コンテナを再構築する。未承認画像への相手・相手親のアクセス拒否、承認必須、却下・無効化・期限、送信先ACLは維持する。画素に描かれた内容の適切さは自動判定できず、従来通り保護者の確認が必要。

写真はフル解像度ではなくチャット用の縮小版。最大384×384で590,321bytes（約0.59MB）。非圧縮PNGなのでJPEGより容量が増える。細かい文字や書類の判読用途を保証しない。512px案のローカルCPU余裕が少なかったため384pxにした。承認プレビューで内容を確認できない写真は承認しない。

`node scripts/benchmark-images.mjs` の実測は `image-benchmark-local.json`。50回の新方式：wall中央値2.47ms、wall p95 5.12ms、プロセスCPU p95 11.77ms。NodeのCPUにはJIT/GC/プロセス内処理が含まれ、Cloudflare課金CPUとは比較不能。速度改善の証拠であり、Free上の安定稼働を確定した数字ではない。

公開前：専用Free Workerで小画像/最大画像/ノイズ・連続/同時送信・初回coldを測る。署名認証・セッション・rate制限・R2/D1込みのCPU、1102、500、メモリ、保存後の承認を確認。ログインのPBKDF2やcleanupも別途測る。上限ぎりぎりなら安全処理を省かず、最適化または有料案を相談する。未測定のまま外部利用可能にしない。

## 2. 無料代替・費用（USD、税/為替別）

| 方式 | 判定・費用 |
| --- | --- |
| 固定画素→Worker生成PNG＋D1＋非公開R2 | 第一候補。画像変換の追加サービス契約不要。各Free枠内なら追加$0。既存アカウントの利用量は未確認 |
| ブラウザが作ったJPEGをそのまま保存 | 不採用。改造クライアントの危険なファイルをサーバーで排除できない |
| Freeの公開URL経由画像変換 | 不採用。認証付きoriginをtransformするshare-publicly方式は公開キャッシュの条件があり、非公開写真向けに使わない |
| Cloudflare Images binding | private bytesを入力できる候補。価格ページにはFree 5,000 unique transforms/月、しかし公式upload tutorialはImages Paid prerequisiteと記載。利用アカウントで無料binding利用可否を未確認。無料と断定・有効化しない |
| Workers Paid | 最低$5/アカウント/月。10Mリクエスト・30M CPUms/月を含む。超過$0.30/Mリクエスト・$0.02/M CPUms。画像処理のCPU余裕を増やせる。既存契約次第で追加基本料が異なる。無断変更しない |
| Images Paid | 5,000 transforms/月まで含み、以後$0.50/1,000。例10,000 transformsなら変換超過$2.50/月。R2保管は別、Images保管を使えば$5/100,000画像/月・配信$1/100,000。Workers基本料等を含む総額ではない |

R2 Standard無料枠：10GB-month、A操作1M/月、B操作10M/月、egress無料。超過：$0.015/GB-month、A $4.50/M、B $0.36/M。例1,000枚の最大写真を1か月維持して約0.59GB（バックアップ等は別）。新bucketを作ってもアカウントの無料枠が増えるわけではない。D1 Freeは日次5M行read・100k行write・合計5GB、超過時は要求失敗。HOME等の既存使用量も確認する。

## 3. 本人だけの安全なテストURL（準備済み、まだ存在しない）

- 専用 `oshaberi-owner-test` Worker、新規の空D1・非公開R2だけを作る。既存HOMEのDB・R2・Workerを使わない。テストと本番アカウントは共有しない。
- Cloudflare Accessを**この新Workerだけ**に設定し、利用者本人1名のidentityだけAllow。Everyone/全ドメイン許可/Bypassを作らない。`Protect all Workers`を使うと既存HOMEに影響するため禁止。
- アプリ内でもAccess JWTのRS256署名、issuer、audience、期限、本人emailのSHA256、許可origin、試験期限を全経路（静的ファイル・API・画像・SW）で検証する。単なるemailヘッダーや秘密URLでは許可しない。固定したissuerから公開鍵を1分cacheで取得し、失敗は拒否。TEST_EXPIRES_ATを過ぎると停止する。
- `wrangler.private-test.jsonc` は全公開/登録/招待OFF・ダミーDB・期限0。承認後にコピーしたGit対象外 `.private-test-config.jsonc` へ専用IDを設定する。RATE_SECRET/TEST_OWNER_EMAIL_SHA256はSecret。秘密値をGit・会話へ貼らない。
- 最初のデプロイはworkers_dev=false、RELEASE_ENABLED=0のまま。Access保護を設定してから本人限定URLを有効にし、未認証/別ブラウザからAPI・画像を開いて拒否を確認。バイパス用preview/custom routeを作らない。
- 正常なAccess＋アプリログインの両方が必要。no-store/noindex、キャッシュなしSW。Accessの認証と親子4アカウントの認証は別。
- Access認証にOTPを選ぶ場合はログインコード用メールだけ。メッセージ/メール/Push通知は実装しない。既存HOME通知へ接続しない。

**承認前に実リソース作成・remote DB操作・デプロイ・URL有効化はしない。** この資料は実行済みを示さない。専用URL・Access team/audience・試験期限・アカウント使用量を確認してから、対象が新環境だけと分かる一括PowerShell手順を作る。現時点のテンプレートから本番を自動操作するコマンドは提供しない。

## 4. 外部の人を招待せず試す

ローカルで以下を実行すると、保護者A/こどもA・保護者B/こどもBの計4アカウント分のダミーSQLとランダムな別々のパスワード/保護者復旧コードを私用フォルダーへ生成する。ネット接続・DB実行はしない。

```powershell
# cloudflare/oshaberi フォルダーで。毎回新しいフォルダー名にする。
node scripts/prepare-owner-test.mjs "$env:USERPROFILE\oshaberi-owner-test-private"
```

`owner-test-seed.PRIVATE.sql` / `owner-test-credentials.PRIVATE.json` はGit・チャットへ送らない。承認後に新規空の専用DBだけへ一度取込。既存データがあればguard失敗し、再取込でもリセットしない。外部招待URLは作らない。2人の友達関係はpending・承認0、時間未設定・写真OFFのまま用意する。本人一人が架空の両保護者を操作する試験用で、実際の保護者同意を得たという意味ではない。

1. 保護者A・Bとしてそれぞれログイン、友達を各1回承認。一方だけでは開始できないことを確認。
2. 各親が自分の子の利用時間を設定。写真テスト時だけ写真許可ON。
3. 子Aで送信→ログアウト→子Bで受信。PCの別ブラウザ/profileや別端末を併用すると両側を同時確認できる。本人Access認証は同じでよい。親子のアプリパスワードは共有しない。
4. 子Aで写真申請→子Bで未配信確認→親Bは承認不可確認→親Aで承認→子Bで受信。
5. 親閲覧で子の既読が変わらない、却下、停止、時間外、端末失効、アカウント削除もダミーで確認。
6. 試験終了後は新WorkerのURL/RELEASEをOFF、Access許可を撤回し、専用D1/R2の廃棄を確認。HOMEには操作しない。

## 5. iPhone・Androidチェック

- Safari/Chromeとホーム画面PWAそれぞれでAccess→アプリログイン、復帰、期限切れ、ログアウト、親子切替。PWA間で別セッションになると決めつけず確認。
- 写真ライブラリのJPEG/PNG、iPhoneのHEIC/HEIF、向き、縦横、透過PNG、スクリーンショット、大きい写真、選択取消、破損。HEICがJPEG/PNGとして渡らなければ明確に拒否し変換案内。無検証HEICを保存する迂回はしない。写真384pxの見やすさ・親確認のしやすさを確認。
- 低速回線・圏外・復帰・二重タップ・承認再実行、pending相手取得拒否、却下/停止後取得拒否。縮小/メモリ不足時は未送信に戻り理由を表示し、元ファイルへfallbackしない。
- 文字/絵文字・ソフトキーボード・スクロール・スタンプ・新着/既読・PWA復帰。通知許可を一切要求しない。外部ネット通信はAccess/Cloudflareとこのアプリだけ。
- Android Chrome実機とタブレットも実施。Chromiumの390/768/1280px合格はiOS Safariの実機合格を意味しない。

## 公式資料

確認日2026-10-26。価格/提供条件は反映前に再確認する。

- https://developers.cloudflare.com/workers/platform/pricing/
- https://developers.cloudflare.com/d1/platform/pricing/
- https://developers.cloudflare.com/r2/pricing/
- https://developers.cloudflare.com/images/pricing/
- https://developers.cloudflare.com/images/optimization/binding/
- https://developers.cloudflare.com/images/tutorials/optimize-user-uploaded-image/
- https://developers.cloudflare.com/images/optimization/transformations/control-origin-access/
- https://developers.cloudflare.com/workers/configuration/cloudflare-access/
- https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/
- PNG仕様 https://www.w3.org/TR/png-3/
- zlib/DEFLATE https://www.rfc-editor.org/rfc/rfc1950 https://www.rfc-editor.org/rfc/rfc1951
