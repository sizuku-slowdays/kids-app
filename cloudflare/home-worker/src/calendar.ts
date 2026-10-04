type CalendarEnv = Env & { CALENDAR_SERVICE?: Fetcher };
type IdentityUser = { id: string; display_name: string; login_name: string; platform_role: string };
export async function calendarIdentity(env: CalendarEnv, user: IdentityUser, request: Request) {
  const groups = (await env.DB.prepare("SELECT g.id,g.name,m.role FROM groups g JOIN memberships m ON m.group_id=g.id WHERE g.kind='household' AND m.user_id=?").bind(user.id).all()).results;
  const group = new URL(request.url).searchParams.get('group');
  if (group && !groups.some(g => g.id === group)) return Response.json({error:'この家庭のカレンダーは利用できません'},{status:403});
  const admin = user.platform_role === 'operator';
  const users = admin && group ? (await env.DB.prepare("SELECT u.id,u.login_name,u.display_name,u.platform_role FROM users u JOIN memberships m ON m.user_id=u.id WHERE m.group_id=? AND u.active=1").bind(group).all()).results : [];
  return Response.json({user:{id:user.id,display_name:user.display_name,login_name:user.login_name},admin,groups,users},{headers:{'Cache-Control':'private, no-store'}});
}
export async function calendarProxy(env: CalendarEnv, request: Request, userId: string) {
  const expected=request.headers.get('X-Calendar-User');
  if(expected && expected!==userId) return Response.json({error:'HOMEの利用者が変わりました。カレンダーを開き直してください',identity_changed:true},{status:409,headers:{'Cache-Control':'private, no-store'}});
  if (!env.CALENDAR_SERVICE) return Response.json({error:'カレンダーのHOME連携設定を準備しています'},{status:503});
  const url = new URL(request.url);
  const path = url.pathname.slice('/api/calendar'.length) || '/home/status';
  // Only calendar routes. Never proxy arbitrary URLs, karada, login or OAuth.
  if (!/^\/(?:home\/(?:status|link|remove-initial-calendar)|family\/(?:me|members(?:\/[^/]+)?)|users|me|calendars(?:\/[^/]+)?|events(?:\/[^/]+)?|google-events|integrations\/google-ics|holidays|notifications\/resync)$/.test(path)) return Response.json({error:'見つかりません'},{status:404});
  const upstream = new URL('https://calendar.internal'+path+url.search);
  const outgoing = new Headers({'X-Home-Calendar':'1'});
  // Strip the caller's legacy token and all impersonation headers.
  for (const key of ['cookie','content-type','origin']) { const value=request.headers.get(key); if(value)outgoing.set(key,value); }
  // Protect the rollout too: an older calendar Worker served mama's ICS to every user.
  if(path==='/google-events' || path==='/integrations/google-ics'){
    const check=await env.CALENDAR_SERVICE.fetch(new Request('https://calendar.internal/home/status',{headers:outgoing}));
    if(!check.ok)return Response.json({error:'カレンダーの本人連携を確認できません'},{status:check.status,headers:{'Cache-Control':'private, no-store'}});
    const state=await check.json() as {privacy_version?:string;profile?:{google_id?:string}};
    if(!state.profile)return Response.json({error:'本人連携を設定してください'},{status:409,headers:{'Cache-Control':'private, no-store'}});
    if(state.privacy_version!=='20261005-owner-ics' && state.profile.google_id!=='family:mama'){
      if(request.method!=='GET')return Response.json({error:'このGoogle連携は本人だけが変更できます'},{status:403,headers:{'Cache-Control':'private, no-store'}});
      return Response.json(path==='/google-events'?[]:{configured:false,count:0},{headers:{'Cache-Control':'private, no-store'}});
    }
  }
  const response = await env.CALENDAR_SERVICE.fetch(new Request(upstream,{method:request.method,headers:outgoing,body:['GET','HEAD'].includes(request.method)?null:request.body,redirect:'manual'}));
  if(path==='/home/status' && response.status===404) return Response.json({error:'カレンダーWorkerのHOME連携コードの反映が必要です。管理者がCloudflareで設定するまで、本人の予定は表示しません'},{status:503,headers:{'Cache-Control':'private, no-store'}});
  const headers = new Headers({'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'});
  return new Response(response.body,{status:response.status,headers});
}
