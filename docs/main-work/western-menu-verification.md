# ビフテキうえすたん・店舗専用メニュー照合

対象：ウエストコート姪浜店。店舗ページ https://western-fukuoka.jp/shop/western-arita 、指定された公式PDF https://western-fukuoka.jp/img/menu-arita.pdf 。確認日2026-10-12。共通ページや他店舗から価格を補完していない。

PDF全6ページをテキストと紙面で照合。取得ファイルの内部ModDateは2025-05-27。紙面の改訂日記載はなく、2026年改訂版とは主張しない。

| PDFページ | 区分 | 商品グループ | サイズ等の価格選択肢 |
| --- | --- | ---: | ---: |
| 1 | テイクアウト | 10 | 29 |
| 2 | ランチ | 27 | 55 |
| 3 | 通常料理・セット・トッピング | 39 | 69 |
| 4 | サイド | 7 | 7 |
| 5 | お得なセット（画像のみ） | 5 | 5 |
| 6 | ドリンク | 18 | 24 |
| 合計 | 全登録用データ | 106 | 189 |

抽出106商品/189価格、登録用データ106商品/189価格、読み取り不能・未登録0。ステーキのグラム数、ソース、赤/白や瓶ブランド等の選択肢は1商品内のvariantsとして数える。単価が同じ選択肢も個別の選択肢として数える。

ランチサガリ150gは1800円、通常は1740円。ランチのチーズ200円と通常のチェダーチーズ250円は混ぜない。テイクアウトの容器込み価格は別モードに登録。ランチソフトドリンクは300円/食事された方200円の手動選択とし、通常ドリンクへ割引を自動適用しない。

セット変更は差額商品として「元のセットも追加」と注記。紙面に時刻がない商品は「提供時刻/時間帯の記載なし」。ランチ時間はPDF記載11:30〜15:00・O.S.14:45を使用（店舗ページの開店時刻11:00とは区別する）。

機械可読集計と原本SHA256は western-menu-audit.json。登録全件は cloudflare/home-worker/src/dining-western.ts。元PDF/紙面画像と家庭の実データはGitへ保存しない。

## ローカル確認

HOMEディレクトリで dry-run を作った後、node --test test/dining-prices.test.mjs test/dining-order.test.mjs を実行。

DOM操作の追加確認は任意のjsdom環境で scripts/check-dining-order-dom.mjs を実行する。例：npm install --prefix /tmp/wagaya-dom jsdom --no-save --ignore-scripts で用意し、DINING_DOM_PACKAGE=/tmp/wagaya-dom/package.json node scripts/check-dining-order-dom.mjs 。一時依存は本番Workerに不要。DOM確認は実機iPhone描画の代替ではない。
