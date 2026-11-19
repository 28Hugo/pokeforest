// Offline support: the app shell is cached on install, sprites and fonts on first use.
const SHELL = 'pokeforest-shell-v13';
const MEDIA = 'pokeforest-media-v1';
const FILES = ['./', 'index.html', 'style.css', 'app.js', 'game.js', 'ui.js', 'catalog.json', 'views/training.js', 'views/safari.js', 'views/trainer.js', 'views/shop.js', 'views/more.js', 'manifest.webmanifest', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png',
  'img/habitats/trophaeengarten.png', 'img/habitats/ewigwald.png', 'img/habitats/grossmoor.png', 'img/habitats/erzelingen.png', 'img/habitats/windkraftwerk.png', 'img/habitats/kahlberg.png', 'img/habitats/altes-chateau.png', 'img/habitats/route-217.png', 'img/habitats/speersaeule.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((cache) => cache.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== SHELL && k !== MEDIA).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET') return;
  if (url.hostname === 'pokeapi.co' || url.hostname.includes('youtube')) return;
  const isMedia = url.hostname === 'raw.githubusercontent.com' || url.hostname.endsWith('gstatic.com') || url.hostname === 'fonts.googleapis.com';
  if (isMedia) {
    // Sprites and fonts never change: cache first.
    event.respondWith(caches.open(MEDIA).then(async (cache) => {
      const hit = await cache.match(event.request);
      if (hit) return hit;
      const response = await fetch(event.request);
      if (response.ok || response.type === 'opaque') cache.put(event.request, response.clone());
      return response;
    }));
    return;
  }
  if (url.origin === self.location.origin) {
    // App files: network first, so updates arrive; cache when offline.
    event.respondWith(fetch(event.request).then((response) => {
      const copy = response.clone();
      caches.open(SHELL).then((cache) => cache.put(event.request, copy));
      return response;
    }).catch(() => caches.match(event.request).then((hit) => hit || caches.match('index.html'))));
  }
});
