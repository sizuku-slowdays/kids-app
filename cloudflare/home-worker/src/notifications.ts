type NotificationEnv = Env & { NOTIFICATION_SERVICE?: Fetcher; CALENDAR_SERVICE?: Fetcher };
export async function notificationProxy(request: Request, env: NotificationEnv) {
  if (!env.NOTIFICATION_SERVICE) return Response.json({error:'通知Workerの接続を準備しています'},{status:503});
  const path=new URL(request.url).pathname.slice('/api/notifications'.length);
  if (!['/subscribe','/unsubscribe','/vapid-public-key'].includes(path)) return new Response(null,{status:404});
  const headers=new Headers(request.headers);headers.delete('X-App-Password');
  const response=await env.NOTIFICATION_SERVICE.fetch(new Request('https://notification.internal/api/home'+path,{method:request.method,headers,body:['GET','HEAD'].includes(request.method)?undefined:request.body}));
  const resultHeaders=new Headers(response.headers);resultHeaders.set('Cache-Control','private, no-store');return new Response(response.body,{status:response.status,headers:resultHeaders});
}
export async function notificationCheck(request: Request, env: NotificationEnv, identity: unknown) {
  if (!env.CALENDAR_SERVICE) return new Response(null,{status:503});
  const url=new URL(request.url),headers={'Content-Type':'application/json'};
  return env.CALENDAR_SERVICE.fetch(new Request('https://calendar-notifications.internal/internal/notification-check',{method:'POST',headers,body:JSON.stringify({event_id:url.searchParams.get('event'),identity})}));
}
