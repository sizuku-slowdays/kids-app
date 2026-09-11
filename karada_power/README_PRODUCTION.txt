からだパワー PRODUCTION v14.1


からだパワー 本番版 v13

本番URL: https://cetus.fun/karada_power/

・ホーム画面用アイコン: icon-180.png / icon-192.png / icon-512.png
・PWA start_url / scope を /karada_power/ に固定
・食事記録は端末内(localStorage)へ即時保存
・D1 Workerを接続すると端末内＋D1へ二重保存
・D1未接続でもアプリは通常利用可能
・D1接続後は既存の端末内記録を自動アップロード

重要: D1 Worker側は別ZIP「karada_power_d1_backend_v1」をデプロイしてから、アプリの「☁️ D1につなぐ」で家族コードを1回入力します。


v13.1修正: 初回D1ペアリング時に既存の食事記録を検出できない正規表現を修正。Service Workerキャッシュ名もv13.1へ更新。


v13.2: スマホ上部3タブの文字つぶれを修正。図鑑タブを「🍎 食べもの図鑑」に短縮し、3タブを均等幅・中央配置に調整。

[v14.1]
- D1 sync: meal records + food preferences + food-specific allergy flags + 「料理による」メモ
- Safer merge: newest client edit wins; pairing no longer blindly uploads stale local records first.
- Requires D1 migration 0002_child_settings.sql and Worker v3.


v15 食材整理:
- バターを「海藻・その他」から「乳製品」へ移動（ID other_007 は記録互換のため維持）
- 「乳酸菌飲料」を「ヤクルト」表記へ変更
- 「卵焼き」を独立食材から削除。卵は「鶏卵」でまとめて記録


v15 食材追加・名称整理:
- とんかつが分かるよう豚ロース表示を「とんかつ（豚ロース）」へ変更
- 豚肉・牛肉のこま切れ/うす切りを子ども向け表示に整理
- いか、たこ、えのき、しめじ、マッシュルームを追加
- 油揚げを「うすあげ（油揚げ）」表示へ変更
- お水、麦茶、ルイボスティーを追加
- ごま油を「油・調味料」へ移し、こめ油・オリーブオイル・植物油を追加


v15 DHA/EPA公式データ版
- 文部科学省「日本食品標準成分表（八訂）増補2023年」食品成分データベースの脂肪酸・可食部100g値を使用。
- 魚介17食品に食品番号、DHA、EPAの公式値を登録。
- 「あたま」★は、DHA+EPAをアプリ内の比較用1回量へ換算して再計算。
- 比較用1回量と★境界はアプリ独自ルールであり、国の推奨摂取量ではありません。
- ★★★: 比較用1回量でDHA+EPA 800mg以上
- ★★: 200mg以上800mg未満
- ★: 25mg以上200mg未満
- 0: 25mg未満
- rule_version: DHAEPA-2026-09-v1
