'use client';

/**
 * Global incoming-call ring. Backed by ONE shared app-level socket (module
 * singleton, ref-counted) so page navigations never tear down / reconnect
 * the listener — cheap on the network and it never misses a ring while you
 * move around the app. The server fans `call:start` / `call:end` out to
 * every member's user rooms (all devices, any page).
 */
import { useEffect, useState } from 'react';
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

type StartListener = (d: IncomingCall) => void;
type EndListener = (d: { conversationId: string; from?: string }) => void;

const startListeners = new Set<StartListener>();
const endListeners = new Set<EndListener>();
let sharedSocket: Socket | null = null;
let refCount = 0;

function acquire(): Socket | null {
  refCount += 1;
  if (sharedSocket) return sharedSocket;
  if (typeof window === 'undefined') return null;
  const token = useAuthStore.getState().accessToken;
  if (!token) return null;
  sharedSocket = io(API_BASE, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1500,
    reconnectionDelayMax: 10_000,
  });
  sharedSocket.on('call:start', (d: IncomingCall) => {
    startListeners.forEach((fn) => fn(d));
  });
  sharedSocket.on('call:end', (d: { conversationId: string }) => {
    endListeners.forEach((fn) => fn(d));
  });
  sharedSocket.on('call:leave', (d: { conversationId: string; from?: string }) => {
    // A caller who backs out before anyone answers also stops the ring.
    endListeners.forEach((fn) => fn(d));
  });
  return sharedSocket;
}

function release() {
  refCount = Math.max(0, refCount - 1);
  if (refCount === 0 && sharedSocket) {
    sharedSocket.disconnect();
    sharedSocket = null;
  }
}

export function useIncomingCall(enabled: boolean) {
  const token = useAuthStore((s) => s.accessToken);
  const [incoming, setIncoming] = useState<IncomingCall | null>(null);

  useEffect(() => {
    if (!enabled || !token) return;
    const sock = acquire();
    if (!sock) return;

    const onStart: StartListener = (d) => {
      if (!d?.conversationId) return;
      setIncoming((prev) => {
        // Newest ring wins; ignore duplicate deliveries of the same ring.
        if (prev && prev.conversationId === d.conversationId && prev.at === d.at) return prev;
        return d;
      });
    };
    const onEnd: EndListener = (d) => {
      setIncoming((prev) => (prev && prev.conversationId === d.conversationId ? null : prev));
    };

    startListeners.add(onStart);
    endListeners.add(onEnd);
    return () => {
      startListeners.delete(onStart);
      endListeners.delete(onEnd);
      release();
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
