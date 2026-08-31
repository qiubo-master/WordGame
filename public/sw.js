// WordQuest service worker —— 页面网络优先，带哈希的静态资源缓存优先。
// 不缓存 /api/*，保证登录与云端同步始终走网络。
const CACHE = 'wq-shell-v2'

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ).then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/')) return

  // 自动更新检查必须直连网络，不能被旧的 index.html 缓存拦截。
  if (url.searchParams.has('__wq_update')) {
    event.respondWith(fetch(req, { cache: 'no-store' }))
    return
  }

  const wantsHtml = req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')
  if (wantsHtml) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone()
            caches.open(CACHE).then((cache) => cache.put(req, copy))
          }
          return res
        })
        .catch(async () => (await caches.open(CACHE)).match(req) || (await caches.match('/'))),
    )
    return
  }

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(req)
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            cache.put(req, res.clone())
          }
          return res
        })
        .catch(() => cached)
      return cached || network
    }),
  )
})
