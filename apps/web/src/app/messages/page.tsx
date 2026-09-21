'use client';

import { dt } from '@/i18n/auto';
import Link from 'next/link';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { MobileShell } from '@/components/mobile/mobile-shell';
import {
  Search,
  Edit3,
  Loader2,
  MessageCircleOff,
  Pin,
  Archive,
  Undo2,
  PinOff,
  Inbox,
  ChevronDown,
  MoreHorizontal,
} from 'lucide-react';
import { cn, timeAgo } from '@/lib/utils';
import { getPinned, getArchived, togglePinned, toggleArchived } from '@/lib/conversation-local';
import { useConversations, useSavedMessages, type ChatSummary } from '@/hooks/use-chat';
import { useInboxTyping } from '@/hooks/use-inbox-typing';
import { Bookmark } from 'lucide-react';
import { useMe } from '@/hooks/use-me';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n';
import { gradientFor } from '@/components/ui/avatar-gradient';
import { UserAvatar } from '@/components/ui/user-avatar';
/** Build marker shown in the inbox header so users/reviewers can confirm a
 *  given device is running the latest deployed bundle (helps catch a stale
 *  service-worker cache). */
const APP_BUILD = '2026-09-09.142';

export default function MessagesPage() {
  const { data: me, isAuthed } = useMe();
  const { data, isLoading, error } = useConversations();
  const { data: saved } = useSavedMessages();
  const { typing } = useInboxTyping();
  const { t } = useI18n();
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const uid = me?.id ?? '';
  const filteredItems = (data?.items ?? []).filter((conversation) => {
    const haystack =
      `${conversation.peer?.fullName ?? ''} ${conversation.title ?? ''}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  });
  const [pinned, setPinned] = useState<Record<string, true>>(() => getPinned(uid));
  const [archived, setArchived] = useState<Record<string, true>>(() => getArchived(uid));
  const [archiveOpen, setArchiveOpen] = useState(false);
  // Re-read prefs when the user id becomes available.
  useEffect(() => {
    if (uid) {
      setPinned(getPinned(uid));
      setArchived(getArchived(uid));
    }
  }, [uid]);
  const pickPin = (convId: string) => setPinned({ ...togglePinned(uid, convId) });
  const pickArchive = (convId: string) => setArchived({ ...toggleArchived(uid, convId) });

  const groups = useMemo(() => {
    const visible = filteredItems.filter((c) => !archived[c.id]);
    return {
      pinned: visible.filter((c) => pinned[c.id]),
      unread: visible.filter((c) => !pinned[c.id] && c.unread > 0),
      recent: visible.filter((c) => !pinned[c.id] && c.unread === 0),
      archived: filteredItems.filter((c) => archived[c.id]),
    };
  }, [filteredItems, pinned, archived]);

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
      <header className="safe-top mx-auto flex w-full max-w-2xl items-center justify-between px-5 pb-3 pt-4 md:pt-6">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">{t('chat.messages')}</h1>
          <span className="text-[10px] font-semibold text-muted-foreground/50">
            build {APP_BUILD}
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setSearchOpen((open) => !open);
              if (searchOpen) setQuery('');
            }}
            aria-label={dt('Search conversations')}
            aria-pressed={searchOpen}
            className={cn(
              'grid h-10 w-10 place-items-center rounded-full border border-border bg-card',
              searchOpen && 'border-primary text-primary',
            )}
          >
            <Search className="h-4 w-4" />
          </button>
          <Link
            href="/messages/new-group"
            aria-label={dt('New group')}
            className="grid h-10 w-10 place-items-center rounded-full border border-border bg-card"
          >
            <Edit3 className="h-4 w-4" />
          </Link>
        </div>
      </header>

      {searchOpen && (
        <div className="px-4 pt-3">
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={dt('Search your conversations…')}
            aria-label={dt('Search your conversations')}
            className="w-full rounded-full border border-border bg-card px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/20"
          />
        </div>
      )}

      <div className="mx-auto w-full max-w-2xl">
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
          {!searchOpen && saved?.id && (
            <Link
              href={`/messages/${saved.id}`}
              className="flex items-center gap-3 rounded-2xl p-3 active:bg-card"
            >
              <div
                className={`grid h-[52px] w-[52px] place-items-center rounded-full bg-gradient-to-br text-white ${gradientFor(saved.id)}`}
              >
                <Bookmark className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                {t('chat.savedMessages')}
                <p className="truncate text-[13px] text-muted-foreground">
                  Bookmark your notes, voice mutes &amp; files
                </p>
              </div>
            </Link>
          )}
          {searchOpen && query.trim() && filteredItems.length === 0 && (
            <p className="px-4 py-8 text-center text-xs text-muted-foreground">
              No conversations found.
            </p>
          )}

          {!searchOpen && (
            <Group
              label={t('chat.pinned')}
              icon={<Pin className="h-3.5 w-3.5" />}
              items={groups.pinned}
              render={(c) => (
                <ConvRow
                  key={c.id}
                  c={c}
                  selfId={me?.id ?? ''}
                  pinned
                  isTyping={!!typing[c.id]}
                  typingName={typing[c.id]?.name}
                  onPin={() => pickPin(c.id)}
                  onArchive={() => pickArchive(c.id)}
                />
              )}
            />
          )}
          {!searchOpen && (
            <Group
              label={t('chat.unread')}
              icon={
                <span className="grid h-4 w-4 place-items-center rounded-full bg-primary text-[9px] font-bold text-white">
                  {groups.unread.length}
                </span>
              }
              items={groups.unread}
              render={(c) => (
                <ConvRow
                  key={c.id}
                  c={c}
                  selfId={me?.id ?? ''}
                  isTyping={!!typing[c.id]}
                  typingName={typing[c.id]?.name}
                  onPin={() => pickPin(c.id)}
                  onArchive={() => pickArchive(c.id)}
                />
              )}
            />
          )}
          {!searchOpen && (
            <Group
              label={t('chat.recent')}
              icon={<Inbox className="h-3.5 w-3.5" />}
              items={groups.recent}
              render={(c) => (
                <ConvRow
                  key={c.id}
                  c={c}
                  selfId={me?.id ?? ''}
                  isTyping={!!typing[c.id]}
                  typingName={typing[c.id]?.name}
                  onPin={() => pickPin(c.id)}
                  onArchive={() => pickArchive(c.id)}
                />
              )}
            />
          )}
          {searchOpen &&
            filteredItems.map((c) => (
              <ConvRow
                key={c.id}
                c={c}
                selfId={me?.id ?? ''}
                isTyping={!!typing[c.id]}
                typingName={typing[c.id]?.name}
                onPin={() => pickPin(c.id)}
                onArchive={() => pickArchive(c.id)}
              />
            ))}

          {!searchOpen && groups.archived.length > 0 && (
            <div>
              <button
                onClick={() => setArchiveOpen((v) => !v)}
                className="flex w-full items-center gap-2 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground"
              >
                <Archive className="h-3.5 w-3.5" /> {t('chat.archived')} ({groups.archived.length})
                <ChevronDown
                  className={cn(
                    'ml-auto h-3.5 w-3.5 transition-transform',
                    archiveOpen && 'rotate-180',
                  )}
                />
              </button>
              {archiveOpen &&
                groups.archived.map((c) => (
                  <ConvRow
                    key={c.id}
                    c={c}
                    selfId={me?.id ?? ''}
                    isTyping={!!typing[c.id]}
                    typingName={typing[c.id]?.name}
                    onPin={() => pickPin(c.id)}
                    onArchive={() => pickArchive(c.id)}
                  />
                ))}
            </div>
          )}
        </div>
      </div>
    </MobileShell>
  );
}

function Group({
  label,
  icon,
  items,
  render,
}: {
  label: string;
  icon?: ReactNode;
  items: ChatSummary[];
  render: (c: ChatSummary) => ReactNode;
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
        {icon} {label}
      </div>
      {items.map(render)}
    </div>
  );
}

function ConvRow({
  c,
  pinned,
  isTyping,
  typingName,
  onPin,
  onArchive,
  selfId: _selfId,
}: {
  c: ChatSummary;
  pinned?: boolean;
  isTyping?: boolean;
  typingName?: string | null;
  onPin?: () => void;
  onArchive?: () => void;
  selfId: string;
}) {
  const { t } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);
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
      ? (previewByType[c.lastMessage.attachmentType] ?? `📎 ${t('chat.file')}`)
      : t('chat.sayHi');
  const when = c.lastMessageAt ? timeAgo(c.lastMessageAt) : '';

  return (
    <div className="relative">
      <Link
        href={`/messages/${c.id}`}
        className="group flex items-center gap-3 rounded-2xl p-3 pr-12 active:bg-card"
      >
        <div className="relative">
          <UserAvatar
            name={name}
            avatarUrl={peer?.avatarUrl ?? null}
            id={peer?.id ?? c.id}
            className="h-[52px] w-[52px] text-lg font-bold"
          />
          {!c.isGroup && peer?.online && (
            <span
              className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background bg-emerald-500"
              title={dt('Online')}
            />
          )}
          {c.isGroup && (
            <span className="absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full border-2 border-background bg-primary text-[9px] font-bold text-white">
              G
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {pinned && <Pin className="h-3 w-3 shrink-0 text-primary" />}
            <h4 className="truncate text-[15px] font-semibold">{name}</h4>
            <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">{when}</span>
          </div>
          <div className="mt-1 flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-1">
              {isTyping ? (
                <span className="flex items-center gap-1.5 truncate text-[13px] font-semibold text-primary">
                  <span className="flex shrink-0 gap-0.5">
                    <span className="typing-dot h-1.5 w-1.5" style={{ animationDelay: '0ms' }} />
                    <span className="typing-dot h-1.5 w-1.5" style={{ animationDelay: '150ms' }} />
                    <span className="typing-dot h-1.5 w-1.5" style={{ animationDelay: '300ms' }} />
                  </span>
                  <span className="truncate">
                    {c.isGroup && typingName
                      ? `${typingName} ${t('chat.isTyping')}`
                      : t('chat.isTyping')}
                  </span>
                </span>
              ) : (
                <p className="truncate text-[13px] text-muted-foreground">{preview}</p>
              )}
            </div>
            {c.unread > 0 && (
              <span className="grid h-[22px] min-w-[22px] shrink-0 place-items-center rounded-full bg-primary px-2 text-[11px] font-bold text-primary-foreground">
                {c.unread}
              </span>
            )}
          </div>
        </div>
      </Link>

      {onPin && onArchive && (
        <div className="absolute right-1 top-1/2 -translate-y-1/2">
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setMenuOpen((v) => !v);
            }}
            aria-label={dt('Conversation actions')}
            aria-pressed={menuOpen}
            className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-muted active:scale-90"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
          {menuOpen && (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setMenuOpen(false);
                }}
              />
              <div className="absolute right-0 top-9 z-40 w-44 overflow-hidden rounded-xl border border-border bg-card shadow-xl">
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onPin();
                    setMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm active:bg-muted"
                >
                  {pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                  {pinned ? t('chat.unpin') : t('chat.pin')}
                </button>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onArchive();
                    setMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm active:bg-muted"
                >
                  <Undo2 className="h-4 w-4" /> {t('chat.archive')}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
