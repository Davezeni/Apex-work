'use client';

import { useEffect } from 'react';

/**
 * Register the /sw.js service worker after the page has settled.
 * Skips localhost (avoids stale caches during dev) and browsers without
 * SW support. Uses `updateViaCache: 'none'` so the SW file itself is
 * always fetched fresh — otherwise a bad SW can trap users on old code.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;
    if (process.env.NODE_ENV !== 'production') return;

    // Register after `load` so it never contends with LCP.
    const register = () => {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/', updateViaCache: 'none' })
        .then((reg) => {
          // Check for updates every 15 minutes AND whenever the user returns
          // to the tab — a deploy should reach an open app within minutes,
          // not up to an hour later.
          setInterval(() => reg.update().catch(() => undefined), 15 * 60 * 1000);
          const onVisible = () => {
            if (document.visibilityState === 'visible') reg.update().catch(() => undefined);
          };
          document.addEventListener('visibilitychange', onVisible);
          window.addEventListener('focus', onVisible);

          // If a new SW takes over, tell it to skip waiting so the next
          // navigation gets the fresh assets.
          reg.addEventListener('updatefound', () => {
            const sw = reg.installing;
            sw?.addEventListener('statechange', () => {
              if (sw.state === 'installed' && navigator.serviceWorker.controller) {
                sw.postMessage({ type: 'SKIP_WAITING' });
              }
            });
          });
        })
        .catch(() => {
          // A registration failure is never worth interrupting the user.
        });

      // When a freshly-activated SW takes control it wipes the old caches.
      // Reload the page exactly once so we land on the NEW bundle immediately,
      // instead of forcing the user to reload a second time by hand.
      let reloaded = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (reloaded) return;
        reloaded = true;
        window.location.reload();
      });
    };

    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
  }, []);

  return null;
}
