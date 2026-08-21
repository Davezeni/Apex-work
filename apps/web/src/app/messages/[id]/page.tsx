'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Send, Loader2, Paperclip, Phone } from 'lucide-react';
import { cn, timeAgo } from '@/lib/utils';
import { useMessages, useSendMessage, useChatSocket, type ChatMessage } from '@/hooks/use-chat';
import { useMe } from '@/hooks/use-me';

const AVATAR_GRADIENTS = [
  'from-violet-500 to-emerald-500',
  'from-amber-500 to-red-500',
  'from-cyan-500 to-violet-500',
  'from-emerald-500 to-amber-500',
  'from-red-500 to-violet-500',
];
function gradientFor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return AVATAR_GRADIENTS[Math.abs(h) % AVATAR_GRADIENTS.length]!;
}
function initialsOf(name: string): string {
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?';
}

export default function ConversationPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: me } = useMe();
  const { data, isLoading, error } = useMessages(id);
  const send = useSendMessage(id);
  const socket = useChatSocket(id);
  const [text, setText] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const messages = data?.items ?? [];
  const peer = messages.find((m) => m.senderId !== me?.id)?.sender ?? null;

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    // Wait one frame for layout, then scroll
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  }, [messages.length]);

  // Mark as read whenever we open / receive
  useEffect(() => {
    if (messages.length > 0) socket.markRead();
  }, [messages.length, socket]);

  const handleSend = async () => {
    const body = text.trim();
    if (!body || send.isPending) return;
    setText('');
    socket.typingStop();
    try {
      await send.mutateAsync(body);
    } catch {
      // restore text on failure so user doesn't lose their draft
      setText(body);
    }
  };

  const handleTextChange = (v: string) => {
    setText(v);
    if (v.trim().length > 0) {
      socket.typingStart();
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => socket.typingStop(), 2000);
    } else {
      socket.typingStop();
    }
  };

  return (
    <div className="flex h-dvh flex-col bg-background">
      {/* Header */}
      <header className="safe-top sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-background/95 px-3 py-3 backdrop-blur-xl">
        <button
          onClick={() => router.back()}
          className="grid h-9 w-9 place-items-center rounded-full active:scale-90"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        {peer ? (
          <Link
            href={`/u/${peer.username}`}
            className={cn(
              'grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br text-sm font-bold text-white',
              gradientFor(peer.id),
            )}
          >
            {initialsOf(peer.fullName)}
          </Link>
        ) : (
          <div className="grad-hero grid h-10 w-10 place-items-center rounded-full text-sm font-bold text-white">
            ?
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h4 className="truncate text-sm font-semibold">{peer?.fullName ?? 'Conversation'}</h4>
          {peer && <p className="text-[11px] text-muted-foreground">@{peer.username}</p>}
        </div>
        <button
          aria-label="Call"
          className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground active:scale-90"
        >
          <Phone className="h-5 w-5" />
        </button>
      </header>

      {/* Message list */}
      <div
        ref={listRef}
        className="flex-1 space-y-2 overflow-y-auto px-3 py-4"
        aria-live="polite"
      >
        {isLoading && (
          <div className="grid h-full place-items-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
        {error && !isLoading && (
          <div className="mx-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            Could not load messages.
          </div>
        )}
        {!isLoading && messages.length === 0 && (
          <div className="grid h-full place-items-center text-center text-muted-foreground">
            <div>
              <div className="text-3xl">👋</div>
              <p className="mt-2 text-sm">Say hi to start the conversation</p>
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <MessageBubble
            key={m.id}
            m={m}
            isMine={m.senderId === me?.id}
            showAvatar={
              m.senderId !== me?.id &&
              (i === 0 || messages[i - 1]?.senderId !== m.senderId)
            }
          />
        ))}
      </div>

      {/* Composer */}
      <div className="safe-bottom sticky bottom-0 z-10 border-t border-border bg-background/95 px-2 py-2 backdrop-blur-xl">
        <div className="mx-auto flex max-w-md items-end gap-2">
          <button
            aria-label="Attach"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-muted-foreground active:scale-90"
          >
            <Paperclip className="h-5 w-5" />
          </button>
          <textarea
            value={text}
            onChange={(e) => handleTextChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void handleSend();
              }
            }}
            rows={1}
            placeholder="Type a message…"
            className="flex-1 resize-none rounded-2xl border border-border bg-card px-4 py-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/20"
            style={{ maxHeight: '120px' }}
          />
          <button
            onClick={() => void handleSend()}
            disabled={!text.trim() || send.isPending}
            aria-label="Send"
            className={cn(
              'grid h-11 w-11 shrink-0 place-items-center rounded-full text-white transition-transform active:scale-90 disabled:opacity-40',
              text.trim() ? 'grad-hero shadow-md shadow-primary/40' : 'bg-muted-foreground',
            )}
          >
            {send.isPending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({
  m,
  isMine,
  showAvatar,
}: {
  m: ChatMessage;
  isMine: boolean;
  showAvatar: boolean;
}) {
  return (
    <div className={cn('flex items-end gap-2', isMine ? 'justify-end' : 'justify-start')}>
      {!isMine && (
        <div className={cn('w-8 shrink-0', showAvatar ? '' : 'invisible')}>
          {showAvatar && (
            <div
              className={cn(
                'grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br text-[11px] font-bold text-white',
                gradientFor(m.sender.id),
              )}
            >
              {initialsOf(m.sender.fullName)}
            </div>
          )}
        </div>
      )}
      <div
        className={cn(
          'max-w-[80%] rounded-2xl px-3.5 py-2 text-sm leading-snug',
          isMine
            ? 'grad-hero rounded-br-md text-white shadow-md shadow-primary/30'
            : 'rounded-bl-md bg-card text-foreground',
        )}
      >
        {m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
        <div
          className={cn(
            'mt-1 text-[10px] font-medium',
            isMine ? 'text-white/70' : 'text-muted-foreground',
          )}
        >
          {timeAgo(m.createdAt)}
        </div>
      </div>
    </div>
  );
}
