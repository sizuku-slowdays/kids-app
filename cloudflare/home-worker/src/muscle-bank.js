import { validateState } from '../public/apps/muscle-bank/model.js';
const headers = {'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
const fail=(message,status)=>{throw Object.assign(new Error(message),{status})};
const LIMIT=50_000_000;
async function boundedBody(request){
 if(Number(request.headers.get('Content-Length')||0)>LIMIT)fail('記録が大きすぎます',413);
 const reader=request.body?.getReader();if(!reader)fail('入力がありません',400);
 const chunks=[];let length=0;
 while(true){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>LIMIT){await reader.cancel();fail('記録が大きすぎます',413)}chunks.push(value)}
 const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}
 return new TextDecoder().decode(bytes);
}
function bytes64(bytes){let s='';for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(s)}
function imageSlots(state){
 const slots=[];
 for(const collection of ['exercises','rewards','changes'])for(const item of state[collection]){
  if(item.image)slots.push([item,'image']);
  if(collection==='exercises'&&Array.isArray(item.images))item.images.forEach((_,i)=>slots.push([item.images,i]));
 }
 return slots;
}
async function splitImages(state,uid,bucket){
 const copy=structuredClone(state);
 for(const [parent,slot] of imageSlots(copy)){
  const [head,data]=parent[slot].split(','),bytes=Uint8Array.from(atob(data),c=>c.charCodeAt(0));
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(n=>n.toString(16).padStart(2,'0')).join('');
  const key=`muscle-bank/owners/${uid}/${hash}`,mime=head.slice(5).split(';')[0];
  if(!await bucket.head(key))await bucket.put(key,bytes,{httpMetadata:{contentType:mime}});
  parent[slot]={key,mime};
 }
 return copy;
}
async function hydrate(state,uid,bucket){
 for(const [parent,slot] of imageSlots(state)){
  const ref=parent[slot];if(typeof ref!=='object')continue;
  if(!ref.key.startsWith(`muscle-bank/owners/${uid}/`))fail('画像の所有者が一致しません',500);
  const object=await bucket.get(ref.key);if(!object)fail('画像を読み込めませんでした',500);
  parent[slot]=`data:${ref.mime};base64,${bytes64(new Uint8Array(await object.arrayBuffer()))}`;
 }
 return state;
}
// The HOME router calls this only after verifying the active session and personal app grant.
// ownerId is server-derived, never a client query, body property or display name.
export async function muscleRoute(request,env,ownerId){
 try{
  if(new URL(request.url).pathname!=='/api/muscle-bank/state')return json({error:'見つかりません'},404);
  if(request.method==='GET'){
   const row=await env.DB.prepare('SELECT revision,state_json FROM muscle_bank_states WHERE owner_id=?').bind(ownerId).first();
   return json({revision:row?.revision||0,state:row?await hydrate(JSON.parse(row.state_json),ownerId,env.PRIVATE_FILES):null});
  }
  if(request.method!=='PUT')return json({error:'この操作はできません'},405);
  if(request.headers.get('Content-Type')?.split(';')[0]!=='application/json')fail('JSON形式で送信してください',415);
  const expected=Number(request.headers.get('If-Match'));
  if(request.headers.get('If-Match')===null||!Number.isSafeInteger(expected)||expected<0)fail('記録の更新番号が必要です',400);
  let state;try{state=validateState(JSON.parse(await boundedBody(request)))}catch(e){if(e.status)throw e;fail(e.message,400)}
  const row=await env.DB.prepare('SELECT revision FROM muscle_bank_states WHERE owner_id=?').bind(ownerId).first();
  if((row?.revision||0)!==expected)fail('別の端末で更新されています。再読み込みしてください。',409);
  const stored=JSON.stringify(await splitImages(state,ownerId,env.PRIVATE_FILES));
  if(new TextEncoder().encode(stored).byteLength>900000)fail('記録が多くなりました。バックアップを保存してください。',413);
  const next=expected+1,now=new Date().toISOString();
  const result=row
   ?await env.DB.prepare('UPDATE muscle_bank_states SET state_json=?,revision=?,updated_at=? WHERE owner_id=? AND revision=?').bind(stored,next,now,ownerId,expected).run()
   :await env.DB.prepare('INSERT OR IGNORE INTO muscle_bank_states(owner_id,revision,state_json,updated_at) VALUES(?,?,?,?)').bind(ownerId,next,stored,now).run();
  if(result.meta.changes!==1)fail('別の端末で更新されています。再読み込みしてください。',409);
  return json({revision:next});
 }catch(e){return json({error:e.status?e.message:'保存処理に接続できませんでした'},e.status||500)}
}
