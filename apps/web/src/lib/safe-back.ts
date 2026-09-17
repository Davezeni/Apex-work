'use client';

/**
 * Back that never dead-ends and never abandons the app.
 *
 * `window.history.length` counts OTHER sites visited in this tab before the
 * app, so on shared links / deep links / PWA launches it lies: router.back()
 * exits the site or visibly does nothing — users see a broken button and tap
 * repeatedly. The Providers tree marks real in-app navigation in
 * sessionStorage ('apex:inApp'), so back() is used only when we KNOW the app
 * navigated internally; otherwise we push a sensible fallback.
 */
export function safeBack(
  router: { back: () => void; push: (url: string) => void },
  fallback = '/',
) {
  let inApp = false;
  try {
    inApp =
      typeof window !== 'undefined' &&
      window.sessionStorage.getItem('apex:inApp') === '1' &&
      window.history.length > 1;
  } catch {
    inApp = false;
  }
  if (inApp) {
    router.back();
  } else {
    router.push(fallback);
  }
}
