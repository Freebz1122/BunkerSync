self.addEventListener('install', event => {
  event.waitUntil(
    caches.open('bunkersync-cache').then(cache => {
      return cache.addAll([
        '/',
        '/index.html',
        '/app.js',
        '/map.js',
        '/task-panel.js',
        '/db.js',
        '/env-config.js',
        '/styles.css',
        '/manifest.json',
        '/favicon.ico',
        '/images/placeholder-logo.png',
        '/images/home-icon.png',
        '/images/back-icon.png'
      ]);
    })
  );
});
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});