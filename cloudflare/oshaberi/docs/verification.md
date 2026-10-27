# 検証結果と残作業

2026-10-26 JST。合成データのみ、ローカルMiniflare D1/R2、同梱Worker bundleとChromiumで検証。本番Cloudflare/D1/R2へ接続していない。

## 合格した試験

- `npm test`：10群。認証/家庭・児童境界、双方承認、未承認トーク拒否、invite一度だけ消費・取消・期限切れ・並行受諾、他人ID差替え、未読、親GETで既読不変、親read POST拒否、nonce再送/並行送信重複防止。
- 写真：送信前approval、相手/相手親のpending取得拒否、無関係の子の画像取得拒否、並行承認で1messageだけ、却下で相手取得不能。
- スタンプ：pending送信拒否、承認後のみ利用、無効化後取得/再送拒否。
- 文字：HTMLをそのまま保存・textContent表示しスクリプトにしない。Origin/専用header必須。子どもが保護者APIを呼んでも拒否。
- 時間：サーバーJST、開始inclusive/終了exclusive、未設定/停止の拒否、時間外の子GET拒否と親GET許可。
- 端末：HttpOnly/Secure/SameSite cookie、サーバー失効後401、親子別ID/password。保護者復旧コードの一度だけ使用、使用後の全セッション失効も確認。
- 削除：停止後401、初期情報消去、R2期限切れobjectの物理削除、180日経過した停止済みアカウント参照のcleanup・行削除。
- レート：認証試行の429。APIはユーザー別の原子的bucket更新。
- 新画像単体：固定画素から新PNG、独立PNGデコーダーで全画素一致、最小/最大/非正方形、metadata chunkなし、SVG/HTML/圧縮画像/不正長/不正寸法拒否。旧JPEG実装の試験はベースラインだけで公開経路には使わない。
- 本人限定：Access署名/issuer/audience/owner/期限/host/全経路gate、偽造・期限切れ・別人拒否。ダミー4アカウントのオフラインseed、初期両承認0・写真OFF・時間閉鎖・招待0、再取込拒否。
- release gate：3フラグOFF、workers_dev/preview無効、routes/サービス/Cronなし、ダミーDB、SWにPush/通知/個人データキャッシュなし、テストコマンドにremoteなし。
- ブラウザ：実Workerと同じローカルD1/R2を使い、子2名＋保護者の独立contextでログイン・吹き出し・自動新着・標準スタンプ・親閲覧と既読不変・同梱QR生成・写真注意文を確認。実際に合成PNGを選択→ブラウザ縮小→pendingでmessageなし→保護者UI承認→相手の吹き出しへ写真表示、の一連操作も確認。外部ホストへのリクエストをテストで拒否。390/768/1280pxで横はみ出しなし、送信ボタン44px以上。独立context用にsingle-process Chromiumフラグは使わない。
- `npm audit --omit=dev`：実行時点でprod dependenciesの報告脆弱性0。完全な安全性の証明ではない。
- `npm run build`：新WorkerのWrangler dry-run成功。HOME bundleや設定は使用しない。

ブラウザ試験の再実行：

```text
WAGAYA_PLAYWRIGHT_MODULE=<installed-playwright>/index.mjs WAGAYA_CHROMIUM_EXECUTABLE=<chromium-path> node test/browser-qa.mjs
```

## 公開前に残っていること

1. 実iPhone/Androidの写真ライブラリ（HEICを含む）・写真確認/承認操作・PWAのアイコンとログイン継続・別端末セッションの実機試験。
2. CloudflareでのCPU/メモリ測定。従来JPEG処理を除き、384px固定画素→新PNGへ変更。ローカル画像処理単体CPU p95約11.77ms、実Cloudflareの全処理10ms適合は未確認。詳細は[調査報告](free-images-private-test.md)。
3. 運営者/問い合わせ先/公開URL/保存期間/保護者本人確認・同意説明と適用法令の確認。
4. 専用本番D1/R2/Workerの新規作成（未実施）、非公開設定、実インフラでのbackup/restore/削除/再試行・cleanup Cron導入。
5. 外部家庭への実招待・新規登録・画像送信の受入試験。招待は無効のまま、勝手に相手へ送らない。
6. 一般販売/国外利用・グループトーク・HOME identity連携は対象外。新機能として別途設計する。

既存HOMEのコード・設定・DBマイグレーション・アプリ一覧・通知設定・家族情報・通帳・ポイント・カレンダー・R2には変更を加えない。独立コードと管理資料だけを未公開ブランチへ保存し、マージ・デプロイはしない。
