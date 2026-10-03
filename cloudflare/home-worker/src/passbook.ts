import { snapshot, importLegacy } from "./passbook-import";
import { activatePassbook } from "./passbook-cutover";
type Context = { DB: D1Database; LEGACY_DB?: D1Database; PRIVATE_FILES: R2Bucket };
type Group = {id:string; name:string; role:string};
const reply=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
function check(ok:unknown,message:string,status=400):asserts ok {if(!ok)throw Object.assign(new Error(message),{status});}
const str=(v:unknown)=>{check(typeof v==='string'&&v.trim().length>0&&v.length<=200,'入力内容を確認してください');return v.trim();};
const integer=(v:unknown)=>{check(Number.isSafeInteger(v)&&Math.abs(Number(v))<=10000000,'数値を確認してください');return Number(v);};
export async function passbookRoute(request:Request,env:Context,userId:string,readBody:(r:Request)=>Promise<Record<string,unknown>>) {
 try {
  const url=new URL(request.url),path=url.pathname.slice('/api/passbook'.length),method=request.method;
  const groups=(await env.DB.prepare("SELECT g.id,g.name,m.role FROM groups g JOIN memberships m ON m.group_id=g.id JOIN group_apps ga ON ga.group_id=g.id AND ga.app_id='passbook' WHERE g.kind='household' AND m.user_id=?").bind(userId).all<Group>()).results;
  if(path==='/households'&&method==='GET')return reply(groups);
  const household=url.searchParams.get('household')||groups[0]?.id;
  const group=groups.find(g=>g.id===household);check(group,'この家庭にはアクセスできません',403);
  const admin=['owner','admin'].includes(group.role);
  const active=Boolean(await env.DB.prepare('SELECT 1 FROM passbook_activation WHERE household_id=?').bind(household).first());
  const own=await env.DB.prepare('SELECT id FROM children WHERE household_id=? AND user_id=?').bind(household,userId).first<{id:string}>();
  const imported=await env.DB.prepare('SELECT summary_json,snapshot_hash,backup_key FROM passbook_imports WHERE household_id=?').bind(household).first<{summary_json:string;snapshot_hash:string;backup_key:string}>();
  const settings=await env.DB.prepare('SELECT sibling_points_visible FROM passbook_settings WHERE household_id=?').bind(household).first<{sibling_points_visible:number}>();
  const accounts=async()=> (await env.DB.prepare(`SELECT a.id,a.child_id,a.unit_id,c.display_name,u.name,u.code,u.kind,u.symbol,COALESCE((SELECT SUM(e.delta) FROM passbook_entries e WHERE e.account_id=a.id),0) balance,COALESCE((SELECT SUM(r.cost) FROM passbook_requests r WHERE r.account_id=a.id AND r.status='pending'),0) pending FROM passbook_accounts a JOIN children c ON c.id=a.child_id JOIN passbook_units u ON u.id=a.unit_id WHERE a.household_id=? AND (?=1 OR c.user_id=? OR (?=1 AND u.kind='points')) UNION ALL SELECT a.id,'user:'||a.owner_user_id child_id,a.unit_id,usr.display_name,u.name,u.code,u.kind,u.symbol,COALESCE((SELECT SUM(e.delta) FROM passbook_adult_entries e WHERE e.account_id=a.id),0) balance,0 pending FROM passbook_adult_accounts a JOIN users usr ON usr.id=a.owner_user_id JOIN passbook_units u ON u.id=a.unit_id WHERE a.household_id=? AND (?=1 OR a.owner_user_id=?) ORDER BY display_name,kind,code`).bind(household,admin?1:0,userId,settings?.sibling_points_visible||0,household,admin?1:0,userId).all()).results;
  if(path===''&&method==='GET')return reply({household:group,admin,active,imported:admin&&Boolean(imported),own_child_id:own?.id,accounts:active||(admin&&imported)?await accounts():[],children:admin?(await env.DB.prepare('SELECT id,display_name FROM children WHERE household_id=?').bind(household).all()).results.concat(imported?[{id:'user:'+userId,display_name:'自分のポイント'}]:[]):[],sibling_points_visible:Boolean(settings?.sibling_points_visible)});
  if(path==='/activation' && method==='POST'){
   check(admin && Boolean(await env.DB.prepare("SELECT 1 FROM users WHERE id=? AND platform_role='operator'").bind(userId).first()),'切替は運営管理者だけが行えます',403);
   check((await readBody(request)).confirmed===true,'残高と履歴の確認が必要です');
   return reply(await activatePassbook(env,household!,userId));
  }
  if(path==='/migration' && ['GET','POST'].includes(method)){
   check(admin && Boolean(await env.DB.prepare("SELECT 1 FROM users WHERE id=? AND platform_role='operator'").bind(userId).first()),'移行操作は運営管理者だけが行えます',403);
   if(method==='GET'){
    const source=await snapshot(env);
    const children=(await env.DB.prepare('SELECT id,display_name,user_id FROM children WHERE household_id=?').bind(household).all()).results;
    return reply({children,self:{id:'user:'+userId,display_name:'自分（このアカウント）'},bank_accounts:Object.entries(source.bank.balances).map(([id,balance])=>({id,balance})),members:source.raw.members,active,imported:Boolean(imported),summary:imported?JSON.parse(imported.summary_json):null,changed:imported?source.hash!==imported.snapshot_hash:false});
   }
   const data=await readBody(request);
   check(data.mapping && typeof data.mapping==='object','対応先を選んでください');
   const mapping=data.mapping as {bank:Record<string,string>;points:Record<string,string>};
   check(mapping.bank && mapping.points && Object.values(mapping.bank).every(v=>typeof v==='string') && Object.values(mapping.points).every(v=>typeof v==='string'),'対応先を選んでください');
   return reply(await importLegacy(env,household!,userId,mapping));
  }
  if(path==='/legacy-preview'&&method==='GET'){
   check(admin && Boolean(await env.DB.prepare("SELECT 1 FROM users WHERE id=? AND platform_role='operator'").bind(userId).first()),'移行確認は運営管理者だけが行えます',403);
   if(!env.LEGACY_DB)return reply({configured:false,message:'mama-bank-db の接続が必要です'});
   const bank=await env.LEGACY_DB.prepare("SELECT data_json,updated_at FROM app_data WHERE app='mama-bank' AND data_key='main'").first<{data_json:string;updated_at:string}>();
   check(bank,'旧銀行データが見つかりません。移行を止めています',409);
   const parsed=JSON.parse(bank.data_json);
   const members=(await env.LEGACY_DB.prepare("SELECT m.id,m.name,COALESCE((SELECT SUM(points) FROM chore_logs WHERE completed_by=m.id),0) earned,COALESCE((SELECT SUM(points_cost) FROM reward_requests WHERE member_id=m.id AND status='approved'),0) spent,COALESCE((SELECT SUM(points_cost) FROM reward_requests WHERE member_id=m.id AND status='pending'),0) pending FROM family_members m ORDER BY sort_order").all()).results;
   const logs=await env.LEGACY_DB.prepare('SELECT COUNT(*) count,SUM(CASE WHEN bank_synced=0 AND money>0 THEN 1 ELSE 0 END) unsynced FROM chore_logs').first();
   return reply({configured:true,bank_updated_at:bank.updated_at,balances:parsed.balances,history_count:Array.isArray(parsed.history)?parsed.history.length:null,members,logs});
  }
  check(active||(admin&&imported&&method==='GET'),'残高・履歴の移行確認が終わるまで利用できません',409);
  if(path==='/history'&&method==='GET'){
   const account=url.searchParams.get('account');check((await accounts()).some(a=>a.id===account),'この履歴は見られません',403);
   const before=url.searchParams.get('before');
   const adult=Boolean(await env.DB.prepare('SELECT 1 FROM passbook_adult_accounts WHERE id=? AND household_id=?').bind(account,household).first());
   const ledger=adult?'passbook_adult_entries':'passbook_entries';
   const result=await env.DB.prepare(`SELECT id,delta,memo,occurred_at,created_at FROM ${ledger} WHERE account_id=? AND (? IS NULL OR (occurred_at,rowid)<(SELECT occurred_at,rowid FROM ${ledger} WHERE id=? AND account_id=?)) ORDER BY occurred_at DESC,rowid DESC LIMIT 50`).bind(account,before,before,account).all();return reply(result.results);
  }
  if(path==='/rewards'&&method==='GET')return reply((await env.DB.prepare("SELECT r.*,u.name unit_name FROM passbook_rewards r JOIN passbook_units u ON u.id=r.unit_id WHERE r.household_id=? AND (?=1 OR r.enabled=1)").bind(household,admin?1:0).all()).results);
  if(path==='/requests'&&method==='GET')return reply((await env.DB.prepare('SELECT r.*,c.display_name FROM passbook_requests r JOIN passbook_accounts a ON a.id=r.account_id JOIN children c ON c.id=a.child_id WHERE r.household_id=? AND (?=1 OR c.user_id=?) ORDER BY r.requested_at DESC LIMIT 100').bind(household,admin?1:0,userId).all()).results);
  const data=await readBody(request),now=Math.floor(Date.now()/1000);
  if(path==='/requests'&&method==='POST'){
   check(own,'本人のアカウントで申請してください',403);
   const reward=await env.DB.prepare('SELECT * FROM passbook_rewards WHERE id=? AND household_id=? AND enabled=1').bind(str(data.reward_id),household).first<{id:string;unit_id:string;name:string;cost:number}>();check(reward,'交換するものが見つかりません',404);
   const account=await env.DB.prepare('SELECT id FROM passbook_accounts WHERE child_id=? AND unit_id=? AND household_id=?').bind(own.id,reward.unit_id,household).first<{id:string}>();check(account,'通帳が見つかりません',404);
   const id=crypto.randomUUID();await env.DB.prepare('INSERT INTO passbook_requests(id,household_id,account_id,reward_id,reward_name,cost,requested_by,requested_at) VALUES (?,?,?,?,?,?,?,?)').bind(id,household,account.id,reward.id,reward.name,reward.cost,userId,now).run();return reply({id},201);
  }
  check(admin,'管理者だけが操作できます',403);
  if(path==='/settings'&&method==='PUT'){
   check(typeof data.sibling_points_visible==='boolean','設定を確認してください');await env.DB.prepare('INSERT INTO passbook_settings VALUES (?,?) ON CONFLICT(household_id) DO UPDATE SET sibling_points_visible=excluded.sibling_points_visible').bind(household,data.sibling_points_visible?1:0).run();return reply({ok:true});
  }
  if(path==='/entries'&&method==='POST'){
   const account=str(data.account_id),delta=integer(data.delta),event=str(data.event_id);check(delta!==0,'0は登録できません');check((await accounts()).some(a=>a.id===account),'通帳が見つかりません',404);
   // Pending exchanges reserve points; withdrawals cannot consume those points.
   const adult=Boolean(await env.DB.prepare('SELECT 1 FROM passbook_adult_accounts WHERE id=? AND household_id=?').bind(account,household).first());
   const ledger=adult?'passbook_adult_entries':'passbook_entries';
   const r=await env.DB.prepare(`INSERT INTO ${ledger}(id,account_id,household_id,delta,memo,occurred_at,created_at,created_by,source_app,source_event) SELECT ?,?,?,?, ?,?,?,?,'manual',? WHERE ?>=0 OR ?<=(COALESCE((SELECT SUM(delta) FROM ${ledger} WHERE account_id=?),0)-COALESCE((SELECT SUM(cost) FROM passbook_requests WHERE account_id=? AND status='pending'),0)) ON CONFLICT(account_id,source_app,source_event) DO NOTHING`).bind(crypto.randomUUID(),account,household,delta,str(data.memo),new Date().toISOString(),now,userId,event,delta,-delta,account,account).run();
   if(!r.meta.changes){check(await env.DB.prepare(`SELECT 1 FROM ${ledger} WHERE account_id=? AND source_app='manual' AND source_event=?`).bind(account,event).first(),'残高が足りません',409);}return reply({ok:true});
  }
  if(path==='/rewards'&&method==='POST'){
   const unit=str(data.unit_id);check(await env.DB.prepare("SELECT 1 FROM passbook_units WHERE id=? AND household_id=? AND kind='points' AND active=1").bind(unit,household).first(),'ポイント種別を確認してください');const cost=integer(data.cost);check(cost>0,'必要ポイントは1以上です');const stock=data.stock===null?null:integer(data.stock);check(stock===null||stock>=0,'個数を確認してください');const id=crypto.randomUUID();await env.DB.prepare('INSERT INTO passbook_rewards(id,household_id,unit_id,name,cost,stock) VALUES (?,?,?,?,?,?)').bind(id,household,unit,str(data.name),cost,stock).run();return reply({id},201);
  }
  if(path.startsWith('/requests/')&&method==='PUT'){
   check(['approved','rejected'].includes(String(data.status)),'操作を確認してください');const id=path.slice('/requests/'.length);const result=await env.DB.prepare("UPDATE passbook_requests SET status=?,resolved_by=?,resolved_at=? WHERE id=? AND household_id=? AND status='pending'").bind(data.status,userId,now,id,household).run();check(result.meta.changes>0,'この申請は処理済みか見つかりません',409);return reply({ok:true});
  }
  return reply({error:'見つかりません'},404);
 } catch(e){const err=e as Error &{status?:number};if(pathErrorSafe(err))return reply({error:err.message},409);const known=/insufficient points|invalid reward|reward unavailable|UNIQUE constraint/.test(err.message);return reply({error:err.status?err.message:known?'ポイント不足・在庫切れ・申請済みのいずれかです':'つうちょうに接続できませんでした'},err.status||(known?409:500));}
}


function pathErrorSafe(e:Error){return /旧データ|銀行|対応先|ポイント|口座|バックアップ|取込|個別確認|登録済みアカウント|通帳へ上書き|記録が多い|旧DB|家族一覧|子どものアカウント/.test(e.message) && !/D1_|SQLITE/.test(e.message)}
