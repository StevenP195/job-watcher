/* Service worker: makes the site installable and usable offline.

   - Pages, scripts, styles and icons: network first, cached copy when offline.
   - Data files (data/history.csv, data/status.json): always try the network so
     the pages show the latest run; when offline, serve the last copy loaded and
     mark the response so the page can show an "offline" banner. */

const CACHE = "job-watcher-v5";
const SHELL = [
  "./", "index.html", "browse.html", "market.html", "news.html", "manifest.webmanifest",
  "assets/style.css", "assets/app.js", "assets/today.js", "assets/browse.js", "assets/market.js", "assets/news.js", "assets/winter.js",
  "assets/vendor/chart.umd.min.js",
  "assets/icons/icon-192.png", "assets/icons/icon-512.png", "assets/icons/maskable-512.png",
  "data/status.json", "data/history.csv", "data/news.json",
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()));
});

async function offlineCopy(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request, { ignoreSearch: true });
  if (!hit) {
    if (request.mode === "navigate") return cache.match("index.html");
    return Response.error();
  }
  const headers = new Headers(hit.headers);
  headers.set("X-JW-Offline", "1");
  return new Response(await hit.blob(), { status: hit.status, statusText: hit.statusText, headers });
}

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  event.respondWith((async () => {
    try {
      // a navigation Request can't be re-sent with options, so fetch by URL
      const fresh = await fetch(req.url, { cache: "no-cache", credentials: "same-origin" });
      if (fresh.ok) {
        const cache = await caches.open(CACHE);
        await cache.put(req, fresh.clone());
      }
      return fresh;
    } catch {
      return offlineCopy(req);
    }
  })());
});
