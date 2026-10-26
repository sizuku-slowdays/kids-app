import {ensure,hash} from './security.js';
// Additional owner-only gate for the isolated phone test. No HOME bindings.
// Fetch rotating public keys only from the configured Access team (never token-provided URLs).
const keys=new Map(),documents=new Map();
async function accessKeys(issuer){
 const cached=documents.get(issuer);if(cached&&cached.until>Date.now())return cached.promise;
 const promise=(async()=>{const r=await fetch(issuer+'/cdn-cgi/access/certs',{redirect:'error',signal:AbortSignal.timeout(5000)});ensure(r.ok,'認証鍵を確認できません',403);const text=await r.text();ensure(text.length<64000,'認証鍵を確認できません',403);const document=JSON.parse(text);ensure(Array.isArray(document.keys)&&document.keys.length<=10);return document;})();
 documents.set(issuer,{until:Date.now()+60000,promise});return promise;
}
const bytes=s=>{ensure(typeof s==='string'&&/^[A-Za-z0-9_-]+$/.test(s),'テスト環境の認証が必要です',403);return Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-s.length%4)%4)),c=>c.charCodeAt(0));};
const parse=s=>JSON.parse(new TextDecoder().decode(bytes(s)));
export async function privateTestGate(req,env,now=Math.floor(Date.now()/1000),resolveKeys=accessKeys){
 if(env.PRIVATE_TEST_MODE!=='1')return;
 ensure(env.REGISTRATION_ENABLED==='0'&&env.INVITATIONS_ENABLED==='0','テスト設定を確認してください',503);
 ensure(new URL(req.url).origin===env.PRIVATE_TEST_ORIGIN&&/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(env.ACCESS_ISSUER||'')&&/^[a-f0-9]{64}$/.test(env.TEST_OWNER_EMAIL_SHA256||'')&&env.ACCESS_AUD&&Number(env.TEST_EXPIRES_AT)>now,'テストの利用期限か設定を確認してください',403);
 const raw=req.headers.get('Cf-Access-Jwt-Assertion')||'';ensure(raw.length>0&&raw.length<16000,'テスト環境の認証が必要です',403);
 try{
  const parts=raw.split('.');ensure(parts.length===3);const h=parse(parts[0]),p=parse(parts[1]);
  ensure(h.alg==='RS256'&&typeof h.kid==='string'&&!h.crit&&p.iss===env.ACCESS_ISSUER&&Array.isArray(p.aud)&&p.aud.includes(env.ACCESS_AUD)&&typeof p.exp==='number'&&p.exp>now&&typeof p.iat==='number'&&p.iat<=now+30&&(!('nbf' in p)||typeof p.nbf==='number'&&p.nbf<=now)&&typeof p.email==='string');
  const jwks=await resolveKeys(env.ACCESS_ISSUER),matches=jwks.keys?.filter(k=>k.kid===h.kid&&k.kty==='RSA'&&(!k.alg||k.alg==='RS256')&&(!k.use||k.use==='sig'));
  ensure(matches?.length===1);const cacheKey=JSON.stringify(matches[0]);let key=keys.get(cacheKey);if(!key){key=await crypto.subtle.importKey('jwk',matches[0],{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);if(keys.size>8)keys.clear();keys.set(cacheKey,key);}
  ensure(await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,bytes(parts[2]),new TextEncoder().encode(parts[0]+'.'+parts[1])));
  ensure(await hash(p.email.trim().toLowerCase())===env.TEST_OWNER_EMAIL_SHA256);
 }catch{ensure(false,'このテスト環境は許可された本人だけが利用できます',403);}
}
