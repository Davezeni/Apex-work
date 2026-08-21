'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Send, Loader2, Phone, FileText, PlayCircle, Mic } from 'lucide-react';
import { cn, timeAgo } from '@/lib/utils';
import { useMessages, useSendMessage, useChatSocket, type ChatMessage } from '@/hooks/use-chat';
import { useMe } from '@/hooks/use-me';
import { VoiceRecorder } from '@/components/chat/voice-recorder';
import { AttachButton } from '@/components/chat/attach-button';
import { useI18n } from '@/i18n';

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
  const { t } = useI18n();
  const [text, setText] = useState('');
  const [composerMode, setComposerMode] = useState<'text' | 'voice'>('text');
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
          {composerMode === 'voice' ? (
            <VoiceRecorder
              onSend={async (att) => {
                await send.mutateAsync({
                  attachmentUrl: att.url,
                  attachmentType: 'audio',
                });
                setComposerMode('text');
              }}
            />
          ) : (
            <>
              <AttachButton
                disabled={send.isPending}
                onAttached={async (att) => {
                  await send.mutateAsync({
                    attachmentUrl: att.url,
                    attachmentType: att.type === 'image' ? 'image' : 'file',
                  });
                }}
              />
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
                placeholder={t('chat.typePlaceholder')}
                className="flex-1 resize-none rounded-2xl border border-border bg-card px-4 py-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/20"
                style={{ maxHeight: '120px' }}
              />
              {text.trim() ? (
                <button
                  onClick={() => void handleSend()}
                  disabled={send.isPending}
                  aria-label={t('common.post')}
                  className="grad-hero grid h-11 w-11 shrink-0 place-items-center rounded-full text-white shadow-md shadow-primary/40 transition-transform active:scale-90 disabled:opacity-40"
                >
                  {send.isPending ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Send className="h-5 w-5" />
                  )}
                </button>
              ) : (
                <button
                  onClick={() => setComposerMode('voice')}
                  aria-label={t('chat.voice')}
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-muted-foreground transition-transform active:scale-90 hover:bg-muted hover:text-foreground"
                >
                  <Mic className="h-5 w-5" />
                </button>
              )}
            </>
          )}
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
  const isImage = m.attachmentType === 'image';
  const isAudio = m.attachmentType === 'audio';
  const isFile = m.attachmentType === 'file' || m.attachmentType === 'video';
  const hasAttachment = !!m.attachmentUrl;

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
          'max-w-[80%] overflow-hidden rounded-2xl text-sm leading-snug',
          // Image bubbles are edge-to-edge; text/file bubbles keep padding.
          isImage ? 'p-0' : 'px-3.5 py-2',
          isMine
            ? 'grad-hero rounded-br-md text-white shadow-md shadow-primary/30'
            : 'rounded-bl-md bg-card text-foreground',
        )}
      >
        {isImage && m.attachmentUrl && (
          <a href={m.attachmentUrl} target="_blank" rel="noreferrer" className="block">
            <div className="relative aspect-[4/3] w-64 max-w-full bg-black/20">
              <Image
                src={m.attachmentUrl}
                alt="Attachment"
                fill
                sizes="256px"
                className="object-cover"
                unoptimized
              />
            </div>
          </a>
        )}

        {isAudio && m.attachmentUrl && (
          <div className="flex items-center gap-2">
            <PlayCircle
              className={cn('h-5 w-5 shrink-0', isMine ? 'text-white' : 'text-primary')}
              aria-hidden
            />
            <audio
              src={m.attachmentUrl}
              controls
              preload="metadata"
              className="h-8 flex-1 max-w-[220px]"
            />
          </div>
        )}

        {isFile && m.attachmentUrl && (
          <a
            href={m.attachmentUrl}
            target="_blank"
            rel="noreferrer"
            className={cn(
              'flex items-center gap-2 text-sm font-semibold',
              isMine ? 'text-white' : 'text-primary',
            )}
          >
            <FileText className="h-5 w-5" />
            <span className="truncate">{humanFileName(m.attachmentUrl)}</span>
          </a>
        )}

        {m.body && (
          <p className={cn('whitespace-pre-wrap break-words', isImage && 'p-3')}>{m.body}</p>
        )}

        <div
          className={cn(
            'text-[10px] font-medium',
            isImage ? 'px-3 pb-2' : 'mt-1',
            isMine ? 'text-white/70' : 'text-muted-foreground',
            hasAttachment && !m.body && !isImage && 'mt-1',
          )}
        >
          {timeAgo(m.createdAt)}
        </div>
      </div>
    </div>
  );
}

/** Pull the last path segment (usually a random slug + original filename). */
function humanFileName(url: string): string {
  try {
    const path = new URL(url).pathname;
    const seg = path.split('/').pop() ?? url;
    // Drop our 12-char random prefix ("abc123def456-")
    return seg.replace(/^[a-zA-Z0-9]{6,12}-/, '');
  } catch {
    return url;
  }
}
