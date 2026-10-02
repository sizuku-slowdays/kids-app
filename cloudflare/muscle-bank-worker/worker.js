import {validateState} from '../../muscle-bank/model.js';
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const fail=(message,status)=>{throw Object.assign(new Error(message),{status})};
// HOME側の本人認証実装がGitHubにまだ無いため、ここだけを接続時に合わせる。
// HOMEがサーバー内通信で本人IDを返す。ブラウザから送られたID・名前・audienceは信用しない。
async function owner(request,env){
 if(!env.HOME_AUTH||!env.MUSCLE_OWNER_ID)fail('HOME authentication is not configured',503);
 const r=await env.HOME_AUTH.fetch(new Request('https://home.internal/internal/session',{headers:{Cookie:request.headers.get('Cookie')||'',Authorization:request.headers.get('Authorization')||''}}));
 if(r.status===401)fail('Login required',401);
 if(!r.ok)fail('HOME authentication unavailable',503);
 const result=await r.json();
 if(typeof result.userId!=='string'||!result.userId)fail('Login required',401);
 if(result.userId!==env.MUSCLE_OWNER_ID)fail('Owner access required',403);
 return result.userId;
}
function bytes64(bytes){let s='';for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(s)}
async function splitImages(state,uid,env){const copy=structuredClone(state);for(const key of ['exercises','rewards','changes'])for(const item of copy[key])if(item.image){const [head,data]=item.image.split(','),bytes=Uint8Array.from(atob(data),c=>c.charCodeAt(0)),digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(n=>n.toString(16).padStart(2,'0')).join(''),path=`owners/${uid}/${digest}`;await env.PHOTOS.put(path,bytes,{httpMetadata:{contentType:head.slice(5).split(';')[0]}});item.image={key:path,mime:head.slice(5).split(';')[0]}}return copy}
async function hydrate(state,uid,env){for(const key of ['exercises','rewards','changes'])for(const item of state[key])if(item.image&&typeof item.image==='object'){if(!item.image.key.startsWith(`owners/${uid}/`))fail('Invalid image owner',500);const object=await env.PHOTOS.get(item.image.key);if(!object)fail('Image is missing',500);item.image=`data:${item.image.mime};base64,${bytes64(new Uint8Array(await object.arrayBuffer()))}`}return state}
export default {async fetch(request,env){try{
 const url=new URL(request.url),path=url.pathname.replace(/^\/api\/muscle-bank/,'');
 if(path==='/health')return json({ok:true,authentication:'HOME session and owner ID required'});
 if(!env.ALLOWED_ORIGIN)fail('Origin is not configured',503);
 const origin=request.headers.get('Origin');if(origin&&origin!==env.ALLOWED_ORIGIN)fail('Forbidden origin',403);
 if(!['GET','PUT'].includes(request.method))return json({error:'Method not allowed'},405);
 if(request.method==='PUT'&&origin!==env.ALLOWED_ORIGIN)fail('Origin required',403);
 const uid=await owner(request,env);
 if(!env.DB||!env.PHOTOS)fail('Storage is not configured',503);
 if(path!=='/state')return json({error:'Not found'},404);
 if(request.method==='GET'){const row=await env.DB.prepare('SELECT revision,state_json FROM muscle_states WHERE owner_id=?').bind(uid).first();return json({revision:row?.revision||0,state:row?await hydrate(JSON.parse(row.state_json),uid,env):null})}
 if(!/^application\/json\b/.test(request.headers.get('Content-Type')||''))fail('JSON required',415);
 const expected=Number(request.headers.get('If-Match'));if(request.headers.get('If-Match')===null||!Number.isSafeInteger(expected)||expected<0)fail('Revision required',400);
 const raw=await request.text();if(raw.length>50000000)fail('State is too large',413);
 let state;try{state=validateState(JSON.parse(raw))}catch(e){fail(e.message,400)}
 const row=await env.DB.prepare('SELECT revision FROM muscle_states WHERE owner_id=?').bind(uid).first();if((row?.revision||0)!==expected)fail('State changed on another device',409);
 const stored=JSON.stringify(await splitImages(state,uid,env));if(stored.length>900000)fail('Too much metadata',413);
 const next=expected+1,now=new Date().toISOString();
 const result=row?await env.DB.prepare('UPDATE muscle_states SET state_json=?,revision=?,updated_at=? WHERE owner_id=? AND revision=?').bind(stored,next,now,uid,expected).run():await env.DB.prepare('INSERT OR IGNORE INTO muscle_states(owner_id,revision,state_json,updated_at) VALUES(?,?,?,?)').bind(uid,next,stored,now).run();
 if(result.meta.changes!==1)fail('State changed on another device',409);
 return json({revision:next});
 }catch(e){return json({error:e.status?e.message:'Internal error'},e.status||500)}}};
