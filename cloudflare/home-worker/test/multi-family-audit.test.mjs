// Characterize the unmodified pre-migration application. These are not the new role rules.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
test('five-person household, sharing ownership, explicit guardian scopes, financial boundaries and creator-independent tree reads',async()=>{
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,scriptPath:new URL('../.wrangler/test-build/index.js',import.meta.url).pathname,compatibilityDate:'2026-10-01',compatibilityFlags:['nodejs_compat'],d1Databases:{DB:'family-audit'},serviceBindings:{ASSETS:()=>Response.json([])}}));
 try{
 const db=await mf.getD1Database('DB'),now=Math.floor(Date.now()/1000),tokens={};
 for(const f of (await readdir(new URL('../migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort()){
  const sql=(await readFile(new URL('../migrations/'+f,import.meta.url),'utf8')).replace(/^--.*$/gm,'');
  for(const statement of sql.match(/\s*CREATE TRIGGER[\s\S]*?\nEND;|[^;]+;/g)||[])await db.prepare(statement).run();
 }
 for(const [index,user]of ['mom','older','younger','grandpa','grandma','brother','sister'].entries()){
  await db.prepare("INSERT INTO users(id,login_name,display_name,password_salt,password_hash,password_iterations,created_at) VALUES(?,?,?,'fixture','fixture',1,?)").bind(user,user,'fixture-'+user,now).run();
  tokens[user]=(index+1).toString().repeat(64);await db.prepare("INSERT INTO sessions VALUES(?,?,?,'fixture',?,?,?,NULL)").bind(user,createHash('sha256').update(tokens[user]).digest('hex'),user,now,now,now+3600).run();
 }
 for(const [group,owner,kind]of [['h','mom','household'],['b','brother','household'],['s','sister','household'],['r','brother','sharing']]){
  await db.prepare('INSERT INTO groups VALUES(?,?,?,?,?)').bind(group,'fixture',kind,owner,now).run();
  await db.prepare("INSERT INTO memberships VALUES(?,?,'owner')").bind(group,owner).run();
 }
 for(const user of ['older','younger','grandpa','grandma'])await db.prepare("INSERT INTO memberships VALUES('h',?,'member')").bind(user).run();
 for(const user of ['mom','grandma','sister'])await db.prepare("INSERT INTO memberships VALUES('r',?,'member')").bind(user).run();
 for(const user of ['mom','older','younger','grandpa','grandma'])await db.prepare("INSERT INTO home_member_attributes VALUES('h',?,?,'mom','now')").bind(user,['older','younger'].includes(user)?'child':'adult').run();
 for(const app of ['passbook','good-deeds','family-tree','daily-kanji'])await db.prepare("INSERT INTO group_apps VALUES('h',?)").bind(app).run();
 // Even an accidental sharing-group app grant must not confer a household's financial ownership.
 for(const app of ['passbook','good-deeds','family-tree'])await db.prepare("INSERT INTO group_apps VALUES('r',?)").bind(app).run();
 await db.prepare("INSERT INTO children VALUES('c1','h','fixture-child','older'),('c2','h','fixture-child','younger')").run();
 await db.prepare("INSERT INTO passbook_activation VALUES('h',?,'mom','fixture-no-production-data')").bind(now).run();
 await db.prepare("INSERT INTO passbook_units(id,household_id,code,name,kind,symbol) VALUES('cash','h','cash','fixture','money','円')").run();
 await db.prepare("INSERT INTO passbook_accounts VALUES('c1-cash','h','c1','cash')").run();
 await db.prepare("INSERT INTO passbook_entries(id,account_id,household_id,delta,memo,occurred_at,created_at,created_by,source_app,source_event) VALUES('e','c1-cash','h',123,'fixture','2026-10-01',?,'mom','fixture','seed')").bind(now).run();
 for(const [id,creator]of [['p-mom','mom'],['p-grandma','grandma']])await db.prepare("INSERT INTO family_tree_people(id,household_id,home_user_id,name,furigana,former_name,gender,birth_date,death_date,memo,created_by,updated_at) VALUES(?,'h',?,'fixture','','','unknown','','','',?,'now')").bind(id,creator,creator).run();
 const call=(who,path,method='GET',body)=>mf.dispatchFetch('https://cetus.fun/wagaya'+path,{method,headers:{Origin:'https://cetus.fun',...(who?{Cookie:'__Host-home_session='+tokens[who]}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
 assert.equal((await call(null,'/api/passbook?household=h')).status,401);
 for(const who of ['brother','sister'])for(const path of ['/api/passbook?household=h','/api/passbook/book?household=h&account=c1-cash','/api/good-deeds?household=h','/api/family-tree?household=h'])assert.equal((await call(who,path)).status,403,path);
 for(const who of ['grandpa','grandma']){
  const root=await (await call(who,'/api/passbook?household=h')).json();assert.equal(root.admin,false);assert.deepEqual(root.accounts,[]);
  for(const path of ['/api/passbook/finance?household=h','/api/passbook/history?household=h&account=c1-cash','/api/good-deeds?household=h'])assert.equal((await call(who,path)).status,403,path);
  assert.equal((await call(who,'/api/passbook/gifts?household=h')).status,200);
 }
 const mom=await (await call('mom','/api/passbook?household=h')).json();assert.equal(mom.admin,true);assert.equal(mom.accounts[0].balance,123);
 const treeMom=await (await call('mom','/api/family-tree?household=h')).json(),treeGrandma=await (await call('grandma','/api/family-tree?household=h')).json();
 assert.deepEqual(treeMom.people.map(p=>p.id).sort(),['p-grandma','p-mom']);assert.deepEqual(treeMom.people,treeGrandma.people);
 // Adult membership alone no longer grants guardian access. Roles and saved progress remain unchanged.
 assert.equal((await call('grandma','/api/daily-kanji/family?household=h')).status,403);
 assert.equal((await db.prepare("SELECT COUNT(*) n FROM passbook_accounts WHERE household_id IN ('b','s','r')").first()).n,0);
 assert.equal((await db.prepare("SELECT COUNT(*) n FROM memberships WHERE group_id='h'").first()).n,5);
 assert.equal((await db.prepare("SELECT SUM(delta) n FROM passbook_entries WHERE account_id='c1-cash'").first()).n,123);
 assert.equal((await db.prepare('PRAGMA foreign_key_check').all()).results.length,0);
 }finally{await mf.dispose();}
});
