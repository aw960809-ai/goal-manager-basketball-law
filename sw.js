'use strict';
const VERSION='0.7.0';
const ASSET_VERSION='?v='+VERSION;
const CACHE_PREFIX='gmb-law:pwa:';
const CACHE=CACHE_PREFIX+VERSION;
const v=path=>path+ASSET_VERSION;
const APP_SHELL=[
  v('./index.html'),v('./manifest.webmanifest'),v('./release.json'),
  v('./config/app-config.js'),v('./css/tokens.css'),v('./css/app.css'),
  v('./js/core/state.js'),v('./js/core/storage.js'),v('./js/domain/goals.js'),v('./js/domain/study-logs.js'),v('./js/services/timer.js'),v('./js/domain/analytics.js'),v('./js/domain/opportunities.js'),v('./js/domain/scholarships.js'),v('./js/domain/review.js'),v('./js/system-health.js'),v('./js/pwa.js'),v('./js/app.js'),
  './data/school-calendar.json','./data/school-calendar-meta.json','./data/activities.json','./data/scholarships.json',
  v('./assets/icons/icon-192.png'),v('./assets/icons/icon-512.png'),v('./assets/icons/icon-maskable-512.png'),v('./assets/icons/apple-touch-icon.png')
];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(APP_SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith(CACHE_PREFIX)&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
async function networkFirst(request,fallbackUrl){const cache=await caches.open(CACHE);try{const fresh=await fetch(request,{cache:'no-store'});if(fresh.ok)cache.put(request,fresh.clone());return fresh}catch(_){return(await cache.match(request))||(fallbackUrl?await cache.match(fallbackUrl):null)||Response.error()}}
async function cacheFirst(request){const cache=await caches.open(CACHE);const hit=await cache.match(request);if(hit)return hit;const fresh=await fetch(request,{cache:'no-store'});if(fresh.ok)cache.put(request,fresh.clone());return fresh}
self.addEventListener('fetch',event=>{if(event.request.method!=='GET')return;const url=new URL(event.request.url);if(url.origin!==self.location.origin)return;
  if(event.request.mode==='navigate'){event.respondWith(networkFirst(event.request,v('./index.html')));return}
  if(/\/(?:release\.json|data\/(?:activities|scholarships|school-calendar|school-calendar-meta)\.json)$/.test(url.pathname)){event.respondWith(networkFirst(event.request));return}
  if(/\.(?:js|css|webmanifest|json)$/.test(url.pathname)){event.respondWith(networkFirst(event.request));return}
  event.respondWith(cacheFirst(event.request));
});
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting();if(event.data?.type==='GET_VERSION'&&event.ports?.[0])event.ports[0].postMessage({version:VERSION,cache:CACHE})});
