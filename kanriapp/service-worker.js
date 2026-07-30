const CACHE_NAME =
  'family-calendar-v2';

const ASSETS = [
  '/kanriapp/calendar.html'
];

// インストール
self.addEventListener(
  'install',
  event => {
    event.waitUntil(
      caches
        .open(CACHE_NAME)
        .then(
          cache =>
            cache.addAll(ASSETS)
        )
    );

    self.skipWaiting();
  }
);

// 古いキャッシュを削除
self.addEventListener(
  'activate',
  event => {
    event.waitUntil(
      caches
        .keys()
        .then(
          keys =>
            Promise.all(
              keys
                .filter(
                  key =>
                    key !==
                    CACHE_NAME
                )
                .map(
                  key =>
                    caches.delete(key)
                )
            )
        )
    );

    self.clients.claim();
  }
);

// ネットワーク優先
// 通信失敗時はキャッシュを使う
self.addEventListener(
  'fetch',
  event => {
    if (
      event.request.method !==
      'GET'
    ) {
      return;
    }

    event.respondWith(
      fetch(event.request)
        .then(res => {
          const clone =
            res.clone();

          caches
            .open(CACHE_NAME)
            .then(
              cache =>
                cache.put(
                  event.request,
                  clone
                )
            );

          return res;
        })
        .catch(
          () =>
            caches.match(
              event.request
            )
        )
    );
  }
);

// Push通知受信
// 通知そのものは通知センター側から届く
self.addEventListener(
  'push',
  event => {
    const data =
      event.data
        ? event.data.json()
        : {};

    const title =
      data.title ||
      '家族カレンダー';

    const options = {
      body:
        data.body || '',
      icon:
        '/kanriapp/calendar.png',
      badge:
        '/kanriapp/calendar.png',
      data: {
        url:
          data.url ||
          '/kanriapp/calendar.html'
      },
      tag: data.tag,
      vibrate: [
        200,
        100,
        200
      ]
    };

    event.waitUntil(
      self.registration
        .showNotification(
          title,
          options
        )
    );
  }
);

// 通知をタップしたとき
self.addEventListener(
  'notificationclick',
  event => {
    event.notification.close();

    const target =
      event.notification
        .data?.url ||
      '/kanriapp/calendar.html';

    event.waitUntil(
      clients
        .matchAll({
          type: 'window',
          includeUncontrolled: true
        })
        .then(clientList => {
          for (
            const client of
            clientList
          ) {
            if (
              client.url.includes(
                '/kanriapp/calendar.html'
              ) &&
              'focus' in client
            ) {
              if (
                'navigate' in client
              ) {
                client.navigate(
                  target
                );
              }

              return client.focus();
            }
          }

          return clients.openWindow(
            target
          );
        })
    );
  }
);

/*
以前のSCHEDULE_NOTIFICATIONと
setTimeoutによる端末内予約は廃止。

iPhoneがWebアプリを停止しても、
通知センターのサーバー予約から
Push通知が送信される。
*/
