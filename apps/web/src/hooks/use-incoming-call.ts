'use client';

/**
 * Global incoming-call ring. A single app-level socket listens for
 * `call:start` / `call:end` (the server fans these out to every member's
 * user rooms), so a call reaches you on ANY page — not just inside the
 * conversation thread. Accept navigates to the thread with ?call=mode,
 * which auto-opens the call panel there.
 */
import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { API_BASE } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';

export interface IncomingCall {
  conversationId: string;
  from: string;
  callerName?: string;
  mode: 'audio' | 'video';
  at: string;
}

export function useIncomingCall(enabled: boolean) {
  const token = useAuthStore((s) => s.accessToken);
  const [incoming, setIncoming] = useState<IncomingCall | null>(null);

  useEffect(() => {
    if (!enabled || !token) return;
    const sock = io(API_BASE, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: Infinity,
    });

    const onStart = (d: IncomingCall) => {
      if (!d?.conversationId) return;
      setIncoming((prev) => {
        // Newest ring wins; ignore duplicate deliveries of the same ring.
        if (prev && prev.conversationId === d.conversationId && prev.at === d.at) return prev;
        return d;
      });
    };
    const onEnd = (d: { conversationId: string }) => {
      setIncoming((prev) => (prev && prev.conversationId === d.conversationId ? null : prev));
    };

    sock.on('call:start', onStart);
    sock.on('call:end', onEnd);

    return () => {
      sock.off('call:start', onStart);
      sock.off('call:end', onEnd);
      sock.disconnect();
    };
  }, [enabled, token]);

  // Ring for at most 35s, then dismiss (caller may have gone offline).
  useEffect(() => {
    if (!incoming) return;
    const t = setTimeout(() => setIncoming(null), 35_000);
    return () => clearTimeout(t);
  }, [incoming]);

  const dismiss = () => setIncoming(null);

  return { incoming, dismiss };
}
