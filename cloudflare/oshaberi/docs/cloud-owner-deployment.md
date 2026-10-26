# 本人限定のCloudflare実行へ切り替える

Windowsのローカルworkerdがspawn EPERMで起動できず、利用者から保守会社のシールド発動の報告があった。検知内容・因果関係は未確認。利用者の指示でWindows実行診断は停止し、シールドの停止・除外・別名化などは行わない。

## 対象と停止条件

- 対象は新規 oshaberi Worker/D1/非公開R2だけ。既存HOMEは変更しない。
- AccessはこのWorker全URLと本人Allowだけを維持。一般公開・外部招待・有料化は未承認。
- 初期SQL/架空seedは新規空DBで名前とUUIDを確認してから。既存DB・既存ユーザーのデータを使わない。
- PC内テスト未完了を成功扱いにしない。開発環境の合成試験の結果とCloudflareの実測を分ける。

## Git接続

Worker oshaberi > Settings > Builds > Connect。
リポジトリ kids-app、ブランチ feature/oshaberi-independent-20261026、root cloudflare/oshaberi。
feat/home-auth-foundationやmainを選ばない。HOMEのGit設定を変更しない。
初回の保存/Deploy前に接続先・root・deploy commandを照合する。非本番ブランチのpreview buildは無効にする。

`scripts/configure-cloud-owner.mjs`に専用DB ID、origin、Access issuer/AUD、8日以内の明示的な期限を引数で渡す。実IDや本人メールは公開ファイルへ書き込まない。生成先は`.owner-cloud.jsonc`。このスクリプト自体はAPI/SQL/Deployを実行しない。

Deploy commandは設定生成に続けて `npx wrangler deploy --config .owner-cloud.jsonc`。従来の `npm test` はDeploy commandへ入れない。実行はCloudflare Builds側で行う。DB移行・seed適用を自動Deploy commandへ追加しない。

runtime SecretsはRATE_SECRET/TEST_OWNER_EMAIL_SHA256。PC内のPRIVATEファイルから本人が設定し、GitHub/チャット/Build commandに貼らない。未設定・期限切れ・Access不一致はアプリ側でも全経路拒否。

RELEASE_ENABLED=1は本人限定テストの画面/APIを実行するため。PRIVATE_TEST_MODE=1と登録/招待0の組合せを固定し、外部公開を有効にしない。JWT検証は画像/静的assetにも適用。Cloudflare Accessのポリシーも別途維持する。

## 実環境で残る確認

未認証のリダイレクト、本人認証、別本人拒否、四つの架空ログイン、双方の友達承認、時間設定、保護者の既読不変、写真送信ごとの承認、未承認画像取得拒否、Cloudflare Free CPU/エラー/共有無料枠、iPhone/Androidを確認する。失敗は制限を緩めず記録する。

本番アプリ反映・SQL適用・実測は、この手順追加時点では未実施。
