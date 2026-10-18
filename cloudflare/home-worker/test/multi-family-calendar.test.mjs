import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';

test('three households and kin group keep five legacy identities, private events and revocable notifications isolated',async()=>{
 const mf=new Miniflare(convertV4MiniflareOptions({workers:[
  {name:'home-worker',modules:true,scriptPath:new URL('../.wrangler/test-build/index.js',import.meta.url).pathname,compatibilityDate:'2026-10-01',compatibilityFlags:['nodejs_compat'],d1Databases:{DB:'multi-home'},bindings:{FAMILY_INVITES_ENABLED:'1'},serviceBindings:{CALENDAR_SERVICE:'calendar-worker',ASSETS:()=>new Response('asset')}},
  {name:'calendar-worker',modules:true,script:await readFile(new URL('../../calendar-worker/calendar-worker.js',import.meta.url),'utf8'),compatibilityDate:'2026-10-01',d1Databases:{DB:'multi-calendar'},bindings:{NOTIFICATION_API_URL:'https://notifications.test',NOTIFICATION_APP_PASSWORD:'fixture'},serviceBindings:{HOME_AUTH:'home-worker',NOTIFICATION_API:request=>Response.json(new URL(request.url).pathname==='/api/health'?{home_notification_protocol:'home-v1'}:{ok:true})},outboundService:()=>new Response('BEGIN:VCALENDAR\r\nEND:VCALENDAR')}
 ]}));
 try{
 const home=await mf.getD1Database('DB','home-worker'),cal=await mf.getD1Database('DB','calendar-worker'),now=Math.floor(Date.now()/1000),tokens={};
 for(const f of (await readdir(new URL('../migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort()){const sql=(await readFile(new URL('../migrations/'+f,import.meta.url),'utf8')).replace(/^--.*$/gm,'');for(const s of sql.match(/\s*CREATE TRIGGER[\s\S]*?\nEND;|[^;]+;/g)||[])await home.prepare(s).run();}
 const original=['mom','grandpa','grandma','kid1','kid2'];
 for(const [i,u] of [...original,'brother','sister','wife','outside'].entries()){
  await home.prepare("INSERT INTO users(id,login_name,display_name,password_salt,password_hash,password_iterations,platform_role,created_at) VALUES(?,?,?,'s','h',1,?,?)").bind(u,u,'NAME-'+u,u==='mom'?'operator':'user',now).run();tokens[u]=String(i+1).repeat(64);await home.prepare("INSERT INTO sessions VALUES(?,?,?,'fixture',?,?,?,NULL)").bind(u,createHash('sha256').update(tokens[u]).digest('hex'),u,now,now,now+3600).run();
 }
 for(const [g,u,k] of [['h','mom','household'],['b','brother','household'],['s','sister','household'],['x','outside','household'],['kin','mom','sharing']]){
  await home.prepare('INSERT INTO groups VALUES(?,?,?,?,?)').bind(g,'GROUP-'+g,k,u,now).run();await home.prepare("INSERT INTO memberships VALUES(?,?,'owner')").bind(g,u).run();for(const a of ['calendar','notification'])await home.prepare('INSERT INTO group_apps VALUES(?,?)').bind(g,a).run();if(g!=='h')await home.prepare("INSERT INTO family_workspaces VALUES(?,'restricted',?)").bind(g,now).run();
 }
 for(const [g,u] of [['h','grandpa'],['h','grandma'],['h','kid1'],['h','kid2'],['b','wife'],['kin','grandpa'],['kin','brother'],['kin','sister'],['kin','kid1']])await home.prepare("INSERT INTO memberships VALUES(?,?,'member')").bind(g,u).run();
 for(const [g,u] of (await home.prepare('SELECT group_id,user_id FROM memberships').all()).results.map(r=>[r.group_id,r.user_id]))await home.prepare("INSERT INTO home_member_attributes VALUES(?,?,?,?,'fixture')").bind(g,u,u.startsWith('kid')?'child':'adult',u).run();
 for(const u of ['kid1','kid2'])await home.prepare("INSERT INTO children VALUES(?,'h',?,?)").bind(u,u,u).run();
 for(const sql of [
  'CREATE TABLE users(google_id TEXT PRIMARY KEY,display_name TEXT,avatar_color TEXT,created_at TEXT)',
  'CREATE TABLE family_members(member_id TEXT PRIMARY KEY,display_name TEXT,avatar_color TEXT,role TEXT,active INTEGER,created_at TEXT,updated_at TEXT)',
  'CREATE TABLE calendars(id TEXT PRIMARY KEY,name TEXT,color TEXT,owner_google_id TEXT,is_shared INTEGER,created_at TEXT)',
  'CREATE TABLE calendar_events(id TEXT PRIMARY KEY,calendar_id TEXT,created_by_google_id TEXT,recurrence_parent_id TEXT,title TEXT,start_datetime TEXT,end_datetime TEXT,all_day INTEGER,recurrence_type TEXT)',
  "CREATE TABLE home_calendar_config(id INTEGER PRIMARY KEY,household_id TEXT)",
  "INSERT INTO home_calendar_config VALUES(1,'h')",
  'CREATE TABLE home_calendar_links(home_user_id TEXT PRIMARY KEY,member_id TEXT UNIQUE,household_id TEXT,created_at TEXT)',
  "INSERT INTO calendars VALUES('old-shared','OLD COMMON','#aabbcc','family:mom',1,'fixture'),('old-private','OLD PRIVATE','#aabbcc','family:mom',0,'fixture')",
  "INSERT INTO calendar_events VALUES('old-event','old-shared','family:mom',NULL,'OLD EVENT','2026-10-18T09:00','2026-10-18T10:00',0,'none')"
 ])await cal.prepare(sql).run();
 for(const [c,t] of Object.entries({description:'TEXT',color:'TEXT',notify_before:'INTEGER',notification_recipient:'TEXT',recurrence_interval:'INTEGER',recurrence_days:'TEXT',recurrence_end_type:'TEXT',recurrence_end_count:'INTEGER',recurrence_end_date:'TEXT',recurrence_monthly_type:'TEXT',recurrence_week_number:'INTEGER',recurrence_weekday:'INTEGER',recurrence_exceptions:'TEXT',list_type:'TEXT',list_items:'TEXT',created_at:'TEXT',updated_at:'TEXT'}))await cal.prepare('ALTER TABLE calendar_events ADD COLUMN '+c+' '+t).run();
 for(const u of original){await cal.prepare("INSERT INTO family_members VALUES(?,?,'#aabbcc',?,1,'fixture','fixture')").bind(u,u,u==='mom'?'admin':'member').run();await cal.prepare("INSERT INTO users VALUES(?,?,'#aabbcc','fixture')").bind('family:'+u,u).run();await cal.prepare("INSERT INTO home_calendar_links VALUES(?,?,'h','fixture')").bind(u,u).run();}
 const oldLinks=JSON.stringify((await cal.prepare('SELECT * FROM home_calendar_links ORDER BY home_user_id').all()).results),oldEvents=JSON.stringify((await cal.prepare("SELECT * FROM calendar_events WHERE id='old-event'").all()).results);
 async function call(path='',u='mom',method='GET',body){const r=await mf.dispatchFetch('https://cetus.fun/wagaya/api/calendar'+path,{method,headers:{Origin:'https://cetus.fun',Cookie:'__Host-home_session='+tokens[u],'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json()};}
 async function ok(...args){const r=await call(...args);assert.ok(r.status===200||r.status===201,JSON.stringify(r));return r.data;}
 const period='/events?from=2026-10-01&to=2026-10-31';
 assert.equal((await mf.dispatchFetch('https://cetus.fun/internal/family-readiness',{redirect:'manual'})).status,303);
 const readiness=await mf.dispatchFetch('https://cetus.fun/wagaya/api/families',{headers:{Cookie:'__Host-home_session='+tokens.mom}});assert.equal((await readiness.json()).ready,true);
 for(const u of original)assert.equal((await ok('/home/status',u)).profile.google_id,'family:'+u);
 const newHome=await mf.dispatchFetch('https://cetus.fun/wagaya/api/home',{headers:{Cookie:'__Host-home_session='+tokens.brother}});assert.equal((await newHome.json()).find(a=>a.id==='notification').path,'/wagaya/apps/notification/');
 assert.equal((await mf.dispatchFetch('https://cetus.fun/wagaya/apps/notification/',{redirect:'manual'})).status,303);
 const brother=await ok('/home/status','brother');assert.equal(brother.profile.google_id,'home:brother');assert.equal(brother.household_id,'b');assert.deepEqual(brother.links,[]);assert.deepEqual(brother.profiles,[]);assert.deepEqual(await ok('/calendars','brother'),[]);
 assert.equal((await call('/home/link','brother','POST',{home_user_id:'wife',group_id:'b',create:true})).status,403);
 assert.equal((await call('/family/members','brother','POST',{display_name:'No overwrite'})).status,403);
 assert.equal((await ok('/family/me','brother')).can_configure_google,true);
 const create=async(u,group,mode='all')=>ok('/calendars',u,'POST',{name:'CAL-'+u+'-'+group,color:'#aabbcc',visibility:{household_id:group,mode,members:[],editors:['*']}});
 const b=await create('brother','b','household'),kin=await create('brother','kin');
 const input=(id,title,audience='inherit')=>({calendar_id:id,title,start_datetime:'2026-10-18T09:00',end_datetime:'2026-10-18T10:00',all_day:0,notify_before:5,notification_recipient:'home-all',recurrence_type:'none',visibility:{audience,members:[],subject_user_id:'brother'}});
 const privateEvent=await ok('/events','brother','POST',input(b.id,'BROTHER HOUSEHOLD SECRET'));
 const sharedEvent=await ok('/events','brother','POST',input(kin.id,'KIN EVENT'));
 const personalEvent=await ok('/events','brother','POST',input(kin.id,'BROTHER ONLY','self'));
 const adultEvent=await ok('/events','brother','POST',input(kin.id,'ADULT ONLY','adults'));
 assert.ok((await ok(period,'wife')).some(e=>e.id===privateEvent.id));assert.equal(JSON.stringify(await ok(period,'mom')).includes('HOUSEHOLD SECRET'),false);
 assert.ok((await ok(period,'mom')).some(e=>e.id===sharedEvent.id));assert.equal(JSON.stringify(await ok(period,'wife')).includes('KIN EVENT'),false);assert.deepEqual(await ok(period,'outside'),[]);
 for(const u of ['mom','sister','grandpa'])assert.equal(JSON.stringify(await ok(period,u)).includes('BROTHER ONLY'),false);
 assert.equal((await call('/events/'+personalEvent.id,'mom','DELETE')).status,404);
 assert.equal(JSON.stringify(await ok(period,'kid1')).includes('ADULT ONLY'),false);
 assert.equal((await call('/events/'+sharedEvent.id,'sister','PUT',input(kin.id,'NOT OWN'))).status,403);
 assert.equal((await call('/events/'+sharedEvent.id,'mom','PUT',input(kin.id,'KIN EVENT updated'))).status,200);
 // Current membership is checked again immediately before push, even if another app keeps the session valid.
 const push=async u=>{const r=await mf.dispatchFetch('https://notification-auth.internal/internal/notification-check?user='+u+'&session='+u+'&event='+sharedEvent.id);return r.json();};
 assert.equal((await push('sister')).allowed,true);assert.equal((await push('wife')).allowed,false);assert.equal((await push('outside')).allowed,false);
 await home.prepare("DELETE FROM memberships WHERE group_id='kin' AND user_id='sister'").run();assert.equal((await push('sister')).allowed,false);assert.equal(JSON.stringify(await ok(period,'sister')).includes('KIN EVENT'),false);
 assert.equal((await call('/events/'+sharedEvent.id,'sister','DELETE')).status,404);
 await home.prepare("INSERT INTO memberships VALUES('kin','sister','member')").run();assert.equal((await push('sister')).allowed,true);
 // Sharing-group administrators never become administrators of other households' calendars or finances.
 assert.equal((await call('/calendars/'+b.id,'mom','PUT',{name:'NO',color:'#aabbcc',visibility:{...b.visibility}})).status,403);
 for(const u of ['brother','sister']){const r=await mf.dispatchFetch('https://cetus.fun/wagaya/api/passbook?household=h',{headers:{Cookie:'__Host-home_session='+tokens[u]}});assert.equal(r.status,403);}
 assert.equal((await ok('/integrations/google-ics','brother')).configured,false);
 assert.equal((await call('/integrations/google-ics','wife','POST',{urls:[]})).status,403);
 await home.prepare("DELETE FROM memberships WHERE group_id='kin' AND user_id='brother'").run();assert.equal((await call('/calendars/'+kin.id,'brother','DELETE')).status,404);assert.ok(await cal.prepare('SELECT 1 FROM calendars WHERE id=?').bind(kin.id).first());
 const oldCount=(await ok(period,'mom')).filter(e=>e.id==='old-event').length;assert.equal(oldCount,1);
 assert.equal(JSON.stringify((await cal.prepare('SELECT * FROM home_calendar_links ORDER BY home_user_id').all()).results),oldLinks);
 assert.equal(JSON.stringify((await cal.prepare("SELECT * FROM calendar_events WHERE id='old-event'").all()).results),oldEvents);
 assert.equal((await cal.prepare('SELECT household_id FROM home_calendar_config WHERE id=1').first()).household_id,'h');
 assert.equal((await home.prepare("SELECT COUNT(*) n FROM memberships WHERE group_id='h'").first()).n,5);
 assert.equal((await home.prepare('PRAGMA foreign_key_check').all()).results.length,0);
 }finally{await mf.dispose();}
});
