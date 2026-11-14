/* 지옥 부족 스톤 헬퍼 · service worker */
const CACHE = 'hellstone-v1'
const SHELL = ['./', './index.html', './manifest.webmanifest']

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(SHELL))
      .catch(() => {})
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('message', (e) => {
  if (e.data === 'skip-waiting') self.skipWaiting()
})

self.addEventListener('fetch', (e) => {
  const { request } = e
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  // API는 항상 네트워크 (최신 도감/등록 데이터)
  if (url.pathname.startsWith('/api/')) return

  // 페이지 이동: 네트워크 우선, 끊기면 캐시된 앱 셸
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request)
        .then((res) => {
          caches.open(CACHE).then((c) => c.put('./index.html', res.clone())).catch(() => {})
          return res
        })
        .catch(() => caches.match('./index.html').then((r) => r || caches.match('./')))
    )
    return
  }

  // 정적 자산: 캐시 우선, 없으면 네트워크 후 캐시
  e.respondWith(
    caches.match(request).then(
      (hit) =>
        hit ||
        fetch(request)
          .then((res) => {
            if (res.ok && res.type === 'basic') {
              const copy = res.clone()
              caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {})
            }
            return res
          })
          .catch(() => hit)
    )
  )
})
