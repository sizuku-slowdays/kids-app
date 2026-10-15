type EnvLike={DB:D1Database;PRIVATE_FILES:R2Bucket};
function fail(message:string,status=400):never {throw Object.assign(Error(message),{status});}
const amount=(v:unknown,min=0,max=10000000)=>{if(!Number.isSafeInteger(v)||Number(v)<min||Number(v)>max)fail('金額・回数を確認してください');return Number(v);};
export const financeDay=(time=Date.now())=>new Date(time+9*3600000).toISOString().slice(0,10);
const month=(day:string)=>day.slice(0,7);
export function nextMonth(m:string){const [y,n]=m.split('-').map(Number);return new Date(Date.UTC(y,n,1)).toISOString().slice(0,7);}
const previousMonth=(m:string)=>{const [y,n]=m.split('-').map(Number);return new Date(Date.UTC(y,n-2,1)).toISOString().slice(0,7);};
const dayEpoch=(day:string)=>Date.parse(day+'T00:00:00+09:00')/1000;
export const INTEREST_TICKS=1335900000n; // 10,000 basis points * lcm(365,366).
function validMonth(v:unknown):v is string{return typeof v==='string'&&/^20\d\d-(0[1-9]|1[0-2])$/.test(v);}
type Policy={effective_day:string;rate_bps:number;annual_cap:number;enabled:number};
type InterestAccount={account_id:string;household_id:string;started_day:string;started_at:number;opening_balance:number;carry_ticks:string};
export function calculateInterest(input:{targetMonth:string;startedDay:string;opening:number;policies:Policy[];changes:{day:string;delta:number}[];carry:string;yearPaid:number;cap:number}){
 const end=nextMonth(input.targetMonth)+'-01';let day=input.targetMonth+'-01',balance=input.opening,earned=0n;const detail:{day:string;balance:number;rate_bps:number;ticks:string}[]=[];
 const start=Math.max(dayEpoch(day),dayEpoch(input.startedDay));day=financeDay(start*1000);
 for(;day<end;day=new Date(Date.parse(day+'T00:00:00Z')+86400000).toISOString().slice(0,10)){
  // Ledger entries use their trusted insertion time; imported/backdated display dates never earn retrospectively.
  const p=input.policies.filter(p=>p.effective_day<=day).at(-1);const delta=input.changes.filter(x=>x.day===day).reduce((n,x)=>n+x.delta,0);balance+=delta;if(!Number.isSafeInteger(balance))fail('残高が計算範囲を超えています。個別確認してください',409);
  const y=Number(day.slice(0,4)),leap=y%4===0&&(y%100!==0||y%400===0),factor=leap?365n:366n;
  const ticks=p?.enabled?BigInt(Math.max(0,balance))*BigInt(p.rate_bps)*factor:0n;earned+=ticks;detail.push({day,balance,rate_bps:p?.enabled?p.rate_bps:0,ticks:String(ticks)});
 }
 const total=BigInt(input.carry)+earned,available=Math.max(0,input.cap-input.yearPaid),paid=Math.min(Number(total/INTEREST_TICKS),available);
 // Above-cap amounts are discarded, not shifted into the following year. Keep only fractions below the cap.
 const carry=paid>=available?'0':String(total%INTEREST_TICKS);
 return {earned:String(earned),paid,carry,detail};
}
async function cashAccount(env:EnvLike,h:string,id:string){const a=await env.DB.prepare("SELECT a.id,a.child_id,u.code FROM passbook_accounts a JOIN passbook_units u ON u.id=a.unit_id WHERE a.id=? AND a.household_id=? AND u.kind='money' AND u.code IN ('cash','wallet')").bind(id,h).first<{id:string;child_id:string;code:string}>();if(!a)fail('子どもの現金通帳が見つかりません',404);return a;}
const eventId=(v:unknown)=>{if(typeof v!=='string'||v.length<8||v.length>100||!/^[\w:-]+$/.test(v))fail('操作IDを確認してください');return String(v);};
async function backup(env:EnvLike,h:string,user:string,operation:string){
 const tables=['passbook_accounts','passbook_entries','passbook_adult_accounts','passbook_adult_entries','passbook_chore_days','passbook_chores','passbook_allowance_plans','passbook_allowance_payments','passbook_interest_accounts','passbook_interest_policies','passbook_interest_payments','passbook_cash_operations','passbook_chore_attempts','passbook_chore_attempt_settlements','passbook_chore_cash_repairs'];
 const result=await env.DB.batch(tables.map(t=>env.DB.prepare(t==='passbook_interest_policies'?`SELECT * FROM ${t} WHERE account_id IN (SELECT account_id FROM passbook_interest_accounts WHERE household_id=?)`:`SELECT * FROM ${t} WHERE household_id=?`).bind(h)));
 const data=JSON.stringify({version:1,household_id:h,user,operation,created_at:new Date().toISOString(),tables:tables.map((t,i)=>({name:t,rows:result[i].results}))});
 const key=`passbook-finance-backups/${h}/${crypto.randomUUID()}.json`;await env.PRIVATE_FILES.put(key,data);const read=await env.PRIVATE_FILES.get(key);if(!read||await read.text()!==data)fail('バックアップを確認できません。変更を止めました',409);return key;
}
async function log(env:EnvLike,h:string,account:string|null,kind:string,target:string,status:string,detail:string,time:number){await env.DB.prepare('INSERT INTO passbook_automation_logs VALUES (?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),h,account,kind,target,status,detail,Math.floor(time/1000)).run();}
export async function runCashAutomation(env:EnvLike,time=Date.now(),onlyHousehold?:string){
 const day=financeDay(time);if(!day.endsWith('-01'))return {ok:true,skipped:'月初以外は実行しません'};
 const current=month(day),target=previousMonth(current),now=Math.floor(time/1000);let errors=0,paid=0;
 const homes=(await env.DB.prepare("SELECT a.household_id,(SELECT m.user_id FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.group_id=a.household_id AND m.role IN ('owner','admin') AND u.active=1 ORDER BY CASE m.role WHEN 'owner' THEN 0 ELSE 1 END,m.user_id LIMIT 1) actor FROM passbook_activation a WHERE (? IS NULL OR a.household_id=?)").bind(onlyHousehold||null,onlyHousehold||null).all<{household_id:string;actor:string|null}>()).results;
 for(const h of homes){if(!h.actor)continue;
 // Interest is applied before this month's allowance, from prior-month end-of-day balances only.
 const interest=(await env.DB.prepare('SELECT * FROM passbook_interest_accounts WHERE household_id=? AND started_day<?').bind(h.household_id,day).all<InterestAccount>()).results;
 for(const a of interest){try{
  if(await env.DB.prepare('SELECT 1 FROM passbook_interest_payments WHERE account_id=? AND target_month=?').bind(a.account_id,target).first())continue;
  const policies=(await env.DB.prepare('SELECT * FROM passbook_interest_policies WHERE account_id=? ORDER BY effective_day').bind(a.account_id).all<Policy>()).results;
  const active=policies.filter(p=>p.effective_day<=day).at(-1);if(!active?.enabled){await log(env,h.household_id,a.account_id,'interest',target,'skipped','利息OFF。過去月の追加入金はしません',time);continue;}
  if(a.started_day>=day||a.started_day>target+'-31')continue;
  const from=a.started_day>target+'-01'?a.started_day:target+'-01';
  // Sum post-activation entries before this month to reconstruct its opening balance.
  const opening=await env.DB.prepare('SELECT COALESCE(SUM(delta),0) n FROM passbook_entries WHERE account_id=? AND created_at>=? AND created_at<?').bind(a.account_id,a.started_at,dayEpoch(from)).first<{n:number}>();
  const rows=(await env.DB.prepare("SELECT date(created_at,'unixepoch','+9 hours') day,SUM(delta) delta FROM passbook_entries WHERE account_id=? AND created_at>=? AND created_at<? GROUP BY day ORDER BY day").bind(a.account_id,Math.max(a.started_at,dayEpoch(from)),dayEpoch(day)).all<{day:string;delta:number}>()).results;
  const year=Number(current.slice(0,4)),previous=await env.DB.prepare('SELECT COALESCE(SUM(paid),0) n FROM passbook_interest_payments WHERE account_id=? AND payment_year=?').bind(a.account_id,year).first<{n:number}>();
  const calc=calculateInterest({targetMonth:target,startedDay:from,opening:a.opening_balance+(opening?.n||0),policies,changes:rows,carry:a.carry_ticks,yearPaid:previous?.n||0,cap:active.annual_cap});
  await env.DB.prepare('INSERT INTO passbook_interest_payments VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(a.account_id,h.household_id,target,year,calc.earned,a.carry_ticks,calc.carry,calc.paid,active.annual_cap,previous?.n||0,JSON.stringify({version:1,denominator:String(INTEREST_TICKS),days:calc.detail}),h.actor,now).run();paid+=calc.paid;
  await log(env,h.household_id,a.account_id,'interest',target,'success',calc.paid+'円（端数繰越 '+calc.carry+' ticks）',time);
 }catch(e){if(await env.DB.prepare('SELECT 1 FROM passbook_interest_payments WHERE account_id=? AND target_month=?').bind(a.account_id,target).first())continue;errors++;await log(env,h.household_id,a.account_id,'interest',target,'error','未処理。月初当日に再実行できます',time);console.error(JSON.stringify({event:'passbook_automation_failed',kind:'interest'}));}}
 const plans=(await env.DB.prepare('SELECT p.*, (SELECT COUNT(*) FROM passbook_allowance_payments x WHERE x.plan_id=p.id) paid_count FROM passbook_allowance_plans p WHERE p.household_id=? AND p.enabled=1 AND p.start_month<=? AND p.eligible_month<=?').bind(h.household_id,current,current).all<{id:string;account_id:string;amount:number;revision:number;total_payments:number;paid_count:number}>()).results;
 for(const p of plans){if(p.paid_count>=p.total_payments)continue;try{
  if(await env.DB.prepare('SELECT 1 FROM passbook_allowance_payments WHERE account_id=? AND target_month=?').bind(p.account_id,current).first())continue;
  await env.DB.prepare('INSERT INTO passbook_allowance_payments VALUES (?,?,?,?,?,?,?,?)').bind(p.id,current,p.account_id,h.household_id,p.amount,p.revision,h.actor,now).run();paid+=p.amount;await log(env,h.household_id,p.account_id,'allowance',current,'success',p.amount+'円',time);
 }catch(e){if(await env.DB.prepare('SELECT 1 FROM passbook_allowance_payments WHERE account_id=? AND target_month=?').bind(p.account_id,current).first())continue;errors++;await log(env,h.household_id,p.account_id,'allowance',current,'error','未処理。月初当日に再実行できます',time);console.error(JSON.stringify({event:'passbook_automation_failed',kind:'allowance'}));}}
 }
 return {ok:errors===0,errors,paid};
}
export async function financeRoute(request:Request,env:EnvLike,h:string,user:string,admin:boolean,readBody:(r:Request)=>Promise<Record<string,unknown>>){
 const url=new URL(request.url),path=url.pathname.slice('/api/passbook/finance'.length),method=request.method,today=financeDay(),now=Math.floor(Date.now()/1000),current=month(today);
 const own=await env.DB.prepare('SELECT id FROM children WHERE household_id=? AND user_id=?').bind(h,user).first<{id:string}>();
 const accounts=(await env.DB.prepare("SELECT a.id,a.child_id,u.code,c.display_name,COALESCE((SELECT SUM(delta) FROM passbook_entries e WHERE e.account_id=a.id),0) balance FROM passbook_accounts a JOIN passbook_units u ON u.id=a.unit_id JOIN children c ON c.id=a.child_id WHERE a.household_id=? AND u.kind='money' AND u.code IN ('cash','wallet') AND (?=1 OR c.user_id=?)").bind(h,admin?1:0,user).all<{id:string;child_id:string;code:string;display_name:string;balance:number}>()).results;
 if(path===''&&method==='GET'){
  const ids=JSON.stringify(accounts.filter(a=>a.code==='cash').map(a=>a.id));
  const result=await env.DB.batch([
   env.DB.prepare('SELECT p.*,(SELECT COUNT(*) FROM passbook_allowance_payments x WHERE x.plan_id=p.id) paid_count,(SELECT MAX(target_month) FROM passbook_allowance_payments x WHERE x.account_id=p.account_id) last_month FROM passbook_allowance_plans p WHERE p.account_id IN (SELECT value FROM json_each(?)) ORDER BY created_at DESC,id').bind(ids),
   env.DB.prepare('SELECT * FROM passbook_interest_accounts WHERE account_id IN (SELECT value FROM json_each(?))').bind(ids),
   env.DB.prepare('SELECT * FROM passbook_interest_policies WHERE account_id IN (SELECT value FROM json_each(?)) ORDER BY effective_day').bind(ids),
   env.DB.prepare('SELECT kind,target_month,status,detail,created_at FROM passbook_automation_logs WHERE household_id=? AND ?=1 ORDER BY created_at DESC,rowid DESC LIMIT 60').bind(h,admin?1:0)
  ]);
  const plans=result[0].results.map((p:any)=>({...p,remaining:p.total_payments-p.paid_count,next_month:p.enabled&&p.total_payments>p.paid_count?[p.start_month,p.eligible_month,today.endsWith('-01')?current:nextMonth(current),p.last_month?nextMonth(p.last_month):p.start_month].sort().at(-1):null}));
  const interest=result[1].results.map((a:any)=>{const policies=(result[2].results as unknown as (Policy & {account_id:string})[]).filter(p=>p.account_id===a.account_id);return {...a,policy:policies.at(-1),effective_policy:policies.filter(p=>p.effective_day<=today).at(-1),next_payment:nextMonth(current)+'-01'};});
  return {accounts,plans,interest,logs:result[3].results,own_child_id:own?.id};
 }
 if(!admin)fail('現金と自動入金の設定は保護者だけが変更できます',403);
 const d=await readBody(request);
 if(path==='/self-account'&&method==='POST'){
  await backup(env,h,user,'create-adult-cash');
  await env.DB.prepare("INSERT OR IGNORE INTO passbook_adult_accounts(id,household_id,owner_user_id,unit_id) SELECT ?||':user:'||?||':cash',?,?,id FROM passbook_units WHERE household_id=? AND code='cash' AND kind='money' AND active=1").bind(h,user,h,user,h).run();
  if(!await env.DB.prepare("SELECT 1 FROM passbook_adult_accounts a JOIN passbook_units u ON u.id=a.unit_id WHERE a.household_id=? AND a.owner_user_id=? AND u.code='cash' AND u.kind='money'").bind(h,user).first())fail('家庭の現金の種類を確認してください',409);
  return {ok:true};
 }
 if(path==='/allowance'&&method==='POST'){
  const a=await cashAccount(env,h,String(d.account_id));if(a.code!=='cash')fail('ママ銀行の現金通帳を選んでください');if(!validMonth(d.start_month)||d.start_month<(today.endsWith('-01')?current:nextMonth(current)))fail('開始年月は次の入金日以降にしてください');
  const value=amount(d.amount,1),total=amount(d.total_payments??12,1,120);await backup(env,h,user,'create-allowance');const id=crypto.randomUUID();
  await env.DB.prepare('INSERT INTO passbook_allowance_plans VALUES (?,?,?,?,?,?,?,1,1,?,?)').bind(id,h,a.id,value,d.start_month,d.start_month,total,user,now).run();return {ok:true,id};
 }
 if(path.startsWith('/allowance/')&&method==='PUT'){
  const id=path.slice('/allowance/'.length);if(typeof d.enabled!=='boolean')fail('設定を確認してください');const value=amount(d.amount,1),revision=amount(d.revision,1);const p=await env.DB.prepare('SELECT p.*,(SELECT COUNT(*) FROM passbook_allowance_payments x WHERE x.plan_id=p.id) n FROM passbook_allowance_plans p WHERE id=? AND household_id=?').bind(id,h).first<any>();if(!p)fail('設定が見つかりません',404);if(d.enabled&&p.n>=p.total_payments)fail('終了済みです。新しい12回の設定を作ってください',409);
  const eligible=d.enabled&&!p.enabled?nextMonth(current):p.eligible_month;
  const r=await env.DB.prepare('UPDATE passbook_allowance_plans SET amount=?,enabled=?,eligible_month=?,revision=revision+1 WHERE id=? AND household_id=? AND revision=?').bind(value,d.enabled?1:0,eligible,id,h,revision).run();if(!r.meta.changes)fail('設定が更新されています。開き直してください',409);return {ok:true};
 }
 if(path==='/interest'&&method==='PUT'){
  const a=await cashAccount(env,h,String(d.account_id));if(a.code!=='cash')fail('利息は子どものママ銀行だけに設定できます');const rate=amount(d.rate_bps,0,10000),cap=amount(d.annual_cap);if(typeof d.enabled!=='boolean')fail('設定を確認してください');
  await backup(env,h,user,'interest-policy');const existing=await env.DB.prepare('SELECT 1 FROM passbook_interest_accounts WHERE account_id=?').bind(a.id).first();
  // Begin on the next JST day, capturing the balance at that boundary from the immutable ledger.
  // First setup records current balance; later same-day transactions are included in daily reconstruction.
  const start=new Date(Date.parse(today+'T00:00:00Z')+86400000).toISOString().slice(0,10);
  const statements:D1PreparedStatement[]=[];
  if(!existing)statements.push(env.DB.prepare('INSERT OR IGNORE INTO passbook_interest_accounts(account_id,household_id,started_day,started_at,opening_balance) SELECT ?,?,?,?,COALESCE((SELECT SUM(delta) FROM passbook_entries WHERE account_id=? AND created_at<?),0)').bind(a.id,h,start,now,a.id,now));
  statements.push(env.DB.prepare('INSERT INTO passbook_interest_policies VALUES (?,?,?,?,?,?,?) ON CONFLICT(account_id,effective_day) DO UPDATE SET rate_bps=excluded.rate_bps,annual_cap=excluded.annual_cap,enabled=excluded.enabled,created_by=excluded.created_by,created_at=excluded.created_at').bind(a.id,start,rate,cap,d.enabled?1:0,user,now));await env.DB.batch(statements);return {ok:true,effective_day:start};
 }
 if(path==='/wallet'&&method==='POST'){
  const a=await cashAccount(env,h,String(d.account_id));if(a.code!=='cash')fail('子どものママ銀行を選んでください');const value=amount(d.balance),event=eventId(d.event_id),wallet=h+':wallet:'+a.child_id;
  const old=await env.DB.prepare('SELECT * FROM passbook_cash_operations WHERE id=? AND household_id=?').bind(event,h).first<any>();if(old){if(old.amount!==value||old.account_id!==wallet)fail('同じ操作IDの内容が異なります',409);return {ok:true,already_recorded:true};}
  await backup(env,h,user,'wallet-balance');await env.DB.batch([
   env.DB.prepare("INSERT OR IGNORE INTO passbook_units(id,household_id,code,name,kind,symbol) VALUES (?||':wallet',?,'wallet','おさいふ','money','円')").bind(h,h),
   env.DB.prepare("INSERT OR IGNORE INTO passbook_accounts VALUES (?,?,?,?||':wallet')").bind(wallet,h,a.child_id,h),
   env.DB.prepare("INSERT INTO passbook_cash_operations VALUES (?,?,?,NULL,'adjust',?,?,?,?) ON CONFLICT(id) DO NOTHING").bind(event,h,wallet,value,'手元の現金を数えて確認',user,now)
  ]);return {ok:true};
 }
 if(path==='/transfer'&&method==='POST'){
  const from=await cashAccount(env,h,String(d.from_account)),to=await cashAccount(env,h,String(d.to_account)),value=amount(d.amount,1),event=eventId(d.event_id);if(from.child_id!==to.child_id||from.code===to.code)fail('同じ子どもの銀行とおさいふを選んでください');
  const old=await env.DB.prepare('SELECT * FROM passbook_cash_operations WHERE id=?').bind(event).first<any>();if(old){if(old.household_id!==h||old.account_id!==from.id||old.other_account_id!==to.id||old.amount!==value)fail('同じ操作IDの内容が異なります',409);return {ok:true,already_recorded:true};}
  try{await env.DB.prepare("INSERT INTO passbook_cash_operations VALUES (?,?,?,?,'transfer',?,?,?,?)").bind(event,h,from.id,to.id,value,from.code==='cash'?'銀行からおさいふへ':'おさいふから銀行へ',user,now).run();}catch(e){const done=await env.DB.prepare('SELECT 1 FROM passbook_cash_operations WHERE id=? AND household_id=? AND account_id=? AND other_account_id=? AND amount=?').bind(event,h,from.id,to.id,value).first();if(!done)fail('残高不足または振替済みです。履歴を確認してください',409);}return {ok:true};
 }
 if(path==='/retry'&&method==='POST')return runCashAutomation(env,Date.now(),h);
 if(path==='/chore-audit'&&method==='POST'){
  const day=String(d.day||'');if(!/^20\d\d-\d\d-\d\d$/.test(day))fail('確認日を選んでください');const target='user:'+user;
  const rows=(await env.DB.prepare("SELECT d.*,c.name,(SELECT COALESCE(SUM(e.delta),0) FROM passbook_adult_entries e JOIN passbook_adult_accounts ac ON ac.id=e.account_id JOIN passbook_units un ON un.id=ac.unit_id WHERE e.household_id=d.household_id AND e.source_app='chores' AND e.source_event=d.id AND un.code='cash' AND un.kind='money') credited FROM passbook_chore_days d JOIN passbook_chores c ON c.id=d.chore_id WHERE d.household_id=? AND d.day=? AND d.target=? ORDER BY d.chore_id").bind(h,day,target).all<any>()).results;
  const attempts=(await env.DB.prepare('SELECT chore_id,day,event_id,money,points,status,error FROM passbook_chore_attempts WHERE household_id=? AND day=? AND target=?').bind(h,day,target).all()).results;
  return {day,recorded:rows,attempts,note:rows.length?'完了記録の金額と入金を照合してください':'対象の完了記録がありません。未払い額を推測して入金しません'};
 }
 if(path==='/chore-retry'&&method==='POST'){
  const event=eventId(d.event_id);const t=await env.DB.prepare('SELECT * FROM passbook_chore_attempts WHERE household_id=? AND event_id=?').bind(h,event).first<any>();if(!t)fail('未払いの記録がありません。推測では入金しません',409);
  if(t.status!=='pending')return {ok:true,already_recorded:true};await backup(env,h,user,'pending-chore-settlement');
  try{await env.DB.prepare('INSERT INTO passbook_chore_attempt_settlements VALUES (?,?,?,?,?,?) ON CONFLICT(chore_id,day) DO NOTHING').bind(t.chore_id,t.day,h,event,user,now).run();}catch(e){if(!await env.DB.prepare('SELECT 1 FROM passbook_chore_attempt_settlements WHERE chore_id=? AND day=? AND household_id=? AND event_id=?').bind(t.chore_id,t.day,h,event).first())throw e;}return {ok:true};
 }
 if(path==='/chore-repair'&&method==='POST'){
  const id=String(d.day_id||'');const row=await env.DB.prepare("SELECT d.id,d.money,a.id account_id FROM passbook_chore_days d JOIN passbook_adult_accounts a ON 'user:'||a.owner_user_id=d.target JOIN passbook_units u ON u.id=a.unit_id WHERE d.id=? AND d.household_id=? AND d.kind='complete' AND a.owner_user_id=? AND u.code='cash' AND u.kind='money'").bind(id,h,user).first<{id:string;money:number;account_id:string}>();if(!row)fail('本人の完了記録と現金通帳を確認できません。推測では入金しません',409);await backup(env,h,user,'chore-repair');await env.DB.prepare('INSERT INTO passbook_chore_cash_repairs VALUES (?,?,?,?,?) ON CONFLICT(day_id) DO NOTHING').bind(id,h,row.account_id,user,now).run();return {ok:true};
 }
 fail('見つかりません',404);
}
