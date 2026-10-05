const CORS_HEADERS = {

  'Access-Control-Allow-Origin': 'https://cetus.fun',

  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',

  'Access-Control-Allow-Headers': 'Content-Type, X-Google-Token, Authorization',

  'Content-Type': 'application/json',
  'Cache-Control': 'private, no-store',
  'X-Content-Type-Options': 'nosniff',

};



function json(data, status = 200) {

  return new Response(JSON.stringify(data), { status, headers: CORS_HEADERS });

}



function err(msg, status = 400) {

  return new Response(JSON.stringify({ error: msg }), { status, headers: CORS_HEADERS });

}



function genId() {

  return crypto.randomUUID();

}



async function verifyGoogleToken(token) {

  try {

    const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${token}`);

    if (!res.ok) return null;

    const data = await res.json();

    if (!data.sub) return null;

    return { google_id: data.sub, email: data.email, name: data.name, picture: data.picture };

  } catch {

    return null;

  }

}



async function getUser(request, env) {
  if (request.headers.get('X-Home-Calendar') === '1') return getHomeCalendarUser(request,env);

  const auth = request.headers.get('Authorization') || '';

  if (auth.startsWith('Bearer ')) {

    const familyUser = await verifyFamilyToken(auth.slice(7), env);

    if (familyUser) return familyUser;

  }

  const token = request.headers.get('X-Google-Token');

  if (!token) return null;

  return await verifyGoogleToken(token);

}



const FAMILY_PROFILES = [

  { key: 'mama',     name: 'ママ',       color: '#ef8a4c', role: 'admin' },

  { key: 'grandma',  name: '祖母',       color: '#d4a84f', role: 'adult' },

  { key: 'brother',  name: '兄',         color: '#5b8dee', role: 'adult' },

  { key: 'sister',   name: '妹',         color: '#a877c8', role: 'adult' },

  { key: 'child1',   name: 'うさぎ',     color: '#f08eaa', role: 'child' },

  { key: 'child2',   name: 'ユニコーン', color: '#8d78d6', role: 'child' },

];



function bytesToBase64Url(bytes) {

  let s = '';

  for (const b of bytes) s += String.fromCharCode(b);

  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');

}



function textToBase64Url(text) {

  return bytesToBase64Url(new TextEncoder().encode(text));

}



function base64UrlToText(value) {

  const base64 = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4);

  const binary = atob(base64);

  return new TextDecoder().decode(Uint8Array.from(binary, c => c.charCodeAt(0)));

}



async function sha256Hex(text) {

  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));

  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');

}



async function hmacSignature(text, secret) {

  const key = await crypto.subtle.importKey(

    'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']

  );

  return bytesToBase64Url(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(text))));

}



async function ensureFamilyTables(env) {

  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS family_settings (

    setting_key TEXT PRIMARY KEY,

    setting_value TEXT NOT NULL,

    updated_at TEXT NOT NULL

  )`).run();

  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS family_members (

    member_id TEXT PRIMARY KEY,

    display_name TEXT NOT NULL,

    avatar_color TEXT NOT NULL,

    role TEXT NOT NULL DEFAULT 'member',

    active INTEGER NOT NULL DEFAULT 1,

    created_at TEXT NOT NULL,

    updated_at TEXT NOT NULL

  )`).run();

}



async function getFamilySetting(env, key) {

  await ensureFamilyTables(env);

  const row = await env.DB.prepare('SELECT setting_value FROM family_settings WHERE setting_key = ?').bind(key).first();

  return row?.setting_value || null;

}



async function setFamilySetting(env, key, value) {

  await ensureFamilyTables(env);

  await env.DB.prepare(`INSERT INTO family_settings (setting_key, setting_value, updated_at)

    VALUES (?, ?, ?) ON CONFLICT(setting_key) DO UPDATE SET setting_value=excluded.setting_value, updated_at=excluded.updated_at`)

    .bind(key, value, new Date().toISOString()).run();

}



async function ensureFamilyProfiles(env) {

  await ensureFamilyTables(env);

  const now = new Date().toISOString();

  const memberCount = await env.DB.prepare('SELECT COUNT(*) AS n FROM family_members').first();

  if (!Number(memberCount?.n || 0)) {

    for (const p of FAMILY_PROFILES) {

      await env.DB.prepare(`INSERT OR IGNORE INTO family_members

        (member_id, display_name, avatar_color, role, active, created_at, updated_at)

        VALUES (?, ?, ?, ?, 1, ?, ?)`) 

        .bind(p.key, p.name, p.color, p.role, now, now).run();

    }

  }

  const members = await env.DB.prepare(

    'SELECT member_id, display_name, avatar_color FROM family_members WHERE active = 1'

  ).all();

  for (const p of members.results || []) {

    await env.DB.prepare(`INSERT OR IGNORE INTO users (google_id, display_name, avatar_color, created_at)

      VALUES (?, ?, ?, ?)`) 

      .bind(`family:${p.member_id}`, p.display_name, p.avatar_color, now).run();

  }

  // Shared calendars are created explicitly by their owner. Never recreate a deleted one.

}



async function makeFamilyToken(profileKey, passwordHash) {

  const payload = textToBase64Url(JSON.stringify({

    sub: `family:${profileKey}`,

    profile: profileKey,

    exp: Math.floor(Date.now() / 1000) + 400 * 24 * 60 * 60,

  }));

  return `${payload}.${await hmacSignature(payload, passwordHash)}`;

}



async function makeFamilyUnlockToken(passwordHash) {

  const payload = textToBase64Url(JSON.stringify({

    kind: 'family-unlock',

    exp: Math.floor(Date.now() / 1000) + 10 * 60,

  }));

  return `${payload}.${await hmacSignature(payload, passwordHash)}`;

}



async function verifyFamilyPassword(password, env) {

  if (!password || String(password).length < 4) return null;

  let passwordHash = await getFamilySetting(env, 'password_hash');

  if (!passwordHash) {

    const setupCode = String(env.FAMILY_SETUP_CODE || '');

    if (!setupCode) return null;

    if (String(password) !== setupCode) return null;

    passwordHash = await sha256Hex(String(password));

    await setFamilySetting(env, 'password_hash', passwordHash);

  } else if (await sha256Hex(String(password)) !== passwordHash) {

    return null;

  }

  return passwordHash;

}



async function verifyFamilyToken(token, env) {

  try {

    const [payload, signature] = String(token || '').split('.');

    if (!payload || !signature) return null;

    const passwordHash = await getFamilySetting(env, 'password_hash');

    if (!passwordHash) return null;

    const expected = await hmacSignature(payload, passwordHash);

    if (signature.length !== expected.length) return null;

    let diff = 0;

    for (let i = 0; i < signature.length; i++) diff |= signature.charCodeAt(i) ^ expected.charCodeAt(i);

    if (diff !== 0) return null;

    const data = JSON.parse(base64UrlToText(payload));

    if (!data.exp || data.exp < Math.floor(Date.now() / 1000)) return null;

    if (data.kind === 'family-unlock') {

      return { is_unlock: true, role: 'unlock' };

    }

    if (!data.profile || data.sub !== `family:${data.profile}`) return null;

    await ensureFamilyProfiles(env);

    const profile = await env.DB.prepare(`SELECT member_id, display_name, avatar_color, role

      FROM family_members WHERE member_id = ? AND active = 1`).bind(data.profile).first();

    if (!profile) return null;

    return {

      google_id: data.sub,

      email: null,

      name: profile.display_name,

      profile_key: profile.member_id,

      role: profile.role,

      avatar_color: profile.avatar_color,

    };

  } catch {

    return null;

  }

}



function unfoldIcs(text) {

  return String(text || '').replace(/\r\n[ \t]/g, '').replace(/\r/g, '').split('\n');

}



function unescapeIcs(value) {

  return String(value || '').replace(/\\n/gi, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\');

}



function formatJst(date) {

  const parts = new Intl.DateTimeFormat('en-CA', {

    timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit',

    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'

  }).formatToParts(date).reduce((o, p) => (o[p.type] = p.value, o), {});

  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;

}



function parseIcsDate(raw, params = '') {

  const value = String(raw || '').trim();

  const allDay = /VALUE=DATE/i.test(params) || /^\d{8}$/.test(value);

  if (allDay) return { value: `${value.slice(0,4)}-${value.slice(4,6)}-${value.slice(6,8)}`, allDay: true };

  const m = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/);

  if (!m) return { value, allDay: false };

  if (m[7]) return { value: formatJst(new Date(Date.UTC(+m[1], +m[2]-1, +m[3], +m[4], +m[5], +(m[6] || 0)))), allDay: false };

  return { value: `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}`, allDay: false };

}



function parseRrule(rule, event) {

  const parts = Object.fromEntries(String(rule || '').split(';').map(p => p.split('=')));

  const freq = String(parts.FREQ || '').toLowerCase();

  if (!['daily','weekly','monthly','yearly'].includes(freq)) return event;

  event.recurrence_type = freq;

  event.recurrence_interval = Number(parts.INTERVAL || 1);

  if (parts.COUNT) { event.recurrence_end_type = 'count'; event.recurrence_end_count = Number(parts.COUNT); }

  if (parts.UNTIL) { event.recurrence_end_type = 'date'; event.recurrence_end_date = parseIcsDate(parts.UNTIL).value.slice(0,10); }

  const dayMap = { SU:0, MO:1, TU:2, WE:3, TH:4, FR:5, SA:6 };

  if (freq === 'weekly' && parts.BYDAY) {

    event.recurrence_days = parts.BYDAY.split(',').map(v => dayMap[v.slice(-2)]).filter(v => v !== undefined).join(',');

  }

  if (freq === 'monthly' && parts.BYDAY) {

    const m = parts.BYDAY.split(',')[0].match(/^(-?\d)?(SU|MO|TU|WE|TH|FR|SA)$/);

    if (m) {

      event.recurrence_monthly_type = 'monthly_weekday';

      event.recurrence_week_number = Number(m[1] || 1);

      event.recurrence_weekday = dayMap[m[2]];

    }

  }

  return event;

}



function parseGoogleIcs(text, from, to, sourceIndex = 0) {

  const lines = unfoldIcs(text);

  const rawEvents = [];

  let current = null;

  for (const line of lines) {

    if (line === 'BEGIN:VEVENT') { current = {}; continue; }

    if (line === 'END:VEVENT') { if (current) rawEvents.push(current); current = null; continue; }

    if (!current) continue;

    const colon = line.indexOf(':');

    if (colon < 0) continue;

    const left = line.slice(0, colon), value = line.slice(colon + 1);

    const [name, ...paramParts] = left.split(';');

    const params = paramParts.join(';');

    if (name === 'DTSTART') current.start = parseIcsDate(value, params);

    else if (name === 'DTEND') current.end = parseIcsDate(value, params);

    else if (name === 'SUMMARY') current.title = unescapeIcs(value);

    else if (name === 'DESCRIPTION') current.description = unescapeIcs(value);

    else if (name === 'UID') current.uid = value;

    else if (name === 'RRULE') current.rrule = value;

    else if (name === 'EXDATE') current.exdates = (current.exdates || []).concat(value.split(',').map(v => parseIcsDate(v, params).value.slice(0,10)));

    else if (name === 'STATUS') current.status = value;

  }

  const result = [];

  for (const item of rawEvents) {

    if (!item.start || item.status === 'CANCELLED') continue;

    const start = item.start.value;

    let end = item.end?.value || start;

    // iCalの終日予定のDTENDは「翌日の0時（終了日を含まない）」なので、表示用は1日前に戻す。

    if (item.start.allDay) end = item.end?.value && end > start ? addDays(end, -1) : start;

    let ev = {

      id: `g_${sourceIndex}_${notificationSourceId(item.uid || crypto.randomUUID())}`,

      title: item.title || '（タイトルなし）', description: item.description || '',

      start_datetime: start, end_datetime: end, all_day: item.start.allDay ? 1 : 0,

      calendar_id: '__google__', color: '#1a73e8', is_google: true,

      recurrence_type: 'none', recurrence_exceptions: (item.exdates || []).join(','),

    };

    if (item.rrule) ev = parseRrule(item.rrule, ev);

    for (const instance of expandRecurring(ev, from, to)) {

      const date = String(instance.start_datetime || '').slice(0,10);

      if (date >= from && date <= to) result.push(instance);

    }

  }

  return result;

}



// ══════════════════════════════════════════

// 第N曜日の日付を計算（weekNumber=-1は最終曜日）

// ══════════════════════════════════════════

function getMonthlyWeekdayDate(year, month, weekNumber, weekday) {

  if (weekNumber === -1) {

    // 最終曜日：月末から逆算

    const lastDay = new Date(year, month + 1, 0);

    const diff = (lastDay.getDay() - weekday + 7) % 7;

    return new Date(year, month, lastDay.getDate() - diff);

  } else {

    // 第N曜日

    const first = new Date(year, month, 1);

    const diff = (weekday - first.getDay() + 7) % 7;

    const targetDate = 1 + diff + (weekNumber - 1) * 7;

    const daysInMonth = new Date(year, month + 1, 0).getDate();

    if (targetDate > daysInMonth) return null; // 存在しない月はnull

    return new Date(year, month, targetDate);

  }

}



// ══════════════════════════════════════════

// 繰り返しイベント展開

// ══════════════════════════════════════════

function expandRecurring(event, from, to) {

  const {

    recurrence_type, recurrence_interval, recurrence_days,

    recurrence_end_type, recurrence_end_count, recurrence_end_date,

    recurrence_exceptions, recurrence_monthly_type,

    recurrence_week_number, recurrence_weekday

  } = event;



  if (!recurrence_type || recurrence_type === 'none') return [event];



  const interval = recurrence_interval || 1;

  const fromDate = new Date(from);

  const toDate   = new Date(to);

  const endDate  = recurrence_end_date ? new Date(recurrence_end_date) : null;

  const startDt  = new Date(event.start_datetime);

  const endDt    = new Date(event.end_datetime);

  const duration = endDt - startDt;

  const exceptions = recurrence_exceptions

    ? recurrence_exceptions.split(',').map(s => s.trim()) : [];



  const results = [];

  let count = 0;

  let current = new Date(startDt);

  const MAX = 500;



  while (results.length < MAX) {

    if (endDate && current > endDate) break;

    if (recurrence_end_type === 'count' && recurrence_end_count && count >= recurrence_end_count) break;

    if (current > toDate) break;



    // ── monthly_weekday（第N曜日）──

    if (recurrence_type === 'monthly' && recurrence_monthly_type === 'monthly_weekday') {

      const weekNum = recurrence_week_number ?? 1;

      const weekDay = recurrence_weekday ?? 0;

      const targetDate = getMonthlyWeekdayDate(current.getFullYear(), current.getMonth(), weekNum, weekDay);



      if (targetDate) {

        const targetStr = targetDate.toISOString().slice(0, 10);

        if (!exceptions.includes(targetStr) && targetDate >= fromDate && targetDate <= toDate) {

          const newStart = new Date(targetDate);

          newStart.setHours(startDt.getHours(), startDt.getMinutes(), 0, 0);

          const newEnd = new Date(newStart.getTime() + duration);

          results.push({

            ...event,

            id: event.id + '_' + count,

            start_datetime: newStart.toISOString().slice(0, 16),

            end_datetime:   newEnd.toISOString().slice(0, 16),

            recurrence_parent_id: event.id,

            _is_recurring_instance: true,

          });

        }

        count++;

      }

      current.setMonth(current.getMonth() + interval);

      continue;

    }



    const currentDateStr = current.toISOString().slice(0, 10);

    const isException = exceptions.includes(currentDateStr);



    // ── weekly（曜日フィルタ）──

    if (recurrence_type === 'weekly' && recurrence_days) {

      const days = recurrence_days.split(',').map(Number);

      if (days.includes(current.getDay())) {

        if (current >= fromDate && !isException) {

          const newStart = new Date(current);

          const newEnd   = new Date(current.getTime() + duration);

          results.push({

            ...event,

            id: event.id + '_' + count,

            start_datetime: newStart.toISOString().slice(0, 16),

            end_datetime:   newEnd.toISOString().slice(0, 16),

            recurrence_parent_id: event.id,

            _is_recurring_instance: true,

          });

        }

        count++;

      }

      current.setDate(current.getDate() + 1);

      continue;

    }



    // ── その他（daily / monthly_date / yearly）──

    if (current >= fromDate && !isException) {

      const newStart = new Date(current);

      const newEnd   = new Date(current.getTime() + duration);

      results.push({

        ...event,

        id: event.id + '_' + count,

        start_datetime: newStart.toISOString().slice(0, 16),

        end_datetime:   newEnd.toISOString().slice(0, 16),

        recurrence_parent_id: event.id,

        _is_recurring_instance: true,

      });

      count++;

    } else {

      count++;

    }



    switch (recurrence_type) {

      case 'daily':   current.setDate(current.getDate() + interval); break;

      case 'weekly':  current.setDate(current.getDate() + interval * 7); break;

      case 'monthly': current.setMonth(current.getMonth() + interval); break;

      case 'yearly':  current.setFullYear(current.getFullYear() + interval); break;

      default: return [event];

    }

  }



  if (startDt >= fromDate && startDt <= toDate && !exceptions.includes(event.start_datetime.slice(0,10))) {

    // All-day originals use YYYY-MM-DD; expanded instances use YYYY-MM-DDT00:00.
    // Compare dates for all-day events and minute precision for timed events.
    const already = results.find(r => event.all_day
      ? r.start_datetime.slice(0,10) === event.start_datetime.slice(0,10)
      : r.start_datetime.slice(0,16) === event.start_datetime.slice(0,16));

    if (!already) results.unshift(event);

  }



  return results;

}



// ══════════════════════════════════════════

// 通知センター連携

// ══════════════════════════════════════════



function notificationSourceId(eventId) {

  return String(eventId || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 36);

}



function addDays(dateText, days) {

  const d = new Date(`${dateText}T00:00:00Z`);

  d.setUTCDate(d.getUTCDate() + days);

  return d.toISOString().slice(0, 10);

}



function notificationMoment(startDatetime, minutesBefore) {

  const normalized = String(startDatetime || '').slice(0, 16);

  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(normalized)) return null;

  // カレンダーの日時文字列を「JSTの壁時計」として計算する。

  const d = new Date(`${normalized}:00Z`);

  d.setUTCMinutes(d.getUTCMinutes() - Math.max(0, Number(minutesBefore) || 0));

  return {

    date: d.toISOString().slice(0, 10),

    time: d.toISOString().slice(11, 16),

  };

}



function calendarNotificationPayload(event) {

  const sourceId = notificationSourceId(event.id);

  const notifyBefore = Number(event.notify_before ?? -1);

  const recipient = ['mama', 'child1', 'child2', 'grandpa', 'grandma', 'brother', 'sister', 'all'].includes(event.notification_recipient)

    ? event.notification_recipient : 'all';



  if (!sourceId || event.all_day || notifyBefore < 0) {

    return {

      source_id: sourceId,

      title: event.title || '家族カレンダー',

      body: '',

      recipient,

      url: '/kanriapp/calendar.html',

      occurrences: [],

    };

  }



  const todayJst = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const from = addDays(todayJst, -2);

  let to = addDays(todayJst, 400);

  if (event.recurrence_end_type === 'date' && event.recurrence_end_date) {

    to = event.recurrence_end_date < to ? event.recurrence_end_date : to;

  }



  const instances = expandRecurring(event, from, to);

  const seen = new Set();

  const occurrences = [];

  for (const instance of instances) {

    const moment = notificationMoment(instance.start_datetime, notifyBefore);

    if (!moment) continue;

    const key = `${moment.date} ${moment.time}`;

    if (seen.has(key)) continue;

    seen.add(key);

    occurrences.push(moment);

  }



  const label = notifyBefore === 0

    ? '開始時刻です'

    : `${notifyBefore >= 60 ? `${notifyBefore / 60}時間` : `${notifyBefore}分`}前です`;



  return {

    source_id: sourceId,

    title: `📅 ${event.title || '予定'}`,

    body: label,

    recipient,

    url: '/kanriapp/calendar.html',

    occurrences,

  };

}



async function syncCalendarNotification(env, event) {

  const apiUrl = String(env.NOTIFICATION_API_URL || '').replace(/\/+$/, '');

  const password = env.NOTIFICATION_APP_PASSWORD || '';

  if (!apiUrl || !password || !event || !event.id) {

    return { ok: false, skipped: true, reason: 'notification binding is not configured' };

  }



  const res = await env.NOTIFICATION_API.fetch(`${apiUrl}/api/calendar-sync`, {

    method: 'POST',

    headers: {

      'Content-Type': 'application/json',

      'X-App-Password': password,

    },

    body: JSON.stringify(calendarNotificationPayload(event)),

  });

  if (!res.ok) {

    const detail = await res.text().catch(() => '');

    console.error(`NOTIFICATION_SYNC_FAILED status=${res.status} detail=${detail}`);

    throw new Error(`notification sync failed: ${res.status} ${detail.slice(0, 160)}`);

  }

  return res.json();

}



async function removeCalendarNotification(env, eventId) {

  return syncCalendarNotification(env, {

    id: eventId,

    title: '削除済みの予定',

    all_day: 1,

    notify_before: -1,

    notification_recipient: 'all',

  });

}



export default {

  async fetch(request, env) {

    if (request.method === 'OPTIONS') {

      return new Response(null, { headers: CORS_HEADERS });

    }



    const url = new URL(request.url);

    const path = url.pathname;
    const homeResponse = await homeCalendarGate(request,env,path);
    if(homeResponse)return homeResponse;



    // ── 家族ログイン ─────────────────────────────────────────

    if (path === '/family/status' && request.method === 'GET') {

      const configured = Boolean(await getFamilySetting(env, 'password_hash'));

      return json({ configured });

    }



    if (path === '/family/unlock' && request.method === 'POST') {

      const { password } = await request.json();

      if (!password || String(password).length < 4) return err('合言葉は4文字以上です');

      const passwordHash = await verifyFamilyPassword(password, env);

      if (!passwordHash) return err('合言葉が違います', 401);

      await ensureFamilyProfiles(env);

      return json({ unlock_token: await makeFamilyUnlockToken(passwordHash) });

    }



    if (path === '/family/profiles' && request.method === 'GET') {

      const auth = request.headers.get('Authorization') || '';

      const visitor = auth.startsWith('Bearer ') ? await verifyFamilyToken(auth.slice(7), env) : null;

      if (!visitor) return err('先に家族の合言葉を入力してください', 401);

      await ensureFamilyProfiles(env);

      const rows = await env.DB.prepare(`SELECT member_id AS key, display_name AS name,

        avatar_color AS color, role FROM family_members WHERE active = 1 ORDER BY created_at`).all();

      return json(rows.results || []);

    }



    if (path === '/family/login' && request.method === 'POST') {

      const { profile, password } = await request.json();

      await ensureFamilyProfiles(env);

      const auth = request.headers.get('Authorization') || '';

      let unlocked = auth.startsWith('Bearer ') ? await verifyFamilyToken(auth.slice(7), env) : null;

      let passwordHash = await getFamilySetting(env, 'password_hash');

      // 古い画面との移行中もログインできるよう、合言葉付きの従来形式を残す。

      if (!unlocked?.is_unlock) {

        passwordHash = await verifyFamilyPassword(password, env);

        if (!passwordHash) return err('先に家族の合言葉を入力してください', 401);

      }

      const selected = await env.DB.prepare(`SELECT member_id, display_name, avatar_color, role

        FROM family_members WHERE member_id = ? AND active = 1`).bind(profile).first();

      if (!selected) return err('家族を選んでください');

      const token = await makeFamilyToken(selected.member_id, passwordHash);

      return json({

        token,

        user: {

          google_id: `family:${selected.member_id}`,

          display_name: selected.display_name,

          avatar_color: selected.avatar_color,

          profile_key: selected.member_id,

          role: selected.role,

        },

      });

    }



    if (path === '/family/me' && request.method === 'GET') {

      const user = await getUser(request, env);

      if (!user || !user.profile_key) return err('Unauthorized', 401);

      await ensureFamilyProfiles(env);

      const row = await env.DB.prepare('SELECT google_id, display_name, avatar_color FROM users WHERE google_id = ?')

        .bind(user.google_id).first();

      const profile = await env.DB.prepare(`SELECT member_id, display_name, avatar_color, role

        FROM family_members WHERE member_id = ? AND active = 1`).bind(user.profile_key).first();

      if (!profile) return err('家族アカウントが見つかりません', 404);

      return json({

        ...row,

        display_name: profile.display_name,

        avatar_color: profile.avatar_color,

        profile_key: profile.member_id,

        role: profile.role,

      });

    }



    if (path === '/family/members' && request.method === 'GET') {

      const user = await getUser(request, env);

      if (!user || user.role !== 'admin') return err('管理者だけが家族を管理できます', 403);

      await ensureFamilyProfiles(env);

      const rows = await env.DB.prepare(`SELECT member_id, display_name, avatar_color, role

        FROM family_members WHERE active = 1 ORDER BY created_at`).all();

      return json(rows.results || []);

    }



    if (path === '/family/members' && request.method === 'POST') {

      const user = await getUser(request, env);

      if (!user || user.role !== 'admin') return err('管理者だけが家族を追加できます', 403);

      const body = await request.json();

      const displayName = String(body.display_name || '').trim().slice(0, 30);

      const avatarColor = /^#[0-9a-f]{6}$/i.test(String(body.avatar_color || '')) ? body.avatar_color : '#5b8dee';

      if (!displayName) return err('名前を入力してください');

      const memberId = genId();

      const now = new Date().toISOString();

      await env.DB.prepare(`INSERT INTO family_members

        (member_id, display_name, avatar_color, role, active, created_at, updated_at)

        VALUES (?, ?, ?, 'member', 1, ?, ?)`).bind(memberId, displayName, avatarColor, now, now).run();

      await env.DB.prepare(`INSERT INTO users (google_id, display_name, avatar_color, created_at)

        VALUES (?, ?, ?, ?)`).bind(`family:${memberId}`, displayName, avatarColor, now).run();

      return json({ member_id: memberId, display_name: displayName, avatar_color: avatarColor, role: 'member' }, 201);

    }



    const familyMemberMatch = path.match(/^\/family\/members\/([^/]+)$/);

    if (familyMemberMatch && request.method === 'PUT') {

      const user = await getUser(request, env);

      if (!user || user.role !== 'admin') return err('管理者だけが家族を変更できます', 403);

      const memberId = decodeURIComponent(familyMemberMatch[1]);

      const existing = await env.DB.prepare('SELECT * FROM family_members WHERE member_id = ? AND active = 1').bind(memberId).first();

      if (!existing) return err('家族が見つかりません', 404);

      const body = await request.json();

      const displayName = String(body.display_name || '').trim().slice(0, 30);

      const avatarColor = /^#[0-9a-f]{6}$/i.test(String(body.avatar_color || '')) ? body.avatar_color : existing.avatar_color;

      if (!displayName) return err('名前を入力してください');

      const now = new Date().toISOString();

      await env.DB.prepare(`UPDATE family_members SET display_name = ?, avatar_color = ?, updated_at = ?

        WHERE member_id = ?`).bind(displayName, avatarColor, now, memberId).run();

      await env.DB.prepare('UPDATE users SET display_name = ?, avatar_color = ? WHERE google_id = ?')

        .bind(displayName, avatarColor, `family:${memberId}`).run();

      return json({ member_id: memberId, display_name: displayName, avatar_color: avatarColor, role: existing.role });

    }



    if (familyMemberMatch && request.method === 'DELETE') {

      const user = await getUser(request, env);

      if (!user || user.role !== 'admin') return err('管理者だけが家族を削除できます', 403);

      const memberId = decodeURIComponent(familyMemberMatch[1]);

      if (memberId === user.profile_key) return err('いま使っている自分のアカウントは削除できません');

      const existing = await env.DB.prepare('SELECT role FROM family_members WHERE member_id = ? AND active = 1').bind(memberId).first();

      if (!existing) return err('家族が見つかりません', 404);

      if (existing.role === 'admin') return err('管理者アカウントは削除できません');

      await env.DB.prepare('UPDATE family_members SET active = 0, updated_at = ? WHERE member_id = ?')

        .bind(new Date().toISOString(), memberId).run();

      return json({ ok: true });

    }



    // ── Googleカレンダー（非公開iCal・読み込み専用）──────────

    if (path === '/integrations/google-ics' && request.method === 'GET') {

      const user = await getUser(request, env);

      if (!user) return err('Unauthorized', 401);

      const count = (await privateGoogleUrls(env,user)).length;

      return json({ configured: count > 0, count });

    }



    if (path === '/integrations/google-ics' && request.method === 'POST') {

      const user = await getUser(request, env);

      if (!user || user.role !== 'admin') return err('ママだけが設定できます', 403);

      const body = await request.json();

      const urls = Array.isArray(body.urls) ? body.urls.map(v => String(v).trim()).filter(Boolean) : [];

      if (urls.length > 5) return err('登録できるGoogleカレンダーは5個までです');

      if (urls.some(v => !/^https:\/\/calendar\.google\.com\/calendar\/ical\//i.test(v))) {

        return err('Googleカレンダーの「iCal形式の非公開URL」を貼り付けてください');

      }

      await setFamilySetting(env, 'google_ics_urls:'+user.google_id, JSON.stringify(urls));

      return json({ ok: true, configured: urls.length > 0, count: urls.length });

    }



    if (path === '/google-events' && request.method === 'GET') {

      const user = await getUser(request, env);

      if (!user) return err('Unauthorized', 401);

      const from = url.searchParams.get('from') || new Date().toISOString().slice(0,10);

      const to = url.searchParams.get('to') || addDays(from, 100);

      if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return err('日付の形式が違います');



      const urls = await privateGoogleUrls(env,user);

      const results = [];

      for (let i = 0; i < urls.length; i++) {

        try {

          const response = await fetch(urls[i], { cf: { cacheTtl: 300, cacheEverything: true } });

          if (!response.ok) throw new Error(`HTTP ${response.status}`);

          results.push(...parseGoogleIcs(await response.text(), from, to, i));

        } catch (e) {

          console.error('GOOGLE_ICS_FETCH_FAILED', i, e);

        }

      }



      try {

        const holidayUrl = 'https://calendar.google.com/calendar/ical/ja.japanese%23holiday%40group.v.calendar.google.com/public/basic.ics';

        const response = await fetch(holidayUrl, { cf: { cacheTtl: 21600, cacheEverything: true } });

        if (response.ok) {

          const holidays = parseGoogleIcs(await response.text(), from, to, 999).map(e => ({

            ...e, calendar_id: '__holiday__', color: '#e53935', is_holiday: true,

          }));

          results.push(...holidays);

        }

      } catch (e) {

        console.error('HOLIDAY_ICS_FETCH_FAILED', e);

      }

      results.sort((a, b) => String(a.start_datetime).localeCompare(String(b.start_datetime)));

      return json(results);

    }



    // ── POST /me ──────────────────────────────────────────────

    if (path === '/me' && request.method === 'POST') {

      const user = await getUser(request, env);

      if (!user) return err('Unauthorized', 401);

      const body = await request.json();

      const display_name = body.display_name || user.name || 'ユーザー';

      const avatar_color = body.avatar_color || '#5b8dee';

      const existing = await env.DB.prepare('SELECT * FROM users WHERE google_id = ?').bind(user.google_id).first();

      if (existing) {

        await env.DB.prepare('UPDATE users SET display_name = ? WHERE google_id = ?').bind(display_name, user.google_id).run();

        if (user.profile_key) {

          await env.DB.prepare('UPDATE family_members SET display_name = ?, updated_at = ? WHERE member_id = ?')

            .bind(display_name, new Date().toISOString(), user.profile_key).run();

        }

        return json({ ...existing, display_name, profile_key: user.profile_key || null, role: user.role || null });

      } else {

        const now = new Date().toISOString();

        await env.DB.prepare('INSERT INTO users (google_id, display_name, avatar_color, created_at) VALUES (?, ?, ?, ?)').bind(user.google_id, display_name, avatar_color, now).run();

        return json({ google_id: user.google_id, display_name, avatar_color });

      }

    }



    // ── GET /me ───────────────────────────────────────────────

    if (path === '/me' && request.method === 'GET') {

      const user = await getUser(request, env);

      if (!user) return err('Unauthorized', 401);

      const row = await env.DB.prepare('SELECT * FROM users WHERE google_id = ?').bind(user.google_id).first();

      if (!row) return err('ユーザーが見つかりません', 404);

      return json({ ...row, profile_key: user.profile_key || null, role: user.role || null });

    }



    // ── GET /members ──────────────────────────────────────────

    if (path === '/members' && request.method === 'GET') {

      const user = await getUser(request, env);

      if (!user) return err('Unauthorized', 401);

      const rows = await env.DB.prepare('SELECT google_id, display_name, avatar_color FROM users ORDER BY display_name').all();

      return json(rows.results);

    }



    // ── GET /calendars ────────────────────────────────────────

    if (path === '/calendars' && request.method === 'GET') {

      const user = await getUser(request, env);

      if (!user) return err('Unauthorized', 401);

      const rows = await env.DB.prepare(

        'SELECT * FROM calendars WHERE is_shared = 1 OR owner_google_id = ? ORDER BY is_shared DESC, name'

      ).bind(user.google_id).all();

      return json(rows.results);

    }



    // ── POST /notifications/resync ────────────────────────────

    // 導入前から存在する予定も、通知センターへ一括登録する。

    if (path === '/notifications/resync' && request.method === 'POST') {

      const user = await getUser(request, env);

      if (!user) return err('Unauthorized', 401);

      const rows = await env.DB.prepare(

        `SELECT e.* FROM calendar_events e

         JOIN calendars c ON e.calendar_id = c.id

         WHERE (c.is_shared = 1 OR c.owner_google_id = ?)

           AND (e.recurrence_parent_id IS NULL OR e.recurrence_parent_id = '')`

      ).bind(user.google_id).all();



      let synced = 0;

      const errors = [];

      for (const event of rows.results || []) {

        try {

          await syncCalendarNotification(env, event);

          synced++;

        } catch (e) {

          console.error(e);

          errors.push({ id: event.id, error: String(e.message || e) });

        }

      }

      return json({ ok: errors.length === 0, synced, errors });

    }



    // ── POST /calendars ───────────────────────────────────────

    if (path === '/calendars' && request.method === 'POST') {

      const user = await getUser(request, env);

      if (!user) return err('Unauthorized', 401);

      const body = await request.json();

      const { name, color, is_shared } = body;

      if (!name || !color) return err('name と color は必須です');

      const id = genId();

      const now = new Date().toISOString();

      await env.DB.prepare('INSERT INTO calendars (id, name, color, owner_google_id, is_shared, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind(id, name, color, user.google_id, is_shared ? 1 : 0, now).run();

      return json({ id, name, color, owner_google_id: user.google_id, is_shared });

    }



    // ── DELETE /calendars/:id ─────────────────────────────────

    if (path.startsWith('/calendars/') && path.split('/').length === 3 && request.method === 'DELETE') {

      const user = await getUser(request, env);

      if (!user) return err('Unauthorized', 401);

      const id = path.split('/')[2];

      const cal = await env.DB.prepare('SELECT * FROM calendars WHERE id = ?').bind(id).first();

      if (!cal) return err('カレンダーが見つかりません', 404);

      if (cal.owner_google_id !== user.google_id) return err('削除権限がありません', 403);

      const eventRows = await env.DB.prepare('SELECT id FROM calendar_events WHERE calendar_id = ?').bind(id).all();

      for (const row of eventRows.results || []) {

        try { await removeCalendarNotification(env, row.id); }

        catch (e) { console.error(e); }

      }

      await env.DB.prepare('DELETE FROM calendar_events WHERE calendar_id = ?').bind(id).run();

      await env.DB.prepare('DELETE FROM calendars WHERE id = ?').bind(id).run();

      return json({ ok: true });

    }



    // ── GET /events ───────────────────────────────────────────

    if (path === '/events' && request.method === 'GET') {

      const user = await getUser(request, env);

      if (!user) return err('Unauthorized', 401);

      const from  = url.searchParams.get('from');

      const to    = url.searchParams.get('to');

      const calId = url.searchParams.get('calendar_id');



      let query = `

        SELECT e.*, u.avatar_color as creator_color FROM calendar_events e

        JOIN calendars c ON e.calendar_id = c.id

        LEFT JOIN users u ON e.created_by_google_id = u.google_id

        WHERE (c.is_shared = 1 OR c.owner_google_id = ?)

        AND (e.recurrence_parent_id IS NULL OR e.recurrence_parent_id = '')

      `;

      const params = [user.google_id];

      if (calId) { query += ' AND e.calendar_id = ?'; params.push(calId); }

      query += ' ORDER BY e.start_datetime';



      const rows = await env.DB.prepare(query).bind(...params).all();



      let expanded = [];

      for (const ev of rows.results) {

        const instances = expandRecurring(ev, from || '1900-01-01', to || '2100-12-31');

        for (const inst of instances) {

          const instDate = (inst.start_datetime || '').slice(0, 10);

          if (from && instDate < from) continue;

          if (to   && instDate > to)   continue;

          expanded.push(inst);

        }

      }

      expanded.sort((a, b) => (a.start_datetime || '') < (b.start_datetime || '') ? -1 : 1);

      return json(expanded);

    }



    // ── POST /events ──────────────────────────────────────────

    if (path === '/events' && request.method === 'POST') {

      const user = await getUser(request, env);

      if (!user) return err('Unauthorized', 401);

      const body = await request.json();

      const { title, description, start_datetime, end_datetime, all_day, calendar_id, color,

              notify_before, notification_recipient, recurrence_type, recurrence_interval, recurrence_days,

              recurrence_end_type, recurrence_end_count, recurrence_end_date,

              recurrence_monthly_type, recurrence_week_number, recurrence_weekday,

              list_type, list_items } = body;

      if (!title || !start_datetime || !end_datetime || !calendar_id) {

        return err('title, start_datetime, end_datetime, calendar_id は必須です');

      }

      const cal = await env.DB.prepare('SELECT * FROM calendars WHERE id = ?').bind(calendar_id).first();

      if (!cal) return err('カレンダーが見つかりません', 404);

      if (cal.owner_google_id !== user.google_id) return err('このカレンダーは作成者だけが予定を追加できます', 403);



      const id = genId();

      const now = new Date().toISOString();

      await env.DB.prepare(

        `INSERT INTO calendar_events

         (id, title, description, start_datetime, end_datetime, all_day, calendar_id, color,

          created_by_google_id, notify_before, notification_recipient,

          recurrence_type, recurrence_interval, recurrence_days,

          recurrence_end_type, recurrence_end_count, recurrence_end_date,

          recurrence_monthly_type, recurrence_week_number, recurrence_weekday,

          list_type, list_items, created_at, updated_at)

         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`

      ).bind(

        id, title, description || null, start_datetime, end_datetime, all_day ? 1 : 0,

        calendar_id, color || null, user.google_id, notify_before ?? -1,

        ['mama', 'child1', 'child2', 'grandpa', 'grandma', 'brother', 'sister', 'all'].includes(notification_recipient) ? notification_recipient : 'all',

        recurrence_type || 'none', recurrence_interval || 1, recurrence_days || null,

        recurrence_end_type || 'none', recurrence_end_count || null, recurrence_end_date || null,

        recurrence_monthly_type || 'date', recurrence_week_number ?? null, recurrence_weekday ?? null,

        list_type || null, list_items ? JSON.stringify(list_items) : null,

        now, now

      ).run();

      const created = await env.DB.prepare('SELECT * FROM calendar_events WHERE id = ?').bind(id).first();

      let notification_sync = null;

      try {

        notification_sync = await syncCalendarNotification(env, created);

      } catch (e) {

        console.error(e);

        notification_sync = { ok: false, error: String(e.message || e) };

      }

      return json({ id, title, start_datetime, end_datetime, calendar_id, notification_sync });

    }



    // ── PUT /events/:id ───────────────────────────────────────

    if (path.startsWith('/events/') && request.method === 'PUT') {

      const user = await getUser(request, env);

      if (!user) return err('Unauthorized', 401);

      let id = path.split('/')[2];

      const mode = url.searchParams.get('mode') || 'all';

      const date = url.searchParams.get('date');

      const putMatch = id.match(/^(.+)_\d+$/);

      if (putMatch) id = putMatch[1];



      const ev = await env.DB.prepare(

        'SELECT e.*, c.is_shared, c.owner_google_id as cal_owner FROM calendar_events e JOIN calendars c ON e.calendar_id = c.id WHERE e.id = ?'

      ).bind(id).first();

      if (!ev) return err('予定が見つかりません', 404);

      if (ev.cal_owner !== user.google_id) return err('この予定はカレンダーの作成者だけが編集できます', 403);



      const body = await request.json();

      const { title, description, start_datetime, end_datetime, all_day, calendar_id, color,

              notify_before, notification_recipient, recurrence_type, recurrence_interval, recurrence_days,

              recurrence_end_type, recurrence_end_count, recurrence_end_date,

              recurrence_monthly_type, recurrence_week_number, recurrence_weekday,

              list_type, list_items } = body;

      const now = new Date().toISOString();



      const evOrig = await env.DB.prepare('SELECT * FROM calendar_events WHERE id = ?').bind(id).first();

      const isRecurring = evOrig && evOrig.recurrence_type && evOrig.recurrence_type !== 'none';

      let createdSingleId = null;



      if (isRecurring && mode === 'single' && date) {

        const exceptions = evOrig.recurrence_exceptions

          ? evOrig.recurrence_exceptions.split(',').map(s => s.trim()) : [];

        if (!exceptions.includes(date)) exceptions.push(date);

        await env.DB.prepare('UPDATE calendar_events SET recurrence_exceptions = ? WHERE id = ?')

          .bind(exceptions.join(','), id).run();

        const newId = genId();

        createdSingleId = newId;

        await env.DB.prepare(

          `INSERT INTO calendar_events

           (id, title, description, start_datetime, end_datetime, all_day, calendar_id, color,

            created_by_google_id, notify_before, notification_recipient, recurrence_type,

            list_type, list_items, created_at, updated_at)

           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`

        ).bind(

          newId, title, description || null, start_datetime, end_datetime, all_day ? 1 : 0,

          calendar_id, color || null, user.google_id, notify_before ?? -1,

          ['mama', 'child1', 'child2', 'grandpa', 'grandma', 'brother', 'sister', 'all'].includes(notification_recipient) ? notification_recipient : 'all',

          'none',

          list_type || null, list_items ? JSON.stringify(list_items) : null, now, now

        ).run();

      } else {

        await env.DB.prepare(

          `UPDATE calendar_events SET

           title=?, description=?, start_datetime=?, end_datetime=?, all_day=?,

           calendar_id=?, color=?, notify_before=?, notification_recipient=?,

           recurrence_type=?, recurrence_interval=?, recurrence_days=?,

           recurrence_end_type=?, recurrence_end_count=?, recurrence_end_date=?,

           recurrence_monthly_type=?, recurrence_week_number=?, recurrence_weekday=?,

           list_type=?, list_items=?, updated_at=? WHERE id=?`

        ).bind(

          title, description || null, start_datetime, end_datetime, all_day ? 1 : 0,

          calendar_id, color || null, notify_before ?? -1,

          ['mama', 'child1', 'child2', 'grandpa', 'grandma', 'brother', 'sister', 'all'].includes(notification_recipient) ? notification_recipient : 'all',

          recurrence_type || 'none', recurrence_interval || 1, recurrence_days || null,

          recurrence_end_type || 'none', recurrence_end_count || null, recurrence_end_date || null,

          recurrence_monthly_type || 'date', recurrence_week_number ?? null, recurrence_weekday ?? null,

          list_type || null, list_items ? JSON.stringify(list_items) : null,

          now, id

        ).run();

      }

      const idsToSync = createdSingleId ? [id, createdSingleId] : [id];

      const notification_sync = [];

      for (const syncId of idsToSync) {

        const updatedEvent = await env.DB.prepare('SELECT * FROM calendar_events WHERE id = ?').bind(syncId).first();

        if (!updatedEvent) continue;

        try {

          notification_sync.push(await syncCalendarNotification(env, updatedEvent));

        } catch (e) {

          console.error(e);

          notification_sync.push({ ok: false, source_id: syncId, error: String(e.message || e) });

        }

      }

      return json({ ok: true, notification_sync });

    }



    // ── DELETE /events/:id ────────────────────────────────────

    if (path.startsWith('/events/') && request.method === 'DELETE') {

      const user = await getUser(request, env);

      if (!user) return err('Unauthorized', 401);

      let id = path.split('/')[2];

      const mode = url.searchParams.get('mode') || 'all';

      const date = url.searchParams.get('date');

      const instanceMatch = id.match(/^(.+)_\d+$/);

      if (instanceMatch) id = instanceMatch[1];



      const ev = await env.DB.prepare(

        'SELECT e.*, c.is_shared, c.owner_google_id as cal_owner FROM calendar_events e JOIN calendars c ON e.calendar_id = c.id WHERE e.id = ?'

      ).bind(id).first();

      if (!ev) return err('予定が見つかりません', 404);

      if (ev.cal_owner !== user.google_id) return err('この予定はカレンダーの作成者だけが削除できます', 403);



      const isRecurring = ev.recurrence_type && ev.recurrence_type !== 'none';



      if (!isRecurring || mode === 'all') {

        await env.DB.prepare('DELETE FROM calendar_events WHERE id = ?').bind(id).run();

        try { await removeCalendarNotification(env, id); }

        catch (e) { console.error(e); }

      } else if (mode === 'single' && date) {

        const exceptions = ev.recurrence_exceptions

          ? ev.recurrence_exceptions.split(',').map(s => s.trim()) : [];

        if (!exceptions.includes(date)) exceptions.push(date);

        await env.DB.prepare('UPDATE calendar_events SET recurrence_exceptions = ? WHERE id = ?')

          .bind(exceptions.join(','), id).run();

        const updatedEvent = await env.DB.prepare('SELECT * FROM calendar_events WHERE id = ?').bind(id).first();

        try { await syncCalendarNotification(env, updatedEvent); }

        catch (e) { console.error(e); }

      } else if (mode === 'future' && date) {

        const d = new Date(date);

        d.setDate(d.getDate() - 1);

        await env.DB.prepare('UPDATE calendar_events SET recurrence_end_type = ?, recurrence_end_date = ? WHERE id = ?')

          .bind('date', d.toISOString().slice(0, 10), id).run();

        const updatedEvent = await env.DB.prepare('SELECT * FROM calendar_events WHERE id = ?').bind(id).first();

        try { await syncCalendarNotification(env, updatedEvent); }

        catch (e) { console.error(e); }

      }

      return json({ ok: true });

    }



    // ══════════════════════════════════════════════════════════

    // からだカレンダー API  /karada/*

    // ══════════════════════════════════════════════════════════



    async function sha256hex(text) {

      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));

      return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');

    }



    async function getKaradaUser(request) {

      const auth = request.headers.get('Authorization') || '';

      if (!auth.startsWith('Bearer ')) return null;

      try {

        const [userId, username, role] = atob(auth.slice(7)).split(':');

        const user = await env.DB.prepare(

          'SELECT id, username, display_name, role FROM period_users WHERE id = ? AND username = ?'

        ).bind(Number(userId), username).first();

        return user || null;

      } catch { return null; }

    }



    if (path === '/karada/setup' && request.method === 'POST') {

      const { username, password } = await request.json();

      if (!username || !password) return err('username/password required');

      const user = await env.DB.prepare('SELECT id, password_hash FROM period_users WHERE username = ?').bind(username).first();

      if (!user) return err('user not found', 404);

      if (user.password_hash !== 'CHANGE_ME') return err('already set', 409);

      await env.DB.prepare('UPDATE period_users SET password_hash = ? WHERE id = ?').bind(await sha256hex(password), user.id).run();

      return json({ ok: true });

    }



    if (path === '/karada/login' && request.method === 'POST') {

      const { username, password } = await request.json();

      if (!username || !password) return err('username/password required');

      const user = await env.DB.prepare(

        'SELECT id, username, display_name, role FROM period_users WHERE username = ? AND password_hash = ?'

      ).bind(username, await sha256hex(password)).first();

      if (!user) return err('ユーザー名またはパスワードが違います', 401);

      const token = btoa(`${user.id}:${user.username}:${user.role}`);

      return json({ token, user: { id: user.id, username: user.username, displayName: user.display_name, role: user.role } });

    }



    if (path === '/karada/me' && request.method === 'GET') {

      const ku = await getKaradaUser(request);

      if (!ku) return err('unauthorized', 401);

      return json({ id: ku.id, username: ku.username, displayName: ku.display_name, role: ku.role });

    }



    if (path === '/karada/records' && request.method === 'GET') {

      const ku = await getKaradaUser(request);

      if (!ku) return err('unauthorized', 401);

      const targetId = url.searchParams.get('userId');

      const qId = (ku.role === 'mama' && targetId) ? Number(targetId) : ku.id;

      const { results } = await env.DB.prepare('SELECT * FROM period_records WHERE user_id = ? ORDER BY start_date DESC LIMIT 24').bind(qId).all();

      return json(results);

    }



    if (path === '/karada/records' && request.method === 'POST') {

      const ku = await getKaradaUser(request);

      if (!ku) return err('unauthorized', 401);

      const { start_date, end_date, flow_level, pain_level, mood, memo } = await request.json();

      if (!start_date) return err('start_date required');

      const { meta } = await env.DB.prepare(

        `INSERT INTO period_records (user_id, start_date, end_date, flow_level, pain_level, mood, memo) VALUES (?, ?, ?, ?, ?, ?, ?)`

      ).bind(ku.id, start_date, end_date||null, flow_level||null, pain_level||null, mood||null, memo||null).run();

      return json({ id: meta.last_row_id }, 201);

    }



    if (path.match(/^\/karada\/records\/\d+$/) && request.method === 'PUT') {

      const ku = await getKaradaUser(request);

      if (!ku) return err('unauthorized', 401);

      const recId = Number(path.split('/')[3]);

      const rec = await env.DB.prepare('SELECT user_id FROM period_records WHERE id = ?').bind(recId).first();

      if (!rec) return err('not found', 404);

      if (rec.user_id !== ku.id && ku.role !== 'mama') return err('forbidden', 403);

      const { start_date, end_date, flow_level, pain_level, mood, memo } = await request.json();

      await env.DB.prepare(

        `UPDATE period_records SET start_date=?, end_date=?, flow_level=?, pain_level=?, mood=?, memo=?, updated_at=datetime('now') WHERE id=?`

      ).bind(start_date, end_date||null, flow_level||null, pain_level||null, mood||null, memo||null, recId).run();

      return json({ ok: true });

    }



    if (path.match(/^\/karada\/records\/\d+$/) && request.method === 'DELETE') {

      const ku = await getKaradaUser(request);

      if (!ku) return err('unauthorized', 401);

      const recId = Number(path.split('/')[3]);

      const rec = await env.DB.prepare('SELECT user_id FROM period_records WHERE id = ?').bind(recId).first();

      if (!rec) return err('not found', 404);

      if (rec.user_id !== ku.id && ku.role !== 'mama') return err('forbidden', 403);

      await env.DB.prepare('DELETE FROM period_records WHERE id = ?').bind(recId).run();

      return json({ ok: true });

    }



    if (path === '/karada/predict' && request.method === 'GET') {

      const ku = await getKaradaUser(request);

      if (!ku) return err('unauthorized', 401);

      const targetId = url.searchParams.get('userId');

      const qId = (ku.role === 'mama' && targetId) ? Number(targetId) : ku.id;

      const { results } = await env.DB.prepare(

        'SELECT start_date, end_date FROM period_records WHERE user_id = ? AND end_date IS NOT NULL ORDER BY start_date DESC LIMIT 12'

      ).bind(qId).all();

      if (!results.length) return json({ hasData: false });

      const cycles = [], durations = [];

      for (let i = 0; i < results.length; i++) {

        const s = new Date(results[i].start_date), e = new Date(results[i].end_date);

        durations.push(Math.round((e - s) / 86400000) + 1);

        if (i < results.length - 1) cycles.push(Math.round((s - new Date(results[i+1].start_date)) / 86400000));

      }

      const avgCycle    = cycles.length ? Math.round(cycles.reduce((a,b)=>a+b,0)/cycles.length) : 28;

      const avgDuration = Math.round(durations.reduce((a,b)=>a+b,0)/durations.length);

      const lastStart   = new Date(results[0].start_date);

      const today2      = new Date();

      const daysSince   = Math.round((today2 - lastStart) / 86400000);

      const nextStart   = new Date(lastStart); nextStart.setDate(nextStart.getDate() + avgCycle);

      const nextEnd     = new Date(nextStart);  nextEnd.setDate(nextEnd.getDate() + avgDuration - 1);

      const warnStart   = new Date(nextStart);  warnStart.setDate(warnStart.getDate() - 3);

      const warnEnd     = new Date(nextEnd);    warnEnd.setDate(warnEnd.getDate() + 3);

      const ovulation   = new Date(nextStart);  ovulation.setDate(ovulation.getDate() - 14);

      const fmt = d => d.toISOString().slice(0,10);

      return json({

        hasData: true, lastStart: fmt(lastStart), avgCycle, avgDuration, daysSince,

        nextStart: fmt(nextStart), nextEnd: fmt(nextEnd),

        warningStart: fmt(warnStart), warningEnd: fmt(warnEnd),

        ovulation: fmt(ovulation),

        irregular: cycles.length >= 2 && Math.max(...cycles) - Math.min(...cycles) > 7,

        delayed: daysSince > avgCycle + 7,

      });

    }



    if (path === '/karada/requests' && request.method === 'POST') {

      const ku = await getKaradaUser(request);

      if (!ku) return err('unauthorized', 401);

      const { day_pad, night_pad, heavy_pad, liner, painkiller, memo, urgency } = await request.json();

      const { meta } = await env.DB.prepare(

        `INSERT INTO period_requests (user_id, day_pad, night_pad, heavy_pad, liner, painkiller, memo, urgency) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`

      ).bind(ku.id, day_pad||0, night_pad||0, heavy_pad||0, liner||0, painkiller||0, memo||'', urgency||'sometime').run();

      return json({ id: meta.last_row_id }, 201);

    }



    if (path === '/karada/requests' && request.method === 'GET') {

      const ku = await getKaradaUser(request);

      if (!ku || ku.role !== 'mama') return err('forbidden', 403);

      const { results } = await env.DB.prepare(

        `SELECT r.*, u.display_name FROM period_requests r JOIN period_users u ON r.user_id = u.id ORDER BY r.created_at DESC LIMIT 50`

      ).all();

      return json(results);

    }



    if (path.match(/^\/karada\/requests\/\d+\/read$/) && request.method === 'PUT') {

      const ku = await getKaradaUser(request);

      if (!ku || ku.role !== 'mama') return err('forbidden', 403);

      const reqId = Number(path.split('/')[3]);

      await env.DB.prepare('UPDATE period_requests SET is_read = 1 WHERE id = ?').bind(reqId).run();

      return json({ ok: true });

    }



    if (path === '/karada/inventory' && request.method === 'GET') {

      const ku = await getKaradaUser(request);

      if (!ku) return err('unauthorized', 401);

      const { results } = await env.DB.prepare('SELECT * FROM period_inventory ORDER BY id').all();

      return json(results);

    }



    if (path === '/karada/inventory' && request.method === 'PUT') {

      const ku = await getKaradaUser(request);

      if (!ku || ku.role !== 'mama') return err('forbidden', 403);

      const updates = await request.json();

      await env.DB.batch(

        updates.map(({ item_key, quantity }) =>

          env.DB.prepare(`UPDATE period_inventory SET quantity=?, updated_at=datetime('now') WHERE item_key=?`).bind(Number(quantity), item_key)

        )

      );

      return json({ ok: true });

    }



    if (path === '/karada/favorites' && request.method === 'GET') {

      const ku = await getKaradaUser(request);

      if (!ku) return err('unauthorized', 401);

      const { results } = await env.DB.prepare('SELECT * FROM period_favorites WHERE user_id = ? ORDER BY created_at DESC').bind(ku.id).all();

      return json(results);

    }



    if (path === '/karada/favorites' && request.method === 'POST') {

      const ku = await getKaradaUser(request);

      if (!ku) return err('unauthorized', 401);

      const { memo } = await request.json();

      if (!memo?.trim()) return err('memo required');

      const { meta } = await env.DB.prepare('INSERT INTO period_favorites (user_id, memo) VALUES (?, ?)').bind(ku.id, memo.trim()).run();

      return json({ id: meta.last_row_id }, 201);

    }



    if (path.match(/^\/karada\/favorites\/\d+$/) && request.method === 'DELETE') {

      const ku = await getKaradaUser(request);

      if (!ku) return err('unauthorized', 401);

      const favId = Number(path.split('/')[3]);

      const fav = await env.DB.prepare('SELECT user_id FROM period_favorites WHERE id = ?').bind(favId).first();

      if (!fav) return err('not found', 404);

      if (fav.user_id !== ku.id && ku.role !== 'mama') return err('forbidden', 403);

      await env.DB.prepare('DELETE FROM period_favorites WHERE id = ?').bind(favId).run();

      return json({ ok: true });

    }



    if (path === '/karada/users' && request.method === 'GET') {

      const ku = await getKaradaUser(request);

      if (!ku || ku.role !== 'mama') return err('forbidden', 403);

      const { results } = await env.DB.prepare('SELECT id, username, display_name, role FROM period_users').all();

      return json(results);

    }



    return err('Not Found', 404);

  }

};

// HOME verifies its revocable session on every calendar request. No client-selected identity.
const homeCalendarContexts = new WeakMap();
async function ensureHomeCalendarTables(env) {
  await ensureFamilyTables(env);
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS home_calendar_config (id INTEGER PRIMARY KEY CHECK(id=1), household_id TEXT NOT NULL)').run();
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS home_calendar_links (home_user_id TEXT PRIMARY KEY, member_id TEXT NOT NULL UNIQUE REFERENCES family_members(member_id), household_id TEXT NOT NULL, created_at TEXT NOT NULL)').run();
}
async function homeCalendarIdentity(request, env, group) {
  if (!env.HOME_AUTH) return null;
  const cookie = request.headers.get('Cookie');
  if (!cookie) return null;
  const url = new URL('https://home-worker.sslowdayss.workers.dev/api/calendar/identity');
  if (group) url.searchParams.set('group', group);
  const response = await env.HOME_AUTH.fetch(new Request(url,{headers:{Cookie:cookie}}));
  return response.ok ? response.json() : null;
}
async function getHomeCalendarUser(request, env) {
  const context = homeCalendarContexts.get(request);
  if (!context?.identity || !context.bound) return null;
  const profile = await env.DB.prepare('SELECT f.* FROM home_calendar_links l JOIN family_members f ON f.member_id=l.member_id WHERE l.home_user_id=? AND l.household_id=? AND f.active=1').bind(context.identity.user.id,context.bound).first();
  return profile ? {google_id:'family:'+profile.member_id,profile_key:profile.member_id,name:profile.display_name,avatar_color:profile.avatar_color,role:profile.role} : null;
}
async function homeCalendarGate(request, env, path) {
  // Karada remains on its existing authentication during this separate migration.
  if (path.startsWith('/karada/')) return null;
  await ensureHomeCalendarTables(env);
  const bound = (await env.DB.prepare('SELECT household_id FROM home_calendar_config WHERE id=1').first())?.household_id;
  const marked = request.headers.get('X-Home-Calendar') === '1';
  if (!marked) return bound ? err('HOMEからログインしてカレンダーを開いてください',401) : null;
  if (!env.HOME_AUTH) return err('CloudflareでHOME_AUTHをhome-workerへ接続してください',503);
  if (!['GET','HEAD'].includes(request.method) && !['https://cetus.fun','https://home-worker.sslowdayss.workers.dev'].includes(request.headers.get('Origin'))) return err('HOMEから操作してください',403);
  const identity = await homeCalendarIdentity(request,env,bound || new URL(request.url).searchParams.get('group'));
  if (!identity) return err('HOMEにログインしてください',401);
  homeCalendarContexts.set(request,{identity,bound});
  if (path === '/home/status' && request.method === 'GET') {
    const profile = await getHomeCalendarUser(request,env);
    const profiles = identity.admin ? (await env.DB.prepare('SELECT member_id,display_name,role FROM family_members WHERE active=1 ORDER BY created_at').all()).results : [];
    const links = identity.admin ? (await env.DB.prepare('SELECT home_user_id,member_id FROM home_calendar_links').all()).results : [];
    return json({privacy_version:'20261005-owner-ics',user:identity.user,admin:identity.admin,groups:identity.groups,users:identity.users,household_id:bound||null,profile,profiles,links});
  }
  if (path === '/home/link' && request.method === 'POST') {
    if (!identity.admin) return err('HOME管理者だけが連携を設定できます',403);
    const data = await request.json();
    const group = bound || data.group_id;
    if (typeof group !== 'string') return err('連携する家庭を選んでください');
    const scoped = await homeCalendarIdentity(request,env,group);
    if (!scoped?.admin) return err('この家庭の連携は設定できません',403);
    const target = scoped.users.find(u=>u.id===data.home_user_id);
    if (!target) return err('この家庭に登録されたHOME利用者を選んでください',403);
    const existing = await env.DB.prepare('SELECT member_id FROM home_calendar_links WHERE home_user_id=?').bind(target.id).first();
    if (existing) return err('このHOME利用者は連携済みです。予定の所有者は変更していません',409);
    let member;
    if (data.create === true) {
      const now=new Date().toISOString();
      const id='home_'+target.id;
      member={member_id:id,display_name:target.display_name,avatar_color:'#5b9a82',role:target.platform_role==='operator'?'admin':'member'};
      // Atomic: configuration, identity and link are created together. Existing calendars/events untouched.
      try { await env.DB.batch([
        env.DB.prepare('INSERT INTO home_calendar_config(id,household_id) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET household_id=CASE WHEN home_calendar_config.household_id=excluded.household_id THEN home_calendar_config.household_id ELSE NULL END').bind(group),
        env.DB.prepare('INSERT INTO family_members(member_id,display_name,avatar_color,role,active,created_at,updated_at) VALUES(?,?,?,?,1,?,?)').bind(id,member.display_name,member.avatar_color,member.role,now,now),
        env.DB.prepare('INSERT INTO users(google_id,display_name,avatar_color,created_at) VALUES(?,?,?,?)').bind('family:'+id,member.display_name,member.avatar_color,now),
        env.DB.prepare('INSERT INTO home_calendar_links(home_user_id,member_id,household_id,created_at) VALUES(?,?,?,?)').bind(target.id,id,group,now)
      ]); } catch {return err('連携が重なったか、登録済みです。画面を更新してください',409);}
    } else {
      member=await env.DB.prepare('SELECT * FROM family_members WHERE member_id=? AND active=1').bind(String(data.member_id||'')).first();
      if (!member) return err('既存のカレンダー本人を選んでください');
      if (member.role==='admin' && target.platform_role!=='operator') return err('カレンダー管理者はHOME管理者にだけ連携できます',403);
      const taken=await env.DB.prepare('SELECT 1 FROM home_calendar_links WHERE member_id=?').bind(member.member_id).first();
      if (taken) return err('このカレンダー本人は別のHOME利用者に連携済みです',409);
      try {await env.DB.batch([
        env.DB.prepare('INSERT INTO home_calendar_config(id,household_id) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET household_id=CASE WHEN home_calendar_config.household_id=excluded.household_id THEN home_calendar_config.household_id ELSE NULL END').bind(group),
        env.DB.prepare('INSERT INTO home_calendar_links(home_user_id,member_id,household_id,created_at) VALUES(?,?,?,?)').bind(target.id,member.member_id,group,new Date().toISOString())
      ]);} catch {return err('連携が重なりました。画面を更新してください',409);}
    }
    // The database is dedicated to one household. Check after concurrent first setup too.
    return json({ok:true,member_id:member.member_id});
  }
  if(path==='/home/remove-initial-calendar' && request.method==='POST')return retireInitialFamilyCalendar(request,env);
  if (path.startsWith('/home/') || path === '/family/login' || path === '/family/unlock') return err('HOMEの本人認証を利用してください',403);
  if (!await getHomeCalendarUser(request,env)) return err('カレンダーの本人連携が未設定です。HOME管理者に設定してもらってください',409);
  return null;
}

async function privateGoogleUrls(env,user) {
  // Existing family-wide ICS URLs belonged to the original mama account.
  // Keep them readable only by that stable legacy owner ID, not by every admin.
  let stored=await getFamilySetting(env,'google_ics_urls:'+user.google_id);
  if(stored===null){
    const legacyOwner=await getFamilySetting(env,'google_ics_legacy_owner')||'family:mama';
    if(user.google_id===legacyOwner)stored=await getFamilySetting(env,'google_ics_urls');
  }
  try {const urls=JSON.parse(stored||'[]');return Array.isArray(urls)?urls.filter(v=>typeof v==='string'):[];}catch{return [];}
}
async function retireInitialFamilyCalendar(request,env) {
  const context=homeCalendarContexts.get(request),user=await getHomeCalendarUser(request,env);
  if(!context?.identity.admin || user?.google_id!=='family:mama')return err('この初期カレンダーはママ本人だけが削除できます',403);
  // One explicitly identified legacy resource, not a name/color match or a bulk deletion.
  const targetId='a3369575-a3ca-4c20-b9df-c468c836202c';
  const marker='retired_calendar:'+targetId;
  if(await getFamilySetting(env,marker))return json({ok:true,removed:false,completed:true});
  const target=await env.DB.prepare('SELECT * FROM calendars WHERE id=?').bind(targetId).first();
  if(!target)return json({ok:true,removed:false,completed:false,reason:'target_not_found'});
  if(Number(target.is_shared)!==1)return err('指定された旧共通カレンダーの共有設定が変わっています。削除していません',409);
  const candidates=[target];
  const calendar=candidates[0],events=(await env.DB.prepare('SELECT * FROM calendar_events WHERE calendar_id=?').bind(calendar.id).all()).results,now=new Date().toISOString();
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS home_calendar_retired (kind TEXT NOT NULL,record_id TEXT NOT NULL,calendar_id TEXT NOT NULL,row_json TEXT NOT NULL,retired_by TEXT NOT NULL,retired_at TEXT NOT NULL,PRIMARY KEY(kind,record_id))').run();
  try {await env.DB.batch([
    env.DB.prepare('INSERT INTO home_calendar_retired VALUES(?,?,?,?,?,?)').bind('calendar',calendar.id,calendar.id,JSON.stringify(calendar),user.google_id,now),
    ...events.map(event=>env.DB.prepare('INSERT INTO home_calendar_retired VALUES(?,?,?,?,?,?)').bind('event',event.id,calendar.id,JSON.stringify(event),user.google_id,now)),
    env.DB.prepare('DELETE FROM calendar_events WHERE calendar_id=?').bind(calendar.id),
    env.DB.prepare('DELETE FROM calendars WHERE id=? AND owner_google_id=?').bind(calendar.id,calendar.owner_google_id),
    env.DB.prepare('INSERT INTO family_settings(setting_key,setting_value,updated_at) VALUES(?,?,?)').bind(marker,now,now)
  ]);}catch{
    if(await getFamilySetting(env,marker))return json({ok:true,removed:false,completed:true});
    return err('バックアップを保存できなかったため、初期カレンダーは削除していません',409);
  }
  for(const event of events)try{await removeCalendarNotification(env,event.id);}catch{console.error('INITIAL_CALENDAR_NOTIFICATION_CLEANUP_FAILED');}
  return json({ok:true,removed:true,calendar_id:calendar.id,backed_up_events:events.length,completed:true});
}
