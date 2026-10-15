import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
test('good deeds are separate zero-start records, HOME-owned per child, capped and recoverable',async()=>{
 const mf=new Miniflare(convertV4MiniflareOptions({name:'good-test',modules:true,scriptPath:new URL('../.wrangler/test-build/index.js',import.meta.url).pathname,compatibilityDate:'2026-10-01',compatibilityFlags:['nodejs_compat'],d1Databases:{DB:'good'},serviceBindings:{ASSETS:()=>new Response('asset',{headers:{'Content-Type':'text/html'}})}}));
 try{
 const db=await mf.getD1Database('DB');for(const f of (await readdir(new URL('../migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort()){
 const source=(await readFile(new URL('../migrations/'+f,import.meta.url),'utf8')).replace(/^--.*$/gm,'');for(const stmt of source.match(/\s*CREATE TRIGGER[\s\S]*?\nEND;|[^;]+;/g)||[])await db.prepare(stmt).run();}
 const now=Math.floor(Date.now()/1000),cookies={};for(const [i,n]of ['mom','older','younger','foreign','grandparent'].entries()){
 await db.prepare("INSERT INTO users(id,login_name,display_name,password_salt,password_hash,password_iterations,created_at) VALUES (?,?,?,'s','h',1,?)").bind(n,n,'HOME-'+n,now).run();const token=String(i+1).repeat(64);cookies[n]='__Host-home_session='+token;await db.prepare("INSERT INTO sessions VALUES (?,?,?,'test',?,?,?,NULL)").bind(n,createHash('sha256').update(token).digest('hex'),n,now,now,now+3600).run();}
 for(const [h,owner]of [['h','mom'],['f','foreign']]){await db.prepare("INSERT INTO groups VALUES (?,?,'household',?,?)").bind(h,h,owner,now).run();await db.prepare("INSERT INTO memberships VALUES (?,?,'owner')").bind(h,owner).run();await db.prepare("INSERT INTO group_apps VALUES (?,'good-deeds')").bind(h).run();}
 for(const n of ['older','younger','grandparent'])await db.prepare("INSERT INTO memberships VALUES ('h',?,'member')").bind(n).run();
 for(const n of ['older','younger'])await db.prepare("INSERT INTO children VALUES (?,'h',?,?)").bind(n+'-child','OLD-ALIAS-'+n,n).run();
 // Existing cash and chore points are seeded and must remain byte-for-byte equivalent.
 for(const [id,kind]of [['cash','money'],['chores','points']]){await db.prepare("INSERT INTO passbook_units(id,household_id,code,name,kind,symbol) VALUES (?,'h',?,?,?,'unit')").bind(id,id,id,kind).run();await db.prepare("INSERT INTO passbook_accounts VALUES (?,'h','older-child',?)").bind('account-'+id,id).run();await db.prepare("INSERT INTO passbook_entries(id,account_id,household_id,delta,memo,occurred_at,created_at,created_by,source_app,source_event) VALUES (?,?,'h',123,'unchanged','2026-10-01',?,'mom','fixture','seed')").bind('entry-'+id,'account-'+id,now).run();}
 const original=await db.prepare('SELECT * FROM passbook_entries ORDER BY id').all();
 async function call(path='',who='mom',method='GET',body,h='h'){
 const url='https://cetus.fun/wagaya/api/good-deeds'+path+(path.includes('?')?'&':'?')+'household='+h;const r=await mf.dispatchFetch(url,{method,headers:{Origin:'https://cetus.fun',...(who?{Cookie:cookies[who]}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json()};}
 const ok=async(...args)=>{const r=await call(...args);assert.equal(r.status,200,JSON.stringify(r));return r.data;};
 assert.equal((await call('',null)).status,401);
 const asset=await mf.dispatchFetch('https://cetus.fun/wagaya/apps/good-deeds/',{redirect:'manual'});assert.equal(asset.status,303);assert.equal(asset.headers.get('Location'),'/wagaya/login');
 assert.equal((await call('','foreign')).status,403);assert.equal((await call('','grandparent')).status,403);
 let m=await ok();assert.equal(m.children.length,2);assert.ok(m.children.every(c=>c.total===0&&c.started_at));assert.equal(m.children[0].display_name,'HOME-older');
 let older=await ok('','older');assert.equal(older.children.length,1);assert.equal(older.children[0].id,'older-child');assert.equal(JSON.stringify(older).includes('HOME-younger'),false);
 assert.equal((await call('?child=younger-child','older')).status,403);assert.equal((await call('?owner=saru','older')).status,400);assert.equal((await call('?child=older-child','foreign')).status,403);
 const post={title:'宿題をがんばった',point:50,memo:'test',event_id:'daily-record-once'};
 const added=await ok('/records','older','POST',post);const replay=await ok('/records','older','POST',post);assert.equal(added.id,replay.id);
 assert.equal((await call('/records','older','POST',{...post,point:51})).status,409);
 assert.equal((await call('/records','older','POST',{...post,event_id:'forged-owner',user_id:'younger'})).status,400);
 assert.equal((await call('/records?child=younger-child','older','POST',{...post,event_id:'forged-child'})).status,403);
 assert.equal((await call('/records','older','POST',{...post,event_id:'negative-points',point:-1})).status,400);
 assert.equal((await ok('','younger')).children[0].total,0);assert.equal((await ok('','older')).children[0].total,50);
 await ok('/start','older','POST',{});assert.equal((await ok('','older')).children[0].total,50);assert.equal((await db.prepare('SELECT COUNT(*) n FROM good_deed_starts').first()).n,2);
 assert.equal((await call('/records/'+added.id,'younger','DELETE')).status,403);
 assert.equal((await call('?child=younger-child&before='+added.id,'mom')).status,403);
 await ok('/records/'+added.id,'older','DELETE');await ok('/records/'+added.id,'older','DELETE');assert.equal((await ok('','older')).children[0].total,0);
 assert.equal((await db.prepare("SELECT COUNT(*) n FROM good_deed_changes WHERE kind='delete'").first()).n,1);
 assert.equal((await call('/records/'+added.id+'/restore','older','POST',{})).status,403);await ok('/records/'+added.id+'/restore?child=older-child','mom','POST',{});assert.equal((await ok('','older')).children[0].total,50);
 await ok('/records?child=younger-child','mom','POST',{...post,title:'保護者が追加',point:10,event_id:'parent-for-child'});assert.equal((await ok('','younger')).children[0].total,10);
 assert.equal((await call('?trash=1','older')).status,403);
 // Same event submitted concurrently at the cap remains a single successful credit.
 const full={title:'cap',point:99999950,memo:'',event_id:'at-limit-once'};const pair=await Promise.all([ok('/records','older','POST',full),ok('/records','older','POST',full)]);assert.equal(pair[0].id,pair[1].id);
 assert.equal((await call('/records','older','POST',{...post,point:1,event_id:'over-limit'})).status,409);
 assert.equal((await ok('','older')).children[0].total,100000000);
 assert.deepEqual((await db.prepare('SELECT * FROM passbook_entries ORDER BY id').all()).results,original.results);
 assert.deepEqual((await db.prepare('PRAGMA foreign_key_check').all()).results,[]);
 }finally{await mf.dispose();}
});
