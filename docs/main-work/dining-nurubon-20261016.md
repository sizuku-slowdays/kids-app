# 外食料金：ヌルボンの追加・確認記録

## 2026-10-16 外食料金：ヌルボン福重店・店舗間比較

- 利用者が福重店を指定。公式店舗ページ https://www.nurubon.co.jp/tenpo/fukushige.html からリンクされた https://www.nurubon.co.jp/img/tenpo/pdf/5ten_tabe.pdf の現行画像を確認（古い非www版の抽出結果は料金が異なるため不採用）。
- 食べ放題5料金：お手軽120分/90分、ヌルボン、極味、国産牛厳撰。大人/65歳以上/高学年/低学年/4歳〜未就学児/3歳以下は公式画像と照合。
- 中高生専用料金は公式表に掲載なし。入力案の国産牛厳撰3,454円は高学年価格。中高生の5価格をnull（確認待ち）で保持し、参加時は合計を出さない。大人料金への推測置換もしない。家庭の大人が確認後に料金編集可。
- 共通人数は7区分。ウエストへの計算時のみ高低学年を小学生、未就学児を幼児へ正確に合算。ウエストの保存済み5区分の料金・うえすたんの商品は不変。
- 食べ放題店舗の全コースを一覧比較。ヌルボンのみ飲み放題オプションあり。各カードに飲み放題の包含を表示（ウエストは未登録の飲み放題料金を推測しない）。
- 飲み放題：ソフト550円、4歳〜未就学児110円、3歳以下0円。ビールなし1,738円/あり2,178円。両アルコールプラン混用不可。20歳以上の飲酒人数を明示し、その他全員ソフトとして集計。90分でも同額。料金編集可。
- HOME既存認証/家庭別権限を維持。既存のdining_price_states JSONへ店舗のみ一度追加。dining_price_backupsへ変更前の全店舗JSON・revisionをD1 batch内保存し、revision比較とdining_price_importsの一意キーで再追加/競合上書きを防止。削除後の自動復活なし。新規テーブル/マイグレーション/Cron/Bindings変更なし。金融・通知テーブルを変更しない。
- URL：/wagaya/apps/dining-prices/?view=compare
- 変更：src/dining-prices.ts、src/dining-nurubon.ts、public/apps/dining-prices/{app.js,calculator.js,index.html,style.css}、test/dining-{prices,nurubon}.test.mjs。
- 検証：TypeScript、Wrangler dry-run、HOME関連29件合格。Chromium390/1366pxで人数変更/店舗切替/比較/飲み放題/確認待ち/価格保存/はみ出しなしを確認。既存ウエスト計算・うえすたん計算、認証/家庭分離/子どもの編集拒否、旧価格保持、追加前バックアップ、再追加防止、保存競合をローカルD1で確認。本番残高でテスト入金なし。
- 本番：GitHub統合前の実装・ローカル検証時点。Cloudflare Build成功、実iPhone確認、中高生料金の店舗確認は未確認。
