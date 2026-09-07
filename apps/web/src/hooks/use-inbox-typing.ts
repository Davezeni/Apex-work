'use client';

import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useAuthStore } from '@/stores/auth-store';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  (process.env.NODE_ENV === 'production'
    ? 'https://apex-work-api.onrender.com'
    : 'http://localhost:4000');

type TypingMap = Record<string, { userId: string; name: string | null }>; // conversationId -> typer

/**
 * Live "... typing" pulse for the conversation list (inbox). Opens a lightweight
 * socket that listens for `typing:inbox` relays (pushed to this user's private
 * room by the server) and reports which conversations currently have someone
 * typing. Each entry auto-clears after a few seconds.
 */
export function useInboxTyping(): { typing: TypingMap } {
  const token = useAuthStore((s) => s.accessToken);
  const [typing, setTyping] = useState<TypingMap>({});
  const socketRef = useRef<Socket | null>(null);
  const timers = useRef<Record<string, number | null>>({});

  useEffect(() => {
    if (!token) return;
    const socket = io(API_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1200,
      reconnectionDelayMax: 8000,
    });
    socketRef.current = socket;

    const clear = (conversationId: string) => {
      if (timers.current[conversationId]) window.clearTimeout(timers.current[conversationId] ?? undefined);
      timers.current[conversationId] = null;
      setTyping((prev) => {
        const { [conversationId]: _drop, ...rest } = prev;
        return rest;
      });
    };

    socket.on('typing:inbox', (d: { conversationId: string; userId: string; status: string; name?: string | null }) => {
      if (d.status === 'stop') return clear(d.conversationId);
      setTyping((prev) => ({ ...prev, [d.conversationId]: { userId: d.userId, name: d.name ?? null } }));
      if (timers.current[d.conversationId]) window.clearTimeout(timers.current[d.conversationId] ?? undefined);
      timers.current[d.conversationId] = window.setTimeout(() => clear(d.conversationId), 4000);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      Object.values(timers.current).forEach((t) => t && window.clearTimeout(t));
      timers.current = {};
    };
  }, [token]);

  return { typing };
}
