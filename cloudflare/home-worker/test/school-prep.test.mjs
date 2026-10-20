import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';

test('school preparation: verified HOME identity, independent days/phases, version safety, completion delivery and preserved cash',async()=>{
 const sent=[];
 const mf=new Miniflare(convertV4MiniflareOptions({name:'school-test',modules:true,scriptPath:new URL('../.wrangler/test-build/index.js',import.meta.url).pathname,compatibilityDate:'2026-10-01',compatibilityFlags:['nodejs_compat'],d1Databases:{DB:'school'},serviceBindings:{ASSETS:()=>new Response('asset',{headers:{'Content-Type':'text/html'}}),NOTIFICATION_SERVICE:async request=>{sent.push(JSON.parse(await request.text()));return Response.json({ok:true,protocol:'school-v1',delivered:1});}}}));
 try{
 const db=await mf.getD1Database('DB');
 for(const f of (await readdir(new URL('../migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort()){
  const source=(await readFile(new URL('../migrations/'+f,import.meta.url),'utf8')).replace(/^--.*$/gm,'');for(const stmt of source.match(/\s*CREATE TRIGGER[\s\S]*?\nEND;|[^;]+;/g)||[])await db.prepare(stmt).run();
 }
 const now=Math.floor(Date.now()/1000),cookies={};
 for(const [i,n]of ['mom','older','younger','foreign','grandparent'].entries()){
  await db.prepare("INSERT INTO users(id,login_name,display_name,password_salt,password_hash,password_iterations,created_at) VALUES (?,?,?,'s','h',1,?)").bind(n,n,'HOME-'+n,now).run();const token=String(i+1).repeat(64);cookies[n]='__Host-home_session='+token;await db.prepare("INSERT INTO sessions VALUES (?,?,?,'test',?,?,?,NULL)").bind(n,createHash('sha256').update(token).digest('hex'),n,now,now,now+3600).run();
 }
 for(const [h,owner]of [['h','mom'],['f','foreign']]){await db.prepare("INSERT INTO groups VALUES (?,?,'household',?,?)").bind(h,h,owner,now).run();await db.prepare("INSERT INTO memberships VALUES (?,?,'owner')").bind(h,owner).run();await db.prepare("INSERT INTO group_apps VALUES (?,'school-prep')").bind(h).run();}
 await db.prepare("INSERT INTO group_apps VALUES ('h','notification')").run();
 for(const n of ['older','younger','grandparent'])await db.prepare("INSERT INTO memberships VALUES ('h',?,'member')").bind(n).run();
 for(const n of ['older','younger'])await db.prepare("INSERT INTO children VALUES (?,'h',?,?)").bind(n+'-child','alias',n).run();
 await db.prepare("INSERT INTO passbook_units(id,household_id,code,name,kind,symbol) VALUES ('cash','h','cash','cash','money','yen')").run();
 await db.prepare("INSERT INTO passbook_accounts VALUES('a','h','older-child','cash')").run();
 await db.prepare("INSERT INTO passbook_entries(id,account_id,household_id,delta,memo,occurred_at,created_at,created_by,source_app,source_event) VALUES('e','a','h',123,'unchanged','2026-10-01',?,'mom','fixture','seed')").bind(now).run();
 const money=(await db.prepare('SELECT * FROM passbook_entries').all()).results;
 const today=new Date(Date.now()+32400000).toISOString().slice(0,10),tomorrow=new Date(Date.parse(today+'T12:00:00Z')+86400000).toISOString().slice(0,10);
 async function call(path='',who='mom',method='GET',body,child='older-child',day=today,h='h'){
  const url=new URL('https://cetus.fun/wagaya/api/school-prep'+path);url.searchParams.set('household',h);url.searchParams.set('child',child);url.searchParams.set('day',day);
  const response=await mf.dispatchFetch(url,{method,headers:{Origin:'https://cetus.fun',...(who?{Cookie:cookies[who]}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});return {status:response.status,data:await response.json()};
 }
 const ok=async(...args)=>{const r=await call(...args);assert.equal(r.status,200,JSON.stringify(r));return r.data;};
 assert.equal((await call('',null)).status,401);
 assert.equal((await mf.dispatchFetch('https://cetus.fun/wagaya/apps/school-prep/',{redirect:'manual'})).status,303);
 assert.equal((await call('','foreign')).status,403);assert.equal((await call('','grandparent')).status,403);
 assert.equal((await call('','older','GET',undefined,'younger-child')).status,403);
 let s=await ok();assert.equal(s.children.length,2);assert.equal(s.plan,null);assert.equal(s.notify_enabled,false);
 s=await ok('','older');assert.equal(s.children.length,1);assert.equal(s.children[0].display_name,'HOME-older');
 assert.equal((await call('/preferences','older','PUT',{notify_enabled:true})).status,403);
 await ok('/preferences','mom','PUT',{notify_enabled:true});
 const plan={day:today,expected_revision:0,is_school_day:true,dismissal:'14:30',tasks:[{id:'hw1',kind:'homework',text:'宿題1'},{id:'hw2',kind:'homework',text:'宿題2'},{id:'bag',kind:'belonging',text:'水筒'}]};
 assert.equal((await call('/confirm','older','POST',plan)).status,403);
 await ok('/confirm','mom','POST',plan);
 assert.equal((await call('/confirm','mom','POST',plan)).status,409);
 await ok('/confirm','mom','POST',{...plan,day:tomorrow},'older-child',tomorrow);
 assert.equal((await call('/check','mom','POST',{revision:1,task_id:'hw1',phase:'homework',done:true,request_id:'admin'})).status,403);
 const mark=(task_id,phase='homework',done=true,request_id=crypto.randomUUID())=>({revision:1,task_id,phase,done,request_id});
 const first=mark('hw1');await ok('/check','older','POST',first);assert.equal(sent.length,0);
 await ok('/check','older','POST',mark('hw2'));assert.equal(sent.length,1);
 await ok('/check','older','POST',first);assert.equal(sent.length,1);
 await ok('/check','older','POST',mark('hw1','homework',false));await ok('/check','older','POST',first);
 s=await ok('','older');assert.equal(s.checks.find(c=>c.task_id==='hw1').done,0,'replayed receipt must not roll back a later operation');
 await ok('/check','older','POST',mark('hw1'));assert.equal(sent.length,1);
 assert.equal((await call('/check','older','POST',mark('bag','night'))).status,409);
 await ok('/check','older','POST',mark('bag','night'), 'older-child',tomorrow);assert.equal(sent.length,2);
 assert.equal((await call('/check','older','POST',mark('bag','morning'), 'older-child',tomorrow)).status,409);
 await ok('/check','older','POST',mark('bag','morning'));assert.equal(sent.length,3);
 s=await ok();assert.equal(s.summary.school_days,1);assert.equal(s.summary.completed,0,'first day has no prior-night check');
 const deliveries=(await db.prepare('SELECT * FROM learning_school_deliveries').all()).results;assert.equal(deliveries.length,3);assert.ok(deliveries.every(d=>d.recipient_id==='mom'));
 const d=deliveries[0];await db.prepare("UPDATE learning_school_deliveries SET status='pending' WHERE id=?").bind(d.id).run();
 async function checkDelivery(user='mom',session='mom',host='notification-auth.internal'){
  const u=new URL('https://'+host+'/internal/school-prep/notification-check');u.searchParams.set('delivery',d.id);u.searchParams.set('user',user);u.searchParams.set('session',session);return mf.dispatchFetch(u);
 }
 assert.equal((await (await checkDelivery()).json()).allowed,true);
 assert.equal((await (await checkDelivery('younger','younger')).json()).allowed,false);
 assert.equal((await (await checkDelivery('mom','missing')).json()).allowed,false);
 assert.equal((await checkDelivery('mom','mom','cetus.fun')).status,404);
 await ok('/confirm','mom','POST',{...plan,expected_revision:1,tasks:[{id:'new',kind:'homework',text:'改訂'}]});
 assert.equal((await (await checkDelivery()).json()).allowed,false,'new revision cancels a queued old notification');
 assert.equal((await ok('','older')).checks.length,0);
 assert.equal((await db.prepare('SELECT COUNT(*) n FROM learning_school_versions').first()).n,3);
 assert.ok((await db.prepare('SELECT COUNT(*) n FROM learning_school_checks WHERE revision=1').first()).n>0);
 // Backdated work stays on its selected day and current revision, not today's record.
 const yesterday=new Date(Date.parse(today+'T12:00:00Z')-86400000).toISOString().slice(0,10);
 const oldDay={...plan,day:yesterday,tasks:[{id:'old-hw',kind:'homework',text:'前日の宿題'}]};
 await ok('/confirm','mom','POST',oldDay,'older-child',yesterday);
 const beforeToday=(await db.prepare('SELECT * FROM learning_school_checks WHERE school_day=?').bind(today).all()).results;
 const late=mark('old-hw');
 await ok('/check','older','POST',late,'older-child',yesterday);
 await ok('/check','older','POST',late,'older-child',yesterday);
 const pastState=await ok('','older','GET',undefined,'older-child',yesterday);
 assert.equal(pastState.checks.find(c=>c.task_id==='old-hw').done,1);
 assert.deepEqual(pastState.checkable_phases,['homework','night','morning']);
 assert.equal((await db.prepare('SELECT COUNT(*) n FROM learning_school_receipts WHERE request_id=?').bind(late.request_id).first()).n,1);
 assert.deepEqual((await db.prepare('SELECT * FROM learning_school_checks WHERE school_day=?').bind(today).all()).results,beforeToday);
 assert.equal((await call('/check','younger','POST',late,'older-child',yesterday)).status,403);
 assert.equal((await call('/check','foreign','POST',late,'older-child',yesterday)).status,403);
 assert.equal((await call('/confirm','older','POST',{...oldDay,expected_revision:1},'older-child',yesterday)).status,403);
 await ok('/check','older','POST',mark('old-hw','homework',false),'older-child',yesterday);
 assert.equal((await ok('','older','GET',undefined,'older-child',yesterday)).checks[0].done,0);
 assert.deepEqual((await db.prepare('SELECT * FROM passbook_entries').all()).results,money);
 }finally{await mf.dispose();}
});
