import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
test('HOME layout: preserved defaults, per-user atomic saves, guardian scopes, concurrent writes, retry and rollback',async()=>{
 const mf=new Miniflare(convertV4MiniflareOptions({name:'layout',modules:true,scriptPath:new URL('../.wrangler/test-build/index.js',import.meta.url).pathname,compatibilityDate:'2026-10-01',compatibilityFlags:['nodejs_compat'],d1Databases:{DB:'layout'},serviceBindings:{ASSETS:()=>new Response('asset')}}));
 try{
 const db=await mf.getD1Database('DB'),files=(await readdir(new URL('../migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort(),tokens={},now=Math.floor(Date.now()/1000);
 const migrate=async f=>{const sql=(await readFile(new URL('../migrations/'+f,import.meta.url),'utf8')).replace(/^--.*$/gm,'');for(const s of sql.match(/\s*CREATE TRIGGER[\s\S]*?\nEND;|[^;]+;/g)||[])await db.prepare(s).run();};
 for(const f of files.filter(f=>!f.startsWith('0023')))await migrate(f);
 for(const [i,u] of ['mom','grandma','kid','outside','childadmin'].entries()){tokens[u]=String(i+1).repeat(64);await db.prepare("INSERT INTO users(id,login_name,display_name,password_salt,password_hash,password_iterations,created_at) VALUES(?,?,?,'s','h',1,?)").bind(u,u,u,now).run();await db.prepare("INSERT INTO sessions VALUES(?,?,?,'fixture',?,?,?,NULL)").bind(u,createHash('sha256').update(tokens[u]).digest('hex'),u,now,now,now+3600).run();}
 await db.prepare("INSERT INTO groups VALUES('h','Household','household','mom',?)").bind(now).run();
 for(const u of ['mom','grandma','kid','childadmin']){await db.prepare("INSERT INTO memberships VALUES('h',?,?)").bind(u,u==='mom'?'owner':u==='childadmin'?'admin':'member').run();await db.prepare("INSERT INTO home_member_attributes VALUES('h',?,?,'mom','fixture')").bind(u,u==='childadmin'||u==='kid'?'child':'adult').run();}
 await db.prepare("INSERT INTO children VALUES('c','h','Child','kid')").run();
 for(const a of ['calendar','notification','passbook'])await db.prepare("INSERT INTO group_apps VALUES('h',?)").bind(a).run();
 await db.prepare("INSERT INTO user_apps VALUES('grandma','calendar',1,1),('grandma','notification',0,2),('mom','passbook',1,0)").run();
 await db.prepare("INSERT INTO home_preferences VALUES('grandma','[\"calendar\"]')").run();
 const before={};for(const t of ['users','memberships','user_apps','home_preferences'])before[t]=JSON.stringify((await db.prepare('SELECT * FROM '+t+' ORDER BY rowid').all()).results);
 await migrate(files.find(f=>f.startsWith('0023')));for(const t of Object.keys(before))assert.equal(JSON.stringify((await db.prepare('SELECT * FROM '+t+' ORDER BY rowid').all()).results),before[t]);
 async function call(user='mom',target=user,method='GET',body){const r=await mf.dispatchFetch('https://cetus.fun/wagaya/api/home/layout?user='+target,{method,headers:{Origin:'https://cetus.fun',Cookie:'__Host-home_session='+tokens[user],'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json()};}
 const get=async(...a)=>{const r=await call(...a);assert.equal(r.status,200,JSON.stringify(r));return r.data;};
 const grandma=await get('grandma');assert.equal(grandma.apps.find(a=>a.id==='calendar').section,'favorite');assert.equal(grandma.apps.find(a=>a.id==='notification').section,'hidden');assert.equal(grandma.revision,0);
 assert.equal((await call('grandma','kid')).status,403);assert.equal((await call('outside','kid')).status,403);assert.equal((await call('mom','grandma')).status,403);assert.equal((await call('kid','mom')).status,403);assert.equal((await call('childadmin','kid')).status,403);
 assert.ok((await get()).children.some(c=>c.id==='kid'));assert.deepEqual((await get('grandma')).children,[]);
 const initial=await get(),body={revision:initial.revision,operation_id:'op-'+crypto.randomUUID(),items:initial.apps.map((a,i)=>({id:a.id,section:i===0?'hidden':i===1?'favorite':'list'}))};
 assert.equal((await call('mom','mom','PUT',body)).status,200);assert.equal((await get()).revision,1);assert.equal((await call('mom','mom','PUT',body)).data.already_saved,true);assert.equal((await get()).revision,1);
 assert.equal(JSON.stringify((await db.prepare("SELECT * FROM user_apps WHERE user_id='grandma' ORDER BY rowid").all()).results),JSON.stringify(JSON.parse(before.user_apps).filter(a=>a.user_id==='grandma')));
 const bad=(items,revision=1)=>({revision,items,operation_id:'op-'+crypto.randomUUID()});
 assert.equal((await call('mom','mom','PUT',bad(body.items.slice(1)))).status,409);assert.equal((await call('mom','mom','PUT',bad([...body.items,body.items[0]]))).status,400);assert.equal((await call('mom','mom','PUT',bad([...body.items,{id:'not-allowed',section:'favorite'}]))).status,409);assert.equal((await get()).revision,1);
 const a=bad([...body.items].reverse()),b=bad(body.items),race=await Promise.all([call('mom','mom','PUT',a),call('mom','mom','PUT',b)]);assert.deepEqual(race.map(r=>r.status).sort(),[200,409]);assert.equal((await get()).revision,2);
 // Existing settings APIs and automatic app additions invalidate old editor snapshots.
 await db.prepare("UPDATE user_apps SET visible=0 WHERE user_id='mom' AND app_id='calendar'").run();assert.equal((await call('mom','mom','PUT',bad(body.items,2))).status,409);
 const current=await get(),saved=JSON.stringify((await db.prepare("SELECT * FROM user_apps WHERE user_id='mom' ORDER BY app_id").all()).results),count=(await db.prepare('SELECT COUNT(*) n FROM home_layout_operations').first()).n;
 await db.prepare("CREATE TRIGGER fixture_layout_failure BEFORE UPDATE ON user_apps WHEN NEW.user_id='mom' AND NEW.app_id='notification' BEGIN SELECT RAISE(ABORT,'fixture save failed'); END").run();
 assert.equal((await call('mom','mom','PUT',bad(body.items,current.revision))).status,500);assert.equal(JSON.stringify((await db.prepare("SELECT * FROM user_apps WHERE user_id='mom' ORDER BY app_id").all()).results),saved);assert.equal((await db.prepare('SELECT COUNT(*) n FROM home_layout_operations').first()).n,count);assert.equal((await get()).revision,current.revision);await db.prepare('DROP TRIGGER fixture_layout_failure').run();
 const child=await get('mom','kid'),childBody=bad(child.apps.map(a=>({id:a.id,section:a.id==='calendar'?'favorite':'hidden'})),child.revision);assert.equal((await call('mom','kid','PUT',childBody)).status,200);assert.equal((await get('kid')).apps.filter(a=>a.section==='favorite').length,1);
 assert.equal((await db.prepare("SELECT COUNT(*) n FROM passbook_entries").first()).n,0);assert.equal((await db.prepare("SELECT COUNT(*) n FROM passbook_accounts").first()).n,0);
 assert.equal((await db.prepare('PRAGMA foreign_key_check').all()).results.length,0);
 }finally{await mf.dispose();}
});
