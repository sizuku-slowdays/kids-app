# わが家アプリ 第1段階（玄関）

既存アプリを変更せず、家族が毎日使う入口だけを追加するパッケージです。

## 設置

1. この `wagaya` フォルダを、既存リポジトリのルートへそのまま追加します。
2. GitHubへコミット・プッシュします。
3. `https://cetus.fun/wagaya/` を開き、表示と各リンクを確認します。
4. スマホの「ホーム画面に追加」からPWAとして追加します。

既存のHTML、Worker、D1を変更する必要はありません。

## アプリの追加方法

`data/apps.json` の `apps` 配列へ1件追加します。

```json
{
  "id": "重複しない英数字ID",
  "name": "表示名",
  "description": "短い説明",
  "url": "確認済みの公開URL",
  "icon": "絵文字1文字",
  "color": "mint",
  "category": "daily",
  "featured": false,
  "order": 7
}
```

- `featured: true`：ホームの「よく使うアプリ」に表示します。ホームは先頭4件までです。
- `featured: false`：アプリ一覧だけに表示します。
- `category`：`daily`、`money`、`record`、または `categories` に追加したIDを使います。
- `color`：`mint`、`sky`、`yellow`、`pink`、`orange`、`purple` が定義済みです。
- URLや既存アイコン名は推測せず、確認できたものだけを登録してください。

## Service Workerの範囲

- Manifestの `scope` は `/wagaya/` です。
- 登録時にも `scope: './'` を明示しています。
- `sw.js` はURLのパスが `/wagaya/` で始まる通信だけを処理します。
- `/kanriapp/` など既存アプリの通信やキャッシュには介入しません。

## 確認済みURL

以下は2026-07-17に公開先の応答を確認したURLです。

- `https://cetus.fun/kanriapp/calendar.html`
- `https://cetus.fun/kanriapp/mama-bank.html`
- `https://cetus.fun/kanriapp/karada_calendar.html`
- `https://cetus.fun/kanriapp/school-check.html`
- `https://cetus.fun/kanriapp/iikoto1.html`
- `https://cetus.fun/kanriapp/iikoto2.html`

「予定を追加する」専用の確認済みURLはないため、初期版では通常の家族カレンダーを開きます。既存カレンダー側に正式な追加用URLができた時点でリンクだけを差し替えられます。
