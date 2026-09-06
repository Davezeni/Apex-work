'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Send, Loader2, Phone, PhoneIncoming, Video as VideoIcon, FileText, PlayCircle, Mic, MoreVertical, Flag, ShieldOff, Package, SmilePlus, Reply, X, Images, Pencil, Trash2, Users, UserPlus, Check, CheckCheck, LogOut, Bell, BellOff, Pin, Search, Forward, Mail, Bookmark, MoreHorizontal, Copy, Smile, Link2, Zap, Plus, Download } from 'lucide-react';
import { CallPanel } from '@/components/chat/call-panel';
import { cn, timeAgo } from '@/lib/utils';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import { useMessages, useSendMessage, useChatSocket, useConversation, useConversations, useSavedMessages, useAddGroupMembers, useLeaveGroup, useUpdateGroup, useEditMessage, useDeleteMessage, useMuteConversation, useMarkUnread, useForwardMessage, usePinMessage, useSearchMessages, useLoadOlder, useGroupInvite, useSavedReplies, type ChatMessage } from '@/hooks/use-chat';
import { useMe } from '@/hooks/use-me';
import { VoiceRecorder } from '@/components/chat/voice-recorder';
import { AttachButton } from '@/components/chat/attach-button';
import { ReactionPicker } from '@/components/chat/reaction-picker';
import {
  LazyCustomOfferSheet as CustomOfferSheet,
  LazyOfferCard as OfferCard,
  LazyReportUserSheet as ReportUserSheet,
  LazyImageViewer as ImageViewer,
} from '@/components/lazy';
import { useBlockUser } from '@/hooks/use-moderation';
import { useToggleReaction } from '@/hooks/use-reactions';
import { useMessageDraft } from '@/hooks/use-drafts';
import { useOutboxSync } from '@/hooks/use-outbox';
import { toast } from 'sonner';
import { useI18n } from '@/i18n';
import type { ReactionEmoji } from '@apex-work/shared';

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

const EMOJI_QUICK = [
  '😀','😄','😂','🤣','😊','😍','😘','😎','🤔','😅',
  '👍','👎','👏','🙏','💪','🤝','✌️','🙌','👌','🤙',
  '❤️','🔥','🎉','✅','⭐','💯','😢','😡','🤯','🥳',
  '🚀','💡','📌','📈','💰','🌍','🤗','😇','🥰','😴',
];

function dateKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}
function dateLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86_400_000);
  const same = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (same(d, today)) return 'Today';
  if (same(d, yesterday)) return 'Yesterday';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: d.getFullYear() !== today.getFullYear() ? 'numeric' : undefined });
}

export default function ConversationPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: me } = useMe();
  const token = useAuthStore((s) => s.accessToken);
  const { data, isLoading, error } = useMessages(id);
  const { data: conv } = useConversation(id);
  const messages = data?.items ?? [];
  const peer = messages.find((m) => m.senderId !== me?.id)?.sender ?? null;
  const send = useSendMessage(id);
  const addMembers = useAddGroupMembers(id);
  const leaveGroup = useLeaveGroup();
  const renameGroup = useUpdateGroup(id);
  const editMessage = useEditMessage(id);
  const deleteMessage = useDeleteMessage(id);
  const muteConversation = useMuteConversation(id);
  const markUnread = useMarkUnread();
  const forwardMessage = useForwardMessage(id);
  const pinMessage = usePinMessage(id);
  const searchMessages = useSearchMessages(id);
  const { older, hasMore, loading, loadOlder } = useLoadOlder(id);
  const groupInvite = useGroupInvite(id);
  const { replies, addReply, removeReply } = useSavedReplies();
  const [quickRepliesOpen, setQuickRepliesOpen] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [typingUsers, setTypingUsers] = useState<Record<string, number>>({});
  const [presence, setPresence] = useState<Record<string, boolean>>({});
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState<ChatMessage[]>([]);
  useEffect(() => {
    if (!searchOpen || searchQ.trim().length < 2) { setSearchResults([]); return; }
    const timer = setTimeout(() => {
      searchMessages.mutate(searchQ.trim(), {
        onSuccess: (r) => setSearchResults(r.items ?? []),
        onError: () => setSearchResults([]),
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQ, searchOpen, searchMessages]);
  const socket = useChatSocket(id, {
    onIncomingCall: (from, mode) => setIncoming({ from, mode }),
    onTyping: (status, userId) => {
      setTypingUsers((prev) => {
        const next = { ...prev };
        if (status === 'start') {
          next[userId] = Date.now() + 3500;
        } else {
          delete next[userId];
        }
        return next;
      });
    },
    onPresence: (userId, online) => setPresence((prev) => ({ ...prev, [userId]: online })),
  });
  // Seed presence from the fetched conversation, then keep it live.
  useEffect(() => {
    const map: Record<string, boolean> = {};
    conv?.members?.forEach((m) => { if (typeof m.online === 'boolean') map[m.userId] = m.online; });
    if (peer) map[peer.id] = !!peer.online;
    setPresence((prev) => ({ ...prev, ...map }));
  }, [conv, peer]);
  const { t } = useI18n();
  const draft = useMessageDraft(id);
  const text = draft.text;
  const setText = draft.setText;
  const [composerMode, setComposerMode] = useState<'text' | 'voice'>('text');
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [offerSheetOpen, setOfferSheetOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [reactingId, setReactingId] = useState<string | null>(null);
  const [membersOpen, setMembersOpen] = useState(false);
  const [forwardMsg, setForwardMsg] = useState<ChatMessage | null>(null);
  const [actionMsg, setActionMsg] = useState<ChatMessage | null>(null);
  const { data: convs } = useConversations();
  const { data: savedConv } = useSavedMessages();
  const forwardTo = (m: ChatMessage) => setForwardMsg(m);
  const saveMessage = (m: ChatMessage) => {
    if (!savedConv?.id) { toast.error(t('chat.errorNoSaved')); return; }
    forwardMessage.mutate(
      { messageId: m.id, targetConversationId: savedConv.id },
      { onSuccess: () => toast.success(t('chat.saved')), onError: (e) => toast.error((e as Error).message) },
    );
  };
  const [callMode, setCallMode] = useState<null | 'audio' | 'video'>(null);
  const [incoming, setIncoming] = useState<null | { from: string; mode: 'audio' | 'video' }>(null);
  const blockUser = useBlockUser();
  const toggleReaction = useToggleReaction(id);
  const { pending } = useOutboxSync(); // flush queued messages when we come back online
  // Track live connection for the offline/sync indicator.
  const [online, setOnline] = useState(navigator?.onLine ?? true);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  const listRef = useRef<HTMLDivElement>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Auto-expire typing indicators (client firewall in case a stop event is missed).
  useEffect(() => {
    const timer = setInterval(() => {
      setTypingUsers((prev) => {
        const now = Date.now();
        const next: Record<string, number> = {};
        let changed = false;
        for (const [uid, until] of Object.entries(prev)) {
          if (until > now) next[uid] = until;
          else changed = true;
        }
        return changed ? next : prev;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);
  const activeTypers = Object.keys(typingUsers).filter((uid) => uid !== me?.id).length;
  const typingNames = conv?.members?.filter((m) => typingUsers[m.userId] && m.userId !== me?.id).map((m) => m.fullName.split(' ')[0]) ?? [];

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
    draft.clear();
    socket.typingStop();
    const replyId = replyTo?.id;
    setReplyTo(null);
    try {
      await send.mutateAsync({ body, replyToId: replyId });
    } catch {
      // restore text on failure so user doesn't lose their draft
      setText(body);
    }
  };

  // Combine paginated older messages + live loaded messages (oldest → newest).
  const renderedMessages = [...older, ...messages];
  const effectiveMessages = renderedMessages;

  // Collect all image URLs so we can drive a media-gallery lightbox.
  const imageUrls: string[] = messages
    .filter((m) => m.attachmentType === 'image' && m.attachmentUrl)
    .map((m) => m.attachmentUrl!);

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
    <div className="chat-bg flex h-dvh flex-col">
      {/* Header */}
      <header className="safe-top sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-background/95 px-3 py-3 backdrop-blur-xl">
        <button
          onClick={() => router.back()}
          className="grid h-9 w-9 place-items-center rounded-full active:scale-90"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        {conv?.isGroup ? (
          <button
            onClick={() => setMembersOpen(true)}
            className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br text-sm font-bold text-white active:scale-90"
            style={{ background: 'linear-gradient(135deg,#7c3aed,#22c55e)' }}
            aria-label="Group members"
          >
            <Users className="h-5 w-5" />
          </button>
        ) : peer ? (
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
          <h4 className="truncate text-sm font-semibold">
            {conv?.isGroup ? conv.title : peer?.fullName ?? conv?.title ?? 'Conversation'}
          </h4>
          {conv?.isGroup ? (
            <p className="text-[11px] text-muted-foreground">{conv.members.length} members{activeTypers > 0 ? ` · ${activeTypers} typing…` : ''}</p>
          ) : peer ? (
            <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              {presence[peer.id] !== undefined && (
                <span className={cn('inline-block h-2 w-2 rounded-full', presence[peer.id] ? 'bg-emerald-500' : 'bg-muted-foreground/40')} />
              )}
              @{peer.username}{presence[peer.id] ? ' · online' : ''}{conv?.me?.isMuted ? ' · muted' : ''}
            </p>
          ) : null}
        </div>
        <button
          onClick={() => { setSearchOpen((v) => !v); setSearchQ(''); }}
          aria-label="Search messages"
          className={cn('grid h-9 w-9 place-items-center rounded-full text-muted-foreground active:scale-90', searchOpen && 'text-primary')}
        >
          <Search className="h-5 w-5" />
        </button>
        {imageUrls.length > 0 && (
          <button
            onClick={() => setGalleryOpen(true)}
            aria-label="Media gallery"
            className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground active:scale-90"
          >
            <Images className="h-5 w-5" />
          </button>
        )}
        {!conv?.isGroup && (
          <>
            <button
              aria-label="Voice call"
              onClick={() => setCallMode('audio')}
              className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground active:scale-90"
            >
              <Phone className="h-5 w-5" />
            </button>
            <button
              aria-label="Video call"
              onClick={() => setCallMode('video')}
              className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground active:scale-90"
            >
              <VideoIcon className="h-5 w-5" />
            </button>
          </>
        )}
        <div className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="More"
            className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground active:scale-90"
          >
            <MoreVertical className="h-5 w-5" />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-10 z-40 w-52 overflow-hidden rounded-xl border border-border bg-card shadow-xl">
                {conv?.isGroup && (
                  <>
                    <button
                      onClick={() => { setMenuOpen(false); setMembersOpen(true); }}
                      className="flex w-full items-center gap-2 px-3 py-2.5 text-sm active:bg-muted"
                    >
                      <Users className="h-4 w-4" /> Members
                    </button>
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        groupInvite.mutate(undefined, {
                          onSuccess: (r) => {
                            const link = `https://apex-work-gold.vercel.app/messages/join/${r.token}`;
                            setInviteLink(link);
                            void navigator.clipboard?.writeText(link).catch(() => {});
                            toast.success('Invite link copied');
                          },
                          onError: (e) => toast.error((e as Error).message),
                        });
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2.5 text-sm active:bg-muted"
                    >
                      <Link2 className="h-4 w-4" /> {t('chat.inviteLink')}
                    </button>
                    {conv.me?.isAdmin && (
                      <button
                        onClick={() => {
                          setMenuOpen(false);
                          const name = window.prompt('Group name', conv.title ?? '');
                          if (name && name.trim()) renameGroup.mutate({ title: name.trim() });
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2.5 text-sm active:bg-muted"
                      >
                        <Pencil className="h-4 w-4" /> {t('chat.renameGroup')}
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        if (!window.confirm(t('chat.leaveGroup'))) return;
                        leaveGroup.mutate({ conversationId: id, userId: me?.id ?? '' }, { onSuccess: () => router.push('/messages') });
                      }}
                      className="flex w-full items-center gap-2 border-t border-border px-3 py-2.5 text-sm text-red-500 active:bg-muted"
                    >
                      <LogOut className="h-4 w-4" /> Leave group
                    </button>
                  </>
                )}
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    muteConversation.mutate(!conv?.me?.isMuted);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-sm active:bg-muted"
                >
                  {conv?.me?.isMuted ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
                  {conv?.me?.isMuted ? 'Unmute' : 'Mute'}
                </button>
                <button
                  onClick={() => { setMenuOpen(false); markUnread.mutate(id, { onSuccess: () => router.push('/messages') }); }}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-sm active:bg-muted"
                >
                  <Mail className="h-4 w-4" /> Mark as unread
                </button>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    setReportOpen(true);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-sm active:bg-muted"
                  disabled={!peer}
                >
                  <Flag className="h-4 w-4" /> {t('report.title')}
                </button>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    if (!peer) return;
                    if (!window.confirm(t('block.body'))) return;
                    blockUser.mutate(
                      { userId: peer.id },
                      {
                        onSuccess: () => {
                          toast.success(t('block.blocked'));
                          router.push('/messages');
                        },
                      },
                    );
                  }}
                  className="flex w-full items-center gap-2 border-t border-border px-3 py-2.5 text-sm text-red-500 active:bg-muted"
                  disabled={!peer}
                >
                  <ShieldOff className="h-4 w-4" /> {t('block.confirm')}
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      {/* Search-in-conversation panel */}
      {searchOpen && (
        <div className="z-20 border-b border-border bg-background/95 px-3 py-2 backdrop-blur-xl">
          <input
            autoFocus
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            placeholder="Search in this conversation…"
            aria-label="Search in this conversation"
            className="w-full rounded-full border border-border bg-card px-4 py-2 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/20"
          />
          {searchQ.trim().length >= 2 && (
            <div className="mt-2 max-h-64 overflow-y-auto">
              {searchMessages.isPending ? (
                <div className="py-4 text-center text-xs text-muted-foreground">Searching…</div>
              ) : searchResults.length === 0 ? (
                <div className="py-4 text-center text-xs text-muted-foreground">No matching messages.</div>
              ) : searchResults.map((r) => (
                <button
                  key={r.id}
                  onClick={() => { setSearchOpen(false); setReplyTo(r); }}
                  className="flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left active:bg-muted"
                >
                  <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gradient-to-br text-[10px] font-bold text-white" style={{ background: 'linear-gradient(135deg,#7c3aed,#22c55e)' }}>
                    {initialsOf(r.sender?.fullName ?? '?')}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-bold">{r.sender?.fullName ?? 'Unknown'}</div>
                    <div className="truncate text-xs text-muted-foreground">{r.body ?? (r.attachmentType === 'image' ? '🖼️ Photo' : '📎 Attachment')}</div>
                  </div>
                  <span className="shrink-0 text-[10px] text-muted-foreground">{timeAgo(r.createdAt)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Pinned message strip */}
      {(() => {
        const pinned = messages.filter((m) => m.pinnedAt);
        if (pinned.length === 0) return null;
        const top = pinned[pinned.length - 1]!;
        return (
          <button
            onClick={() => { setReplyTo(top); }}
            className="z-10 flex w-full items-center gap-2 border-b border-border bg-primary/5 px-3 py-1.5 text-left"
          >
            <Pin className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
              <span className="font-bold text-foreground">Pinned</span> · {top.body ?? (top.attachmentType === 'image' ? '🖼️ Photo' : '📎 Attachment')}
            </span>
          </button>
        );
      })()}

      {/* Offline / queued-message indicator */}
      {(!online || pending > 0) && (
        <div className="z-10 border-b border-border bg-amber-500/10 px-3 py-1.5 text-center text-[11px] font-semibold text-amber-700 dark:text-amber-500">
          {!online
            ? 'You\'re offline — messages will send when you reconnect'
            : `${pending} queued message${pending === 1 ? '' : 's'} — sending…`}
        </div>
      )}

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
        {!isLoading && effectiveMessages.length === 0 && (
          <div className="grid h-full place-items-center text-center text-muted-foreground">
            <div>
              <div className="text-3xl">👋</div>
              <p className="mt-2 text-sm">Say hi to start the conversation</p>
            </div>
          </div>
        )}
        {hasMore && effectiveMessages.length > 0 && (
          <div className="flex justify-center py-2">
            <button
              onClick={() => void loadOlder()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-1.5 text-[11px] font-semibold text-muted-foreground active:scale-95 disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <ArrowLeft className="h-3 w-3" />}
              {t('chat.loadOlder')}
            </button>
          </div>
        )}
        {effectiveMessages.map((m, i) => {
          const prev = effectiveMessages[i - 1];
          const showDate = !prev || dateKey(prev.createdAt) !== dateKey(m.createdAt);
          return (
            <div key={m.id} className="flex flex-col">
              {showDate && (
                <div className="my-3 flex justify-center">
                  <span className="rounded-full bg-card px-3 py-1 text-[11px] font-semibold text-muted-foreground shadow-sm">
                    {dateLabel(m.createdAt)}
                  </span>
                </div>
              )}
              <MessageBubble
                m={m}
                isMine={m.senderId === me?.id}
                isGroup={!!conv?.isGroup}
                showAvatar={
                  m.senderId !== me?.id &&
                  (i === 0 || messages[i - 1]?.senderId !== m.senderId)
                }
                onImageClick={setViewerUrl}
                onReactOpen={() => setReactingId(m.id)}
                reactingOpen={reactingId === m.id}
                onReactPick={(emoji) => toggleReaction.mutate({ messageId: m.id, emoji })}
                onReactionTap={(emoji) => toggleReaction.mutate({ messageId: m.id, emoji: emoji as ReactionEmoji })}
                onReactClose={() => setReactingId(null)}
                onOpenActions={() => setActionMsg(m)}
              />
            </div>
          );
        })}

        {/* Live typing indicator */}
        {activeTypers > 0 && (
          <div className="flex items-center gap-2 px-1 text-[11px] text-muted-foreground">
            <span className="flex gap-0.5"><span className="typing-dot" /><span className="typing-dot" style={{ animationDelay: '0.2s' }} /><span className="typing-dot" style={{ animationDelay: '0.4s' }} /></span>
            {typingNames.join(', ')} {typingNames.length > 1 ? 'are' : 'is'} typing…
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="safe-bottom sticky bottom-0 z-10 border-t border-border bg-background/95 px-2 py-2 backdrop-blur-xl">
        {replyTo && (
          <div className="mx-auto mb-1.5 flex max-w-md items-center gap-2 rounded-lg border-l-2 border-primary bg-muted/60 px-3 py-1.5">
            <Reply className="h-3.5 w-3.5 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-bold uppercase text-primary">
                Replying to {replyTo.senderId === me?.id ? 'yourself' : replyTo.sender.fullName}
              </div>
              <div className="truncate text-xs text-muted-foreground">
                {replyTo.body ?? (replyTo.attachmentType === 'audio' ? '🎤 Voice' : '📎 Attachment')}
              </div>
            </div>
            <button
              onClick={() => setReplyTo(null)}
              aria-label="Cancel reply"
              className="grid h-6 w-6 place-items-center rounded-full text-muted-foreground active:bg-muted"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        <div className="mx-auto flex max-w-md items-end gap-2">
          {composerMode === 'voice' ? (
            <VoiceRecorder
              onSend={async (att) => {
                await send.mutateAsync({
                  attachmentUrl: att.url,
                  attachmentType: 'audio',
                  attachmentMeta: { duration: att.durationSec, size: att.sizeBytes },
                  replyToId: replyTo?.id,
                });
                setReplyTo(null);
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
                    attachmentMeta: { name: att.name, size: att.sizeBytes, contentType: att.contentType },
                    replyToId: replyTo?.id,
                  });
                  setReplyTo(null);
                }}
              />
              {me?.role === 'FREELANCER' && (
                <button
                  onClick={() => setOfferSheetOpen(true)}
                  aria-label={t('offer.title')}
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-primary transition-transform active:scale-90 hover:bg-primary/10"
                >
                  <Package className="h-5 w-5" />
                </button>
              )}
              <div className="relative">
                <button
                  onClick={() => setQuickRepliesOpen((v) => !v)}
                  aria-label="Quick replies"
                  aria-pressed={quickRepliesOpen}
                  className={cn('grid h-11 w-11 shrink-0 place-items-center rounded-full text-muted-foreground transition-transform active:scale-90 hover:bg-muted hover:text-foreground', quickRepliesOpen && 'text-foreground')}
                >
                  <Zap className={cn('h-5 w-5', quickRepliesOpen && 'text-primary')} />
                </button>
                {quickRepliesOpen && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setQuickRepliesOpen(false)} />
                    <div className="absolute bottom-14 left-0 z-40 w-64 rounded-2xl border border-border bg-card p-2 shadow-2xl">
                      <div className="px-2 pb-1 pt-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{t('chat.quickReplies')}</div>
                      <div className="max-h-48 overflow-y-auto">
                        {replies.length === 0 && <p className="px-2 py-3 text-xs text-muted-foreground">{t('chat.noReplies')}</p>}
                        {replies.map((r) => (
                          <div key={r.id} className="group flex items-center gap-1 rounded-lg px-2 py-1.5 hover:bg-muted">
                            <button
                              onClick={() => { setText(r.body); setQuickRepliesOpen(false); }}
                              className="min-w-0 flex-1 text-left"
                            >
                              <div className="truncate text-xs font-semibold">{r.title}</div>
                              <div className="truncate text-[11px] text-muted-foreground">{r.body}</div>
                            </button>
                            <button
                              onClick={() => removeReply(r.id)}
                              aria-label="Delete reply"
                              className="text-muted-foreground opacity-0 hover:text-red-500 group-hover:opacity-100"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                      <button
                        onClick={() => {
                          const body = text.trim();
                          if (!body) { toast.error(t('chat.typeReply')); return; }
                          const title = window.prompt(t('chat.nameReply'), body.slice(0, 40) || 'Reply');
                          if (title) { addReply(title, body); setQuickRepliesOpen(false); }
                        }}
                        className="mx-2 mb-1 flex w-[calc(100%-1rem)] items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-2 text-xs font-semibold text-primary active:bg-muted"
                      >
                        <Plus className="h-3.5 w-3.5" /> {t('chat.saveReply')}
                      </button>
                    </div>
                  </>
                )}
              </div>
              <div className="relative">
                <button
                  onClick={() => setEmojiOpen((v) => !v)}
                  aria-label="Emoji"
                  aria-pressed={emojiOpen}
                  className={cn('grid h-11 w-11 shrink-0 place-items-center rounded-full text-muted-foreground transition-transform active:scale-90 hover:bg-muted hover:text-foreground', emojiOpen && 'text-foreground')}
                >
                  <Smile className={cn('h-5 w-5', emojiOpen && 'text-primary')} />
                </button>
                {emojiOpen && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setEmojiOpen(false)} />
                    <div className="absolute bottom-14 left-0 z-40 grid w-64 grid-cols-8 gap-1 rounded-2xl border border-border bg-card p-2 shadow-2xl">
                      {EMOJI_QUICK.map((e) => (
                        <button
                          key={e}
                          onClick={() => { setText(text + e); setEmojiOpen(false); }}
                          className="grid h-7 w-7 place-items-center rounded-lg text-lg hover:bg-muted active:scale-90"
                          aria-label={`Insert ${e}`}
                        >
                          {e}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
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

      <CustomOfferSheet open={offerSheetOpen} onOpenChange={setOfferSheetOpen} conversationId={id} />
      {peer && (
        <ReportUserSheet
          open={reportOpen}
          onOpenChange={setReportOpen}
          targetType="USER"
          targetId={peer.id}
        />
      )}
      <ImageViewer
        open={!!viewerUrl}
        onOpenChange={(v) => !v && setViewerUrl(null)}
        url={viewerUrl}
        images={imageUrls}
        imageIndex={viewerUrl ? Math.max(0, imageUrls.indexOf(viewerUrl)) : 0}
        onImageIndex={(i) => setViewerUrl(imageUrls[i] ?? null)}
      />

      {/* Incoming call ring */}
      {incoming && !callMode && (
        <div className="fixed inset-x-4 top-16 z-[100] mx-auto max-w-sm rounded-2xl border border-primary/40 bg-card p-4 shadow-2xl">
          <div className="flex items-center gap-3">
            <div className="grad-hero grid h-11 w-11 place-items-center rounded-full text-white">
              <PhoneIncoming className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-bold">Incoming {incoming.mode} call</div>
              <div className="text-[11px] text-muted-foreground">{peer?.fullName ?? 'Someone'} is calling</div>
            </div>
            <button
              onClick={() => setIncoming(null)}
              className="grid h-10 w-10 place-items-center rounded-full bg-red-600 text-white active:scale-90"
              aria-label="Decline"
            >
              <X className="h-5 w-5" />
            </button>
            <button
              onClick={() => { setCallMode(incoming.mode); setIncoming(null); }}
              className="grad-hero grid h-10 w-10 place-items-center rounded-full text-white active:scale-90"
              aria-label="Accept"
            >
              <Phone className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      {/* Active call */}
      {callMode && (
        <CallPanel
          conversationId={id}
          mode={callMode}
          onEnd={() => setCallMode(null)}
        />
      )}

      {/* Group members sheet */}
      {membersOpen && conv?.isGroup && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/50 backdrop-blur-sm" onClick={() => setMembersOpen(false)}>
          <div className="max-h-[75dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-b-0 border-border bg-card p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-muted" />
            <div className="mb-3 flex items-center justify-between">
              {t('chat.members')}
              <button onClick={() => setMembersOpen(false)} className="grid h-8 w-8 place-items-center rounded-full active:bg-muted" aria-label="Close"><X className="h-4 w-4" /></button>
            </div>
            {conv.me?.isAdmin ? (
              <button
                onClick={async () => {
                  const input = window.prompt('Add members by @username, separated by commas');
                  if (!input) return;
                  const names = input.split(',').map((s) => s.trim().replace(/^@/, '')).filter(Boolean);
                  const found: string[] = [];
                  for (const name of names) {
                    try {
                      const r = await apiFetch<any>(`/search?q=${encodeURIComponent(name)}`, { token });
                      const users = (r as any)?.users ?? [];
                      const hit = users.find((u: any) => u.username?.toLowerCase() === name.toLowerCase()) ?? users[0];
                      if (hit?.id) found.push(hit.id);
                    } catch { /* skip */ }
                  }
                  if (found.length === 0) { toast.error(t('chat.noMatching')); return; }
                  addMembers.mutate(found, { onSuccess: () => toast.success(`Added ${found.length} member${found.length === 1 ? '' : 's'}`) });
                }}
                className="mb-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-2.5 text-sm font-semibold text-primary active:scale-[.98]"
              >
                <UserPlus className="h-4 w-4" /> Add member
              </button>
            ) : null}
            <div className="space-y-1">
              {conv.members.map((m) => {
                const typing = !!typingUsers[m.userId];
                return (
                  <div key={m.userId} className="flex items-center gap-3 rounded-xl p-2 hover:bg-muted/50">
                    <div className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br text-xs font-bold text-white', gradientFor(m.userId))}>
                      {initialsOf(m.fullName)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 text-sm font-semibold">
                        {m.fullName} {m.userId === me?.id && <span className="text-[10px] text-muted-foreground">(you)</span>}
                        {m.isAdmin && <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold text-primary">admin</span>}
                        {!m.isAdmin && typeof presence[m.userId] === 'boolean' && (
                          <span className={cn('inline-block h-1.5 w-1.5 rounded-full', presence[m.userId] ? 'bg-emerald-500' : 'bg-muted-foreground/40')} />
                        )}
                      </div>
                      <div className="text-[11px] text-muted-foreground">@{m.username}{typing ? ' · typing…' : ''}{!typing && presence[m.userId] ? ' · online' : ''}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Forward picker */}
      {forwardMsg && (
        <div className="fixed inset-0 z-[95] flex items-end justify-center bg-black/50 backdrop-blur-sm" onClick={() => setForwardMsg(null)}>
          <div className="max-h-[75dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-b-0 border-border bg-card p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-muted" />
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-extrabold">{t('chat.forward')} →</h2>
              <button onClick={() => setForwardMsg(null)} className="grid h-8 w-8 place-items-center rounded-full active:bg-muted" aria-label="Close"><X className="h-4 w-4" /></button>
            </div>
            <div className="mb-3 rounded-lg border-l-2 border-primary bg-muted/50 px-3 py-2">
              <div className="truncate text-xs text-muted-foreground">{forwardMsg.body ?? '📎 Attachment'}</div>
            </div>
            <div className="space-y-1">
              {(convs?.items ?? []).filter((c) => c.id !== id).map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    forwardMessage.mutate({ messageId: forwardMsg.id, targetConversationId: c.id }, {
                      onSuccess: () => { toast.success('Forwarded'); setForwardMsg(null); },
                      onError: (e) => { toast.error((e as Error).message); setForwardMsg(null); },
                    });
                  }}
                  className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-muted/50"
                >
                  <div className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br text-xs font-bold text-white', gradientFor(c.id))}>
                    {initialsOf(c.peer?.fullName ?? c.title ?? 'C')}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{c.peer?.fullName ?? c.title ?? 'Conversation'}</div>
                    <div className="truncate text-[11px] text-muted-foreground">{c.peer ? `@${c.peer.username}` : `${(c as any).members?.length ?? ''} members`}</div>
                  </div>
                  <Forward className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              ))}
              {(convs?.items ?? []).filter((c) => c.id !== id).length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">{t('chat.noTargets')}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Message actions sheet (labeled) */}
      {actionMsg && (
        <div className="fixed inset-0 z-[96] flex items-end justify-center bg-black/50 backdrop-blur-sm" onClick={() => setActionMsg(null)}>
          <div className="w-full max-w-md rounded-t-3xl border border-b-0 border-border bg-card py-3" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Message actions">
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-muted" />
            <div className="mx-5 mb-3 flex items-center gap-2 rounded-xl border-l-2 border-primary bg-muted/40 px-3 py-2">
              <div className="flex-1">
                <div className="text-[11px] font-bold text-primary">{actionMsg.senderId === me?.id ? 'You' : actionMsg.sender?.fullName}</div>
                <div className="max-h-12 overflow-hidden truncate text-sm text-foreground">{actionMsg.body ?? (actionMsg.attachmentType === 'image' ? '🖼️ Photo' : actionMsg.attachmentType === 'audio' ? '🎤 Voice message' : '📎 Attachment')}</div>
              </div>
              <span className="shrink-0 text-[11px] text-muted-foreground">{timeAgo(actionMsg.createdAt)}</span>
            </div>
            <div className="mx-2">
              <ActionRow icon={<Reply className="h-4 w-4" />} label={t('chat.reply')} onClick={() => { setReplyTo(actionMsg); setActionMsg(null); }} />
              <ActionRow icon={<SmilePlus className="h-4 w-4" />} label={t('chat.react')} onClick={() => { setReactingId(actionMsg.id); setActionMsg(null); }} />
              <ActionRow icon={<Forward className="h-4 w-4" />} label={t('chat.forward')} onClick={() => { forwardTo(actionMsg); setActionMsg(null); }} />
              <ActionRow icon={<Pin className="h-4 w-4" />} label={actionMsg.pinnedAt ? t('chat.unpin') : t('chat.pin')} onClick={() => { pinMessage.mutate({ messageId: actionMsg.id, pinned: !actionMsg.pinnedAt }); setActionMsg(null); }} />
              {!conv?.isSaved && (
                <ActionRow icon={<Bookmark className="h-4 w-4" />} label={t('chat.saveAction')} onClick={() => { saveMessage(actionMsg); setActionMsg(null); }} />
              )}
              {actionMsg.body && (
                <ActionRow icon={<Copy className="h-4 w-4" />} label={t('chat.copyText')} onClick={() => { void navigator.clipboard?.writeText(actionMsg.body ?? ''); toast.success(t('chat.copied')); setActionMsg(null); }} />
              )}
              {actionMsg.senderId === me?.id && (actionMsg.readByTotal ?? 0) > 0 && conv?.members && (
                <div className="mx-3 my-1 rounded-xl border border-border/60 bg-muted/20 px-3 py-2">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{t('chat.readReceipts')}</div>
                  <div className="mt-1 text-xs text-foreground">
                    {(actionMsg.readBy ?? 0) > 0
                      ? t('chat.seenBy', { names: conv.members.filter((m) => actionMsg.readByUserIds?.includes(m.userId)).map((m) => m.fullName.split(' ')[0]).join(', ') || '—' })
                      : t('chat.notSeen')}
                  </div>
                  <div className="text-[10px] text-muted-foreground">{t('chat.readFraction', { read: actionMsg.readBy ?? 0, total: actionMsg.readByTotal ?? 0 })}</div>
                </div>
              )}
              {actionMsg.senderId === me?.id && (
                <>
                  <ActionRow icon={<Pencil className="h-4 w-4" />} label={t('chat.edit')} onClick={() => { const next = window.prompt(t('chat.editMessage'), actionMsg.body ?? ''); if (next !== null && next.trim() && next !== actionMsg.body) editMessage.mutate({ messageId: actionMsg.id, body: next.trim() }); setActionMsg(null); }} />
                  <ActionRow icon={<Trash2 className="h-4 w-4" />} label={t('chat.deleteForMe')} danger onClick={() => { if (window.confirm(t('chat.deleteMessage'))) deleteMessage.mutate(actionMsg.id); setActionMsg(null); }} />
                </>
              )}
            </div>
            <button onClick={() => setActionMsg(null)} className="mx-5 mt-2 w-[calc(100%-2.5rem)] rounded-2xl border border-border py-3 text-sm font-semibold active:bg-muted">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Media gallery */}
      {galleryOpen && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-lg">
          <button
            onClick={() => setGalleryOpen(false)}
            aria-label="Close gallery"
            className="safe-top absolute right-4 top-4 grid h-11 w-11 place-items-center rounded-full bg-black/60 text-white active:scale-90"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="safe-top absolute inset-0 overflow-y-auto p-4 pt-16">
            <h2 className="mb-3 text-white/80 text-sm font-bold">Media in this chat</h2>
            <div className="grid grid-cols-3 gap-1">
              {imageUrls.slice().reverse().map((url) => (
                <button
                  key={url}
                  onClick={() => { setGalleryOpen(false); setViewerUrl(url); }}
                  className="relative aspect-square overflow-hidden rounded-lg bg-black/40"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MessageBubble({
  m,
  isMine,
  isGroup,
  showAvatar,
  onImageClick,
  onOpenActions,
  onReactOpen,
  reactingOpen,
  onReactPick,
  onReactionTap,
  onReactClose,
}: {
  m: ChatMessage;
  isMine: boolean;
  isGroup?: boolean;
  showAvatar: boolean;
  onImageClick?: (url: string) => void;
  onOpenActions?: () => void;
  onReactOpen?: () => void;
  reactingOpen?: boolean;
  onReactPick?: (e: ReactionEmoji) => void;
  onReactionTap?: (emoji: string) => void;
  onReactClose?: () => void;
}) {
  const { t } = useI18n();
  const isImage = m.attachmentType === 'image';
  const isAudio = m.attachmentType === 'audio';
  const isFile = m.attachmentType === 'file' || m.attachmentType === 'video';
  const hasAttachment = !!m.attachmentUrl;
  const offerMatch = m.attachmentUrl?.match(/^apex:\/\/offer\/([a-zA-Z0-9_-]+)$/);

  // Long-press to open the reaction picker on mobile.

  if (offerMatch) {
    return (
      <div className={cn('flex items-end gap-2', isMine ? 'justify-end' : 'justify-start')}>
        {!isMine && <div className="w-8 shrink-0" />}
        <OfferCard offerId={offerMatch[1]!} isMine={isMine} />
      </div>
    );
  }

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
      <div className="group flex items-end gap-1">
        <div
          onClick={() => onOpenActions?.()}
          role="button"
          tabIndex={0}
          aria-label="Open message actions"
          className={cn(
            'relative max-w-[80%] cursor-pointer overflow-hidden rounded-2xl text-sm leading-snug',
            // Image bubbles are edge-to-edge; text/file bubbles keep padding.
            isImage ? 'p-0' : 'px-3.5 py-2',
            isMine
              ? 'grad-hero rounded-br-md text-white shadow-md shadow-primary/30'
              : 'rounded-bl-md bg-card text-foreground',
          )}
        >
        <ReactionPicker open={!!reactingOpen} onSelect={(e) => onReactPick?.(e)} onClose={() => onReactClose?.()} />
        {(m.attachmentMeta as any)?.forwarded && (
          <div className={cn('mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide', isMine ? 'text-white/70' : 'text-primary')}>
            <Forward className="h-3 w-3" /> {t('chat.forwarded')}
          </div>
        )}
        {m.pinnedAt && (
          <div className={cn('mb-1 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold', isMine ? 'bg-white/15 text-white' : 'bg-primary/15 text-primary')}>
            <Pin className="h-3 w-3" /> {t('chat.pinned')}
          </div>
        )}
        {m.replyTo && (
          <div className={cn(
            'mb-1 rounded-md border-l-2 px-2 py-1 text-[11px] leading-tight',
            isMine ? 'border-white/70 bg-white/10' : 'border-primary bg-muted/70',
          )}>
            <div className="font-bold opacity-80">↳ {m.replyTo.sender?.fullName ?? 'Reply'}</div>
            <div className="truncate opacity-90">
              {m.replyTo.body ?? (m.replyTo.attachmentType === 'audio' ? '🎤 Voice' : '📎 Attachment')}
            </div>
          </div>
        )}
        {isImage && m.attachmentUrl && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onImageClick?.(m.attachmentUrl!); }}
            className="block"
          >
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
          </button>
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
            download
            onClick={(e) => e.stopPropagation()}
            className={cn(
              'flex max-w-[240px] items-center gap-3 rounded-xl border p-2 pr-3 transition-transform active:scale-[.98]',
              isMine ? 'border-white/25 bg-white/10' : 'border-border bg-background/60',
            )}
          >
            <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-lg text-white', isMine ? 'bg-white/20' : 'bg-primary')}>
              <FileText className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{humanFileName(m.attachmentUrl)}</span>
              <span className={cn('block text-[11px]', isMine ? 'text-white/70' : 'text-muted-foreground')}>
                {fileSizeLabel(m.attachmentMeta?.size)}
              </span>
            </span>
            <Download className={cn('h-4 w-4 shrink-0', isMine ? 'text-white' : 'text-primary')} />
          </a>
        )}

        {isGroup && !isMine && showAvatar && (
          <div className={cn('mb-1 text-[11px] font-bold', isMine ? 'text-white/80' : 'text-primary')}>
            {m.sender.fullName.split(' ')[0]}
          </div>
        )}
        {m.body && (
          <p className={cn('whitespace-pre-wrap break-words', isImage && 'p-3')}>{m.body}</p>
        )}

        <div
          className={cn(
            'flex items-center gap-1 text-[10px] font-medium',
            isImage ? 'px-3 pb-2' : 'mt-1',
            isMine ? 'text-white/70' : 'text-muted-foreground',
            hasAttachment && !m.body && !isImage && 'mt-1',
          )}
        >
          {m.editedAt && <span>edited · </span>}
          {timeAgo(m.createdAt)}
          {isMine && (m.readBy ?? 0) > 0 ? (
            <span className="text-white" aria-label="Read">
              <CheckCheck className="h-3.5 w-3.5" />
            </span>
          ) : isMine ? (
            <Check className="h-3.5 w-3.5" />
          ) : null}
          {isMine && (m.readBy ?? 0) > 0 && (m.readByTotal ?? 0) > 1 ? (
            <span className="opacity-80">{m.readBy}/{m.readByTotal}</span>
          ) : null}
        </div>
        {m.attachmentMeta?.transcript && (
          <div className={cn('mt-1 border-t px-1 pt-1 text-[11px] italic', isMine ? 'border-white/20 text-white/70' : 'border-border text-muted-foreground')}>
            &ldquo;{m.attachmentMeta.transcript}&rdquo;
          </div>
        )}
      </div>
      {m.reactions && m.reactions.length > 0 && (
        <div className={cn('mt-1 flex flex-wrap gap-1', isMine ? 'justify-end' : 'justify-start')}>
          {m.reactions.map((r) => (
            <button
              key={r.emoji}
              onClick={(e) => { e.stopPropagation(); onReactionTap?.(r.emoji); }}
              className={cn(
                'inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[11px] transition-transform active:scale-90',
                r.mine ? 'border-primary/40 bg-primary/15 text-primary' : 'border-border bg-card text-muted-foreground',
              )}
            >
              <span>{r.emoji}</span>
              <span className="font-bold">{r.count}</span>
            </button>
          ))}
        </div>
      )}
      </div>
    </div>
  );
}

/** A labeled row in the message actions sheet. */
function ActionRow({ icon, label, onClick, danger }: { icon: ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={cn('flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium active:bg-muted', danger && 'text-red-500')}
    >
      <span className={cn('grid h-8 w-8 place-items-center rounded-full', danger ? 'bg-red-500/10 text-red-500' : 'bg-primary/10 text-primary')}>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

/** Human-readable file size from bytes. */
function fileSizeLabel(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return 'File';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return `${n >= 10 || i === 0 ? Math.round(n) : n.toFixed(1)} ${units[i]}`;
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
