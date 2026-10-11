import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';

test('calendar scopes cap event data, require both households, preserve authors and recurring privacy',async()=>{
 const notifications=[];let notificationFail=false;
 const googleRequests=[];
 const googleFixture=async request=>{
  const url=request.url;googleRequests.push(url);
  const title=url.includes('private-mama')?'ママの仕事・非公開':url.includes('private-grandpa')?'おじいちゃんの個人予定':'祝日';
  return new Response('BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:'+title+'\r\nDTSTART:20261001T090000Z\r\nDTEND:20261001T100000Z\r\nSUMMARY:'+title+'\r\nEND:VEVENT\r\nEND:VCALENDAR');
 };
 const mf=new Miniflare(convertV4MiniflareOptions({workers:[
  {name:'home-worker',modules:true,scriptPath:new URL('../.wrangler/test-build/index.js',import.meta.url).pathname,compatibilityDate:'2026-10-01',compatibilityFlags:['nodejs_compat'],d1Databases:{DB:'home-calendar'},serviceBindings:{CALENDAR_SERVICE:'calendar-worker',ASSETS:async r=>new Response(await readFile(new URL('../public/calendar.html',import.meta.url),'utf8'),{headers:{'Content-Type':'text/html'}})}},
  {name:'calendar-worker',modules:true,script:await readFile(new URL('../../calendar-worker/calendar-worker.js',import.meta.url),'utf8'),compatibilityDate:'2026-10-01',d1Databases:{DB:'legacy-calendar'},bindings:{NOTIFICATION_API_URL:'https://notifications.test',NOTIFICATION_APP_PASSWORD:'test-only'},serviceBindings:{HOME_AUTH:'home-worker',NOTIFICATION_API:async request=>{notifications.push(await request.json());return Response.json({ok:!notificationFail},{status:notificationFail?503:200});}},outboundService:googleFixture}
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
 const event={title:'大人だけの相談',description:'非公開の内容',start_datetime:'2026-10-11T09:00',end_datetime:'2026-10-11T10:00',calendar_id:cid,visibility:{audience:'adults',members:[],subject_user_id:'mom'},recurrence_type:'daily',recurrence_end_type:'count',recurrence_end_count:3};
 response=await call('/api/calendar/events','mom','POST',event);assert.equal(response.status,200);const eid=(await response.json()).id;
 let child=await (await call('/api/calendar/events?from=2026-10-01&to=2026-10-31','grandpa')).json();assert.equal(JSON.stringify(child).includes('大人だけの相談'),false);assert.equal(JSON.stringify(child).includes('非公開の内容'),false);assert.equal(JSON.stringify(child).includes(eid),false);
 let adult=await (await call('/api/calendar/events?from=2026-10-01&to=2026-10-31','foreign')).json();assert.equal(adult.length,3);assert.equal(adult[0].subject_name,'ママ');assert.equal(adult[0].editable,false);
 assert.equal((await call('/api/calendar/events/'+eid,'foreign','PUT',event)).status,403);
 assert.equal((await call('/api/calendar/events/'+eid,'grandpa','DELETE')).status,404);
 // One recurring occurrence keeps the original policy and creates only one replacement.
 const detached={...event,title:'変更した大人予定'};delete detached.visibility;
 assert.equal((await call('/api/calendar/events/'+eid+'_0?mode=single&date=2026-10-11','mom','PUT',detached)).status,200);
 child=await (await call('/api/calendar/events?from=2026-10-01&to=2026-10-31','grandpa')).json();assert.equal(JSON.stringify(child).includes('大人予定'),false);
 adult=await (await call('/api/calendar/events?from=2026-10-01&to=2026-10-31','foreign')).json();assert.equal(adult.length,3);
 // Narrow calendar visibility without rewriting any original event rows.
 response=await call('/api/calendar/calendars/'+cid,'mom','PUT',{name:calendar.name,color:calendar.color,visibility:{...calendar.visibility,mode:'household'},revoke_groups:['other']});assert.equal(response.status,200);calendar=await response.json();
 assert.deepEqual(await (await call('/api/calendar/events?from=2026-10-01&to=2026-10-31','foreign')).json(),[]);
 assert.deepEqual((await cal.prepare("SELECT * FROM calendar_events WHERE id IN ('secret','common') ORDER BY id").all()).results,old.results);
 assert.equal((await cal.prepare('SELECT event_count FROM home_calendar_policy_backups WHERE calendar_id=?').bind(cid).first()).event_count,2);
 assert.equal((await call('/api/calendar/calendars/'+cid,'mom','PUT',{name:'競合',color:'#aabbcc',visibility:{...calendar.visibility,revision:1}})).status,409);
 // Re-offering after revocation cannot silently reinstate prior consent.
 response=await call('/api/calendar/calendars/'+cid,'mom','PUT',{name:calendar.name,color:calendar.color,visibility:{...calendar.visibility,mode:'all'},offer_groups:['other']});assert.equal(response.status,200);
 assert.deepEqual(await (await call('/api/calendar/calendars','foreign')).json(),[]);
 assert.equal((await (await call('/api/calendar/sharing/offers','foreign')).json()).length,1);
 // A private calendar always caps an otherwise inherited event audience.
 assert.equal((await call('/api/calendar/events','mom','POST',{...event,calendar_id:'private',recurrence_type:'none',visibility:{audience:'inherit',members:[],subject_user_id:'mom'}})).status,200);
 child=await (await call('/api/calendar/events?from=2026-10-01&to=2026-10-31','grandpa')).json();assert.equal(child.some(e=>e.calendar_id==='private'),false);
 assert.equal(notifications.some(p=>JSON.stringify(p).includes('大人だけの相談')||JSON.stringify(p).includes('非公開の内容')),false);
 await cal.prepare("UPDATE calendar_events SET notify_before=5 WHERE id='common'").run();notificationFail=true;assert.equal((await call('/api/calendar/events/common','mom','PUT',{...event,calendar_id:'shared',recurrence_type:'none',visibility:{audience:'self',members:[]}})).status,503);assert.equal((await cal.prepare("SELECT title FROM calendar_events WHERE id='common'").first()).title,'共通予定');notificationFail=false;
 // Existing notifications and display-name-only changes continue using the legacy channel.
 const legacyBody={title:'従来の通知を継続',description:'従来の共有内容',start_datetime:'2026-10-12T09:00',end_datetime:'2026-10-12T10:00',calendar_id:'shared',notify_before:5,notification_recipient:'all',recurrence_type:'none'};
 let nstart=notifications.length;
 assert.equal((await call('/api/calendar/events/common','mom','PUT',legacyBody)).status,200);
 assert.ok(notifications.slice(nstart).some(p=>p.source_id==='common'&&p.title==='📅 従来の通知を継続'&&p.occurrences.length>0));
 nstart=notifications.length;
 assert.equal((await call('/api/calendar/events/common','mom','PUT',{...legacyBody,visibility:{audience:'inherit',members:[],subject_user_id:'mom'}})).status,200);
 assert.ok(notifications.slice(nstart).some(p=>p.source_id==='common'&&p.title==='📅 従来の通知を継続'&&p.occurrences.length>0));
 let listed=await (await call('/api/calendar/events?from=2026-10-01&to=2026-10-31','mom')).json();assert.equal(listed.find(e=>e.id==='common').notification_pause_reason,null);
 // A restricted event in an otherwise unchanged calendar pauses only its own job.
 nstart=notifications.length;
 response=await call('/api/calendar/events','grandpa','POST',{...legacyBody,title:'本人限定・管理者には非公開',description:'本人だけの詳細',visibility:{audience:'self',members:[]}});assert.equal(response.status,200);const privateChildId=(await response.json()).id;
 assert.equal(notifications.slice(nstart).some(p=>JSON.stringify(p).includes('本人限定')||JSON.stringify(p).includes('本人だけの詳細')),false);
 listed=await (await call('/api/calendar/events?from=2026-10-01&to=2026-10-31','mom')).json();assert.equal(JSON.stringify(listed).includes(privateChildId),false);
 assert.equal((await call('/api/calendar/events/'+privateChildId,'mom','PUT',legacyBody)).status,404);
 assert.equal((await call('/api/calendar/events/'+privateChildId,'mom','DELETE')).status,404);
 const mine=await (await call('/api/calendar/events?from=2026-10-01&to=2026-10-31','grandpa')).json();assert.equal(mine.find(e=>e.id===privateChildId).notification_pause_reason,'event_audience_not_supported');
 assert.equal((await cal.prepare('SELECT notify_before FROM calendar_events WHERE id=?').bind(privateChildId).first()).notify_before,5);
 // The owning household administrator can maintain visible entries even without posting permission.
 response=await call('/api/calendar/calendars','grandpa','POST',{name:'本人が作った共通',color:'#abcdef',visibility:{mode:'all',household_id:'h',members:[],editors:['grandpa']},offer_groups:['other']});assert.equal(response.status,201);const managed=(await response.json()).id;
 assert.equal((await call('/api/calendar/calendars/'+managed+'/accept','foreign','POST',{group_id:'other'})).status,200);
 const managedBody={...legacyBody,calendar_id:managed,title:'子どもの共有予定',visibility:{audience:'inherit',members:[],subject_user_id:'grandpa'}};
 response=await call('/api/calendar/events','grandpa','POST',managedBody);assert.equal(response.status,200);const managedId=(await response.json()).id;
 const adminCal=(await (await call('/api/calendar/calendars','mom')).json()).find(c=>c.id===managed);assert.equal(adminCal.can_post,false);
 listed=await (await call('/api/calendar/events?from=2026-10-01&to=2026-10-31','mom')).json();assert.equal(listed.find(e=>e.id===managedId).editable,true);
 assert.equal((await call('/api/calendar/events/'+managedId,'peer','PUT',managedBody)).status,403);
 assert.equal((await call('/api/calendar/events/'+managedId,'foreign','PUT',managedBody)).status,403);
 assert.equal((await call('/api/calendar/events/'+managedId,'foreign','DELETE')).status,403);
 // Admin is an explicit HOME household role; child accounts cannot use it to edit others.
 await home.prepare("UPDATE memberships SET role='admin' WHERE group_id='h' AND user_id='peer'").run();
 await home.prepare("UPDATE home_member_attributes SET age_kind='child' WHERE group_id='h' AND user_id='peer'").run();
 assert.equal((await call('/api/calendar/events/'+managedId,'peer','PUT',managedBody)).status,403);
 await home.prepare("UPDATE home_member_attributes SET age_kind='adult' WHERE group_id='h' AND user_id='peer'").run();
 assert.equal((await call('/api/calendar/events/'+managedId,'peer','PUT',{...managedBody,title:'家庭のadminが修正'})).status,200);
 await home.prepare("UPDATE memberships SET role='member' WHERE group_id='h' AND user_id='peer'").run();
 assert.equal((await call('/api/calendar/events/'+managedId,'mom','PUT',{...managedBody,title:'家庭の管理者が修正'})).status,200);
 assert.equal((await cal.prepare('SELECT owner_home_id FROM home_event_visibility WHERE event_id=?').bind(managedId).first()).owner_home_id,'grandpa');
 assert.equal((await call('/api/calendar/events/'+managedId,'mom','DELETE')).status,200);
 // A one-day administrator edit preserves both the creator and the private-policy owner.
 response=await call('/api/calendar/events','grandpa','POST',{...managedBody,recurrence_type:'daily',recurrence_end_type:'count',recurrence_end_count:3});assert.equal(response.status,200);const repeat=(await response.json()).id;
 const single={...managedBody,title:'管理者が一日だけ修正',start_datetime:'2026-10-13T09:00',end_datetime:'2026-10-13T10:00'};delete single.visibility;
 assert.equal((await call('/api/calendar/events/'+repeat+'_1?mode=single&date=2026-10-13','mom','PUT',single)).status,200);
 const adminDetached=(await cal.prepare("SELECT id,created_by_google_id FROM calendar_events WHERE calendar_id=? AND id<>? AND recurrence_type='none'").bind(managed,repeat).all()).results;assert.equal(adminDetached.length,1);
 const originalAuthor=(await cal.prepare('SELECT created_by_google_id FROM calendar_events WHERE id=?').bind(repeat).first()).created_by_google_id;assert.equal(adminDetached[0].created_by_google_id,originalAuthor);
 assert.equal((await cal.prepare('SELECT owner_home_id FROM home_event_visibility WHERE event_id=?').bind(adminDetached[0].id).first()).owner_home_id,'grandpa');
 assert.equal((await call('/api/calendar/events/'+adminDetached[0].id,'mom','PUT',{...single,visibility:{audience:'self',members:[]}})).status,200);
 assert.equal((await call('/api/calendar/events/'+adminDetached[0].id,'mom','DELETE')).status,404);
 listed=await (await call('/api/calendar/events?from=2026-10-01&to=2026-10-31','grandpa')).json();assert.equal(listed.find(e=>e.id===adminDetached[0].id).editable,true);
 assert.equal((await call('/api/calendar/events/'+adminDetached[0].id,'grandpa','DELETE')).status,200);
 const publicIdentity=await (await call('/api/calendar/identity')).json();assert.equal('directory' in publicIdentity,false);
 assert.equal((await call('/api/calendar/events',null)).status,401);
 await home.prepare("UPDATE sessions SET revoked_at=? WHERE user_id='foreign'").bind(now).run();assert.equal((await call('/api/calendar/calendars','foreign')).status,401);
 }finally{await mf.dispose();}
});
