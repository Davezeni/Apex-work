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
  attachmentMeta?: {
    name?: string;
    size?: number;
    duration?: number;
    transcript?: string;
    waveform?: number[];
  } | null;
  replyToId?: string | null;
  replyTo?: {
    id: string;
    body: string | null;
    attachmentType: string | null;
    senderId: string;
    sender: { fullName: string };
  } | null;
  reactions?: { emoji: string; count: number; mine: boolean }[];
  readBy?: number;
  readByTotal?: number;
  editedAt?: string | null;
  deletedAt?: string | null;
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
  attachmentMeta?: Record<string, unknown>;
  replyToId?: string;
  clientId?: string;
}

export function useSendMessage(conversationId: string | undefined) {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: string | SendMessagePayload) => {
      const body: SendMessagePayload =
        typeof payload === 'string' ? { body: payload } : payload;
      const clientId = body.clientId ?? `c_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      try {
        return await apiFetch<ChatMessage>(`/conversations/${conversationId}/messages`, {
          method: 'POST',
          body: { ...body, clientId },
          token,
        });
      } catch (err) {
        // If offline, queue for later flush by useOutboxSync.
        if (typeof navigator !== 'undefined' && !navigator.onLine && conversationId) {
          const { enqueue } = await import('@/lib/outbox');
          await enqueue({
            clientId,
            conversationId,
            body: body.body,
            attachmentUrl: body.attachmentUrl,
            attachmentType: body.attachmentType,
            attachmentMeta: body.attachmentMeta,
            replyToId: body.replyToId,
          });
          // Return an optimistic ghost message so the UI updates instantly.
          const ghost: ChatMessage = {
            id: clientId,
            conversationId,
            senderId: 'me',
            body: body.body ?? null,
            attachmentUrl: body.attachmentUrl ?? null,
            attachmentType: body.attachmentType ?? null,
            createdAt: new Date().toISOString(),
            sender: { id: 'me', username: 'me', fullName: 'You', avatarUrl: null },
          };
          return ghost;
        }
        throw err;
      }
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

export interface ConversationDetail extends ChatSummary {
  createdAt: string;
  members: { userId: string; isAdmin: boolean; joinedAt: string; lastReadAt: string | null; fullName: string; username: string; avatarUrl: string | null }[];
  me: { isMuted: boolean; isAdmin: boolean };
}

/** Full detail for the open conversation (group members etc.). */
export function useConversation(conversationId: string | undefined) {
  const token = useAuthStore((s) => s.accessToken);
  return useQuery<ConversationDetail>({
    queryKey: ['conversation', conversationId],
    queryFn: () => apiFetch(`/conversations/${conversationId}`, { token }),
    enabled: !!token && !!conversationId,
    staleTime: 10 * 1000,
  });
}

export function useCreateGroup() {
  const token = useAuthStore((s) => s.accessToken);
  return useMutation({
    mutationFn: (body: { title: string; memberIds: string[]; avatarUrl?: string }) =>
      apiFetch<ChatSummary>('/conversations/group', { method: 'POST', body, token }),
  });
}

export function useUpdateGroup(conversationId: string) {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { title?: string; avatarUrl?: string | null }) =>
      apiFetch(`/conversations/${conversationId}`, { method: 'PATCH', body, token }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['conversation', conversationId] });
      qc.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

export function useAddGroupMembers(conversationId: string) {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (memberIds: string[]) =>
      apiFetch(`/conversations/${conversationId}/members`, { method: 'POST', body: { memberIds }, token }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['conversation', conversationId] });
      qc.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

export function useLeaveGroup() {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { conversationId: string; userId: string }) =>
      apiFetch(`/conversations/${vars.conversationId}/members/${vars.userId}`, { method: 'DELETE', token }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

export function useToggleReactionMsg(conversationId: string) {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { messageId: string; emoji: string }) =>
      apiFetch(`/conversations/${conversationId}/messages/${vars.messageId}/reaction`, { method: 'POST', body: { emoji: vars.emoji }, token }),
    onSuccess: (_d, vars) => {
      qc.setQueryData<{ items: ChatMessage[] } | undefined>(
        ['messages', conversationId],
        (old) => {
          if (!old) return old;
          return {
            ...old,
            items: old.items.map((m) => {
              if (m.id !== vars.messageId) return m;
              const reactions = [...(m.reactions ?? [])];
              const idx = reactions.findIndex((r) => r.emoji === vars.emoji);
              if (idx >= 0) {
                const mine = reactions[idx]!.mine;
                reactions[idx] = { ...reactions[idx]!, mine: !mine, count: mine ? reactions[idx]!.count - 1 : reactions[idx]!.count + 1 };
                if (reactions[idx]!.count <= 0) reactions.splice(idx, 1);
              } else {
                reactions.push({ emoji: vars.emoji, count: 1, mine: true });
              }
              return { ...m, reactions };
            }),
          };
        },
      );
    },
  });
}

export function useEditMessage(conversationId: string) {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { messageId: string; body: string }) =>
      apiFetch(`/conversations/${conversationId}/messages/${vars.messageId}`, { method: 'PATCH', body: { body: vars.body }, token }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['messages', conversationId] }),
  });
}

export function useDeleteMessage(conversationId: string) {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (messageId: string) =>
      apiFetch(`/conversations/${conversationId}/messages/${messageId}`, { method: 'DELETE', token }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['messages', conversationId] }),
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
export function useChatSocket(
  conversationId: string | undefined,
  handlers: {
    onIncomingCall?: (from: string, mode: 'audio' | 'video') => void;
    onTyping?: (status: 'start' | 'stop', userName: string) => void;
  } = {},
): {
  typingStart: () => void;
  typingStop: () => void;
  markRead: () => void;
} {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  const socketRef = useRef<Socket | null>(null);
  const typingRef = useRef<{ [uid: string]: number }>({});
  const incomingCallRef = useRef(handlers.onIncomingCall);
  const typingCbRef = useRef(handlers.onTyping);

  useEffect(() => {
    incomingCallRef.current = handlers.onIncomingCall;
    typingCbRef.current = handlers.onTyping;
  }, [handlers.onIncomingCall, handlers.onTyping]);

  useEffect(() => {
    if (!token || !conversationId) return;

    const socket = io(API_URL, {
      auth: { token },
      // Prefer websocket; fall back to long-poll on hostile networks. When
      // both peers speak permessage-deflate the server compresses frames.
      transports: ['websocket', 'polling'],
      upgrade: true,
      reconnectionDelay: 1500,
      reconnectionDelayMax: 10_000,
      // Reduce reconnection storm on flaky Ethiopian mobile connections.
      reconnectionAttempts: Infinity,
      timeout: 20_000,
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

    socket.on('call:start', (data: { conversationId: string; from: string; mode: 'audio' | 'video' }) => {
      if (data.conversationId !== conversationId) return;
      incomingCallRef.current?.(data.from, data.mode);
    });

    const patchMessage = (msg: ChatMessage) => {
      qc.setQueryData<{ items: ChatMessage[] } | undefined>(
        ['messages', conversationId],
        (old) => {
          if (!old) return old;
          return { ...old, items: old.items.map((m) => (m.id === msg.id ? { ...m, ...msg } : m)) };
        },
      );
    };

    // Remote typing indicator (live). Server relays { conversationId, userId }.
    socket.on('typing:start', (d: { conversationId: string; userId: string }) => {
      if (d.conversationId !== conversationId) return;
      typingCbRef.current?.('start', d.userId);
    });
    socket.on('typing:stop', (d: { conversationId: string; userId: string }) => {
      if (d.conversationId !== conversationId) return;
      typingCbRef.current?.('stop', d.userId);
    });

    // Live reaction chip update.
    socket.on('message:reaction', (d: { conversationId: string; messageId: string; emoji: string; added: boolean }) => {
      if (d.conversationId !== conversationId) return;
      qc.setQueryData<{ items: ChatMessage[] } | undefined>(
        ['messages', conversationId],
        (old) => {
          if (!old) return old;
          return {
            ...old,
            items: old.items.map((m) => {
              if (m.id !== d.messageId) return m;
              const reactions = [...(m.reactions ?? [])];
              const idx = reactions.findIndex((r) => r.emoji === d.emoji);
              if (d.added) {
                if (idx >= 0) reactions[idx] = { ...reactions[idx]!, count: reactions[idx]!.count + 1 };
                else reactions.push({ emoji: d.emoji, count: 1, mine: false });
              } else if (idx >= 0) {
                if (reactions[idx]!.count <= 1) reactions.splice(idx, 1);
                else reactions[idx] = { ...reactions[idx]!, count: reactions[idx]!.count - 1 };
              }
              return { ...m, reactions };
            }),
          };
        },
      );
    });

    // Live edit / delete.
    socket.on('message:edit', (d: { conversationId: string; message: ChatMessage }) => {
      if (d.conversationId !== conversationId) return;
      patchMessage(d.message);
    });
    socket.on('message:delete', (d: { conversationId: string; message: ChatMessage }) => {
      if (d.conversationId !== conversationId) return;
      patchMessage({ ...d.message, body: null, attachmentUrl: null, deletedAt: new Date().toISOString() });
    });

    // Group updates + read receipts refresh the list.
    socket.on('conversation:updated', () => qc.invalidateQueries({ queryKey: ['conversations'] }));
    socket.on('conversation:read', () => {
      // Someone read; re-fetch message read receipts lazily.
      qc.invalidateQueries({ queryKey: ['messages', conversationId] });
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
