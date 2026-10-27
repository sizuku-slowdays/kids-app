# おしゃべり（独立ローカル開発）

HOMEとは別のWorker・D1・非公開R2で動く、保護者見守り型の1対1メッセージアプリ。**本番未公開・招待未有効化。既存HOME/DBへの変更なし。**

[設計・DB・権限・保存期間・公開ゲート](docs/design.md) / [検証と残作業](docs/verification.md) / [無料画像方式・本人だけのスマホ試験](docs/free-images-private-test.md)

## 開発だけ実行

このディレクトリ内で実行する。HOMEのrootやwrangler設定を使わない。

```powershell
npm ci
npm test
```

ローカル画面は`.dev.vars`（Gitに入れない）へ、試験用の値だけを書く。`BOOTSTRAP_CODE`と`RATE_SECRET`は十分長いランダム値にする。実データ・本番secretを使わない。

```text
RELEASE_ENABLED=1
REGISTRATION_ENABLED=1
INVITATIONS_ENABLED=1
BOOTSTRAP_CODE=LOCAL_TEST_ONLY_REPLACE_WITH_RANDOM_VALUE
RATE_SECRET=LOCAL_TEST_ONLY_REPLACE_WITH_RANDOM_VALUE
```

```powershell
npx.cmd wrangler d1 migrations apply oshaberi-local-only --local
npm run dev
```

表示されたlocalhostを使い、合成名で2保護者・2子どもを作って試す。同じブラウザは1アカウントなのでブラウザプロファイルを分ける。子どもは保護者が利用時間を設定してからログインする。Cookie/PWAの実機試験はローカルだけでは完了しない。

**`wrangler deploy`、`--remote`、本番リソース作成、公開フラグ変更は利用者の確認前に行わない。** 本番用ドメイン/ID/Cronはまだ設定していない。ゼロUUIDを実DBへ勝手に置き換えない。
