# HOMEへの組込み案（未適用）

これは適用できる完成パッチではありません。PR #4/#5と最新index.tsを再照合してから差分を作ります。準備ディレクトリをpublicやWranglerのassetsへ追加しないでください。

## 変更候補

1. routes.mjs/core.mjs/catalog.mjsをsrc内へ移すか適切な型定義を付ける。プレビューはUIの部品を再利用し、本番用通信層を別に接続する。サンプル切替は本番へ出さない。
2. index.tsの既存API分岐内で、HOMEセッションから得たuser.idだけをlearningRouteへ渡す。appAllowed(env,user.id,'school-prep' または 'english-flash')と既存のOrigin/CSRF検証を先に行う。ブラウザから届いたuser_id・テスト用ヘッダーを本人認証に使わない。
3. /apps/school-prep/ と /apps/english-flash/ の静的配信もsession()＋appAllowedで保護し、許可したファイル名だけを配信。未認証ページはログインへ、APIは401 JSON。/wagaya/のmount処理を二重に行わない。APIURLはディレクトリ相対から生成し、direct workers.devとcetus.fun双方を試験。
4. SQL案は移行番号を再確認して正式migrationsへ移す。PR #4=0018、PR #5=0019が準備中なので、今は番号を振らない。apps/group_appsの追加SQLも別途作り、許可家庭を明示して有効化する。user_apps/favoritesへ勝手に追加しない。
5. 本番UIには/api/homeから許可家庭、/peopleから本人または保護対象の子どもを選ぶ通信層が必要。HTTPエラー・非JSON・日付変更・複数端末競合・オフライン未保存を案内する。現在のプレビューはメモリ内だけの画面確認であり、この通信は未実装。

## API案と権限

全APIにhousehold、対象にはchild（children.id）を使用。本人user IDはサーバーのセッションが正本。

| API | 操作 | 制約 |
| --- | --- | --- |
| /api/{school-prep,english-flash}/people | GET | 家庭参加・アプリ割当、子は本人だけ、保護者は家庭の登録児童 |
| /api/english-flash | GET | 本人または保護者。本人の初回だけ今日のセットを作成 |
| /api/english-flash/profile | PUT | 保護者。alphabet/wordsと1〜10件。初期値は明示設定 |
| /api/english-flash/{remember,review} | POST | 本人のみ。JST当日、対象セット/既習項目。一意キーで再実行可 |
| /api/school-prep | GET | 日付の最新確定版とチェック。未確定AI結果を子へ返さない |
| /api/school-prep/confirm | POST | 保護者。expected_revisionで競合防止、新版を追記 |
| /api/school-prep/check | POST | 本人。版・項目・phaseを検証、request_id単位で冪等 |
| /api/school-prep/{summary,days} | GET | 直近30登校日集計／確認済み日付一覧。ポイント計算はしない |
| /api/school-prep/{extract,notify,reward} | 未接続 | 必ず503。画像取得・外部送信・付与を実行しない |

準備版の保護者は同一家庭のowner/adminで、child属性でも登録児童本人でもない人に限定。他の成人メンバーへ管理を広げる場合は明示の合意とテストが必要。単に大人だから全家庭のデータが見える設計にしない。

## AI画像読み取り（設計のみ）

- 現在の旧時間割は `api.cetus.fun/api/app-data-public?key=wagaya-timetable-grade{4,2}` 読取、app-data保存。今週・先週のcurrent/previousに画像を含む。学年キーとHOME child IDの自動対応は不可。旧データの中身・実bindingは未確認。
- 旧Workerの公開読取をそのまま新APIへ中継しない。事前に旧時間割バックアップ、画像の家庭・子ども・週を保護者が確認。非公開R2とprivate_files/resourceの認可経路へ安全に接続する。既存の時間割画像は今回変更しない。
- 新しい/extractは保護者限定。原画像の家庭・子ども権限を検証してWorkerがバイト列を取得。任意URL、クライアント指定の公開画像URL、未認証メディアを受け付けない。サイズ/形式上限、処理数制限、hash＋provider_versionの冪等性を設ける。
- AI提供元・モデル・料金枠・データ送信許可は未決定。Cloudflare Workers AIを候補として調査したがbinding追加・有効化なし。文書画像の日本語精度を架空の時間割で評価して選ぶ。
- 出力は日付ごとの宿題/持ち物/下校時刻、不明null、注意点。画像内の指示はデータ扱い。構造・日付・件数・文字数をサーバーで再検証。画像/氏名をログに出さない。AI出力から通知・ポイントを直接起動しない。
- extraction_draftsへ未確定として保持→保護者が原画像と並べて編集→confirmで確定版追記。新しい確定版へ古い完了チェックを自動コピーしない。旧版・履歴を残す。再確認を減らす引継ぎ方は別途合意。

## 通知・ポイント・Cron（適用なし）

- 現行HOME notifications.tsの公開proxyはsubscribe/unsubscribe/vapid-public-keyだけ。送信APIとして流用しない。notification-center-apiの現在の送信認証・HOME対象者検証を確認して専用の内部アダプターを作る。
- guardian指定・報告タイミング・1日何回・完了取消時の扱いは未決定。既存購読/rules/通知設定は変更しない。新規outboxはdraftのみ、consumerなし。架空環境の試験以外で送信しない。
- ポイント連携先（独立「いいこと」または通帳のどのunitか）、30登校日の定義/欠席/休校/ランク条件/金額は確認待ち。設定なしでは付与禁止。
- 将来の確定済み報酬キー例: school-prep/{household}/{child}/{cycle-id}/{policy-version}。対象台帳への加算と重複キー確保は同一DBトランザクションで行う。outboxにsentを書くだけの二重付与防止は不可。訂正は台帳へ打消し行を追加し履歴を消さない。
- 学校準備・英語フラッシュに新しいCronは今の段階では不要。日次出題は本人アクセスでJST日付に作る。定時報告が必要なら、既存Cronを置換せず追加案を再検討。PR #4の金融Cron案は別PRに維持。

## 英語音声・教材

- 自作教材は大文字/小文字26組＋基礎単語30語。第三者辞書・音源の転載なし。毎日の件数は保護者が明示設定。姉妹を名前/年齢でハードコードしない。
- Web Speech APIのgetVoicesからlang=en-USを選び、押したときだけ再生。音声リスト遅延、音声未導入、ミュート等の実機確認は未実施。米国音声がないとき別地域の音声へ黙って置換しない。
- アルファベットは文字名の復習。フォニックス教材ではない。OSの読み上げ品質、利用可能音声、通信/オフライン動作は端末依存。将来音源固定が必要なら権利確認した別方式を提案する。
- catalog_versionを日次セットに保存。教材更新で過去IDを消さず、旧版を再表示できるよう維持する。学年設定は既存の漢字プロフィールを変更しない。

参考（2026-10-15確認）：[Web Speech仕様](https://webaudio.github.io/web-speech-api/#tts-section)、[MDN getVoices](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis/getVoices)、[Workers AI API](https://developers.cloudflare.com/api/resources/ai/)。提供元選定や本番利用承認を意味しない。
