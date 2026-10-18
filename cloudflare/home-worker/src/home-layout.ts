type LayoutEnv={DB:D1Database};
type Item={id:string;section:'favorite'|'list'|'hidden'};
const reply=(v:unknown,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
const permission=`SELECT 1 FROM users actor JOIN users target ON target.id=? AND target.active=1 WHERE actor.id=? AND actor.active=1 AND (actor.id=target.id OR (
 NOT EXISTS(SELECT 1 FROM children WHERE user_id=actor.id) AND NOT EXISTS(SELECT 1 FROM home_member_attributes WHERE user_id=actor.id AND age_kind='child') AND
 EXISTS(SELECT 1 FROM children c JOIN memberships a ON a.group_id=c.household_id AND a.user_id=actor.id AND a.role IN ('owner','admin') JOIN memberships t ON t.group_id=c.household_id AND t.user_id=c.user_id WHERE c.user_id=target.id)))`;
const appQuery=`SELECT a.id,a.name,a.icon,a.path,a.status,COALESCE(ua.visible,1) visible,COALESCE(ua.position,a.position) position FROM apps a LEFT JOIN user_apps ua ON ua.app_id=a.id AND ua.user_id=? WHERE a.enabled=1 AND ((a.access_mode='personal' AND EXISTS(SELECT 1 FROM personal_app_access pa WHERE pa.app_id=a.id AND pa.user_id=?)) OR (a.access_mode='group' AND EXISTS(SELECT 1 FROM group_apps ga JOIN memberships m ON m.group_id=ga.group_id WHERE ga.app_id=a.id AND m.user_id=?))) ORDER BY position,a.id`;
export async function homeLayoutRoute(request:Request,env:LayoutEnv,actor:string,readBody:(r:Request)=>Promise<any>){
 try{
 const target=new URL(request.url).searchParams.get('user')||actor;
 if(!await env.DB.prepare(permission).bind(target,actor).first())return reply({error:'この人のHOMEは編集できません'},403);
 if(request.method==='GET'){
  const results=await env.DB.batch<Record<string,any>>([
   env.DB.prepare(permission).bind(target,actor),env.DB.prepare(appQuery).bind(target,target,target),
   env.DB.prepare('SELECT favorite_app_ids FROM home_preferences WHERE user_id=?').bind(target),
   env.DB.prepare('SELECT revision FROM home_layout_versions WHERE user_id=?').bind(target),
   env.DB.prepare('SELECT display_name FROM users WHERE id=?').bind(target),
   env.DB.prepare(`SELECT DISTINCT c.user_id id,u.display_name FROM children c JOIN users u ON u.id=c.user_id AND u.active=1 JOIN memberships a ON a.group_id=c.household_id AND a.user_id=? AND a.role IN ('owner','admin') JOIN memberships t ON t.group_id=c.household_id AND t.user_id=c.user_id WHERE NOT EXISTS(SELECT 1 FROM children WHERE user_id=?) AND NOT EXISTS(SELECT 1 FROM home_member_attributes WHERE user_id=? AND age_kind='child') ORDER BY u.display_name`).bind(actor,actor,actor)
  ]);
  if(!results[0].results.length)return reply({error:'編集権限が変わりました'},403);
  const apps=results[1].results,favorites:string[]=results[2].results[0]?JSON.parse(String(results[2].results[0].favorite_app_ids)):apps.filter(a=>a.visible).slice(0,3).map(a=>String(a.id));
  return reply({user_id:target,display_name:results[4].results[0].display_name,revision:results[3].results[0]?.revision||0,children:results[5].results,apps:apps.map(a=>({...a,section:!a.visible?'hidden':favorites.includes(String(a.id))?'favorite':'list'}))});
 }
 if(request.method!=='PUT')return reply({error:'この操作はできません'},405);
 const data=await readBody(request),items=data.items;
 if(!Number.isSafeInteger(data.revision)||data.revision<0||typeof data.operation_id!=='string'||!/^[-a-zA-Z0-9_]{10,100}$/.test(data.operation_id)||!Array.isArray(items)||items.length>100||items.some((i:Item)=>!i||typeof i.id!=='string'||!['favorite','list','hidden'].includes(i.section))||new Set(items.map((i:Item)=>i.id)).size!==items.length)return reply({error:'HOMEの表示内容を確認してください'},400);
 const layout=JSON.stringify(items.map((i:Item)=>({id:i.id,section:i.section})));
 const prior=await env.DB.prepare('SELECT * FROM home_layout_operations WHERE id=?').bind(data.operation_id).first();
 if(prior){if(prior.actor_id!==actor||prior.user_id!==target||prior.expected_revision!==data.revision||prior.layout_json!==layout)return reply({error:'保存内容が一致しません。開き直してください'},409);return reply({ok:true,revision:data.revision+1,already_saved:true});}
 await env.DB.prepare('INSERT INTO home_layout_operations VALUES(?,?,?,?,?,?)').bind(data.operation_id,actor,target,data.revision,layout,Math.floor(Date.now()/1000)).run();
 return reply({ok:true,revision:data.revision+1});
 }catch(error){const message=String(error);return reply({error:/home layout forbidden/.test(message)?'編集権限が変わりました':/home layout conflict|home layout invalid|UNIQUE constraint/.test(message)?'別の端末で設定や利用できるアプリが変わりました。開き直して確認してください':'保存できませんでした。変更内容は画面に残っています。再試行できます'},/home layout forbidden/.test(message)?403:/home layout conflict|home layout invalid|UNIQUE constraint/.test(message)?409:500);}
}
