# 自作アプリ・メインWork 引き継ぎ台帳

調査日：2026-10-09。管理場所：`kids-app/docs/main-work/`（main）。この資料から、別のWorkでも調査・改修を再開できます。

| 資料 | 内容 |
| --- | --- |
| [アプリ一覧](apps.md) | 主なアプリ、URL、リポジトリ、コード上の状態、静的ページ全件一覧 |
| [Worker対応表](workers.md) | Worker、API、D1、R2、Service binding、反映方法 |
| [現在の仕様と保存先](specifications.md) | 認証・権限、HOME、通帳、カレンダー、画像、旧方式との境界 |
| [作業履歴](history.md) | GitHubで確認した変更日・コミット・関連ファイル |
| [未完了と注意事項](backlog.md) | 未実装、未確認、本番確認が必要な事項 |
| [資料更新の手順](maintenance.md) | 改修ごとの更新、引き継ぎの開始手順 |

## 最初に確認すること

**mainとHOME作業ブランチは別です。** HOMEの最新コードをmainにあるものとして編集しないでください。mainの変更をHOMEブランチへ丸ごと上書きすることも避けます。

| 調査対象 | 確認した版 | 用途・確認範囲 |
| --- | --- | --- |
| kids-app / main | [7afd932](https://github.com/sizuku-slowdays/kids-app/commit/7afd93235cc6f4cfec2568e07819a028a95789a9) | 公開静的ページ・家計簿・既存アルバム・時間割・からだパワー等。CNAMEはcetus.fun |
| kids-app / feat/home-auth-foundation | [9cf5cb2](https://github.com/sizuku-slowdays/kids-app/commit/9cf5cb27197e851d91a5e9f9146da76cf9fc1dbb) | HOME、共通認証、つうちょう、HOME版筋肉貯金、カレンダーWorkerソース等 |
| kids-app / family-login-v2 | 319b52b9ee2eaf4fd06a1e0478b59e0699e43463 | ブランチの存在・先頭SHAを確認。現在の本番配信元かは未確認。今回の詳細調査対象外 |
| nobankapp（非公開） | mainのtree：6de7da928c2244753f407211edbffa926275717f | READMEとファイル一覧を確認。銀行・家計簿・学校チェック・いいこと等のファイルあり。現用／保管用途は未確認 |
| nosizuku-slowdays.github.io（非公開） | mainのtree：8c71d14e4ee6856ec6c70a62c4781c27fd5ab3e2 | READMEとファイル一覧を確認。日記・サイト・S-BOX等。現用URLと配信設定は未確認 |
| test（公開） | mainのtree：52b689d3f6613a99a428d9e4adf2cd39293ef11c | READMEとファイル一覧を確認。からだパワーのファイルあり。公開・本番用途は未確認 |

他リポジトリ：[nobankapp](https://github.com/sizuku-slowdays/nobankapp)、[nosizuku-slowdays.github.io](https://github.com/sizuku-slowdays/nosizuku-slowdays.github.io)、[test](https://github.com/sizuku-slowdays/test)。非公開リポジトリの実データ・バックアップ内容は本資料へ転載していません。

## 確認区分

- **コード確認済み**：上記の固定コミットのソース／設定／SQLで確認した事実。デプロイ済みという意味ではありません。
- **未確認**：Cloudflare Dashboardの実設定、実DB内容、全Worker一覧、本番への最新版反映、ログインした実機での動作など、今回確認できなかった項目。
- **利用者報告**：会話での稼働・切替確認。コードの事実とは分けて記載します。

GitHubのCNAME・ソースから入口URLを整理しました。本番HTTP疎通と全ユーザーの権限試験は今回実施していません。CloudflareのBuild設定やSecret値、D1/R2の本番内容をGitHubだけで確定することはできません。

古いアプリ別READMEには「未移行」など初期段階の説明が残ります。現在のコード・この台帳・実際の本番確認を照合してください。今回の追加は管理資料と更新ルールのみです。
