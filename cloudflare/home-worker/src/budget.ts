import {newBudget,applyBudgetCommand,budgetSummary,importPreview,legacyExport,BudgetError,type BudgetState} from './budget-core.js';
type BudgetEnv=Env & {BUDGET_SCHEDULES_ENABLED?:string};
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
const today=()=>new Date(Date.now()+9*3600000).toISOString().slice(0,10);
async function hash(value:string){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(n=>n.toString(16).padStart(2,'0')).join('');}
async function state(env:BudgetEnv,owner:string){const row=await env.DB.prepare('SELECT * FROM budget_states WHERE owner_id=?').bind(owner).first<{revision:number;data_json:string}>();return {revision:row?.revision||0,data:row?JSON.parse(row.data_json):newBudget()};}
async function execute(env:BudgetEnv,owner:string,eventId:string,command:{type:string;data?:unknown},asOf:string){
 if(!/^[\w:.-]{8,120}$/.test(eventId))throw new BudgetError('操作番号を確認してください');
 const requestHash=await hash(JSON.stringify(command));const prior=await env.DB.prepare('SELECT request_hash,after_revision FROM budget_operations WHERE owner_id=? AND event_id=?').bind(owner,eventId).first<{request_hash:string;after_revision:number}>();
 if(prior){if(prior.request_hash!==requestHash)throw new BudgetError('同じ操作番号で内容が変わっています',409);return {revision:prior.after_revision,already_applied:true};}
 const current=await state(env,owner);const raced=await env.DB.prepare('SELECT request_hash,after_revision FROM budget_operations WHERE owner_id=? AND event_id=?').bind(owner,eventId).first<{request_hash:string;after_revision:number}>();if(raced){if(raced.request_hash!==requestHash)throw new BudgetError('同じ操作番号で内容が変わっています',409);return {revision:raced.after_revision,already_applied:true};}const input=command.data as Record<string,any>|undefined;
 if(input?.expectedRevision!==undefined&&input.expectedRevision!==current.revision)throw new BudgetError('ほかの画面で更新されています。入力を控えて再読み込みしてください',409);
 const data=applyBudgetCommand(current.data,command,{today:asOf,eventId,importHash:command.type==='import'?await hash(JSON.stringify(input?.snapshot)):undefined}),after=JSON.stringify(data),before=JSON.stringify(current.data),stamp=new Date().toISOString();if(new TextEncoder().encode(after).byteLength>1800000)throw new BudgetError('データ量が大きいため取り込みを停止しました。原本を保持したまま分割移行の確認が必要です');const beforeHash=await hash(before),afterHash=await hash(after);
 await env.DB.batch([
  env.DB.prepare('INSERT OR IGNORE INTO budget_states(owner_id,revision,data_json,last_op,updated_at) VALUES(?,0,?,NULL,?)').bind(owner,before,stamp),
  env.DB.prepare('UPDATE budget_states SET data_json=?,revision=revision+1,last_op=?,updated_at=? WHERE owner_id=? AND revision=?').bind(after,eventId,stamp,owner,current.revision),
  env.DB.prepare('INSERT OR IGNORE INTO budget_operations SELECT ?,?,?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM budget_states WHERE owner_id=? AND revision=? AND last_op=?)').bind(owner,eventId,requestHash,command.type,JSON.stringify(command),beforeHash,afterHash,asOf,current.revision,current.revision+1,stamp,owner,current.revision+1,eventId)
 ]);
 const saved=await env.DB.prepare('SELECT request_hash,after_revision FROM budget_operations WHERE owner_id=? AND event_id=?').bind(owner,eventId).first<{request_hash:string;after_revision:number}>();
 if(!saved||saved.request_hash!==requestHash)throw new BudgetError('更新が競合しました。再読み込みして確認してください',409);return {revision:saved.after_revision};
}
export async function budgetRoute(request:Request,env:BudgetEnv,userId:string,read:(request:Request,max?:number)=>Promise<any>){
 try{const url=new URL(request.url),path=url.pathname.slice('/api/household-budget'.length),method=request.method;
 if(method==='GET'&&path===''){const value=await state(env,userId),asOf=today(),month=url.searchParams.get('month')||asOf.slice(0,7),basis=url.searchParams.get('basis')==='settleMonth'?'settleMonth':'date';return json({...value,userId,today:asOf,summary:budgetSummary(value.data,asOf,month,basis)});}
 if(method==='GET'&&path==='/export'){const value=await state(env,userId);const audit=(await env.DB.prepare('SELECT * FROM budget_operations WHERE owner_id=? ORDER BY after_revision').bind(userId).all()).results;return json({format:'budget-backup-v1',revision:value.revision,state:value.data,audit,legacyCompatible:legacyExport(value.data)});}
 if(method==='GET'&&path==='/audit'){const rows=await env.DB.prepare('SELECT event_id,command_type,before_revision,after_revision,created_at FROM budget_operations WHERE owner_id=? ORDER BY after_revision DESC LIMIT 200').bind(userId).all();return json(rows.results);}
 if(method==='POST'&&path==='/import-preview')return json(importPreview(await read(request,4000000)));
 if(method==='POST'&&path==='/command'){if(request.headers.get('X-Budget-User')!==userId)throw new BudgetError('HOMEの利用者が変わりました。開き直してください',409);const input=await read(request,4000000);if(typeof input?.eventId!=='string'||typeof input?.command?.type!=='string')throw new BudgetError('操作内容を確認してください');return json(await execute(env,userId,input.eventId,input.command,today()));}
 return json({error:'見つかりません'},404);
 }catch(error){if(error instanceof BudgetError)return json({error:error.message},error.status);throw error;}
}
export async function runBudgetSchedules(env:BudgetEnv,timestamp:number){if(env.BUDGET_SCHEDULES_ENABLED!=='1')return;const date=new Date(timestamp+9*3600000).toISOString().slice(0,10),owners=await env.DB.prepare("SELECT s.owner_id FROM budget_states s JOIN users u ON u.id=s.owner_id AND u.active=1 JOIN personal_app_access p ON p.user_id=s.owner_id AND p.app_id='household-budget' JOIN apps a ON a.id=p.app_id AND a.enabled=1").all<{owner_id:string}>();for(const row of owners.results){try{await execute(env,row.owner_id,'auto-month:'+date.slice(0,7),{type:'plans.generate',data:{month:date.slice(0,7)}},date);}catch(error){if(!(error instanceof BudgetError&&error.status===409))throw error;}}}
