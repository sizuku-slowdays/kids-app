/**

 * おてつだい当番・ポイント API

 * Cloudflare Worker + D1

 *

 * Bindings (wrangler.toml):

 *   [[d1_databases]]

 *   binding = "DB"

 *   database_name = "otetsuday"

 *   database_id   = "<your-d1-id>"

 *

 * 環境変数:

 *   APP_PASSWORD = "your-secret"   (ママ用操作に必要)

 */



const CORS_HEADERS = {

  'Access-Control-Allow-Origin': '*',

  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',

  'Access-Control-Allow-Headers': 'Content-Type, X-App-Password',

};



function json(data, status = 200) {

  return new Response(JSON.stringify(data), {

    status,

    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },

  });

}



function err(msg, status = 400) {

  return json({ error: msg }, status);

}



function authCheck(request, env) {

  const pw = request.headers.get('X-App-Password');

  return pw === env.APP_PASSWORD;

}



// ローテーション: 現在の担当者の次を返す

function nextInRotation(current, rotationOrder) {

  const arr = rotationOrder.split(',');

  const idx = arr.indexOf(current);

  if (idx === -1) return arr[0];

  return arr[(idx + 1) % arr.length];

}



export default {

  async fetch(request, env) {

    if (request.method === 'OPTIONS') {

      return new Response(null, { headers: CORS_HEADERS });

    }



    const url = new URL(request.url);

    const path = url.pathname;

    const method = request.method;

    const retired = env.HOME_PASSBOOK_MIGRATED === '1';
    if (path === '/api/home-passbook-status' && method === 'GET') {
      return new Response(JSON.stringify({version:1,service:'chores',retired,home:'https://home-worker.sslowdayss.workers.dev'}),{headers:{'Content-Type':'application/json',...CORS_HEADERS,'Cache-Control':'no-store'}});
    }
    if (retired && (path === '/api' || path.startsWith('/api/'))) {
      return new Response(JSON.stringify({error:'ポイントは新しいつうちょうへ移行しました。HOMEから開いてください。',home:'https://home-worker.sslowdayss.workers.dev/',migrated:true}),{status:410,headers:{'Content-Type':'application/json',...CORS_HEADERS,'Cache-Control':'no-store'}});
    }




    try {

      // ──────────────────────────────

      // GET /api/members

      // ──────────────────────────────

      if (path === '/api/members' && method === 'GET') {

        const { results } = await env.DB.prepare(

          'SELECT * FROM family_members ORDER BY sort_order'

        ).all();

        return json(results);

      }



      // ──────────────────────────────

      // GET /api/chores/today

      // ──────────────────────────────

      if (path === '/api/chores/today' && method === 'GET') {

        const { results: chores } = await env.DB.prepare(

          'SELECT * FROM chores WHERE enabled=1 ORDER BY sort_order'

        ).all();



        const out = [];

        for (const c of chores) {

          const state = await env.DB.prepare(

            'SELECT * FROM chore_state WHERE chore_id=?'

          ).bind(c.id).first();

          const isNoRotation = state?.rotation_order === 'none';

          const member = (!isNoRotation && state)

            ? await env.DB.prepare('SELECT * FROM family_members WHERE id=?').bind(state.next_assignee).first()

            : null;

          out.push({ ...c, next_assignee: state?.next_assignee ?? null, assignee: member, no_rotation: isNoRotation });

        }

        return json(out);

      }



      // ──────────────────────────────

      // POST /api/chores/complete

      // 認証必須

      // ──────────────────────────────

      if (path === '/api/chores/complete' && method === 'POST') {

        if (!authCheck(request, env)) return err('Unauthorized', 401);



        const body = await request.json();

        const { chore_id, completed_by, completed_date } = body;

        if (!chore_id || !completed_by || !completed_date) {

          return err('chore_id, completed_by, completed_date は必須です');

        }



        const chore = await env.DB.prepare('SELECT * FROM chores WHERE id=?').bind(chore_id).first();

        if (!chore) return err('おてつだいが見つかりません');



        const state = await env.DB.prepare(

          'SELECT * FROM chore_state WHERE chore_id=?'

        ).bind(chore_id).first();

        if (!state) return err('ローテーション情報が見つかりません');



        const isNoRotation = state.rotation_order === 'none';

        const assigned_to = isNoRotation ? 'none' : state.next_assignee;



        // ログ保存

        await env.DB.prepare(`

          INSERT INTO chore_logs

            (chore_id, chore_name, assigned_to, completed_by, points, money, completed_date, bank_synced)

          VALUES (?, ?, ?, ?, ?, ?, ?, 0)

        `).bind(

          chore_id, chore.name, assigned_to, completed_by,

          chore.points, chore.money, completed_date

        ).run();



        // ローテーションなしの場合は next_assignee を更新しない

        let next = 'none';

        if (!isNoRotation) {

          next = nextInRotation(assigned_to, state.rotation_order);

          await env.DB.prepare(

            'UPDATE chore_state SET next_assignee=? WHERE chore_id=?'

          ).bind(next, chore_id).run();

        }



        return json({

          ok: true,

          log: { chore_id, assigned_to, completed_by, points: chore.points, money: chore.money },

          next_assignee: next,

        });

      }



      // ──────────────────────────────

      // GET /api/chores/logs?month=YYYY-MM[&member=id]

      // ──────────────────────────────

      if (path === '/api/chores/logs' && method === 'GET') {

        const month = url.searchParams.get('month');

        const member = url.searchParams.get('member');

        if (!month) return err('month パラメータが必要です');



        let q = 'SELECT * FROM chore_logs WHERE completed_date LIKE ? ';

        const params = [`${month}%`];

        if (member) { q += 'AND completed_by=? '; params.push(member); }

        q += 'ORDER BY completed_date DESC, created_at DESC';



        const { results } = await env.DB.prepare(q).bind(...params).all();

        return json(results);

      }



      // ──────────────────────────────

      // GET /api/chores/summary?month=YYYY-MM

      // ──────────────────────────────

      if (path === '/api/chores/summary' && method === 'GET') {

        const month = url.searchParams.get('month');

        if (!month) return err('month パラメータが必要です');



        const { results } = await env.DB.prepare(`

          SELECT

            completed_by,

            COUNT(*) AS count,

            SUM(points) AS total_points,

            SUM(money) AS total_money

          FROM chore_logs

          WHERE completed_date LIKE ?

          GROUP BY completed_by

        `).bind(`${month}%`).all();



        // メンバー情報をマージ

        const members = {};

        const { results: mems } = await env.DB.prepare('SELECT * FROM family_members').all();

        for (const m of mems) members[m.id] = m;



        const out = results.map(r => ({

          ...r,

          member: members[r.completed_by] ?? { id: r.completed_by, name: r.completed_by, icon: '❓' },

        }));

        return json(out);

      }



      // ──────────────────────────────

      // GET /api/points/member/:id

      // ──────────────────────────────

      const pointsMatch = path.match(/^\/api\/points\/member\/([^/]+)$/);

      if (pointsMatch && method === 'GET') {

        const memberId = pointsMatch[1];

        const month = url.searchParams.get('month'); // optional



        const totalRow = await env.DB.prepare(`

          SELECT COALESCE(SUM(points),0) AS total FROM chore_logs WHERE completed_by=?

        `).bind(memberId).first();



        let monthRow = null;

        if (month) {

          monthRow = await env.DB.prepare(`

            SELECT COALESCE(SUM(points),0) AS month_total FROM chore_logs

            WHERE completed_by=? AND completed_date LIKE ?

          `).bind(memberId, `${month}%`).first();

        }



        const { results: recent } = await env.DB.prepare(`

          SELECT * FROM chore_logs WHERE completed_by=? ORDER BY completed_date DESC, created_at DESC LIMIT 20

        `).bind(memberId).all();



        // 使用ポイント（承認済みご褒美）

        const usedRow = await env.DB.prepare(`

          SELECT COALESCE(SUM(points_cost),0) AS used FROM reward_requests

          WHERE member_id=? AND status='approved'

        `).bind(memberId).first();



        return json({

          member_id: memberId,

          total_points: totalRow?.total ?? 0,

          used_points: usedRow?.used ?? 0,

          balance: (totalRow?.total ?? 0) - (usedRow?.used ?? 0),

          month_points: monthRow?.month_total ?? null,

          recent_logs: recent,

        });

      }



      // ──────────────────────────────

      // GET /api/rewards

      // ──────────────────────────────

      if (path === '/api/rewards' && method === 'GET') {

        const { results } = await env.DB.prepare(

          'SELECT * FROM rewards WHERE enabled=1 ORDER BY points'

        ).all();

        return json(results);

      }



      // ──────────────────────────────

      // POST /api/rewards/request（申請 → pending保存）

      // ──────────────────────────────

      if (path === '/api/rewards/request' && method === 'POST') {

        const body = await request.json();

        const { member_id, reward_id } = body;

        if (!member_id || !reward_id) return err('member_id, reward_id は必須です');



        const reward = await env.DB.prepare('SELECT * FROM rewards WHERE id=?').bind(reward_id).first();

        if (!reward) return err('ごほうびが見つかりません');



        // 在庫チェック

        if (reward.stock !== null && reward.stock !== undefined && reward.stock <= 0) {

          return err('在庫がありません');

        }



        // 同じごほうびのpending申請が既にあるか確認

        const existing = await env.DB.prepare(

          "SELECT id FROM reward_requests WHERE member_id=? AND reward_id=? AND status='pending'"

        ).bind(member_id, reward_id).first();

        if (existing) return err('すでにしんせいちゅうです');



        await env.DB.prepare(`

          INSERT INTO reward_requests (member_id, reward_id, reward_name, points_cost, status)

          VALUES (?, ?, ?, ?, 'pending')

        `).bind(member_id, reward_id, reward.name, reward.points).run();



        return json({ ok: true, message: `「${reward.name}」をしんせいしたよ！ママにおねがいしてね` });

      }



      // ──────────────────────────────

      // GET /api/rewards/requests（ママ用・要認証）

      // ──────────────────────────────

      if (path === '/api/rewards/requests' && method === 'GET') {

        if (!authCheck(request, env)) return err('Unauthorized', 401);

        const { results } = await env.DB.prepare(

          "SELECT * FROM reward_requests ORDER BY requested_at DESC"

        ).all();

        return json(results);

      }



      // GET /api/rewards/member-pending?member_id=xxx（申請中ごほうび）

      if (path === '/api/rewards/member-pending' && method === 'GET') {

        const member_id = url.searchParams.get('member_id');

        if (!member_id) return err('member_id が必要です');

        const { results } = await env.DB.prepare(

          "SELECT reward_id, points_cost FROM reward_requests WHERE member_id=? AND status='pending'"

        ).bind(member_id).all();

        const pending_points = results.reduce((s, r) => s + r.points_cost, 0);

        const reward_ids = results.map(r => r.reward_id);

        return json({ pending_points, reward_ids });

      }



      // GET /api/rewards/pending-count（バナー用・件数のみ）

      if (path === '/api/rewards/pending-count' && method === 'GET') {

        if (!authCheck(request, env)) return err('Unauthorized', 401);

        const row = await env.DB.prepare(

          "SELECT COUNT(*) as cnt FROM reward_requests WHERE status='pending'"

        ).first();

        return json({ count: row?.cnt ?? 0 });

      }



      // ──────────────────────────────

      // POST /api/rewards/resolve（承認/却下・要認証）

      // body: { id, status: 'approved'|'rejected' }

      // ──────────────────────────────

      if (path === '/api/rewards/resolve' && method === 'POST') {

        if (!authCheck(request, env)) return err('Unauthorized', 401);

        const body = await request.json();

        const { id, status } = body;

        if (!id || !['approved','rejected'].includes(status)) {

          return err('id と status(approved/rejected) が必要です');

        }



        // 承認の場合は在庫を減らす

        if (status === 'approved') {

          const req = await env.DB.prepare('SELECT * FROM reward_requests WHERE id=?').bind(id).first();

          if (req) {

            const reward = await env.DB.prepare('SELECT * FROM rewards WHERE id=?').bind(req.reward_id).first();

            if (reward && reward.stock !== null && reward.stock !== undefined) {

              if (reward.stock <= 0) return err('在庫がありません');

              await env.DB.prepare('UPDATE rewards SET stock=stock-1 WHERE id=?').bind(req.reward_id).run();

            }

          }

        }



        const now = new Date().toISOString();

        await env.DB.prepare(

          'UPDATE reward_requests SET status=?, resolved_at=? WHERE id=?'

        ).bind(status, now, id).run();

        return json({ ok: true });

      }



      // ──────────────────────────────

      // GET /api/chores/state   (ローテーション確認)

      // ──────────────────────────────

      if (path === '/api/chores/state' && method === 'GET') {

        const { results } = await env.DB.prepare('SELECT * FROM chore_state').all();

        return json(results);

      }



      // ──────────────────────────────

      // PUT /api/chores/state/:chore_id  (要認証・担当者手動変更)

      // ──────────────────────────────

      const stateMatch = path.match(/^\/api\/chores\/state\/([^/]+)$/);

      if (stateMatch && method === 'PUT') {

        if (!authCheck(request, env)) return err('Unauthorized', 401);

        const body = await request.json();

        const { next_assignee, rotation_order } = body;

        const chore_id = stateMatch[1];

        if (next_assignee) {

          await env.DB.prepare('UPDATE chore_state SET next_assignee=? WHERE chore_id=?')

            .bind(next_assignee, chore_id).run();

        }

        if (rotation_order) {

          await env.DB.prepare('UPDATE chore_state SET rotation_order=? WHERE chore_id=?')

            .bind(rotation_order, chore_id).run();

        }

        return json({ ok: true });

      }



      // ──────────────────────────────

      // 設定系 (要認証)

      // ──────────────────────────────



      // GET /api/settings/chores

      if (path === '/api/settings/chores' && method === 'GET') {

        if (!authCheck(request, env)) return err('Unauthorized', 401);

        const { results } = await env.DB.prepare('SELECT * FROM chores ORDER BY sort_order').all();

        return json(results);

      }



      // POST /api/settings/chores（作業追加）

      if (path === '/api/settings/chores' && method === 'POST') {

        if (!authCheck(request, env)) return err('Unauthorized', 401);

        const body = await request.json();

        const { id, name, icon, points, money, no_rotation } = body;

        if (!id || !name) return err('id と name は必須です');



        const maxRow = await env.DB.prepare('SELECT MAX(sort_order) as max FROM chores').first();

        const sort_order = (maxRow?.max ?? 0) + 1;



        await env.DB.prepare(

          'INSERT INTO chores (id, name, icon, points, money, enabled, sort_order) VALUES (?, ?, ?, ?, ?, 1, ?)'

        ).bind(id, name, icon || '📋', points || 0, money || 0, sort_order).run();



        // ローテーションなし → rotation_order='none', next_assignee='none'

        const rotation_order = no_rotation ? 'none' : 'mama,ane,imouto';

        const next_assignee = no_rotation ? 'none' : 'mama';

        await env.DB.prepare(

          'INSERT INTO chore_state (chore_id, next_assignee, rotation_order) VALUES (?, ?, ?)'

        ).bind(id, next_assignee, rotation_order).run();



        return json({ ok: true });

      }



      // PUT /api/settings/chores/:id

      const choreEditMatch = path.match(/^\/api\/settings\/chores\/([^/]+)$/);

      if (choreEditMatch && method === 'PUT') {

        if (!authCheck(request, env)) return err('Unauthorized', 401);

        const body = await request.json();

        const { name, icon, points, money, enabled } = body;

        await env.DB.prepare(

          'UPDATE chores SET name=?, icon=?, points=?, money=?, enabled=? WHERE id=?'

        ).bind(name, icon, points, money, enabled ? 1 : 0, choreEditMatch[1]).run();

        return json({ ok: true });

      }



      // GET /api/settings/rewards

      if (path === '/api/settings/rewards' && method === 'GET') {

        if (!authCheck(request, env)) return err('Unauthorized', 401);

        const { results } = await env.DB.prepare('SELECT * FROM rewards ORDER BY points').all();

        return json(results);

      }



      // POST /api/settings/rewards

      if (path === '/api/settings/rewards' && method === 'POST') {

        if (!authCheck(request, env)) return err('Unauthorized', 401);

        const body = await request.json();

        const { name, points, image_url, stock } = body;

        await env.DB.prepare('INSERT INTO rewards (name, points, image_url, stock) VALUES (?, ?, ?, ?)')

          .bind(name, points, image_url || null, stock ?? null).run();

        return json({ ok: true });

      }



      // PUT /api/settings/rewards/:id

      const rewardEditMatch = path.match(/^\/api\/settings\/rewards\/(\d+)$/);

      if (rewardEditMatch && method === 'PUT') {

        if (!authCheck(request, env)) return err('Unauthorized', 401);

        const body = await request.json();

        const { name, points, enabled, image_url, stock } = body;

        await env.DB.prepare('UPDATE rewards SET name=?, points=?, enabled=?, image_url=?, stock=? WHERE id=?')

          .bind(name, points, enabled ? 1 : 0, image_url || null, stock ?? null, parseInt(rewardEditMatch[1])).run();

        return json({ ok: true });

      }



      // DELETE /api/settings/chores/:id

      const choreDeleteMatch = path.match(/^\/api\/settings\/chores\/([^/]+)$/);

      if (choreDeleteMatch && method === 'DELETE') {

        if (!authCheck(request, env)) return err('Unauthorized', 401);

        const id = choreDeleteMatch[1];

        await env.DB.prepare('DELETE FROM chores WHERE id=?').bind(id).run();

        await env.DB.prepare('DELETE FROM chore_state WHERE chore_id=?').bind(id).run();

        return json({ ok: true });

      }



      // DELETE /api/settings/rewards/:id

      const rewardDeleteMatch = path.match(/^\/api\/settings\/rewards\/(\d+)$/);

      if (rewardDeleteMatch && method === 'DELETE') {

        if (!authCheck(request, env)) return err('Unauthorized', 401);

        await env.DB.prepare('DELETE FROM rewards WHERE id=?').bind(parseInt(rewardDeleteMatch[1])).run();

        return json({ ok: true });

      }

      // ──────────────────────────────

      if (path === '/api/bank/pending' && method === 'GET') {

        if (!authCheck(request, env)) return err('Unauthorized', 401);

        const { results } = await env.DB.prepare(

          "SELECT * FROM chore_logs WHERE bank_synced=0 AND money>0 ORDER BY completed_date"

        ).all();

        return json(results);

      }



      // POST /api/bank/sync  body: { ids: [1,2,3] }

      if (path === '/api/bank/sync' && method === 'POST') {

        if (!authCheck(request, env)) return err('Unauthorized', 401);

        const body = await request.json();

        const { ids } = body;

        if (!Array.isArray(ids) || ids.length === 0) return err('ids が必要です');

        const placeholders = ids.map(() => '?').join(',');

        await env.DB.prepare(

          `UPDATE chore_logs SET bank_synced=1 WHERE id IN (${placeholders})`

        ).bind(...ids).run();

        return json({ ok: true, synced: ids.length });

      }



      return err('Not Found', 404);

    } catch (e) {

      console.error(e);

      return err('サーバーエラー: ' + e.message, 500);

    }

  },



  // ──────────────────────────────

  // Cron Trigger: 毎日深夜0時（JST）に未完了当番をローテーション

  // wrangler.toml: crons = ["0 15 * * *"]  (UTC 15:00 = JST 0:00)

  // ──────────────────────────────

  async scheduled(event, env, ctx) {

    ctx.waitUntil(autoRotate(env));

  },

};



async function autoRotate(env) {

  // 昨日の日付（JST）

  const now = new Date();

  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);

  jst.setDate(jst.getDate() - 1);

  const yesterday = jst.toISOString().slice(0, 10);



  // 全作業を取得

  const { results: chores } = await env.DB.prepare(

    'SELECT * FROM chores WHERE enabled=1'

  ).all();



  for (const chore of chores) {

    // 昨日このおてつだいが完了しているか確認

    const done = await env.DB.prepare(

      'SELECT id FROM chore_logs WHERE chore_id=? AND completed_date=? LIMIT 1'

    ).bind(chore.id, yesterday).first();



    if (done) continue; // 完了済みならスキップ



    // 未完了 → ローテーションだけ進める

    const state = await env.DB.prepare(

      'SELECT * FROM chore_state WHERE chore_id=?'

    ).bind(chore.id).first();



    if (!state) continue;

    if (state.rotation_order === 'none') continue; // ローテーションなしはスキップ



    const next = nextInRotation(state.next_assignee, state.rotation_order);

    await env.DB.prepare(

      'UPDATE chore_state SET next_assignee=? WHERE chore_id=?'

    ).bind(next, chore.id).run();



    console.log(`[autoRotate] ${chore.id}: ${state.next_assignee} → ${next} (skipped ${yesterday})`);

  }

}