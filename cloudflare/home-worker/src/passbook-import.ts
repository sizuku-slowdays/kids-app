type EnvLike={DB:D1Database;LEGACY_DB?:D1Database;PRIVATE_FILES:R2Bucket};
const assert=(v:unknown,msg:string):asserts v=>{if(!v)throw new Error(msg)};
function amount(v:unknown){const n=Number(v);if(v===null||v===''||!Number.isSafeInteger(n)||Math.abs(n)>10000000)throw Error('旧データの数値を確認する必要があります');return n}
function unwrap(v:any):any{if(typeof v==='string')return unwrap(JSON.parse(v));if(v?.balances)return v;for(const k of ['data','value','payload','record'])if(v?.[k]){const r=unwrap(v[k]);if(r)return r}return null}
function date(v:unknown,fallback:string){const s=String(v||'');const j=s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})(?:\s+(\d{1,2}):(\d{2}))?/);if(j)return new Date(`${j[1]}-${j[2].padStart(2,'0')}-${j[3].padStart(2,'0')}T${(j[4]||'00').padStart(2,'0')}:${j[5]||'00'}:00+09:00`).toISOString();return !Number.isNaN(Date.parse(s))?new Date(s).toISOString():fallback}
function bankId(v:unknown){const s=String(v);return ['rabbit','usagi'].includes(s)?'usagi':['uni','unicorn','kuma'].includes(s)?'kuma':s}
async function hash(v:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v)))).map(b=>b.toString(16).padStart(2,'0')).join('')}
export async function snapshot(env:EnvLike){
 if(!env.LEGACY_DB)throw Error('旧DBが接続されていません');
 const db=env.LEGACY_DB;
 const rows=await db.prepare("SELECT app,data_key,data_json,updated_at FROM app_data WHERE app IN ('mama-bank','mama-bank-view') AND data_key='main' ORDER BY app").all<any>();
 const bank=unwrap(rows.results.find(r=>r.app==='mama-bank')?.data_json);if(!bank||!Array.isArray(bank.history))throw Error('銀行の残高・履歴が読み取れません');
 const read=async(table:string)=>{const r=await db.prepare(`SELECT * FROM ${table} ORDER BY id LIMIT 20001`).all<any>();if(r.results.length>20000)throw Error('記録が多いため分割バックアップが必要です');return r.results};
 const [members,logs,rewards,requests]=await Promise.all(['family_members','chore_logs','rewards','reward_requests'].map(read));
 const raw={bank_rows:rows.results,members,logs,rewards,requests};
 return {raw,bank,hash:await hash(JSON.stringify(raw))};
}
type Mapping={bank:Record<string,string>;points:Record<string,string>};
export function planImport(s:Awaited<ReturnType<typeof snapshot>>,mapping:Mapping){
 const entries:{target:string;unit:string;delta:number;memo:string;date:string;source:string;event:string}[]=[],summary:any[]=[];
 const balances:Record<string,number>={};
 for(const [key,v] of Object.entries(s.bank.balances)){const id=bankId(key);if(id in balances&&balances[id]!==amount(v))throw Error('旧口座IDの重複を確認してください');balances[id]=amount(v)}
 for(const [id,balance] of Object.entries(balances)){
  const target=mapping.bank[id];if(!target)throw Error('銀行口座の対応先を選んでください');
  let total=0,count=0;
  for(const [i,row] of s.bank.history.entries()){if(bankId(row.acc)!==id)continue;const n=amount(row.amount);if(n<0||!['deposit','withdraw'].includes(row.type))throw Error('銀行履歴の形式を確認してください');const delta=row.type==='deposit'?n:-n;total+=delta;count++;if(delta)entries.push({target,unit:'cash',delta,memo:String(row.memo||'旧銀行の記録'),date:date(row.date,'1970-01-01T00:00:00Z'),source:'legacy-bank',event:String(i)})}
  if(balance!==total)entries.push({target,unit:'cash',delta:balance-total,memo:'移行前の残高調整（元履歴はバックアップに保存）',date:'1969-12-31T00:00:00Z',source:'legacy-opening',event:id});summary.push({target,unit:'cash',balance,history_count:count});
 }
 if(s.bank.history.some((r:any)=>!(bankId(r.acc) in balances)))throw Error('残高にない口座の履歴があり、確認が必要です');
 for(const member of s.raw.members){const id=String(member.id),target=mapping.points[id];if(!target)throw Error('ポイントの対応先を選んでください');let balance=0,count=0;
  for(const row of s.raw.logs.filter(r=>String(r.completed_by)===id)){const delta=amount(row.points);if(delta<0)throw Error('ポイント履歴の形式を確認してください');balance+=delta;count++;if(delta)entries.push({target,unit:'chores',delta,memo:String(row.chore_name||'お手伝い'),date:date(row.created_at||row.completed_date,'1970-01-01T00:00:00Z'),source:'legacy-chore',event:String(row.id)})}
  for(const row of s.raw.requests.filter(r=>String(r.member_id)===id&&r.status==='approved')){const cost=amount(row.points_cost);if(cost<0)throw Error('交換履歴の形式を確認してください');balance-=cost;if(cost)entries.push({target,unit:'chores',delta:-cost,memo:String(row.reward_name||'ポイント交換'),date:date(row.resolved_at||row.requested_at,'1970-01-01T00:00:00Z'),source:'legacy-reward',event:String(row.id)})}
  summary.push({target,unit:'chores',balance,history_count:count});
 }
 if(s.raw.logs.some(r=>!mapping.points[String(r.completed_by)])||s.raw.requests.some(r=>!mapping.points[String(r.member_id)]))throw Error('家族一覧にないポイント記録があり、確認が必要です');
 // No summing two different people into one account by accident.
 for(const unit of ['cash','chores']){const targets=summary.filter(r=>r.unit===unit).map(r=>r.target);if(new Set(targets).size!==targets.length)throw Error('別の人の口座には別の対応先を選んでください')}
 return {entries,summary};
}
export async function importLegacy(env:EnvLike,household:string,userId:string,mapping:Mapping){
 if(await env.DB.prepare('SELECT 1 FROM passbook_activation WHERE household_id=?').bind(household).first())throw Error('使用開始済みの通帳へ上書きできません');
 const old=await env.DB.prepare('SELECT summary_json,snapshot_hash FROM passbook_imports WHERE household_id=?').bind(household).first<{summary_json:string;snapshot_hash:string}>();
 if(old)return {already_imported:true,summary:JSON.parse(old.summary_json),snapshot_hash:old.snapshot_hash};
 const children=(await env.DB.prepare('SELECT id,user_id FROM children WHERE household_id=?').bind(household).all<{id:string;user_id:string|null}>()).results;
 const targets=new Set([...Object.values(mapping.bank),...Object.values(mapping.points)]);
 for(const target of targets){if(target===`user:${userId}`)continue;if(!children.some(c=>c.id===target&&c.user_id))throw Error('対応先はこの家庭の登録済みアカウントを選んでください')}
 const s=await snapshot(env),p=planImport(s,mapping),now=Math.floor(Date.now()/1000),key=`passbook-backups/${household}/${s.hash}/${crypto.randomUUID()}.json`;
 await env.PRIVATE_FILES.put(key,JSON.stringify({version:1,created_at:now,household_id:household,mapping,snapshot:s.raw,plan:p}),{httpMetadata:{contentType:'application/json'}});
 const saved=await env.PRIVATE_FILES.get(key);if(!saved)throw Error('バックアップを確認できません');const backup=JSON.parse(await saved.text());if(JSON.stringify(backup.snapshot)!==JSON.stringify(s.raw))throw Error('バックアップの照合に失敗しました');
 const fresh=await snapshot(env);if(fresh.hash!==s.hash)throw Error('旧データが更新されました。もう一度取り込んでください');
 const statements:D1PreparedStatement[]=[];
 statements.push(env.DB.prepare('INSERT INTO passbook_imports VALUES (?,?,?,?,?,?)').bind(household,s.hash,key,userId,now,JSON.stringify(p.summary)));
 for(const [code,name,kind,symbol] of [['cash','現金','money','円'],['chores','お手伝いポイント','points','ポイント']])statements.push(env.DB.prepare('INSERT INTO passbook_units(id,household_id,code,name,kind,symbol) VALUES (?,?,?,?,?,?)').bind(`${household}:${code}`,household,code,name,kind,symbol));
 statements.push(env.DB.prepare('INSERT INTO passbook_settings VALUES (?,1)').bind(household));
 for(const row of p.summary){const adult=row.target.startsWith('user:'),account=`${household}:${row.target}:${row.unit}`;statements.push(adult?env.DB.prepare('INSERT INTO passbook_adult_accounts VALUES (?,?,?,?)').bind(account,household,userId,`${household}:${row.unit}`):env.DB.prepare('INSERT INTO passbook_accounts VALUES (?,?,?,?)').bind(account,household,row.target,`${household}:${row.unit}`));}
 const bulk=(table:string,columns:string[],rows:unknown[][])=>{
  if(!rows.length)return;
  const encoded=JSON.stringify(rows);if(new TextEncoder().encode(encoded).byteLength>900000)throw Error('記録が多いため分割バックアップが必要です');
  statements.push(env.DB.prepare(`INSERT INTO ${table}(${columns.join(',')}) SELECT ${columns.map((_,i)=>`json_extract(value,'$[${i}]')`).join(',')} FROM json_each(?)`).bind(encoded));
 };
 const childEntries:unknown[][]=[],adultEntries:unknown[][]=[];
 for(const [i,e] of p.entries.entries())(e.target.startsWith('user:')?adultEntries:childEntries).push([`${household}:import:${i}`,`${household}:${e.target}:${e.unit}`,household,e.delta,e.memo,e.date,now,userId,e.source,e.event]);
 const ledgerColumns=['id','account_id','household_id','delta','memo','occurred_at','created_at','created_by','source_app','source_event'];
 bulk('passbook_entries',ledgerColumns,childEntries);bulk('passbook_adult_entries',ledgerColumns,adultEntries);
 const rewardRows:unknown[][]=[];
 for(const r of s.raw.rewards){const cost=amount(r.points);if(cost<1)throw Error('交換商品の必要ポイントを確認してください');rewardRows.push([`${household}:reward:${r.id}`,household,`${household}:chores`,String(r.name),cost,r.stock===null||r.stock===undefined?null:amount(r.stock),r.enabled?1:0]);}
 bulk('passbook_rewards',['id','household_id','unit_id','name','cost','stock','enabled'],rewardRows);
 const legacyRows:unknown[][]=[];
 for(const row of s.raw.logs){const target=mapping.points[String(row.completed_by)];if(target.startsWith('user:'))continue;legacyRows.push([household,'chore',String(row.id),target,row.bank_synced===null?null:Number(row.bank_synced||0),now]);}
 bulk('passbook_legacy_events',['household_id','provider','legacy_id','child_id','bank_synced','imported_at'],legacyRows);
 // Preserve every original request in the private snapshot. Pending requests require matching active products.
 for(const r of s.raw.requests.filter(r=>r.status==='pending')){const target=mapping.points[String(r.member_id)];if(target.startsWith('user:'))throw Error('ママの未承認申請は個別確認が必要です');const child=children.find(c=>c.id===target);if(!child)throw Error('子どものアカウントを確認してください');const reward=s.raw.rewards.find(q=>String(q.id)===String(r.reward_id));if(!reward||amount(reward.points)!==amount(r.points_cost)||String(reward.name)!==String(r.reward_name))throw Error('未承認申請の商品情報を個別確認してください');statements.push(env.DB.prepare('INSERT INTO passbook_requests(id,household_id,account_id,reward_id,reward_name,cost,requested_by,requested_at) VALUES (?,?,?,?,?,?,?,?)').bind(`${household}:request:${r.id}`,household,`${household}:${target}:chores`,`${household}:reward:${r.reward_id}`,String(r.reward_name),amount(r.points_cost),child.user_id,Math.floor(Date.parse(date(r.requested_at,new Date().toISOString()))/1000)))}
 // D1 batch is transactional: any invalid history/request rolls back the entire import.
 await env.DB.batch(statements);
 const result=await reconcile(env,household,p.summary);if(!result.ok)throw Error('取込後の残高照合に失敗しました。本番利用は停止したままです');
 return {summary:p.summary,snapshot_hash:s.hash,backup_saved:true,reconciled:true,active:false};
}
export async function reconcile(env:EnvLike,h:string,rows:any[]){for(const r of rows){const table=r.target.startsWith('user:')?'passbook_adult_entries':'passbook_entries';const actual=await env.DB.prepare(`SELECT COALESCE(SUM(delta),0) balance FROM ${table} WHERE account_id=? AND household_id=?`).bind(`${h}:${r.target}:${r.unit}`,h).first<{balance:number}>();if(actual?.balance!==r.balance)return {ok:false}}return {ok:true}}
