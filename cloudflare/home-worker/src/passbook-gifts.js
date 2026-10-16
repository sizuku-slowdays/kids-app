const rows=async s=>(await s.all()).results;
const reply=(v,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'private, no-store'}});
function check(ok,message,status=400){if(!ok)throw Object.assign(Error(message),{status});}
const token=v=>typeof v==='string'&&/^[a-zA-Z0-9_-]{8,100}$/.test(v);
export async function giftAccess(db,h,user){
 const guardian=!!await db.prepare('SELECT 1 FROM passbook_gift_guardians WHERE household_id=? AND user_id=?').bind(h,user).first();
 const sender=!!await db.prepare('SELECT 1 FROM passbook_gift_senders WHERE household_id=? AND user_id=?').bind(h,user).first();
 const pending=guardian?await db.prepare("SELECT COUNT(*) total FROM passbook_gift_requests WHERE household_id=? AND status='pending' AND sender_id<>?").bind(h,user).first():null;
 return {guardian,sender,pending:pending?.total||0};
}
const visibleRequest=`SELECT r.id,r.child_id,c.display_name child_name,r.sender_id,r.sender_name,r.kind,r.destination,r.amount,r.reason,r.status,r.requested_at,r.resolved_at,r.resolved_by,u.display_name resolver_name FROM passbook_gift_requests r JOIN children c ON c.id=r.child_id AND c.household_id=r.household_id LEFT JOIN users u ON u.id=r.resolved_by`;
export async function giftsRoute(request,env,h,user,readBody){
 const db=env.DB,url=new URL(request.url),path=url.pathname.slice('/api/passbook/gifts'.length),method=request.method,access=await giftAccess(db,h,user);
 if(path===''&&method==='GET'){
  const before=url.searchParams.get('before');if(before)check(await db.prepare(`SELECT 1 FROM passbook_gift_requests r JOIN children c ON c.id=r.child_id WHERE r.id=? AND r.household_id=? AND (?=1 OR r.sender_id=? OR (r.status='approved' AND c.user_id=?))`).bind(before,h,access.guardian?1:0,user,user).first(),'履歴の位置を確認してください',403);
  const status=url.searchParams.get('status');check(!status||['pending','approved','rejected'].includes(status),'状態を確認してください');
  const records=await rows(db.prepare(visibleRequest+` WHERE r.household_id=? AND (?=1 OR r.sender_id=? OR (r.status='approved' AND c.user_id=?)) AND (? IS NULL OR r.status=?) AND (? IS NULL OR (r.requested_at,r.id)<(SELECT requested_at,id FROM passbook_gift_requests WHERE id=? AND household_id=?)) ORDER BY r.requested_at DESC,r.id DESC LIMIT 51`).bind(h,access.guardian?1:0,user,user,status,status,before,before,h));
  const targets=access.sender?await rows(db.prepare(`SELECT c.id,u.display_name,GROUP_CONCAT(p.code) codes FROM children c JOIN users u ON u.id=c.user_id AND u.active=1 JOIN memberships m ON m.group_id=c.household_id AND m.user_id=c.user_id JOIN passbook_accounts a ON a.child_id=c.id AND a.household_id=c.household_id JOIN passbook_units p ON p.id=a.unit_id AND p.household_id=a.household_id AND p.active=1 WHERE c.household_id=? AND ((p.kind='points' AND p.code='chores') OR (p.kind='money' AND p.code='cash')) AND NOT EXISTS(SELECT 1 FROM passbook_gift_permissions x WHERE x.household_id=c.household_id AND x.child_id=c.id AND x.sender_id=? AND x.enabled=0) AND EXISTS(SELECT 1 FROM passbook_gift_guardians WHERE household_id=c.household_id AND user_id<>?) GROUP BY c.id,u.display_name ORDER BY c.rowid`).bind(h,user,user)):[];
  const notifications=access.guardian?await rows(db.prepare("SELECT n.id,n.status,n.last_reason FROM passbook_gift_notifications n JOIN passbook_gift_requests r ON r.id=n.gift_id WHERE n.household_id=? AND n.recipient_id=? AND r.status='pending' AND n.status IN ('pending','sending') ORDER BY n.created_at LIMIT 20").bind(h,user)):[];
  const viewer=await db.prepare('SELECT display_name FROM users WHERE id=?').bind(user).first();
  return {access,viewer,targets,records:records.slice(0,50).map(r=>({...r,can_resolve:access.guardian&&r.sender_id!==user})),next_before:records.length>50?records[49].id:null,notifications};
 }
 if(path==='/permissions'&&method==='GET'){
  check(access.guardian,'許可設定は保護者だけが行えます',403);
  return {children:await rows(db.prepare('SELECT id,display_name FROM children WHERE household_id=? ORDER BY rowid').bind(h)),senders:await rows(db.prepare('SELECT s.user_id id,u.display_name FROM passbook_gift_senders s JOIN users u ON u.id=s.user_id WHERE s.household_id=? ORDER BY u.created_at,u.id').bind(h)),permissions:await rows(db.prepare('SELECT child_id,sender_id,enabled FROM passbook_gift_permissions WHERE household_id=?').bind(h))};
 }
 if(path==='/retry'&&method==='POST'){check(access.guardian,'通知の再送は保護者だけが行えます',403);await deliverGiftNotifications(env,h,user);return {ok:true};}
 const b=await readBody(request),now=Math.floor(Date.now()/1000);
 check(!['sender_id','sender_name','requested_by','resolved_by','household_id','user_id','owner'].some(k=>k in b),'本人と家庭はHOMEから確認します');
 if(path==='/permissions'&&method==='PUT'){
  check(access.guardian,'許可設定は保護者だけが行えます',403);check(typeof b.child_id==='string'&&typeof b.target_sender_id==='string'&&typeof b.enabled==='boolean','許可設定を確認してください');
  await db.prepare('INSERT INTO passbook_gift_permissions VALUES(?,?,?,?,?,?) ON CONFLICT(household_id,child_id,sender_id) DO UPDATE SET enabled=excluded.enabled,changed_by=excluded.changed_by,updated_at=excluded.updated_at').bind(h,b.child_id,b.target_sender_id,b.enabled?1:0,user,now).run();return {ok:true};
 }
 if(path===''&&method==='POST'){
  check(access.sender,'大人の家族アカウントから申請してください。区分はHOMEの家族設定で保護者が確認できます',403);
  check(typeof b.child_id==='string'&&['points','cash'].includes(b.kind)&&Number.isSafeInteger(b.amount)&&b.amount>=1&&b.amount<=10000000,'子ども・種類・数量を確認してください');
  check(typeof b.reason==='string'&&b.reason.trim().length>0&&b.reason.length<=500,'理由は1〜500文字で入力してください');check(token(b.event_id),'申請IDを確認してください');
  const previous=await db.prepare('SELECT id,child_id,kind,amount,reason FROM passbook_gift_requests WHERE household_id=? AND sender_id=? AND event_id=?').bind(h,user,b.event_id).first();
  if(previous){check(previous.child_id===b.child_id&&previous.kind===b.kind&&previous.amount===b.amount&&previous.reason===b.reason.trim(),'同じ申請IDの内容が異なります',409);await deliverGiftNotifications(env,h);return {ok:true,id:previous.id,replayed:true};}
  const account=await db.prepare('SELECT a.id FROM passbook_accounts a JOIN passbook_units u ON u.id=a.unit_id AND u.household_id=a.household_id WHERE a.household_id=? AND a.child_id=? AND u.code=? AND u.active=1').bind(h,b.child_id,b.kind==='cash'?'cash':'chores').first();check(account,'プレゼントできる通帳が見つかりません',403);
  const id=crypto.randomUUID();
  await db.prepare("INSERT INTO passbook_gift_requests(id,household_id,child_id,account_id,sender_id,sender_name,kind,destination,amount,reason,event_id,requested_at) SELECT ?,?,?,?,?,display_name,?,?,?,?,?,? FROM users WHERE id=? ON CONFLICT(household_id,sender_id,event_id) DO NOTHING").bind(id,h,b.child_id,account.id,user,b.kind,b.kind==='cash'?'bank':'points',b.amount,b.reason.trim(),b.event_id,now,user).run();
  const saved=await db.prepare('SELECT id,child_id,kind,amount,reason FROM passbook_gift_requests WHERE household_id=? AND sender_id=? AND event_id=?').bind(h,user,b.event_id).first();
  check(saved&&saved.child_id===b.child_id&&saved.kind===b.kind&&saved.amount===b.amount&&saved.reason===b.reason.trim(),'同じ申請IDの内容が異なります',409);
  await deliverGiftNotifications(env,h);return {ok:true,id:saved.id};
 }
 const match=path.match(/^\/([a-zA-Z0-9_-]{1,100})$/);
 if(match&&method==='PUT'){
  check(access.guardian,'承認・却下は対象の家庭の保護者だけが行えます',403);check(['approved','rejected'].includes(b.status),'承認または却下を選んでください');
  const r=await db.prepare('SELECT sender_id,status FROM passbook_gift_requests WHERE id=? AND household_id=?').bind(match[1],h).first();check(r,'申請が見つかりません',404);check(r.sender_id!==user,'自分の申請は別の保護者が承認してください',403);
  if(r.status!=='pending'){check(r.status===b.status,'この申請は別の内容で処理済みです',409);return {ok:true,replayed:true};}
  await db.prepare("UPDATE passbook_gift_requests SET status=?,resolved_by=?,resolved_at=? WHERE id=? AND household_id=? AND status='pending'").bind(b.status,user,now,match[1],h).run();
  const saved=await db.prepare('SELECT status FROM passbook_gift_requests WHERE id=? AND household_id=?').bind(match[1],h).first();check(saved?.status===b.status,'この申請は別の内容で処理済みです',409);return {ok:true};
 }
 throw Object.assign(Error('見つかりません'),{status:404});
}
export async function giftNotificationCheck(request,env){
 const url=new URL(request.url);if(url.hostname!=='notification-auth.internal'||request.method!=='GET')return reply({allowed:false},404);
 const n=await env.DB.prepare("SELECT n.*,r.sender_id,r.child_id FROM passbook_gift_notifications n JOIN passbook_gift_requests r ON r.id=n.gift_id AND r.household_id=n.household_id WHERE n.id=? AND n.status IN ('pending','sending') AND r.status='pending'").bind(url.searchParams.get('delivery')||'').first();
 if(!n||n.recipient_id===n.sender_id||!(await giftAccess(env.DB,n.household_id,n.recipient_id)).guardian)return reply({allowed:false});
 if(!await env.DB.prepare("SELECT 1 FROM apps a JOIN group_apps ga ON ga.app_id=a.id WHERE a.id='notification' AND a.enabled=1 AND ga.group_id=?").bind(n.household_id).first())return reply({allowed:false});
 const user=url.searchParams.get('user'),session=url.searchParams.get('session');
 if(user||session){if(user!==n.recipient_id||!await env.DB.prepare('SELECT 1 FROM sessions WHERE id=? AND user_id=? AND revoked_at IS NULL AND expires_at>?').bind(session||'',user,Math.floor(Date.now()/1000)).first())return reply({allowed:false});}
 return reply({allowed:true,recipient_id:n.recipient_id,title:'🎁 ごほうびプレゼント',body:'プレゼントの申請が届きました。つうちょうで確認してください。',url:'/wagaya/apps/passbook/?gifts=1',tag:'gift-'+n.id});
}
export async function deliverGiftNotifications(env,household=null,recipient=null){
 if(!env.NOTIFICATION_SERVICE)return;
 const now=Math.floor(Date.now()/1000);
 const pending=await rows(env.DB.prepare("SELECT id FROM passbook_gift_notifications WHERE (? IS NULL OR household_id=?) AND (? IS NULL OR recipient_id=?) AND status IN ('pending','sending') AND lease_until<? ORDER BY created_at,id LIMIT 20").bind(household,household,recipient,recipient,now));
 for(const n of pending){
  const claimed=await env.DB.prepare("UPDATE passbook_gift_notifications SET status='sending',lease_until=?,attempts=attempts+1 WHERE id=? AND status IN ('pending','sending') AND lease_until<? RETURNING id").bind(now+90,n.id,now).first();if(!claimed)continue;
  let status='pending',reason='connection';
  try{const response=await env.NOTIFICATION_SERVICE.fetch(new Request('https://notification.internal/internal/passbook-gifts/send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({delivery_id:n.id})}));const data=await response.json();if(response.ok&&data.ok&&data.protocol==='gift-v1'){status=data.cancelled?'cancelled':data.delivered>0?'sent':'pending';reason=data.cancelled?'permission_or_status_changed':data.delivered>0?'delivered':'no_registered_device';}else reason=response.status===404?'notification_worker_update_required':'upstream';}catch{}
  await env.DB.prepare('UPDATE passbook_gift_notifications SET status=?,lease_until=0,last_reason=?,delivered_at=? WHERE id=?').bind(status,reason,status==='sent'?Math.floor(Date.now()/1000):null,n.id).run();
 }
}
