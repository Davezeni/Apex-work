'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { io, type Socket } from 'socket.io-client';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export interface ChatPeer {
  id: string;
  username: string;
  fullName: string;
  avatarUrl: string | null;
}

export interface ChatSummary {
  id: string;
  isGroup: boolean;
  title: string | null;
  peer: ChatPeer | null;
  lastMessage: {
    id: string;
    body: string | null;
    attachmentType: string | null;
    senderId: string;
    createdAt: string;
  } | null;
  lastMessageAt: string | null;
  unread: number;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  body: string | null;
  attachmentUrl: string | null;
  attachmentType: string | null;
  createdAt: string;
  sender: ChatPeer;
}

/** List of all conversations for the current user. */
export function useConversations() {
  const token = useAuthStore((s) => s.accessToken);
  return useQuery<{ items: ChatSummary[] }>({
    queryKey: ['conversations'],
    queryFn: () => apiFetch('/conversations', { token }),
    enabled: !!token,
    staleTime: 10 * 1000,
    refetchOnWindowFocus: true,
  });
}

/** Messages for a conversation. */
export function useMessages(conversationId: string | undefined) {
  const token = useAuthStore((s) => s.accessToken);
  return useQuery<{ items: ChatMessage[]; nextCursor: string | null; hasMore: boolean }>({
    queryKey: ['messages', conversationId],
    queryFn: () => apiFetch(`/conversations/${conversationId}/messages?limit=50`, { token }),
    enabled: !!token && !!conversationId,
    staleTime: 5 * 1000,
  });
}

export interface SendMessagePayload {
  body?: string;
  attachmentUrl?: string;
  attachmentType?: 'image' | 'audio' | 'video' | 'file';
}

export function useSendMessage(conversationId: string | undefined) {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: string | SendMessagePayload) => {
      const body: SendMessagePayload =
        typeof payload === 'string' ? { body: payload } : payload;
      return apiFetch<ChatMessage>(`/conversations/${conversationId}/messages`, {
        method: 'POST',
        body,
        token,
      });
    },
    onSuccess: (msg) => {
      // Optimistically append to the list; server also broadcasts via socket
      qc.setQueryData<{ items: ChatMessage[]; nextCursor: string | null; hasMore: boolean }>(
        ['messages', conversationId],
        (old) => {
          if (!old) return { items: [msg], nextCursor: null, hasMore: false };
          if (old.items.some((m) => m.id === msg.id)) return old;
          return { ...old, items: [...old.items, msg] };
        },
      );
      qc.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

export function useStartConversation() {
  const token = useAuthStore((s) => s.accessToken);
  return useMutation({
    mutationFn: (peerUserId: string) =>
      apiFetch<ChatSummary>('/conversations', {
        method: 'POST',
        body: { peerUserId },
        token,
      }),
  });
}

/**
 * Single shared Socket.io client per authenticated session.
 * Auto-reconnects, joins the given conversation room, and updates React Query
 * caches on incoming messages / typing events.
 */
export function useChatSocket(conversationId: string | undefined) {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  const socketRef = useRef<Socket | null>(null);
  const typingRef = useRef<{ [uid: string]: number }>({});

  useEffect(() => {
    if (!token || !conversationId) return;

    const socket = io(API_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionDelay: 1500,
      reconnectionDelayMax: 10_000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('conversation:join', conversationId, () => {});
    });

    socket.on('message:new', (msg: ChatMessage) => {
      if (msg.conversationId !== conversationId) return;
      qc.setQueryData<{ items: ChatMessage[] } | undefined>(
        ['messages', conversationId],
        (old) => {
          if (!old) return { items: [msg], nextCursor: null, hasMore: false } as never;
          if (old.items.some((m) => m.id === msg.id)) return old;
          return { ...old, items: [...old.items, msg] } as never;
        },
      );
      qc.invalidateQueries({ queryKey: ['conversations'] });
    });

    return () => {
      socket.emit('conversation:leave', conversationId);
      socket.disconnect();
      socketRef.current = null;
      typingRef.current = {};
    };
  }, [token, conversationId, qc]);

  const emit = useMemo(
    () => ({
      typingStart: () => socketRef.current?.emit('typing:start', conversationId),
      typingStop: () => socketRef.current?.emit('typing:stop', conversationId),
      markRead: () => socketRef.current?.emit('conversation:read', conversationId),
    }),
    [conversationId],
  );

  return emit;
}
