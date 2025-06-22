const CACHE_NAME = 'ganton-bunker-v6';
const APP_STATIC_RESOURCES = [
  '/',
  '/index.html',
  '/manifest.json',
  '/images/ganton-logo-v3.jpg',
  '/images/back-icon.png',
  '/images/home-icon.png'
];

self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing', CACHE_NAME);
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Service Worker: Caching assets', APP_STATIC_RESOURCES);
      return cache.addAll(APP_STATIC_RESOURCES).catch((error) => {
        console.error('Service Worker: Cache addAll failed', error);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating', CACHE_NAME);
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.filter((name) => name !== CACHE_NAME).map((name) => {
          console.log('Service Worker: Deleting old cache', name);
          return caches.delete(name);
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    console.log('Service Worker: Skipping non-GET request', event.request.url);
    return;
  }
  if (event.request.url.includes('supabase.co')) {
    console.log('Service Worker: Handling Supabase fetch', event.request.url);
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          console.log('Service Worker: Serving Supabase from cache', event.request.url);
          return cachedResponse;
        }
        console.log('Service Worker: Fetching Supabase from network', event.request.url);
        return fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            return caches.open('map-cache').then((cache) => {
              console.log('Service Worker: Caching Supabase', event.request.url);
              cache.put(event.request, networkResponse.clone());
              return networkResponse;
            });
          }
          return networkResponse;
        }).catch((error) => {
          console.error('Service Worker: Supabase fetch failed', event.request.url, error);
          return new Response('Offline and no cached Supabase resource available.', { status: 503 });
        });
      })
    );
  } else {
    console.log('Service Worker: Fetching', event.request.url);
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          console.log('Service Worker: Serving from cache', event.request.url);
          return cachedResponse;
        }
        console.log('Service Worker: Fetching from network', event.request.url);
        return fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            return caches.open(CACHE_NAME).then((cache) => {
              console.log('Service Worker: Caching', event.request.url);
              cache.put(event.request, networkResponse.clone());
              return networkResponse;
            });
          }
          return networkResponse;
        }).catch((error) => {
          console.error('Service Worker: Fetch failed', event.request.url, error);
          if (event.request.mode === 'navigate') {
            console.log('Service Worker: Falling back to /index.html');
            return caches.match('/index.html');
          }
          if (event.request.url.includes('ganton-logo-v3.jpg')) {
            console.log('Service Worker: No fallback for ganton-logo-v3.jpg');
          }
          return new Response('Offline and no cached resource available.', { status: 503 });
        });
      })
    );
  }
});