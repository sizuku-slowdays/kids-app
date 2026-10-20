import {check,id,validDay,validatePlan} from './school-core.js';
import {mondayOf,weekDays,reconcileTasks} from '../public/apps/school-prep/weekly-core.js';
const rows=async s=>(await s.all()).results;
export async function schoolTemplate(db,h,c){
 const row=await db.prepare("SELECT revision,labels_json FROM learning_school_templates WHERE household_id=? AND child_id=? AND schedule_key='default' ORDER BY revision DESC LIMIT 1").bind(h,c).first();
 return {revision:row?.revision||0,labels:row?JSON.parse(row.labels_json):[]};
}
async function planFor(db,h,c,day){return db.prepare('SELECT * FROM learning_school_versions WHERE household_id=? AND child_id=? AND school_day=? ORDER BY revision DESC LIMIT 1').bind(h,c,day).first();}
export async function schoolWeekRoute({db,h,child,user,admin,url,path,method,request,readBody,reply}){
 if(path==='/template'){
  if(method==='GET')return reply(await schoolTemplate(db,h,child.id));
  check(method==='PUT','この操作はできません',405);check(admin,'テンプレートの設定は保護者が行います',403);
  const b=await readBody(request);check(Number.isInteger(b.expected_revision)&&b.expected_revision>=0,'版を確認してください');
  check(Array.isArray(b.labels)&&b.labels.length<=40,'テンプレートは40項目までです');
  const labels=b.labels.map(s=>{check(typeof s==='string','項目名を確認してください');s=s.trim().replace(/[：:]\s*$/,'').trim();check(s.length>0&&s.length<=60,'項目名は1〜60文字です');return s;});
  const previous=await schoolTemplate(db,h,child.id);check(previous.revision===b.expected_revision,'別の端末で変更されました。読み直してください',409);
  if(JSON.stringify(labels)===JSON.stringify(previous.labels))return reply({...previous,ok:true,unchanged:true});
  await db.prepare("INSERT INTO learning_school_templates VALUES(?,?,'default',?,?,?,?)").bind(h,child.id,previous.revision+1,JSON.stringify(labels),user,new Date().toISOString()).run();
  return reply({ok:true,revision:previous.revision+1,labels});
 }
 if(path!=='/week')return null;
 if(method==='GET'){
  const week=url.searchParams.get('week');check(validDay(week)&&mondayOf(week)===week,'対象週の月曜日を指定してください');
  const days=[];for(const day of weekDays(week)){
   const plan=await planFor(db,h,child.id,day);
   const checks=plan?await rows(db.prepare('SELECT task_id,phase,done FROM learning_school_checks WHERE household_id=? AND child_id=? AND school_day=? AND revision=?').bind(h,child.id,day,plan.revision)):[];
   days.push({day,revision:plan?.revision||0,is_school_day:plan?!!plan.is_school_day:true,dismissal:plan?.dismissal||null,tasks:plan?JSON.parse(plan.tasks_json):[],checks});
  }
  return reply({week,days,template:await schoolTemplate(db,h,child.id)});
 }
 check(method==='POST','この操作はできません',405);check(admin,'週まとめ登録は保護者が行います',403);
 const b=await readBody(request);check(validDay(b.week)&&mondayOf(b.week)===b.week&&id(b.request_id),'対象週・操作IDを確認してください');
 check(Array.isArray(b.days)&&b.days.length===5,'月曜〜金曜の5日分を確認してください');
 const dates=weekDays(b.week);
 const input={week:b.week,days:b.days.map((d,i)=>{
  check(d.day===dates[i]&&['skip','append','replace'].includes(d.action),'日付・保存方法を確認してください');
  check(Number.isInteger(d.expected_revision)&&d.expected_revision>=0,'版を確認してください');
  check(typeof d.is_school_day==='boolean'&&(d.dismissal===null||typeof d.dismissal==='string'),'登校日・下校時刻を確認してください');
  check(Array.isArray(d.homework)&&d.homework.length<=80,'宿題は1日80件までです');
  const homework=d.homework.map(s=>{check(typeof s==='string'&&s.trim().length>0&&s.trim().length<=200,'宿題は1項目1〜200文字です');return s.trim();});
  return {day:d.day,action:d.action,expected_revision:d.expected_revision,is_school_day:d.is_school_day,dismissal:d.dismissal,homework};
 })};
 const lookup=()=>db.prepare('SELECT actor_id,payload_json FROM learning_school_imports WHERE household_id=? AND child_id=? AND request_id=?').bind(h,child.id,b.request_id).first();
 const replay=old=>{const saved=JSON.parse(old.payload_json);check(old.actor_id===user&&JSON.stringify(saved.input)===JSON.stringify(input),'操作IDが別の内容に使われています',409);return reply({ok:true,replayed:true,saved_days:saved.days.length});};
 const old=await lookup();if(old)return replay(old);
 const days=[];
 for(const d of input.days){
  if(d.action==='skip')continue;
  const previous=await planFor(db,h,child.id,d.day);check((previous?.revision||0)===d.expected_revision,'別の端末で更新されました。週を読み直してください',409);
  const prior=previous?JSON.parse(previous.tasks_json):[],tasks=reconcileTasks(prior,d.homework,d.action,()=>crypto.randomUUID());
  const is_school_day=d.action==='append'&&previous?!!previous.is_school_day:d.is_school_day;
  const dismissal=d.action==='append'&&previous?previous.dismissal:d.dismissal;
  const next={day:d.day,expected_revision:d.expected_revision,is_school_day,dismissal,tasks};validatePlan(next);
  if(previous&&JSON.stringify(tasks)===JSON.stringify(prior)&&is_school_day===!!previous.is_school_day&&dismissal===previous.dismissal)continue;
  days.push(next);
 }
 const payload=JSON.stringify({input,days});
 // One INSERT fires all five days + unchanged checks in one D1 transaction.
 await db.prepare('INSERT OR IGNORE INTO learning_school_imports VALUES(?,?,?,?,?,?,?)').bind(h,child.id,b.request_id,user,b.week,payload,new Date().toISOString()).run();
 return replay(await lookup());
}
