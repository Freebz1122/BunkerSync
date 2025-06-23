const CACHE_NAME = 'ganton-bunker-v8';
const urlsToCache = [
  '/',
  '/index.html',
  '/app.js',
  '/map.js',
  '/db.js',
  '/styles.css',
  '/manifest.json',
  '/favicon.ico',
  '/images/home-icon.png',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://unpkg.com/dexie@3.2.2/dist/dexie.min.js',
  'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js',
  'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js',
  'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm'
];

self.addEventListener('install', event => {
  console.log('Service Worker: Installing', CACHE_NAME);
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('Service Worker: Caching assets', urlsToCache);
      return cache.addAll(urlsToCache);
    })
  );
});

self.addEventListener('activate', event => {
  console.log('Service Worker: Activating', CACHE_NAME);
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            console.log('Service Worker: Deleting old cache', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', event => {
  // Skip caching chrome-extension requests
  if (event.request.url.startsWith('chrome-extension://')) {
    event.respondWith(fetch(event.request));
    return;
  }
  event.respondWith(
    caches.match(event.request).then(response => {
      console.log('Service Worker: Fetching', event.request.url);
      return response || fetch(event.request).then(fetchResponse => {
        console.log('Service Worker: Fetched', fetchResponse.status, event.request.url);
        if (!fetchResponse || fetchResponse.status !== 200 || fetchResponse.type !== 'basic') {
          return fetchResponse;
        }
        let responseToCache = fetchResponse.clone();
        caches.open(CACHE_NAME).then(cache => {
          console.log('Service Worker: Caching', event.request.url);
          cache.put(event.request, responseToCache);
        });
        return fetchResponse;
      }).catch(error => {
        console.error('Service Worker: Fetch error', error, event.request.url);
        return caches.match('/index.html'); // Fallback for navigation requests
      });
    })
  );
});