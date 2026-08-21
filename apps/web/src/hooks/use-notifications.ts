'use client';

import { useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { io, type Socket } from 'socket.io-client';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export type NotificationType =
  | 'ORDER_UPDATE'
  | 'NEW_MESSAGE'
  | 'NEW_BID'
  | 'PAYMENT'
  | 'SYSTEM'
  | 'REVIEW';

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
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10_000,
    });
    socketRef.current = socket;

    socket.on('notification:new', (_notif: AppNotification) => {
      // Simply invalidate to refetch — cheap; keeps the client in sync.
      qc.invalidateQueries({ queryKey: ['notifications'] });
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token, qc]);
}
