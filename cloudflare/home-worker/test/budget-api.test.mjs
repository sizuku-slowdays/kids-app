import {fingerprint,merchantKey} from '../public/apps/household-budget/card-csv.js';
import {runBudgetSchedules} from '../src/budget.ts';
import {replayBudgetAudit} from '../../../scripts/replay-budget-audit.mjs';
import test from 'node:test';import assert from 'node:assert/strict';import {readFile,readdir} from 'node:fs/promises';import {createHash} from 'node:crypto';import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
test('budget private API isolates users, atomically retries commands and keeps immutable history',async t=>{
 const mf=new Miniflare(convertV4MiniflareOptions({name:'budget-private-test',modules:true,scriptPath:new URL('../.wrangler/test-build/index.js',import.meta.url).pathname,compatibilityDate:'2026-10-01',compatibilityFlags:['nodejs_compat'],d1Databases:{DB:'budget-private-test',LEGACY_DB:'budget-private-legacy-test'},serviceBindings:{ASSETS:()=>new Response('asset')}}));
 try{const db=await mf.getD1Database('DB'),now=Math.floor(Date.now()/1000),tokens={};for(const f of(await readdir(new URL('../migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort()){const sql=(await readFile(new URL('../migrations/'+f,import.meta.url),'utf8')).replace(/^--.*$/gm,'');for(const statement of sql.match(/\s*CREATE TRIGGER[\s\S]*?\nEND;|[^;]+;/g)||[])await db.prepare(statement).run();}
 assert.equal((await db.prepare("SELECT COUNT(*) n FROM personal_app_access WHERE app_id='household-budget'").first()).n,0);
 for(const [i,name]of ['owner','other','family','child','bootstrap-admin'].entries()){tokens[name]=String(i+1).repeat(64);await db.prepare("INSERT INTO users(id,login_name,display_name,password_salt,password_hash,password_iterations,created_at) VALUES(?,?,?,'s','h',1,?)").bind(name,name,name,now).run();await db.prepare("INSERT INTO sessions VALUES(?,?,?,'synthetic',?,?,?,NULL)").bind(name,createHash('sha256').update(tokens[name]).digest('hex'),name,now,now,now+3600).run();}for(const u of ['owner','other','bootstrap-admin'])await db.prepare("INSERT INTO personal_app_access VALUES(?,'household-budget')").bind(u).run();
 const base='https://cetus.fun/wagaya/api/household-budget';async function call(path='',who='owner',body,extra={}){const response=await mf.dispatchFetch(base+path,{method:body?'POST':'GET',headers:{Cookie:'__Host-home_session='+(tokens[who]||''),Origin:'https://cetus.fun','Content-Type':'application/json','X-Budget-User':who,...extra},body:body?JSON.stringify(body):undefined,redirect:'manual'});return {status:response.status,data:await response.json()};}const get=async who=>(await call('',who)).data;
 let n=0;const post=async(type,data={},eventId='synthetic-command-'+(++n),extra={})=>call('/command','owner',{eventId,command:{type,data}},extra);
 let state=await get();const date=state.today;
 await t.test('anonymous, family and child accounts cannot read data, assets, audit or exports',async()=>{assert.equal((await call('','anonymous')).status,401);for(const who of ['family','child']){assert.equal((await call('',who)).status,403);assert.equal((await call('/export',who)).status,403);assert.equal((await call('/audit',who)).status,403);const r=await mf.dispatchFetch('https://cetus.fun/wagaya/apps/household-budget/',{headers:{Cookie:'__Host-home_session='+tokens[who]}});assert.equal(r.status,403);}assert.equal((await post('account.add',{id:'x',name:'x',kind:'bank'},undefined,{'X-Budget-User':'other'})).status,409);});
 await t.test('operation retry is exactly-once, payload collisions and competing revisions are rejected',async()=>{const body={id:'new-account',name:'Synthetic account',kind:'bank',expectedRevision:0};const res=await Promise.all([post('account.add',body,'same-operation-id'),post('account.add',body,'same-operation-id')]);assert.deepEqual(res.map(r=>r.status),[200,200]);assert.equal((await get()).data.accounts.filter(a=>a.id==='new-account').length,1);assert.equal((await post('account.add',{...body,name:'changed'},'same-operation-id')).status,409);state=await get();const racing=await Promise.all([post('account.add',{id:'race-a',name:'Race A',kind:'bank',expectedRevision:state.revision}),post('account.add',{id:'race-b',name:'Race B',kind:'bank',expectedRevision:state.revision})]);assert.deepEqual(racing.map(r=>r.status).sort(),[200,409]);});
 await t.test('setup and ledger changes never leak via owner query parameters or caller-supplied owner IDs',async()=>{for(const id of ['pink','visa'])assert.equal((await post('card.configure',{id,accountId:'bank-0',closingDay:31,paymentDay:27,monthOffset:1})).status,200);assert.equal((await post('start',{confirm:true,startDate:date,accounts:[{id:'bank-0',amount:5000},{id:'cash',amount:100}],cards:[{id:'pink',amount:1000},{id:'visa',amount:0}]})).status,200);assert.equal((await post('transfer',{from:'bank-0',to:'cash',amount:200,date,owner_id:'other'})).status,200);state=await get();assert.equal(state.summary.accounts.find(a=>a.id==='cash').balance,300);const outsider=await call('?owner=owner','other');assert.equal(outsider.data.userId,'other');assert.equal(outsider.data.data.startDate,null);assert.equal(outsider.data.data.journal.length,0);});
 await t.test('audit failure rolls back the state and both transfer legs; retries after failure remain safe',async()=>{const before=await get(),ops=(await db.prepare("SELECT COUNT(*) n FROM budget_operations WHERE owner_id='owner'").first()).n;await db.prepare("CREATE TRIGGER synthetic_budget_failure BEFORE INSERT ON budget_operations WHEN NEW.event_id='atomic-failure-id' BEGIN SELECT RAISE(ABORT,'synthetic'); END").run();const payload={from:'bank-0',to:'cash',amount:100,date};assert.equal((await post('transfer',payload,'atomic-failure-id')).status,500);assert.deepEqual((await get()).data,before.data);assert.equal((await db.prepare("SELECT COUNT(*) n FROM budget_operations WHERE owner_id='owner'").first()).n,ops);await db.prepare('DROP TRIGGER synthetic_budget_failure').run();assert.equal((await post('transfer',payload,'atomic-failure-id')).status,200);assert.equal((await post('transfer',payload,'atomic-failure-id')).status,200);assert.equal((await get()).summary.accounts.find(a=>a.id==='cash').balance,400);await assert.rejects(()=>db.prepare("UPDATE budget_operations SET command_type='tampered'").run());});
 await t.test('monthly schedule is opt-in, idempotent and creates only plans for authorized owners',async()=>{await runBudgetSchedules({DB:{prepare(){throw Error('disabled schedule must not read DB');}}},Date.now());assert.equal((await post('rule.save',{id:'schedule-rule',name:'Synthetic monthly',amount:100,payment:'bank-0',day:1})).status,200);const before=await get();await runBudgetSchedules({DB:db,BUDGET_SCHEDULES_ENABLED:'1'},Date.parse('2026-12-01T01:00:00Z'));await runBudgetSchedules({DB:db,BUDGET_SCHEDULES_ENABLED:'1'},Date.parse('2026-12-01T02:00:00Z'));const after=await get();assert.equal(after.data.plans.filter(p=>p.ruleId==='schedule-rule'&&p.month==='2026-12').length,1);assert.deepEqual(after.data.journal,before.data.journal);assert.equal((await db.prepare("SELECT COUNT(*) n FROM budget_operations WHERE owner_id='owner' AND event_id LIKE 'auto-month:2026-12:%'").first()).n,1);});
 await t.test('CSV commands validate fingerprints, isolate private imports and do not debit banks',async()=>{
 assert.equal((await call('/legacy-fixed-preview')).status,403);
 assert.equal((await call('/legacy-fixed-preview','child')).status,403);
 const merchant='SYNTHETIC API SHOP',method='1回払い',row={date,merchant,method,signedAmount:50,occurrence:1,category:'その他',action:'add'};
 row.key=await fingerprint('visa',{canonical:JSON.stringify([date,merchantKey(merchant),50,merchantKey(method)]),occurrence:1});
 const before=await get(),body={cardId:'visa',statementMonth:date.slice(0,7),confirm:true,rows:[row],expectedRevision:before.revision};
 assert.equal((await post('csv.import',{...body,rows:[{...row,key:'f'.repeat(64)}]})).status,409);
 assert.equal((await post('csv.import',body,'csv-api-operation')).status,200);
 assert.equal((await post('csv.import',body,'csv-api-operation')).status,200);
 const after=await get();assert.equal(after.summary.accounts.find(a=>a.id==='bank-0').balance,before.summary.accounts.find(a=>a.id==='bank-0').balance);
 assert.equal(after.data.entries.filter(e=>e.csvImported).length,1);
 assert.equal((await get('other')).data.entries.length,0);
 });
 await t.test('fixed import reads the legacy source only for its owner, preserves paid records and rejects stale previews',async()=>{
 const legacy=await mf.getD1Database('LEGACY_DB');await legacy.prepare('CREATE TABLE app_data(app TEXT,data_key TEXT,data_json TEXT)').run();
 const raw={plan:{fixedExpenses:[{id:'synthetic-legacy-rule',name:'Synthetic fee',amount:1000,payment:'楽天銀行',day:15,dateMode:'monthly'},{id:'deleted-legacy-rule',name:'Deleted synthetic',amount:100,payment:'楽天銀行',day:15,dateMode:'monthly',deletedAt:'synthetic'}]},entries:[{id:'synthetic-paid',date:'2026-11-04',type:'expense',amount:1000,payment:'楽天銀行',category:'その他'}]};
 await legacy.prepare('INSERT INTO app_data VALUES(?,?,?)').bind('kakeibo-app','main',JSON.stringify(raw)).run();
 const preview=await call('/legacy-fixed-preview','bootstrap-admin');assert.equal(preview.status,200);assert.equal(preview.data.rules.length,1);
 const before=(await call('','bootstrap-admin')).data;
 const data={month:'2026-11',confirm:true,sourceHash:preview.data.sourceHash,expectedRevision:before.revision,rules:[{sourceId:'synthetic-legacy-rule',payment:'bank-0',day:15,recordedKind:'old',recordedId:'synthetic-paid'}]};
 const result=await call('/command','bootstrap-admin',{eventId:'fixed-api-operation',command:{type:'fixed.import',data}});assert.equal(result.status,200,JSON.stringify(result.data));
 const after=(await call('','bootstrap-admin')).data;assert.deepEqual(after.data.journal,before.data.journal);assert.equal(after.data.plans[0].status,'excluded');assert.equal(after.data.entries[0].balanceIncludedExternally,true);
 assert.equal((await call('/command','bootstrap-admin',{eventId:'fixed-api-operation',command:{type:'fixed.import',data}})).status,200);
 raw.plan.fixedExpenses[0].amount=1200;await legacy.prepare('UPDATE app_data SET data_json=?').bind(JSON.stringify(raw)).run();
 assert.equal((await call('/command','bootstrap-admin',{eventId:'fixed-api-stale-operation',command:{type:'fixed.import',data}})).status,409);
 });
 await t.test('deferred billing assignment preserves balances, retries safely and remains in audit replay',async()=>{
 const row={date,merchant:'SYNTHETIC DEFERRED SHOP',method:'1回払い',signedAmount:75,occurrence:1,category:'その他',action:'add',paymentMonth:'12月以降'};row.key=await fingerprint('visa',{canonical:JSON.stringify([date,merchantKey(row.merchant),75,merchantKey(row.method)]),occurrence:1});
 assert.equal((await post('csv.import',{cardId:'visa',statementMonth:'2026-11',confirm:true,rows:[row]})).status,200);const before=await get(),e=before.data.entries.find(e=>e.id==='csv-'+row.key);assert.equal(e.dueDate,null);
 const body={entryId:e.id,month:'2026-12',confirm:true,expectedRevision:before.revision};assert.equal((await post('csv.billing.assign',body,'csv-assign-operation')).status,200);assert.equal((await post('csv.billing.assign',body,'csv-assign-operation')).status,200);const after=await get();assert.deepEqual(after.data.journal,before.data.journal);assert.equal(after.data.entries.find(x=>x.id===e.id).csvBilling.status,'confirmed');assert.equal((await get('other')).data.entries.length,0);
 });
 await t.test('classification preview and migration are private, revision-checked and replayable',async()=>{
 const before=await get();
 assert.equal((await call('/classification-preview','child')).status,403);
 assert.equal((await call('/classification-preview','other')).data.entries,0);
 const preview=await call('/classification-preview');
 assert.equal(preview.status,200);
 assert.equal(preview.data.revision,before.revision);
 assert.deepEqual((await get()).data,before.data);
 assert.equal((await post('classification.migrate',{confirm:true,expectedRevision:before.revision-1})).status,409);
 const payload={confirm:true,expectedRevision:before.revision};
 assert.equal((await post('classification.migrate',payload,'synthetic-taxonomy-migration')).status,200);
 assert.equal((await post('classification.migrate',payload,'synthetic-taxonomy-migration')).status,200);
 const after=await get();
 assert.equal(after.revision,before.revision+1);
 assert.deepEqual(after.data.journal,before.data.journal);
 assert.deepEqual(after.data.bills,before.data.bills);
 assert.equal((await call('/classification-preview')).data.alreadyApplied,true);
 });
 await t.test('private JSON export can replay the full command history and detect tampering',async()=>{const backup=(await call('/export')).data;assert.equal(replayBudgetAudit(backup).ok,true);const damaged=structuredClone(backup);damaged.audit[0].after_hash='wrong';assert.throws(()=>replayBudgetAudit(damaged));});
 await t.test('logout/revocation closes private routes and foreign-key integrity stays intact',async()=>{await db.prepare("UPDATE sessions SET revoked_at=? WHERE user_id='owner'").bind(now).run();assert.equal((await call('/audit')).status,401);assert.deepEqual((await db.prepare('PRAGMA foreign_key_check').all()).results,[]);});
 }finally{await mf.dispose();}
});
