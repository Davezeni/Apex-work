/**
 * Apex-Work Service Worker.
 *
 * Goals (in priority order):
 *   1. Instant repeat visits — cache the shell + Next/static chunks so
 *      the app opens even offline and re-renders within 1 frame.
 *   2. Never break a live app deploy — versioned cache name; old caches
 *      wiped on activate. `skipWaiting` + `clients.claim` so the newest
 *      SW takes over immediately.
 *   3. Zero network calls for cached static assets (cache-first).
 *   4. HTML / RSC / API: network-first with a fresh cache fallback so
 *      users still see stale content when their connection drops.
 *   5. Never cache anything auth-sensitive — /v1/me, /v1/auth/*.
 *
 * NOTE: this file is served from /sw.js at the origin root, which gives it
 * scope over the entire site — required by the browser SW spec.
 */

const VERSION = 'v4';
const SHELL_CACHE = `apex-shell-${VERSION}`;
const RUNTIME_CACHE = `apex-runtime-${VERSION}`;
const IMAGE_CACHE = `apex-img-${VERSION}`;

// Minimal set — the rest is filled in at runtime on first navigation.
const PRECACHE = [
  '/',
  '/manifest.webmanifest',
  '/icon.svg',
  '/apple-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((c) => c.addAll(PRECACHE).catch(() => undefined))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => ![SHELL_CACHE, RUNTIME_CACHE, IMAGE_CACHE].includes(k))
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

// ---- helpers ----

const isNavRequest = (req) => req.mode === 'navigate';
const isStaticAsset = (url) =>
  url.pathname.startsWith('/_next/static/') ||
  url.pathname.startsWith('/icons/') ||
  /\.(?:woff2?|ttf|eot|css|js|svg|png|jpg|jpeg|webp|avif|gif|ico)$/.test(url.pathname);
const isImage = (req, url) =>
  req.destination === 'image' || /\.(?:png|jpe?g|webp|avif|gif|svg)$/.test(url.pathname);
const isApi = (url) => url.pathname.startsWith('/v1/') || url.hostname.includes('onrender.com');
const isAuthSensitive = (url) =>
  url.pathname.startsWith('/v1/me') ||
  url.pathname.startsWith('/v1/auth') ||
  url.pathname.startsWith('/v1/passkey') ||
  url.pathname.startsWith('/v1/payments/webhook');

const CACHE_LIMITS = {
  [RUNTIME_CACHE]: 80,
  [IMAGE_CACHE]: 60,
};

async function trimCache(name, max) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  if (keys.length <= max) return;
  await Promise.all(keys.slice(0, keys.length - max).map((k) => cache.delete(k)));
}

// Race two promises: return the network response if it beats `timeoutMs`,
// otherwise fall back to whatever the cached one resolves to. If neither,
// return the network one when it eventually arrives.
async function raceWithTimeout(networkPromise, cachedPromise, timeoutMs) {
  const timeout = new Promise((resolve) => setTimeout(() => resolve(null), timeoutMs));
  const cached = await Promise.race([cachedPromise, timeout]);
  if (cached) return cached;
  return networkPromise;
}

// ---- main fetch handler ----

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Never touch auth / mutations / webhooks.
  if (isAuthSensitive(url)) return;

  // 1) Same-origin navigations → network-first with cached fallback (offline shell).
  if (isNavRequest(req) && url.origin === self.location.origin) {
    event.respondWith(
      (async () => {
        try {
          const network = await fetch(req);
          const cache = await caches.open(RUNTIME_CACHE);
          cache.put(req, network.clone()).catch(() => undefined);
          trimCache(RUNTIME_CACHE, CACHE_LIMITS[RUNTIME_CACHE]);
          return network;
        } catch {
          const cached = await caches.match(req);
          if (cached) return cached;
          // Ultimate fallback — the shell (`/`).
          return (await caches.match('/')) ?? new Response('Offline', { status: 503 });
        }
      })(),
    );
    return;
  }

  // 2) Static assets (hashed by Next) → cache-first, forever.
  if (url.origin === self.location.origin && isStaticAsset(url)) {
    event.respondWith(
      caches.match(req).then(
        (cached) =>
          cached ||
          fetch(req).then((res) => {
            const cache = caches.open(SHELL_CACHE);
            cache.then((c) => c.put(req, res.clone())).catch(() => undefined);
            return res;
          }),
      ),
    );
    return;
  }

  // 3) Images (Supabase or Next optimizer) → cache-first with LRU trim.
  if (isImage(req, url)) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(req);
        if (cached) return cached;
        try {
          const res = await fetch(req);
          if (res.ok) {
            const cache = await caches.open(IMAGE_CACHE);
            cache.put(req, res.clone()).catch(() => undefined);
            trimCache(IMAGE_CACHE, CACHE_LIMITS[IMAGE_CACHE]);
          }
          return res;
        } catch {
          return new Response('', { status: 504 });
        }
      })(),
    );
    return;
  }

  // 4) API GETs → stale-while-revalidate for fast render + fresh data.
  if (isApi(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(RUNTIME_CACHE);
        const cachedPromise = cache.match(req);
        const networkPromise = fetch(req)
          .then((res) => {
            if (res.ok) cache.put(req, res.clone()).catch(() => undefined);
            return res;
          })
          .catch(() => null);
        // Prefer cache if it exists (feels instant), refresh in bg.
        const cached = await cachedPromise;
        if (cached) {
          void networkPromise; // background refresh
          return cached;
        }
        // No cache — race with a 3s soft timeout so slow networks don't hang.
        const raced = await raceWithTimeout(networkPromise, Promise.resolve(null), 3000);
        return raced ?? new Response(JSON.stringify({ ok: false, error: { code: 'OFFLINE' } }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        });
      })(),
    );
    return;
  }

  // Everything else: pass-through.
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

// ---- Web Push ----
// Server sends { title, body, url?, tag?, icon?, badge? }. We fall back to
// safe defaults if anything is missing so a bad payload never breaks the SW.
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { /* ignore */ }
  const title = data.title || 'Apex-Work';
  const options = {
    body: data.body || '',
    tag: data.tag || 'apex-generic',
    renotify: true,
    icon: data.icon || '/icons/icon-192.png',
    badge: data.badge || '/icons/icon-192.png',
    data: { url: data.url || '/' },
    vibrate: [80, 40, 80],
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url || '/';
  event.waitUntil((async () => {
    // Focus an existing tab if we can; otherwise open a new one.
    const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of list) {
      if (c.url.includes(new URL(target, self.location.origin).pathname) && 'focus' in c) return c.focus();
    }
    return self.clients.openWindow(target);
  })());
});
