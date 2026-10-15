import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir,mkdtemp,rm,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';

test('cash tools: permissions, wallet atomicity, allowance retries, daily compound interest, adult chores',async()=>{
 const base=new URL('../',import.meta.url).pathname;
 await mkdir(join(base,'.wrangler'),{recursive:true});
 const folder=await mkdtemp(join(base,'.wrangler/passbook-finance-'));
 await build({stdin:{contents:`import app from '${base}src/index.ts';import {runCashAutomation,calculateInterest} from '${base}src/passbook-finance.ts';export default {async fetch(r,e){const u=new URL(r.url);if(u.pathname==='/test-run')return Response.json(await runCashAutomation(e,Number(u.searchParams.get('time'))));if(u.pathname==='/test-calculate')return Response.json(calculateInterest(await r.json()));return app.fetch(r,e)}}`,resolveDir:base},outfile:join(folder,'worker.js'),bundle:true,format:'esm',platform:'browser',external:['node:*'],logLevel:'silent'});
 const mf=new Miniflare(convertV4MiniflareOptions({name:'cash-test',modules:true,scriptPath:join(folder,'worker.js'),compatibilityDate:'2026-10-01',compatibilityFlags:['nodejs_compat'],d1Databases:{DB:'cash'},r2Buckets:['PRIVATE_FILES'],serviceBindings:{ASSETS:()=>new Response('asset')}}));
 try{
 const db=await mf.getD1Database('DB');
 for(const file of (await readdir(new URL('../migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')&&!f.startsWith('0018_')).sort()){
 const sql=(await readFile(new URL('../migrations/'+file,import.meta.url),'utf8')).replace(/^--.*$/gm,'');for(const s of sql.match(/\s*CREATE TRIGGER[\s\S]*?\nEND;|[^;]+;/g)||[])await db.prepare(s).run();}
 const now=Math.floor(Date.now()/1000),cookies={};for(const [i,n]of ['mom','child','sibling','other'].entries()){
 await db.prepare("INSERT INTO users(id,login_name,display_name,password_salt,password_hash,password_iterations,platform_role,created_at) VALUES (?,?,?,'s','h',1,'user',?)").bind(n,n,n,now).run();const token=String(i+1).repeat(64);cookies[n]='__Host-home_session='+token;await db.prepare("INSERT INTO sessions(id,token_hash,user_id,device_name,created_at,last_seen_at,expires_at) VALUES (?,?,?,'test',?,?,?)").bind(n,createHash('sha256').update(token).digest('hex'),n,now,now,now+10000).run();}
 for(const [h,owner]of [['h','mom'],['other','other']]){await db.prepare("INSERT INTO groups VALUES (?,?,'household',?,?)").bind(h,h,owner,now).run();await db.prepare("INSERT INTO memberships VALUES (?,?, 'owner')").bind(h,owner).run();await db.prepare("INSERT INTO group_apps VALUES (?,'passbook')").bind(h).run();await db.prepare("INSERT INTO passbook_activation VALUES (?,?,?,'backup')").bind(h,now,owner).run();}
 for(const [id,n]of [['c','child'],['s','sibling']]){await db.prepare("INSERT INTO memberships VALUES ('h',?,'member')").bind(n).run();await db.prepare("INSERT INTO children VALUES (?,'h',?,?)").bind(id,n,n).run();}
 for(const [id,kind]of [['cash','money'],['chores','points']])await db.prepare("INSERT INTO passbook_units(id,household_id,code,name,kind,symbol) VALUES (?,'h',?,?,?,'円')").bind(id,id,id,kind).run();
 for(const c of ['c','s'])for(const u of ['cash','chores'])await db.prepare("INSERT INTO passbook_accounts VALUES (?,'h',?,?)").bind(c+'-'+u,c,u).run();
 const entry=async(id,account,delta,at)=>db.prepare("INSERT INTO passbook_entries(id,account_id,household_id,delta,memo,occurred_at,created_at,created_by,source_app,source_event) VALUES (?,?,'h',?,'test',?,?,'mom','test',?)").bind(id,account,delta,new Date(at*1000).toISOString(),at,id).run();
 await entry('opening','c-cash',1000,now-500);await entry('s-opening','s-cash',1000,now-500);await entry('points','c-chores',100,now-500);
 // Verify the upgrade on populated pre-change tables, not only on an empty schema.
 const tables=(await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '\_cf%' ESCAPE '\\' ORDER BY name").all()).results.map(x=>x.name);
 const beforeUpgrade=await db.batch(tables.map(t=>db.prepare('SELECT * FROM '+t+' ORDER BY rowid')));
 const upgrade=(await readFile(new URL('../migrations/0018_passbook_cash_tools.sql',import.meta.url),'utf8')).replace(/^--.*$/gm,'');
 for(const stmt of upgrade.match(/\s*CREATE TRIGGER[\s\S]*?\nEND;|[^;]+;/g)||[])await db.prepare(stmt).run();
 const afterUpgrade=await db.batch(tables.map(t=>db.prepare('SELECT * FROM '+t+' ORDER BY rowid')));
 for(let i=0;i<tables.length;i++)assert.deepEqual(afterUpgrade[i].results,beforeUpgrade[i].results,'existing records changed in '+tables[i]);
 const balance=async a=>(await db.prepare('SELECT COALESCE(SUM(delta),0) n FROM passbook_entries WHERE account_id=?').bind(a).first()).n;
 async function call(path,method='GET',body,who='mom'){const r=await mf.dispatchFetch('https://home.test/api/passbook'+path+(path.includes('?')?'&':'?')+'household=h',{method,headers:{Cookie:cookies[who],Origin:'https://home.test',...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json()};}
 const ok=async(...args)=>{const r=await call(...args);assert.equal(r.status,200,JSON.stringify(r));return r.data;};
 assert.equal((await call('/finance','GET',null,'other')).status,403);
 assert.equal((await call('/finance/wallet','POST',{account_id:'c-cash',balance:200,event_id:'wallet-create'},'child')).status,403);
 await ok('/finance/wallet','POST',{account_id:'c-cash',balance:200,event_id:'wallet-create'});assert.equal(await balance('h:wallet:c'),200);assert.equal(await balance('c-cash'),1000);
 await ok('/finance/wallet','POST',{account_id:'c-cash',balance:200,event_id:'wallet-create'});assert.equal(await balance('h:wallet:c'),200);
 await ok('/finance/wallet','POST',{account_id:'c-cash',balance:150,event_id:'wallet-adjust'});assert.equal(await balance('h:wallet:c'),150);
 const transfer={from_account:'c-cash',to_account:'h:wallet:c',amount:300,event_id:'transfer-once'};
 await Promise.all([ok('/finance/transfer','POST',transfer),ok('/finance/transfer','POST',transfer)]);assert.equal(await balance('c-cash'),700);assert.equal(await balance('h:wallet:c'),450);
 assert.equal((await call('/finance/transfer','POST',{...transfer,amount:9999,event_id:'insufficient'})).status,409);assert.equal(await balance('c-cash')+await balance('h:wallet:c'),1150);
 assert.equal((await call('/finance/transfer','POST',{...transfer,to_account:'s-cash',event_id:'wrong-child'})).status,409);
 assert.equal((await call('/finance','GET',null,'child')).data.accounts.some(a=>a.child_id==='s'),false);
 // Mom receives an independent zero-yen bank, and normal chore triggers pay money and points atomically.
 await db.prepare("INSERT INTO passbook_adult_accounts VALUES ('mom-points','h','mom','chores')").run();await ok('/finance/self-account','POST',{});
 assert.equal((await db.prepare("SELECT COUNT(*) n FROM passbook_adult_entries").first()).n,0);
 const chore=await ok('/chores','POST',{name:'test chore',points:10,money:50,point_unit_id:'chores',rotation:[]});const done={chore_id:chore.id,target:'user:mom',event_id:'mom-complete',revision:1};await ok('/chores/complete','POST',done);await ok('/chores/complete','POST',done);
 assert.equal((await db.prepare("SELECT SUM(delta) n FROM passbook_adult_entries e JOIN passbook_adult_accounts a ON a.id=e.account_id WHERE a.unit_id='cash'").first()).n,50);assert.equal((await db.prepare("SELECT SUM(delta) n FROM passbook_adult_entries WHERE account_id='mom-points'").first()).n,10);
 // A failed completion preserves its exact original snapshot and can be paid after the day advances.
 await db.prepare("INSERT INTO memberships VALUES ('h','other','admin')").run();
 await db.prepare("INSERT INTO passbook_adult_accounts VALUES ('other-points','h','other','chores')").run();
 const pendingChore=await ok('/chores','POST',{name:'unpaid',points:7,money:25,point_unit_id:'chores',rotation:[]});
 const pending={chore_id:pendingChore.id,target:'user:other',event_id:'pending-for-other',revision:1};
 assert.equal((await call('/chores/complete','POST',pending)).status,409);
 assert.equal((await db.prepare("SELECT status FROM passbook_chore_attempts WHERE event_id='pending-for-other'").first()).status,'pending');
 const today=new Date(Date.now()+9*3600000).toISOString().slice(0,10);
 await db.prepare("INSERT INTO passbook_chore_days(id,chore_id,household_id,day,kind,target,assigned_to,points,money,memo,occurred_at,created_at,actor,event_id) VALUES ('skip-pending',?,'h',?,'skip',NULL,NULL,7,25,'unpaid',?,?, 'mom','skip-pending')").bind(pendingChore.id,today,new Date().toISOString(),now).run();
 await ok('/finance/self-account','POST',{},'other');
 await Promise.all([ok('/finance/chore-retry','POST',{event_id:pending.event_id}),ok('/finance/chore-retry','POST',{event_id:pending.event_id})]);
 await ok('/chores/complete','POST',pending);
 assert.equal((await db.prepare("SELECT SUM(delta) n FROM passbook_adult_entries WHERE account_id='h:user:other:cash'").first()).n,25);
 assert.equal((await db.prepare("SELECT SUM(delta) n FROM passbook_adult_entries WHERE account_id='other-points'").first()).n,7);
 assert.equal((await db.prepare("SELECT kind FROM passbook_chore_days WHERE id='skip-pending'").first()).kind,'skip');
 // Backdated audit with no evidence must not generate guessed payments.
 const audit=await ok('/finance/chore-audit','POST',{day:'2026-10-14'});assert.equal(audit.recorded.length,0);assert.equal((await call('/finance/chore-repair','POST',{day_id:'invented'})).status,409);
 // Settings APIs persist future policies and keep inactive plans from paying.
 assert.equal((await call('/finance/interest','PUT',{account_id:'c-cash',rate_bps:300,annual_cap:300,enabled:true},'child')).status,403);
 await ok('/finance/interest','PUT',{account_id:'c-cash',rate_bps:300,annual_cap:300,enabled:false});
 const config=await ok('/finance');assert.equal(config.interest.find(i=>i.account_id==='c-cash').policy.rate_bps,300);
 assert.equal((await call('/finance/interest','PUT',{account_id:'c-chores',rate_bps:300,annual_cap:300,enabled:true})).status,404);
 const future=new Date(Date.now());future.setUTCMonth(future.getUTCMonth()+1);
 const plan2=await ok('/finance/allowance','POST',{account_id:'s-cash',amount:50,start_month:future.toISOString().slice(0,7),total_payments:12});
 await ok('/finance/allowance/'+plan2.id,'PUT',{amount:55,enabled:false,revision:1});
 assert.equal((await call('/finance/allowance/'+plan2.id,'PUT',{amount:60,enabled:false,revision:1})).status,409);
 // Allowance: 12 payments, no backfill, paused periods do not pay; successful retry is idempotent.
 const id='plan';await db.prepare("INSERT INTO passbook_allowance_plans VALUES (?,'h','c-cash',100,'2026-11','2026-11',12,1,1,'mom',?)").bind(id,now).run();
 async function run(date){const r=await mf.dispatchFetch('https://home.test/test-run?time='+Date.parse(date));const d=await r.json();assert.equal(d.errors||0,0,JSON.stringify(d));return d;}
 await db.prepare("CREATE TRIGGER test_failed_allowance BEFORE INSERT ON passbook_allowance_payments WHEN NEW.plan_id='plan' BEGIN SELECT RAISE(ABORT,'test failure'); END").run();
 const failed=await (await mf.dispatchFetch('https://home.test/test-run?time='+Date.parse('2026-10-31T15:01:00Z'))).json();assert.equal(failed.errors,1);assert.equal(await balance('c-cash'),700);
 await db.prepare('DROP TRIGGER test_failed_allowance').run();
 await run('2026-10-31T15:05:00Z');assert.equal(await balance('c-cash'),800);await Promise.all([run('2026-11-01T01:05:00Z'),run('2026-11-01T01:05:00Z')]);assert.equal(await balance('c-cash'),800);
 await db.prepare("UPDATE passbook_allowance_plans SET enabled=0 WHERE id='plan'").run();await run('2026-12-01T00:05:00Z');assert.equal(await balance('c-cash'),800);await db.prepare("UPDATE passbook_allowance_plans SET enabled=1,amount=120 WHERE id='plan'").run();await run('2027-02-01T00:05:00Z');assert.equal(await balance('c-cash'),920);assert.equal((await db.prepare("SELECT COUNT(*) n FROM passbook_allowance_payments").first()).n,2);
 for(let n=2;n<12;n++)await run(new Date(Date.UTC(2027,n,1)).toISOString());assert.equal((await db.prepare("SELECT COUNT(*) n FROM passbook_allowance_payments").first()).n,12);assert.equal((await db.prepare("SELECT enabled FROM passbook_allowance_plans WHERE id='plan'").first()).enabled,0);await run('2028-04-01T00:05:00Z');assert.equal((await db.prepare("SELECT COUNT(*) n FROM passbook_allowance_payments").first()).n,12);
 // Daily interest starts only after activation, includes withdrawals, and ignores next-month allowance.
 const ticks=1335900000n;const first=Date.parse('2026-11-01T00:00:00+09:00')/1000;
 await db.prepare("INSERT INTO passbook_interest_accounts VALUES ('s-cash','h','2026-11-01',?,1000,'0')").bind(first).run();await db.prepare("INSERT INTO passbook_interest_policies VALUES ('s-cash','2026-11-01',300,300,1,'mom',?)").bind(first).run();
 await entry('interest-withdraw','s-cash',-500,Date.parse('2026-11-16T12:00:00+09:00')/1000);
 await run('2026-12-01T00:05:00Z');let interest=await db.prepare("SELECT * FROM passbook_interest_payments WHERE account_id='s-cash' AND target_month='2026-11'").first();assert.equal(interest.paid,1);assert.equal(BigInt(interest.earned_ticks),1500n*15n*300n*366n);assert.equal(BigInt(interest.carry_after),BigInt(interest.earned_ticks)%ticks);await run('2026-12-01T03:05:00Z');assert.equal((await db.prepare("SELECT COUNT(*) n FROM passbook_interest_payments WHERE account_id='s-cash'").first()).n,1);
 await run('2027-01-01T00:05:00Z');const december=await db.prepare("SELECT * FROM passbook_interest_payments WHERE account_id='s-cash' AND target_month='2026-12'").first();
 assert.equal(BigInt(december.earned_ticks),501n*300n*366n*31n);assert.equal(december.paid,Number((BigInt(interest.carry_after)+BigInt(december.earned_ticks))/ticks));assert.equal(december.payment_year,2027);
 assert.equal((await db.prepare("SELECT COUNT(*) n FROM passbook_entries WHERE account_id='c-chores'").first()).n,1);
 // Pure calculation: leap year, policy changes, cap, fractional carry and year reset.
 async function calc(body){return (await mf.dispatchFetch('https://home.test/test-calculate',{method:'POST',body:JSON.stringify(body)})).json();}
 const c=await calc({targetMonth:'2028-02',startedDay:'2028-02-01',opening:1000,policies:[{effective_day:'2028-02-01',rate_bps:300,annual_cap:300,enabled:1}],changes:[],carry:'0',yearPaid:299,cap:300});assert.equal(c.paid,1);assert.equal(c.carry,'0');assert.equal(BigInt(c.earned),1000n*300n*365n*29n);
 const fresh=await calc({targetMonth:'2027-01',startedDay:'2027-01-01',opening:1000,policies:[{effective_day:'2027-01-01',rate_bps:300,annual_cap:300,enabled:1},{effective_day:'2027-01-16',rate_bps:0,annual_cap:300,enabled:0}],changes:[],carry:'0',yearPaid:0,cap:300});assert.equal(BigInt(fresh.earned),1000n*300n*366n*15n);
 assert.equal(await balance('c-chores'),100);assert.deepEqual((await db.prepare('PRAGMA foreign_key_check').all()).results,[]);
 }finally{await mf.dispose();await rm(folder,{recursive:true,force:true});}
});
