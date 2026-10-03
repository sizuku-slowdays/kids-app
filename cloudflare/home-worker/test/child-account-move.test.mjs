import test from 'node:test';import assert from 'node:assert/strict';import {readFile,readdir} from 'node:fs/promises';import {createHash} from 'node:crypto';import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
test('correct child linkage atomically without replacing accounts or moving existing data',async()=>{
 const mf=new Miniflare(convertV4MiniflareOptions({name:'home-worker',modules:true,scriptPath:new URL('../.wrangler/test-build/index.js',import.meta.url).pathname,compatibilityDate:'2026-10-01',d1Databases:{DB:'child-move'},r2Buckets:['PRIVATE_FILES'],serviceBindings:{ASSETS:()=>new Response('shell')}}));
 try{
 const db=await mf.getD1Database('DB');
 for(const file of (await readdir(new URL('../migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort()){const sql=(await readFile(new URL('../migrations/'+file,import.meta.url),'utf8')).replace(/^--.*$/gm,'');for(const stmt of sql.match(/\s*CREATE TRIGGER[\s\S]*?\nEND;|[^;]+;/g)||[])await db.prepare(stmt).run()}
 const now=Math.floor(Date.now()/1000),tokens={mom:'a'.repeat(64),kid:'b'.repeat(64)};
 for(const id of ['mom','kid']){await db.prepare("INSERT INTO users(id,login_name,display_name,password_salt,password_hash,password_iterations,created_at) VALUES (?,?,?,'salt','original-hash',1,?)").bind(id,id,id,now).run();await db.prepare("INSERT INTO sessions(id,token_hash,user_id,device_name,created_at,last_seen_at,expires_at) VALUES (?,?,?,'test',?,?,?)").bind(id,createHash('sha256').update(tokens[id]).digest('hex'),id,now,now,now+10000).run()}
 await db.prepare("INSERT INTO groups VALUES ('h','home','household','mom',?)").bind(now).run();await db.prepare("INSERT INTO groups VALUES ('other','other','household','mom',?)").bind(now).run();await db.prepare("INSERT INTO memberships VALUES ('h','mom','owner')").run();await db.prepare("INSERT INTO memberships VALUES ('h','kid','member')").run();await db.prepare("INSERT INTO children VALUES ('older','h','older','kid'),('younger','h','younger',NULL),('foreign','other','foreign',NULL)").run();
 await db.prepare("INSERT INTO invitations VALUES ('invite','token','mom','h',?,NULL,NULL,'younger',?)").bind(now+10000,now).run();
 async function move(source,target,who='mom',origin='https://home.test'){return mf.dispatchFetch('https://home.test/api/children/move-account',{method:'POST',headers:{Origin:origin,Cookie:'__Host-home_session='+tokens[who],'Content-Type':'application/json'},body:JSON.stringify({source_child_id:source,target_child_id:target,user_id:'kid'})})}
 assert.equal((await move('older','younger','kid')).status,409);assert.equal((await move('older','younger','mom','https://evil.test')).status,403);assert.equal((await move('older','foreign')).status,409);
 assert.equal((await move('older','younger')).status,200);
 assert.equal((await db.prepare("SELECT user_id FROM children WHERE id='older'").first()).user_id,null);assert.equal((await db.prepare("SELECT user_id FROM children WHERE id='younger'").first()).user_id,'kid');
 assert.equal((await db.prepare("SELECT password_hash FROM users WHERE id='kid'").first()).password_hash,'original-hash');assert.equal((await db.prepare('SELECT COUNT(*) n FROM users').first()).n,2);
 assert.ok((await db.prepare("SELECT revoked_at FROM sessions WHERE user_id='kid'").first()).revoked_at);assert.ok((await db.prepare("SELECT revoked_at FROM invitations WHERE id='invite'").first()).revoked_at);
 assert.equal((await move('older','younger')).status,409);assert.equal((await db.prepare('SELECT COUNT(*) n FROM child_account_moves').first()).n,1);
 await db.prepare("INSERT INTO passbook_imports VALUES ('h','hash','private-key','mom',?,'[]')").bind(now).run();assert.equal((await move('younger','older')).status,409);assert.equal((await db.prepare("SELECT user_id FROM children WHERE id='younger'").first()).user_id,'kid');
 }finally{await mf.dispose()}
});
