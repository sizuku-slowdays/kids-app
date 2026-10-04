type Context={DB:D1Database;LEGACY_DB?:D1Database;PRIVATE_FILES:R2Bucket};
type Chore={id:string;household_id:string;name:string;icon:string;points:number;money:number;point_unit_id:string;rotation_json:string;next_target:string|null;next_date:string;enabled:number;sort_order:number;revision:number};
function fail(message:string,status=400):never {throw Object.assign(Error(message),{status})}
export const japanDay=()=>new Date(Date.now()+9*3600000).toISOString().slice(0,10);
const sha=async(s:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))).map(v=>v.toString(16).padStart(2,'0')).join('');
export async function advanceChores(env:Context,h:string,actor:string,today=japanDay()){
 // One unique day event advances the cursor. Retry/concurrent cron/GET cannot advance twice.
 const rows=(await env.DB.prepare('SELECT * FROM passbook_chores WHERE household_id=? AND enabled=1 AND next_date<?').bind(h,today).all<Chore>()).results;
 for(const c of rows){let day=c.next_date;let count=0;while(day<today&&count++<400){await env.DB.prepare(`INSERT INTO passbook_chore_days(id,chore_id,household_id,day,kind,target,assigned_to,points,money,memo,occurred_at,created_at,actor,event_id) SELECT ?,id,household_id,next_date,'skip',NULL,next_target,points,money,name,?, ?,?,? FROM passbook_chores WHERE id=? AND enabled=1 AND next_date=? ON CONFLICT(chore_id,day) DO NOTHING`).bind(crypto.randomUUID(),new Date().toISOString(),Math.floor(Date.now()/1000),actor,'skip:'+c.id+':'+day,c.id,day).run();const fresh=await env.DB.prepare('SELECT next_date FROM passbook_chores WHERE id=?').bind(c.id).first<{next_date:string}>();if(!fresh||fresh.next_date<=day)break;day=fresh.next_date;}}
}
export async function choreRoute(request:Request,env:Context,h:string,user:string,admin:boolean,body:(r:Request)=>Promise<Record<string,unknown>>){
 const url=new URL(request.url),path=url.pathname.slice('/api/passbook/chores'.length),method=request.method;
 const operator=Boolean(await env.DB.prepare("SELECT 1 FROM users WHERE id=? AND platform_role='operator'").bind(user).first());
 const people=(await env.DB.prepare(`SELECT c.id,c.display_name FROM children c WHERE c.household_id=? AND c.user_id IS NOT NULL UNION ALL SELECT 'user:'||a.owner_user_id,u.display_name FROM passbook_adult_accounts a JOIN users u ON u.id=a.owner_user_id WHERE a.household_id=? GROUP BY a.owner_user_id`).bind(h,h).all<{id:string;display_name:string}>()).results;
 const owner=await env.DB.prepare("SELECT user_id FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.group_id=? AND m.role IN ('owner','admin') AND u.active=1 ORDER BY CASE m.role WHEN 'owner' THEN 0 ELSE 1 END LIMIT 1").bind(h).first<{user_id:string}>();
 if(!owner)fail('家庭の管理者を確認してください',409);
 await advanceChores(env,h,owner.user_id);
 if(path===''&&method==='GET')return {today:japanDay(),people,imported:Boolean(await env.DB.prepare('SELECT 1 FROM passbook_chore_imports WHERE household_id=?').bind(h).first()),can_import:admin&&operator&&Boolean(await env.DB.prepare('SELECT 1 FROM passbook_imports WHERE household_id=?').bind(h).first()),chores:(await env.DB.prepare('SELECT * FROM passbook_chores WHERE household_id=? AND (?=1 OR enabled=1) ORDER BY sort_order,name').bind(h,admin?1:0).all()).results,done:(await env.DB.prepare("SELECT chore_id,target,day FROM passbook_chore_days WHERE household_id=? AND day=? AND kind='complete'").bind(h,japanDay()).all()).results};
 if(!admin)fail('完了登録と当番の設定は管理者だけが行えます',403);
 if(path==='/import'&&method==='POST'){
  if(!operator)fail('引き継ぎは運営管理者だけが行えます',403);
  if(await env.DB.prepare('SELECT 1 FROM passbook_chore_imports WHERE household_id=?').bind(h).first())return {ok:true,already_imported:true};
  if(!env.LEGACY_DB)fail('旧DBが接続されていません',409);
  if(await env.DB.prepare('SELECT 1 FROM passbook_chores WHERE household_id=?').bind(h).first())fail('登録済みのお手伝いがあるため上書きしません',409);
  const record=await env.DB.prepare('SELECT backup_key,snapshot_hash FROM passbook_imports WHERE household_id=?').bind(h).first<{backup_key:string;snapshot_hash:string}>();if(!record)fail('通帳の引き継ぎを確認してください',409);
  const file=await env.PRIVATE_FILES.get(record.backup_key);if(!file)fail('バックアップが見つかりません',409);
  const original=JSON.parse(await file.text());if(original.household_id!==h||await sha(JSON.stringify(original.snapshot))!==record.snapshot_hash)fail('バックアップの照合に失敗しました',409);
  const mapping=original.mapping.points as Record<string,string>;
  const [chores,states]=await Promise.all([env.LEGACY_DB.prepare('SELECT * FROM chores ORDER BY sort_order,id LIMIT 501').all<any>(),env.LEGACY_DB.prepare('SELECT * FROM chore_state ORDER BY chore_id LIMIT 501').all<any>()]);
  if(chores.results.length>500||states.results.length>500)fail('お手伝いの数を個別確認してください',409);
  const now=Math.floor(Date.now()/1000),today=japanDay(),key=`passbook-chore-backups/${h}/${crypto.randomUUID()}.json`,raw={chores:chores.results,states:states.results};
  const unit=await env.DB.prepare("SELECT id FROM passbook_units WHERE household_id=? AND code='chores' AND kind='points'").bind(h).first<{id:string}>();if(!unit)fail('ポイント種別を確認してください',409);
  const stmts:D1PreparedStatement[]=[];
  for(const c of chores.results){const s=states.results.find(v=>String(v.chore_id)===String(c.id));if(!s)fail('旧当番設定が見つかりません',409);const rotation=String(s.rotation_order)==='none'?[]:String(s.rotation_order).split(',').map(id=>mapping[id.trim()]);if(rotation.some(id=>!people.some(p=>p.id===id))||new Set(rotation).size!==rotation.length)fail('旧当番の対応先を確認してください',409);const next=rotation.length?mapping[String(s.next_assignee)]:null;if(rotation.length&&!rotation.includes(next!))fail('次の当番の対応先を確認してください',409);for(const n of [c.points,c.money])if(!Number.isSafeInteger(Number(n))||Number(n)<0||Number(n)>10000000)fail('旧お手伝いの金額を確認してください',409);stmts.push(env.DB.prepare('INSERT INTO passbook_chores(id,household_id,name,icon,points,money,point_unit_id,rotation_json,next_target,next_date,enabled,sort_order) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').bind(h+':chore:'+c.id,h,String(c.name),String(c.icon||'🧹'),Number(c.points),Number(c.money),unit.id,JSON.stringify(rotation),next,today,c.enabled?1:0,Number(c.sort_order)||0));}
  const backup=JSON.stringify({version:1,household_id:h,created_at:now,mapping,raw});await env.PRIVATE_FILES.put(key,backup);const saved=await env.PRIVATE_FILES.get(key);if(!saved||await saved.text()!==backup)fail('バックアップの保存に失敗しました',409);
  // Configuration only: no historic log is re-credited.
  stmts.unshift(env.DB.prepare('INSERT INTO passbook_chore_imports VALUES (?,?,?,?)').bind(h,key,user,now));await env.DB.batch(stmts);return {ok:true,count:chores.results.length};
 }
 const data=await body(request);
 if(path==='/complete'&&method==='POST'){
  const chore=String(data.chore_id||''),target=String(data.target||''),event=String(data.event_id||''),today=japanDay();if(event.length<8||event.length>100||!people.some(p=>p.id===target))fail('完了した人を選んでください');
  const old=await env.DB.prepare("SELECT chore_id,target FROM passbook_chore_days WHERE household_id=? AND event_id=? AND kind='complete'").bind(h,event).first<{chore_id:string;target:string}>();if(old){if(old.chore_id!==chore||old.target!==target)fail('登録内容が一致しません',409);return {ok:true,already_recorded:true};}
  const c=await env.DB.prepare('SELECT * FROM passbook_chores WHERE id=? AND household_id=? AND enabled=1').bind(chore,h).first<Chore>();if(!c)fail('お手伝いが見つかりません',404);if(c.next_date!==today)fail('今日は登録済みです。履歴を確認してください',409);if(data.revision!==c.revision)fail('お手伝いの設定が更新されています。開き直してください',409);
  const result=await env.DB.prepare(`INSERT INTO passbook_chore_days(id,chore_id,household_id,day,kind,target,assigned_to,points,money,memo,occurred_at,created_at,actor,event_id) SELECT ?,id,household_id,?,'complete',?,next_target,points,money,name,?,?,?,? FROM passbook_chores WHERE id=? AND household_id=? AND next_date=? AND enabled=1 AND revision=?`).bind(crypto.randomUUID(),today,target,new Date().toISOString(),Math.floor(Date.now()/1000),user,event,chore,h,today,c.revision).run();if(!result.meta.changes)fail("今日は登録済みです。履歴を確認してください",409);return {ok:true};
 }
 if((path===''&&method==='POST')||(path.startsWith('/')&&method==='PUT')){
  const id=method==='POST'?crypto.randomUUID():decodeURIComponent(path.slice(1));const rotation=data.rotation;
  if(typeof data.name!=='string'||!data.name.trim()||data.name.length>80||!Array.isArray(rotation)||rotation.length>100||rotation.some(v=>typeof v!=='string'||!people.some(p=>p.id===v))||new Set(rotation).size!==rotation.length)fail('名前・当番を確認してください');
  for(const n of [data.points,data.money])if(!Number.isSafeInteger(n)||Number(n)<0||Number(n)>10000000)fail('数値を確認してください');
  const unit=await env.DB.prepare("SELECT id FROM passbook_units WHERE id=? AND household_id=? AND kind='points' AND active=1").bind(String(data.point_unit_id||''),h).first<{id:string}>();if(!unit)fail('ポイント種別を確認してください');
  const next=rotation.length?String(data.next_target||rotation[0]):null;if(next&&!rotation.includes(next))fail('次の当番を確認してください');
  const icon=typeof data.icon==='string'&&data.icon.length<=20?data.icon:'🧹';
  if(method==='POST')await env.DB.prepare('INSERT INTO passbook_chores(id,household_id,name,icon,points,money,point_unit_id,rotation_json,next_target,next_date) VALUES (?,?,?,?,?,?,?,?,?,?)').bind(id,h,data.name.trim(),icon,data.points,data.money,unit.id,JSON.stringify(rotation),next,japanDay()).run();
  else{if(typeof data.enabled!=='boolean'||!Number.isSafeInteger(data.revision))fail('設定を確認してください');const r=await env.DB.prepare('UPDATE passbook_chores SET name=?,icon=?,points=?,money=?,point_unit_id=?,rotation_json=?,next_target=?,next_date=CASE WHEN enabled=0 THEN MAX(next_date,?) ELSE next_date END,enabled=?,revision=revision+1 WHERE id=? AND household_id=? AND revision=?').bind(data.name.trim(),icon,data.points,data.money,unit.id,JSON.stringify(rotation),next,japanDay(),data.enabled?1:0,id,h,data.revision).run();if(!r.meta.changes)fail('設定が更新されています。開き直してください',409);}
  return {ok:true,id};
 }
 fail('見つかりません',404);
}
