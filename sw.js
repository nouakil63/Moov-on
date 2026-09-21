/* Static presentation assets only. No remote APIs or user media are cached. */
const CACHE='moovon-presentation-v16';
const FILES=['./','index.html','admin.html','app.css','demo-shell.css','stories.css','admin.css','app.js','demo-shell.js','stories.js','admin.js','demo-store.js','energy.js','platform-store.js','icon.svg','manifest.webmanifest'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('moovon-presentation-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=='GET'||url.origin!==self.location.origin)return;
  const allowed=FILES.map(file=>new URL(file,self.registration.scope).pathname);
  if(!allowed.includes(url.pathname))return;
  const key=url.origin+url.pathname;
  event.respondWith(fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(key,copy)));}return response;}).catch(()=>caches.match(key)));
});
