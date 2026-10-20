import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';

test('calendar multi timings and subjects: persisted edits, recurring instances, live privacy and deployment gates',async()=>{
 const notifications=[];let notificationFail=false,multiReady=true;
 const googleRequests=[];
 const googleFixture=async request=>{
  const url=request.url;googleRequests.push(url);
  const title=url.includes('private-mama')?'ママの仕事・非公開':url.includes('private-grandpa')?'おじいちゃんの個人予定':'祝日';
  return new Response('BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:'+title+'\r\nDTSTART:20261001T090000Z\r\nDTEND:20261001T100000Z\r\nSUMMARY:'+title+'\r\nEND:VEVENT\r\nEND:VCALENDAR');
 };
 const mf=new Miniflare(convertV4MiniflareOptions({workers:[
  {name:'home-worker',modules:true,scriptPath:new URL('../.wrangler/test-build/index.js',import.meta.url).pathname,compatibilityDate:'2026-10-01',compatibilityFlags:['nodejs_compat'],d1Databases:{DB:'home-calendar'},serviceBindings:{CALENDAR_SERVICE:'calendar-worker',ASSETS:async r=>new Response(await readFile(new URL('../public/calendar.html',import.meta.url),'utf8'),{headers:{'Content-Type':'text/html'}})}},
  {name:'calendar-worker',modules:true,script:await readFile(new URL('../../calendar-worker/calendar-worker.js',import.meta.url),'utf8'),compatibilityDate:'2026-10-01',d1Databases:{DB:'legacy-calendar'},bindings:{NOTIFICATION_API_URL:'https://notifications.test',NOTIFICATION_APP_PASSWORD:'test-only'},serviceBindings:{HOME_AUTH:'home-worker',NOTIFICATION_API:async request=>{if(new URL(request.url).pathname==='/api/health')return Response.json({home_notification_protocol:'home-v1',calendar_multi_protocol:multiReady?'multi-v1':null});notifications.push(await request.json());return Response.json({ok:!notificationFail},{status:notificationFail?503:200});}},outboundService:googleFixture}
 ]}));
 try{
 const home=await mf.getD1Database('DB','home-worker'),cal=await mf.getD1Database('DB','calendar-worker');
 for(const file of (await readdir(new URL('../migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort()){
  const sql=(await readFile(new URL('../migrations/'+file,import.meta.url),'utf8')).replace(/^--.*$/gm,'');
  for(const stmt of sql.match(/\s*CREATE TRIGGER[\s\S]*?\nEND;|[^;]+;/g)||[])await home.prepare(stmt).run();
 }
 const now=Math.floor(Date.now()/1000),tokens={mom:'a'.repeat(64),grandpa:'b'.repeat(64),foreign:'c'.repeat(64),peer:'d'.repeat(64)};
 for(const id of Object.keys(tokens)){
  await home.prepare("INSERT INTO users(id,login_name,display_name,password_salt,password_hash,password_iterations,platform_role,created_at) VALUES (?,?,?,'s','h',1,?,?)").bind(id,id,id,id==='mom'?'operator':'user',now).run();
  await home.prepare("INSERT INTO sessions VALUES (?,?,?,'test',?,?,?,NULL)").bind(id,createHash('sha256').update(tokens[id]).digest('hex'),id,now,now,now+10000).run();
 }
 await home.prepare("INSERT INTO groups VALUES ('h','家族','household','mom',?),('other','別家庭','household','foreign',?)").bind(now,now).run();
 await home.prepare("INSERT INTO memberships VALUES ('h','mom','owner'),('h','grandpa','member'),('other','foreign','owner'),('h','peer','member')").run();
 await home.prepare("INSERT INTO group_apps VALUES ('h','calendar'),('other','calendar'),('h','notification')").run();
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
 for(const [column,type] of Object.entries({description:'TEXT',color:'TEXT',notify_before:'INTEGER',notification_recipient:'TEXT',recurrence_interval:'INTEGER',recurrence_days:'TEXT',recurrence_end_type:'TEXT',recurrence_end_count:'INTEGER',recurrence_end_date:'TEXT',recurrence_monthly_type:'TEXT',recurrence_week_number:'INTEGER',recurrence_weekday:'INTEGER',recurrence_exceptions:'TEXT',list_type:'TEXT',list_items:'TEXT',created_at:'TEXT',updated_at:'TEXT'}))await cal.prepare('ALTER TABLE calendar_events ADD COLUMN '+column+' '+type).run();
 async function call(path,who='mom',method='GET',body,extra={}){return mf.dispatchFetch('https://cetus.fun/wagaya'+path,{method,redirect:'manual',headers:{Origin:'https://cetus.fun',...(who?{Cookie:'__Host-home_session='+tokens[who]}:{}),'Content-Type':'application/json',...extra},body:body?JSON.stringify(body):undefined});}

 await home.prepare("INSERT INTO home_member_attributes VALUES ('h','mom','adult','mom','now'),('h','grandpa','child','mom','now'),('other','foreign','adult','foreign','now'),('h','peer','adult','mom','now')").run();
 await home.prepare("INSERT INTO home_person_names VALUES ('mom','ママ','now')").run();
 assert.equal((await call('/api/calendar/home/link','mom','POST',{home_user_id:'mom',group_id:'h',member_id:'mama'})).status,200);
 assert.equal((await call('/api/calendar/home/link','mom','POST',{home_user_id:'grandpa',create:true})).status,200);
 assert.equal((await call('/api/calendar/home/link','mom','POST',{home_user_id:'peer',create:true})).status,200);
 const old=await cal.prepare("SELECT * FROM calendar_events ORDER BY id").all();
 const before=await (await call('/api/calendar/events?from=2026-10-01&to=2026-10-31','grandpa')).json();assert.deepEqual(before.map(e=>e.id),['common']);
 let response=await call('/api/calendar/calendars','mom','POST',{name:'共有先を選ぶ',color:'#aabbcc',visibility:{mode:'all',household_id:'h',editors:['*'],members:[]},offer_groups:['other']});assert.equal(response.status,201);let calendar=await response.json();const cid=calendar.id;
 assert.deepEqual(await (await call('/api/calendar/calendars','foreign')).json(),[]);
 const offers=await (await call('/api/calendar/sharing/offers','foreign')).json();assert.equal(offers.length,1);
 assert.equal((await call('/api/calendar/calendars/'+cid+'/accept','grandpa','POST',{group_id:'other'})).status,403);
 assert.equal((await call('/api/calendar/calendars/'+cid+'/accept','foreign','POST',{group_id:'other'})).status,200);
 assert.ok((await (await call('/api/calendar/calendars','foreign')).json()).some(c=>c.id===cid));

 const date=new Date(Date.now()+14*86400000).toISOString().slice(0,10),until=new Date(Date.parse(date)+5*86400000).toISOString().slice(0,10);
 const event={title:'テストの予定',start_datetime:date+'T09:00',end_datetime:date+'T10:00',calendar_id:cid,notification_recipient:'home-all',notify_befores:[30,1440],visibility:{audience:'members',members:['mom','peer'],subject_user_ids:['mom','peer']},recurrence_type:'none'};
 response=await call('/api/calendar/events','mom','POST',event);assert.equal(response.status,200,await response.clone().text());const eid=(await response.json()).id;
 const payload=notifications.filter(p=>p.source_id===eid).at(-1);assert.equal(payload.occurrences.length,2);assert.deepEqual(payload.occurrences.map(x=>x.time).sort(),['08:30','09:00']);
 assert.equal(new Set(payload.occurrences.map(x=>x.date+' '+x.time)).size,2);
 const list=async who=>(await (await call('/api/calendar/events?from='+date+'&to='+until,who)).json());
 let row=(await list('mom')).find(e=>e.id===eid);assert.deepEqual(row.notify_befores,[30,1440]);assert.deepEqual(row.visibility.subject_user_ids,['mom','peer']);assert.equal(row.subject_names.length,2);
 assert.ok((await list('peer')).some(e=>e.id===eid));assert.ok(!(await list('foreign')).some(e=>e.id===eid));assert.ok(!(await list('grandpa')).some(e=>e.id===eid));
 assert.equal((await call('/api/calendar/events','mom','POST',{...event,notify_befores:[30,30]})).status,400);
 assert.equal((await call('/api/calendar/events','mom','POST',{...event,notify_befores:[-1]})).status,400);
 assert.equal((await call('/api/calendar/events','mom','POST',{...event,visibility:{...event.visibility,subject_user_ids:['outside']}})).status,400);
 const cworker=await mf.getWorker('calendar-worker');
 async function allowed(who){const identity={user:{id:who},groups:[{id:'h',role:who==='mom'?'owner':'member'}],directory:[{id:'mom',display_name:'Mom',group_id:'h',age_kind:'adult'},{id:'peer',display_name:'Peer',group_id:'h',age_kind:'adult'},{id:'grandpa',display_name:'Child',group_id:'h',age_kind:'child'}]};return (await (await cworker.fetch('https://calendar-notifications.internal/internal/notification-check',{method:'POST',body:JSON.stringify({identity,event_id:eid})})).json()).allowed;}
 assert.equal(await allowed('peer'),true);assert.equal(await allowed('grandpa'),false);
 // Old notification Worker must reject before changing an event or dropping timings.
 const countBefore=(await cal.prepare('SELECT COUNT(*) n FROM calendar_events').first()).n;multiReady=false;
 assert.equal((await call('/api/calendar/events','mom','POST',event)).status,503);assert.equal((await cal.prepare('SELECT COUNT(*) n FROM calendar_events').first()).n,countBefore);multiReady=true;
 // Old-client title edits preserve multi selections when those fields are omitted.
 const compatible={...event,title:'タイトルだけ変更',notify_before:30};delete compatible.notify_befores;compatible.visibility={audience:'members',members:['mom','peer'],subject_user_id:'mom'};
 assert.equal((await call('/api/calendar/events/'+eid,'mom','PUT',compatible)).status,200);row=(await list('mom')).find(e=>e.id===eid);assert.deepEqual(row.notify_befores,[30,1440]);assert.deepEqual(row.subject_user_ids,['mom','peer']);
 // Two recurrence instances each get their two moments exactly once.
 response=await call('/api/calendar/events','mom','POST',{...event,recurrence_type:'daily',recurrence_end_type:'count',recurrence_end_count:2});assert.equal(response.status,200);const recurring=(await response.json()).id;
 assert.equal(notifications.filter(p=>p.source_id===recurring).at(-1).occurrences.length,4);
 const single={...event,title:'一回だけ変更',notify_befores:[0,5],visibility:{audience:'self',members:[],subject_user_ids:['peer']}};
 assert.equal((await call('/api/calendar/events/'+recurring+'?mode=single&date='+date,'mom','PUT',single)).status,200);
 const detached=(await list('mom')).find(e=>e.title==='一回だけ変更');assert.ok(detached);assert.deepEqual(detached.notify_befores,[0,5]);assert.deepEqual(detached.subject_user_ids,['peer']);assert.ok(!(await list('peer')).some(e=>e.id===detached.id));
 const clear={...event,notify_befores:[],visibility:{audience:'self',members:[],subject_user_ids:[]}};
 assert.equal((await call('/api/calendar/events/'+eid,'mom','PUT',clear)).status,200);row=(await list('mom')).find(e=>e.id===eid);assert.deepEqual(row.notify_befores,[]);assert.deepEqual(row.subject_user_ids,[]);assert.equal(notifications.filter(p=>p.source_id===eid).at(-1).occurrences.length,0);assert.equal(await allowed('mom'),false);
 assert.equal((await call('/api/calendar/events/'+eid,'mom','DELETE')).status,200);assert.equal(await cal.prepare('SELECT * FROM home_event_options WHERE event_id=?').bind(eid).first(),null);
 assert.deepEqual((await cal.prepare("SELECT * FROM calendar_events WHERE id IN ('secret','common') ORDER BY id").all()).results,old.results);
 }finally{await mf.dispose();}
});
