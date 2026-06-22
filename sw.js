/**
 * Service Worker - 家庭物品管理 PWA
 * 提供离线缓存支持
 * 版本: 2026-06-22
 */

const CACHE_NAME = 'home-inventory-v4';
const ASSETS_TO_CACHE = [
  '.',
  'index.html',
  'manifest.json',
  'css/style.css',
  'js/constants.js',
  'js/db.js',
  'js/util.js',
  'js/family.js',
  'js/sync.js',
  'js/ai.js',
  'js/app.js',
  'icons/icon-192.png',
  'icons/icon-512.png'
];

// 安装事件 - 缓存资源
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('缓存已打开');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => self.skipWaiting())
  );
});

// 激活事件 - 清理旧缓存
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            console.log('删除旧缓存:', name);
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 拦截请求 - 网络优先策略（确保每次都能获取最新内容）
self.addEventListener('fetch', (event) => {
  // 只处理同源请求
  if (event.request.url.startsWith(self.location.origin)) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // 只缓存成功的 GET 请求
          if (event.request.method === 'GET' && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });
          }
          return response;
        })
        .catch(() => {
          // 离线时使用缓存
          return caches.match(event.request)
            .then((cachedResponse) => {
              if (cachedResponse) return cachedResponse;
              if (event.request.mode === 'navigate') {
                return caches.match('index.html');
              }
              return new Response('离线', { status: 503 });
            });
        })
    );
  }
});
