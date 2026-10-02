# 筋肉貯金専用API（未デプロイ）

新規: Worker `muscle-bank-worker`、D1 `muscle-bank-db`、非公開R2 `muscle-bank-private`。既存Worker/D1/R2を変更しない。新HOMEの実装は現在GitHubにないため、このAPIは未接続・未デプロイ。

## 認証接続はデプロイ前の必須作業

`worker.js` の `owner()` はHOME service bindingへ `GET /internal/session` を送る仮の契約。Cookie/Authorizationを渡し、HOMEが本人認証して `{userId: "実際の本人ID"}` を返す想定。現行HOMEの実コード・仕様を確認してこの1関数を合わせる。HOME側の内部APIを公開ルートに不用意に公開しない。

`MUSCLE_OWNER_ID` Secretはママの実ユーザーID。ブラウザが送る名前やIDでは認可しない。未接続/Secretなしは503、未ログイン401、他ユーザー403で閉じる。写真も同じ認可を通る。CORSを開かず、書込はALLOWED_ORIGINと同一Origin必須。HOME表示制御も本人権限を使う。

## 新規リソース作成後の手順

Cloudflare管理者がアカウントとHOME serviceを確認して実施:

```
npx wrangler d1 create muscle-bank-db
npx wrangler r2 bucket create muscle-bank-private
```

`wrangler.jsonc` のD1 IDとHOME service名を実物に置換、MUSCLE_OWNER_ID Secretを登録。R2 public accessは無効のまま。

```
npx wrangler secret put MUSCLE_OWNER_ID
npx wrangler d1 migrations apply muscle-bank-db --remote
npx wrangler deploy
```

同一オリジン `https://cetus.fun/api/muscle-bank/*` のみへRouteを設定。既存Routeを書き換えない。D1は運動・記録・ご褒美・基金などのJSONと楽観ロックrevisionを本人ID単位で保存。画像はprivate R2にowner別・SHA256キーで保存し、認証済みAPIが読んで返す。孤立した画像の自動削除は未実装（保持優先）。データが900KB以上のメタデータ、画像含み50MB以上に増えた場合は保存を拒否する。

## 切替前検証

未ログイン/別ユーザー/API直接アクセスが拒否されること。ママ本人で記録保存・再取得・写真表示、別端末同期、409競合、Origin違反を検証。次に `muscle-bank/config.js` のapiBaseを設定し、HOME権限に本人のアプリを追加。端末保存から移行する場合はまずバックアップ、ログイン後にバックアップ復元。既存通帳のポイント/資金は自動参照せず、今後本人同意付きで接続する。
