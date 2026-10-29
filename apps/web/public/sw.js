// Only immutable PUBLIC install assets may enter this cache. Never cache HTML,
// Next RSC responses, authenticated pages, API calls, or financial data.
const CACHE='owl-public-v1';
const PUBLIC=['/offline.html','/icon.svg','/icons/owl-192.png','/icons/owl-512.png','/icons/owl-maskable.png'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(PUBLIC)));self.skipWaiting();});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('owl-public-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(url.origin!==self.location.origin||event.request.method!=='GET')return;
 if(PUBLIC.includes(url.pathname)&&!url.search){event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request)));return;}
 if(event.request.mode==='navigate')event.respondWith(fetch(event.request).catch(()=>caches.match('/offline.html')));
});
