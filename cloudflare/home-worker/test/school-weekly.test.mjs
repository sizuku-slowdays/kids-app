import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';

test('school templates and weekly import: family boundaries, atomic retries, unchanged checks and old balances',async()=>{
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

 assert.equal((await call('/template','older','PUT',{expected_revision:0,labels:['X']})).status,403);
 assert.equal((await call('/template','grandparent','PUT',{expected_revision:0,labels:['X']})).status,403);
 assert.equal((await call('/template','foreign','GET')).status,403);
 await ok('/template','mom','PUT',{expected_revision:0,labels:['漢字','計算','音読']});
 assert.deepEqual((await ok('/template','older')).labels,['漢字','計算','音読']);
 assert.deepEqual((await ok('/template','mom','GET',undefined,'younger-child')).labels,[]);
 await ok('/template','mom','PUT',{expected_revision:0,labels:['音読','かん字','さんすう']},'younger-child');
 assert.equal((await call('/template','mom','PUT',{expected_revision:0,labels:['stale']})).status,409);
 const monday='2026-11-02';
 const base={day:monday,expected_revision:0,is_school_day:true,dismissal:'14:30',tasks:[{id:'a',kind:'homework',text:'A'},{id:'b',kind:'homework',text:'B'},{id:'bag',kind:'belonging',text:'水筒'}]};
 await ok('/confirm','mom','POST',base,'older-child',monday);
 for(const [task,phase] of [['a','homework'],['b','homework'],['bag','night'],['bag','morning']])await db.prepare("INSERT INTO learning_school_checks VALUES('h','older-child',?,1,?,?,1,'older','now')").bind(monday,task,phase).run();
 const beforeChecks=(await db.prepare('SELECT * FROM learning_school_checks').all()).results;
 async function week(who='mom',method='GET',body,child='older-child',h='h'){
  const u=new URL('https://cetus.fun/wagaya/api/school-prep/week');for(const [k,v]of Object.entries({household:h,child,week:monday}))u.searchParams.set(k,v);
  const r=await mf.dispatchFetch(u,{method,headers:{Origin:'https://cetus.fun',Cookie:cookies[who],...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json()};
 }
 const preview=await week();assert.equal(preview.status,200);assert.equal(preview.data.days.length,5);
 assert.equal((await week('older','GET',undefined,'younger-child')).status,403);
 assert.equal((await week('foreign')).status,403);
 const days=preview.data.days.map((d,i)=>({day:d.day,action:i<2?'replace':'skip',expected_revision:d.revision,is_school_day:true,dismissal:d.dismissal,homework:i===0?['A','C']:['Tuesday']}));
 const body={week:monday,request_id:'weekly-test',days};
 assert.equal((await week('older','POST',body)).status,403);
 let result=await week('mom','POST',body);assert.equal(result.status,200,JSON.stringify(result));assert.equal(result.data.saved_days,2);
 const after=(await week()).data;assert.equal(after.days[0].revision,2);assert.equal(after.days[1].revision,1);assert.equal(after.days[2].revision,0);
 assert.deepEqual(after.days[0].tasks.map(t=>t.text),['A','C','水筒']);assert.equal(after.days[0].tasks[0].id,'a');
 assert.deepEqual(after.days[0].checks.map(c=>c.task_id).sort(),['a','bag','bag']);
 assert.equal(after.days[0].checks.filter(c=>c.done).length,3);
 assert.deepEqual((await db.prepare('SELECT * FROM learning_school_checks WHERE revision=1').all()).results,beforeChecks);
 const count=(await db.prepare('SELECT COUNT(*) n FROM learning_school_versions').first()).n;
 result=await week('mom','POST',body);assert.equal(result.status,200);assert.equal((await db.prepare('SELECT COUNT(*) n FROM learning_school_versions').first()).n,count);
 assert.equal((await week('mom','POST',{...body,days:days.map((d,i)=>i===0?{...d,homework:['different']}:d)})).status,409);
 // A conflict on the last changed day must not save the earlier one.
 const stale={...body,request_id:'stale-week',days:after.days.map((d,i)=>({day:d.day,action:i<2?'replace':'skip',expected_revision:i===1?0:d.revision,is_school_day:true,dismissal:d.dismissal,homework:['new']}))};
 assert.equal((await week('mom','POST',stale)).status,409);assert.equal((await db.prepare('SELECT COUNT(*) n FROM learning_school_versions').first()).n,count);
 const append={...body,request_id:'append-test',days:after.days.map((d,i)=>({day:d.day,action:i===0?'append':'skip',expected_revision:d.revision,is_school_day:false,dismissal:null,homework:i===0?['A','C','extra']:[]}))};
 assert.equal((await week('mom','POST',append)).status,200);let current=(await week()).data;
 assert.equal(current.days[0].is_school_day,true);assert.equal(current.days[0].dismissal,'14:30');assert.deepEqual(current.days[0].tasks.map(t=>t.text),['A','C','水筒','extra']);assert.equal(current.days[0].checks.length,3);
 await ok('/template','mom','PUT',{expected_revision:1,labels:['自由課題']});assert.equal((await week()).data.days[0].tasks.length,4);
 assert.deepEqual((await ok('/template','mom','GET',undefined,'younger-child')).labels,['音読','かん字','さんすう']);
 // Empty holiday day is an explicit version, never creates dummy template tasks.
 const holiday={...body,request_id:'holiday',days:current.days.map((d,i)=>({day:d.day,action:i===4?'replace':'skip',expected_revision:d.revision,is_school_day:false,dismissal:d.dismissal,homework:[]}))};
 assert.equal((await week('mom','POST',holiday)).status,200);current=(await week()).data;assert.equal(current.days[4].is_school_day,false);assert.equal(current.days[4].revision,1);assert.deepEqual(current.days[4].tasks,[]);
 // The database itself rejects a stale later-day batch and rolls all days back.
 const sqlPayload=JSON.stringify({input:{},days:[{day:monday,expected_revision:3,is_school_day:true,dismissal:null,tasks:[]},{day:'2026-11-03',expected_revision:0,is_school_day:true,dismissal:null,tasks:[]}]});
 const stable=(await db.prepare('SELECT COUNT(*) n FROM learning_school_versions').first()).n;
 await assert.rejects(()=>db.prepare("INSERT INTO learning_school_imports VALUES('h','older-child','race','mom',?,?, 'now')").bind(monday,sqlPayload).run(),/school import conflict/);
 assert.equal((await db.prepare('SELECT COUNT(*) n FROM learning_school_versions').first()).n,stable);
 assert.deepEqual((await db.prepare('SELECT * FROM passbook_entries').all()).results,money);assert.equal(sent.length,0);
 }finally{await mf.dispose();}
});
