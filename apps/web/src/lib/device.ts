/**
 * Trusted-device token storage — kept separately from the auth store so it
 * survives sign-out. The whole point is that "remember me on THIS device"
 * outlives short-lived sessions.
 *
 * Storage: localStorage under APX_DEVICE. Value is the raw token string.
 * Nothing else about the user is persisted here.
 */
const KEY = 'apex-work-device-token';

export function getDeviceToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setDeviceToken(token: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, token);
  } catch {
    /* private mode / quota */
  }
}

export function clearDeviceToken(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* noop */
  }
}
