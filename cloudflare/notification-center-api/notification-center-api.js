/**

 * 通知センター Worker (v2)

 *   - 通知ルール / 端末(Push購読) / 実行記録(習慣チェック) の API

 *   - scheduled() で毎分実行し、JSTの現在時刻に該当する通知を Web Push 送信

 *   - 通知をタップ → きょうの記録画面で ✅できた / ⏰あとで / ❌今日はしない

 *

 * 依存ライブラリなし。Web Push (RFC 8291 aes128gcm + RFC 8292 VAPID) を

 * Web Crypto API だけで実装している。

 *

 * 必要なバインディング / シークレット

 *   DB                : D1 Database

 *   APP_PASSWORD      : X-App-Password の照合用（secret）

 *   VAPID_PUBLIC_KEY  : base64url（65バイトの非圧縮公開鍵）

 *   VAPID_PRIVATE_KEY : base64url（32バイトの秘密鍵）

 *   VAPID_SUBJECT     : "mailto:you@example.com"

 *   ALLOWED_ORIGINS   : カンマ区切り

 *   SITE_ORIGIN       : 省略可。通知タップ先URLの組み立てに使う（既定 https\://cetus.fun）

 */



const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

const RECIPIENTS = ['mama', 'child1', 'child2', 'grandpa', 'grandma', 'all'];

const TEXT_RECIPIENTS = ['mama', 'child1', 'child2', 'grandpa', 'grandma']; // 'all' は既定文なので上書き対象外

const REPEAT_TYPES = ['daily', 'weekly', 'interval', 'once'];

const STATUSES = ['done', 'later', 'skip'];

const TODAY_PAGE = '/kanriapp/notification-today.html';

const CENTER_PAGE = '/kanriapp/notification-center.html';



/* ------------------------------------------------------------------ */

/* 小道具                                                              */

/* ------------------------------------------------------------------ */



const te = new TextEncoder();



function b64urlToBytes(str) {

  const s = String(str).replace(/-/g, '+').replace(/_/g, '/');

  const pad = s.length % 4 ? '='.repeat(4 - (s.length % 4)) : '';

  const bin = atob(s + pad);

  const out = new Uint8Array(bin.length);

  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);

  return out;

}



function bytesToB64url(buf) {

  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);

  let s = '';

  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);

  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

}



function concatBytes(...parts) {

  let len = 0;

  for (const p of parts) len += p.length;

  const out = new Uint8Array(len);

  let off = 0;

  for (const p of parts) {

    out.set(p, off);

    off += p.length;

  }

  return out;

}



async function hmacSha256(keyBytes, dataBytes) {

  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);

  return new Uint8Array(await crypto.subtle.sign('HMAC', key, dataBytes));

}



function timingSafeEqual(a, b) {

  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;

  let diff = 0;

  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);

  return diff === 0;

}



/* ------------------------------------------------------------------ */

/* VAPID (RFC 8292)                                                    */

/* ------------------------------------------------------------------ */



async function importVapidPrivateKey(env) {

  const pub = b64urlToBytes(env.VAPID_PUBLIC_KEY);

  if (pub.length !== 65) throw new Error('VAPID_PUBLIC_KEY は65バイトの非圧縮鍵(base64url)である必要があります');

  const jwk = {

    kty: 'EC',

    crv: 'P-256',

    x: bytesToB64url(pub.slice(1, 33)),

    y: bytesToB64url(pub.slice(33, 65)),

    d: String(env.VAPID_PRIVATE_KEY).replace(/=+$/, ''),

    ext: true,

  };

  return crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);

}



async function createVapidAuthHeader(endpoint, env) {

  const aud = new URL(endpoint).origin;

  const header = { typ: 'JWT', alg: 'ES256' };

  const payload = {

    aud,

    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,

    sub: env.VAPID_SUBJECT || 'mailto:admin@cetus.fun',

  };

  const unsigned = `${bytesToB64url(te.encode(JSON.stringify(header)))}.${bytesToB64url(te.encode(JSON.stringify(payload)))}`;

  const key = await importVapidPrivateKey(env);

  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, te.encode(unsigned));

  return `vapid t=${unsigned}.${bytesToB64url(sig)}, k=${env.VAPID_PUBLIC_KEY}`;

}



/* ------------------------------------------------------------------ */

/* ペイロード暗号化 (RFC 8291 aes128gcm)                                */

/* ------------------------------------------------------------------ */



async function encryptPayload(plaintext, p256dhB64, authB64) {

  const clientPub = b64urlToBytes(p256dhB64);

  const authSecret = b64urlToBytes(authB64);



  const serverKeys = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);

  const serverPub = new Uint8Array(await crypto.subtle.exportKey('raw', serverKeys.publicKey));

  const clientKey = await crypto.subtle.importKey('raw', clientPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);

  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: clientKey }, serverKeys.privateKey, 256));



  const prkKey = await hmacSha256(authSecret, shared);

  const keyInfo = concatBytes(te.encode('WebPush: info'), new Uint8Array([0]), clientPub, serverPub, new Uint8Array([1]));

  const ikm = await hmacSha256(prkKey, keyInfo);



  const salt = crypto.getRandomValues(new Uint8Array(16));

  const prk = await hmacSha256(salt, ikm);

  const cek = (await hmacSha256(prk, concatBytes(te.encode('Content-Encoding: aes128gcm'), new Uint8Array([0, 1])))).slice(0, 16);

  const nonce = (await hmacSha256(prk, concatBytes(te.encode('Content-Encoding: nonce'), new Uint8Array([0, 1])))).slice(0, 12);



  const record = concatBytes(te.encode(plaintext), new Uint8Array([2]));

  const aesKey = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);

  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce, tagLength: 128 }, aesKey, record));



  const rs = new Uint8Array([0x00, 0x00, 0x10, 0x00]); // 4096

  return concatBytes(salt, rs, new Uint8Array([serverPub.length]), serverPub, ciphertext);

}



async function sendPush(sub, payloadObj, env) {

  const body = await encryptPayload(JSON.stringify(payloadObj), sub.p256dh, sub.auth);

  const auth = await createVapidAuthHeader(sub.endpoint, env);

  const res = await fetch(sub.endpoint, {

    method: 'POST',

    headers: {

      Authorization: auth,

      'Content-Encoding': 'aes128gcm',

      'Content-Type': 'application/octet-stream',

      TTL: '3600',

      Urgency: 'normal',

    },

    body,

  });

  return { ok: res.ok, status: res.status, gone: res.status === 404 || res.status === 410 };

}



/* ------------------------------------------------------------------ */

/* 日時（JST）                                                          */

/* ------------------------------------------------------------------ */



function toJstParts(date) {

  const d = new Date(date.getTime() + JST_OFFSET_MS);

  const y = d.getUTCFullYear();

  const m = String(d.getUTCMonth() + 1).padStart(2, '0');

  const day = String(d.getUTCDate()).padStart(2, '0');

  const hour = d.getUTCHours();

  const minute = d.getUTCMinutes();

  return {

    dateStr: `${y}-${m}-${day}`,

    timeStr: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,

    hour,

    minute,

    dow: d.getUTCDay(),

    minuteOfDay: hour * 60 + minute,

  };

}



/** JSTのいま + minutes 分後を 'YYYY-MM-DD HH:MM' で返す（あとで通知用） */

function jstKeyAfter(minutes, now = new Date()) {

  const p = toJstParts(new Date(now.getTime() + minutes * 60 * 1000));

  return `${p.dateStr} ${p.timeStr}`;

}



function parseDays(csv) {

  if (!csv) return null;

  const arr = String(csv)

    .split(',')

    .map((s) => parseInt(s.trim(), 10))

    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);

  return arr.length ? arr : null;

}



function hhmmToMinutes(hhmm, fallback) {

  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || ''));

  if (!m) return fallback;

  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);

}



function ruleMatches(rule, p) {

  const days = parseDays(rule.days_of_week);

  switch (rule.repeat_type) {

    case 'once':

      return rule.once_date === p.dateStr && rule.time === p.timeStr;

    case 'daily':

      return rule.time === p.timeStr;

    case 'weekly':

      if (!days || !days.includes(p.dow)) return false;

      return rule.time === p.timeStr;

    case 'interval': {

      if (days && !days.includes(p.dow)) return false;

      const start = hhmmToMinutes(rule.start_time, 9 * 60);

      const end = hhmmToMinutes(rule.end_time, 17 * 60);

      const step = Math.max(1, parseInt(rule.interval_hours, 10) || 1) * 60;

      if (p.minuteOfDay < start || p.minuteOfDay > end) return false;

      return (p.minuteOfDay - start) % step === 0;

    }

    default:

      return false;

  }

}



/** その日にそのルールが鳴る回数（きょうの記録の分母） */

function targetCountForDay(rule, p) {

  const days = parseDays(rule.days_of_week);

  switch (rule.repeat_type) {

    case 'daily':

      return 1;

    case 'weekly':

      return days && days.includes(p.dow) ? 1 : 0;

    case 'once':

      return rule.once_date === p.dateStr ? 1 : 0;

    case 'interval': {

      if (days && !days.includes(p.dow)) return 0;

      const start = hhmmToMinutes(rule.start_time, 9 * 60);

      const end = hhmmToMinutes(rule.end_time, 17 * 60);

      const step = Math.max(1, parseInt(rule.interval_hours, 10) || 1) * 60;

      return Math.floor((end - start) / step) + 1;

    }

    default:

      return 0;

  }

}



/* ------------------------------------------------------------------ */

/* 通知文（recipientごとの出し分け）                                     */

/* ------------------------------------------------------------------ */



function parseTexts(rule) {

  if (!rule || !rule.texts) return {};

  try {

    const o = JSON.parse(rule.texts);

    return o && typeof o === 'object' ? o : {};

  } catch (e) {

    return {};

  }

}



/**

 * その端末の持ち主(recipient)向けの通知文を決める。

 * 個別設定がなければルールの既定文にフォールバックする。

 */

function textFor(rule, recipient) {

  const t = parseTexts(rule)[recipient] || {};

  return {

    title: t.title || rule.title,

    body: t.body || rule.body || '',

    url: t.url || rule.url || null,

  };

}



/** その通知を「誰の記録」として数えるか */

function completionRecipient(rule, deviceRecipient) {

  return rule.recipient === 'all' ? deviceRecipient : rule.recipient;

}



/** 通知タップで開くURL。記録する習慣なら、きょうの記録の詳細画面へ */

function tapUrl(rule, occurrenceKey, recipient, text) {

  if (!rule.track_completion) return text.url || CENTER_PAGE;

  const p = new URLSearchParams({ rule: String(rule.id), occ: occurrenceKey, to: recipient });

  if (text.url) p.set('next', text.url);

  return `${TODAY_PAGE}?${p.toString()}`;

}



/* ------------------------------------------------------------------ */

/* スケジューラ本体                                                     */

/* ------------------------------------------------------------------ */



async function subsForRecipient(env, recipient) {
  await ensureHomeNotificationTable(env);
  if(isHomeNotificationRecipient(recipient)){
    await ensureHomeNotificationTable(env);
    return (await env.DB.prepare('SELECT s.*,h.home_user_id,h.home_session_id FROM push_subscriptions s JOIN home_notification_subscriptions h ON h.endpoint=s.endpoint WHERE s.enabled=1 AND (?=\'home-all\' OR h.home_user_id=?)').bind(recipient,String(recipient).slice(5)).all()).results;
  }

  const { results } = await env.DB.prepare(

    `SELECT * FROM push_subscriptions

      WHERE enabled = 1 AND recipient != 'home-only' AND NOT EXISTS (SELECT 1 FROM home_notification_only_endpoints h WHERE h.endpoint=push_subscriptions.endpoint) AND (? = 'all' OR recipient = 'all' OR recipient = ?)`

  )

    .bind(recipient, recipient)

    .all();

  return results || [];

}



async function markSubResult(env, sub, r) {

  if (r.ok) {

    await env.DB.prepare(

      `UPDATE push_subscriptions SET last_success_at = CURRENT_TIMESTAMP, fail_count = 0, last_error = NULL WHERE id = ?`

    ).bind(sub.id).run();

  } else if (r.gone) {

    await env.DB.prepare(

      `UPDATE push_subscriptions SET enabled = 0, fail_count = fail_count + 1, last_error = ? WHERE id = ?`

    ).bind(`gone:${r.status}`, sub.id).run();

  } else {

    await env.DB.prepare(

      `UPDATE push_subscriptions SET fail_count = fail_count + 1, last_error = ? WHERE id = ?`

    ).bind(`http:${r.status}`, sub.id).run();

  }

}



/** 1つのルール発火を、対象端末それぞれへ送る（文面は端末の持ち主ごとに切り替え） */

async function fireRule(env, rule, fireKey, dateStr) {
  const homeRecipient=homeRuleRecipient(rule);
  if(homeRecipient)rule={...rule,recipient:homeRecipient};

  const subs = await subsForRecipient(env, rule.recipient);



  // その日すでに「今日はしない」「できた」を押している人へは送らない（第2段階の機能）

  const { results: comps } = await env.DB.prepare(

    `SELECT recipient, status FROM habit_completions WHERE rule_id = ? AND date = ?`

  ).bind(rule.id, dateStr).all();

  const skipped = new Set((comps || []).filter((c) => c.status === 'skip').map((c) => c.recipient));

  const done = new Set((comps || []).filter((c) => c.status === 'done').map((c) => c.recipient));

  const onceADay = rule.repeat_type !== 'interval'; // 1日1回の習慣は、できたら以降送らない



  let sent = 0;

  let failed = 0;

  let suppressed = 0;



  for (const sub of subs) {

    const recip = completionRecipient(rule, sub.recipient);

    if (rule.track_completion) {

      if (skipped.has(recip)) { suppressed++; continue; }

      if (onceADay && done.has(recip)) { suppressed++; continue; }

    }

    let delivery=null;
    if(isHomeNotificationRecipient(rule.recipient)){
      try{delivery=await checkHomeCalendarDelivery(env,rule,sub.home_user_id,sub.home_session_id);}catch{delivery=null;}
      if(!delivery?.allowed){suppressed++;continue;}
    }
    const text = textFor(rule, sub.recipient);

    const payload = {

      title: delivery?.title || text.title,

      body: text.body,

      url: delivery?.url || tapUrl(rule, fireKey, recip, text),

      tag: `rule-${rule.id}-${fireKey}`,

      rule_id: rule.id,

    };

    try {

      const r = await sendPush(sub, payload, env);

      if (r.ok) sent++; else failed++;

      await markSubResult(env, sub, r);

    } catch (e) {

      failed++;

      await env.DB.prepare(`UPDATE push_subscriptions SET fail_count = fail_count + 1, last_error = ? WHERE id = ?`)

        .bind(String(e).slice(0, 200), sub.id).run();

    }

  }

  return { sent, failed, suppressed };

}



/** 「⏰あとで」で予約された再通知を送る */

async function sendDueSnoozes(env, now) {

  const p = toJstParts(now);

  const nowKey = `${p.dateStr} ${p.timeStr}`;

  const { results: due } = await env.DB.prepare(

    `SELECT * FROM habit_completions

      WHERE status = 'later' AND reminded = 0 AND remind_at IS NOT NULL AND remind_at <= ?`

  ).bind(nowKey).all();



  const out = [];

  for (const c of due || []) {

    // 先に既読フラグを立てる（多重送信防止）

    const upd = await env.DB.prepare(

      `UPDATE habit_completions SET reminded = 1 WHERE id = ? AND reminded = 0`

    ).bind(c.id).run();

    if (!upd.meta || upd.meta.changes === 0) continue;



    const rule = await env.DB.prepare(`SELECT * FROM notification_rules WHERE id = ?`).bind(c.rule_id).first();

    if (!rule) continue;



    const subs = await subsForRecipient(env, c.recipient);

    let sent = 0;

    for (const sub of subs) {

      const text = textFor(rule, sub.recipient === 'all' ? c.recipient : sub.recipient);

      const payload = {

        title: text.title,

        body: text.body,

        url: tapUrl(rule, c.occurrence_key, c.recipient, text),

        tag: `snooze-${c.id}`,

        rule_id: rule.id,

      };

      try {

        const r = await sendPush(sub, payload, env);

        if (r.ok) sent++;

        await markSubResult(env, sub, r);

      } catch (e) { /* 次の端末へ */ }

    }

    out.push({ completion_id: c.id, rule_id: c.rule_id, sent });

  }

  return out;

}



async function runSchedule(env, now = new Date(), { dryRun = false, lookbackMinutes = 3 } = {}) {

  const nowP = toJstParts(now);

  const result = { checked_at: `${nowP.dateStr} ${nowP.timeStr}`, fired: [], snoozed: [], skipped: 0 };



  const { results: rules } = await env.DB.prepare(`SELECT * FROM notification_rules WHERE enabled = 1`).all();



  for (let back = lookbackMinutes - 1; back >= 0; back--) {

    const p = toJstParts(new Date(now.getTime() - back * 60 * 1000));



    for (const rule of rules || []) {

      if (!rule.enabled) continue;

      if (!ruleMatches(rule, p)) continue;



      const fireKey = `${p.dateStr} ${p.timeStr}`;



      if (dryRun) {

        result.fired.push({ rule_id: rule.id, title: rule.title, fire_key: fireKey, dry_run: true });

        continue;

      }



      // 重複送信ガード：同じ (rule_id, fire_key) は一度しか入らない

      const ins = await env.DB.prepare(

        `INSERT OR IGNORE INTO notification_logs (rule_id, fire_key, recipient, title, status)

         VALUES (?, ?, ?, ?, 'pending')`

      ).bind(rule.id, fireKey, rule.recipient, rule.title).run();



      if (!ins.meta || ins.meta.changes === 0) {

        result.skipped++;

        continue;

      }

      const logId = ins.meta.last_row_id;



      const { sent, failed, suppressed } = await fireRule(env, rule, fireKey, p.dateStr);



      await env.DB.prepare(

        `UPDATE notification_logs SET status = ?, sent_count = ?, fail_count = ?, suppressed_count = ? WHERE id = ?`

      ).bind(sent > 0 ? 'sent' : failed > 0 ? 'failed' : 'suppressed', sent, failed, suppressed, logId).run();



      if (rule.repeat_type === 'once') {

        await env.DB.prepare(`UPDATE notification_rules SET enabled = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)

          .bind(rule.id).run();

        rule.enabled = 0;

      }



      result.fired.push({ rule_id: rule.id, title: rule.title, fire_key: fireKey, sent, failed, suppressed });

    }

  }



  if (!dryRun) {

    result.snoozed = await sendDueSnoozes(env, now);

  }

  return result;

}



/* ------------------------------------------------------------------ */

/* HTTP まわり                                                          */

/* ------------------------------------------------------------------ */



function corsHeaders(request, env) {

  const origin = request.headers.get('Origin') || '';

  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);

  const allow = allowed.includes(origin) ? origin : allowed[0] || '*';

  return {

    'Access-Control-Allow-Origin': allow,

    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',

    'Access-Control-Allow-Headers': 'Content-Type, X-App-Password',

    'Access-Control-Max-Age': '86400',

    Vary: 'Origin',

  };

}



function json(data, request, env, status = 200) {

  return new Response(JSON.stringify(legacySafeResponse(data)), {

    status,

    headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders(request, env) },

  });

}



function authOk(request, env) {

  return timingSafeEqual(request.headers.get('X-App-Password') || '', env.APP_PASSWORD || '\u0000');

}



function pickRecipient(v) {

  return RECIPIENTS.includes(v) || isHomeNotificationRecipient(v) ? v : 'all';

}



/** recipientごとの通知文を検証してJSON文字列にする */

function normalizeTexts(input) {

  if (!input || typeof input !== 'object') return null;

  const out = {};

  for (const r of TEXT_RECIPIENTS) {

    const t = input[r];

    if (!t) continue;

    const title = String(t.title || '').trim().slice(0, 60);

    const body = String(t.body || '').trim().slice(0, 200);

    const url = String(t.url || '').trim().slice(0, 300);

    if (!title && !body && !url) continue;

    out[r] = {};

    if (title) out[r].title = title;

    if (body) out[r].body = body;

    if (url) out[r].url = url;

  }

  return Object.keys(out).length ? JSON.stringify(out) : null;

}



function normalizeRule(input) {

  const errors = [];

  const title = String(input.title || '').trim();

  if (!title) errors.push('タイトルは必須です');

  if (title.length > 60) errors.push('タイトルが長すぎます');



  const repeat_type = REPEAT_TYPES.includes(input.repeat_type) ? input.repeat_type : null;

  if (!repeat_type) errors.push('繰り返し種別が不正です');



  const time = /^\d{2}:\d{2}$/.test(input.time || '') ? input.time : null;

  const start_time = /^\d{2}:\d{2}$/.test(input.start_time || '') ? input.start_time : null;

  const end_time = /^\d{2}:\d{2}$/.test(input.end_time || '') ? input.end_time : null;

  const once_date = /^\d{4}-\d{2}-\d{2}$/.test(input.once_date || '') ? input.once_date : null;

  const days = parseDays(input.days_of_week);



  if (repeat_type === 'daily' && !time) errors.push('時刻を入力してください');

  if (repeat_type === 'weekly') {

    if (!time) errors.push('時刻を入力してください');

    if (!days) errors.push('曜日を1つ以上選んでください');

  }

  if (repeat_type === 'once') {

    if (!time) errors.push('時刻を入力してください');

    if (!once_date) errors.push('日付を入力してください');

  }

  if (repeat_type === 'interval') {

    if (!start_time || !end_time) errors.push('開始時刻と終了時刻を入力してください');

    if (start_time && end_time && hhmmToMinutes(start_time, 0) > hhmmToMinutes(end_time, 0)) {

      errors.push('終了時刻は開始時刻より後にしてください');

    }

  }



  const interval_hours = Math.min(12, Math.max(1, parseInt(input.interval_hours, 10) || 1));



  const external_key = String(input.external_key || '').trim().slice(0, 40).replace(/[^a-zA-Z0-9_-]/g, '') || null;



  return {

    errors,

    row: {

      title,

      body: String(input.body || '').slice(0, 200),

      recipient: pickRecipient(input.recipient),

      url: String(input.url || '').slice(0, 300) || null,

      external_key,

      texts: normalizeTexts(input.texts),

      repeat_type,

      time,

      days_of_week: days ? days.join(',') : null,

      start_time: repeat_type === 'interval' ? start_time : null,

      end_time: repeat_type === 'interval' ? end_time : null,

      interval_hours: repeat_type === 'interval' ? interval_hours : null,

      once_date: repeat_type === 'once' ? once_date : null,

      enabled: input.enabled === 0 || input.enabled === false ? 0 : 1,

      track_completion: input.track_completion === 0 || input.track_completion === false ? 0 : 1,

    },

  };

}



/** APIで返す形（texts はオブジェクトに戻し、今日の分母も添える） */

function ruleToJson(rule, p) {

  return {

    ...rule,

    texts: parseTexts(rule),

    target_today: targetCountForDay(rule, p),

  };

}



/* ------------------------------------------------------------------ */

/* ルーティング                                                         */

/* ------------------------------------------------------------------ */



async function handleRequest(request, env) {

  const url = new URL(request.url);

  const path = url.pathname.replace(/\/+$/, '') || '/';

  const method = request.method;



  if (method === 'OPTIONS') {

    return new Response(null, { status: 204, headers: corsHeaders(request, env) });

  }



  if (path === '/api/vapid-public-key' && method === 'GET') {

    return json({ publicKey: env.VAPID_PUBLIC_KEY || '' }, request, env);

  }



  if (path === '/api/health' && method === 'GET') {

    const p = toJstParts(new Date());

    return json({ ok: true, jst: `${p.dateStr} ${p.timeStr}`, version: 3, home_notification_protocol:'home-v1' }, request, env);

  }



  if(path==='/internal/school-prep/send')return schoolPreparationPush(request,env);
  if(path==='/internal/passbook-gifts/send')return passbookGiftPush(request,env);
  if(path.startsWith('/api/home/'))return homeNotificationRoute(request,env,path);
  if (!authOk(request, env)) {

    return json({ error: 'あいことばが違います' }, request, env, 401);

  }



  const body = ['POST', 'PUT', 'PATCH'].includes(method) ? await request.json().catch(() => ({})) : {};

  const nowP = toJstParts(new Date());
  if(path!=='/api/calendar-sync' && isHomeNotificationRecipient(body.recipient))return json({error:'HOMEカレンダーから操作してください'},request,env,403);



  /* ---- 端末（Push購読） ---- */



  if (path === '/api/subscribe' && method === 'POST') {

    const endpoint = String(body.endpoint || '');

    const p256dh = String(body.p256dh || '');

    const auth = String(body.auth || '');

    if (!endpoint || !p256dh || !auth) return json({ error: '購読情報が足りません' }, request, env, 400);



    await env.DB.prepare(

      `INSERT INTO push_subscriptions (endpoint, p256dh, auth, recipient, device_name, user_agent, enabled, fail_count)

       VALUES (?, ?, ?, ?, ?, ?, 1, 0)

       ON CONFLICT(endpoint) DO UPDATE SET

         p256dh = excluded.p256dh, auth = excluded.auth, recipient = excluded.recipient,

         device_name = excluded.device_name, user_agent = excluded.user_agent,

         enabled = 1, fail_count = 0, last_error = NULL, updated_at = CURRENT_TIMESTAMP`

    ).bind(

      endpoint, p256dh, auth,

      pickRecipient(body.recipient),

      String(body.device_name || '名前のない端末').slice(0, 40),

      String(body.user_agent || request.headers.get('User-Agent') || '').slice(0, 200)

    ).run();



    const row = await env.DB.prepare(`SELECT * FROM push_subscriptions WHERE endpoint = ?`).bind(endpoint).first();

    return json({ ok: true, device: row }, request, env);

  }



  if (path === '/api/unsubscribe' && method === 'POST') {

    await env.DB.prepare(`DELETE FROM push_subscriptions WHERE endpoint = ?`).bind(String(body.endpoint || '')).run();

    return json({ ok: true }, request, env);

  }



  if (path === '/api/devices' && method === 'GET') {

    const { results } = await env.DB.prepare(

      `SELECT id, endpoint, recipient, device_name, enabled, user_agent, fail_count, last_error, last_success_at, created_at

         FROM push_subscriptions ORDER BY recipient, id`

    ).all();

    return json({ devices: results || [] }, request, env);

  }



  const deviceMatch = /^\/api\/devices\/(\d+)$/.exec(path);

  if (deviceMatch) {

    const id = Number(deviceMatch[1]);

    if (method === 'PATCH') {

      const sets = [];

      const vals = [];

      if (body.device_name !== undefined) { sets.push('device_name = ?'); vals.push(String(body.device_name).slice(0, 40)); }

      if (body.recipient !== undefined) { sets.push('recipient = ?'); vals.push(pickRecipient(body.recipient)); }

      if (body.enabled !== undefined) { sets.push('enabled = ?'); vals.push(body.enabled ? 1 : 0); }

      if (!sets.length) return json({ error: '更新する項目がありません' }, request, env, 400);

      sets.push('updated_at = CURRENT_TIMESTAMP');

      vals.push(id);

      await env.DB.prepare(`UPDATE push_subscriptions SET ${sets.join(', ')} WHERE id = ?`).bind(...vals).run();

      const row = await env.DB.prepare(`SELECT * FROM push_subscriptions WHERE id = ?`).bind(id).first();

      return json({ ok: true, device: row }, request, env);

    }

    if (method === 'DELETE') {

      await env.DB.prepare(`DELETE FROM push_subscriptions WHERE id = ?`).bind(id).run();

      return json({ ok: true }, request, env);

    }

  }



  /* ---- 通知ルール ---- */



  /*

   * 家族カレンダー連携。

   * calendar-worker から、1つの予定に属する通知時刻をまとめて同期する。

   * 同じ source_id の古い予約を先に削除するため、予定の編集・削除にも追従する。

   */

  if (path === '/api/calendar-sync' && method === 'POST') {

    const sourceId = String(body.source_id || '').trim();

    const externalKey = `cal_${sourceId}`.slice(0, 40).replace(/[^a-zA-Z0-9_-]/g, '');

    if (!sourceId || !externalKey) {

      return json({ error: 'source_id は必須です' }, request, env, 400);

    }



    const title = isHomeNotificationRecipient(body.recipient)?'📅 カレンダーの予定':String(body.title || '家族カレンダー').trim().slice(0, 60);

    const message = isHomeNotificationRecipient(body.recipient)?'予定の時間です':String(body.body || '').slice(0, 200);

    const recipient = pickRecipient(body.recipient);
    if(body.recipient && recipient!==body.recipient)return json({error:'通知先を確認してください'},request,env,400);

    const targetUrl = String(body.url || '/kanriapp/calendar.html').slice(0, 300);

    const occurrences = Array.isArray(body.occurrences) ? body.occurrences.slice(0, 500) : [];



    const oldRows = await env.DB.prepare(

      `SELECT id FROM notification_rules WHERE external_key = ? AND track_completion = 0`

    ).bind(externalKey).all();

    const oldIds = (oldRows.results || []).map((r) => r.id);



    if (oldIds.length) {

      await env.DB.prepare(

        `DELETE FROM notification_logs

          WHERE rule_id IN (SELECT id FROM notification_rules WHERE external_key = ? AND track_completion = 0)`

      ).bind(externalKey).run();

      await env.DB.prepare(

        `DELETE FROM habit_completions

          WHERE rule_id IN (SELECT id FROM notification_rules WHERE external_key = ? AND track_completion = 0)`

      ).bind(externalKey).run();

      await env.DB.prepare(

        `DELETE FROM notification_rules WHERE external_key = ? AND track_completion = 0`

      ).bind(externalKey).run();

    }



    const valid = occurrences.filter((o) =>

      /^\d{4}-\d{2}-\d{2}$/.test(String(o.date || '')) &&

      /^\d{2}:\d{2}$/.test(String(o.time || ''))

    );



    if (valid.length) {

      for (let i = 0; i < valid.length; i += 100) {

        await env.DB.batch(valid.slice(i, i + 100).map((o) => env.DB.prepare(

          `INSERT INTO notification_rules

            (title, body, recipient, url, external_key, texts, repeat_type, time,

             days_of_week, start_time, end_time, interval_hours, once_date, enabled, track_completion)

           VALUES (?, ?, ?, ?, ?, ?, 'once', ?, NULL, NULL, NULL, NULL, ?, 1, 0)`

        ).bind(title, message, isHomeNotificationRecipient(recipient)?'all':recipient, targetUrl, externalKey, isHomeNotificationRecipient(recipient)?JSON.stringify({__home_calendar_recipient:recipient}):null, o.time, o.date)));

      }

    }



    return json({

      ok: true,

      source_id: sourceId,

      deleted: oldIds.length,

      scheduled: valid.length,

    }, request, env);

  }



  if (path === '/api/rules' && method === 'GET') {

    const { results } = await env.DB.prepare(

      `SELECT * FROM notification_rules ORDER BY enabled DESC, COALESCE(time, start_time), id`

    ).all();

    return json({ rules: (results || []).map((r) => ruleToJson(r, nowP)) }, request, env);

  }



  if (path === '/api/rules' && method === 'POST') {

    const { errors, row } = normalizeRule(body);

    if (errors.length) return json({ error: errors.join(' / ') }, request, env, 400);

    const res = await env.DB.prepare(

      `INSERT INTO notification_rules

        (title, body, recipient, url, external_key, texts, repeat_type, time, days_of_week, start_time, end_time, interval_hours, once_date, enabled, track_completion)

       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`

    ).bind(

      row.title, row.body, row.recipient, row.url, row.external_key, row.texts, row.repeat_type, row.time,

      row.days_of_week, row.start_time, row.end_time, row.interval_hours, row.once_date, row.enabled, row.track_completion

    ).run();

    const created = await env.DB.prepare(`SELECT * FROM notification_rules WHERE id = ?`).bind(res.meta.last_row_id).first();

    return json({ ok: true, rule: ruleToJson(created, nowP) }, request, env, 201);

  }



  const ruleMatch = /^\/api\/rules\/(\d+)$/.exec(path);

  if (ruleMatch) {

    const id = Number(ruleMatch[1]);
    const protectedRule=await env.DB.prepare('SELECT recipient,texts FROM notification_rules WHERE id=?').bind(id).first();
    if(homeRuleRecipient(protectedRule))return json({error:'HOMEカレンダーから操作してください'},request,env,404);



    if (method === 'GET') {

      const rule = await env.DB.prepare(`SELECT * FROM notification_rules WHERE id = ?`).bind(id).first();

      if (!rule) return json({ error: 'ありません' }, request, env, 404);

      return json({ rule: ruleToJson(rule, nowP) }, request, env);

    }



    if (method === 'PUT') {

      const { errors, row } = normalizeRule(body);

      if (errors.length) return json({ error: errors.join(' / ') }, request, env, 400);

      await env.DB.prepare(

        `UPDATE notification_rules SET

           title = ?, body = ?, recipient = ?, url = ?, external_key = ?, texts = ?, repeat_type = ?, time = ?,

           days_of_week = ?, start_time = ?, end_time = ?, interval_hours = ?, once_date = ?,

           enabled = ?, track_completion = ?, updated_at = CURRENT_TIMESTAMP

         WHERE id = ?`

      ).bind(

        row.title, row.body, row.recipient, row.url, row.external_key, row.texts, row.repeat_type, row.time,

        row.days_of_week, row.start_time, row.end_time, row.interval_hours, row.once_date,

        row.enabled, row.track_completion, id

      ).run();

      const updated = await env.DB.prepare(`SELECT * FROM notification_rules WHERE id = ?`).bind(id).first();

      return json({ ok: true, rule: ruleToJson(updated, nowP) }, request, env);

    }



    if (method === 'PATCH') {

      const enabled = body.enabled ? 1 : 0;

      await env.DB.prepare(`UPDATE notification_rules SET enabled = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)

        .bind(enabled, id).run();

      return json({ ok: true, id, enabled }, request, env);

    }



    if (method === 'DELETE') {

      await env.DB.prepare(`DELETE FROM notification_rules WHERE id = ?`).bind(id).run();

      await env.DB.prepare(`DELETE FROM habit_completions WHERE rule_id = ?`).bind(id).run();

      return json({ ok: true }, request, env);

    }

  }



  /* ---- 実行記録（習慣チェック） ---- */



  // ✅できた / ⏰あとで / ❌今日はしない を記録する

  // 他のアプリ（きょうせいチェック等）からも、このAPIを叩けば「できた」にできる

  if (path === '/api/complete' && method === 'POST') {

    const status = STATUSES.includes(body.status) ? body.status : null;

    if (!status) return json({ error: 'status が不正です' }, request, env, 400);



    const source = String(body.source || 'notification').slice(0, 20);

    const wantRecipient = body.recipient ? pickRecipient(body.recipient) : null;



    // 対象ルールの特定：rule_id（通知タップ）か external_key（他アプリからの連携）

    let rule = null;

    if (body.rule_id) {

      rule = await env.DB.prepare(`SELECT * FROM notification_rules WHERE id = ?`).bind(parseInt(body.rule_id, 10)).first();

    } else if (body.external_key) {

      const key = String(body.external_key).trim().slice(0, 40);

      if (!wantRecipient) return json({ error: 'external_key を使うときは recipient も必要です' }, request, env, 400);

      // 同じキーを人ごとに持てる（例: homework × child1 / child2）

      rule = await env.DB.prepare(

        `SELECT * FROM notification_rules WHERE external_key = ? AND recipient = ?`

      ).bind(key, wantRecipient).first();

      if (!rule) {

        rule = await env.DB.prepare(

          `SELECT * FROM notification_rules WHERE external_key = ? AND recipient = 'all'`

        ).bind(key).first();

      }

      if (!rule) return json({ error: `連携キー ${key} (${wantRecipient}) に対応する通知がありません`, code: 'no_rule' }, request, env, 404);

    } else {

      return json({ error: 'rule_id か external_key が必要です' }, request, env, 400);

    }

    if (!rule) return json({ error: 'その通知はありません', code: 'no_rule' }, request, env, 404);

    const ruleId = rule.id;



    const recipient = wantRecipient || pickRecipient(rule.recipient);



    // occurrence_key（＝どの1回か）。UNIQUE(rule_id, recipient, occurrence_key) で二重記録を防ぐ。

    //   通知タップ : 'YYYY-MM-DD HH:MM'（発火時刻）

    //   他アプリ   : 'app-YYYY-MM-DD'   ← 同じ日に何度送っても同じ1件になる（冪等）

    //   手動の＋   : 'manual-...'       ← 押した回数だけ増える

    let occ = String(body.occurrence_key || '').trim();

    if (!occ) {

      occ = source === 'app'

        ? `app-${nowP.dateStr}`

        : `manual-${nowP.dateStr} ${nowP.timeStr}:${String(Date.now()).slice(-4)}`;

    }

    const date = /^\d{4}-\d{2}-\d{2}/.test(occ) ? occ.slice(0, 10)

      : /^app-(\d{4}-\d{2}-\d{2})/.test(occ) ? occ.slice(4, 14)

      : nowP.dateStr;



    let remindAt = null;

    if (status === 'later') {

      const mins = [10, 30, 60].includes(Number(body.snooze_minutes)) ? Number(body.snooze_minutes) : 10;

      remindAt = jstKeyAfter(mins);

    }



    await env.DB.prepare(

      `INSERT INTO habit_completions (rule_id, recipient, date, occurrence_key, status, remind_at, reminded, source)

       VALUES (?, ?, ?, ?, ?, ?, 0, ?)

       ON CONFLICT(rule_id, recipient, occurrence_key) DO UPDATE SET

         status = excluded.status, remind_at = excluded.remind_at, reminded = 0,

         source = excluded.source, created_at = CURRENT_TIMESTAMP`

    ).bind(ruleId, recipient, date, occ, status, remindAt, source).run();



    const saved = await env.DB.prepare(

      `SELECT * FROM habit_completions WHERE rule_id = ? AND recipient = ? AND occurrence_key = ?`

    ).bind(ruleId, recipient, occ).first();



    return json({ ok: true, rule_id: ruleId, completion: saved, remind_at: remindAt }, request, env);

  }



  // 記録の取り消し

  const compMatch = /^\/api\/completions\/(\d+)$/.exec(path);

  if (compMatch && method === 'DELETE') {

    await env.DB.prepare(`DELETE FROM habit_completions WHERE id = ?`).bind(Number(compMatch[1])).run();

    return json({ ok: true }, request, env);

  }



  // きょうの記録（ルール＋その日の分母＋実行記録をまとめて返す）

  if (path === '/api/today' && method === 'GET') {

    const date = /^\d{4}-\d{2}-\d{2}$/.test(url.searchParams.get('date') || '')

      ? url.searchParams.get('date')

      : nowP.dateStr;



    // 分母は「その日付」の曜日で数える

    const dayP = toJstParts(new Date(`${date}T00:00:00+09:00`));



    const { results: rules } = await env.DB.prepare(

      `SELECT * FROM notification_rules WHERE track_completion = 1 ORDER BY COALESCE(time, start_time), id`

    ).all();

    const { results: comps } = await env.DB.prepare(

      `SELECT * FROM habit_completions WHERE date = ? ORDER BY id`

    ).bind(date).all();



    return json(

      {

        date,

        rules: (rules || []).map((r) => ruleToJson(r, dayP)),

        completions: comps || [],

      },

      request, env

    );

  }



  // ある習慣の履歴（グラフ等に使える）

  if (path === '/api/history' && method === 'GET') {

    const days = Math.min(90, Math.max(1, parseInt(url.searchParams.get('days'), 10) || 14));

    const { results } = await env.DB.prepare(

      `SELECT date, rule_id, recipient, COUNT(*) AS done_count

         FROM habit_completions

        WHERE status = 'done' AND date >= date('now','+9 hours', ?)

        GROUP BY date, rule_id, recipient

        ORDER BY date DESC`

    ).bind(`-${days} days`).all();

    return json({ days, history: results || [] }, request, env);

  }



  /* ---- テスト送信 / 手動実行 / ログ ---- */



  if (path === '/api/test' && method === 'POST') {

    const payload = {

      title: String(body.title || '🔔 テスト通知'),

      body: String(body.body || 'とどいたら成功だよ'),

      url: String(body.url || CENTER_PAGE),

      tag: `test-${Date.now()}`,

    };



    let subs = [];

    if (body.endpoint) {

      const row = await env.DB.prepare(`SELECT * FROM push_subscriptions WHERE endpoint = ?`)

        .bind(String(body.endpoint)).first();

      if (row) subs = [row];

    } else {

      subs = await subsForRecipient(env, pickRecipient(body.recipient));

    }

    if (!subs.length) return json({ error: '送信先の端末が見つかりません' }, request, env, 404);



    const detail = [];

    for (const sub of subs) {

      try {

        const r = await sendPush(sub, payload, env);

        detail.push({ device: sub.device_name, status: r.status, ok: r.ok });

        await markSubResult(env, sub, r);

      } catch (e) {

        detail.push({ device: sub.device_name, ok: false, error: String(e).slice(0, 120) });

      }

    }

    return json({ ok: detail.some((d) => d.ok), detail }, request, env);

  }



  if (path === '/api/tick' && method === 'POST') {

    const dryRun = url.searchParams.get('dry') === '1';

    const result = await runSchedule(env, new Date(), { dryRun, lookbackMinutes: 1 });

    return json(result, request, env);

  }



  if (path === '/api/logs' && method === 'GET') {

    const { results } = await env.DB.prepare(`SELECT * FROM notification_logs ORDER BY id DESC LIMIT 50`).all();

    return json({ logs: results || [] }, request, env);

  }



  return json({ error: 'そのURLはありません' }, request, env, 404);

}



/* ------------------------------------------------------------------ */



export default {

  async fetch(request, env, ctx) {

    try {

      return await handleRequest(request, env);

    } catch (e) {

      return json({ error: 'サーバーでエラーが起きました', detail: String(e).slice(0, 300) }, request, env, 500);

    }

  },



  async scheduled(event, env, ctx) {

    ctx.waitUntil(

      runSchedule(env, new Date(event.scheduledTime || Date.now())).catch((e) => console.error('runSchedule failed', e))

    );

  },

};
function isHomeNotificationRecipient(value){return value==='home-all'||/^home:[a-zA-Z0-9_-]{1,100}$/.test(value||'');}
async function ensureHomeNotificationTable(env){
 await env.DB.prepare('CREATE TABLE IF NOT EXISTS home_notification_subscriptions (endpoint TEXT PRIMARY KEY,home_user_id TEXT NOT NULL,home_session_id TEXT NOT NULL,updated_at TEXT NOT NULL)').run();
 // Separate HOME-only delivery from the legacy recipient CHECK constraint.
 // Keep this marker even after HOME unlinking, so legacy 'all' cannot reach it.
 await env.DB.prepare('CREATE TABLE IF NOT EXISTS home_notification_only_endpoints (endpoint TEXT PRIMARY KEY)').run();
}
async function homeNotificationRoute(request,env,path){
 if(new URL(request.url).hostname!=='notification.internal')return json({error:'見つかりません'},request,env,404);
 if(!env.HOME_AUTH)return json({error:'HOME_AUTHの接続を確認してください'},request,env,503);
 const identity=await env.HOME_AUTH.fetch(new Request('https://notification-auth.internal/api/notifications/identity',{headers:{Cookie:request.headers.get('Cookie')||''}}));
 if(!identity.ok)return json({error:'HOMEにログインしてください'},request,env,401);
 const {user,session_id}=await identity.json();
 if(!user?.id||!session_id)return json({error:'HOMEの通知対応コードを確認してください'},request,env,503);
 if(path==='/api/home/vapid-public-key'&&request.method==='GET')return json({publicKey:env.VAPID_PUBLIC_KEY||'',user},request,env);
 if(!['/api/home/subscribe','/api/home/unsubscribe'].includes(path)||request.method!=='POST')return json({error:'見つかりません'},request,env,404);
 if(!['https://cetus.fun','https://home-worker.sslowdayss.workers.dev'].includes(request.headers.get('Origin')))return json({error:'HOMEから操作してください'},request,env,403);
 const body=await request.json(),endpoint=String(body.endpoint||'');
 if(!/^https:\/\//.test(endpoint)||endpoint.length>3000)return json({error:'端末情報を確認してください'},request,env,400);
 await ensureHomeNotificationTable(env);
 if(path.endsWith('/unsubscribe')){
   await env.DB.prepare('DELETE FROM home_notification_subscriptions WHERE endpoint=? AND home_user_id=?').bind(endpoint,user.id).run();
   return json({ok:true},request,env);
 }
 if(!body.p256dh||!body.auth)return json({error:'購読情報が足りません'},request,env,400);
 await env.DB.batch([
   env.DB.prepare('INSERT OR IGNORE INTO home_notification_only_endpoints SELECT ? WHERE NOT EXISTS(SELECT 1 FROM push_subscriptions WHERE endpoint=?)').bind(endpoint,endpoint),
   env.DB.prepare("INSERT INTO push_subscriptions (endpoint,p256dh,auth,recipient,device_name,user_agent,enabled,fail_count) VALUES(?,?,?,'all',?,?,1,0) ON CONFLICT(endpoint) DO UPDATE SET p256dh=excluded.p256dh,auth=excluded.auth,enabled=1").bind(endpoint,String(body.p256dh),String(body.auth),String(body.device_name||'HOMEの端末').slice(0,80),request.headers.get('User-Agent')||''),
   env.DB.prepare('INSERT INTO home_notification_subscriptions VALUES(?,?,?,?) ON CONFLICT(endpoint) DO UPDATE SET home_user_id=excluded.home_user_id,home_session_id=excluded.home_session_id,updated_at=excluded.updated_at').bind(endpoint,user.id,session_id,new Date().toISOString())
 ]);
 return json({ok:true,user},request,env);
}
async function checkHomeCalendarDelivery(env,rule,userId,sessionId){
 if(!env.HOME_AUTH||!userId||!sessionId||!String(rule.external_key||'').startsWith('cal_'))return {allowed:false};
 const url=new URL('https://notification-auth.internal/internal/notification-check');
 url.searchParams.set('session',sessionId);url.searchParams.set('user',userId);url.searchParams.set('event',String(rule.external_key).slice(4));
 const response=await env.HOME_AUTH.fetch(new Request(url));return response.ok?response.json():{allowed:false};
}

function homeRuleRecipient(rule){
 if(isHomeNotificationRecipient(rule?.recipient))return rule.recipient;
 let texts=rule?.texts;try{if(typeof texts==='string')texts=JSON.parse(texts);}catch{return null;}
 const recipient=texts?.__home_calendar_recipient;
 return isHomeNotificationRecipient(recipient)?recipient:null;
}
function legacySafeResponse(value){
 if(Array.isArray(value))return value.map(legacySafeResponse).filter(v=>v!==undefined);
 if(value&&typeof value==='object'){
   if(homeRuleRecipient(value)||value.recipient==='home-only')return undefined;
   return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,legacySafeResponse(v)]).filter(([,v])=>v!==undefined));
 }
 return value;
}

// School completion messages use existing HOME subscriptions; legacy rules stay unchanged.
async function schoolPreparationPush(request,env){
 if(new URL(request.url).hostname!=='notification.internal'||request.method!=='POST')return json({error:'見つかりません'},request,env,404);
 if(!env.HOME_AUTH)return json({error:'HOME_AUTHの接続を確認してください'},request,env,503);
 const input=await request.json().catch(()=>null),delivery=String(input?.delivery_id||'');
 if(!/^[a-zA-Z0-9_-]{1,100}$/.test(delivery))return json({error:'通知IDを確認してください'},request,env,400);
 const checkUrl=new URL('https://notification-auth.internal/internal/school-prep/notification-check');checkUrl.searchParams.set('delivery',delivery);
 const response=await env.HOME_AUTH.fetch(new Request(checkUrl));
 if(!response.ok)return json({error:'学校準備のHOME対応を確認してください'},request,env,503);
 const data=await response.json();
 if(!data.allowed)return json({ok:true,protocol:'school-v1',cancelled:true,delivered:0},request,env);
 if(!/^[a-zA-Z0-9_-]{1,100}$/.test(data.recipient_id||''))return json({error:'通知先を確認してください'},request,env,503);
 const subscriptions=(await env.DB.prepare('SELECT s.*,h.home_user_id,h.home_session_id FROM push_subscriptions s JOIN home_notification_subscriptions h ON h.endpoint=s.endpoint WHERE s.enabled=1 AND h.home_user_id=?').bind(data.recipient_id).all()).results;
 let delivered=0,failed=0;
 for(const sub of subscriptions){
  const liveUrl=new URL(checkUrl);liveUrl.searchParams.set('user',sub.home_user_id);liveUrl.searchParams.set('session',sub.home_session_id);
  const liveResponse=await env.HOME_AUTH.fetch(new Request(liveUrl));if(!liveResponse.ok)continue;
  const live=await liveResponse.json();if(!live.allowed||live.recipient_id!==sub.home_user_id)continue;
  const now=Math.floor(Date.now()/1000);
  await env.DB.prepare("INSERT OR IGNORE INTO school_push_deliveries VALUES(?,?,'pending',0,?)").bind(delivery,sub.endpoint,new Date().toISOString()).run();
  const old=await env.DB.prepare('SELECT status FROM school_push_deliveries WHERE delivery_id=? AND endpoint=?').bind(delivery,sub.endpoint).first();
  if(old?.status==='sent'){delivered++;continue;}
  const claim=await env.DB.prepare("UPDATE school_push_deliveries SET status='sending',lease_until=? WHERE delivery_id=? AND endpoint=? AND status!='sent' AND lease_until<? RETURNING delivery_id").bind(now+90,delivery,sub.endpoint,now).first();
  if(!claim){failed++;continue;}
  try{
   const result=await sendPush(sub,{title:'🎒 学校じゅんび',body:String(live.body||'準備状況が更新されました').slice(0,120),url:live.url,tag:'school-'+delivery,icon:'https://cetus.fun/wagaya/home-icon-192.png'},env);
   if(!result.ok)throw Error('push_failed');
   await env.DB.prepare("UPDATE school_push_deliveries SET status='sent',lease_until=0,updated_at=? WHERE delivery_id=? AND endpoint=?").bind(new Date().toISOString(),delivery,sub.endpoint).run();delivered++;
  }catch{
   await env.DB.prepare("UPDATE school_push_deliveries SET status='pending',lease_until=0,updated_at=? WHERE delivery_id=? AND endpoint=?").bind(new Date().toISOString(),delivery,sub.endpoint).run();failed++;
  }
 }
 return json({ok:failed===0,protocol:'school-v1',delivered,failed},request,env,failed?503:200);
}

async function passbookGiftPush(request,env){
 if(new URL(request.url).hostname!=='notification.internal'||request.method!=='POST')return json({error:'見つかりません'},request,env,404);
 if(!env.HOME_AUTH)return json({error:'HOME_AUTHの接続を確認してください'},request,env,503);
 const input=await request.json().catch(()=>null),delivery=String(input?.delivery_id||'');
 if(!/^[a-zA-Z0-9_:-]{1,220}$/.test(delivery))return json({error:'通知IDを確認してください'},request,env,400);
 const checkUrl=new URL('https://notification-auth.internal/internal/passbook-gifts/notification-check');checkUrl.searchParams.set('delivery',delivery);
 const response=await env.HOME_AUTH.fetch(new Request(checkUrl));
 if(!response.ok)return json({error:'プレゼントのHOME対応を確認してください'},request,env,503);
 const data=await response.json();
 if(!data.allowed)return json({ok:true,protocol:'gift-v1',cancelled:true,delivered:0},request,env);
 if(!/^[a-zA-Z0-9_-]{1,100}$/.test(data.recipient_id||''))return json({error:'通知先を確認してください'},request,env,503);
 const subscriptions=(await env.DB.prepare('SELECT s.*,h.home_user_id,h.home_session_id FROM push_subscriptions s JOIN home_notification_subscriptions h ON h.endpoint=s.endpoint WHERE s.enabled=1 AND h.home_user_id=?').bind(data.recipient_id).all()).results;
 let delivered=0,failed=0;
 for(const sub of subscriptions){
  const liveUrl=new URL(checkUrl);liveUrl.searchParams.set('user',sub.home_user_id);liveUrl.searchParams.set('session',sub.home_session_id);
  const liveResponse=await env.HOME_AUTH.fetch(new Request(liveUrl));if(!liveResponse.ok)continue;
  const live=await liveResponse.json();if(!live.allowed||live.recipient_id!==sub.home_user_id)continue;
  const now=Math.floor(Date.now()/1000);
  await env.DB.prepare("INSERT OR IGNORE INTO gift_push_deliveries VALUES(?,?,'pending',0,?)").bind(delivery,sub.endpoint,new Date().toISOString()).run();
  const old=await env.DB.prepare('SELECT status FROM gift_push_deliveries WHERE delivery_id=? AND endpoint=?').bind(delivery,sub.endpoint).first();
  if(old?.status==='sent'){delivered++;continue;}
  const claim=await env.DB.prepare("UPDATE gift_push_deliveries SET status='sending',lease_until=? WHERE delivery_id=? AND endpoint=? AND status!='sent' AND lease_until<? RETURNING delivery_id").bind(now+90,delivery,sub.endpoint,now).first();
  if(!claim){failed++;continue;}
  try{
   const result=await sendPush(sub,{title:'🎁 ごほうびプレゼント',body:String(live.body||'申請が届きました').slice(0,120),url:live.url,tag:'gift-'+delivery,icon:'https://cetus.fun/wagaya/home-icon-192.png'},env);
   if(!result.ok)throw Error('push_failed');
   await env.DB.prepare("UPDATE gift_push_deliveries SET status='sent',lease_until=0,updated_at=? WHERE delivery_id=? AND endpoint=?").bind(new Date().toISOString(),delivery,sub.endpoint).run();delivered++;
  }catch{
   await env.DB.prepare("UPDATE gift_push_deliveries SET status='pending',lease_until=0,updated_at=? WHERE delivery_id=? AND endpoint=?").bind(new Date().toISOString(),delivery,sub.endpoint).run();failed++;
  }
 }
 return json({ok:failed===0,protocol:'gift-v1',delivered,failed},request,env,failed?503:200);
}
