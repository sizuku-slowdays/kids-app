const targets = {
  homework: { label: '宿題・学校じゅんび', path: '/apps/school-prep/', grant: 'school-prep', reminder: true },
  medicine: { label: '1分お薬タイマー', path: '/kids-app/medicine-game.html', grant: '', reminder: true },
  food: { label: 'からだパワー', path: '/karada_power/', grant: '', reminder: false },
  kuku: { label: '九九', path: '/kids-app/kuku-app-v3.html', grant: '', reminder: false },
  bedtime: { label: '寝る準備', path: '', grant: '', reminder: true },
  deeds: { label: 'いいことポイント', path: '/apps/good-deeds/', grant: 'good-deeds', reminder: false },
  mental: { label: 'おはじき暗算', path: '/wagaya/keisan/ohajiki-anzan.html', grant: '', reminder: false },
  words: { label: 'ことばクイズ', path: '/kids-app/kotoba-quiz.html', grant: '', reminder: false },
  five: { label: '5問チャレンジ', path: '/wagaya/keisan/5mon-challenge.html', grant: '', reminder: false },
} as const;
type Target = keyof typeof targets;
const characters = {
  chick: { name: 'ぴよまる', faces: ['🐣','🐥'], calls: ['ねえねえ！','ぴよっとおさそい！'], cheers: ['やった、羽がパタパタ！','さすが！ぴよ丸ダンスだ！'] },
  ogre: { name: 'ぷんすけ', faces: ['👹','👺','💢👹','♨️👹'], calls: ['おーい！','むむっ、気になってきたぞ！'], cheers: ['やったー！湯気が消えたぞ！','すごいぞ！鬼の拍手だ！'] },
  cloud: { name: 'ねむりぐも', faces: ['☁️','🌙'], calls: ['ふわぁ……','お月さまも見てるよ。'], cheers: ['よくできました。ふわふわ毛布をどうぞ。','えらいね。いい夢みられそう。'] },
  slime: { name: 'ぷるりん', faces: ['🟢','🫧'], calls: ['ぷるぷるっ！','ぷるんと登場！'], cheers: ['よっしゃ、うれしくてぷるぷる！','教えてくれてありがとう！'] },
} as const;
type Character = keyof typeof characters;
const prompts: Record<Target, readonly string[]> = {
  homework: ['宿題おわった〜？', 'できたら教えてね。'],
  medicine: ['1分タイマー、いっしょにやろう！', 'タイマーの時間だよ。準備できた？'],
  food: ['今日の給食、何がおいしかった？', 'からだパワー、見に行こうよ〜！'],
  kuku: ['九九であそぼうよ〜！', 'どの段で勝負する？'],
  bedtime: ['もうすぐおしまい。続きは明日のお楽しみ。', 'セーブした？そろそろ寝る準備だよ。'],
  deeds: ['今日だれかにやさしくした？', '今日のいいこと、聞きたいな。'],
  mental: ['暗算で勝負しよう！', 'おはじきで何問できるかな？'],
  words: ['ことばクイズしない？', 'おもしろい言葉を見つけよう！'],
  five: ['5問だけ挑戦しよう！', 'どこまでできるかな？'],
};
const ogreLines = [
  ['宿題おわった〜？ できたら教えてくれ〜！','ねぇねぇ、宿題の報告を待ってるぞ〜！'],
  ['おーい、まだ報告がないぞ〜！？','ぷんすけ、報告待ちでそわそわしてるぞ。'],
  ['こら〜、鬼の眉毛が逆立ってきたぞ〜！','むむむ、報告を待ちすぎて太鼓たたいちゃうぞ！'],
  ['ママよぶよ〜！ ……という演技だぞ。湯気がでてきた！','ぷしゅー！ 頭から湯気がでたぞ。できたら教えてな。'],
];
export function osekkaiMessage(target: Target, character: Character, phase: number, seed: number, done = false, challenge = '', medication = false) {
  const actor = characters[character], variant = seed % 2;
  const face = done ? '🎉'+actor.faces[0] : actor.faces[Math.min(phase, actor.faces.length - 1)];
  const text = done ? actor.cheers[variant]
    : target === 'homework' && character === 'ogre' ? ogreLines[Math.min(phase, 3)][variant]
    : medication ? actor.calls[variant] + ' お薬を飲んだことを確認できたら、教えてね。'
    : actor.calls[variant] + ' ' + prompts[target][variant] + (challenge ? ' 今日のお題は「' + challenge + '」。' : '');
  return { name: actor.name, face, text, reply: !done && target === 'homework' && phase === 3
    ? { name: characters.chick.name, face: '🐣', text: 'ぷんすけ、湯気でお茶がわきそうだよ。' } : null };
}

type Rule = {
 id: string; household_id: string; recipient_id: string; target: Target; character: Character;
 time: string; weekdays: string; interval_min: number; retries: number; intensity: number; enabled: number;
 confirmation: string; challenge: string; guardian_id: string | null;
};
type Event = Rule & { event_id: string; day: string; is_test: number; status: string; sequence: number; next_at: number | null; deleted: number };
type Grant = (user: string, app: string) => Promise<boolean>;
const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'private, no-store' } });
const denied = () => json({ error: 'この通知は見られません。通知を受け取ったアカウントで開いてください。' }, 404);
const token = /^[a-z0-9-]{36}$/;
const jst = (now: number) => new Date((now + 32400) * 1000).toISOString();
const seconds = () => Math.floor(Date.now() / 1000);
const query = 'SELECT r.id,r.household_id,r.recipient_id,r.time,r.weekdays,r.interval_min,r.retries,r.intensity,r.enabled,e.target,e.character,e.confirmation,e.challenge,e.id event_id,e.day,e.status,e.is_test,e.sequence,e.next_at,r.deleted,r.guardian_id FROM home_osekkai_events e JOIN home_osekkai_rules r ON r.id=e.rule_id';
const members = `FROM memberships m JOIN groups g ON g.id=m.group_id AND g.kind='household'
 JOIN users u ON u.id=m.user_id AND u.active=1
 LEFT JOIN children c ON c.user_id=m.user_id AND c.household_id=m.group_id
 LEFT JOIN home_member_attributes a ON a.user_id=m.user_id AND a.group_id=m.group_id`;
const child = "(c.user_id IS NOT NULL OR a.age_kind='child')";
const guardian = `m.role IN ('owner','admin') AND NOT EXISTS(SELECT 1 FROM children WHERE user_id=m.user_id)
 AND NOT EXISTS(SELECT 1 FROM home_member_attributes WHERE user_id=m.user_id AND age_kind='child')`;

async function eligible(db: D1Database, user: string, household: string, asChild: boolean) {
  return !!await db.prepare(`SELECT 1 ${members} WHERE m.user_id=? AND m.group_id=? AND ${asChild ? child : guardian}`).bind(user, household).first();
}
async function targetAllowed(rule: Pick<Rule,'target'|'recipient_id'>, grant: Grant) {
  const id = targets[rule.target].grant;
  return !id || await grant(rule.recipient_id, id);
}
function integer(value: unknown, min: number, max: number) {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}
function validate(value: Record<string, unknown>) {
  const target = String(value.target), actor = String(value.character), weekdays = value.weekdays;
  return Object.hasOwn(targets, target) && Object.hasOwn(characters, actor)
    && /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value.time))
    && Array.isArray(weekdays) && weekdays.length > 0 && weekdays.length <= 7 && new Set(weekdays).size === weekdays.length
    && weekdays.every(x => integer(x, 0, 6)) && integer(value.interval_min, 10, 120)
    && integer(value.retries, 0, 3) && integer(value.intensity, 0, 2)
    && typeof value.enabled === 'boolean' && (value.notify_guardian===undefined || typeof value.notify_guardian==='boolean')
    && (value.notify_guardian!==true || target==='homework')
    && (value.confirmation === 'report' || value.confirmation === 'medication' && target === 'medicine')
    && typeof value.challenge === 'string' && value.challenge.length <= 30
    && (['mental','five','kuku','words'].includes(target) || value.challenge === '');
}
function publicEvent(event: Event) {
  return { character: event.character, id: event.event_id, day: event.day, target: event.target, label: targets[event.target].label, status: event.status,
    test: !!event.is_test, medication: event.confirmation === 'medication',
    canOpen: !!targets[event.target].path, canDecline: !targets[event.target].reminder,
    ...osekkaiMessage(event.target, event.character, Math.max(0, event.sequence - 1),
      Number(event.day.slice(-2)) + Math.max(0,event.sequence-1), event.status === 'done', event.challenge, event.confirmation === 'medication'),
  };
}
const limits = [0,1,3];
async function queue(db: D1Database, e: Event, now: number) {
  const id = e.event_id + '-' + e.sequence;
  const next = !e.is_test && e.sequence < Math.min(e.retries,limits[e.intensity]) ? now+e.interval_min*60 : null;
  const escalation = !next && !e.is_test && e.target==='homework' && e.guardian_id ? now+e.interval_min*60 : null;
  // The insert and consumption share a transaction. A competing tick cannot consume the same occurrence.
  await db.batch([
    db.prepare(`INSERT OR IGNORE INTO home_osekkai_push(id,event_id,recipient_id,bucket,day,created_at)
     SELECT ?,e.id,r.recipient_id,?,?,? FROM home_osekkai_events e JOIN home_osekkai_rules r ON r.id=e.rule_id
     WHERE e.id=? AND e.status='open' AND e.next_at<=? AND e.next_at>? AND e.sequence=? AND r.deleted=0 AND (r.enabled=1 OR e.is_test=1)
     AND (SELECT COUNT(*) FROM home_osekkai_push WHERE recipient_id=r.recipient_id AND day=?)<6
     AND NOT EXISTS(SELECT 1 FROM home_osekkai_push WHERE recipient_id=r.recipient_id AND created_at>?)`)
     .bind(id, Math.floor(now/600), e.day, now, e.event_id, now, now-(e.target==='bedtime'?240:900), e.sequence, e.day, now-600),
    db.prepare(`UPDATE home_osekkai_events SET sequence=sequence+1,next_at=?,guardian_at=?
     WHERE id=? AND sequence=? AND status='open' AND EXISTS(SELECT 1 FROM home_osekkai_push WHERE id=?)`)
     .bind(next,escalation,e.event_id,e.sequence,id),
  ]);
}
async function materialize(db: D1Database, now: number, user?: string) {
  const local = jst(now), day = local.slice(0,10), weekday = new Date(local).getUTCDay();
  const bindings = user ? [local.slice(11,16),weekday,user] : [local.slice(11,16),weekday];
  const rules = (await db.prepare(`SELECT r.* FROM home_osekkai_rules r WHERE r.enabled=1 AND r.deleted=0 AND r.time<=?
   AND EXISTS(SELECT 1 FROM json_each(r.weekdays) WHERE value=?)
   ${user ? 'AND r.recipient_id=?' : ''}
   AND NOT EXISTS(SELECT 1 FROM home_osekkai_events WHERE rule_id=r.id AND day=? AND is_test=0)
   AND NOT EXISTS(SELECT 1 FROM home_osekkai_events e JOIN home_osekkai_rules other ON other.id=e.rule_id
     WHERE e.day=? AND e.target=r.target AND e.status='declined' AND e.is_test=0 AND other.recipient_id=r.recipient_id)
   AND NOT EXISTS(SELECT 1 FROM home_osekkai_events e JOIN home_osekkai_rules other ON other.id=e.rule_id
     WHERE e.day=? AND e.confirmation='medication' AND r.confirmation='medication'
     AND e.status='done' AND e.is_test=0 AND other.recipient_id=r.recipient_id)
   ORDER BY r.time,r.id LIMIT 40`).bind(...bindings,day,day,day).all<Rule>()).results;
  for (const rule of rules) {
    if (!await eligible(db,rule.recipient_id,rule.household_id,true)) continue;
    const due = Date.parse(day+'T'+rule.time+':00+09:00')/1000;
    await db.prepare('INSERT OR IGNORE INTO home_osekkai_events(id,rule_id,day,next_at,created_at,target,character,confirmation,challenge) VALUES(?,?,?,?,?,?,?,?,?)')
      .bind(crypto.randomUUID(),rule.id,day,now-due<1800?due:null,now,rule.target,rule.character,rule.confirmation,rule.challenge).run();
  }
}

export async function osekkaiInternal(request: Request, db: D1Database, grant: Grant) {
  const url = new URL(request.url), now = seconds();
  if (url.hostname !== 'notification-auth.internal') return denied();
  if (url.pathname.endsWith('/tick') && request.method === 'POST') {
    await materialize(db,now);
    const day = jst(now).slice(0,10);
    const due = (await db.prepare(query+" WHERE e.day=? AND e.status='open' AND e.next_at BETWEEN ? AND ? AND r.deleted=0 AND (r.enabled=1 OR e.is_test=1) ORDER BY e.next_at,e.id LIMIT 30").bind(day,now-900,now).all<Event>()).results;
    for (const e of due) {
      if (await eligible(db,e.recipient_id,e.household_id,true) && await targetAllowed(e,grant)) await queue(db,e,now);
      else await db.prepare('UPDATE home_osekkai_events SET next_at=NULL WHERE id=?').bind(e.event_id).run();
    }
    const alerts = (await db.prepare(query+" WHERE e.day=? AND e.status='open' AND e.target='homework' AND e.guardian_at BETWEEN ? AND ? AND r.enabled=1 AND r.deleted=0 AND r.guardian_id IS NOT NULL ORDER BY e.guardian_at,e.id LIMIT 12").bind(day,now-900,now).all<Event>()).results;
    for (const e of alerts) {
      const parent=e.guardian_id!;
      if (!await eligible(db,parent,e.household_id,false) || !await eligible(db,e.recipient_id,e.household_id,true)) continue;
      const id=e.event_id+'-4';
      await db.batch([
        db.prepare(`INSERT OR IGNORE INTO home_osekkai_push(id,event_id,recipient_id,bucket,day,created_at,for_guardian)
         SELECT ?,e.id,r.guardian_id,?,?,?,1 FROM home_osekkai_events e JOIN home_osekkai_rules r ON r.id=e.rule_id
         WHERE e.id=? AND e.status='open' AND e.guardian_at BETWEEN ? AND ? AND r.guardian_id=? AND r.enabled=1 AND r.deleted=0
         AND (SELECT COUNT(*) FROM home_osekkai_push WHERE recipient_id=? AND day=?)<6
         AND NOT EXISTS(SELECT 1 FROM home_osekkai_push WHERE recipient_id=? AND created_at>?)`)
         .bind(id,Math.floor(now/600),day,now,e.event_id,now-900,now,parent,parent,day,parent,now-600),
        db.prepare('UPDATE home_osekkai_events SET guardian_at=NULL WHERE id=? AND EXISTS(SELECT 1 FROM home_osekkai_push WHERE id=?)').bind(e.event_id,id),
      ]);
    }
    const records = await db.prepare('SELECT id FROM home_osekkai_push WHERE delivered IS NULL AND created_at>? ORDER BY created_at LIMIT 8').bind(now-300).all();
    return json({ deliveries: records.results });
  }
  const delivery = url.searchParams.get('delivery') || '';
  if (!/^[a-f0-9-]{36}-[0-4]$/.test(delivery)) return denied();
  if (url.pathname.endsWith('/result') && request.method === 'POST') {
    const value = await request.json<{delivered:number}>().catch(()=>null);
    if (!integer(value?.delivered,0,100)) return json({error:'配信結果を確認してください'},400);
    await db.prepare('UPDATE home_osekkai_push SET delivered=? WHERE id=? AND delivered IS NULL').bind(value!.delivered,delivery).run();
    return json({ok:true});
  }
  if (!url.pathname.endsWith('/check') || request.method !== 'GET') return denied();
  const push = await db.prepare('SELECT recipient_id,for_guardian FROM home_osekkai_push WHERE id=?').bind(delivery).first<{recipient_id:string;for_guardian:number}>();
  const e = await db.prepare(query+` JOIN home_osekkai_push p ON p.event_id=e.id
   WHERE p.id=? AND p.delivered IS NULL AND p.created_at>? AND p.created_at>e.responded_at AND e.status='open' AND r.deleted=0 AND (r.enabled=1 OR e.is_test=1)`).bind(delivery,now-300).first<Event>();
  if (!e || !push || !await eligible(db,e.recipient_id,e.household_id,true) || !await targetAllowed(e,grant)) return json({allowed:false});
  const receiver=push.recipient_id;
  if (push.for_guardian ? receiver!==e.guardian_id || !await eligible(db,receiver,e.household_id,false) : receiver!==e.recipient_id) return json({allowed:false});
  if (!await grant(receiver,'notification')) return json({allowed:false});
  const user = url.searchParams.get('user'), session = url.searchParams.get('session');
  if ((user !== null || session !== null) && (user !== receiver || !await db.prepare('SELECT 1 FROM sessions WHERE id=? AND user_id=? AND revoked_at IS NULL AND expires_at>?').bind(session,receiver,now).first())) return json({allowed:false});
  if(push.for_guardian)return json({allowed:true,recipient_id:receiver,title:'👹 宿題の報告',body:'今日の宿題の完了報告がまだ届いていません。',url:'/wagaya/apps/osekkai/'});
  const message = publicEvent({...e,sequence:Number(delivery.slice(-1))+1});
  const dest = targets[e.target].path ? 'open' : '';
  return json({allowed:true,recipient_id:e.recipient_id,title:(e.is_test?'テスト・':'')+message.face+' '+message.name,body:message.text,inboxUrl:'/wagaya/apps/osekkai/?event='+e.event_id,url:'/wagaya/apps/osekkai/'+dest+'?event='+e.event_id});
}

export async function osekkaiOpen(db: D1Database, user: string, event: string, grant: Grant) {
  if (!token.test(event)) return denied();
  const row = await db.prepare(query+' WHERE e.id=? AND r.recipient_id=? AND r.deleted=0').bind(event,user).first<Event>();
  if (!row || !await eligible(db,user,row.household_id,true) || !await targetAllowed(row,grant)) return denied();
  const path = targets[row.target].path || '/apps/osekkai/';
  const target = path.startsWith('/apps/') ? path : 'https://cetus.fun'+path;
  // Keep the invitation available in HOME (including manual completion from static apps).
  return new Response(null,{status:303,headers:{Location:target,'Cache-Control':'private, no-store'}});
}

export async function osekkaiRoute(request: Request, db: D1Database, user: string, read: (r: Request)=>Promise<Record<string,unknown>>, grant: Grant) {
  const url = new URL(request.url), method = request.method, now = seconds(), day = jst(now).slice(0,10);
  const endpoint = url.pathname.slice('/api/osekkai'.length);
  if ((endpoint === '' || endpoint === '/summary') && method === 'GET') {
    const parents = (await db.prepare(`SELECT m.group_id ${members} WHERE m.user_id=? AND ${guardian}`).bind(user).all<{group_id:string}>()).results;
    const isChild = await db.prepare(`SELECT 1 ${members} WHERE m.user_id=? AND ${child}`).bind(user).first();
    if (isChild) await materialize(db,now,user);
    const incoming = isChild ? (await db.prepare(query+" WHERE r.recipient_id=? ORDER BY e.day DESC,e.created_at DESC LIMIT 45").bind(user).all<Event>()).results : [];
    const events = [];
    for (const e of incoming) if (await eligible(db,user,e.household_id,true) && await targetAllowed(e,grant)) events.push({...publicEvent(e),status:e.status==='open'&&(e.day<day||e.deleted)?'old':e.status});
    if (endpoint==='/summary') return json({child:!!isChild,guardian:parents.length>0,event:events.find(e=>e.status==='open')||null});
    const recipients = [], rules = [];
    for (const h of parents) {
      const people = (await db.prepare(`SELECT m.user_id id,m.group_id household_id,u.display_name name ${members} WHERE m.group_id=? AND ${child} ORDER BY u.display_name`).bind(h.group_id).all()).results;
      recipients.push(...people);
      rules.push(...(await db.prepare('SELECT * FROM home_osekkai_rules WHERE household_id=? AND deleted=0 ORDER BY time,id').bind(h.group_id).all<Rule>()).results);
    }
    return json({ events, recipients, rules, child:!!isChild,
      targets:Object.entries(targets).map(([id,target])=>({id,label:target.label})),
      actors:Object.entries(characters).map(([id,actor])=>({id,name:actor.name,face:actor.faces[0]})),
    });
  }
  if (endpoint === '/preview' && method === 'POST') {
    const input=await read(request);
    if (!await eligible(db,user,String(input.household_id),false)) return denied();
    if (!Object.hasOwn(targets,String(input.target)) || !Object.hasOwn(characters,String(input.character))) return denied();
    const challenge = typeof input.challenge==='string' && ['kuku','words','mental','five'].includes(String(input.target)) ? input.challenge.slice(0,30) : '';
    return json(osekkaiMessage(input.target as Target,input.character as Character,0,0,false,challenge,input.target==='medicine'&&input.confirmation==='medication'));
  }
  if (endpoint === '/respond' && method === 'POST') {
    const input = await read(request);
    const e = await db.prepare(query+" WHERE e.id=? AND r.recipient_id=? AND e.day=? AND e.status='open' AND r.deleted=0").bind(String(input.id||''),user,day).first<Event>();
    if (!e || !await eligible(db,user,e.household_id,true) || !await targetAllowed(e,grant)) return denied();
    const action = input.action;
    if (action !== 'done' && action !== 'later' && !(action === 'decline' && !targets[e.target].reminder)) return json({error:'操作を確認してください'},400);
    if (action==='done' && e.confirmation==='medication' && input.medication_confirmed!==true) return json({error:'服薬したことを確認してください'},400);
    const next = action==='later' && e.enabled && !e.is_test && e.sequence <= Math.min(e.retries, limits[e.intensity]) ? now+e.interval_min*60 : null;
    if (action==='later' && (!next || jst(next).slice(0,10)!==day)) return json({error:'今日は再通知の上限です。HOMEでいつでも確認できます。'},409);
    const status = action==='later'?'open':action==='done'?'done':'declined';
    const saved = await db.prepare("UPDATE home_osekkai_events SET status=?,next_at=?,responded_at=?,guardian_at=NULL WHERE id=? AND status='open' AND sequence=? RETURNING id").bind(status,next,now,e.event_id,e.sequence).first();
    if(saved && action==='decline' && !e.is_test) {
      await db.prepare(`UPDATE home_osekkai_events SET status='declined',next_at=NULL,responded_at=?
        WHERE day=? AND target=? AND status='open' AND is_test=0
        AND rule_id IN (SELECT id FROM home_osekkai_rules WHERE recipient_id=?)`).bind(now,day,e.target,user).run();
    }
    return saved ? json({event:publicEvent({...e,status})}) : json({error:'表示を更新してからお試しください'},409);
  }
  if (endpoint !== '/rules' || !['POST','DELETE'].includes(method)) return denied();
  const v = await read(request), house = String(v.household_id||''), recipient = String(v.recipient_id||'');
  if(method==='POST' && Array.isArray(v.recipient_ids)){
    const recipients=v.recipient_ids;
    if(v.id||v.test||recipients.length!==2||new Set(recipients).size!==2||recipients.some(x=>typeof x!=='string')||!validate(v))
      return json({error:'送信先と通知設定を確認してください'},400);
    if(!await eligible(db,user,house,false)) return denied();
    const target=v.target as Target;
    for(const id of recipients as string[]){
      if(!await eligible(db,id,house,true))return denied();
      if(!await targetAllowed({target,recipient_id:id},grant))return json({error:'子どもに対象アプリの利用権限がありません'},403);
      const count=await db.prepare('SELECT COUNT(*) n FROM home_osekkai_rules WHERE recipient_id=? AND deleted=0').bind(id).first<{n:number}>();
      if((count?.n??0)>=16)return json({error:'設定は一人につき16件までです'},409);
    }
    const values=[target,String(v.character),String(v.time),JSON.stringify(v.weekdays),Number(v.interval_min),Number(v.retries),Number(v.intensity),v.enabled?1:0,String(v.confirmation),String(v.challenge).trim(),v.notify_guardian===true?user:null];
    try{
      await db.batch((recipients as string[]).map(id=>db.prepare('INSERT INTO home_osekkai_rules(id,household_id,recipient_id,target,character,time,weekdays,interval_min,retries,intensity,enabled,confirmation,challenge,guardian_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),house,id,...values)));
    }catch(error){
      if(v.confirmation==='medication'&&/UNIQUE constraint/i.test(String(error)))return json({error:'服薬確認の設定は一人につき1件までです'},409);
      throw error;
    }
    return json({ok:true});
  }
  if (!await eligible(db,user,house,false) || !await eligible(db,recipient,house,true)) return denied();
  const id = String(v.id||'');
  const old = id ? await db.prepare('SELECT * FROM home_osekkai_rules WHERE id=? AND household_id=? AND recipient_id=? AND deleted=0').bind(id,house,recipient).first<Rule>() : null;
  if (id && !old) return denied();
  if (method === 'DELETE' && old) {
    await db.prepare('UPDATE home_osekkai_rules SET enabled=0,deleted=1 WHERE id=?').bind(id).run();
    return json({ok:true});
  }
  if (method === 'DELETE') return denied();
  if (v.test === true && old) {
    if (!await targetAllowed(old,grant)) return json({error:'対象アプリの利用権限を確認してください'},403);
    if(old.confirmation==='medication' && await db.prepare(`SELECT 1 FROM home_osekkai_events e JOIN home_osekkai_rules r ON r.id=e.rule_id
      WHERE r.recipient_id=? AND e.day=? AND e.confirmation='medication' AND e.status='done' AND e.is_test=0`).bind(recipient,day).first())
      return json({error:'今日の服薬は確認済みです。テストの催促も停止しています。'},409);
    if (await db.prepare('SELECT 1 FROM home_osekkai_push WHERE recipient_id=? AND (created_at>? OR day=? AND bucket=?)').bind(recipient,now-600,day,Math.floor(now/600)).first()) return json({error:'直前に通知を予約済みです。10分待って試してください。'},429);
    const event = crypto.randomUUID();
    const created=await db.prepare("INSERT INTO home_osekkai_events(id,rule_id,day,is_test,next_at,created_at,target,character,confirmation,challenge) SELECT ?,?,?,1,?,?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM home_osekkai_events e JOIN home_osekkai_rules r ON r.id=e.rule_id WHERE r.recipient_id=? AND e.is_test=1 AND e.created_at>?)")
      .bind(event,id,day,now,now,old.target,old.character,old.confirmation,old.challenge,recipient,now-600).run();
    return created.meta.changes?json({ok:true},202):json({error:'テスト通知は10分に1回までです'},429);
  }
  if (!validate(v)) return json({error:'時刻・曜日・通知設定を確認してください'},400);
  const target = v.target as Target;
  if (!await targetAllowed({target,recipient_id:recipient},grant)) return json({error:'子どもに対象アプリの利用権限がありません'},403);
  const count = await db.prepare('SELECT COUNT(*) n FROM home_osekkai_rules WHERE recipient_id=? AND deleted=0').bind(recipient).first<{n:number}>();
  if (!old && (count?.n??0)>=16) return json({error:'設定は一人につき16件までです'},409);
  const values = [target,String(v.character),String(v.time),JSON.stringify(v.weekdays),Number(v.interval_min),Number(v.retries),Number(v.intensity),v.enabled?1:0,String(v.confirmation),String(v.challenge).trim(),v.notify_guardian===true?user:null];
  try {
    if (old) await db.prepare('UPDATE home_osekkai_rules SET target=?,character=?,time=?,weekdays=?,interval_min=?,retries=?,intensity=?,enabled=?,confirmation=?,challenge=?,guardian_id=? WHERE id=?').bind(...values,id).run();
    else await db.prepare('INSERT INTO home_osekkai_rules(id,household_id,recipient_id,target,character,time,weekdays,interval_min,retries,intensity,enabled,confirmation,challenge,guardian_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),house,recipient,...values).run();
  } catch (error) {
    if (v.confirmation==='medication' && /UNIQUE constraint/i.test(String(error))) return json({error:'服薬確認の設定は一人につき1件までです'},409);
    throw error;
  }
  return json({ok:true});
}
