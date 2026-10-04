# 交換商品の画像（既存方式の流用）

旧コードの確認結果:
- `kanriapp/otetsuday-toban.html` の `compressImageFile`: 写真ライブラリから `input type=file accept=image/*` で選び、端末のcanvasで長辺900px・JPEG品質0.78に縮小。data URLをJSONの `image_url` として送る。
- `otetsudai-api` の POST/PUT `/api/rewards`: 既存D1 `rewards.image_url` に保存。
- `kanriapp/otetsuday-points.html` はその `image_url` を表示。商品画像用R2アップロードはない。以前のURL指定画像は既存 `kanriapp/points/` の静的ファイルも使う。

統合版:
- 同じ圧縮関数・data URL保存方式を流用。既存 `passbook_rewards` に画像と編集revisionを追加するだけ。商品ID、必要ポイント、在庫、申請、台帳は作り直さない。
- 一覧JSONには画像本体を含めず、認証済み家庭メンバーだけが読める `/api/passbook/rewards/{id}/image` を返す。管理者だけ画像/商品編集可。未認証401、別家庭403、非表示商品は子ども404。private,no-store とnosniffを付ける。
- 旧移行商品の画像は既存LEGACY_DBから読み取る（通帳移行済み家庭・元商品IDで限定）。旧画像がdata URLなら直接返す。既存pointsフォルダの画像URLだけは同じGitHubファイルを認証APIで配信する。任意ホストを代理取得しない。旧画像そのものや旧DBを変更しない。
- 画像の変更・削除後は旧画像へ戻らない。新しい画像はHOME D1だけに保存。画像なし・読み込み失敗時も固定の画像枠を表示。
- 画像付き商品保存だけJSON上限600KB（UIはdata URL上限500KB）。その他のAPI/認証の16KB制限は維持。JPEG/PNG/WebP以外、SVG、任意URLは受け付けない。
- 商品のrevisionを照合して編集。在庫消費時にもrevisionを進め、編集中に交換が承認された場合に古い在庫数へ上書きしない。過去の申請は申請時の商品名・ポイントを維持。

検証: 旧画像読み取り、認証/家庭/管理者/Origin境界、画像追加・削除、旧画像への復帰防止、不正形式/サイズ上限、編集競合、残高・履歴不変をMiniflareで確認。既存テストも全通過。旧WorkerやR2設定の追加変更は不要。
