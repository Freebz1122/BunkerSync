const CACHE_NAME = 'ganton-bunker-v6';
const assets = [
  '/',
  '/index.html',
  '/manifest.json',
  '/images/back-icon.png',
  '/images/home-icon.png',
  '/styles.css',
  '/app.js',
  '/map.js',
  '/db.js',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm',
  'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js',
  'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js',
  'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js',
  'https://unpkg.com/dexie@3.2.2/dist/dexie.min.js'
];

// Install event: Cache assets
self.addEventListener('install', event => {
  console.log('Service Worker: Installing ' + CACHE_NAME);
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('Service Worker: Caching assets (' + assets.length + ')', assets);
      return cache.addAll(assets);
    })
  );
});

// Activate event: Clean up old caches
self.addEventListener('activate', event => {
  console.log('Service Worker: Activating ' + CACHE_NAME);
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => caches.delete(name))
      );
    })
  );
});

// Fetch event: Serve from cache or network
self.addEventListener('fetch', event => {
  console.log('Service Worker: Fetching ' + event.request.url);
  event.respondWith(
    caches.match(event.request).then(response => {
      if (response) {
        console.log('Service Worker: Serving from cache ' + event.request.url);
        return response;
      }
      console.log('Service Worker: Fetching from network ' + event.request.url);
      return fetch(event.request).then(networkResponse => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseToCache);
          console.log('Service Worker: Caching ' + event.request.url);
        });
        return networkResponse;
      });
    })
  );
});