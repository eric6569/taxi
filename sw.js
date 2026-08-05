// sw.js 自己的版本號，跟 index.html 的 .app-version 是兩件獨立的事、無需對應。
// 因為 fetch 是 network-first（見下方），單純改 index.html 內容不需要動這裡，
// 連網使用者一樣會拿到最新內容。只有這個檔案本身的 install/activate/fetch
// 邏輯有改動時，才需要遞增這個版本號，讓瀏覽器發現 sw.js 內容變了、
// 進而安裝新版 Service Worker。
const CACHE_NAME = 'taxi-meter-sw-v1';
const CACHED_URLS = ['./index.html', './manifest.json', './icon.svg'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(CACHED_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(names =>
      Promise.all(names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n)))
    )
  );
  self.clients.claim();
});

// network-first：有網路一律拿最新的並更新快取；離線時退回快取版本。
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const resClone = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(e.request, resClone));
        return res;
      })
      .catch(() => caches.match(e.request).then(cached => cached || caches.match('./index.html')))
  );
});
