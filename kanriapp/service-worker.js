const CACHE_NAME = 'family-calendar-v1';
const ASSETS = [
  '/kids-app/calendar.html',
];

// インストール時にキャッシュ
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// 古いキャッシュを削除
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ネットワーク優先、失敗時はキャッシュ
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then(res => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});

// Push通知受信
self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || '家族カレンダー';
  const options = {
    body: data.body || '',
    icon: '/kids-app/calendar-icon-192.png',
    badge: '/kids-app/calendar-icon-192.png',
    data: { url: data.url || '/kids-app/calendar.html' },
    vibrate: [200, 100, 200],
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// 通知タップで画面を開く
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes('calendar.html') && 'focus' in client) {
          return client.focus();
        }
      }
      return clients.openWindow(event.notification.data.url);
    })
  );
});

// スケジュール通知（アプリからメッセージを受け取る）
self.addEventListener('message', event => {
  if (event.data.type === 'SCHEDULE_NOTIFICATION') {
    const { title, body, delay } = event.data;
    setTimeout(() => {
      self.registration.showNotification(title, {
        body,
        icon: '/kids-app/calendar-icon-192.png',
        badge: '/kids-app/calendar-icon-192.png',
        vibrate: [200, 100, 200],
      });
    }, delay);
  }
});
