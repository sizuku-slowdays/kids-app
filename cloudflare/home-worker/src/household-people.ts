type PeopleEnv={DB:D1Database};
export function peopleCheck(ok:unknown,message:string,status=400):asserts ok {if(!ok)throw Object.assign(new Error(message),{status});}
export const peopleReply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
export async function householdPeople(env:PeopleEnv,userId:string,household:string){
 const membership=await env.DB.prepare("SELECT m.role,g.name,u.platform_role FROM memberships m JOIN groups g ON g.id=m.group_id JOIN users u ON u.id=m.user_id WHERE m.group_id=? AND m.user_id=? AND g.kind='household' AND u.active=1").bind(household,userId).first<{role:string;name:string;platform_role:string}>();
 peopleCheck(membership,'この家庭は利用できません',403);
 const rows=(await env.DB.prepare("SELECT u.id,u.display_name,COALESCE(n.nickname,'') nickname,COALESCE(a.age_kind,'unknown') age_kind,m.role FROM memberships m JOIN users u ON u.id=m.user_id LEFT JOIN home_member_attributes a ON a.group_id=m.group_id AND a.user_id=u.id LEFT JOIN home_person_names n ON n.user_id=u.id WHERE m.group_id=? AND u.active=1 ORDER BY u.created_at,u.id").bind(household).all<{id:string;display_name:string;nickname:string;age_kind:string;role:string}>()).results;
 return {membership,rows,configure:rows.find(u=>u.id===userId)?.age_kind!=='child'&&['owner','admin'].includes(membership.role),adult:rows.find(u=>u.id===userId)?.age_kind==='adult'};
}
export async function peopleRoute(request:Request,env:PeopleEnv,userId:string,readBody:(r:Request)=>Promise<Record<string,unknown>>){
 try {
 const url=new URL(request.url),household=url.searchParams.get('household')||'';
 const ctx=await householdPeople(env,userId,household);
 if(request.method==='GET')return peopleReply({household,name:ctx.membership.name,users:ctx.rows,configure:ctx.configure});
 peopleCheck(request.method==='PUT','この操作はできません',405);
 const data=await readBody(request),id=data.user_id;
 peopleCheck(typeof id==='string'&&ctx.rows.some(r=>r.id===id),'この家庭の利用者を選んでください');
 const now=new Date().toISOString();
 if(data.age_kind!==undefined){peopleCheck(ctx.configure,'家族の管理者だけが区分を設定できます',403);peopleCheck(['adult','child','unknown'].includes(String(data.age_kind)),'区分を確認してください');await env.DB.prepare('INSERT INTO home_member_attributes VALUES(?,?,?,?,?) ON CONFLICT(group_id,user_id) DO UPDATE SET age_kind=excluded.age_kind,changed_by=excluded.changed_by,updated_at=excluded.updated_at').bind(household,id,data.age_kind,userId,now).run();}
 if(data.nickname!==undefined){peopleCheck(id===userId||ctx.configure,'表示名を変更できません',403);peopleCheck(typeof data.nickname==='string'&&data.nickname.length<=60,'表示名は60文字までです');await env.DB.prepare('INSERT INTO home_person_names VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET nickname=excluded.nickname,updated_at=excluded.updated_at').bind(id,data.nickname.trim(),now).run();}
 return peopleReply({ok:true});
 }catch(e){return peopleReply({error:e instanceof Error?e.message:'処理できませんでした'},Number((e as {status?:number}).status)||500);}
}

