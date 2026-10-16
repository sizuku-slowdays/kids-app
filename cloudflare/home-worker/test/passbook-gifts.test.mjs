import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
test('gifts: identity, household isolation, atomic approval, retries and ledger preservation',async()=>{
 const sent=[];let fails=false;
 const mf=new Miniflare(convertV4MiniflareOptions({name:'gift-test',modules:true,scriptPath:new URL('../.wrangler/test-build/index.js',import.meta.url).pathname,compatibilityDate:'2026-10-01',compatibilityFlags:['nodejs_compat'],d1Databases:{DB:'gift'},serviceBindings:{ASSETS:()=>new Response('asset'),NOTIFICATION_SERVICE:async req=>{sent.push(JSON.parse(await req.text()));return Response.json(fails?{ok:false}:{ok:true,protocol:'gift-v1',delivered:1},{status:fails?503:200});}}}));
 try{
 const db=await mf.getD1Database('DB'),now=Math.floor(Date.now()/1000),cookies={};
 const files=(await readdir(new URL('../migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort();
 async function migrate(f){const sql=(await readFile(new URL('../migrations/'+f,import.meta.url),'utf8')).replace(/^--.*$/gm,'');for(const s of sql.match(/\s*CREATE TRIGGER[\s\S]*?\nEND;|[^;]+;/g)||[])await db.prepare(s).run();}
 for(const f of files.filter(f=>!f.startsWith('0021')))await migrate(f);
 for(const [i,n]of ['mom','grandma','grandpa','kid','sibling','foreign','childadmin','unknown'].entries()){
 await db.prepare("INSERT INTO users(id,login_name,display_name,password_salt,password_hash,password_iterations,created_at) VALUES(?,?,?,'s','h',1,?)").bind(n,n,'HOME-'+n,now).run();const tok=String(i+1).repeat(64);cookies[n]='__Host-home_session='+tok;await db.prepare("INSERT INTO sessions VALUES(?,?,?,'test',?,?,?,NULL)").bind(n,createHash('sha256').update(tok).digest('hex'),n,now,now,now+3600).run();}
 for(const [h,user]of [['h','mom'],['f','foreign']]){await db.prepare("INSERT INTO groups VALUES(?,?,'household',?,?)").bind(h,h,user,now).run();await db.prepare("INSERT INTO memberships VALUES(?,?,'owner')").bind(h,user).run();for(const app of ['passbook','notification'])await db.prepare('INSERT INTO group_apps VALUES(?,?)').bind(h,app).run();await db.prepare("INSERT INTO passbook_activation VALUES(?,?,?,'fixture-backup')").bind(h,now,user).run();}
 for(const n of ['grandma','grandpa','kid','sibling','childadmin','unknown'])await db.prepare("INSERT INTO memberships VALUES('h',?,?)").bind(n,n==='childadmin'?'admin':'member').run();
 for(const n of ['mom','grandma','grandpa','childadmin'])await db.prepare("INSERT INTO home_member_attributes VALUES('h',?,?,'mom',?)").bind(n,n==='childadmin'?'child':'adult',new Date().toISOString()).run();
 for(const [c,h,u]of [['a','h','kid'],['b','h','sibling'],['other','f','foreign']])await db.prepare('INSERT INTO children VALUES(?,?,?,?)').bind(c,h,'alias-'+c,u).run();
 for(const [code,kind]of [['cash','money'],['chores','points'],['wallet','money'],['other','points']])await db.prepare("INSERT INTO passbook_units(id,household_id,code,name,kind,symbol) VALUES(?,'h',?,?,?,?)").bind(code,code,code,kind,kind==='money'?'円':'ポイント').run();
 for(const c of ['a','b'])for(const code of ['cash','chores','wallet','other']){const id=c+'-'+code;await db.prepare("INSERT INTO passbook_accounts VALUES(?,'h',?,?)").bind(id,c,code).run();await db.prepare("INSERT INTO passbook_entries(id,account_id,household_id,delta,memo,occurred_at,created_at,created_by,source_app,source_event) VALUES(?,?,'h',100,'opening','2026-10-01',?,'mom','fixture','opening')").bind(id,id,now).run();}
 await db.prepare("INSERT INTO passbook_settings VALUES('h',1)").run();
 const tables=(await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'").all()).results.map(t=>t.name),old={};for(const t of tables)old[t]=JSON.stringify((await db.prepare('SELECT * FROM "'+t+'" ORDER BY rowid').all()).results);
 await migrate(files.find(f=>f.startsWith('0021')));for(const t of tables)assert.equal(JSON.stringify((await db.prepare('SELECT * FROM "'+t+'" ORDER BY rowid').all()).results),old[t],'migration keeps '+t);
 async function call(path='',who='grandma',method='GET',body,h='h',origin='https://cetus.fun'){const r=await mf.dispatchFetch('https://cetus.fun/wagaya/api/passbook'+path+(path.includes('?')?'&':'?')+'household='+h,{method,headers:{Origin:origin,...(who?{Cookie:cookies[who]}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json()};}
 const ok=async(...a)=>{const r=await call(...a);assert.equal(r.status,200,JSON.stringify(r));return r.data;};
 const sum=async a=>(await db.prepare('SELECT SUM(delta) n FROM passbook_entries WHERE account_id=?').bind(a).first()).n;
 const input=(kind='points',amount=10)=>({child_id:'a',kind,amount,reason:'Helped carry shopping',event_id:crypto.randomUUID()});
 assert.equal((await call('/gifts',null)).status,401);assert.equal((await call('/gifts','foreign')).status,403);
 const root=await ok();assert.equal(root.gift_only,true);assert.deepEqual(root.accounts,[]);
 for(const path of ['/history?account=a-cash','/history?account=a-chores','/finance','/chores','/requests'])assert.equal((await call(path)).status,403,path);
 const initial=await ok('/gifts');assert.equal(initial.targets.length,2);assert.equal(JSON.stringify(initial).includes('balance'),false);
 for(const who of ['kid','childadmin','unknown'])assert.equal((await call('/gifts',who,'POST',input())).status,403);
 for(const b of [{...input(),sender_id:'mom'},{...input(),amount:-1},{...input(),amount:1.1},{...input(),amount:10000001},{...input(),reason:''},{...input(),kind:'good-deeds'},{...input(),child_id:'other'}])assert.ok((await call('/gifts','grandma','POST',b)).status>=400);
 assert.equal((await call('/gifts','grandma','POST',input(),'h','https://bad.test')).status,403);
 const b=input();fails=true;const saved=await ok('/gifts','grandma','POST',b);assert.equal(await sum('a-chores'),100);assert.equal((await ok('/gifts','kid')).records.length,0);assert.equal((await ok('/gifts','grandpa')).records.length,0);assert.equal((await ok('/gifts','mom')).access.pending,1);
 assert.equal((await ok('/gifts','grandma','POST',b)).id,saved.id);assert.equal((await db.prepare('SELECT COUNT(*) n FROM passbook_gift_requests').first()).n,1);assert.equal((await call('/gifts','grandma','POST',{...b,amount:20})).status,409);
 for(const who of ['grandma','kid','childadmin'])assert.equal((await call('/gifts/'+saved.id,who,'PUT',{status:'approved'})).status,403);
 const notice=await db.prepare('SELECT * FROM passbook_gift_notifications WHERE gift_id=?').bind(saved.id).first();assert.equal(notice.recipient_id,'mom');assert.equal(notice.status,'pending');
 async function live(user='mom',session='mom',host='notification-auth.internal'){const u=new URL('https://'+host+'/internal/passbook-gifts/notification-check');for(const [k,v]of Object.entries({delivery:notice.id,user,session}))u.searchParams.set(k,v);return mf.dispatchFetch(u);}
 assert.equal((await (await live()).json()).allowed,true);assert.equal((await (await live('grandma','grandma')).json()).allowed,false);assert.equal((await (await live('mom','missing')).json()).allowed,false);assert.equal((await live('mom','mom','cetus.fun')).status,404);
 fails=false;await ok('/gifts/retry','mom','POST',{});assert.equal((await db.prepare('SELECT status FROM passbook_gift_notifications WHERE id=?').bind(notice.id).first()).status,'sent');
 const approvals=await Promise.all([call('/gifts/'+saved.id,'mom','PUT',{status:'approved'}),call('/gifts/'+saved.id,'mom','PUT',{status:'approved'})]);assert.ok(approvals.every(r=>r.status===200),JSON.stringify(approvals));assert.equal(await sum('a-chores'),110);assert.equal((await call('/gifts/'+saved.id,'mom','PUT',{status:'rejected'})).status,409);
 const received=await ok('/gifts','kid');assert.equal(received.records.length,1);assert.equal(received.records[0].sender_name,'HOME-grandma');assert.equal(received.records[0].reason,b.reason);assert.equal((await ok('/gifts','sibling')).records.length,0);
 const cash=await ok('/gifts','grandpa','POST',input('cash',500));await ok('/gifts/'+cash.id,'mom','PUT',{status:'approved'});assert.equal(await sum('a-cash'),600);assert.equal(await sum('a-wallet'),100);assert.equal(await sum('a-other'),100);
 const reject=await ok('/gifts','grandma','POST',input());await ok('/gifts/'+reject.id,'mom','PUT',{status:'rejected'});await ok('/gifts/'+reject.id,'mom','PUT',{status:'rejected'});assert.equal(await sum('a-chores'),110);assert.ok(!(await ok('/gifts','kid')).records.some(r=>r.id===reject.id));
 const atomic=await ok('/gifts','grandma','POST',input());await db.prepare("CREATE TRIGGER fixture_failure BEFORE INSERT ON passbook_entries WHEN NEW.source_event='"+atomic.id+"' BEGIN SELECT RAISE(ABORT,'fixture credit failure'); END").run();assert.equal((await call('/gifts/'+atomic.id,'mom','PUT',{status:'approved'})).status,500);assert.equal((await db.prepare('SELECT status FROM passbook_gift_requests WHERE id=?').bind(atomic.id).first()).status,'pending');assert.equal(await sum('a-chores'),110);await db.prepare('DROP TRIGGER fixture_failure').run();await ok('/gifts/'+atomic.id,'mom','PUT',{status:'approved'});assert.equal(await sum('a-chores'),120);
 const blocked=await ok('/gifts','grandma','POST',input());await ok('/gifts/permissions','mom','PUT',{child_id:'a',target_sender_id:'grandma',enabled:false});assert.ok(!(await ok('/gifts','grandma')).targets.some(t=>t.id==='a'));assert.equal((await call('/gifts','grandma','POST',input())).status,409);assert.equal((await call('/gifts/'+blocked.id,'mom','PUT',{status:'approved'})).status,409);await ok('/gifts/'+blocked.id,'mom','PUT',{status:'rejected'});
 assert.equal((await call('/gifts/permissions','grandpa')).status,403);assert.equal((await call('/gifts/permissions','mom','PUT',{child_id:'other',target_sender_id:'grandma',enabled:true})).status,409);
 await db.prepare("UPDATE memberships SET role='admin' WHERE group_id='h' AND user_id='grandpa'").run();const self=await ok('/gifts','grandpa','POST',input());assert.equal((await call('/gifts/'+self.id,'grandpa','PUT',{status:'approved'})).status,403);await ok('/gifts/'+self.id,'mom','PUT',{status:'rejected'});
 for(const t of tables.filter(t=>!['sessions','auth_attempts','passbook_entries','memberships'].includes(t)))assert.equal(JSON.stringify((await db.prepare('SELECT * FROM "'+t+'" ORDER BY rowid').all()).results),old[t],'gift operations keep '+t);
 assert.equal(JSON.stringify((await db.prepare("SELECT * FROM passbook_entries WHERE source_app='fixture' ORDER BY rowid").all()).results),old.passbook_entries);
 assert.equal((await db.prepare("SELECT COUNT(*) n FROM passbook_entries WHERE source_app='gift'").first()).n,3);assert.equal((await db.prepare('PRAGMA foreign_key_check').all()).results.length,0);
 }finally{await mf.dispose();}
});
