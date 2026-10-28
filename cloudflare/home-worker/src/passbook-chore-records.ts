type Context={DB:D1Database};
type Chore={id:string;name:string;points:number;money:number;point_unit_id:string;revision:number};
type RecordRow={id:string;household_id:string;event_id:string;chore_id:string;day:string;targets_json:string;count:number;points:number;money:number;point_unit_id:string;memo:string;revision:number;actor:string;created_at:number;error:string|null};
function fail(message:string,status=400):never{throw Object.assign(Error(message),{status});}
const today=()=>new Date(Date.now()+9*3600000).toISOString().slice(0,10);
export function choreDay(value:unknown){const day=value===undefined||value===null||value===''?today():String(value);if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!Number.isFinite(Date.parse(day+'T00:00:00Z'))||new Date(day+'T00:00:00Z').toISOString().slice(0,10)!==day||day>today())fail('お手伝いした日は、今日以前の正しい日付を選んでください');return day;}
export async function choreRecordList(db:D1Database,h:string,day:string,admin:boolean){
 const done=(await db.prepare(`SELECT chore_id,target,day,1 count,id record_id,memo FROM passbook_chore_days WHERE household_id=? AND day=? AND kind='complete' UNION ALL SELECT r.chore_id,t.value target,r.day,r.count,r.id record_id,r.memo FROM passbook_chore_records r JOIN passbook_chore_record_payments p ON p.record_id=r.id,json_each(r.targets_json) t WHERE r.household_id=? AND r.day=? UNION ALL SELECT a.chore_id,a.target,a.day,1 count,'settled:'||a.event_id record_id,a.memo FROM passbook_chore_attempts a JOIN passbook_chore_attempt_settlements s ON s.household_id=a.household_id AND s.event_id=a.event_id WHERE a.household_id=? AND a.day=?`).bind(h,day,h,day,h,day).all()).results;
 const pending=admin?(await db.prepare('SELECT r.* FROM passbook_chore_records r LEFT JOIN passbook_chore_record_payments p ON p.record_id=r.id WHERE r.household_id=? AND r.day=? AND p.record_id IS NULL ORDER BY r.created_at').bind(h,day).all()).results:[];
 return {day,done,pending,completion_protocol:'repeat-v1'};
}
async function pay(env:Context,h:string,user:string,r:RecordRow){
 if(await env.DB.prepare('SELECT 1 FROM passbook_chore_record_payments WHERE record_id=? AND household_id=?').bind(r.id,h).first())return {ok:true,already_recorded:true,id:r.id};
 try{await env.DB.prepare('INSERT INTO passbook_chore_record_payments(record_id,household_id,actor,created_at) VALUES (?,?,?,?) ON CONFLICT(record_id) DO NOTHING').bind(r.id,h,user,Math.floor(Date.now()/1000)).run();return {ok:true,id:r.id};}
 catch(e){await env.DB.prepare("UPDATE passbook_chore_records SET error='未払いです。通帳と登録内容を確認して再処理してください' WHERE id=? AND household_id=? AND NOT EXISTS(SELECT 1 FROM passbook_chore_record_payments WHERE record_id=?)").bind(r.id,h,r.id).run();throw e;}
}
export async function completeChoreRecord(env:Context,h:string,user:string,data:Record<string,unknown>,people:{id:string}[],retry=false){
 const event=typeof data.event_id==='string'?data.event_id:'';if(event.length<8||event.length>100)fail('登録内容を確認してください');
 let saved=await env.DB.prepare('SELECT * FROM passbook_chore_records WHERE household_id=? AND event_id=?').bind(h,event).first<RecordRow>();
 if(retry){if(!saved)fail('未払いの記録が見つかりません',404);return pay(env,h,user,saved);}
 const chore=String(data.chore_id||''),day=choreDay(data.day),count=Number(data.count??1),raw=data.targets;
 if(!Array.isArray(raw)||raw.length<1||raw.length>100||raw.some(t=>typeof t!=='string'||!people.some(p=>p.id===t))||new Set(raw).size!==raw.length||!Number.isSafeInteger(count)||count<1||count>100)fail('実際にした人と回数（1〜100回）を確認してください');
 const targets=JSON.stringify([...raw].sort());
 const matching=(r:RecordRow)=>r.chore_id===chore&&r.day===day&&r.targets_json===targets&&r.count===count;
 if(saved){if(!matching(saved))fail('同じ登録番号の内容が異なります。元の記録を確認してください',409);return pay(env,h,user,saved);}
 if(await env.DB.prepare('SELECT 1 FROM passbook_chore_days WHERE household_id=? AND event_id=? UNION ALL SELECT 1 FROM passbook_chore_attempts WHERE household_id=? AND event_id=?').bind(h,event,h,event).first())fail('以前の登録番号です。履歴を確認してください',409);
 const c=await env.DB.prepare('SELECT * FROM passbook_chores WHERE id=? AND household_id=? AND enabled=1').bind(chore,h).first<Chore>();if(!c)fail('お手伝いが見つかりません',404);
 const shown=data.reward as Partial<Chore>|undefined;
 if(!shown||shown.name!==c.name||shown.points!==c.points||shown.money!==c.money||shown.point_unit_id!==c.point_unit_id)fail('報酬の設定が変わっています。開き直して確認してください',409);
 if(c.points*count>10000000||c.money*count>10000000)fail('合計が大きすぎます。回数を確認してください');
 const id=h+':chore-record:'+event;
 try{await env.DB.prepare('INSERT INTO passbook_chore_records(id,household_id,event_id,chore_id,day,targets_json,count,points,money,point_unit_id,memo,revision,actor,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(household_id,event_id) DO NOTHING').bind(id,h,event,chore,day,targets,count,c.points,c.money,c.point_unit_id,c.name,c.revision,user,Math.floor(Date.now()/1000)).run();}
 catch(e){saved=await env.DB.prepare('SELECT * FROM passbook_chore_records WHERE household_id=? AND event_id=?').bind(h,event).first<RecordRow>();if(!saved)throw e;}
 saved=saved||await env.DB.prepare('SELECT * FROM passbook_chore_records WHERE household_id=? AND event_id=?').bind(h,event).first<RecordRow>();
 if(!saved||!matching(saved))fail('同じ登録番号の内容が異なります。履歴を確認してください',409);return pay(env,h,user,saved);
}
