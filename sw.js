/* 德州扑克投屏计时器 · Service Worker
 * 策略：预缓存全部资源（2 个文件）→ 之后完全离线可用
 * 图标缓存失败不阻断安装
 */
const CACHE = 'poker-timer-v5';   // v5: 2026-09-28 点开后自动全屏（隐藏地址栏）

/* 核心资源：缺一不可 */
const CORE = ['./', './index.html', './manifest.json'];

/* 图标：可选，失败不影响安装 */
const OPTIONAL = ['./icon-192.png', './icon-512.png', './icon-192-maskable.png'];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(CORE);
    // 逐个缓存，失败忽略
    await Promise.all(OPTIONAL.map((u) =>
      cache.add(u).catch(() => console.warn('[SW] 可选资源跳过:', u))
    ));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  // 导航请求：缓存优先，保证离线可开
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match('./index.html') || await cache.match('./');
      if (cached) {
        // 后台静默更新（有网时刷新缓存）
        fetch(req).then((res) => {
          if (res && res.ok) cache.put('./index.html', res.clone());
        }).catch(() => {});
        return cached;
      }
      try {
        return await fetch(req);
      } catch {
        return new Response('离线且无缓存', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      }
    })());
    return;
  }

  // 其他资源：缓存优先
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req);
    if (cached) return cached;
    try {
      const res = await fetch(req);
      if (res && res.ok && new URL(req.url).origin === self.location.origin) {
        cache.put(req, res.clone());
      }
      return res;
    } catch {
      return new Response('', { status: 504 });
    }
  })());
});
