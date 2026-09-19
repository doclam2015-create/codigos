const CACHE = "codigos-v3";
const ASSETS = ["./","./index.html","./idb.js","./decode-core.js","./worker.js","./core.js","./codes.js","./scan.js","./create.js","./lib.js","./batch.js","./tools.js","./manifest.json","./icon.png","./icon-192.png","./icon-180.png","./vendor/qrcode.min.js","./vendor/jsbarcode.min.js","./vendor/zxing.min.js","./vendor/bwip.min.js"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS))); self.skipWaiting(); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== CACHE).map(x => caches.delete(x))))); self.clients.claim(); });
self.addEventListener("fetch", e => {
  if (new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.match(e.request, {ignoreSearch: true}).then(c => c || fetch(e.request)));
});
