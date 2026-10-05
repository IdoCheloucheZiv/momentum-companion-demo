/* ============================================================
   TRANSITION COMPANION — SERVICE WORKER
   Lets the app open without internet and makes it installable.

   What it does:
   - Keeps a copy of the app's own files on the phone (less than 1 MB).
   - Always tries the internet first, so updates you push to
     GitHub show up the next time someone opens the app online.
   - If there is no internet, it opens the saved copy.

   What it never does:
   - It never touches messages to the AI (the Render proxy).
   - It never stores the soldier's conversation. That lives in
     the browser's own storage, not here.

   If you ever change the list of files below, raise the number
   in CACHE (tc-v1 → tc-v2) so phones pick up the new list.
   ============================================================ */

const CACHE = "tc-v5-direct-topic-assistant";
const APP_FILES = [
  "./",
  "./index.html",
  "./indexH.html",
  "./companion-mentor.jpeg",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png"
];

// Install: save the app files.
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(APP_FILES)).then(() => self.skipWaiting())
  );
});

// Activate: remove copies saved by older versions.
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;            // AI calls are POST — left alone
  const url = new URL(req.url);

  // Google Fonts: use the saved copy if there is one (fonts rarely change).
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    event.respondWith(
      caches.open(CACHE).then(cache =>
        cache.match(req).then(hit => hit || fetch(req).then(res => {
          if (res.ok || res.type === "opaque") cache.put(req, res.clone());
          return res;
        }))
      )
    );
    return;
  }

  // Anything else from another website (including the proxy): left alone.
  if (url.origin !== self.location.origin) return;

  // The app's own files: internet first, saved copy if offline.
  event.respondWith(
    fetch(req)
      .then(res => {
        if (res.ok) {
          const copy = res.clone();   // copy now, before the page reads it
          caches.open(CACHE).then(cache => cache.put(req, copy));
        }
        return res;
      })
      .catch(() =>
        caches.match(req, { ignoreSearch: true })
          .then(hit => hit || (req.mode === "navigate" ? caches.match("./index.html") : undefined))
      )
  );
});
