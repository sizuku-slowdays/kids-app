import {digest,randomToken} from './security';
type Person={id:string;platform_role:string};
type FamilyEnv={DB:D1Database;CALENDAR_SERVICE?:Fetcher;FAMILY_INVITES_ENABLED?:string};
type Invitation={id:string;purpose:string;group_id:string|null;expires_at:number;use_limit:number;use_count:number;revoked_at:number|null};
const response=(v:unknown,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'}});
export class FamilyFailure extends Error {constructor(message:string,public status=400){super(message);}}
function check(ok:unknown,message:string,status=400):asserts ok{if(!ok)throw new FamilyFailure(message,status);}
function text(v:unknown,max=80){check(typeof v==='string'&&v.trim().length>0&&v.trim().length<=max,'入力内容を確認してください');return v.trim();}
const safeApps=new Set(['calendar','notification','family-tree','daily-kanji','good-deeds','school-prep','dining-prices']);
export async function familyReady(env:FamilyEnv){
 if(env.FAMILY_INVITES_ENABLED!=='1'||!env.CALENDAR_SERVICE)return false;
 try{const r=await env.CALENDAR_SERVICE.fetch(new Request('https://calendar.internal/internal/family-readiness'));return r.ok&&(await r.json() as {protocol?:string}).protocol==='multi-family-v1';}catch{return false;}
}
async function eligible(db:D1Database,user:string){return !!await db.prepare("SELECT 1 FROM users WHERE id=? AND active=1 AND NOT EXISTS(SELECT 1 FROM children WHERE user_id=?) AND NOT EXISTS(SELECT 1 FROM home_member_attributes WHERE user_id=? AND age_kind='child')").bind(user,user,user).first();}
async function manages(db:D1Database,user:string,group:string){return !!await db.prepare("SELECT 1 FROM memberships WHERE group_id=? AND user_id=? AND role IN ('owner','admin')").bind(group,user).first()&&await eligible(db,user);}
async function invite(db:D1Database,token:unknown){
 const value=text(token,128);check(/^[0-9a-f]{64}$/.test(value),'招待URLを確認してください',403);
 return db.prepare('SELECT id,purpose,group_id,expires_at,use_limit,use_count,revoked_at FROM family_invitations WHERE token_hash=?').bind(await digest(value)).first<Invitation>();
}
export async function previewFamilyInvite(env:FamilyEnv,token:unknown){const i=await invite(env.DB,token);check(i&&!i.revoked_at&&i.expires_at>Math.floor(Date.now()/1000)&&i.use_count<i.use_limit,'招待は無効・使用済み・期限切れのいずれかです',403);return {purpose:i.purpose,expires_at:i.expires_at};}
export async function redeemFamilyInvite(db:D1Database,token:unknown,user:string,familyName:unknown){
 const i=await invite(db,token);check(i,'招待を確認してください',403);
 const prior=await db.prepare('SELECT id,created_group_id FROM family_invitation_uses WHERE invitation_id=? AND user_id=?').bind(i.id,user).first<{id:string;created_group_id:string|null}>();
 if(prior){const group=prior.created_group_id||i.group_id;check(await db.prepare('SELECT 1 FROM memberships WHERE group_id=? AND user_id=?').bind(group,user).first(),'以前に参加した招待です。再参加には新しい招待が必要です',409);return {group_id:group,already_accepted:true};}
 const groupName=i.purpose==='create_family'?text(familyName,60):'',newGroup=i.purpose==='create_family'?crypto.randomUUID():null;
 await db.prepare('INSERT INTO family_invitation_uses VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),i.id,user,newGroup,groupName,Math.floor(Date.now()/1000)).run();
 return {group_id:newGroup||i.group_id,already_accepted:false};
}
export async function registerFamilyInvite(env:FamilyEnv,data:Record<string,unknown>,credentials:{id:string;login:string;display:string;salt:string;hash:string;iterations:number}){
 check(await familyReady(env),'カレンダーの複数家庭対応を反映するまで、招待からの参加を停止しています',503);
 const i=await invite(env.DB,data.invitation);check(i,'招待を確認してください',403);
 const name=i.purpose==='create_family'?text(data.household_name,60):'',newGroup=i.purpose==='create_family'?crypto.randomUUID():null;
 const now=Math.floor(Date.now()/1000),c=credentials;
 await env.DB.batch([
  env.DB.prepare('INSERT INTO users(id,login_name,display_name,password_salt,password_hash,password_iterations,created_at) VALUES(?,?,?,?,?,?,?)').bind(c.id,c.login,c.display,c.salt,c.hash,c.iterations,now),
  env.DB.prepare('INSERT INTO family_invitation_uses VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),i.id,c.id,newGroup,name,now)
 ]);
 return {user_id:c.id,group_id:newGroup||i.group_id};
}
export async function familiesRoute(request:Request,env:FamilyEnv,user:Person,readBody:(r:Request)=>Promise<any>){
 try{
 const url=new URL(request.url),path=url.pathname.slice('/api/families'.length),method=request.method,now=Math.floor(Date.now()/1000);
 const groups=(await env.DB.prepare("SELECT g.id,g.name,g.kind,m.role,COALESCE(w.mode,'legacy') workspace_mode FROM groups g JOIN memberships m ON m.group_id=g.id LEFT JOIN family_workspaces w ON w.group_id=g.id WHERE m.user_id=? ORDER BY g.created_at,g.id").bind(user.id).all<{id:string;name:string;kind:string;role:string;workspace_mode:string}>()).results;
 if(path===''&&method==='GET')return response({groups,can_create_family_invite:user.platform_role==='operator'&&await eligible(env.DB,user.id),ready:await familyReady(env)});
 const groupMatch=path.match(/^\/groups\/([^/]+)(?:\/(members|apps|leave))?$/);
 if(groupMatch&&method==='GET'){
  const g=groups.find(g=>g.id===groupMatch[1]);check(g,'このグループは利用できません',403);
  const members=(await env.DB.prepare('SELECT u.id,u.display_name,m.role FROM memberships m JOIN users u ON u.id=m.user_id AND u.active=1 WHERE m.group_id=? ORDER BY u.created_at,u.id').bind(g.id).all()).results;
  const apps=(await env.DB.prepare('SELECT app_id FROM group_apps WHERE group_id=? ORDER BY app_id').bind(g.id).all()).results;
  return response({group:g,members,app_ids:apps.map(a=>a.app_id),app_choices:g.kind==='household'?[...safeApps]:['calendar'],can_manage:await manages(env.DB,user.id,g.id)});
 }
 if(path==='/inspect'&&method==='POST'){
  const data=await readBody(request);await previewFamilyInvite(env,data.invitation);const i=await invite(env.DB,data.invitation);const group=i?.group_id?await env.DB.prepare('SELECT name,kind FROM groups WHERE id=?').bind(i.group_id).first():null;return response({purpose:i?.purpose,group});
 }
 if(path==='/invitations'&&method==='GET'){
  if(!await eligible(env.DB,user.id))return response([]);
  const result=await env.DB.prepare("SELECT i.id,i.purpose,i.group_id,i.expires_at,i.created_at,i.use_limit,i.use_count,i.revoked_at FROM family_invitations i WHERE (i.purpose='create_family' AND i.issued_by=? AND ?='operator') OR EXISTS(SELECT 1 FROM memberships m WHERE m.group_id=i.group_id AND m.user_id=? AND m.role IN ('owner','admin')) ORDER BY i.created_at DESC LIMIT 100").bind(user.id,user.platform_role,user.id).all();
  return response(result.results);
 }
 // Reads work during staged rollout; no invitation, group creation or acceptance before calendar-v2.
 check(await familyReady(env),'カレンダーWorkerの複数家庭対応を先に反映してください。現在の家族はそのまま利用できます',503);
 check(await eligible(env.DB,user.id),'この操作は大人の管理者または招待された大人が行えます',403);
 if(path==='/groups'&&method==='POST'){
  const data=await readBody(request);check(data.kind==='sharing','新しい家庭は「新規ファミリー作成の招待」から作成してください');
  check(groups.some(g=>g.kind==='household'&&['owner','admin'].includes(g.role)),'所属ファミリーの管理者だけが共有グループを作れます',403);
  const id=crypto.randomUUID(),name=text(data.name,60);
  await env.DB.batch([
   env.DB.prepare("INSERT INTO groups SELECT ?,?,'sharing',?,? WHERE EXISTS(SELECT 1 FROM memberships m JOIN groups g ON g.id=m.group_id WHERE m.user_id=? AND m.role IN ('owner','admin') AND g.kind='household')").bind(id,name,user.id,now,user.id),
   env.DB.prepare("INSERT INTO memberships VALUES(?,?,'owner')").bind(id,user.id),
   env.DB.prepare("INSERT INTO family_workspaces VALUES(?,'restricted',?)").bind(id,now),
   env.DB.prepare("INSERT INTO group_apps SELECT ?,id FROM apps WHERE id='calendar' AND enabled=1").bind(id),
   env.DB.prepare("INSERT INTO family_audit_events VALUES(?,?,?,'group.created',NULL,?)").bind(crypto.randomUUID(),user.id,id,now)
  ]);return response({id},201);
 }
 if(path==='/invitations'&&method==='POST'){
  const data=await readBody(request),purpose=text(data.purpose),gid=purpose==='create_family'?null:text(data.group_id);
  check(['create_family','join_family','join_sharing'].includes(purpose),'招待の種類を確認してください');
  if(purpose==='create_family')check(user.platform_role==='operator','新規家庭の開始許可は運営管理者が発行します',403);
  else check(gid&&await manages(env.DB,user.id,gid),'このグループへ招待できません',403);
  const days=data.days??7;check(Number.isInteger(days)&&days>=1&&days<=14,'有効期限は1〜14日です');
  const token=randomToken(),id=crypto.randomUUID();await env.DB.batch([
   env.DB.prepare('INSERT INTO family_invitations(id,token_hash,purpose,group_id,issued_by,expires_at,created_at,use_limit) VALUES(?,?,?,?,?,?,?,1)').bind(id,await digest(token),purpose,gid,user.id,now+days*86400,now),
   env.DB.prepare("INSERT INTO family_audit_events VALUES(?,?,?,'invitation.issued',?,?)").bind(crypto.randomUUID(),user.id,gid,id,now)
  ]);return response({id,token,purpose,expires_at:now+days*86400,use_limit:1},201);
 }
 if(path==='/accept'&&method==='POST'){
  const data=await readBody(request);check(data.confirmed===true,'参加するグループを確認してください');
  return response(await redeemFamilyInvite(env.DB,data.invitation,user.id,data.household_name));
 }
 const revoke=path.match(/^\/invitations\/([^/]+)$/);
 if(revoke&&method==='DELETE'){
  const i=await env.DB.prepare('SELECT group_id,issued_by,purpose FROM family_invitations WHERE id=?').bind(revoke[1]).first<{group_id:string;issued_by:string;purpose:string}>();
  check(i&&(i.purpose==='create_family'?i.issued_by===user.id&&user.platform_role==='operator':await manages(env.DB,user.id,i.group_id)),'この招待は取り消せません',403);
  await env.DB.batch([env.DB.prepare('UPDATE family_invitations SET revoked_at=COALESCE(revoked_at,?) WHERE id=?').bind(now,revoke[1]),env.DB.prepare("INSERT INTO family_audit_events VALUES(?,?,?,'invitation.revoked',?,?)").bind(crypto.randomUUID(),user.id,i.group_id,revoke[1],now)]);
  return response({ok:true});
 }
 if(groupMatch&&groupMatch[2]==='apps'&&method==='PUT'){
  const g=groups.find(g=>g.id===groupMatch[1]);check(g&&g.workspace_mode==='restricted'&&await manages(env.DB,user.id,g.id),'このグループの利用アプリは変更できません',403);
  const data=await readBody(request),ids=data.app_ids,allowed=g.kind==='sharing'?new Set(['calendar']):safeApps;
  check(Array.isArray(ids)&&ids.length<=30&&new Set(ids).size===ids.length&&ids.every((id:unknown)=>typeof id==='string'&&allowed.has(id)),'現在対応済みのアプリから選んでください');
  await env.DB.batch([env.DB.prepare('DELETE FROM group_apps WHERE group_id=?').bind(g.id),...ids.map((id:string)=>env.DB.prepare('INSERT INTO group_apps(group_id,app_id) VALUES(?,?)').bind(g.id,id)),env.DB.prepare("INSERT INTO family_audit_events VALUES(?,?,?,'group.apps.changed',NULL,?)").bind(crypto.randomUUID(),user.id,g.id,now)]);return response({ok:true});
 }
 if(groupMatch&&groupMatch[2]==='leave'&&method==='POST'){
  const g=groups.find(g=>g.id===groupMatch[1]);check(g&&g.kind==='sharing'&&g.role==='member','共有グループの一般メンバーが脱退できます。管理者の引き継ぎや家庭からの退会は個別確認が必要です',403);
  await env.DB.batch([env.DB.prepare("DELETE FROM memberships WHERE group_id=? AND user_id=? AND role='member'").bind(g.id,user.id),env.DB.prepare("INSERT INTO family_audit_events VALUES(?,?,?,'group.left',?,?)").bind(crypto.randomUUID(),user.id,g.id,user.id,now)]);return response({ok:true});
 }
 return response({error:'見つかりません'},404);
 }catch(error){const e=error as Error&{status?:number};return response({error:e.status?e.message:/family invitation/.test(e.message)?'招待が無効・使用済み・期限切れ、または発行者の権限が変更されています':'処理できませんでした。内容を控えて再試行してください'},e.status||(/family invitation|UNIQUE constraint/.test(e.message)?409:500));}
}
