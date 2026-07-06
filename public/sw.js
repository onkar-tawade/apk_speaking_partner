// Minimal service worker - its main job here is just to exist and register,
// which is one of the requirements Chrome checks before showing the
// "Add to Home Screen" / install prompt on Android. It does a basic
// network-first pass-through so the app still works correctly if it's ever
// extended into real offline caching later.

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
