import {ensure,uid,token,hash,passwordHash,same,credentials,alias,validateSchedule,timeAllowed,body,limitedBytes,quota,DAY,CONSENT_VERSION,STANDARD_STAMPS} from './security.js';
import {privateTestGate} from './private-test.js';
import {pixelsToPng,PIXEL_MIME,MAX_PIXEL_BYTES} from './pixel-images.js';
const json=(value,status=200,headers={})=>Response.json(value,{status,headers:{'Cache-Control':'no-store',...headers}});
const all=async statement=>(await statement.all()).results;
const record=(db,actor,action,target)=>db.prepare('INSERT INTO audit_events VALUES(?,?,?,?,?)').bind(uid(),actor,action,target,Date.now());
const cookie=(value,age=2592000)=>`__Host-oshaberi=${value}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${age}`;
async function auth(req,db){
 const t=(req.headers.get('Cookie')||'').match(/(?:^|;\s*)__Host-oshaberi=([a-f0-9]{64})(?:;|$)/)?.[1];ensure(t,'ログインしてください',401);
 const a=await db.prepare('SELECT a.*,s.id session_id FROM sessions s JOIN accounts a ON a.id=s.account_id WHERE s.token_hash=? AND s.expires_at>? AND s.revoked=0 AND a.active=1').bind(await hash(t),Date.now()).first();ensure(a,'ログインしてください',401);return a;
}
function guardian(a){ensure(a.role==='guardian','おうちの人の画面から操作してください',403);}
async function manages(db,a,child){guardian(a);ensure(await db.prepare('SELECT 1 FROM guardian_children g JOIN accounts c ON c.id=g.child_id WHERE g.guardian_id=? AND g.child_id=? AND c.active=1').bind(a.id,child).first(),'この子の操作はできません',403);}
async function settings(db,child){return db.prepare('SELECT * FROM child_settings WHERE child_id=?').bind(child).first();}
async function childAvailable(db,child,checkTime=true){const a=await db.prepare('SELECT active FROM accounts WHERE id=?').bind(child).first(),s=await settings(db,child);ensure(a?.active&&s&&!s.paused,'今はおやすみ中です',403);if(checkTime)ensure(timeAllowed(s),'おうちの人が決めた時間に、またひらいてね',403);return s;}
async function conversation(db,a,id,requestedChild){
 const f=await db.prepare('SELECT * FROM friendships WHERE id=?').bind(id).first();ensure(f&&f.state==='active'&&f.left_approved&&f.right_approved,'このトークは利用できません',403);
 let child=a.id;if(a.role==='guardian'){child=requestedChild;await manages(db,a,child);}ensure([f.left_child,f.right_child].includes(child),'このトークは利用できません',403);
 ensure(!await db.prepare('SELECT 1 FROM blocks WHERE (child_id=? AND peer_id=?) OR (child_id=? AND peer_id=?)').bind(f.left_child,f.right_child,f.right_child,f.left_child).first(),'このトークは利用できません',403);
 if(a.role==='child'){await childAvailable(db,f.left_child,false);await childAvailable(db,f.right_child,false);await childAvailable(db,child,true);}else{const active=await db.prepare('SELECT COUNT(*) n FROM accounts WHERE id IN(?,?) AND active=1').bind(f.left_child,f.right_child).first();ensure(active.n===2,'このトークは利用できません',403);}
 return {f,child,peer:child===f.left_child?f.right_child:f.left_child};
}
async function ownFriend(db,a,id){guardian(a);const f=await db.prepare('SELECT * FROM friendships WHERE id=?').bind(id).first();ensure(f,'トークがありません',404);const mine=await db.prepare('SELECT child_id FROM guardian_children WHERE guardian_id=? AND child_id IN(?,?)').bind(a.id,f.left_child,f.right_child).first();ensure(mine,'このトークの操作はできません',403);return {f,child:mine.child_id,peer:mine.child_id===f.left_child?f.right_child:f.left_child};}
async function newSession(db,a,device){const raw=token(),id=uid();await db.batch([db.prepare('INSERT INTO sessions VALUES(?,?,?,?,?,?,0)').bind(id,await hash(raw),a.id,alias(device||'この端末'),Date.now(),Date.now()+30*DAY),record(db,a.id,'session.created',id)]);return json({ok:true},200,{'Set-Cookie':cookie(raw)});}
async function requirePassword(db,a,password){ensure(typeof password==='string'&&password.length<=128&&same(await passwordHash(password,a.salt),a.password_hash),'パスワードを確認してください',403);}
async function mediaAccess(db,a,m,requestedChild){
 ensure(m&&m.expires_at>Date.now()&&!['rejected','disabled','deleted'].includes(m.status),'画像を表示できません',404);
 if(a.id===m.owner_id){await childAvailable(db,a.id);return;}
 if(a.role==='guardian'&&await db.prepare('SELECT 1 FROM guardian_children WHERE guardian_id=? AND child_id=?').bind(a.id,m.owner_id).first())return;
 ensure(m.status==='approved','画像を表示できません',404);
 const candidates=await all(db.prepare('SELECT DISTINCT friendship_id FROM messages WHERE media_id=? AND created_at>?').bind(m.id,Date.now()-180*DAY));
 for(const c of candidates){try{await conversation(db,a,c.friendship_id,requestedChild);return;}catch{}}
 ensure(false,'画像を表示できません',404);
}
async function route(req,env){
 await privateTestGate(req,env);
 const db=env.CHAT_DB,u=new URL(req.url),p=u.pathname,method=req.method;
 ensure(env.RELEASE_ENABLED==='1','開発準備中です。本番公開はまだ行っていません。',503);
 if(!p.startsWith('/api/')&&!p.startsWith('/media/'))return env.ASSETS.fetch(req);
 if(!['GET','HEAD'].includes(method))ensure(req.headers.get('Origin')===u.origin&&req.headers.get('X-Oshaberi')==='1','この画面から操作してください',403);
 if(p==='/api/info'&&method==='GET')return json({consent_version:CONSENT_VERSION,registration:env.REGISTRATION_ENABLED==='1',invitations:env.INVITATIONS_ENABLED==='1',stamps:STANDARD_STAMPS});
 if(['/api/register','/api/login','/api/recover'].includes(p)&&method==='POST'){
  ensure(env.RATE_SECRET,'初期設定を確認してください',503);
  const ip=req.headers.get('CF-Connecting-IP')||'local';await quota(db,'auth-ip:'+await hash(env.RATE_SECRET+ip),20,15*60000);
  const b=await body(req),login=credentials(b);await quota(db,'auth-account:'+await hash(login),10,15*60000);
  if(p==='/api/register'){
   ensure(env.REGISTRATION_ENABLED==='1','今は新規登録を受け付けていません',403);
   let validInvite=false;if(env.INVITATIONS_ENABLED==='1'&&typeof b.invite==='string')validInvite=!!await db.prepare('SELECT 1 FROM invitations WHERE token_hash=? AND used=0 AND revoked=0 AND expires_at>?').bind(await hash(b.invite),Date.now()).first();
   ensure(validInvite||(env.BOOTSTRAP_CODE&&same(b.setup_code,env.BOOTSTRAP_CODE)),'保護者用の招待か登録用コードを確認してください',403);
   ensure(b.agree===true&&b.consent_version===CONSENT_VERSION,'保護者の同意と説明の確認が必要です');
   const id=uid(),family=uid(),salt=token(),recovery=token();
   try{await db.batch([db.prepare("INSERT INTO accounts VALUES(?,?,?,'guardian',?,?,?,1,?,NULL)").bind(id,login,alias(b.alias),salt,await passwordHash(b.password,salt),await hash(recovery),Date.now()),db.prepare('INSERT INTO families VALUES(?,?)').bind(family,Date.now()),db.prepare('INSERT INTO family_guardians VALUES(?,?)').bind(family,id),db.prepare('INSERT INTO consent_events VALUES(?,?,NULL,?,?)').bind(uid(),id,CONSENT_VERSION,Date.now()),record(db,id,'guardian.registered',family)]);}catch{ensure(false,'登録できません。別のログインIDをお試しください',409);}
   return json({ok:true,recovery_code:recovery,family_id:family});
  }
  const a=await db.prepare('SELECT * FROM accounts WHERE login=? AND active=1').bind(login).first();
  if(p==='/api/recover'){
   ensure(a?.role==='guardian'&&typeof b.recovery_code==='string'&&same(await hash(b.recovery_code),a.recovery_hash),'復旧情報を確認してください',403);
   const salt=token(),recovery=token();const results=await db.batch([db.prepare('UPDATE accounts SET salt=?,password_hash=?,recovery_hash=? WHERE id=? AND recovery_hash=?').bind(salt,await passwordHash(b.password,salt),await hash(recovery),a.id,a.recovery_hash),db.prepare('UPDATE sessions SET revoked=1 WHERE account_id=?').bind(a.id),record(db,a.id,'account.recovered',a.id)]);ensure(results[0].meta.changes===1,'復旧情報を確認してください',409);return json({ok:true,recovery_code:recovery});
  }
  const calculated=await passwordHash(b.password,a?.salt||'invalid-login-timing-salt');ensure(a&&same(calculated,a.password_hash),'ログインIDかパスワードを確認してください',401);return newSession(db,a,b.device);
 }
 const a=await auth(req,db);await quota(db,'api:'+a.id,240,60000);
 if(p==='/api/logout'&&method==='POST'){await db.prepare('UPDATE sessions SET revoked=1 WHERE id=?').bind(a.session_id).run();return json({ok:true},200,{'Set-Cookie':cookie('',0)});}
 if(p==='/api/me'&&method==='GET'){
  const children=a.role==='guardian'?await all(db.prepare('SELECT c.id,c.alias,g.family_id,s.* FROM guardian_children g JOIN accounts c ON c.id=g.child_id JOIN child_settings s ON s.child_id=c.id WHERE g.guardian_id=? AND c.active=1').bind(a.id)):[];
  const s=a.role==='child'?await settings(db,a.id):null;
  return json({id:a.id,alias:a.alias,role:a.role,children,settings:s,available:a.role==='guardian'||timeAllowed(s),consent_version:CONSENT_VERSION,stamps:STANDARD_STAMPS});
 }
 if(p==='/api/children'&&method==='POST'){
  guardian(a);const b=await body(req),login=credentials(b);ensure(b.agree===true&&b.consent_version===CONSENT_VERSION,'子どもの見守りと情報の扱いへの同意が必要です');
  // A guardian's first child's family is reused. For a new guardian, a private family is allocated here.
  const family=(await db.prepare('SELECT family_id FROM family_guardians WHERE guardian_id=? LIMIT 1').bind(a.id).first())?.family_id;ensure(family,'家庭の設定を確認してください',409);
  const id=uid(),salt=token();try{await db.batch([db.prepare('INSERT OR IGNORE INTO families VALUES(?,?)').bind(family,Date.now()),db.prepare("INSERT INTO accounts VALUES(?,?,?,'child',?,?,NULL,1,?,NULL)").bind(id,login,alias(b.alias),salt,await passwordHash(b.password,salt),Date.now()),db.prepare('INSERT INTO guardian_children VALUES(?,?,?)').bind(a.id,id,family),db.prepare('INSERT INTO child_settings(child_id) VALUES(?)').bind(id),db.prepare('INSERT INTO consent_events VALUES(?,?,?,?,?)').bind(uid(),a.id,id,CONSENT_VERSION,Date.now()),record(db,a.id,'child.created',id)]);}catch{ensure(false,'登録できません。別のログインIDをお試しください',409);}return json({id});
 }
 let m=p.match(/^\/api\/children\/([^/]+)(?:\/(settings|password|sessions|delete))?$/);
 if(m){
  const child=m[1],op=m[2];await manages(db,a,child);
  if(op==='settings'&&method==='PUT'){
   const b=await body(req);ensure(typeof b.paused==='boolean'&&typeof b.photos_enabled==='boolean'&&Number.isInteger(b.revision),'設定を確認してください');
   let valid=false;try{new Intl.DateTimeFormat('en',{timeZone:b.timezone}).format();valid=true;}catch{}ensure(valid,'タイムゾーンを確認してください');const schedule=validateSchedule(b.schedule);
   const r=await db.batch([db.prepare('UPDATE child_settings SET paused=?,photos_enabled=?,timezone=?,schedule_json=?,revision=revision+1 WHERE child_id=? AND revision=?').bind(+b.paused,+b.photos_enabled,b.timezone,JSON.stringify(schedule),child,b.revision),record(db,a.id,'child.settings',child)]);ensure(r[0].meta.changes===1,'設定が変わりました。読み直してください',409);return json({ok:true});
  }
  if(op==='password'&&method==='POST'){const b=await body(req);credentials({login:'dummy',password:b.password});const salt=token();await db.batch([db.prepare('UPDATE accounts SET salt=?,password_hash=? WHERE id=?').bind(salt,await passwordHash(b.password,salt),child),db.prepare('UPDATE sessions SET revoked=1 WHERE account_id=?').bind(child),record(db,a.id,'child.password_reset',child)]);return json({ok:true});}
  if(op==='sessions'&&method==='GET')return json({sessions:await all(db.prepare('SELECT id,device,created_at,expires_at,revoked FROM sessions WHERE account_id=? ORDER BY created_at DESC').bind(child))});
  if(op==='sessions'&&method==='DELETE'){const b=await body(req);await db.batch([db.prepare('UPDATE sessions SET revoked=1 WHERE id=? AND account_id=?').bind(b.session_id,child),record(db,a.id,'session.revoked',b.session_id)]);return json({ok:true});}
  if(op==='delete'&&method==='POST'){const b=await body(req);ensure(b.confirm===true,'削除の確認が必要です');await requirePassword(db,a,b.password);await eraseChild(db,a,child);return json({ok:true});}
 }
 if(p==='/api/sessions'&&method==='GET')return json({sessions:await all(db.prepare('SELECT id,device,created_at,expires_at,revoked FROM sessions WHERE account_id=? ORDER BY created_at DESC').bind(a.id))});
 if(p==='/api/sessions'&&method==='DELETE'){const b=await body(req);await db.prepare('UPDATE sessions SET revoked=1 WHERE id=? AND account_id=?').bind(b.session_id,a.id).run();return json({ok:true});}
 if(p==='/api/account/delete'&&method==='POST'){
  guardian(a);const b=await body(req);ensure(b.confirm===true,'削除の確認が必要です');await requirePassword(db,a,b.password);const children=await all(db.prepare('SELECT child_id FROM guardian_children WHERE guardian_id=?').bind(a.id));
  for(const c of children)await eraseChild(db,a,c.child_id);
  await db.batch([db.prepare("UPDATE accounts SET active=0,alias='削除した利用者',login=?,salt='',password_hash='',recovery_hash=NULL,deleted_at=? WHERE id=?").bind('deleted-'+a.id,Date.now(),a.id),db.prepare('UPDATE sessions SET revoked=1 WHERE account_id=?').bind(a.id),db.prepare('UPDATE invitations SET revoked=1 WHERE issuer_id=?').bind(a.id),record(db,a.id,'account.deleted',a.id)]);return json({ok:true},200,{'Set-Cookie':cookie('',0)});
 }
 if(p==='/api/invitations'&&method==='GET'){guardian(a);return json({invitations:await all(db.prepare('SELECT id,child_id,expires_at,used,revoked,created_at FROM invitations WHERE issuer_id=? ORDER BY created_at DESC').bind(a.id))});}
 if(p==='/api/invitations'&&method==='POST'){
  ensure(env.INVITATIONS_ENABLED==='1','招待はまだ有効になっていません',403);const b=await body(req);await manages(db,a,b.child_id);await quota(db,'invites:'+a.id,5,DAY);const id=uid(),raw=token();await db.batch([db.prepare('INSERT INTO invitations VALUES(?,?,?,?,?,0,0,?)').bind(id,await hash(raw),a.id,b.child_id,Date.now()+3*DAY,Date.now()),record(db,a.id,'invitation.created',id)]);return json({id,url:u.origin+'/#invite='+raw,expires_in_days:3});
 }
 m=p.match(/^\/api\/invitations\/([^/]+)$/);if(m&&method==='DELETE'){guardian(a);await db.batch([db.prepare('UPDATE invitations SET revoked=1 WHERE id=? AND issuer_id=?').bind(m[1],a.id),record(db,a.id,'invitation.revoked',m[1])]);return json({ok:true});}
 if(p==='/api/invitations/accept'&&method==='POST'){
  ensure(env.INVITATIONS_ENABLED==='1','招待はまだ有効になっていません',403);const b=await body(req);await manages(db,a,b.child_id);ensure(typeof b.token==='string'&&b.token.length===64,'招待を確認してください');
  const invite=await db.prepare('SELECT i.* FROM invitations i JOIN accounts c ON c.id=i.child_id JOIN accounts g ON g.id=i.issuer_id WHERE token_hash=? AND used=0 AND revoked=0 AND expires_at>? AND c.active=1 AND g.active=1').bind(await hash(b.token),Date.now()).first();ensure(invite&&invite.issuer_id!==a.id&&invite.child_id!==b.child_id,'招待を確認してください',409);
  const pair=[invite.child_id,b.child_id].sort();ensure(!await db.prepare('SELECT 1 FROM blocks WHERE (child_id=? AND peer_id=?) OR (child_id=? AND peer_id=?)').bind(pair[0],pair[1],pair[1],pair[0]).first(),'友達登録できません',403);
  const id=uid();try{const r=await db.batch([db.prepare('UPDATE invitations SET used=1 WHERE id=? AND used=0 AND revoked=0 AND expires_at>?').bind(invite.id,Date.now()),db.prepare("INSERT INTO friendships SELECT ?,?,?,0,0,'pending',? WHERE changes()=1").bind(id,...pair,Date.now()),record(db,a.id,'friendship.requested',id)]);ensure(r[0].meta.changes===1&&r[1].meta.changes===1,'使用済みの招待です',409);}catch{ensure(false,'招待は使用済み、または友達登録済みです',409);}return json({id,state:'pending'});
 }
 if(p==='/api/friends'&&method==='GET'){
  const child=a.role==='child'?a.id:u.searchParams.get('child');if(a.role==='guardian')await manages(db,a,child);else await childAvailable(db,child);
  const friends=await all(db.prepare(`SELECT f.*,p.alias peer_alias FROM friendships f JOIN accounts p ON p.id=CASE WHEN f.left_child=? THEN f.right_child ELSE f.left_child END WHERE ? IN(f.left_child,f.right_child) AND p.active=1 ORDER BY f.created_at DESC`).bind(child,child));
  for(const f of friends){f.unread=f.state==='active'?(await db.prepare('SELECT COUNT(*) n FROM messages WHERE friendship_id=? AND author_id<>? AND seq>COALESCE((SELECT last_seq FROM read_cursors WHERE friendship_id=? AND child_id=?),0) AND created_at>?').bind(f.id,child,f.id,child,Date.now()-180*DAY).first()).n:0;delete f.left_child;delete f.right_child;}
  return json({friends});
 }
 m=p.match(/^\/api\/friends\/([^/]+)\/(approve|end|block|unblock)$/);if(m&&method==='POST'){
  const {f,child,peer}=await ownFriend(db,a,m[1]),op=m[2];
  if(op==='approve'){
   ensure(f.state==='pending','承認待ちではありません',409);const col=child===f.left_child?'left_approved':'right_approved';
   await db.batch([db.prepare(`UPDATE friendships SET ${col}=1 WHERE id=? AND state='pending' AND NOT EXISTS(SELECT 1 FROM blocks WHERE (child_id=? AND peer_id=?) OR (child_id=? AND peer_id=?))`).bind(f.id,child,peer,peer,child),db.prepare("UPDATE friendships SET state='active' WHERE id=? AND state='pending' AND left_approved=1 AND right_approved=1").bind(f.id),record(db,a.id,'friendship.approved',f.id)]);
  }else if(op==='unblock'){await db.batch([db.prepare('DELETE FROM blocks WHERE child_id=? AND peer_id=?').bind(child,peer),record(db,a.id,'friendship.unblocked',f.id)]);}
  else{await db.batch([db.prepare('UPDATE friendships SET state=? WHERE id=?').bind(op==='block'?'blocked':'ended',f.id),...(op==='block'?[db.prepare('INSERT OR IGNORE INTO blocks VALUES(?,?,?)').bind(child,peer,Date.now())]:[]),record(db,a.id,'friendship.'+op,f.id)]);}
  return json({ok:true});
 }
 m=p.match(/^\/api\/talks\/([^/]+)\/(messages|read)$/);if(m){
  const {f,child,peer}=await conversation(db,a,m[1],u.searchParams.get('child'));
  if(m[2]==='messages'&&method==='GET'){
   const after=Number(u.searchParams.get('after')||0),before=Number(u.searchParams.get('before')||Number.MAX_SAFE_INTEGER);ensure(Number.isSafeInteger(after)&&after>=0&&Number.isSafeInteger(before)&&before>0,'表示位置を確認してください');
   const messages=await all(db.prepare(`SELECT m.seq,m.id,m.author_id,m.kind,m.text,m.media_id,m.created_at,CASE WHEN m.media_id IS NOT NULL THEN x.status END media_status FROM messages m LEFT JOIN media x ON x.id=m.media_id WHERE m.friendship_id=? AND m.seq>? AND m.seq<? AND m.created_at>? ORDER BY m.seq ${after?'ASC':'DESC'} LIMIT 60`).bind(f.id,after,before,Date.now()-180*DAY));if(!after)messages.reverse();
   const read=(await db.prepare('SELECT last_seq FROM read_cursors WHERE friendship_id=? AND child_id=?').bind(f.id,peer).first())?.last_seq||0;
   return json({messages,peer_read_seq:read,child_id:child});
  }
  if(m[2]==='read'&&method==='POST'){
   ensure(a.role==='child','既読は子ども本人だけが更新できます',403);const b=await body(req);ensure(Number.isSafeInteger(b.seq)&&b.seq>=0,'既読位置を確認してください');const row=await db.prepare('SELECT seq FROM messages WHERE friendship_id=? AND seq=?').bind(f.id,b.seq).first();ensure(row,'表示したメッセージを確認してください');
   await db.prepare('INSERT INTO read_cursors VALUES(?,?,?) ON CONFLICT(friendship_id,child_id) DO UPDATE SET last_seq=MAX(last_seq,excluded.last_seq)').bind(f.id,a.id,b.seq).run();return json({ok:true});
  }
  if(m[2]==='messages'&&method==='POST'){
   ensure(a.role==='child','送信は子どもの画面から行います',403);const b=await body(req);ensure(['text','standard','stamp'].includes(b.kind),'送信内容を確認してください');ensure(typeof b.nonce==='string'&&/^[a-zA-Z0-9_-]{16,80}$/.test(b.nonce),'送信番号を確認してください');
   const text=b.kind==='text'?b.text:b.kind==='standard'?b.stamp:'';
   ensure(b.kind!=='text'||(typeof text==='string'&&text.trim().length>0&&text.length<=2000),'メッセージは1〜2000文字です');ensure(b.kind!=='standard'||Object.hasOwn(STANDARD_STAMPS,text),'スタンプを選んでください');
   const media=b.kind==='stamp'?String(b.media_id||''):null,ph=await hash(JSON.stringify({friendship:f.id,kind:b.kind,text,media}));
   const old=await db.prepare('SELECT id,payload_hash FROM messages WHERE author_id=? AND nonce=?').bind(a.id,b.nonce).first();if(old){ensure(old.payload_hash===ph,'送信番号が重複しています',409);return json({id:old.id,replayed:true});}
   await quota(db,'message-minute:'+a.id,12,60000);await quota(db,'message-day:'+a.id,240,DAY);
   const id=uid();try{await db.prepare('INSERT INTO messages(id,friendship_id,author_id,nonce,payload_hash,kind,text,media_id,created_at) VALUES(?,?,?,?,?,?,?,?,?)').bind(id,f.id,a.id,b.nonce,ph,b.kind,text,media,Date.now()).run();}catch(e){const prior=await db.prepare('SELECT id,payload_hash FROM messages WHERE author_id=? AND nonce=?').bind(a.id,b.nonce).first();if(prior?.payload_hash===ph)return json({id:prior.id,replayed:true});ensure(false,'送信できません。友達・スタンプの状態を確認してください',409);}return json({id});
  }
 }
 if(p==='/api/media'&&method==='POST'){
  ensure(a.role==='child','子どもの画面から登録してください',403);const s=await childAvailable(db,a.id),kind=u.searchParams.get('kind');ensure(['photo','stamp'].includes(kind),'画像の種類を確認してください');
  const friendship=u.searchParams.get('talk');if(kind==='photo'){ensure(s.photos_enabled,'写真はおうちの人が許可してから使えます',403);await conversation(db,a,friendship);}
  await quota(db,'upload:'+a.id,10,DAY);ensure(req.headers.get('Content-Type')===PIXEL_MIME,'写真を選び直してください。安全な画像データに変換します');
  const normalized=pixelsToPng(await limitedBytes(req,MAX_PIXEL_BYTES),kind),id=uid(),key='private/'+uid()+'.png',label=alias(u.searchParams.get('label')||'画像');
  // Pending row precedes R2 write; failure remains inaccessible and is collected by cleanup.
  await db.prepare('INSERT INTO media VALUES(?,?,?,?,?,?,\'pending\',?,?,?,?,?,NULL)').bind(id,a.id,kind==='photo'?friendship:null,kind,label,key,normalized.width,normalized.height,normalized.bytes.length,Date.now(),Date.now()+3*DAY).run();
  try{await env.CHAT_FILES.put(key,normalized.bytes,{httpMetadata:{contentType:'image/png'}});}catch{await db.prepare("UPDATE media SET status='deleted',expires_at=0 WHERE id=?").bind(id).run();ensure(false,'画像を保存できませんでした。もう一度ためしてください',503);}return json({id,status:'pending'});
 }
 if(p==='/api/media'&&method==='GET'){
  const child=a.role==='child'?a.id:u.searchParams.get('child');if(a.role==='guardian')await manages(db,a,child);else await childAvailable(db,child);
  return json({media:await all(db.prepare("SELECT id,kind,label,status,friendship_id,width,height,created_at,expires_at FROM media WHERE owner_id=? AND expires_at>? AND status NOT IN('deleted') ORDER BY created_at DESC LIMIT 100").bind(child,Date.now()))});
 }
 m=p.match(/^\/api\/media\/([^/]+)\/(approve|reject|disable)$/);if(m&&method==='POST'){
  const media=await db.prepare('SELECT * FROM media WHERE id=?').bind(m[1]).first();ensure(media,'画像がありません',404);await manages(db,a,media.owner_id);const op=m[2];
  ensure(media.expires_at>Date.now(),'承認期限が過ぎています',409);
  if(op==='approve'){
   ensure(media.status==='pending'||media.status==='approved','承認できません',409);if(media.status==='approved')return json({ok:true,replayed:true});
   await childAvailable(db,media.owner_id,false);ensure(await env.CHAT_FILES.head(media.object_key),'画像を保存できていません',409);
   if(media.kind==='photo'){await conversation(db,a,media.friendship_id,media.owner_id);ensure((await settings(db,media.owner_id)).photos_enabled,'写真送信は無効です',403);}
   const expire=media.kind==='stamp'?253402300799000:Date.now()+180*DAY,id=uid(),statements=[db.prepare("UPDATE media SET status='approved',reviewer_id=?,expires_at=? WHERE id=? AND status='pending'").bind(a.id,expire,media.id)];
   if(media.kind==='photo')statements.push(db.prepare("INSERT OR IGNORE INTO messages(id,friendship_id,author_id,nonce,payload_hash,kind,text,media_id,created_at) SELECT ?,?,?,?,?,'photo','',?,? WHERE (SELECT status FROM media WHERE id=?)='approved'").bind(id,media.friendship_id,media.owner_id,'photo-'+media.id,await hash(media.id),media.id,Date.now(),media.id));
   statements.push(record(db,a.id,'media.approved',media.id));await db.batch(statements);
  }else{await db.batch([db.prepare('UPDATE media SET status=?,reviewer_id=?,expires_at=0 WHERE id=?').bind(op==='reject'?'rejected':'disabled',a.id,media.id),record(db,a.id,'media.'+op,media.id)]);await env.CHAT_FILES.delete(media.object_key);}
  return json({ok:true});
 }
 m=p.match(/^\/media\/([^/]+)$/);if(m&&method==='GET'){
  const media=await db.prepare('SELECT * FROM media WHERE id=?').bind(m[1]).first();await mediaAccess(db,a,media,u.searchParams.get('child'));
  const object=await env.CHAT_FILES.get(media.object_key);ensure(object,'画像がありません',404);return new Response(object.body,{headers:{'Content-Type':object.httpMetadata?.contentType==='image/png'?'image/png':'image/jpeg','Cache-Control':'private, no-store','Content-Disposition':'inline; filename="image.jpg"','X-Content-Type-Options':'nosniff'}});
 }
 if(p==='/api/audit'&&method==='GET'){guardian(a);return json({events:await all(db.prepare('SELECT action,target_id,created_at FROM audit_events WHERE actor_id=? ORDER BY created_at DESC LIMIT 100').bind(a.id))});}
 return json({error:'見つかりません'},404);
}
async function eraseChild(db,a,child){
 await db.batch([db.prepare("UPDATE accounts SET active=0,alias='削除した利用者',login=?,salt='',password_hash='',recovery_hash=NULL,deleted_at=? WHERE id=?").bind('deleted-'+child,Date.now(),child),db.prepare('UPDATE sessions SET revoked=1 WHERE account_id=?').bind(child),db.prepare("UPDATE child_settings SET paused=1,photos_enabled=0,schedule_json='[[],[],[],[],[],[],[]]',revision=revision+1 WHERE child_id=?").bind(child),db.prepare("UPDATE friendships SET state='ended' WHERE ? IN(left_child,right_child)").bind(child),db.prepare("UPDATE messages SET kind='removed',text='',media_id=NULL WHERE author_id=?").bind(child),db.prepare("UPDATE media SET status='deleted',expires_at=0 WHERE owner_id=?").bind(child),db.prepare('UPDATE invitations SET revoked=1 WHERE child_id=?').bind(child),record(db,a.id,'child.deleted',child)]);
}
export async function cleanup(env){
 const db=env.CHAT_DB,now=Date.now();const media=await all(db.prepare('SELECT id,object_key FROM media WHERE expires_at<=? LIMIT 100').bind(now));
 for(const m of media){await env.CHAT_FILES.delete(m.object_key);await db.batch([db.prepare("UPDATE messages SET kind='removed',text='',media_id=NULL WHERE media_id=?").bind(m.id),db.prepare('DELETE FROM media WHERE id=?').bind(m.id)]);}
 await db.batch([db.prepare('DELETE FROM messages WHERE created_at<?').bind(now-180*DAY),db.prepare('DELETE FROM sessions WHERE expires_at<? OR revoked=1').bind(now),db.prepare('DELETE FROM rate_buckets WHERE expires_at<?').bind(now),db.prepare('DELETE FROM audit_events WHERE created_at<?').bind(now-90*DAY),db.prepare('DELETE FROM invitations WHERE expires_at<?').bind(now-7*DAY)]);
 const dead="SELECT id FROM accounts WHERE active=0 AND deleted_at<="+(now-180*DAY);
 const stale=`SELECT f.id FROM friendships f WHERE (f.left_child IN(${dead}) OR f.right_child IN(${dead})) AND NOT EXISTS(SELECT 1 FROM messages m WHERE m.friendship_id=f.id) AND NOT EXISTS(SELECT 1 FROM media m WHERE m.friendship_id=f.id)`;
 await db.batch([
  db.prepare(`DELETE FROM read_cursors WHERE friendship_id IN(${stale})`),
  db.prepare(`DELETE FROM friendships WHERE id IN(${stale})`),
  db.prepare(`DELETE FROM blocks WHERE child_id IN(${dead}) OR peer_id IN(${dead})`),
  db.prepare(`DELETE FROM guardian_children WHERE guardian_id IN(${dead}) OR child_id IN(${dead})`),
  db.prepare(`DELETE FROM family_guardians WHERE guardian_id IN(${dead})`),
  db.prepare(`DELETE FROM consent_events WHERE guardian_id IN(${dead}) OR child_id IN(${dead})`),
  db.prepare(`DELETE FROM child_settings WHERE child_id IN(${dead})`),
  db.prepare(`DELETE FROM accounts WHERE id IN(${dead}) AND NOT EXISTS(SELECT 1 FROM friendships f WHERE accounts.id IN(f.left_child,f.right_child)) AND NOT EXISTS(SELECT 1 FROM media m WHERE accounts.id IN(m.owner_id,m.reviewer_id)) AND NOT EXISTS(SELECT 1 FROM messages m WHERE m.author_id=accounts.id) AND NOT EXISTS(SELECT 1 FROM sessions s WHERE s.account_id=accounts.id) AND NOT EXISTS(SELECT 1 FROM invitations i WHERE accounts.id IN(i.issuer_id,i.child_id)) AND NOT EXISTS(SELECT 1 FROM read_cursors c WHERE c.child_id=accounts.id)`),
  db.prepare('DELETE FROM families WHERE NOT EXISTS(SELECT 1 FROM family_guardians g WHERE g.family_id=families.id) AND NOT EXISTS(SELECT 1 FROM guardian_children c WHERE c.family_id=families.id)')
 ]);

}
export default {
 async fetch(req,env){let response;try{response=await route(req,env);}catch(e){const status=Number(e.status)||500;if(status>=500)console.error({event:'oshaberi_request_failed',reason:'internal'});response=json({error:status>=500?'保存できませんでした。もう一度ためしてください':e.message},status);}const headers=new Headers(response.headers);if(env.PRIVATE_TEST_MODE==='1'){headers.set('Cache-Control','no-store');headers.set('X-Robots-Tag','noindex, nofollow, noarchive');}headers.set('X-Content-Type-Options','nosniff');headers.set('Referrer-Policy','no-referrer');headers.set('X-Frame-Options','DENY');headers.set('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' blob: data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");headers.set('Permissions-Policy','camera=(), microphone=(), geolocation=()');return new Response(response.body,{status:response.status,headers});},
 async scheduled(_event,env){if(env.RELEASE_ENABLED==='1')await cleanup(env);}
};
