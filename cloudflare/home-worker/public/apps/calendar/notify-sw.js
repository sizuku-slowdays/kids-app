self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('push',event=>{let d={};try{d=event.data.json();}catch{}event.waitUntil(self.registration.showNotification(d.title||'我が家のお知らせ',{body:d.body||'',tag:d.tag||'wagaya-calendar',icon:'/home-icon-192.png',data:{url:d.url||'/apps/calendar/'}}));});
self.addEventListener('notificationclick',event=>{event.notification.close();const url=new URL(event.notification.data?.url||'/apps/calendar/',self.location.origin);if(url.origin!==self.location.origin)return;event.waitUntil(self.clients.openWindow(url.href));});
