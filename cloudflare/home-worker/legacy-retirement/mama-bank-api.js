export default {

  async fetch(request, env) {

    const origin = request.headers.get("Origin");



    const allowedOrigins = [

      "https://cetus.fun",

      "https://sizuku-slowdays.github.io",

    ];



    const cors = {

      "Access-Control-Allow-Origin": allowedOrigins.includes(origin)

        ? origin

        : "https://cetus.fun",

      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",

      "Access-Control-Allow-Headers": "Content-Type, X-App-Password",

    };



    if (request.method === "OPTIONS") {

      return new Response(null, { headers: cors });

    }



    const url = new URL(request.url);

    // HOME通帳への切替後は、旧銀行だけを停止する。家計簿などは従来どおり。
    const retired = env.HOME_PASSBOOK_MIGRATED === "1";
    if (url.pathname === "/api/home-passbook-status" && request.method === "GET") {
      return Response.json({version:1,service:"bank",retired,home:"https://home-worker.sslowdayss.workers.dev"},{headers:{...cors,"Cache-Control":"no-store"}});
    }
    if (retired) {
      const bankKeys = new Set(["mama-bank","mama-bank-view"]);
      let key = url.searchParams.get("key") || url.searchParams.get("app") || url.pathname.split("/").filter(Boolean)[2] || "";
      try { key = decodeURIComponent(key).trim(); } catch { return Response.json({error:"URLを確認してください"},{status:400,headers:cors}); }
      let posted = {};
      if (["POST","PUT"].includes(request.method) && url.pathname.startsWith("/api/app-data")) {
        try { posted = await request.clone().json(); } catch {}
      }
      const app = key || posted.key || posted.app || "";
      if (url.pathname === "/api/balance" ||
          (/^\/api\/app-data(?:-public)?(?:\/|$)/.test(url.pathname) &&
           (bankKeys.has(typeof app === "string" ? app.trim() : "") ||
            (request.method === "DELETE" && bankKeys.has(url.searchParams.get("app")))))) {
        return Response.json({error:"銀行は新しいつうちょうへ移行しました。HOMEから開いてください。",home:"https://home-worker.sslowdayss.workers.dev/",migrated:true},{status:410,headers:{...cors,"Cache-Control":"no-store"}});
      }
    }




    // =====================================================

    // 共通

    // =====================================================

    function requirePassword() {

      const password = request.headers.get("X-App-Password");

      return !!env.APP_PASSWORD && password === env.APP_PASSWORD;

    }



    function json(data, status = 200) {

      return Response.json(data, { status, headers: cors });

    }



    // =====================================================

    // 汎用app-data

    // app_dataテーブル：

    // app / data_key / data_json / updated_at

    // =====================================================



    function getMamaBankKey() {

      let key = url.searchParams.get("key") || url.searchParams.get("app");



      if (!key) {

        const parts = url.pathname.split("/").filter(Boolean);

        if (parts.length >= 3) key = parts[2];

      }



      return key ? decodeURIComponent(key).trim() : "";

    }



    async function readMamaBankAppData(appName) {

      const row = await env.DB.prepare(

        "SELECT data_json, updated_at FROM app_data WHERE app = ? AND data_key = ?"

      )

        .bind(appName, "main")

        .first();



      if (!row) return null;



      let parsed = {};

      try {

        parsed = JSON.parse(row.data_json);

      } catch (e) {

        parsed = {};

      }



      return {

        key: appName,

        app: appName,

        data: parsed,

        updated_at: row.updated_at,

      };

    }



    async function saveMamaBankAppData(appName, data) {

      // 上書き前の内容を履歴へ退避

      await env.DB.prepare(`

        CREATE TABLE IF NOT EXISTS app_data_history (

          id INTEGER PRIMARY KEY AUTOINCREMENT,

          app TEXT NOT NULL,

          data_key TEXT NOT NULL,

          data_json TEXT NOT NULL,

          original_updated_at TEXT,

          archived_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP

        )

      `).run();



      await env.DB.prepare(`

        INSERT INTO app_data_history

          (app, data_key, data_json, original_updated_at, archived_at)

        SELECT app, data_key, data_json, updated_at, CURRENT_TIMESTAMP

        FROM app_data

        WHERE app = ? AND data_key = ?

      `)

        .bind(appName, "main")

        .run();



      await env.DB.prepare(`

        INSERT INTO app_data (app, data_key, data_json, updated_at)

        VALUES (?, ?, ?, CURRENT_TIMESTAMP)

        ON CONFLICT(app, data_key) DO UPDATE SET

          data_json = excluded.data_json,

          updated_at = CURRENT_TIMESTAMP

      `)

        .bind(appName, "main", JSON.stringify(data ?? {}))

        .run();



      // アプリごとに直近100世代を保存

      await env.DB.prepare(`

        DELETE FROM app_data_history

        WHERE app = ? AND data_key = ? AND id NOT IN (

          SELECT id

          FROM app_data_history

          WHERE app = ? AND data_key = ?

          ORDER BY id DESC

          LIMIT 100

        )

      `)

        .bind(appName, "main", appName, "main")

        .run();



      return {

        ok: true,

        key: appName,

        app: appName,

        data_key: "main",

      };

    }



    // =====================================================

    // 公開読み込み

    // GET /api/app-data-public?key=mama-bank-view

    // GET /api/app-data-public/mama-bank-view

    // =====================================================

    if (

      request.method === "GET" &&

      (url.pathname === "/api/app-data-public" ||

        url.pathname.startsWith("/api/app-data-public/"))

    ) {

      const appName = getMamaBankKey();



      if (!appName) {

        return json({ error: "key が必要です。" }, 400);

      }



      const data = await readMamaBankAppData(appName);



      if (!data) {

        return json(

          {

            error: "データがありません。",

            key: appName,

          },

          404

        );

      }



      return json(data);

    }



    // =====================================================

    // app-data保存

    // POST /api/app-data

    // PUT  /api/app-data/アプリ名

    // =====================================================

    if (

      (request.method === "POST" || request.method === "PUT") &&

      (url.pathname === "/api/app-data" ||

        url.pathname.startsWith("/api/app-data/"))

    ) {

      if (!requirePassword()) {

        return json({ error: "認証が必要です。" }, 401);

      }



      let body = {};



      try {

        body = await request.json();

      } catch (e) {

        return json(

          {

            error: "JSONの形式が正しくありません。",

          },

          400

        );

      }



      const urlKey = getMamaBankKey();

      const appName = (urlKey || body.key || body.app || "").trim();



      if (!appName) {

        return json(

          {

            error: "key または app が必要です。",

          },

          400

        );

      }



      const data = body.data ?? body;

      const result = await saveMamaBankAppData(appName, data);



      return json(result);

    }



    // =====================================================

    // app-data読み込み

    // GET /api/app-data?key=kakeibo-app

    // GET /api/app-data/kakeibo-app

    // =====================================================

    if (

      request.method === "GET" &&

      (url.pathname === "/api/app-data" ||

        url.pathname.startsWith("/api/app-data/"))

    ) {

      if (!requirePassword()) {

        return json({ error: "認証が必要です。" }, 401);

      }



      const app = url.searchParams.get("app");

      const key = url.searchParams.get("key");



      // 学校チェック形式

      if (app && key && !key.startsWith("mama-bank")) {

        const row = await env.DB.prepare(

          "SELECT data_json, updated_at FROM app_data WHERE app = ? AND data_key = ?"

        )

          .bind(app, key)

          .first();



        if (!row) {

          return json({ error: "Not found" }, 404);

        }



        let parsed = {};



        try {

          parsed = JSON.parse(row.data_json);

        } catch (e) {

          parsed = {};

        }



        return json({

          app,

          key,

          data: parsed,

          updated_at: row.updated_at,

        });

      }



      const appName = getMamaBankKey();



      if (!appName) {

        return json({ error: "key が必要です。" }, 400);

      }



      const data = await readMamaBankAppData(appName);



      if (!data) {

        return json(

          {

            error: "データがありません。",

            key: appName,

          },

          404

        );

      }



      return json(data);

    }



    // =====================================================

    // 学校チェック報告保存

    // POST /api/school-report

    // =====================================================

    if (

      request.method === "POST" &&

      url.pathname === "/api/school-report"

    ) {

      const data = await request.json();



      await env.DB.prepare(`

        INSERT INTO school_reports (

          child,

          tab,

          completed,

          total,

          unchecked,

          message,

          created_at

        )

        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)

      `)

        .bind(

          data.child,

          data.tab,

          data.completed,

          data.total,

          JSON.stringify(data.unchecked || []),

          data.message || ""

        )

        .run();



      return json({

        ok: true,

      });

    }



    // =====================================================

    // 学校チェック報告取得

    // GET /api/school-report

    // =====================================================

    if (

      request.method === "GET" &&

      url.pathname === "/api/school-report"

    ) {

      const result = await env.DB.prepare(`

        SELECT *

        FROM school_reports

        ORDER BY id DESC

        LIMIT 100

      `).all();



      return json({

        ok: true,

        reports: result.results || [],

      });

    }



    // =====================================================

    // 日記APIのパスワード認証

    // =====================================================

    if (url.pathname.startsWith("/api/diary")) {

      if (!requirePassword()) {

        return json({ error: "認証が必要です。" }, 401);

      }

    }



    // =====================================================

    // ママ銀行残高取得

    // GET /api/balance?account=usagi

    // =====================================================

    if (

      request.method === "GET" &&

      url.pathname === "/api/balance"

    ) {

      const account = url.searchParams.get("account");



      const row = await env.DB.prepare(

        "SELECT amount FROM balances WHERE account = ?"

      )

        .bind(account)

        .first();



      return json({

        account,

        amount: row?.amount ?? 0,

      });

    }



    // =====================================================

    // ママ銀行残高更新

    // POST /api/balance

    // =====================================================

    if (

      request.method === "POST" &&

      url.pathname === "/api/balance"

    ) {

      if (!requirePassword()) {

        return json({ error: "認証が必要です。" }, 401);

      }



      const { account, amount } = await request.json();



      await env.DB.prepare(

        "INSERT INTO balances (account, amount) VALUES (?, ?) " +

          "ON CONFLICT(account) DO UPDATE SET amount = ?"

      )

        .bind(account, amount, amount)

        .run();



      return json({

        ok: true,

      });

    }



    // =====================================================

    // 日記一覧取得

    // GET /api/diary

    // =====================================================

    if (

      request.method === "GET" &&

      url.pathname === "/api/diary"

    ) {

      const result = await env.DB.prepare(

        "SELECT id, title, body, created_at FROM diary_entries ORDER BY id DESC"

      ).all();



      return json({

        entries: result.results || [],

      });

    }



    // =====================================================

    // 日記保存

    // POST /api/diary

    // =====================================================

    if (

      request.method === "POST" &&

      url.pathname === "/api/diary"

    ) {

      const { title, body } = await request.json();



      if (!title || !body) {

        return json(

          {

            error: "タイトルと本文が必要です。",

          },

          400

        );

      }



      await env.DB.prepare(

        "INSERT INTO diary_entries (title, body) VALUES (?, ?)"

      )

        .bind(title, body)

        .run();



      return json({

        ok: true,

      });

    }



    // =====================================================

    // 日記削除

    // DELETE /api/diary

    // =====================================================

    if (

      request.method === "DELETE" &&

      url.pathname === "/api/diary"

    ) {

      const { id } = await request.json();



      if (!id) {

        return json(

          {

            error: "削除するIDが必要です。",

          },

          400

        );

      }



      await env.DB.prepare(

        "DELETE FROM diary_entries WHERE id = ?"

      )

        .bind(id)

        .run();



      return json({

        ok: true,

      });

    }



    // =====================================================

    // ビンゴ：アクティブルーム取得

    // GET /api/bingo/active

    // =====================================================

    if (

      request.method === "GET" &&

      url.pathname === "/api/bingo/active"

    ) {

      const row = await env.DB.prepare(

        "SELECT room_id FROM bingo_active ORDER BY id DESC LIMIT 1"

      ).first();



      return json({

        room_id: row?.room_id || null,

      });

    }



    // =====================================================

    // ビンゴ：アクティブルーム登録

    // POST /api/bingo/active

    // =====================================================

    if (

      request.method === "POST" &&

      url.pathname === "/api/bingo/active"

    ) {

      let body = {};



      try {

        body = await request.json();

      } catch (e) {

        body = {};

      }



      const roomId = (body.room_id || "")

        .trim()

        .toUpperCase();



      if (!roomId) {

        return json(

          {

            error: "room_id が必要です。",

          },

          400

        );

      }



      await env.DB.prepare(`

        INSERT INTO bingo_active (room_id, created_at)

        VALUES (?, datetime('now'))

      `)

        .bind(roomId)

        .run();



      return json({

        ok: true,

        room_id: roomId,

      });

    }



    // =====================================================

    // ビンゴ：アクティブルーム削除

    // DELETE /api/bingo/active

    // =====================================================

    if (

      request.method === "DELETE" &&

      url.pathname === "/api/bingo/active"

    ) {

      await env.DB.prepare(

        "DELETE FROM bingo_active"

      ).run();



      return json({

        ok: true,

      });

    }



    // =====================================================

    // ビンゴ：ルーム作成

    // POST /api/bingo/room

    // =====================================================

    if (

      request.method === "POST" &&

      url.pathname === "/api/bingo/room"

    ) {

      let body = {};



      try {

        body = await request.json();

      } catch (e) {

        body = {};

      }



      const roomId = (body.room_id || "")

        .trim()

        .toUpperCase();



      if (!roomId) {

        return json(

          {

            error: "room_id が必要です。",

          },

          400

        );

      }



      await env.DB.prepare(`

        INSERT INTO bingo_rooms (

          room_id,

          numbers,

          created_at,

          updated_at

        )

        VALUES (

          ?,

          '[]',

          datetime('now'),

          datetime('now')

        )

        ON CONFLICT(room_id) DO UPDATE SET

          numbers = '[]',

          updated_at = datetime('now')

      `)

        .bind(roomId)

        .run();



      return json({

        ok: true,

        room_id: roomId,

      });

    }



    // =====================================================

    // ビンゴ：ルーム取得

    // GET /api/bingo/room/:roomId

    // =====================================================

    if (

      request.method === "GET" &&

      url.pathname.startsWith("/api/bingo/room/")

    ) {

      const roomId = url.pathname

        .split("/")[4]

        ?.toUpperCase();



      if (!roomId) {

        return json(

          {

            error: "room_id が必要です。",

          },

          400

        );

      }



      const row = await env.DB.prepare(

        "SELECT numbers, updated_at FROM bingo_rooms WHERE room_id = ?"

      )

        .bind(roomId)

        .first();



      if (!row) {

        return json(

          {

            error: "ルームが見つかりません。",

          },

          404

        );

      }



      return json({

        ok: true,

        room_id: roomId,

        numbers: JSON.parse(row.numbers || "[]"),

        updated_at: row.updated_at,

      });

    }



    // =====================================================

    // ビンゴ：番号追加

    // POST /api/bingo/room/:roomId/number

    // =====================================================

    if (

      request.method === "POST" &&

      url.pathname.match(

        /^\/api\/bingo\/room\/[^/]+\/number$/

      )

    ) {

      const parts = url.pathname.split("/");

      const roomId = parts[4]?.toUpperCase();



      let body = {};



      try {

        body = await request.json();

      } catch (e) {

        body = {};

      }



      const number = parseInt(body.number, 10);



      if (

        !roomId ||

        Number.isNaN(number) ||

        number < 1 ||

        number > 75

      ) {

        return json(

          {

            error:

              "room_id と 1〜75 の number が必要です。",

          },

          400

        );

      }



      const row = await env.DB.prepare(

        "SELECT numbers FROM bingo_rooms WHERE room_id = ?"

      )

        .bind(roomId)

        .first();



      if (!row) {

        return json(

          {

            error: "ルームが見つかりません。",

          },

          404

        );

      }



      const numbers = JSON.parse(row.numbers || "[]");



      if (!numbers.includes(number)) {

        numbers.push(number);



        await env.DB.prepare(`

          UPDATE bingo_rooms

          SET

            numbers = ?,

            updated_at = datetime('now')

          WHERE room_id = ?

        `)

          .bind(

            JSON.stringify(numbers),

            roomId

          )

          .run();

      }



      return json({

        ok: true,

        room_id: roomId,

        numbers,

      });

    }



    // =====================================================

    // ビンゴ：古いルームを削除

    // DELETE /api/bingo/cleanup

    // =====================================================

    if (

      request.method === "DELETE" &&

      url.pathname === "/api/bingo/cleanup"

    ) {

      await env.DB.prepare(`

        DELETE FROM bingo_rooms

        WHERE updated_at < datetime('now', '-24 hours')

      `).run();



      return json({

        ok: true,

      });

    }



    // =====================================================

    // 汎用app-data削除

    // DELETE /api/app-data?app=school-check&key=...

    // =====================================================

    if (

      request.method === "DELETE" &&

      url.pathname === "/api/app-data"

    ) {

      if (!requirePassword()) {

        return json({ error: "認証が必要です。" }, 401);

      }



      const app = url.searchParams.get("app");

      const key = url.searchParams.get("key");



      if (!app || !key) {

        return json(

          {

            error: "app と key が必要です。",

          },

          400

        );

      }



      await env.DB.prepare(

        "DELETE FROM app_data WHERE app = ? AND data_key = ?"

      )

        .bind(app, key)

        .run();



      return json({

        ok: true,

        deleted: true,

        app,

        key,

      });

    }



    return json(

      {

        error: "Not found",

      },

      404

    );

  },

};