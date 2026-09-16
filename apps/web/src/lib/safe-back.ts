'use client';

/**
 * Back that never dead-ends. `router.back()` does nothing when the app was
 * opened fresh (PWA launch, shared link, new tab) — users perceive the button
 * as broken and tap repeatedly. Falls back to `fallback` (default: home).
 * Structurally typed so it accepts the App Router's useRouter() result.
 */
export function safeBack(
  router: { back: () => void; push: (url: string) => void },
  fallback = '/',
) {
  if (typeof window !== 'undefined' && window.history.length > 1) {
    router.back();
  } else {
    router.push(fallback);
  }
}
