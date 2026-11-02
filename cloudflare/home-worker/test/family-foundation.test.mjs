import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';

test('family foundation: additive migration, invitations, concurrent use, revocation and financial isolation',async()=>{
 let ready=false;
 const mf=new Miniflare(convertV4MiniflareOptions({name:'family-foundation-test',modules:true,scriptPath:new URL('../.wrangler/test-build/index.js',import.meta.url).pathname,compatibilityDate:'2026-10-01',compatibilityFlags:['nodejs_compat'],d1Databases:{DB:'family-foundation'},bindings:{FAMILY_INVITES_ENABLED:'1'},serviceBindings:{ASSETS:()=>new Response('asset'),CALENDAR_SERVICE:()=>Response.json({protocol:ready?'multi-family-v1':'legacy'})}}));
 try{
 const db=await mf.getD1Database('DB'),now=Math.floor(Date.now()/1000),cookies={};
 const migrate=async f=>{const sql=(await readFile(new URL('../migrations/'+f,import.meta.url),'utf8')).replace(/^--.*$/gm,'');for(const s of sql.match(/\s*CREATE TRIGGER[\s\S]*?\nEND;|[^;]+;/g)||[])await db.prepare(s).run();};
 const files=(await readdir(new URL('../migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort();
 for(const f of files.filter(f=>!f.startsWith('0022')&&!f.startsWith('0026')))await migrate(f);
 for(const [i,u] of ['mom','grandma','kid','brother','sister','relative','outsider'].entries()){
  await db.prepare("INSERT INTO users(id,login_name,display_name,password_salt,password_hash,password_iterations,created_at,platform_role) VALUES(?,?,?,'s','h',1,?,?)").bind(u,u,'NAME-'+u,now,u==='mom'?'operator':'user').run();
  const token=String(i+1).repeat(64);cookies[u]='__Host-home_session='+token;await db.prepare("INSERT INTO sessions VALUES(?,?,?,'fixture',?,?,?,NULL)").bind(u,createHash('sha256').update(token).digest('hex'),u,now,now,now+3600).run();
 }
 await db.prepare("INSERT INTO groups VALUES('h','Original household','household','mom',?)").bind(now).run();
 for(const u of ['mom','grandma','kid']){await db.prepare("INSERT INTO memberships VALUES('h',?,?)").bind(u,u==='mom'?'owner':'member').run();await db.prepare("INSERT INTO home_member_attributes VALUES('h',?,?,'mom',?)").bind(u,u==='kid'?'child':'adult',new Date().toISOString()).run();}
 await db.prepare("INSERT INTO children VALUES('child','h','Child','kid')").run();
 for(const a of ['calendar','passbook','family-tree','daily-kanji'])await db.prepare("INSERT INTO group_apps VALUES('h',?)").bind(a).run();
 const oldTables=(await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'").all()).results.map(t=>t.name),before={};
 for(const t of oldTables)before[t]=JSON.stringify((await db.prepare('SELECT * FROM "'+t+'" ORDER BY rowid').all()).results);
 await migrate(files.find(f=>f.startsWith('0022')));
 for(const t of oldTables)assert.equal(JSON.stringify((await db.prepare('SELECT * FROM "'+t+'" ORDER BY rowid').all()).results),before[t],'migration preserves '+t);
 await migrate(files.find(f=>f.startsWith('0026')));
 // New per-user app preferences also advance existing home_layout_versions triggers.
 // Preserve the 0022 assertion above; compare later family operations to the fully upgraded app catalog.
 for(const t of oldTables){const current=JSON.stringify((await db.prepare('SELECT * FROM "'+t+'" ORDER BY rowid').all()).results);if(!['apps','group_apps','user_apps','home_layout_versions'].includes(t))assert.equal(current,before[t],'body app registration preserves '+t);before[t]=current;}
 async function call(path='',who='mom',method='GET',body){const r=await mf.dispatchFetch('https://cetus.fun/wagaya/api/families'+path,{method,headers:{Origin:'https://cetus.fun',...(who?{Cookie:cookies[who]}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json()};}
 async function ok(...args){const r=await call(...args);assert.ok(r.status===200||r.status===201,JSON.stringify(r));return r.data;}
 const count=async table=>(await db.prepare('SELECT COUNT(*) n FROM '+table).first()).n;
 const issue=async(purpose='create_family',group_id)=>ok('/invitations','mom','POST',{purpose,group_id});
 const accept=async(token,u,name='New household')=>call('/accept',u,'POST',{invitation:token,household_name:name,confirmed:true});
 assert.equal((await call('',null)).status,401);
 assert.equal((await ok()).ready,false);
 assert.equal((await call('/invitations','mom','POST',{purpose:'create_family'})).status,503);
 assert.equal(await count('family_invitations'),0);
 ready=true;
 for(const u of ['kid','grandma','brother'])assert.equal((await call('/invitations',u,'POST',{purpose:'create_family'})).status,403);
 const start=await issue();assert.equal(start.token.length,64);
 assert.equal((await db.prepare('SELECT token_hash FROM family_invitations WHERE id=?').bind(start.id).first()).token_hash,createHash('sha256').update(start.token).digest('hex'));
 const preview=await ok('/preview',null,'POST',{invitation:start.token});assert.deepEqual(Object.keys(preview).sort(),['expires_at','purpose']);
 assert.equal((await call('/preview',null,'POST',{invitation:'invalid'})).status,403);
 assert.equal((await accept(start.token,'kid')).status,403);
 const claims=await Promise.all([accept(start.token,'brother'),accept(start.token,'sister')]);assert.equal(claims.filter(c=>c.status===200).length,1,JSON.stringify(claims));
 const who=claims[0].status===200?'brother':'sister',other=who==='brother'?'sister':'brother',group=claims.find(c=>c.status===200).data.group_id;
 assert.equal((await accept(start.token,who)).data.already_accepted,true);
 assert.equal((await ok('',who)).groups[0].role,'owner');
 assert.deepEqual((await ok('/groups/'+group,who)).app_ids,['calendar','notification']);
 assert.equal((await call('/groups/h',who)).status,403);
 assert.equal((await call('/groups/'+group+'/apps',who,'PUT',{app_ids:['passbook']})).status,400);
 assert.equal((await call('/groups/'+group+'/apps','grandma','PUT',{app_ids:['calendar']})).status,403);
 await ok('/groups/'+group+'/apps',who,'PUT',{app_ids:['calendar','family-tree']});
 const joining=await ok('/invitations',who,'POST',{purpose:'join_family',group_id:group});
 assert.equal((await ok('/inspect','relative','POST',{invitation:joining.token})).group.name,'New household');
 assert.equal((await accept(joining.token,'relative')).status,200);
 assert.equal((await db.prepare('SELECT role FROM memberships WHERE group_id=? AND user_id=?').bind(group,'relative').first()).role,'member');
 assert.equal((await call('/invitations','relative','POST',{purpose:'join_family',group_id:group})).status,403);
 const shared=(await ok('/groups','mom','POST',{name:'Kin sharing',kind:'sharing'})).id;
 assert.deepEqual((await ok('/groups/'+shared)).app_ids,['calendar']);
 const share=await issue('join_sharing',shared);assert.equal((await accept(share.token,who)).status,200);
 await ok('/groups/'+shared+'/leave',who,'POST',{});
 assert.equal((await call('/groups/'+shared,who)).status,403);
 assert.equal((await accept(share.token,who)).status,409,'consumed invite cannot silently restore revoked membership');
 const revoke=await issue();await ok('/invitations/'+revoke.id,'mom','DELETE');assert.equal((await accept(revoke.token,other)).status,409);
 const registration=await issue();
 const signup=async invitation=>{const r=await mf.dispatchFetch('https://cetus.fun/wagaya/api/register-family',{method:'POST',headers:{Origin:'https://cetus.fun','Content-Type':'application/json'},body:JSON.stringify({invitation,confirmed:true,household_name:'Registered family',login_name:'new-family-user',display_name:'NEW USER',password:'fixture-password-123'})});return {status:r.status,data:await r.json(),cookie:r.headers.get('Set-Cookie')};};
 const registered=await signup(registration.token);assert.equal(registered.status,201,JSON.stringify(registered));assert.match(registered.cookie,/HttpOnly; Secure/);assert.equal((await signup(registration.token)).status,403);
 const rollback=await issue();const usersBefore=await count('users');await db.prepare("CREATE TRIGGER fixture_block_signup BEFORE INSERT ON family_invitation_uses WHEN NEW.invitation_id='"+rollback.id+"' BEGIN SELECT RAISE(ABORT,'family invitation fixture rollback'); END").run();
 const badSignup=await mf.dispatchFetch('https://cetus.fun/wagaya/api/register-family',{method:'POST',headers:{Origin:'https://cetus.fun','Content-Type':'application/json'},body:JSON.stringify({invitation:rollback.token,confirmed:true,household_name:'Rollback',login_name:'never-created',display_name:'NO USER',password:'fixture-password-123'})});assert.equal(badSignup.status,409);assert.equal(await count('users'),usersBefore);await db.prepare('DROP TRIGGER fixture_block_signup').run();
 const expired=await issue();await db.prepare('UPDATE family_invitations SET expires_at=? WHERE id=?').bind(now-1,expired.id).run();assert.equal((await accept(expired.token,other)).status,409);
 const changed=await ok('/invitations',who,'POST',{purpose:'join_family',group_id:group});await db.prepare("UPDATE memberships SET role='member' WHERE group_id=? AND user_id=?").bind(group,who).run();assert.equal((await accept(changed.token,'outsider')).status,409);await db.prepare("UPDATE memberships SET role='owner' WHERE group_id=? AND user_id=?").bind(group,who).run();
 const race=await issue();await db.prepare("CREATE TRIGGER fixture_block_member BEFORE INSERT ON memberships WHEN NEW.group_id<>'h' AND NEW.user_id='outsider' BEGIN SELECT RAISE(ABORT,'fixture rollback'); END").run();assert.equal((await accept(race.token,'outsider')).status,500);assert.equal((await db.prepare('SELECT use_count FROM family_invitations WHERE id=?').bind(race.id).first()).use_count,0);await db.prepare('DROP TRIGGER fixture_block_member').run();assert.equal((await accept(race.token,'outsider')).status,200);
 for(const u of [who,other,'relative','outsider']){const r=await mf.dispatchFetch('https://cetus.fun/wagaya/api/passbook?household=h',{headers:{Cookie:cookies[u]}});assert.equal(r.status,403,'new family cannot access original finances');}
 for(const t of oldTables.filter(t=>!['users','groups','memberships','home_member_attributes','group_apps','sessions','auth_attempts'].includes(t)))assert.equal(JSON.stringify((await db.prepare('SELECT * FROM "'+t+'" ORDER BY rowid').all()).results),before[t],'operations preserve '+t);
 assert.equal(await count('passbook_accounts'),0);assert.equal(await count('passbook_adult_accounts'),0);assert.equal((await db.prepare('PRAGMA foreign_key_check').all()).results.length,0);
 }finally{await mf.dispose();}
});
