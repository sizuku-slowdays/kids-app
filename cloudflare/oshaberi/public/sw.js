// Installability only. Never cache messages, API responses, pictures, sessions or invitations.
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
// No push, notificationclick, fetch cache, background sync or external calls.
