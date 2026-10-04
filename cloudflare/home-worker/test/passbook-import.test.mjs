import test from 'node:test';import assert from 'node:assert/strict';import {readFile,readdir} from 'node:fs/promises';import {createHash} from 'node:crypto';import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
test('legacy backup, separate adult wallet, balances and import replay',async()=>{
 let retired=false;
 const legacyService=(request)=>{const url=new URL(request.url);return url.pathname==='/api/home-passbook-status'?Response.json({version:1,retired,service:url.hostname==='api.cetus.fun'?'bank':'chores',home:'https://home-worker.sslowdayss.workers.dev'}):Response.json({migrated:retired},{status:retired?410:200})};
 const mf=new Miniflare(convertV4MiniflareOptions({name:'home-worker',modules:true,scriptPath:new URL('../.wrangler/test-build/index.js',import.meta.url).pathname,compatibilityDate:'2026-10-01',compatibilityFlags:['nodejs_compat'],d1Databases:{DB:'import-home',LEGACY_DB:'import-legacy'},r2Buckets:['PRIVATE_FILES'],serviceBindings:{ASSETS:()=>new Response('shell'),LEGACY_BANK_SERVICE:legacyService,LEGACY_CHORE_SERVICE:legacyService},outboundService:()=>{throw new Error('public worker fetch must not be used')}}));
 try{
 const db=await mf.getD1Database('DB'),legacy=await mf.getD1Database('LEGACY_DB');
 for(const file of (await readdir(new URL('../migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort()){const sql=(await readFile(new URL('../migrations/'+file,import.meta.url),'utf8')).replace(/^--.*$/gm,'');for(const stmt of sql.match(/\s*CREATE TRIGGER[\s\S]*?\nEND;|[^;]+;/g)||[])await db.prepare(stmt).run()}
 const now=Math.floor(Date.now()/1000),tokens={mom:'a'.repeat(64),a:'b'.repeat(64),b:'c'.repeat(64)};
 for(const id of ['mom','a','b']){await db.prepare("INSERT INTO users(id,login_name,display_name,password_salt,password_hash,password_iterations,platform_role,created_at) VALUES (?,?,?,'s','h',1,?,?)").bind(id,id,id,id==='mom'?'operator':'user',now).run();await db.prepare("INSERT INTO sessions(id,token_hash,user_id,device_name,created_at,last_seen_at,expires_at) VALUES (?,?,?,'test',?,?,?)").bind(id,createHash('sha256').update(tokens[id]).digest('hex'),id,now,now,now+10000).run()}
 await db.prepare("INSERT INTO groups VALUES ('h','household','household','mom',?)").bind(now).run();for(const id of ['mom','a','b'])await db.prepare("INSERT INTO memberships VALUES ('h',?,?)").bind(id,id==='mom'?'owner':'member').run();await db.prepare("INSERT INTO group_apps VALUES ('h','passbook')").run();for(const id of ['a','b'])await db.prepare("INSERT INTO children VALUES (?,'h',?,?)").bind(id,id,id).run();
 for(const sql of ['CREATE TABLE chores(id TEXT,name TEXT,icon TEXT,points INTEGER,money INTEGER,enabled INTEGER,sort_order INTEGER)','CREATE TABLE chore_state(chore_id TEXT,next_assignee TEXT,rotation_order TEXT)','CREATE TABLE app_data(app TEXT,data_key TEXT,data_json TEXT,updated_at TEXT)','CREATE TABLE family_members(id TEXT,name TEXT,sort_order INTEGER)','CREATE TABLE chore_logs(id INTEGER,chore_name TEXT,completed_by TEXT,points INTEGER,money INTEGER,bank_synced INTEGER,created_at TEXT,completed_date TEXT)','CREATE TABLE rewards(id INTEGER,name TEXT,points INTEGER,stock INTEGER,enabled INTEGER)','CREATE TABLE reward_requests(id INTEGER,member_id TEXT,reward_id INTEGER,reward_name TEXT,points_cost INTEGER,status TEXT,requested_at TEXT,resolved_at TEXT)'])await legacy.prepare(sql).run();
 const bank={balances:{usagi:1375,kuma:625},history:Array.from({length:88},(_,i)=>({acc:i<44?'usagi':'kuma',type:i%2?'withdraw':'deposit',amount:10,memo:'original '+i,date:'2026/10/2 12:30'})),goals:{usagi:3000,kuma:5000},chores:[{name:'おふろあらい'}]};await legacy.prepare("INSERT INTO app_data VALUES ('mama-bank','main',?,'2026-10-03')").bind(JSON.stringify(bank)).run();
 for(const [id,name,points] of [['mama','ママ',2500],['ane','あね',830],['imouto','いもうと',890]]){await legacy.prepare('INSERT INTO family_members VALUES (?,?,1)').bind(id,name).run();await legacy.prepare("INSERT INTO chore_logs VALUES (?,?,?, ?,100,1,'2026-10-02 12:00:00','2026-10-02')").bind(points,name,id,points).run()}
 await legacy.prepare("INSERT INTO rewards VALUES (1,'おやつ',70,3,1)").run();await legacy.prepare("INSERT INTO reward_requests VALUES (1,'ane',1,'おやつ',70,'approved','2026-10-01','2026-10-02')").run();await legacy.prepare("INSERT INTO reward_requests VALUES (2,'imouto',1,'おやつ',70,'pending','2026-10-03',NULL)").run();
 async function call(path,who='mom',method='GET',body){const res=await mf.dispatchFetch('https://home.test/api/passbook'+path+'?household=h',{method,headers:{Origin:'https://home.test',Cookie:'__Host-home_session='+tokens[who],...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});return {status:res.status,data:await res.json()}}
 assert.equal((await call('/migration','a')).status,403);
 const mapping={bank:{usagi:'a',kuma:'b'},points:{mama:'user:mom',ane:'a',imouto:'b'}};
 const invalid=await call('/migration','mom','POST',{mapping:{bank:{usagi:'a',kuma:'a'},points:mapping.points}});assert.equal(invalid.status,409);assert.equal((await db.prepare('SELECT COUNT(*) n FROM passbook_imports').first()).n,0);
 const imported=await call('/migration','mom','POST',{mapping});assert.equal(imported.status,200,JSON.stringify(imported));assert.equal(imported.data.reconciled,true);assert.equal(imported.data.active,false);
 const report=(await call('/migration')).data;assert.equal(report.changed,false);assert.equal(report.summary.length,5);assert.deepEqual(Object.fromEntries(report.summary.map(r=>[r.target+':'+r.unit,r.balance])),{'a:cash':1375,'b:cash':625,'a:chores':760,'b:chores':890,'user:mom:chores':2500});
 const row=await db.prepare("SELECT backup_key FROM passbook_imports WHERE household_id='h'").first();const bucket=await mf.getR2Bucket('PRIVATE_FILES');const backup=JSON.parse(await(await bucket.get(row.backup_key)).text());assert.equal(backup.snapshot.bank_rows.length,1);assert.equal(JSON.parse(backup.snapshot.bank_rows[0].data_json).history.length,88);assert.equal(backup.snapshot.requests.length,2);
 assert.equal((await db.prepare('SELECT COUNT(*) n FROM passbook_entries WHERE source_app=\'legacy-bank\'').first()).n,88);assert.equal((await db.prepare('SELECT SUM(delta) n FROM passbook_adult_entries').first()).n,2500);assert.equal((await db.prepare('SELECT COUNT(*) n FROM children').first()).n,2);assert.equal((await db.prepare('SELECT COUNT(*) n FROM users').first()).n,3);
 const stage=(await call('')).data;assert.equal(stage.active,false);assert.equal(stage.imported,true);assert.equal(stage.accounts.length,5);assert.equal(stage.accounts.find(a=>a.child_id==='user:mom').balance,2500);assert.equal((await call('','a')).data.accounts.length,0);assert.equal((await call('/entries','mom','POST',{account_id:'h:a:cash',delta:100,memo:'test',event_id:'e'})).status,409);
 const count=(await db.prepare('SELECT COUNT(*) n FROM passbook_entries').first()).n;const replay=await call('/migration','mom','POST',{mapping});assert.equal(replay.status,200);assert.equal(replay.data.already_imported,true);assert.equal((await db.prepare('SELECT COUNT(*) n FROM passbook_entries').first()).n,count);
 assert.equal((await db.prepare('SELECT status FROM passbook_requests').first()).status,'pending');assert.equal((await db.prepare('SELECT stock FROM passbook_rewards').first()).stock,3);assert.equal((await legacy.prepare('SELECT COUNT(*) n FROM chore_logs').first()).n,3);
 await legacy.prepare("UPDATE app_data SET updated_at='changed'").run();assert.equal((await call('/migration')).data.changed,true);assert.equal((await db.prepare('SELECT COUNT(*) n FROM passbook_activation').first()).n,0);
 assert.equal((await call('/activation','a','POST',{confirmed:true})).status,403);
 assert.equal((await call('/activation','mom','POST',{confirmed:true})).status,409);
 retired=true;
 assert.equal((await call('/activation','mom','POST',{confirmed:true})).status,409);
 await legacy.prepare("UPDATE app_data SET updated_at='2026-10-03'").run();
 await bucket.put(row.backup_key,JSON.stringify({...backup,snapshot:{modified:true}}));
 assert.equal((await call('/activation','mom','POST',{confirmed:true})).status,409);
 await bucket.put(row.backup_key,JSON.stringify(backup));
 const started=await call('/activation','mom','POST',{confirmed:true});assert.equal(started.status,200,JSON.stringify(started));assert.equal(started.data.active,true);
 assert.equal((await call('','a')).data.accounts.some(a=>a.code==='cash'),true);
 assert.equal((await db.prepare("SELECT status FROM apps WHERE id='passbook'").first()).status,'ready');
 assert.equal((await call('/activation','mom','POST',{confirmed:true})).data.already_active,true);
 assert.equal((await db.prepare('SELECT COUNT(*) n FROM passbook_activation').first()).n,1);
 await legacy.prepare("INSERT INTO chores VALUES ('bath','おふろ','🛁',20,50,1,1)").run();await legacy.prepare("INSERT INTO chore_state VALUES ('bath','ane','mama,ane,imouto')").run();
 assert.equal((await call('/chores/import','a','POST',{})).status,403);
 const entriesBefore=(await db.prepare('SELECT COUNT(*) n FROM passbook_entries').first()).n;
 await bucket.put(row.backup_key,JSON.stringify({...backup,snapshot:{modified:true}}));assert.equal((await call('/chores/import','mom','POST',{})).status,409);assert.equal((await db.prepare('SELECT COUNT(*) n FROM passbook_chores').first()).n,0);await bucket.put(row.backup_key,JSON.stringify(backup));
 const choresImported=await call('/chores/import','mom','POST',{});assert.equal(choresImported.status,200,JSON.stringify(choresImported));assert.equal(choresImported.data.count,1);
 const c=(await call('/chores')).data.chores[0];assert.deepEqual(JSON.parse(c.rotation_json),['user:mom','a','b']);assert.equal(c.next_target,'a');assert.equal(c.money,50);
 assert.equal((await db.prepare('SELECT COUNT(*) n FROM passbook_entries').first()).n,entriesBefore);
 assert.equal((await call('/chores/import','mom','POST',{})).data.already_imported,true);
 assert.equal((await db.prepare('SELECT COUNT(*) n FROM passbook_chores').first()).n,1);
 const choreBackup=await db.prepare('SELECT backup_key FROM passbook_chore_imports').first();assert.equal(JSON.parse(await(await bucket.get(choreBackup.backup_key)).text()).raw.chores[0].id,'bath');
 assert.equal((await legacy.prepare('SELECT next_assignee FROM chore_state').first()).next_assignee,'ane');


 }finally{await mf.dispose()}
});
