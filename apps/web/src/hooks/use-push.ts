'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Web Push subscription lifecycle. Keeps state in sync with:
 *   1) The browser's Notification.permission
 *   2) The active PushManager subscription for this SW registration
 *   3) Our /v1/push/subscribe row on the server
 *
 * All three must line up for pushes to actually arrive, and any one going
 * out of sync is easy to recover — we always start from step 1 (the browser
 * is the source of truth) and reconcile up.
 */
export type PushState = 'unsupported' | 'default' | 'granted' | 'denied';

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function usePush() {
  const token = useAuthStore((s) => s.accessToken);
  const [state, setState] = useState<PushState>('default');
  const [subscribed, setSubscribed] = useState<boolean>(false);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (typeof window === 'undefined') return;
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      setState('unsupported');
      return;
    }
    setState(Notification.permission as PushState);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      setSubscribed(!!sub);
    } catch {
      setSubscribed(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const enable = useCallback(async (): Promise<boolean> => {
    if (state === 'unsupported') { toast.error('Push not supported on this browser'); return false; }
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      setState(perm as PushState);
      if (perm !== 'granted') return false;

      // Fetch the VAPID public key. Public endpoint — no auth needed.
      const { publicKey, configured } = await apiFetch<{ publicKey: string | null; configured: boolean }>('/push/vapid-key');
      if (!publicKey || !configured) {
        toast.error('Push not configured on server yet');
        return false;
      }
      const reg = await navigator.serviceWorker.ready;
      // Reuse existing sub or create a new one.
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        // Copy into a plain ArrayBuffer to appease the newer lib.dom types
        // (which reject Uint8Array<SharedArrayBuffer>).
        const raw = urlBase64ToUint8Array(publicKey);
        const buf = new Uint8Array(raw.length);
        buf.set(raw);
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: buf.buffer as ArrayBuffer,
        });
      }
      // Persist server-side.
      const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      await apiFetch('/push/subscribe', {
        method: 'POST',
        token,
        body: { endpoint: json.endpoint, keys: json.keys, userAgent: navigator.userAgent.slice(0, 400) },
      });
      setSubscribed(true);
      toast.success('Push notifications enabled 🔔');
      return true;
    } catch (err) {
      const e = err as { message?: string };
      toast.error(e.message ?? 'Could not enable push');
      return false;
    } finally {
      setBusy(false);
    }
  }, [state, token]);

  const disable = useCallback(async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await apiFetch('/push/unsubscribe', { method: 'POST', token, body: { endpoint: sub.endpoint } }).catch(() => undefined);
        await sub.unsubscribe();
      }
      setSubscribed(false);
      toast.success('Push notifications disabled');
    } finally {
      setBusy(false);
    }
  }, [token]);

  return { state, subscribed, busy, enable, disable, refresh };
}
