import catalog from '../public/apps/daily-kanji/catalog.json';
import {householdPeople,peopleCheck,peopleReply} from './household-people';
type Profile={user_id:string;household_id:string;base_grade:number;base_school_year:number;auto_advance:number};
type Day={characters_json:string;grade:number;curriculum_version:string};
export function schoolClock(date=new Date()){
 const day=new Date(date.getTime()+9*3600000).toISOString().slice(0,10);
 const year=Number(day.slice(0,4))-(Number(day.slice(5,7))<4?1:0);
 return {day,year};
}
export function currentGrade(p:Profile,year:number){return Math.min(9,Math.max(1,p.base_grade+(p.auto_advance?Math.max(0,year-p.base_school_year):0)));}
export function chooseThree(pool:string[],known:Set<string>,random=()=>crypto.getRandomValues(new Uint32Array(1))[0]/4294967296){
 const shuffle=(values:string[])=>{const a=[...values];for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
 return [...shuffle(pool.filter(c=>!known.has(c))),...shuffle(pool.filter(c=>known.has(c)))].slice(0,3);
}
async function state(env:Env,user:string,clock:ReturnType<typeof schoolClock>,create:boolean){
 const profile=await env.DB.prepare('SELECT * FROM kanji_school_profiles WHERE user_id=?').bind(user).first<Profile>();
 if(!profile)return {profile:null,day:clock.day,school_year:clock.year,today:null,mastery:[],history:[]};
 const grade=currentGrade(profile,clock.year),upper=Math.min(6,Math.max(1,grade-1));
 const pool=catalog.entries.filter(c=>c.grade<=upper).map(c=>c.character);
 const mastery=(await env.DB.prepare('SELECT character,first_learned_day,last_confirmed_day,confirmations FROM kanji_mastery WHERE user_id=? ORDER BY first_learned_day,character').bind(user).all()).results;
 let today=await env.DB.prepare('SELECT * FROM kanji_daily_sets WHERE user_id=? AND study_day=?').bind(user,clock.day).first<Day>();
 if(!today&&create){
  const chosen=chooseThree(pool,new Set(mastery.map(r=>String(r.character))));
  if(chosen.length!==3)throw Error('教材の準備ができませんでした');
  await env.DB.prepare('INSERT OR IGNORE INTO kanji_daily_sets VALUES(?,?,?,?,?,?)').bind(user,clock.day,grade,catalog.version,JSON.stringify(chosen),new Date().toISOString()).run();
  today=await env.DB.prepare('SELECT * FROM kanji_daily_sets WHERE user_id=? AND study_day=?').bind(user,clock.day).first<Day>();
 }
 const confirmed=(await env.DB.prepare("SELECT character FROM kanji_learning_events WHERE user_id=? AND study_day=? AND kind='daily_confirm'").bind(user,clock.day).all()).results.map(r=>r.character);
 const history=(await env.DB.prepare('SELECT study_day,character,kind FROM kanji_learning_events WHERE user_id=? ORDER BY study_day DESC,created_at DESC LIMIT 300').bind(user).all()).results;
 return {profile:{...profile,current_grade:grade},day:clock.day,school_year:clock.year,range_upper:upper,pool_size:pool.length,today:today?{characters:JSON.parse(today.characters_json) as string[],grade:today.grade,confirmed}:null,mastery,history};
}
export async function dailyKanjiRoute(request:Request,env:Env,user:string,readBody:(r:Request)=>Promise<any>){
 try{
 const url=new URL(request.url),path=url.pathname.slice('/api/daily-kanji'.length),clock=schoolClock();
 const groups=(await env.DB.prepare("SELECT g.id,g.name,m.role FROM groups g JOIN memberships m ON m.group_id=g.id JOIN group_apps a ON a.group_id=g.id AND a.app_id='daily-kanji' WHERE m.user_id=? AND g.kind='household' ORDER BY g.created_at,g.id").bind(user).all<{id:string;name:string;role:string}>()).results;
 const group=groups.find(g=>g.id===(url.searchParams.get('household')||groups[0]?.id));peopleCheck(group,'この家庭のアプリは利用できません',403);
 const ctx=await householdPeople(env,user,group.id);
 const children=(await env.DB.prepare('SELECT c.id,c.user_id,c.display_name FROM children c JOIN memberships m ON m.user_id=c.user_id AND m.group_id=c.household_id JOIN users u ON u.id=c.user_id AND u.active=1 WHERE c.household_id=?').bind(group.id).all<{id:string;user_id:string;display_name:string}>()).results;
 const guardian=(ctx.configure||ctx.adult)&&!children.some(c=>c.user_id===user)&&ctx.rows.find(r=>r.id===user)?.age_kind!=='child';
 if(path==='/family'&&request.method==='GET'){
  peopleCheck(guardian,'保護者だけが確認できます',403);
  const rows=[];for(const c of children){const s=await state(env,c.user_id,clock,false);rows.push({...c,profile:s.profile,mastered:s.mastery.length,today:s.today,history:s.history.slice(0,30)});}
  return peopleReply({groups,household_id:group.id,school_year:clock.year,children:rows});
 }
 if(path==='/profile'&&request.method==='PUT'){
  peopleCheck(guardian,'学年設定は保護者が行えます',403);const body=await readBody(request);
  peopleCheck(children.some(c=>c.user_id===body.user_id),'この家庭の子どもを選んでください',403);
  peopleCheck(Number.isInteger(body.grade)&&body.grade>=1&&body.grade<=9&&typeof body.auto_advance==='boolean','学年・自動進級を確認してください');
  await env.DB.prepare('INSERT INTO kanji_school_profiles VALUES(?,?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET household_id=excluded.household_id,base_grade=excluded.base_grade,base_school_year=excluded.base_school_year,auto_advance=excluded.auto_advance,changed_by=excluded.changed_by,updated_at=excluded.updated_at').bind(body.user_id,group.id,body.grade,clock.year,body.auto_advance?1:0,user,new Date().toISOString()).run();
  return peopleReply({ok:true});
 }
 if(!path&&request.method==='GET')return peopleReply({...await state(env,user,clock,!guardian),guardian,groups,household_id:group.id});
 if(path==='/confirm'&&request.method==='POST'){
  peopleCheck(!guardian,'自分の学習画面から操作してください',403);const body=await readBody(request);
  peopleCheck(body.day===clock.day,'日付が変わりました。今日の漢字を読み直してください',409);
  const s=await state(env,user,clock,true);peopleCheck(s.today?.characters.includes(body.character),'今日の3文字から選んでください');
  const now=new Date().toISOString();
  await env.DB.batch([
   env.DB.prepare("INSERT INTO kanji_mastery SELECT ?,?,?,?,1 WHERE NOT EXISTS(SELECT 1 FROM kanji_learning_events WHERE user_id=? AND study_day=? AND character=? AND kind='daily_confirm') ON CONFLICT(user_id,character) DO UPDATE SET last_confirmed_day=excluded.last_confirmed_day,confirmations=kanji_mastery.confirmations+1").bind(user,body.character,clock.day,clock.day,user,clock.day,body.character),
   env.DB.prepare("INSERT OR IGNORE INTO kanji_learning_events VALUES(?,?,?,'daily_confirm',?)").bind(user,clock.day,body.character,now)
  ]);
  return peopleReply({...await state(env,user,clock,false),guardian,groups,household_id:group.id});
 }
 if(path==='/review'&&request.method==='POST'){
  peopleCheck(!guardian,'自分の図鑑から操作してください',403);const body=await readBody(request),s=await state(env,user,clock,false);
  peopleCheck(s.mastery.some(r=>r.character===body.character),'覚えた漢字を選んでください');
  await env.DB.prepare("INSERT OR IGNORE INTO kanji_learning_events VALUES(?,?,?,'review',?)").bind(user,clock.day,body.character,new Date().toISOString()).run();return peopleReply({ok:true});
 }
 return peopleReply({error:'この操作はできません'},405);
 }catch(e){return peopleReply({error:e instanceof Error?e.message:'処理できませんでした'},Number((e as {status?:number}).status)||500);}
}
