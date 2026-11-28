const CACHE_NAME = "family-finance-pwa-v22";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css?v=restore-original-header-sticky-20261127-v1",
  "./mobile-nav-touch.css?v=mobile-menu-tap-20261127-v5",
  "./app.js?v=remove-reports-menu-20261119-v1",
  "./manifest.webmanifest",
  "./icons/family-finance.svg"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key.startsWith("family-finance-pwa-") && key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);

  // Never cache Supabase/API requests, writes, or cross-origin responses.
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) {
            const copy = response.clone();
            event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.put("./index.html", copy)));
          }
          return response;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  // Keep app code and visual assets fresh: network first, cached copy only offline.
  const isAppAsset = ["script", "style", "image", "font", "manifest"].includes(request.destination);
  if (!isAppAsset) return;

  event.respondWith(
    fetch(request)
      .then(response => {
        if (response.ok) {
          const copy = response.clone();
          event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.put(request, copy)));
        }
        return response;
      })
      .catch(() => caches.match(request, { ignoreSearch: true }))
  );
});
