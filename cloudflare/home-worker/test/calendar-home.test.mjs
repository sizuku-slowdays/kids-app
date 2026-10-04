import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';

test('HOME identity replaces saved calendar login; private reads, owner writes and revocation stay enforced',async()=>{
 const mf=new Miniflare(convertV4MiniflareOptions({workers:[
  {name:'home-worker',modules:true,scriptPath:new URL('../.wrangler/test-build/index.js',import.meta.url).pathname,compatibilityDate:'2026-10-01',compatibilityFlags:['nodejs_compat'],d1Databases:{DB:'home-calendar'},serviceBindings:{CALENDAR_SERVICE:'calendar-worker',ASSETS:async r=>new Response(await readFile(new URL('../public/calendar.html',import.meta.url),'utf8'),{headers:{'Content-Type':'text/html'}})}},
  {name:'calendar-worker',modules:true,script:await readFile(new URL('../../calendar-worker/calendar-worker.js',import.meta.url),'utf8'),compatibilityDate:'2026-10-01',d1Databases:{DB:'legacy-calendar'},serviceBindings:{HOME_AUTH:'home-worker'}}
 ]}));
 try{
 const home=await mf.getD1Database('DB','home-worker'),cal=await mf.getD1Database('DB','calendar-worker');
 for(const file of (await readdir(new URL('../migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort()){
  const sql=(await readFile(new URL('../migrations/'+file,import.meta.url),'utf8')).replace(/^--.*$/gm,'');
  for(const stmt of sql.match(/\s*CREATE TRIGGER[\s\S]*?\nEND;|[^;]+;/g)||[])await home.prepare(stmt).run();
 }
 const now=Math.floor(Date.now()/1000),tokens={mom:'a'.repeat(64),grandpa:'b'.repeat(64),foreign:'c'.repeat(64)};
 for(const id of Object.keys(tokens)){
  await home.prepare("INSERT INTO users(id,login_name,display_name,password_salt,password_hash,password_iterations,platform_role,created_at) VALUES (?,?,?,'s','h',1,?,?)").bind(id,id,id,id==='mom'?'operator':'user',now).run();
  await home.prepare("INSERT INTO sessions VALUES (?,?,?,'test',?,?,?,NULL)").bind(id,createHash('sha256').update(tokens[id]).digest('hex'),id,now,now,now+10000).run();
 }
 await home.prepare("INSERT INTO groups VALUES ('h','家族','household','mom',?),('other','別家庭','household','foreign',?)").bind(now,now).run();
 await home.prepare("INSERT INTO memberships VALUES ('h','mom','owner'),('h','grandpa','member'),('other','foreign','owner')").run();
 await home.prepare("INSERT INTO group_apps VALUES ('h','calendar'),('other','calendar')").run();
 await home.prepare("INSERT INTO user_apps VALUES ('grandpa','calendar',0,0)").run();
 for(const sql of [
  'CREATE TABLE users(google_id TEXT PRIMARY KEY,display_name TEXT,avatar_color TEXT,created_at TEXT)',
  'CREATE TABLE family_members(member_id TEXT PRIMARY KEY,display_name TEXT,avatar_color TEXT,role TEXT,active INTEGER,created_at TEXT,updated_at TEXT)',
  'CREATE TABLE calendars(id TEXT PRIMARY KEY,name TEXT,color TEXT,owner_google_id TEXT,is_shared INTEGER,created_at TEXT)',
  'CREATE TABLE calendar_events(id TEXT PRIMARY KEY,calendar_id TEXT,created_by_google_id TEXT,recurrence_parent_id TEXT,title TEXT,start_datetime TEXT,end_datetime TEXT,all_day INTEGER,recurrence_type TEXT)',
  "INSERT INTO family_members VALUES ('mama','ママ','#aaa','admin',1,'now','now')",
  "INSERT INTO users VALUES ('family:mama','ママ','#aaa','now')",
  "INSERT INTO calendars VALUES ('private','ママ個人','#aaa','family:mama',0,'now'),('shared','共通','#bbb','family:mama',1,'now')",
  "INSERT INTO calendar_events VALUES ('secret','private','family:mama',NULL,'ママだけの予定','2026-10-01T09:00:00','2026-10-01T10:00:00',0,'none'),('common','shared','family:mama',NULL,'共通予定','2026-10-01T09:00:00','2026-10-01T10:00:00',0,'none')"
 ])await cal.prepare(sql).run();
 async function call(path,who='mom',method='GET',body,extra={}){return mf.dispatchFetch('https://cetus.fun/wagaya'+path,{method,redirect:'manual',headers:{Origin:'https://cetus.fun',...(who?{Cookie:'__Host-home_session='+tokens[who]}:{}),'Content-Type':'application/json',...extra},body:body?JSON.stringify(body):undefined});}
 assert.equal((await call('/apps/calendar/',null)).status,303);
 assert.equal((await call('/api/calendar/calendars',null)).status,401);
 let status=await (await call('/api/calendar/home/status')).json();assert.equal(status.profile,null);
 assert.equal((await call('/api/calendar/calendars')).status,409);
 assert.equal((await call('/api/calendar/home/link','grandpa','POST',{home_user_id:'grandpa',group_id:'h',member_id:'mama'})).status,403);
 assert.equal((await call('/api/calendar/home/link','mom','POST',{home_user_id:'foreign',group_id:'h',member_id:'mama'})).status,403);
 assert.equal((await call('/api/calendar/home/link','mom','POST',{home_user_id:'mom',group_id:'h',member_id:'mama'})).status,200);
 assert.equal((await call('/api/calendar/home/link','mom','POST',{home_user_id:'grandpa',member_id:'mama'})).status,403);
 assert.equal((await call('/api/calendar/home/link','mom','POST',{home_user_id:'grandpa',create:true})).status,200);
 const mamaCalendars=await (await call('/api/calendar/calendars')).json();assert.ok(mamaCalendars.some(c=>c.id==='private'));
 const direct=await (await mf.getWorker('calendar-worker')).fetch('https://calendar.internal/calendars',{headers:{Authorization:'Bearer saved-old-mama-token'}});
 assert.equal(direct.status,401);assert.match((await direct.json()).error,/HOME/);
 const me=await (await call('/api/calendar/family/me','grandpa','GET',null,{Authorization:'Bearer fake-mama-token','X-Google-Token':'mama','X-Home-User':'mom'})).json();
 assert.equal(me.google_id,'family:home_grandpa');assert.equal(me.display_name,'grandpa');assert.notEqual(me.role,'admin');
 const lists=await (await call('/api/calendar/calendars','grandpa')).json();assert.deepEqual(lists.map(c=>c.id),['shared']);
 const events=await (await call('/api/calendar/events?from=2026-10-01&to=2026-10-31','grandpa')).json();assert.equal(events.some(e=>e.id==='secret'),false);assert.ok(events.some(e=>e.id==='common'));
 assert.equal((await call('/api/calendar/events/common','grandpa','PUT',{})).status,403);
 assert.equal((await call('/api/calendar/events/common','grandpa','DELETE')).status,403);
 assert.equal((await call('/api/calendar/calendars/shared','grandpa','DELETE')).status,403);
 assert.equal((await call('/api/calendar/calendars','foreign')).status,401);
 assert.equal((await call('/api/calendar/calendars','grandpa','GET',null,{'X-Calendar-User':'mom'})).status,409);
 assert.equal((await call('/api/calendar/home/link','mom','POST',{home_user_id:'grandpa',member_id:'mama'})).status,409);
 assert.equal((await call('/api/calendar/karada/users')).status,404);
 assert.equal((await call('/api/calendar/home/link','mom','POST',{}, {Origin:'https://evil.test'})).status,403);
 assert.equal((await cal.prepare('SELECT COUNT(*) n FROM calendar_events').first()).n,2);
 assert.equal((await cal.prepare("SELECT owner_google_id FROM calendars WHERE id='private'").first()).owner_google_id,'family:mama');
 await home.prepare("UPDATE sessions SET revoked_at=? WHERE user_id='grandpa'").bind(now).run();
 assert.equal((await call('/api/calendar/calendars','grandpa')).status,401);
 await home.prepare("DELETE FROM group_apps WHERE group_id='h' AND app_id='calendar'").run();
 assert.equal((await call('/api/calendar/calendars')).status,403);
 }finally{await mf.dispose();}
});
