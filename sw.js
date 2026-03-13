const CACHE_NAME = 'vap-cache-7'
const cacheUrls = [
  './',
  './dist/vue-awesome-picker.js',
  './static/img/vue-logo.png'
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(cacheUrls))
  )
})

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request)
    })
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheKeys) => {
      return Promise.all(
        cacheKeys.map((cacheKey) => {
          if (cacheKey !== CACHE_NAME) {
            return caches.delete(cacheKey)
          }
        })
      )
    })
  )
})
