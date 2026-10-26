export const CONSENT_VERSION='2026-10-26-development-v1';
export const DAY=86400000;
export function ensure(ok,message='この操作はできません',status=400){if(!ok)throw Object.assign(new Error(message),{status});}
export const uid=()=>crypto.randomUUID();
export function token(){return [...crypto.getRandomValues(new Uint8Array(32))].map(x=>x.toString(16).padStart(2,'0')).join('');}
export async function hash(text){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))].map(x=>x.toString(16).padStart(2,'0')).join('');}
export async function passwordHash(password,salt){const k=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);return [...new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:new TextEncoder().encode(salt),iterations:100000},k,256))].map(x=>x.toString(16).padStart(2,'0')).join('');}
export function same(a,b){if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;let n=0;for(let i=0;i<a.length;i++)n|=a.charCodeAt(i)^b.charCodeAt(i);return n===0;}
export function credentials(b){ensure(typeof b.login==='string'&&/^[a-zA-Z0-9_-]{3,40}$/.test(b.login),'ログインIDは英数字・_・-の3〜40文字です');ensure(typeof b.password==='string'&&b.password.length>=12&&b.password.length<=128,'パスワードは12〜128文字です');return b.login.toLowerCase();}
export function alias(value){ensure(typeof value==='string'&&value.trim().length>=1&&value.trim().length<=30,'呼び名は1〜30文字です');return value.trim();}
export function validateSchedule(value){ensure(Array.isArray(value)&&value.length===7,'曜日ごとの時間を確認してください');return value.map(w=>{ensure(Array.isArray(w)&&w.length<=3,'1日3つまでの時間帯です');return w.map(x=>{ensure(Array.isArray(x)&&x.length===2&&x.every(n=>Number.isInteger(n)&&n>=0&&n<=1440)&&x[0]<x[1],'時間帯の開始と終了を確認してください');return x;});});}
export function timeAllowed(settings,now=new Date()){
 if(settings.paused)return false;
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:settings.timezone,weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now).map(p=>[p.type,p.value]));
 const d=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(parts.weekday),minute=Number(parts.hour)*60+Number(parts.minute);
 return JSON.parse(settings.schedule_json)[d]?.some(([a,b])=>minute>=a&&minute<b)||false;
}
export async function body(request,max=16000){const bytes=await limitedBytes(request,max);try{const value=JSON.parse(new TextDecoder().decode(bytes));ensure(value&&typeof value==='object'&&!Array.isArray(value));return value;}catch{ensure(false,'入力形式を確認してください');}}
export async function limitedBytes(request,max){const reader=request.body?.getReader();ensure(reader,'内容がありません');const chunks=[];let n=0;for(;;){const {value,done}=await reader.read();if(done)break;n+=value.length;if(n>max){await reader.cancel();ensure(false,'容量が大きすぎます',413);}chunks.push(value);}const out=new Uint8Array(n);let i=0;for(const c of chunks){out.set(c,i);i+=c.length;}return out;}
export async function quota(db,key,limit,windowMs,now=Date.now()){
 const bucket=key+':'+Math.floor(now/windowMs);
 const r=await db.prepare('INSERT INTO rate_buckets VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET n=n+1 WHERE n<? RETURNING n').bind(bucket,now+windowMs*2,limit).first();ensure(r,'少し待ってから、もう一度ためしてください',429);
}
export const STANDARD_STAMPS=Object.freeze({hello:'👋 やっほー',thanks:'🌷 ありがとう',ok:'👌 オッケー',yay:'🎉 やったー',bye:'🌙 またね',sorry:'🍀 ごめんね'});
