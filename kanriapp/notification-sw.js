/* 通知センター Service Worker
 * scope: /kanriapp/
 * - push イベントで通知を表示
 * - 通知タップで指定URLを開く（すでに開いていればそのタブへフォーカス）
 */

const SW_VERSION = 'notification-sw-v1';
const DEFAULT_ICON = '/kanriapp/notification-icon-192.png';
const DEFAULT_URL = '/kanriapp/notification-center.html';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: '🔔 おしらせ', body: event.data.text() };
    }
  }

  const title = data.title || '🔔 おしらせ';
  const options = {
    body: data.body || '',
    icon: data.icon || DEFAULT_ICON,
    badge: data.badge || DEFAULT_ICON,
    tag: data.tag || 'notification-center',
    renotify: true,
    requireInteraction: false,
    data: {
      url: data.url || DEFAULT_URL,
      rule_id: data.rule_id || null,
      sent_at: Date.now(),
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const target = new URL(
    (event.notification.data && event.notification.data.url) || DEFAULT_URL,
    self.location.origin
  ).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        // 同じページがもう開いていればそこへフォーカス
        if (client.url === target && 'focus' in client) return client.focus();
      }
      // ホーム画面Webアプリ内で開いているウィンドウがあれば、そこで遷移
      for (const client of clientList) {
        if ('navigate' in client && 'focus' in client) {
          return client.navigate(target).then((c) => (c ? c.focus() : null));
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
      return null;
    })
  );
});

// 購読が失効・更新されたとき、新しい購読をページ側と同じAPIへ送り直す
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    (async () => {
      const old = event.oldSubscription || (await self.registration.pushManager.getSubscription());
      const appServerKey = event.oldSubscription && event.oldSubscription.options
        ? event.oldSubscription.options.applicationServerKey
        : null;
      if (!appServerKey) return;

      const fresh = await self.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: appServerKey,
      });

      // ページ側に再登録を依頼する（API URL とあいことばはページのlocalStorageにあるため）
      const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of clientList) {
        client.postMessage({
          type: 'resubscribe',
          oldEndpoint: old ? old.endpoint : null,
          subscription: fresh.toJSON(),
        });
      }
    })()
  );
});
