/**
 * Offline cache for the web build.
 *
 * The page itself is fetched network-first, so a new release reaches players on their next
 * visit instead of being pinned to whatever was cached the first time. Everything else is
 * served from cache and refreshed in the background. The cache name carries the app version
 * so an upgrade cleans up after the previous one.
 */
const VERSION = "1.6";
const CACHE = "game2048-" + VERSION;
const ASSETS = ["./", "./index.html", "./manifest.json", "./icon.svg"];
const PAGES = ["/", "/index.html"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isPage(request, url){
  return request.mode === "navigate" || PAGES.indexOf(url.pathname) >= 0 || url.pathname.endsWith("/index.html");
}

function store(request, response){
  if (response && response.ok){
    const copy = response.clone();
    caches.open(CACHE).then(c => c.put(request, copy)).catch(() => {});
  }
  return response;
}

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== self.location.origin) return;

  if (isPage(e.request, url)){
    // network first: always prefer a fresh build, fall back to the cached one offline
    e.respondWith(
      fetch(e.request)
        .then(res => store(e.request, res))
        .catch(() => caches.match(e.request).then(hit => hit || caches.match("./index.html")))
    );
    return;
  }

  // stale while revalidate: instant from cache, refreshed for next time
  e.respondWith(
    caches.match(e.request).then(hit => {
      const network = fetch(e.request).then(res => store(e.request, res)).catch(() => hit);
      return hit || network;
    })
  );
});
