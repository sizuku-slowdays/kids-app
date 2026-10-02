# 招待制HOMEの認証基盤

新しい `home-worker` と `home-db` 用の独立した実装です。既存の `calendar-worker`・既存D1・既存URLを変更しません。

## 今回使える機能

- 一度限りの初期設定で運営者の個人アカウントと家庭を作成
- 運営者が発行する1人1回・7日間の招待コードから登録（公開自由登録なし）
- ログインIDと個人パスワードによる認証
- サーバーに保存した端末別セッション。本人の設定画面から端末ごとに失効
- 家庭に子どもを任意の人数登録し、その子どもに個人アカウントの招待を関連付け
- HOMEに置くアプリを本人が表示・非表示
- 非公開R2ファイルの取得時に、セッション・アプリ利用権限・所有者・共有許可を検証

現在アプリはすべて「準備中」です。リンクだけで既存アプリが認証対応した扱いにはしません。招待コードをコピーした後は設定画面を閉じてください。初期設定コードと招待コードはURLに含めません。

## 保存する構造

| テーブル | 用途 |
|---|---|
| users / sessions | 個人認証と端末ごとのログイン |
| groups / memberships | household（家庭）とsharing（任意メンバー）、所属と役割 |
| children | 人数に固定枠のない子ども。ログインアカウントは任意 |
| apps / group_apps | 変更可能なアプリカタログと利用権限 |
| user_apps | 個人HOMEの表示設定。アクセス権限とは独立 |
| invitations | 運営者が許可する登録。家庭への参加と子どもへの紐付け |
| resources / resource_grants | 個人またはグループ所有、対象ごとの共有先・read/write・承認・取消 |
| private_files | 非公開R2オブジェクトと権限確認対象の関連付け |
| timetables | 子どもIDと週開始日による時間割。先週・今週を取得する拡張用 |
| legacy_links | 既存アプリの利用者IDとの対応付け。まだデータ移行しない |

家庭をまたぐ共有は個人への許可、またはsharingグループへの許可で表現できます。グループ間共有は対象グループ管理者の承認を記録する構造です。共有設定の作成・承認画面、別家庭の作成画面、時間割・アルバム・既存アプリの移行は次の段階です。今回は共有取得の権限評価だけ実装しています。管理者という理由で私有データを閲覧する特権は付けていません。

## セキュリティ上の扱い

- パスワード：ユーザー別ランダムsalt、PBKDF2-SHA256 600,000回。平文保存なし
- セッション：256bit乱数、DBにはSHA256ハッシュのみ、HttpOnly / Secure / SameSite=Lax / host-only Cookie
- セッションは180日で失効。ログアウトや端末失効はサーバー側で即時反映
- 変更リクエストのOriginは現在のHOMEと完全一致を要求
- ログイン等の試行制限：IPとログインID、入力サイズ制限
- 本名は認証後APIだけで返す。公開HTML・JSに家族名・画像・合言葉なし
- 非公開画像は `/media/{file-id}` で取得。R2を公開しない。URLを知っていても権限がなければ取得不可
- 非公開応答は `private, no-store`。Service Workerによるオフラインキャッシュは導入しない
- メディアは移行時に画像等の許可したMIMEタイプを確認して登録すること。HTML/SVG等の利用者アップロードを同一オリジンで配信しない
- URLのログはルートのみ。パスワード・Cookie・名前・招待コードをログ出力しない

既存URLや既存の公開画像は今回の基盤だけでは保護されません。アプリの移行時にAPI、R2公開設定、GitHub Pagesの公開元まで確認します。過去に取得された画像を遠隔で消す機能はありません。

## ローカルで確認

Node.js 22以上。

```bash
npm ci
npx wrangler types
npm run check
npm test
```

ローカル操作する場合は `.dev.vars` にランダムな `BOOTSTRAP_SECRET` を設定します（Git管理対象外）。

```bash
npx wrangler d1 migrations apply home-db --local
npm run dev
```

ローカルでもSecure Cookieを使うので、localhostで開きます。`/setup` で最初の親アカウントを登録し、設定→家庭の子どもで人数分登録→子ども用招待コードを発行→各子どもの端末で `/register` に入力します。実名や実パスワードをテストに使う必要はありません。

## Cloudflareへの公開

Cloudflareにログインした環境で、このフォルダーから実行します。テスト環境では本番DBを使わないでください。

1. `npx wrangler login`
2. `npx wrangler d1 create home-db` で**新規**D1を作成。出力された `database_id` を `wrangler.jsonc` のD1設定へ追加
3. `npx wrangler r2 bucket create home-private` で**新規**R2を作成。Cloudflare画面で **Public Development URL（r2.dev）無効・公開Custom Domainなし**を確認
4. `npx wrangler secret put BOOTSTRAP_SECRET` で十分長いランダムな初期設定コードを設定。コードをGitHubやこの会話へ貼り付けない
5. `npx wrangler d1 migrations apply home-db --remote`
6. `npx wrangler deploy`。まず新しい `home-worker` のworkers.dev URLで確認
7. `/setup` で最初のアカウント作成。完了後 `npx wrangler secret delete BOOTSTRAP_SECRET` で初期設定コードを削除してよい（登録済みアカウントは残る）
8. CloudflareのWorker→Settings→Domains & Routes→Add→Custom Domainで `home.cetus.fun` を追加。cetus.funのDNSがCloudflare管理の場合に利用可能
9. 固定した本番URLでログインし、Safariからホーム画面へ追加して実機確認

workers.devとhome.cetus.funのCookieは共有されません。ドメインを確定した後に各端末の初回登録・ホーム画面追加を行う方が簡単です。通常のSafariとホーム画面アプリ間の認証の引き継ぎは実機で確認してください。

Freeプランでは `limits.cpu_ms` の設定自体が拒否されるため、CPU上限の明示設定は行いません。パスワード導出がFreeプランのCPU制限内で完了するかは、公開後の初期登録・ログインで実環境確認が必要です。公開成功だけで認証が利用可能とは判断しません。パスワード導出の強度を下げて回避しないでください。

## GitHub接続からの公開

作業ブランチ `feat/home-auth-foundation`、Root directory `cloudflare/home-worker` を指定します。Build commandは空欄、Deploy commandは `npx wrangler d1 migrations apply home-db --remote && npx wrangler deploy`。Preview buildsは無効にし、別ブランチから本番D1へのマイグレーションが実行されないようにします。

## 公開前・公開後の確認

- 未認証のHOME直アクセスはログインへ、APIとメディア取得は401
- 別グループの画像は404、承認前共有も404、承認後200、取消後404
- 招待の使用済み・期限切れ・取消済みは登録不可
- アプリの表示設定が他ユーザーに影響しない
- 端末失効後、API・メディアのアクセス不可。別端末のセッションは有効
- 初期設定は2回目不可、公開HTMLから非公開の名前が取得できない
- 本物のiPhoneで閉じる→再起動、ホーム画面追加、ログアウト、端末失効を確認

本番公開、R2公開設定確認、スマホ実機確認はCloudflare接続後に行います。既存アプリへの移行はユーザーのHOME確認後です。
