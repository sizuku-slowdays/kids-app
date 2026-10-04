import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
test('passbook ownership, migration gate, reservations and atomic approval',async()=>{
 const mf=new Miniflare(convertV4MiniflareOptions({name:'home-worker',modules:true,scriptPath:new URL('../.wrangler/test-build/index.js',import.meta.url).pathname,compatibilityDate:'2026-10-01',compatibilityFlags:['nodejs_compat'],d1Databases:{DB:'passbook-test'},r2Buckets:['PRIVATE_FILES'],serviceBindings:{ASSETS:()=>new Response('protected-app')}}));
 try {
 const db=await mf.getD1Database('DB');
 for(const file of (await readdir(new URL('../migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort()){
  const sql=(await readFile(new URL('../migrations/'+file,import.meta.url),'utf8')).replace(/^--.*$/gm,'');
  for(const stmt of sql.match(/\s*CREATE TRIGGER[\s\S]*?\nEND;|[^;]+;/g)||[])await db.prepare(stmt).run();
 }
 const now=Math.floor(Date.now()/1000),cookies={};
 for(const [n,role] of [['mom','operator'],['child','user'],['sibling','user'],['stranger','user']]){
 await db.prepare("INSERT INTO users(id,login_name,display_name,password_salt,password_hash,password_iterations,platform_role,created_at) VALUES (?,?,?,'s','h',1,?,?)").bind(n,n,n,role,now).run();const token=(n==='mom'?'a':n==='child'?'b':n==='sibling'?'c':'d').repeat(64);cookies[n]='__Host-home_session='+token;await db.prepare('INSERT INTO sessions(id,token_hash,user_id,device_name,created_at,last_seen_at,expires_at) VALUES (?,?,?,\'test\',?,?,?)').bind(n,createHash('sha256').update(token).digest('hex'),n,now,now,now+10000).run();
 }
 await db.prepare("INSERT INTO groups VALUES ('h','home','household','mom',?)").bind(now).run();await db.prepare("INSERT INTO groups VALUES ('other','other','household','stranger',?)").bind(now).run();
 for(const n of ['mom','child','sibling','stranger'])await db.prepare('INSERT INTO memberships VALUES (?,?,?)').bind(n==='stranger'?'other':'h',n,n==='mom'?'owner':'member').run();
 await db.prepare("INSERT INTO group_apps VALUES ('h','passbook')").run();await db.prepare("INSERT INTO group_apps VALUES ('other','passbook')").run();
 await db.prepare("INSERT INTO children VALUES ('c','h','child','child')").run();await db.prepare("INSERT INTO children VALUES ('s','h','sibling','sibling')").run();
 for(const [id,kind,name] of [['cash','money','現金'],['chores','points','お手伝いポイント'],['good','points','いいことポイント']])await db.prepare('INSERT INTO passbook_units(id,household_id,code,name,kind,symbol) VALUES (?,\'h\',?,?,?,?)').bind(id,id,name,kind,kind==='money'?'円':'ポイント').run();
 for(const c of ['c','s'])for(const u of ['cash','chores','good'])await db.prepare('INSERT INTO passbook_accounts VALUES (?,\'h\',?,?)').bind(c+'-'+u,c,u).run();
 async function call(path='',who='mom',method='GET',body,origin='https://home.test'){const res=await mf.dispatchFetch('https://home.test'+(path.startsWith('/apps/')?path:'/api/passbook'+path+(path.includes('?')?'&':'?')+'household=h'),{method,redirect:'manual',headers:{Origin:origin,...(who?{Cookie:cookies[who]}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});let data;try{data=await res.json()}catch{}return{status:res.status,data};}
 assert.equal((await call('',null)).status,401);assert.equal((await call('/apps/passbook/',null)).status,303);assert.equal((await call('/apps/passbook/','mom')).status,200);
 assert.equal((await call()).data.active,false);assert.equal((await call('/legacy-preview')).data.configured,false);assert.equal((await call('/legacy-preview','child')).status,403);assert.equal((await call('/entries','mom','POST',{account_id:'c-cash',delta:100,memo:'test',event_id:'1'})).status,409);
 await db.prepare("INSERT INTO passbook_activation VALUES ('h',?,'mom','test-backup')").bind(now).run();
 for(const a of ['c-cash','c-chores','s-cash','s-chores'])await db.prepare("INSERT INTO passbook_entries(id,account_id,household_id,delta,memo,occurred_at,created_at,created_by,source_app,source_event) VALUES (?,?,'h',100,'opening','2026-10-03',?,'mom','test','opening')").bind(a,a,now).run();
 assert.equal((await call('','stranger')).status,403);assert.equal((await call('','child')).data.accounts.length,3);assert.equal((await call('/history?account=s-cash','child')).status,403);assert.equal((await call('/entries','child','POST',{account_id:'c-cash',delta:10,memo:'bad',event_id:'2'})).status,403);assert.equal((await call('/entries','mom','POST',{},'https://bad.test')).status,403);
 await call('/settings','mom','PUT',{sibling_points_visible:true});const visible=(await call('','child')).data.accounts;assert.equal(visible.length,5);assert.ok(!visible.some(a=>a.id==='s-cash'));assert.equal((await call('/history?account=s-chores','child')).status,200);
 const post={account_id:'c-cash',delta:10,memo:'deposit',event_id:'same-click'};assert.equal((await call('/entries','mom','POST',post)).status,200);assert.equal((await call('/entries','mom','POST',post)).status,200);assert.equal((await db.prepare('SELECT SUM(delta) n FROM passbook_entries WHERE account_id=\'c-cash\'').first()).n,110);
 const reward=(await call('/rewards','mom','POST',{unit_id:'chores',name:'おやつ',cost:70,stock:1})).data.id;const req=await call('/requests','child','POST',{reward_id:reward});assert.equal(req.status,201);assert.equal((await call('/requests','child','POST',{reward_id:reward})).status,409);
 assert.equal((await call('/entries','mom','POST',{account_id:'c-chores',delta:-50,memo:'withdraw',event_id:'reserved'})).status,409);
 const r2=(await call('/rewards','mom','POST',{unit_id:'chores',name:'other',cost:50,stock:null})).data.id;assert.equal((await call('/requests','child','POST',{reward_id:r2})).status,409);
 assert.equal((await call('/requests/'+req.data.id,'child','PUT',{status:'approved'})).status,403);const approvals=await Promise.all([call('/requests/'+req.data.id,'mom','PUT',{status:'approved'}),call('/requests/'+req.data.id,'mom','PUT',{status:'approved'})]);assert.deepEqual(approvals.map(r=>r.status).sort(),[200,409]);
 assert.equal((await db.prepare("SELECT SUM(delta) n FROM passbook_entries WHERE account_id='c-chores'").first()).n,30);assert.equal((await db.prepare('SELECT stock FROM passbook_rewards WHERE id=?').bind(reward).first()).stock,0);
 assert.equal((await call('/requests','sibling','POST',{reward_id:reward})).status,409);assert.equal((await db.prepare("SELECT SUM(delta) n FROM passbook_entries WHERE account_id='s-chores'").first()).n,100);
 // A daily completion atomically credits both currencies, then advances once.
 const today=new Date(Date.now()+9*3600000).toISOString().slice(0,10);
 const created=await call('/chores','mom','POST',{name:'おふろ',icon:'🛁',points:20,money:50,point_unit_id:'chores',rotation:['c','s'],next_target:'c'});assert.equal(created.status,200,JSON.stringify(created));const chore=created.data.id;
 assert.equal((await call('/chores','stranger')).status,403);
 assert.equal((await call('/chores/complete','child','POST',{chore_id:chore,target:'c',event_id:'child-forge'})).status,403);
 assert.equal((await call('/chores/complete','mom','POST',{chore_id:chore,target:'c',event_id:'origin-denied'},'https://bad.test')).status,403);
 assert.equal((await call('/chores/complete','mom','POST',{chore_id:chore,target:'stranger',event_id:'foreign-target'})).status,400);
 const done={chore_id:chore,target:'c',event_id:'complete-once',revision:1};
 const completions=await Promise.all([call('/chores/complete','mom','POST',done),call('/chores/complete','mom','POST',{...done,event_id:'another-tab'})]);assert.deepEqual(completions.map(v=>v.status).sort(),[200,409]);
 assert.equal((await call('/chores/complete','mom','POST',done)).status,200);
 assert.equal((await db.prepare("SELECT SUM(delta) n FROM passbook_entries WHERE account_id='c-cash'").first()).n,160);
 assert.equal((await db.prepare("SELECT SUM(delta) n FROM passbook_entries WHERE account_id='c-chores'").first()).n,50);
 assert.equal((await db.prepare('SELECT COUNT(*) n FROM passbook_chore_days WHERE chore_id=?').bind(chore).first()).n,1);
 assert.equal((await db.prepare('SELECT next_target FROM passbook_chores WHERE id=?').bind(chore).first()).next_target,'s');
 // Missed days advance on reopening, without any financial credit, and retries do not advance twice.
 const missed=(await call('/chores','mom','POST',{name:'そうじ',points:10,money:0,point_unit_id:'good',rotation:['c','s'],next_target:'c'})).data.id;
 const yesterday=new Date(Date.parse(today+'T00:00:00Z')-86400000).toISOString().slice(0,10);
 await db.prepare('UPDATE passbook_chores SET next_date=? WHERE id=?').bind(yesterday,missed).run();
 const balanceBefore=(await db.prepare('SELECT COUNT(*) n FROM passbook_entries').first()).n;
 await Promise.all([call('/chores','child'),call('/chores','mom')]);
 assert.equal((await db.prepare('SELECT next_target FROM passbook_chores WHERE id=?').bind(missed).first()).next_target,'s');
 assert.equal((await db.prepare('SELECT COUNT(*) n FROM passbook_entries').first()).n,balanceBefore);
 assert.equal((await call('/chores/complete','mom','POST',{chore_id:missed,target:'s',event_id:'good-point-kind',revision:2})).status,200);
 assert.equal((await db.prepare("SELECT SUM(delta) n FROM passbook_entries WHERE account_id='s-good'").first()).n,10);
 // Missing cash wallet rolls back points, day and rotation as one transaction.
 await db.prepare("INSERT INTO passbook_adult_accounts VALUES ('adult','h','mom','chores')").run();
 const missing=(await call('/chores','mom','POST',{name:'買い物',points:40,money:100,point_unit_id:'chores',rotation:[],next_target:null})).data.id;
 const blocked=await call('/chores/complete','mom','POST',{chore_id:missing,target:'user:mom',event_id:'no-cash-wallet',revision:1});assert.equal(blocked.status,409,JSON.stringify(blocked));
 assert.equal((await db.prepare('SELECT COUNT(*) n FROM passbook_adult_entries').first()).n,0);assert.equal((await db.prepare('SELECT COUNT(*) n FROM passbook_chore_days WHERE chore_id=?').bind(missing).first()).n,0);
 const conf=(await call('/chores')).data.chores.find(c=>c.id===missing);
 assert.equal((await call('/chores/'+missing,'mom','PUT',{...conf,point_unit_id:'chores',rotation:[],money:0,enabled:true})).status,200);
 assert.equal((await call('/chores/'+missing,'mom','PUT',{...conf,point_unit_id:'chores',rotation:[],money:0,enabled:true})).status,409);
 assert.equal((await call('/chores/complete','mom','POST',{chore_id:missing,target:'user:mom',event_id:'adult-points-only',revision:2})).status,200);
 assert.equal((await db.prepare('SELECT SUM(delta) n FROM passbook_adult_entries').first()).n,40);
 } finally {await mf.dispose()}
});
