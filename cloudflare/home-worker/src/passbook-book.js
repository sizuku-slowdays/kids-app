const reply=(v,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'private, no-store'}});
const validDay=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
function check(ok,message,status=400){if(!ok)throw Object.assign(Error(message),{status});}
const columns=`a.id AS id,a.household_id AS household_id,a.unit_id AS unit_id,u.code AS code,u.name AS unit_name,u.kind AS kind,u.symbol AS symbol,usr.display_name AS display_name,usr.id AS owner_user_id`;
async function bookAccounts(db,h,user){
 // Sibling-point visibility and gift permissions never grant a full passbook.
 const guardian=!!await db.prepare('SELECT 1 FROM passbook_gift_guardians WHERE household_id=? AND user_id=?').bind(h,user).first();
 const result=await db.prepare(`SELECT ${columns},'child' ledger FROM passbook_accounts a JOIN children c ON c.id=a.child_id AND c.household_id=a.household_id JOIN users usr ON usr.id=c.user_id AND usr.active=1 JOIN memberships m ON m.group_id=c.household_id AND m.user_id=c.user_id JOIN passbook_units u ON u.id=a.unit_id AND u.household_id=a.household_id WHERE a.household_id=? AND (?=1 OR c.user_id=?) UNION ALL SELECT ${columns},'adult' ledger FROM passbook_adult_accounts a JOIN users usr ON usr.id=a.owner_user_id AND usr.active=1 JOIN memberships m ON m.group_id=a.household_id AND m.user_id=a.owner_user_id JOIN passbook_units u ON u.id=a.unit_id AND u.household_id=a.household_id WHERE a.household_id=? AND (?=1 OR a.owner_user_id=?) ORDER BY display_name,kind,code,id`).bind(h,guardian?1:0,user,h,guardian?1:0,user).all();return result.results;
}
export async function bookRoute(request,env,h,user){
 try{
  check(request.method==='GET','通帳表示は読み取り専用です',405);
  const db=env.DB,url=new URL(request.url),path=url.pathname.slice('/api/passbook/book'.length);
  const available=await bookAccounts(db,h,user);
  if(path==='/accounts')return reply({accounts:available.map(({ledger,owner_user_id,...a})=>a)});
  check(path==='','見つかりません',404);
  const account=available.find(a=>a.id===url.searchParams.get('account'));check(account,'この通帳は表示・印刷できません',403);
  const from=url.searchParams.get('from'),to=url.searchParams.get('to');check((!from||validDay(from))&&(!to||validDay(to))&&(!from||!to||from<=to),'開始日・終了日を確認してください');
  const ledger=account.ledger==='adult'?'passbook_adult_entries':'passbook_entries';
  const newest=await db.prepare(`SELECT COALESCE(MAX(rowid),0) n FROM ${ledger} WHERE account_id=? AND household_id=?`).bind(account.id,h).first();
  const inputSnapshot=url.searchParams.get('snapshot'),snapshot=inputSnapshot===null?newest.n:Number(inputSnapshot);check(Number.isSafeInteger(snapshot)&&snapshot>=0&&snapshot<=newest.n,'表示時点を更新してください',409);
  const after=url.searchParams.get('after');let cursor=null;
  if(after){check(after.length<=200,'履歴の位置を確認してください');cursor=await db.prepare(`SELECT julianday(occurred_at) stamp,rowid seq FROM ${ledger} WHERE id=? AND account_id=? AND household_id=? AND rowid<=?`).bind(after,account.id,h,snapshot).first();check(cursor,'この通帳の履歴を指定してください',403);}
  const cte=`WITH ordered AS (SELECT rowid seq,id,delta,memo,occurred_at,created_at,source_app,source_event,julianday(occurred_at) stamp,date(occurred_at,'+9 hours') day,SUM(delta) OVER(ORDER BY julianday(occurred_at),rowid ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) balance FROM ${ledger} WHERE account_id=? AND household_id=? AND rowid<=?)`;
  const range=`(? IS NULL OR day>=?) AND (? IS NULL OR day<=?)`;
  const results=await db.batch([
   db.prepare(cte+` SELECT COUNT(*) total_count,COALESCE(SUM(delta),0) total_balance,COALESCE(SUM(CASE WHEN stamp IS NULL THEN 1 ELSE 0 END),0) invalid_dates,COALESCE(MAX(ABS(delta)),0) max_delta,COALESCE(MAX(ABS(balance)),0) max_balance,COALESCE(SUM(CASE WHEN ? IS NOT NULL AND day<? THEN delta ELSE 0 END),0) opening_balance,COALESCE(SUM(CASE WHEN ${range} THEN delta ELSE 0 END),0) period_delta,COALESCE(SUM(CASE WHEN ${range} THEN 1 ELSE 0 END),0) period_count,COALESCE(SUM(CASE WHEN source_app='legacy-opening' THEN 1 ELSE 0 END),0) legacy_adjustments,COALESCE(SUM(CASE WHEN source_app LIKE 'legacy-%' AND source_app<>'legacy-opening' AND day<'1971-01-01' THEN 1 ELSE 0 END),0) uncertain_legacy_dates,COALESCE(SUM(CASE WHEN balance<0 THEN 1 ELSE 0 END),0) negative_balances FROM ordered`).bind(account.id,h,snapshot,from,from,from,from,to,to,from,from,to,to),
   db.prepare(cte+` SELECT id,seq,delta,memo,occurred_at,day,balance,source_app,source_event FROM ordered WHERE ${range} AND (? IS NULL OR stamp>? OR (stamp=? AND seq>?)) ORDER BY stamp,seq LIMIT 101`).bind(account.id,h,snapshot,from,from,to,to,after,cursor?.stamp??null,cursor?.stamp??null,cursor?.seq??null)
  ]);
  const stats=results[0].results[0];check(stats.invalid_dates===0,'日付を確認できない取引があります。履歴は変更せず、管理者へ確認してください',409);
  check(Number.isSafeInteger(stats.total_balance)&&Number.isSafeInteger(stats.max_delta)&&Number.isSafeInteger(stats.max_balance)&&Number.isSafeInteger(stats.opening_balance)&&Number.isSafeInteger(stats.period_delta),'金額の整合性を確認する必要があります。履歴は変更していません',409);
  const records=results[1].results.slice(0,100);check(records.every(r=>Number.isSafeInteger(r.balance)&&Number.isSafeInteger(r.delta)),'残高の整合性を確認してください',409);
  return reply({version:1,account:{id:account.id,display_name:account.display_name,code:account.code,unit_name:account.unit_name,kind:account.kind,symbol:account.symbol},range:{from,to},snapshot_rowid:snapshot,issued_at:new Date().toISOString(),ordering:'occurred_at_instant_then_ledger_rowid',...stats,closing_balance:stats.opening_balance+stats.period_delta,records,next_after:results[1].results.length>100?records.at(-1).id:null,warnings:{legacy_adjustments:stats.legacy_adjustments,uncertain_legacy_dates:stats.uncertain_legacy_dates,negative_balances:stats.negative_balances}});
 }catch(e){if(!e.status)console.error({event:'passbook_book_query_failed',reason:'query_or_integrity'});const status=e.status||409;return reply({error:e.status?e.message:'通帳の整合性を確認できませんでした。残高・履歴は変更していません'},status);}
}
