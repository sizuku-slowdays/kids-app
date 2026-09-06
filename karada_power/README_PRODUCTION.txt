からだパワー 本番 v13.1

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
