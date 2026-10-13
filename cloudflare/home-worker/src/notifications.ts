type NotificationEnv = Env & { NOTIFICATION_SERVICE?: Fetcher; CALENDAR_SERVICE?: Fetcher };
export async function notificationProxy(request: Request, env: NotificationEnv) {
  if (!env.NOTIFICATION_SERVICE) return Response.json({error:'通知Workerの接続を準備しています'},{status:503});
  const path=new URL(request.url).pathname.slice('/api/notifications'.length);
  if (!['/subscribe','/unsubscribe','/vapid-public-key'].includes(path)) return new Response(null,{status:404});
  const headers=new Headers(request.headers);headers.delete('X-App-Password');
  const response=await env.NOTIFICATION_SERVICE.fetch(new Request('https://notification.internal/api/home'+path,{method:request.method,headers,body:['GET','HEAD'].includes(request.method)?undefined:request.body}));
  if(response.status>=500){
    let detail='';try{const data=await response.clone().json() as {detail?:string};detail=String(data.detail||'');}catch{}
    const reason=/no such table/i.test(detail)?'missing_table':/no such column/i.test(detail)?'missing_column':/constraint/i.test(detail)?'database_constraint':/D1|SQLITE/i.test(detail)?'database_error':/fetch|network/i.test(detail)?'service_connection':'upstream_error';
    console.error({event:'home_notification_proxy_failed',operation:path,status:response.status,reason});
  }
  const resultHeaders=new Headers(response.headers);resultHeaders.set('Cache-Control','private, no-store');return new Response(response.body,{status:response.status,headers:resultHeaders});
}
export async function notificationCheck(request: Request, env: NotificationEnv, identity: unknown) {
  if (!env.CALENDAR_SERVICE) return new Response(null,{status:503});
  const url=new URL(request.url),headers={'Content-Type':'application/json'};
  return env.CALENDAR_SERVICE.fetch(new Request('https://calendar-notifications.internal/internal/notification-check',{method:'POST',headers,body:JSON.stringify({event_id:url.searchParams.get('event'),identity})}));
}
