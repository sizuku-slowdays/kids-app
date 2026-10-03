import { snapshot, reconcile } from './passbook-import';
type EnvLike={DB:D1Database;LEGACY_DB?:D1Database;PRIVATE_FILES:R2Bucket};
const HOME='https://home-worker.sslowdayss.workers.dev';
function requireReady(value:unknown,message:string):asserts value {if(!value)throw Object.assign(new Error(message),{status:409});}
async function get(url:string){try{return await fetch(url,{redirect:'manual',headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(6000)})}catch{throw Object.assign(new Error('旧アプリの停止状態を確認できません。Workerの反映を確認してください'),{status:409})}}
export async function activatePassbook(env:EnvLike,household:string,userId:string){
 const existing=await env.DB.prepare('SELECT 1 FROM passbook_activation WHERE household_id=?').bind(household).first();
 if(existing)return {active:true,already_active:true};
 const record=await env.DB.prepare('SELECT snapshot_hash,backup_key,summary_json FROM passbook_imports WHERE household_id=?').bind(household).first<{snapshot_hash:string;backup_key:string;summary_json:string}>();
 requireReady(record,'先にバックアップと取込を完了してください');
 const [bank,chore,publicBank,publicChores]=await Promise.all([
  get('https://api.cetus.fun/api/home-passbook-status'),get('https://otetsudai-api.sslowdayss.workers.dev/api/home-passbook-status'),
  get('https://api.cetus.fun/api/app-data-public?key=mama-bank-view'),get('https://otetsudai-api.sslowdayss.workers.dev/api/members')
 ]);
 async function marker(response:Response,service:string){let value:any;try{value=await response.json()}catch{return false}return response.ok&&value.version===1&&value.service===service&&value.retired===true&&value.home===HOME}
 requireReady(await marker(bank,'bank')&&await marker(chore,'chores'),'旧Workerの切替設定が未完了です。2本ともHOME_PASSBOOK_MIGRATEDを1にしてください');
 async function closed(response:Response){let value:any;try{value=await response.json()}catch{return false}return response.status===410&&value.migrated===true}
 requireReady(await closed(publicBank)&&await closed(publicChores),'旧公開APIがまだ利用できるため、切替を止めています');
 const backupFile=await env.PRIVATE_FILES.get(record.backup_key);requireReady(backupFile,'非公開バックアップが見つからないため切替できません');
 let backup:any;try{backup=JSON.parse(await backupFile.text())}catch{requireReady(false,'バックアップを読み取れません')}
 requireReady(backup.household_id===household&&backup.snapshot&&backup.plan,'バックアップの内容を確認できません');
 const savedHash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(backup.snapshot))))).map(b=>b.toString(16).padStart(2,'0')).join('');
 requireReady(savedHash===record.snapshot_hash,'バックアップの照合に失敗したため切替を止めています');
 const fresh=await snapshot(env);requireReady(fresh.hash===record.snapshot_hash,'取込後に旧データが更新されています。差分確認が必要なため切替を止めています');
 const summary=JSON.parse(record.summary_json);
 requireReady(JSON.stringify(backup.plan.summary)===JSON.stringify(summary),'残高の取込記録が一致しません');
 requireReady((await reconcile(env,household,summary)).ok,'新しい通帳の残高が一致しないため切替を止めています');
 const now=Math.floor(Date.now()/1000);
 await env.DB.batch([
  env.DB.prepare('INSERT INTO passbook_activation(household_id,activated_at,activated_by,backup_key) SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM passbook_imports WHERE household_id=? AND snapshot_hash=? AND backup_key=?) ON CONFLICT(household_id) DO NOTHING').bind(household,now,userId,record.backup_key,household,record.snapshot_hash,record.backup_key),
  env.DB.prepare("UPDATE apps SET path='/apps/passbook/',status='ready' WHERE id='passbook' AND EXISTS(SELECT 1 FROM passbook_activation WHERE household_id=?)").bind(household),
 ]);
 requireReady(await env.DB.prepare('SELECT 1 FROM passbook_activation WHERE household_id=?').bind(household).first(),'切替が完了しませんでした');
 return {active:true,backup_verified:true,legacy_closed:true,reconciled:true};
}
