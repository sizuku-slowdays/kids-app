import {ensure,body,credentials,passwordHash,same,quota,hash} from './security.js';
const encoder=new TextEncoder();
const reply=v=>Response.json(v,{headers:{'Cache-Control':'no-store'}});
const decode=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-s.length%4)%4)),c=>c.charCodeAt(0));
export async function verifyHomeTicket(ticket,secret,now=Date.now()){
 ensure(typeof secret==='string'&&secret.length>=32,'我が家連携は準備中です',503);
 ensure(typeof ticket==='string'&&ticket.length<=2048&&/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(ticket),'我が家から開き直してください',403);
 const [payload,sig]=ticket.split('.');
 let claims,valid=false;
 try{const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['verify']);valid=await crypto.subtle.verify('HMAC',key,decode(sig),encoder.encode(payload));claims=JSON.parse(new TextDecoder().decode(decode(payload)));}catch{}
 ensure(valid&&claims?.aud==='oshaberi-home-v1'&&typeof claims.sub==='string'&&claims.sub.length>=1&&claims.sub.length<=200&&typeof claims.name==='string'&&claims.name.length<=100&&/^[a-f0-9]{64}$/.test(claims.challenge)&&/^[a-f0-9]{64}$/.test(claims.nonce)&&Number.isSafeInteger(claims.exp)&&claims.exp>now&&claims.exp<=now+120000,'我が家から開き直してください',403);
 return claims;
}
export async function unlinkHomeAccount(db,accountId){
 if(await db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='home_account_links'").first())
  await db.prepare('DELETE FROM home_account_links WHERE account_id=?').bind(accountId).run();
}
export async function homeLink(req,env,issueSession){
 const db=env.CHAT_DB,b=await body(req),claims=await verifyHomeTicket(b.ticket,env.OSHABERI_HOME_LINK_SECRET);
 ensure(typeof b.verifier==='string'&&/^[a-f0-9]{64}$/.test(b.verifier)&&same(await hash(b.verifier),claims.challenge),'我が家から連携を開始し直してください',403);
 ensure(await db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='home_launch_used'").first(),'我が家連携は準備中です',503);
 ensure(!await db.prepare('SELECT 1 FROM home_launch_used WHERE nonce=?').bind(claims.nonce).first(),'我が家から開き直してください',409);
 await quota(db,'home-link:'+await hash(claims.sub),15,900000);
 const link=await db.prepare('SELECT l.account_id,a.active FROM home_account_links l JOIN accounts a ON a.id=l.account_id WHERE l.home_user_id=?').bind(claims.sub).first();
 if(!link&&b.login===undefined)return reply({link_required:true,home_name:claims.name});
 let a;
 if(link){ensure(link.active,'連携したアカウントは利用できません',403);a={id:link.account_id};}
 else{
  const login=credentials(b);a=await db.prepare('SELECT * FROM accounts WHERE login=? AND active=1').bind(login).first();
  const calculated=await passwordHash(b.password,a?.salt||'invalid-login-timing-salt');ensure(a&&same(calculated,a.password_hash),'ログインIDかパスワードを確認してください',401);
 }
 const operations=[db.prepare('INSERT INTO home_launch_used VALUES(?,?)').bind(claims.nonce,claims.exp)];
 if(!link)operations.push(db.prepare('INSERT INTO home_account_links VALUES(?,?,?)').bind(claims.sub,a.id,Date.now()));
 try{await db.batch(operations);}catch{ensure(false,'連携済みか期限切れです。我が家から開き直してください',409);}
 return issueSession(db,a,'我が家から');
}
