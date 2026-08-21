'use client';

import Link from 'next/link';
import { MobileShell } from '@/components/mobile/mobile-shell';
import { Search, Edit3, Loader2, MessageCircleOff } from 'lucide-react';
import { cn, timeAgo } from '@/lib/utils';
import { useConversations, type ChatSummary } from '@/hooks/use-chat';
import { useMe } from '@/hooks/use-me';
import { Button } from '@/components/ui/button';
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

export default function MessagesPage() {
  const { data: me, isAuthed } = useMe();
  const { data, isLoading, error } = useConversations();
  const { t } = useI18n();

  if (!isAuthed) {
    return (
      <MobileShell activeTab="chat">
        <div className="flex min-h-[80dvh] flex-col items-center justify-center px-6 text-center">
          <MessageCircleOff className="h-12 w-12 text-muted-foreground" />
          <h2 className="mt-4 text-xl font-extrabold">{t('chat.signInPrompt')}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{t('chat.signInBody')}</p>
          <Button asChild variant="brand" size="lg" className="mt-6">
            <Link href="/login">{t('nav.signIn')}</Link>
          </Button>
        </div>
      </MobileShell>
    );
  }

  return (
    <MobileShell activeTab="chat">
      <header className="safe-top flex items-center justify-between px-5 pb-3 pt-4">
        <h1 className="text-2xl font-extrabold tracking-tight">{t('chat.messages')}</h1>
        <div className="flex gap-2">
          <button
            aria-label="Search"
            className="grid h-10 w-10 place-items-center rounded-full border border-border bg-card"
          >
            <Search className="h-4 w-4" />
          </button>
          <button
            aria-label="New"
            className="grid h-10 w-10 place-items-center rounded-full border border-border bg-card"
          >
            <Edit3 className="h-4 w-4" />
          </button>
        </div>
      </header>

      {isLoading && (
        <div className="grid h-40 place-items-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {error && !isLoading && (
        <div className="mx-5 mt-6 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {t('chat.loadFailed')}
        </div>
      )}

      {!isLoading && (data?.items.length ?? 0) === 0 && (
        <div className="mx-5 mt-10 rounded-2xl border border-dashed border-border p-8 text-center">
          <div className="text-4xl">💬</div>
          <p className="mt-3 text-sm font-semibold">{t('chat.noConversations')}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t('chat.noConversationsBody')}</p>
          <Button asChild variant="brand" size="sm" className="mt-5">
            <Link href="/">{t('chat.exploreGigs')}</Link>
          </Button>
        </div>
      )}

      <div className="px-2 pb-4">
        {data?.items.map((c) => <ConvRow key={c.id} c={c} selfId={me?.id ?? ''} />)}
      </div>
    </MobileShell>
  );
}

function ConvRow({ c, selfId: _selfId }: { c: ChatSummary; selfId: string }) {
  const { t } = useI18n();
  const peer = c.peer;
  const name = peer?.fullName ?? c.title ?? 'Conversation';
  const previewByType: Record<string, string> = {
    image: `🖼️ ${t('chat.photo')}`,
    audio: `🎤 ${t('chat.voice')}`,
    video: `🎬 ${t('chat.file')}`,
    file: `📎 ${t('chat.file')}`,
  };
  const preview = c.lastMessage?.body
    ? c.lastMessage.body
    : c.lastMessage?.attachmentType
      ? previewByType[c.lastMessage.attachmentType] ?? `📎 ${t('chat.file')}`
      : t('chat.sayHi');
  const when = c.lastMessageAt ? timeAgo(c.lastMessageAt) : '';
  const gradient = peer ? gradientFor(peer.id) : gradientFor(c.id);

  return (
    <Link
      href={`/messages/${c.id}`}
      className="flex items-center gap-3 rounded-2xl p-3 active:bg-card"
    >
      <div className="relative">
        <div
          className={cn(
            'grid h-[52px] w-[52px] place-items-center rounded-full bg-gradient-to-br text-lg font-bold text-white',
            gradient,
          )}
        >
          {initialsOf(name)}
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <h4 className="truncate text-[15px] font-semibold">{name}</h4>
          <span className="shrink-0 text-[11px] text-muted-foreground">{when}</span>
        </div>
        <div className="mt-1 flex items-center justify-between gap-2">
          <p className="truncate text-[13px] text-muted-foreground">{preview}</p>
          {c.unread > 0 && (
            <span className="grid h-[22px] min-w-[22px] shrink-0 place-items-center rounded-full bg-primary px-2 text-[11px] font-bold text-primary-foreground">
              {c.unread}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
