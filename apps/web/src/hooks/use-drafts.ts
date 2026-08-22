'use client';

import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Message draft autosaver. Debounces writes to localStorage (instant) and
 * to /v1/me/drafts (once every 3s while typing). When the browser is
 * offline, only the local copy is written — a bg flush pass runs on the
 * `online` event to sync everything queued.
 */
const LOCAL_PREFIX = 'apex-draft:';
const REMOTE_DEBOUNCE_MS = 3000;

export function useMessageDraft(conversationId: string | undefined) {
  const token = useAuthStore((s) => s.accessToken);
  const [text, setText] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSentRef = useRef<string>('');

  const key = conversationId ? `${LOCAL_PREFIX}${conversationId}` : null;

  // Hydrate: prefer localStorage (fastest), then fall back to server row.
  useEffect(() => {
    if (!key || !conversationId) return;
    try {
      const local = localStorage.getItem(key);
      if (local != null) { setText(local); lastSentRef.current = local; return; }
    } catch { /* ignore */ }
    if (!token) return;
    // Never block UI — best-effort remote hydrate.
    apiFetch<{ body: string } | null>(`/me/drafts/${conversationId}`, { token })
      .then((d) => {
        if (d?.body) {
          setText(d.body);
          lastSentRef.current = d.body;
          try { localStorage.setItem(key, d.body); } catch { /* ignore */ }
        }
      })
      .catch(() => undefined);
  }, [key, conversationId, token]);

  // On every change: instant local write, debounced remote write.
  useEffect(() => {
    if (!key || !conversationId) return;
    try { localStorage.setItem(key, text); } catch { /* ignore */ }

    if (timerRef.current) clearTimeout(timerRef.current);
    if (text === lastSentRef.current || !token) return;
    timerRef.current = setTimeout(() => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;
      apiFetch('/me/drafts', {
        method: 'PUT', token,
        body: { conversationId, body: text },
      }).then(() => { lastSentRef.current = text; }).catch(() => undefined);
    }, REMOTE_DEBOUNCE_MS);

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [text, key, conversationId, token]);

  const clear = () => {
    setText('');
    lastSentRef.current = '';
    if (key) try { localStorage.removeItem(key); } catch { /* ignore */ }
    if (conversationId && token) {
      apiFetch(`/me/drafts/${conversationId}`, { method: 'DELETE', token }).catch(() => undefined);
    }
  };

  return { text, setText, clear };
}
