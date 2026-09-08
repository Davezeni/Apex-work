'use client';

import { useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { io, type Socket } from 'socket.io-client';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export const ICON_EMOJI: Record<string, string> = {
  ORDER_UPDATE: '📦',
  NEW_MESSAGE: '💬',
  NEW_BID: '📢',
  PAYMENT: '💰',
  SYSTEM: '⚙️',
  REVIEW: '⭐',
  REVIEW_REPLY: '💬',
};

export type NotificationType =
  | 'ORDER_UPDATE'
  | 'NEW_MESSAGE'
  | 'NEW_BID'
  | 'PAYMENT'
  | 'SYSTEM'
  | 'REVIEW'
  | 'REVIEW_REPLY';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  payload: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
}

export function useNotifications() {
  const token = useAuthStore((s) => s.accessToken);
  return useQuery<{ items: AppNotification[]; nextCursor: string | null; hasMore: boolean }>({
    queryKey: ['notifications'],
    queryFn: () => apiFetch('/notifications', { token }),
    enabled: !!token,
    staleTime: 10 * 1000,
    refetchOnWindowFocus: true,
  });
}

export function useUnreadCount() {
  const token = useAuthStore((s) => s.accessToken);
  return useQuery<{ count: number }>({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => apiFetch('/notifications/unread-count', { token }),
    enabled: !!token,
    // Cheap poll every 30s as a fallback in case the socket connection drops.
    refetchInterval: 30_000,
    staleTime: 5_000,
  });
}

export function useMarkAllRead() {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<{ count: number }>('/notifications/read-all', { method: 'POST', token }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

/**
 * Subscribes to the user's private socket room for real-time notifications.
 * Placed high in the tree (mobile shell) so notifications are always live.
 */
export function useNotificationSocket() {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!token) return;

    const socket = io(API_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      upgrade: true,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10_000,
      reconnectionAttempts: Infinity,
      timeout: 20_000,
    });
    socketRef.current = socket;

    socket.on('notification:new', (notif: AppNotification) => {
      // Invalidate to refetch — keeps the client in sync.
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
      // Show an in-app toast unless we're already on the notifications page;
      // clicking it jumps to the notification. NEW_MESSAGE toasts are subtle.
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/notifications')) {
        const title =
          notif.type === 'NEW_MESSAGE' ? 'New message' : notif.title;
        toast(title, {
          description: notif.body ?? undefined,
          icon: ICON_EMOJI[notif.type] ?? '🔔',
          action: {
            label: 'View',
            onClick: () => {
              const p = notif.payload ?? {};
              if (typeof p.conversationId === 'string')
                window.location.assign(`/messages/${p.conversationId}`);
              else if (typeof p.orderId === 'string') window.location.assign(`/orders/${p.orderId}`);
              else window.location.assign('/notifications');
            },
          },
        });
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token, qc]);
}
