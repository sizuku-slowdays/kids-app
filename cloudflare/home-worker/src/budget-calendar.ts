import {budgetSummary} from './budget-core.js';

type CalendarEnv = Env & { BUDGET_CALENDAR_ENABLED?: string; NOTIFICATION_SERVICE?: Fetcher };
export const BUDGET_CALENDAR_ID = '__budget_private__';
const privateJSON = (value: unknown, status=200) => Response.json(value,{status,headers:{'Cache-Control':'private, no-store'}});
async function digest(value: string) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(x=>x.toString(16).padStart(2,'0')).join('');
}
export async function budgetSource(owner: string, key: string) { return 'bg'+(await digest(JSON.stringify([owner,key]))).slice(0,32); }
async function permitted(env: CalendarEnv, owner: string, notification=false) {
  if(env.BUDGET_CALENDAR_ENABLED!=='1') return false;
  const app=await env.DB.prepare("SELECT 1 FROM users u JOIN personal_app_access p ON p.user_id=u.id JOIN apps a ON a.id=p.app_id WHERE u.id=? AND u.active=1 AND p.app_id='household-budget' AND a.enabled=1 AND a.access_mode='personal'").bind(owner).first();
  if(!app) return false;
  for(const id of notification?['calendar','notification']:['calendar']) {
    if(!await env.DB.prepare("SELECT 1 FROM apps a WHERE a.id=? AND a.enabled=1 AND ((a.access_mode='personal' AND EXISTS(SELECT 1 FROM personal_app_access p WHERE p.user_id=? AND p.app_id=a.id)) OR (a.access_mode='group' AND EXISTS(SELECT 1 FROM group_apps g JOIN memberships m ON m.group_id=g.group_id WHERE m.user_id=? AND g.app_id=a.id)))").bind(id,owner,owner).first()) return false;
  }
  return true;
}
export function budgetCalendarItems(state: any) {
  const summary=budgetSummary(state,'2100-12-31');
  const cash=(state.cashPlans||[]).map((p:any)=>({key:'cash:'+p.id,kind:'cash',id:p.id,name:p.name,date:p.actualDate&&p.status==='confirmed'?p.actualDate:p.date,amount:p.amount,status:p.status,version:p.version,account:p.to,description:p.kind==='income'?'入金予定':'口座間の資金移動予定'}));
  const fixed=state.plans.filter((p:any)=>!state.cards.some((c:any)=>c.id===p.payment)).map((p:any)=>({key:'plan:'+p.id,kind:'plan',id:p.id,name:p.name,date:p.dueDate,amount:p.amount,status:p.status,version:p.version,account:p.payment,description:'固定費の引落予定'}));
  const bills=state.bills.map((b:any)=>{const c=summary.cards.find((c:any)=>c.id===b.cardId),sb=c.bills.find((x:any)=>x.id===b.id);return {key:'bill:'+b.id,kind:'bill',id:b.id,name:c.name+' 引落',date:b.dueDate,amount:b.actual??Math.max(0,sb.projected),status:b.status,version:b.version,account:c.accountId,description:'カード代金の引落予定（支出は利用時に計上）'};});
  return [...cash,...fixed,...bills].filter(p=>p.status!=='cancelled').map(p=>({...p,accountName:state.accounts.find((a:any)=>a.id===p.account)?.name||'',notice:state.calendarNotice||{enabled:false,time:'09:00',daysBefore:1}}));
}
export async function privateBudgetCalendar(env:CalendarEnv,owner:string,path:string,params:URLSearchParams) {
  if(!await permitted(env,owner)) return [];
  const row=await env.DB.prepare('SELECT data_json FROM budget_states WHERE owner_id=?').bind(owner).first<{data_json:string}>();
  if(!row) return [];
  if(path==='/calendars') return [{id:BUDGET_CALENDAR_ID,name:'家計の予定（自分だけ）',color:'#b86b16',is_shared:0,can_manage:false,can_post:false,participants:[],visibility:{mode:'self',members:[],editors:[]},budget_managed:true}];
  const selected=params.get('calendar_id');if(selected&&selected!==BUDGET_CALENDAR_ID)return [];
  const list=[];
  for(const p of budgetCalendarItems(JSON.parse(row.data_json))){
    if(params.get('from')&&p.date<params.get('from')!||params.get('to')&&p.date>params.get('to')!)continue;
    const source=await budgetSource(owner,p.key);
    list.push({id:source,calendar_id:BUDGET_CALENDAR_ID,title:(p.status==='confirmed'?'✓ ':'')+p.name,description:p.description+'\n'+p.amount.toLocaleString('ja-JP')+'円・'+p.accountName+'\n'+(p.status==='confirmed'?'確定済み':'予定だけでは残高は変わりません'),start_datetime:p.date+'T00:00:00',end_datetime:p.date+'T00:00:00',all_day:1,color:'#b86b16',editable:false,budget_managed:true,budget_url:'/wagaya/apps/household-budget/?source='+source,visibility:{audience:'self'},recurrence_type:'none'});
  }
  return list;
}

// Outbox rows are written inside the SAME state/audit batch. A failed CAS cannot
// enqueue a projection, and a retry of the same operation cannot duplicate it.
export async function budgetCalendarStatements(env:CalendarEnv,owner:string,data:any,revision:number,eventId:string) {
  if(env.BUDGET_CALENDAR_ENABLED!=='1')return [];
  const old=(await env.DB.prepare('SELECT source_id,event_key,payload_json FROM budget_calendar_outbox WHERE owner_id=?').bind(owner).all<{source_id:string;event_key:string;payload_json:string|null}>()).results;
  const desired=new Map<string,{key:string;payload:string|null}>();
  for(const p of budgetCalendarItems(data))desired.set(await budgetSource(owner,p.key),{key:p.key,payload:JSON.stringify(p)});
  for(const row of old)if(!desired.has(row.source_id))desired.set(row.source_id,{key:row.event_key,payload:null});
  const statements=[];
  for(const [source,item] of desired){
    if(old.some(x=>x.source_id===source&&x.payload_json===item.payload))continue;
    statements.push(env.DB.prepare('INSERT INTO budget_calendar_outbox(source_id,owner_id,event_key,version,payload_json,job_token,synced_version) SELECT ?,?,?,?,?,?,0 WHERE EXISTS(SELECT 1 FROM budget_states WHERE owner_id=? AND revision=? AND last_op=?) ON CONFLICT(source_id) DO UPDATE SET version=excluded.version,payload_json=excluded.payload_json,job_token=excluded.job_token WHERE excluded.version>budget_calendar_outbox.version').bind(source,owner,item.key,revision,item.payload,crypto.randomUUID(),owner,revision,eventId));
  }
  return statements;
}
export async function budgetCalendarItem(env:CalendarEnv,owner:string,source:string) {
  if(!await permitted(env,owner))return privateJSON({error:'本人の家計カレンダーを確認してください'},403);
  const row=await env.DB.prepare('SELECT data_json FROM budget_states WHERE owner_id=?').bind(owner).first<{data_json:string}>();
  for(const p of row?budgetCalendarItems(JSON.parse(row.data_json)):[])if(await budgetSource(owner,p.key)===source)return privateJSON(p);
  return privateJSON({error:'この家計予定は見つかりません。本人の家計簿で確認してください'},404);
}
export async function budgetNotificationCheck(env:CalendarEnv,owner:string,params:URLSearchParams) {
  if(!await permitted(env,owner,true))return privateJSON({allowed:false});
  const row=await env.DB.prepare('SELECT payload_json,version FROM budget_calendar_outbox WHERE source_id=? AND owner_id=?').bind(params.get('event'),owner).first<{payload_json:string|null;version:number}>();
  if(!row?.payload_json||String(row.version)!==params.get('version'))return privateJSON({allowed:false});
  const p=JSON.parse(row.payload_json);
  if(p.status!=='planned'||!p.notice.enabled||p.amount<=0)return privateJSON({allowed:false});
  return privateJSON({allowed:true,title:'家計の予定を確認してください',url:'/wagaya/apps/household-budget/?source='+params.get('event')});
}
// Only the notification service can redeem an unguessable, current job token.
// No owner ID or financial payload supplied by the caller is trusted.
export async function budgetCalendarJob(request:Request,env:CalendarEnv) {
  if(new URL(request.url).hostname!=='notification-auth.internal'||request.method!=='GET')return privateJSON({error:'見つかりません'},404);
  if(env.BUDGET_CALENDAR_ENABLED!=='1')return privateJSON({error:'連携は停止中です'},503);
  const params=new URL(request.url).searchParams;
  const row=await env.DB.prepare('SELECT * FROM budget_calendar_outbox WHERE job_token=?').bind(params.get('job')||'').first<any>();
  if(!row)return privateJSON({error:'予約が更新されています'},404);
  const enabled=await permitted(env,row.owner_id,true),p=row.payload_json?JSON.parse(row.payload_json):null;
  let occurrences:any[]=[];
  if(enabled&&p?.status==='planned'&&p.notice.enabled&&p.amount>0){const d=new Date(p.date+'T00:00:00Z');d.setUTCDate(d.getUTCDate()-p.notice.daysBefore);occurrences=[{date:d.toISOString().slice(0,10),time:p.notice.time}];}
  // Only generic metadata goes to notification storage. Financial details stay HOME private.
  return privateJSON({source_id:row.source_id,version:row.version,recipient:'home:'+row.owner_id,occurrences});
}
export async function deliverBudgetCalendar(env:CalendarEnv) {
  if(env.BUDGET_CALENDAR_ENABLED!=='1'||!env.NOTIFICATION_SERVICE)return;
  const rows=(await env.DB.prepare('SELECT source_id,version,job_token FROM budget_calendar_outbox WHERE synced_version<version ORDER BY version LIMIT 100').all<{source_id:string;version:number;job_token:string}>()).results;
  for(const row of rows){
    try{
      const r=await env.NOTIFICATION_SERVICE.fetch(new Request('https://notification.internal/internal/budget-calendar/sync',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({job:row.job_token})}));
      if(r.ok){const result=await r.json() as {protocol?:string;version?:number};if(result.protocol==='budget-calendar-v1'&&result.version===row.version)await env.DB.prepare('UPDATE budget_calendar_outbox SET synced_version=? WHERE source_id=? AND version=? AND job_token=?').bind(row.version,row.source_id,row.version,row.job_token).run();}
    }catch{/* Durable retry on the next request/cron. Never repeat the financial command. */}
  }
}

export async function budgetCalendarStatus(env:CalendarEnv,owner:string){
 if(env.BUDGET_CALENDAR_ENABLED!=='1')return {enabled:false,pending:0};
 const row=await env.DB.prepare('SELECT COUNT(*) n FROM budget_calendar_outbox WHERE owner_id=? AND synced_version<version').bind(owner).first<{n:number}>();
 return {enabled:true,pending:row?.n||0};
}
