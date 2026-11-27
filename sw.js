/* Tarefas PROAGE: app instalável. Guarda a página para abrir depressa; os dados vêm sempre do Supabase. */
const C='tarefas-v1';
const BASE=['./','./index.html','./ligacao.js','./manifest.webmanifest','./icon-192.png','./icon-512.png','./apple-touch-icon.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(BASE)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==C).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{const r=e.request;if(r.method!=='GET'||new URL(r.url).origin!==location.origin)return;
 e.respondWith(fetch(r).then(res=>{if(res.ok){const cp=res.clone();caches.open(C).then(c=>c.put(r,cp))}return res}).catch(()=>caches.match(r).then(m=>m||caches.match('./index.html'))))});
/* avisos (fase 2) */
self.addEventListener('push',e=>{let d={};try{d=e.data?e.data.json():{}}catch(x){d={corpo:e.data&&e.data.text()}}
 e.waitUntil(self.registration.showNotification(d.titulo||'Tarefas PROAGE',{body:d.corpo||'',tag:d.tag||undefined,icon:'icon-192.png',badge:'icon-192.png',data:{url:d.url||'./'}}))});
self.addEventListener('notificationclick',e=>{e.notification.close();const u=new URL((e.notification.data&&e.notification.data.url)||'./',self.registration.scope).href;
 e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(ws=>{for(const w of ws){if(w.url.startsWith(self.registration.scope)){w.focus();w.navigate&&w.navigate(u);return}}return self.clients.openWindow(u)}))});
