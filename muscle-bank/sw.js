const CACHE='muscle-bank-v1-20261002';
const FILES=['./','./index.html','./style.css','./app.js','./model.js','./storage.js','./config.js','./icon.svg','./manifest.webmanifest'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('muscle-bank-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{const url=new URL(e.request.url);if(url.pathname.includes('/api/'))return;if(e.request.method!=='GET'||url.origin!==location.origin||!url.pathname.startsWith(new URL(self.registration.scope).pathname))return;e.respondWith(fetch(e.request).then(r=>{if(r.ok){const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy))}return r}).catch(()=>caches.match(e.request)))});
