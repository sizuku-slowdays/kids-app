import {check,id,jstDay,validDay,chooseDaily,validatePlan,taskPhaseAllowed,summarizeSchoolDays} from './core.mjs';
import {catalog,catalogVersion} from './catalog.mjs';
const reply=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
const all=async(stmt)=>(await stmt.all()).results;
async function context(db,user,household,app) {
 check(user, 'ログインしてください',401);check(id(household),'家庭を選んでください');
 const member=await db.prepare("SELECT m.role,COALESCE(a.age_kind,'unknown') age_kind FROM memberships m JOIN users u ON u.id=m.user_id JOIN groups g ON g.id=m.group_id JOIN group_apps ga ON ga.group_id=g.id LEFT JOIN home_member_attributes a ON a.group_id=m.group_id AND a.user_id=m.user_id WHERE m.group_id=? AND m.user_id=? AND u.active=1 AND g.kind='household' AND ga.app_id=?").bind(household,user,app).first();
 check(member,'この家庭のアプリは利用できません',403);
 const children=await all(db.prepare('SELECT c.id,c.user_id,u.display_name FROM children c JOIN users u ON u.id=c.user_id AND u.active=1 JOIN memberships m ON m.group_id=c.household_id AND m.user_id=c.user_id WHERE c.household_id=?').bind(household));
 const guardian=['owner','admin'].includes(member.role)&&member.age_kind!=='child'&&!children.some(c=>c.user_id===user);
 return {guardian,children};
}
async function read(request){const text=await request.text();check(text.length<=32768,'内容が長すぎます',413);let value;try{value=JSON.parse(text);}catch{check(false,'JSONを確認してください');}check(value&&typeof value==='object'&&!Array.isArray(value),'JSONオブジェクトを確認してください');return value;}
function target(ctx,user,child){const t=ctx.children.find(c=>c.id===child);check(t&&(ctx.guardian||t.user_id===user),'この子どもは利用できません',403);return t;}
async function englishState(db,h,user,day,create){
 const profile=await db.prepare('SELECT level,daily_count FROM learning_english_profiles WHERE household_id=? AND user_id=?').bind(h,user).first();
 if(!profile)return {profile:null,today:null,remembered:[],history:[]};
 const history=await all(db.prepare('SELECT study_day,item_id,kind FROM learning_english_events WHERE household_id=? AND user_id=? ORDER BY study_day DESC,item_id').bind(h,user));
 const remembered=[...new Set(history.filter(e=>e.kind==='remember').map(e=>e.item_id))];
 let today=await db.prepare('SELECT items_json,catalog_version FROM learning_english_days WHERE household_id=? AND user_id=? AND study_day=?').bind(h,user,day).first();
 if(!today&&create){
  const items=chooseDaily(catalog.filter(i=>i.level===profile.level),new Set(remembered),profile.daily_count,()=>crypto.getRandomValues(new Uint32Array(1))[0]/4294967296);
  await db.prepare('INSERT OR IGNORE INTO learning_english_days VALUES(?,?,?,?,?,?)').bind(h,user,day,catalogVersion,JSON.stringify(items),new Date().toISOString()).run();
  today=await db.prepare('SELECT items_json,catalog_version FROM learning_english_days WHERE household_id=? AND user_id=? AND study_day=?').bind(h,user,day).first();
 }
 return {profile,today:today?{day,items:JSON.parse(today.items_json),catalog_version:today.catalog_version,confirmed:history.filter(e=>e.study_day===day&&e.kind==='remember').map(e=>e.item_id)}:null,remembered,history:history.slice(0,300)};
}
// user MUST come from HOME's verified session, never a URL/header supplied by a client.
// Existing HOME appAllowed + origin/CSRF/body guards must run before this route.
export async function learningRoute(request,db,user,now=new Date()) {
 try {
  const url=new URL(request.url),match=url.pathname.match(/^\/api\/(english-flash|school-prep)(\/.*)?$/);
  check(match,'見つかりません',404);const app=match[1],path=match[2]||'',h=url.searchParams.get('household')||'',ctx=await context(db,user,h,app),day=jstDay(now);
  if(path==='/people'&&request.method==='GET')return reply({guardian:ctx.guardian,children:ctx.children.filter(c=>ctx.guardian||c.user_id===user),day});
  const child=url.searchParams.get('child')||ctx.children.find(c=>c.user_id===user)?.id;
  const selected=target(ctx,user,child);
  if(app==='english-flash'){
   if(path==='/profile'&&request.method==='PUT'){
    check(ctx.guardian,'設定は保護者が行います',403);const b=await read(request);
    check(['alphabet','words'].includes(b.level)&&Number.isInteger(b.daily_count)&&b.daily_count>=1&&b.daily_count<=10,'レベル・1日の数を確認してください');
    await db.prepare('INSERT INTO learning_english_profiles VALUES(?,?,?,?,?,?) ON CONFLICT(household_id,user_id) DO UPDATE SET level=excluded.level,daily_count=excluded.daily_count,changed_by=excluded.changed_by,updated_at=excluded.updated_at').bind(h,selected.user_id,b.level,b.daily_count,user,now.toISOString()).run();return reply({ok:true});
   }
   if(!path&&request.method==='GET')return reply(await englishState(db,h,selected.user_id,day,!ctx.guardian));
   if(['/remember','/review'].includes(path)&&request.method==='POST'){
    check(!ctx.guardian&&selected.user_id===user,'自分の学習画面から操作してください',403);const b=await read(request);check(b.day===day,'日付が変わりました',409);
    const s=await englishState(db,h,user,day,true);check(s.profile,'保護者に学習設定をお願いしてください',409);
    check(path==='/remember'?s.today.items.includes(b.item_id):s.remembered.includes(b.item_id),'学習する文字を確認してください');
    await db.prepare('INSERT OR IGNORE INTO learning_english_events VALUES(?,?,?,?,?,?)').bind(h,user,day,b.item_id,path==='/remember'?'remember':'review',now.toISOString()).run();return reply(await englishState(db,h,user,day,false));
   }
  } else {
   const schoolDay=url.searchParams.get('day')||day;check(validDay(schoolDay),'日付を確認してください');
   const latest=()=>db.prepare('SELECT * FROM learning_school_versions WHERE household_id=? AND child_id=? AND school_day=? ORDER BY revision DESC LIMIT 1').bind(h,selected.id,schoolDay).first();
   if(path==='/summary'&&request.method==='GET'){
    const plans=await all(db.prepare('SELECT v.school_day,v.revision,v.tasks_json,v.is_school_day FROM learning_school_versions v WHERE household_id=? AND child_id=? AND school_day<=? AND is_school_day=1 AND revision=(SELECT MAX(n.revision) FROM learning_school_versions n WHERE n.household_id=v.household_id AND n.child_id=v.child_id AND n.school_day=v.school_day) ORDER BY school_day DESC LIMIT 30').bind(h,selected.id,day));
    const rows=plans.length?await db.batch(plans.map(p=>db.prepare('SELECT task_id,phase,done FROM learning_school_checks WHERE household_id=? AND child_id=? AND school_day=? AND revision=?').bind(h,selected.id,p.school_day,p.revision))):[];
    const days=plans.map((p,i)=>{const tasks=JSON.parse(p.tasks_json),checks=rows[i].results;return {is_school_day:true,complete:tasks.length>0&&tasks.every(t=>(t.kind==='homework'?['homework']:['night','morning']).every(phase=>checks.some(c=>c.task_id===t.id&&c.phase===phase&&c.done===1)))};});
    return reply(summarizeSchoolDays(days));
   }
   if(path==='/days'&&request.method==='GET')return reply({days:await all(db.prepare('SELECT school_day,MAX(revision) revision FROM learning_school_versions WHERE household_id=? AND child_id=? GROUP BY school_day ORDER BY school_day DESC LIMIT 120').bind(h,selected.id))});
   if(!path&&request.method==='GET'){
    const plan=await latest();const checks=plan?await all(db.prepare('SELECT task_id,phase,done FROM learning_school_checks WHERE household_id=? AND child_id=? AND school_day=? AND revision=?').bind(h,selected.id,schoolDay,plan.revision)):[];
    return reply({day:schoolDay,plan:plan?{...plan,tasks:JSON.parse(plan.tasks_json),tasks_json:undefined}:null,checks});
   }
   if(path==='/confirm'&&request.method==='POST'){
    check(ctx.guardian,'確定は保護者が行います',403);const b=await read(request),tasks=validatePlan(b);check(b.day===schoolDay,'日付を確認してください');
    // Source association deliberately disabled until old image ownership is resolved.
    check(b.source_file_id===undefined||b.source_file_id===null,'時間割画像の移行確認が必要です',409);
    const result=await db.prepare('INSERT INTO learning_school_versions SELECT ?,?,?,?,?,?,?,NULL,?,? WHERE COALESCE((SELECT MAX(revision) FROM learning_school_versions WHERE household_id=? AND child_id=? AND school_day=?),0)=?').bind(h,selected.id,schoolDay,b.expected_revision+1,b.is_school_day?1:0,b.dismissal,JSON.stringify(tasks),user,now.toISOString(),h,selected.id,schoolDay,b.expected_revision).run();
    check(result.meta.changes===1,'別の端末で更新されました。読み直してください',409);return reply({ok:true,revision:b.expected_revision+1});
   }
   if(path==='/check'&&request.method==='POST'){
    check(!ctx.guardian&&selected.user_id===user,'本人の画面から操作してください',403);const b=await read(request),plan=await latest();
    check(plan&&plan.revision===b.revision,'予定が更新されました。読み直してください',409);
    const task=JSON.parse(plan.tasks_json).find(t=>t.id===b.task_id);check(task&&taskPhaseAllowed(task,b.phase)&&typeof b.done==='boolean'&&id(b.request_id),'項目・操作を確認してください');
    const payload=JSON.stringify({child:selected.id,day:schoolDay,revision:b.revision,task_id:b.task_id,phase:b.phase,done:b.done});
    const old=await db.prepare('SELECT payload_json FROM learning_school_receipts WHERE household_id=? AND actor_id=? AND request_id=?').bind(h,user,b.request_id).first();
    if(old){check(old.payload_json===payload,'操作IDが重複しました',409);return reply({ok:true,replayed:true});}
    // Gate receipt insertion in the same D1 transaction against a newer confirmed version.
    await db.prepare('INSERT OR IGNORE INTO learning_school_receipts SELECT ?,?,?,?,? WHERE (SELECT MAX(revision) FROM learning_school_versions WHERE household_id=? AND child_id=? AND school_day=?)=?').bind(h,user,b.request_id,payload,now.toISOString(),h,selected.id,schoolDay,b.revision).run();
    const saved=await db.prepare('SELECT payload_json FROM learning_school_receipts WHERE household_id=? AND actor_id=? AND request_id=?').bind(h,user,b.request_id).first();
    check(saved,'予定が更新されました。読み直してください',409);check(saved.payload_json===payload,'操作IDが重複しました',409);return reply({ok:true});
   }
   if(['/extract','/notify','/reward'].includes(path))return reply({error:'接続先・条件の確認待ちです。送信・付与は行いません'},503);
  }
  return reply({error:'この操作はできません'},405);
 }catch(e){const status=Number(e.status)||500;return reply({error:status>=500?'準備中の処理でエラーが発生しました':e.message},status);}
}
