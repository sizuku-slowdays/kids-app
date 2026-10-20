import {schoolTemplate,schoolWeekRoute} from './school-weekly.js';
import {check,id,jstDay,validDay,validatePlan,taskPhaseAllowed,nextSchoolDay} from './school-core.js';
const reply=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
const rows=async statement=>(await statement.all()).results;
const latest=(db,h,c,d)=>db.prepare('SELECT * FROM learning_school_versions WHERE household_id=? AND child_id=? AND school_day=? ORDER BY revision DESC LIMIT 1').bind(h,c,d).first();
const checksFor=(db,h,c,d,r)=>rows(db.prepare('SELECT task_id,phase,done FROM learning_school_checks WHERE household_id=? AND child_id=? AND school_day=? AND revision=?').bind(h,c,d,r));
async function nextDay(db,h,c,today){
 const overrides=await rows(db.prepare('SELECT school_day,is_school_day FROM learning_school_versions v WHERE household_id=? AND child_id=? AND school_day>? AND revision=(SELECT MAX(revision) FROM learning_school_versions n WHERE n.household_id=v.household_id AND n.child_id=v.child_id AND n.school_day=v.school_day)').bind(h,c,today));
 return nextSchoolDay(today,overrides);
}
async function guardian(db,h,user){
 return !!await db.prepare("SELECT 1 FROM memberships m JOIN users u ON u.id=m.user_id JOIN group_apps ga ON ga.group_id=m.group_id AND ga.app_id='school-prep' JOIN apps app ON app.id=ga.app_id AND app.enabled=1 LEFT JOIN home_member_attributes a ON a.group_id=m.group_id AND a.user_id=m.user_id WHERE m.group_id=? AND m.user_id=? AND m.role IN ('owner','admin') AND u.active=1 AND COALESCE(a.age_kind,'unknown')!='child' AND NOT EXISTS(SELECT 1 FROM children c WHERE c.household_id=m.group_id AND c.user_id=m.user_id)").bind(h,user).first();
}
async function phaseComplete(db,event){
 const plan=await latest(db,event.household_id,event.child_id,event.school_day);
 if(!plan||plan.revision!==event.revision||!plan.is_school_day)return false;
 const tasks=JSON.parse(plan.tasks_json).filter(t=>taskPhaseAllowed(t,event.phase));
 const checked=await checksFor(db,event.household_id,event.child_id,event.school_day,plan.revision);
 return tasks.length>0&&tasks.every(t=>checked.some(c=>c.task_id===t.id&&c.phase===event.phase&&c.done===1));
}
export async function schoolNotificationCheck(request,env){
 const url=new URL(request.url);
 if(url.hostname!=='notification-auth.internal'||request.method!=='GET')return reply({allowed:false},404);
 const event=await env.DB.prepare('SELECT * FROM learning_school_deliveries WHERE id=?').bind(url.searchParams.get('delivery')||'').first();
 if(!event||!['pending','sending'].includes(event.status)||Date.now()-Date.parse(event.created_at)>86400000)return reply({allowed:false});
 if(!await env.DB.prepare('SELECT 1 FROM children c JOIN users u ON u.id=c.user_id AND u.active=1 JOIN memberships m ON m.user_id=c.user_id AND m.group_id=c.household_id WHERE c.id=? AND c.household_id=?').bind(event.child_id,event.household_id).first())return reply({allowed:false});
 if(!await guardian(env.DB,event.household_id,event.recipient_id))return reply({allowed:false});
 const active=await env.DB.prepare('SELECT 1 FROM learning_school_preferences WHERE household_id=? AND user_id=? AND notify_enabled=1').bind(event.household_id,event.recipient_id).first();
 if(!await env.DB.prepare("SELECT 1 FROM apps a JOIN group_apps ga ON ga.app_id=a.id JOIN memberships m ON m.group_id=ga.group_id WHERE a.id='notification' AND a.enabled=1 AND m.user_id=? LIMIT 1").bind(event.recipient_id).first())return reply({allowed:false});
 if(!active||!await phaseComplete(env.DB,event))return reply({allowed:false});
 const user=url.searchParams.get('user'),session=url.searchParams.get('session');
 if(user||session){
  if(user!==event.recipient_id)return reply({allowed:false});
  const activeSession=await env.DB.prepare('SELECT 1 FROM sessions WHERE id=? AND user_id=? AND revoked_at IS NULL AND expires_at>?').bind(session||'',user,Math.floor(Date.now()/1000)).first();
  if(!activeSession)return reply({allowed:false});
 }
 const target=new URL('https://cetus.fun/wagaya/apps/school-prep/');
 for(const [key,value] of Object.entries({household:event.household_id,child:event.child_id,day:event.school_day,phase:event.phase}))target.searchParams.set(key,value);
 return reply({allowed:true,recipient_id:event.recipient_id,title:'🎒 学校じゅんび',body:({homework:'宿題がぜんぶ終わりました',night:'夜の用意がぜんぶできました',morning:'朝の持ち物をぜんぶ確認しました'})[event.phase],url:target.pathname+target.search,tag:'school-'+event.id});
}
async function enqueue(db,h,child,day,revision,phase){
 const event={household_id:h,child_id:child,school_day:day,revision,phase};
 if(!await phaseComplete(db,event))return;
 const prefs=await rows(db.prepare('SELECT user_id FROM learning_school_preferences WHERE household_id=? AND notify_enabled=1').bind(h));
 for(const pref of prefs)if(await guardian(db,h,pref.user_id))await db.prepare('INSERT OR IGNORE INTO learning_school_deliveries(id,household_id,child_id,school_day,revision,phase,recipient_id,created_at) VALUES(?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),h,child,day,revision,phase,pref.user_id,new Date().toISOString()).run();
}
async function deliver(env,h,child,recipient){
 if(!env.NOTIFICATION_SERVICE)return;
 const pending=await rows(env.DB.prepare("SELECT id FROM learning_school_deliveries WHERE household_id=? AND child_id=? AND (? IS NULL OR recipient_id=?) AND status IN ('pending','sending') AND lease_until<? AND created_at>? ORDER BY created_at LIMIT 10").bind(h,child,recipient||null,recipient||null,Math.floor(Date.now()/1000),new Date(Date.now()-86400000).toISOString()));
 for(const event of pending){
  const now=Math.floor(Date.now()/1000),claim=await env.DB.prepare("UPDATE learning_school_deliveries SET status='sending',lease_until=?,attempts=attempts+1 WHERE id=? AND status IN ('pending','sending') AND lease_until<? RETURNING id").bind(now+90,event.id,now).first();
  if(!claim)continue;
  let reason='connection',status='pending';
  try{
   const r=await env.NOTIFICATION_SERVICE.fetch(new Request('https://notification.internal/internal/school-prep/send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({delivery_id:event.id})}));
   const result=await r.json();
   if(r.ok&&result.ok&&result.protocol==='school-v1'){status=result.cancelled?'cancelled':result.delivered>0?'sent':'pending';reason=result.delivered>0?'delivered':result.cancelled?'permission_changed':'no_registered_device';}
   else reason=r.status===404||r.status===401?'notification_worker_update_required':'upstream';
  }catch{}
  await env.DB.prepare('UPDATE learning_school_deliveries SET status=?,last_reason=?,lease_until=0,delivered_at=? WHERE id=?').bind(status,reason,status==='sent'?new Date().toISOString():null,event.id).run();
 }
}
export async function schoolRoute(request,env,user,readBody){
 try{
  const db=env.DB,url=new URL(request.url),path=url.pathname.slice('/api/school-prep'.length),method=request.method,today=jstDay();
  check(!url.searchParams.has('owner')&&!url.searchParams.has('user_id'),'利用者はHOMEから確認します');
  const groups=await rows(db.prepare("SELECT g.id,g.name FROM groups g JOIN memberships m ON m.group_id=g.id JOIN group_apps ga ON ga.group_id=g.id AND ga.app_id='school-prep' WHERE m.user_id=? AND g.kind='household' ORDER BY g.created_at,g.id").bind(user));
  const h=url.searchParams.get('household')||groups[0]?.id;check(groups.some(g=>g.id===h),'この家庭にはアクセスできません',403);
  const admin=await guardian(db,h,user);
  const children=await rows(db.prepare('SELECT c.id,c.user_id,u.display_name FROM children c JOIN users u ON u.id=c.user_id AND u.active=1 JOIN memberships m ON m.group_id=c.household_id AND m.user_id=c.user_id WHERE c.household_id=? AND (?=1 OR c.user_id=?) ORDER BY c.rowid').bind(h,admin?1:0,user));
  check(admin||children.length,'子どものHOMEアカウントで開いてください',403);
  const childId=url.searchParams.get('child')||children[0]?.id,child=children.find(c=>c.id===childId);
  check(childId?child:admin,'この子どもは選べません',403);
  const day=url.searchParams.get('day')||today;check(validDay(day),'日付を確認してください');
  if(path==='/preferences'&&method==='PUT'){
   check(admin,'設定は保護者が行います',403);const b=await readBody(request);check(typeof b.notify_enabled==='boolean','通知設定を確認してください');
   await db.prepare('INSERT INTO learning_school_preferences VALUES(?,?,?,?) ON CONFLICT(household_id,user_id) DO UPDATE SET notify_enabled=excluded.notify_enabled,updated_at=excluded.updated_at').bind(h,user,b.notify_enabled?1:0,new Date().toISOString()).run();return reply({ok:true});
  }
  if(!child)return reply({admin,groups,household_id:h,children:[],selected:null,today,day,plan:null,checks:[],days:[],summary:{school_days:0,completed:0,window_size:30}});
  if(path==='/template'||path==='/week')return await schoolWeekRoute({db,h,child,user,admin,url,path,method,request,readBody,reply});
  if(path==='/confirm'&&method==='POST'){
   check(admin,'確定は保護者が行います',403);const b=await readBody(request);check(!('user_id' in b)&&!('owner' in b),'利用者はHOMEから確認します');const tasks=validatePlan(b);check(b.day===day,'日付を確認してください');
   check(b.source_file_id===undefined||b.source_file_id===null,'画像の読み取りはまだ利用できません');
   const result=await db.prepare('INSERT INTO learning_school_versions SELECT ?,?,?,?,?,?,?,NULL,?,? WHERE COALESCE((SELECT MAX(revision) FROM learning_school_versions WHERE household_id=? AND child_id=? AND school_day=?),0)=?').bind(h,child.id,day,b.expected_revision+1,b.is_school_day?1:0,b.dismissal,JSON.stringify(tasks),user,new Date().toISOString(),h,child.id,day,b.expected_revision).run();
   check(result.meta.changes===1,'別の端末で更新されました。読み直してください',409);return reply({ok:true,revision:b.expected_revision+1});
  }
  if(path==='/check'&&method==='POST'){
   check(!admin&&child.user_id===user,'本人の画面から操作してください',403);const b=await readBody(request),plan=await latest(db,h,child.id,day);
   check(plan&&plan.is_school_day&&plan.revision===b.revision,'予定が更新されました。読み直してください',409);
   const task=JSON.parse(plan.tasks_json).find(t=>t.id===b.task_id);check(task&&taskPhaseAllowed(task,b.phase)&&typeof b.done==='boolean'&&id(b.request_id),'項目・操作を確認してください');
   const next=await nextDay(db,h,child.id,today);
   check(b.phase==='night'?day===next:day===today,'今日の宿題・朝の持ち物、次の登校日の夜じゅんびだけ確認できます',409);
   const payload=JSON.stringify({child:child.id,day,revision:b.revision,task_id:b.task_id,phase:b.phase,done:b.done});
   const old=await db.prepare('SELECT payload_json FROM learning_school_receipts WHERE household_id=? AND actor_id=? AND request_id=?').bind(h,user,b.request_id).first();
   if(old){check(old.payload_json===payload,'操作IDが重複しました',409);await enqueue(db,h,child.id,day,b.revision,b.phase);await deliver(env,h,child.id);return reply({ok:true,replayed:true});}
   await db.prepare('INSERT OR IGNORE INTO learning_school_receipts SELECT ?,?,?,?,? WHERE (SELECT MAX(revision) FROM learning_school_versions WHERE household_id=? AND child_id=? AND school_day=?)=?').bind(h,user,b.request_id,payload,new Date().toISOString(),h,child.id,day,b.revision).run();
   const saved=await db.prepare('SELECT payload_json FROM learning_school_receipts WHERE household_id=? AND actor_id=? AND request_id=?').bind(h,user,b.request_id).first();
   check(saved?.payload_json===payload,'予定が更新されました。読み直してください',409);
   // Completion is durable before dispatch. Replays cannot reapply an old check.
   await enqueue(db,h,child.id,day,b.revision,b.phase);await deliver(env,h,child.id);
   return reply({ok:true});
  }
  if(path==='/notifications/retry'&&method==='POST'){check(admin,'保護者の操作です',403);await deliver(env,h,child.id,user);return reply({ok:true});}
  if(path===''&&method==='GET'){
   const plan=await latest(db,h,child.id,day),checks=plan?await checksFor(db,h,child.id,day,plan.revision):[];
   const days=await rows(db.prepare('SELECT school_day,revision,is_school_day FROM learning_school_versions v WHERE household_id=? AND child_id=? AND revision=(SELECT MAX(n.revision) FROM learning_school_versions n WHERE n.household_id=v.household_id AND n.child_id=v.child_id AND n.school_day=v.school_day) ORDER BY school_day DESC LIMIT 120').bind(h,child.id));
   const past=days.filter(d=>d.is_school_day&&d.school_day<=today).slice(0,30);let complete=0;
   const plans=past.length?await db.batch(past.map(d=>db.prepare('SELECT tasks_json FROM learning_school_versions WHERE household_id=? AND child_id=? AND school_day=? AND revision=?').bind(h,child.id,d.school_day,d.revision))):[];
   const pastChecks=past.length?await rows(db.prepare('SELECT school_day,revision,task_id,phase,done FROM learning_school_checks WHERE household_id=? AND child_id=? AND school_day>=? AND school_day<=?').bind(h,child.id,past.at(-1).school_day,today)):[];
   for(let i=0;i<past.length;i++){
    const tasks=JSON.parse(plans[i].results[0].tasks_json),d=past[i];
    if(tasks.length&&tasks.every(t=>(t.kind==='homework'?['homework']:['night','morning']).every(phase=>pastChecks.some(c=>c.school_day===d.school_day&&c.revision===d.revision&&c.task_id===t.id&&c.phase===phase&&c.done===1))))complete++;
   }
   const pref=admin?await db.prepare('SELECT notify_enabled FROM learning_school_preferences WHERE household_id=? AND user_id=?').bind(h,user).first():null;
   const notifications=admin?await rows(db.prepare('SELECT school_day,phase,status,last_reason FROM learning_school_deliveries WHERE household_id=? AND child_id=? AND recipient_id=? ORDER BY created_at DESC LIMIT 10').bind(h,child.id,user)):[];
   return reply({admin,groups,household_id:h,children,selected:child.id,today,next_school_day:await nextDay(db,h,child.id,today),day,plan:plan?{...plan,tasks:JSON.parse(plan.tasks_json),tasks_json:undefined}:null,checks,days,summary:{school_days:past.length,completed:complete,window_size:30},notify_enabled:!!pref?.notify_enabled,notifications,template:await schoolTemplate(db,h,child.id)});
  }
  return reply({error:'この操作はできません'},405);
 }catch(e){const message=String(e);const status=Number(e.status)||(/school (?:template|import) conflict/.test(message)?409:/school (?:template|import) denied/.test(message)?403:500); if(status>=500)console.error({event:'school_request_failed',reason:/no such table/i.test(String(e))?'missing_table':'unexpected'});return reply({error:status>=500?'保存できませんでした。もう一度お試しください':status===409?'別の端末で更新されました。読み直して確認してください':status===403?'この操作は許可されていません':e.message},status);}
}
