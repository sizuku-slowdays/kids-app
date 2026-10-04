type Context={DB:D1Database;LEGACY_DB?:D1Database};
function ensure(v:unknown,message:string,status=400):asserts v {if(!v)throw Object.assign(Error(message),{status})}
const LIMIT=600000;
// Use the old point app's data-URL-in-D1 storage. Allow raster formats only.
export function raster(data:unknown){
 ensure(typeof data==='string'&&data.length<=LIMIT,'画像が大きすぎます',413);
 const m=data.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/);ensure(m,'JPEG・PNG・WebP画像を選んでください',415);
 let binary:string;try{binary=atob(m[2]);}catch{throw Object.assign(Error('画像を読み込めません'),{status:415})}
 const bytes=Uint8Array.from(binary,c=>c.charCodeAt(0)),mime=m[1];
 ensure((mime==='image/jpeg'&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)||(mime==='image/png'&&[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v))||(mime==='image/webp'&&String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP'),'画像形式を確認してください',415);
 return {bytes,mime};
}
export async function rewardBody(request:Request){
 ensure(request.headers.get('Content-Type')?.split(';')[0]==='application/json','JSON形式で送信してください',415);ensure(Number(request.headers.get('Content-Length')||0)<=LIMIT,'画像が大きすぎます',413);
 const reader=request.body?.getReader();ensure(reader,'入力がありません');const chunks:Uint8Array[]=[];let length=0;
 while(true){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>LIMIT){await reader.cancel();throw Object.assign(Error('画像が大きすぎます'),{status:413})}chunks.push(value)}
 const bytes=new Uint8Array(length);let n=0;for(const c of chunks){bytes.set(c,n);n+=c.byteLength}
 let data;try{data=JSON.parse(new TextDecoder().decode(bytes))}catch{throw Object.assign(Error('入力を読み込めません'),{status:400})}ensure(data&&typeof data==='object'&&!Array.isArray(data),'入力を確認してください');return data as Record<string,unknown>;
}
function legacyId(h:string,id:string){const prefix=h+':reward:';return id.startsWith(prefix)?id.slice(prefix.length):null}
export async function listRewards(env:Context,h:string,admin:boolean){
 const rows=(await env.DB.prepare('SELECT id,household_id,unit_id,name,cost,stock,enabled,image_override,edit_revision,image_url IS NOT NULL AS has_image FROM passbook_rewards WHERE household_id=? AND (?=1 OR enabled=1) ORDER BY name,id').bind(h,admin?1:0).all<any>()).results;
 let oldIds=new Set<string>();if(env.LEGACY_DB&&rows.some(r=>!r.image_override&&legacyId(h,r.id))&&await env.DB.prepare('SELECT 1 FROM passbook_imports WHERE household_id=?').bind(h).first())oldIds=new Set((await env.LEGACY_DB.prepare("SELECT id FROM rewards WHERE image_url IS NOT NULL AND image_url<>'' LIMIT 1000").all<{id:string|number}>()).results.map(r=>String(r.id)));
 for(const r of rows){r.has_image=Boolean(r.has_image||(!r.image_override&&oldIds.has(legacyId(h,r.id)||'')));delete r.image_override;r.image_path=r.has_image?'/api/passbook/rewards/'+encodeURIComponent(r.id)+'/image?household='+encodeURIComponent(h)+'&v='+r.edit_revision:null}
 return rows;
}
export async function rewardImage(request:Request,env:Context,h:string,admin:boolean,id:string){
 const r=await env.DB.prepare('SELECT id,image_url,image_override FROM passbook_rewards WHERE id=? AND household_id=? AND (?=1 OR enabled=1)').bind(id,h,admin?1:0).first<{id:string;image_url:string|null;image_override:number}>();ensure(r,'画像が見つかりません',404);let value=r.image_url;
 const oldId=legacyId(h,id);if(!value&&!r.image_override&&oldId&&env.LEGACY_DB&&await env.DB.prepare('SELECT 1 FROM passbook_imports WHERE household_id=?').bind(h).first())value=(await env.LEGACY_DB.prepare('SELECT image_url FROM rewards WHERE id=?').bind(oldId).first<{image_url:string|null}>())?.image_url||null;
 ensure(value,'画像が見つかりません',404);
 let image:{bytes:Uint8Array;mime:string};
 if(value.startsWith('data:'))image=raster(value);
 else{
  // Old URL-backed rewards were files in the existing points folder. Do not proxy arbitrary hosts.
  const url=new URL(value,'https://cetus.fun/kanriapp/');ensure(url.protocol==='https:'&&((url.hostname==='cetus.fun'&&url.pathname.startsWith('/kanriapp/points/'))||(url.hostname==='sizuku-slowdays.github.io'&&url.pathname.startsWith('/kids-app/kanriapp/points/')))&&!url.pathname.includes('%'),'旧画像のURLは個別確認が必要です',415);
  const path=url.pathname.slice(url.pathname.indexOf('/kanriapp/points/')+1);ensure(/^kanriapp\/points\/[A-Za-z0-9_.-]+\.(?:jpe?g|png|webp)$/i.test(path),'旧画像の形式を確認してください',415);
  const response=await fetch('https://raw.githubusercontent.com/sizuku-slowdays/kids-app/main/'+path,{redirect:'error',signal:AbortSignal.timeout(6000)});ensure(response.ok,'旧画像が見つかりません',404);const mime=response.headers.get('Content-Type')?.split(';')[0]||'';ensure(['image/jpeg','image/png','image/webp'].includes(mime),'画像形式を確認してください',415);ensure(Number(response.headers.get('Content-Length')||0)<=450000,'旧画像が大きすぎます',413);
  const reader=response.body?.getReader();ensure(reader,'旧画像が見つかりません',404);const chunks:Uint8Array[]=[];let count=0;while(true){const {done,value}=await reader.read();if(done)break;count+=value.byteLength;if(count>450000){await reader.cancel();throw Object.assign(Error('旧画像が大きすぎます'),{status:413})}chunks.push(value)}const bytes=new Uint8Array(count);let n=0;for(const c of chunks){bytes.set(c,n);n+=c.byteLength}image={bytes,mime};
 }
 return new Response(request.method==='HEAD'?null:image.bytes,{headers:{'Content-Type':image.mime,'Content-Disposition':'inline','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"}});
}
