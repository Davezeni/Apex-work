'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Edit3, Search, MessageCircleOff, Loader2, Users } from 'lucide-react';
import { cn, timeAgo } from '@/lib/utils';
import { useConversations, useSavedMessages, type ChatSummary } from '@/hooks/use-chat';
import { useInboxTyping } from '@/hooks/use-inbox-typing';
import { UserAvatar } from '@/components/ui/user-avatar';
import { useI18n } from '@/i18n';

/**
 * Desktop-only conversation rail.
 *
 * A compact, always-visible inbox list beside an open thread on large
 * screens, completing the two-pane desktop messenger. Hidden on mobile
 * (`hidden lg:flex`), where the full-screen inbox and thread are separate
 * routes.
 */
export function DesktopConversationRail() {
  const { t } = useI18n();
  const { data, isLoading } = useConversations();
  const { data: saved } = useSavedMessages();
  const { typing } = useInboxTyping();
  const router = useRouter();
  const params = useParams<{ id?: string }>();
  const activeId = params?.id;

  const [query, setQuery] = useState('');

  const savedId: string | null | undefined = saved?.id ?? undefined;
  const savedCount = saved?.isSaved ? 1 : 0;

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = (data?.items ?? [])
      .filter((c) => !c.isSaved)
      .filter((c) => {
        if (!q) return true;
        const hay = `${c.peer?.fullName ?? ''} ${c.title ?? ''}`.toLowerCase();
        return hay.includes(q);
      });
    return [...list].sort((a, b) => {
      const an = a.unread > 0 ? 1 : 0;
      const bn = b.unread > 0 ? 1 : 0;
      if (an !== bn) return bn - an;
      return (
        new Date(b.updatedAt || b.lastMessageAt || 0).getTime() -
        new Date(a.updatedAt || a.lastMessageAt || 0).getTime()
      );
    });
  }, [data?.items, query]);

  const typingFor = (convId: string): string | null => typing[convId]?.name ?? null;

  const nameOf = (c: { title: string | null; peer: { fullName: string } | null }) =>
    c.title ?? c.peer?.fullName ?? '';

  const isEmpty = !isLoading && items.length === 0 && !query;

  return (
    <aside className="sticky top-0 hidden h-dvh w-[300px] shrink-0 flex-col border-r border-border bg-card/40 backdrop-blur-xl lg:flex">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <h2 className="flex-1 text-base font-bold tracking-tight">{t('nav.chat')}</h2>
        <button
          type="button"
          aria-label={t('chat.startConv')}
          onClick={() => setQuery('')}
          className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-card text-foreground transition-colors hover:bg-muted"
        >
          <Edit3 className="h-4 w-4" />
        </button>
      </div>

      {/* Search */}
      <div className="border-b border-border px-3 py-2.5">
        <div className="flex items-center gap-2 rounded-lg border border-border bg-background/60 px-2.5 transition-colors focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10">
          <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('chat.searchInConvo')}
            className="h-9 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-2">
        {isLoading ? (
          <div className="flex h-24 items-center justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : isEmpty ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
            <MessageCircleOff className="h-6 w-6 text-muted-foreground/60" />
            <p className="text-xs text-muted-foreground">{t('chat.noConversations')}</p>
            <p className="text-xs text-muted-foreground/70">{t('chat.noConversationsBody')}</p>
          </div>
        ) : (
          <ul className="space-y-0.5">
            {items.map((c: ChatSummary) => {
              const active = c.id === activeId;
              const typingName = typingFor(c.id);
              const last = c.lastMessage;
              return (
                <li key={c.id}>
                  <Link
                    href={`/messages/${c.id}`}
                    className={cn(
                      'group relative flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 transition-colors',
                      active ? 'bg-primary/10' : 'hover:bg-muted',
                    )}
                  >
                    {active && (
                      <motion.span
                        layoutId="convo-active"
                        className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-primary"
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      />
                    )}
                    <div className="relative shrink-0">
                      <UserAvatar
                        name={nameOf(c)}
                        avatarUrl={c.peer?.avatarUrl ?? null}
                        className="h-11 w-11 rounded-full text-sm"
                      />
                      {c.peer?.online && (
                        <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card bg-emerald-500" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-semibold">{nameOf(c)}</p>
                        {c.unread > 0 && (
                          <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                            {c.unread > 99 ? '99+' : c.unread}
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 flex items-center gap-2">
                        {typingName ? (
                          <span className="truncate text-xs italic text-primary">
                            {typingName}…
                          </span>
                        ) : (
                          <p className="truncate text-xs text-muted-foreground">
                            {last
                              ? (last.body ?? (last.attachmentType ? t('chat.attachment') : ''))
                              : ''}
                          </p>
                        )}
                        {c.lastMessageAt && (
                          <span className="ml-auto shrink-0 text-[10px] tabular-nums text-muted-foreground/70">
                            {timeAgo(c.lastMessageAt)}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Saved messages short link */}
      {savedId && (
        <div className="border-t border-border p-2">
          <Link
            href={`/messages/${savedId}`}
            className={cn(
              'flex items-center gap-3 rounded-xl px-2.5 py-2 text-sm transition-colors',
              activeId === savedId ? 'bg-primary/10' : 'hover:bg-muted',
            )}
          >
            <span className="grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-foreground">
              <Users className="h-4 w-4" />
            </span>
            <span className="font-semibold">{t('chat.savedMessages')}</span>
            <span className="ml-auto text-xs text-muted-foreground">{savedCount}</span>
          </Link>
        </div>
      )}

      {/* Compose CTA */}
      <div className="border-t border-border p-3">
        <button
          type="button"
          onClick={() => router.push('/messages/new-group')}
          className="w-full rounded-lg bg-primary py-2 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/20 transition-all hover:shadow-lg hover:brightness-110 active:scale-[0.99]"
        >
          {t('chat.startConv')}
        </button>
      </div>
    </aside>
  );
}
