'use client';

import { dt } from '@/i18n/auto';
import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type TouchEvent as ReactTouchEvent,
} from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ArrowDown,
  Send,
  Loader2,
  Phone,
  PhoneIncoming,
  Video as VideoIcon,
  FileText,
  PlayCircle,
  Mic,
  MoreVertical,
  Flag,
  ShieldOff,
  Package,
  SmilePlus,
  Reply,
  X,
  Images,
  Pencil,
  Trash2,
  Users,
  UserPlus,
  Check,
  CheckCheck,
  LogOut,
  Bell,
  BellOff,
  Pin,
  Search,
  Forward,
  Mail,
  Bookmark,
  MoreHorizontal,
  Copy,
  Smile,
  Link2,
  Zap,
  Plus,
  Download,
  Sticker,
  CalendarClock,
  Timer as TimerIcon,
  Eye,
  Sparkles,
  KeyRound,
  Languages,
} from 'lucide-react';
import { cn, timeAgo } from '@/lib/utils';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import {
  useMessages,
  useSendMessage,
  useChatSocket,
  useConversation,
  useConversations,
  useSavedMessages,
  useAddGroupMembers,
  useLeaveGroup,
  useUpdateGroup,
  useEditMessage,
  useDeleteMessage,
  useMuteConversation,
  useMarkUnread,
  useForwardMessage,
  usePinMessage,
  useSearchMessages,
  useLoadOlder,
  useGroupInvite,
  useSavedReplies,
  type ChatMessage,
} from '@/hooks/use-chat';
import { useMe } from '@/hooks/use-me';
import { useAISuggestReplies } from '@/hooks/use-ai';
import { LinkPreview, firstUrlIn } from '@/components/chat/link-preview';
import { isSticker } from '@/components/chat/emoji-data';
import {
  addScheduled,
  listScheduled,
  removeScheduled,
  makeClientId,
  type ScheduledSend,
} from '@/lib/scheduled-send';
import {
  LazyCustomOfferSheet as CustomOfferSheet,
  LazyOfferCard as OfferCard,
  LazyReportUserSheet as ReportUserSheet,
  LazyImageViewer as ImageViewer,
  LazyCallPanel as CallPanel,
  LazyVoiceRecorder as VoiceRecorder,
  LazyAttachButton as AttachButton,
  LazyReactionPicker as ReactionPicker,
  LazyStickerPicker as StickerPicker,
  LazyWaveformPlayer as WaveformPlayer,
} from '@/components/lazy';
import { useBlockUser } from '@/hooks/use-moderation';
import { useToggleReaction } from '@/hooks/use-reactions';
import { useMessageDraft } from '@/hooks/use-drafts';
import { UserAvatar } from '@/components/ui/user-avatar';
import { useOutboxSync } from '@/hooks/use-outbox';
import { toast } from 'sonner';
import { useI18n } from '@/i18n';
import { REACTION_EMOJIS, type ReactionEmoji } from '@apex-work/shared';
import { gradientFor } from '@/components/ui/avatar-gradient';
function initialsOf(name: string): string {
  return (
    name
      .split(' ')
      .map((w) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?'
  );
}

const EMOJI_QUICK = [
  '😀',
  '😄',
  '😂',
  '🤣',
  '😊',
  '😍',
  '😘',
  '😎',
  '🤔',
  '😅',
  '👍',
  '👎',
  '👏',
  '🙏',
  '💪',
  '🤝',
  '✌️',
  '🙌',
  '👌',
  '🤙',
  '❤️',
  '🔥',
  '🎉',
  '✅',
  '⭐',
  '💯',
  '😢',
  '😡',
  '🤯',
  '🥳',
  '🚀',
  '💡',
  '📌',
  '📈',
  '💰',
  '🌍',
  '🤗',
  '😇',
  '🥰',
  '😴',
];

/** Max message body length — counter appears in the composer as you type. */
const CHAR_MAX = 4096;
// Counter turns amber once you're within this many chars of the limit.
const CHAR_THRESHOLD = 240;

/** Short haptic tick on supported devices (best-effort, no-op otherwise). */
function haptic(): void {
  try {
    navigator.vibrate?.(15);
  } catch {
    /* not supported — ignore */
  }
}

function dateKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}
function dateLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86_400_000);
  const same = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (same(d, today)) return 'Today';
  if (same(d, yesterday)) return 'Yesterday';
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
  });
}

export default function ConversationPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: me } = useMe();
  const token = useAuthStore((s) => s.accessToken);
  const { data, isLoading, error } = useMessages(id);
  const { data: conv } = useConversation(id);
  const messages = data?.items ?? [];
  // Peer from the conversation detail (works even when there are no messages
  // yet); fall back to the latest incoming sender, then null.
  const peer =
    (conv && !conv.isGroup ? (conv.peer ?? null) : null) ??
    messages.find((m) => m.senderId !== me?.id)?.sender ??
    null;
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
    if (!searchOpen || searchQ.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(() => {
      searchMessages.mutate(searchQ.trim(), {
        onSuccess: (r) => setSearchResults(r.items ?? []),
        onError: () => setSearchResults([]),
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQ, searchOpen, searchMessages]);
  const socket = useChatSocket(id, {
    onIncomingCall: (from, mode) => {
      // Ignore our own call ring: when we dial, the server broadcasts
      // `call:start` to every socket in the room (including our other chat
      // socket), so without this guard we'd flash an "incoming call" for a
      // call we just placed — most visibly after hanging up.
      if (from === me?.id) return;
      setIncoming({ from, mode });
    },
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
    conv?.members?.forEach((m) => {
      if (typeof m.online === 'boolean') map[m.userId] = m.online;
    });
    if (peer) map[peer.id] = !!peer.online;
    setPresence((prev) => ({ ...prev, ...map }));
  }, [conv, peer]);
  const { t, locale } = useI18n();
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
  // One-tap message translation: messageId -> translated text.
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const translateMsg = async (m: ChatMessage) => {
    if (!m.body || translations[m.id]) return;
    const target = locale !== 'en' ? locale : 'am';
    try {
      const r = await apiFetch<{ translated: string }>('/translate', {
        method: 'POST',
        body: JSON.stringify({ text: m.body, target }),
      });
      setTranslations((prev) => ({ ...prev, [m.id]: r.translated }));
    } catch {
      toast.error(t('chat.translationFailed'));
    }
  };
  const [stickerOpen, setStickerOpen] = useState(false);
  const [timerSec, setTimerSec] = useState<number>(0);
  const [scheduledOpen, setScheduledOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [enterToSend, setEnterToSend] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.localStorage.getItem('apex.enterToSend') !== '0' : true,
  );
  const toggleEnterToSend = () => {
    setEnterToSend((v) => {
      const next = !v;
      try {
        window.localStorage.setItem('apex.enterToSend', next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  };
  const [scheduled, setScheduled] = useState<ScheduledSend[]>([]);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  // Tap ✓✓ / "seen by" avatars → popover listing who read this message.
  const [readReceiptId, setReadReceiptId] = useState<string | null>(null);
  // Tap a reaction chip → popover listing who reacted with that emoji.
  const [reactionInfo, setReactionInfo] = useState<{ messageId: string; emoji: string } | null>(
    null,
  );
  const msgRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const { data: convs } = useConversations();
  const { data: savedConv } = useSavedMessages();
  const forwardTo = (m: ChatMessage) => setForwardMsg(m);
  const saveMessage = (m: ChatMessage) => {
    if (!savedConv?.id) {
      toast.error(t('chat.errorNoSaved'));
      return;
    }
    forwardMessage.mutate(
      { messageId: m.id, targetConversationId: savedConv.id },
      {
        onSuccess: () => toast.success(t('chat.saved')),
        onError: (e) => toast.error((e as Error).message),
      },
    );
  };
  const [callMode, setCallMode] = useState<null | 'audio' | 'video'>(null);
  const [incoming, setIncoming] = useState<null | { from: string; mode: 'audio' | 'video' }>(null);
  // Clear any stale "incoming call" ring whenever a call session starts or
  // ends, so a ring can't linger on screen after we hang up (or while dialling).
  useEffect(() => {
    if (callMode) setIncoming(null);
  }, [callMode]);
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
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [sendFx, setSendFx] = useState(0);
  // Scroll-to-bottom jump chip: track whether the user is near the bottom, and
  // how many messages arrived while they were scrolled up.
  const [atBottom, setAtBottom] = useState(true);
  const [missedCount, setMissedCount] = useState(0);
  const listOnScroll = () => {
    const el = listRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 90;
    setAtBottom(nearBottom);
    if (nearBottom) setMissedCount(0);
  };
  const jumpToBottom = () => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    setMissedCount(0);
    setAtBottom(true);
  };
  const swipesRef = useRef<{ x: number; y: number } | null>(null);

  // Auto-grow the composer as text is entered (max ~140px, then scroll).
  const resizeInput = () => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  };
  useEffect(() => {
    resizeInput();
  }, [text]);

  // Swipe-right-from-left-edge → go back (native mobile feel).
  const onTouchStart = (e: ReactTouchEvent) => {
    const t = e.touches[0];
    if (!t) return;
    swipesRef.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: ReactTouchEvent) => {
    const start = swipesRef.current;
    if (!start) return;
    const t = e.changedTouches[0];
    if (!t) return;
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (start.x < 40 && dx > 70 && Math.abs(dy) < 60) router.back();
    swipesRef.current = null;
  };
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
  const typingNames =
    conv?.members
      ?.filter((m) => typingUsers[m.userId] && m.userId !== me?.id)
      .map((m) => m.fullName.split(' ')[0]) ?? [];

  // Auto-scroll to bottom on new messages — but only if the user is already
  // near the bottom; otherwise count the missed ones and let them jump down.
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      if (atBottom) {
        el.scrollTop = el.scrollHeight;
      } else {
        setMissedCount((c) => c + 1);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      await send.mutateAsync({
        body,
        replyToId: replyId,
        attachmentMeta: timerSec > 0 ? { timer: timerSec } : undefined,
      });
      if (timerSec > 0) setTimerSec(0);
    } catch {
      // restore text on failure so user doesn't lose their draft
      setText(body);
    }
  };

  const sendReply = (body: string) => {
    void send
      .mutateAsync({ body })
      .then(() => setSmart([]))
      .catch(() => {});
  };

  // Combine paginated older messages + live loaded messages (oldest → newest),
  // then drop any self-destructed messages whose timer has already elapsed.
  const renderedMessages = [...older, ...messages];
  const notExpired = (m: ChatMessage) => {
    const timer = Number((m.attachmentMeta as any)?.timer);
    if (!timer) return true;
    return Date.parse(m.createdAt) + timer * 1000 > Date.now();
  };
  const effectiveMessages = renderedMessages.filter(notExpired);

  // — Jump to a quoted/replied-to message —
  const jumpTo = (mid: string) => {
    const el = msgRefs.current[mid];
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlightId(mid);
    window.setTimeout(() => setHighlightId((c) => (c === mid ? null : c)), 2500);
  };

  // — Scheduled "send later" queue (local, fires while open & online) —
  useEffect(() => {
    setScheduled(listScheduled(id));
  }, [id]);
  useEffect(() => {
    const tick = async () => {
      const due = listScheduled(id).filter((s) => s.at <= Date.now());
      for (const s of due) {
        try {
          await send.mutateAsync({
            body: s.body,
            attachmentUrl: s.attachmentUrl,
            attachmentType: s.attachmentType as any,
            attachmentMeta: s.attachmentMeta,
            replyToId: s.replyToId,
          });
          setScheduled(removeScheduled(id, s.id));
        } catch {
          /* keep for a later retry */
        }
      }
    };
    const timer = setInterval(tick, 10000);
    return () => clearInterval(timer);
  }, [id, send]);

  // — AI smart replies (suggestions for the last peer message) —
  const suggestReplies = useAISuggestReplies();
  const [smart, setSmart] = useState<string[]>([]);
  const [smartDismissed, setSmartDismissed] = useState(false);
  // Stable signature (string) so the effect only re-runs when the visible
  // conversation dialogue actually changes.
  const smartSig = effectiveMessages
    .slice(-10)
    .filter((m) => m.body)
    .map((m) => `${m.senderId === me?.id ? 'a' : 'u'}:${m.body}`)
    .join('\u0001');
  useEffect(() => {
    if (smartDismissed) return;
    const parts = smartSig.split('\u0001').filter(Boolean);
    if (parts.length < 2) return;
    // Skip when the last visible message is mine (no need to prompt myself).
    if (parts[parts.length - 1]!.startsWith('a:')) return;
    const history: { role: 'user' | 'assistant'; content: string }[] = parts.map((p) => {
      const [role, ...rest] = p.split(':');
      return { role: role === 'a' ? 'assistant' : 'user', content: rest.join(':') };
    });
    const t = setTimeout(() => {
      suggestReplies.mutate(
        { history },
        {
          onSuccess: (r) => {
            if (r.replies?.length) setSmart(r.replies.slice(0, 3));
          },
          onError: () => {},
        },
      );
    }, 700);
    return () => clearTimeout(t);
  }, [smartSig, me?.id, smartDismissed, suggestReplies]);

  // Collect all image URLs so we can drive a media-gallery lightbox.
  const imageUrls: string[] = messages
    .filter((m) => m.attachmentType === 'image' && m.attachmentUrl)
    .map((m) => m.attachmentUrl!);

  const handleTextChange = (v: string) => {
    if (v.length > CHAR_MAX) v = v.slice(0, CHAR_MAX);
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
    <div
      className="chat-bg flex h-dvh flex-col overflow-x-clip"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Header */}
      <header
        className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-background/95 px-3 pb-3 backdrop-blur-xl"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.5rem)' }}
      >
        <button
          onClick={() => router.back()}
          className="grid h-9 w-9 place-items-center rounded-full active:scale-90"
          aria-label={dt('Back')}
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        {conv?.isGroup ? (
          <button
            onClick={() => setMembersOpen(true)}
            className={`grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br text-sm font-bold text-white active:scale-90 ${conv?.id ? gradientFor(conv.id) : 'bg-primary'}`}
            aria-label={dt('Group members')}
          >
            <Users className="h-5 w-5" />
          </button>
        ) : peer ? (
          <a
            href={`/u/${peer.username}`}
            aria-label={`${peer.fullName} profile`}
            title={peer.fullName}
            className="block h-10 w-10 shrink-0 cursor-pointer rounded-full active:scale-90"
          >
            <UserAvatar
              name={peer.fullName}
              avatarUrl={peer.avatarUrl}
              id={peer.id}
              verified={peer.isVerified}
              className="h-10 w-10 text-sm font-bold"
            />
          </a>
        ) : (
          <div className="grad-hero grid h-10 w-10 place-items-center rounded-full text-sm font-bold text-white">
            ?
          </div>
        )}
        <div className="min-w-0 flex-1">
          {peer && !conv?.isGroup ? (
            <a
              href={`/u/${peer.username}`}
              className="block min-w-0 cursor-pointer text-left active:opacity-60"
              aria-label={`${peer.fullName} profile`}
            >
              <h4 className="truncate text-sm font-semibold">{peer.fullName}</h4>
            </a>
          ) : (
            <h4 className="truncate text-sm font-semibold">{conv?.title ?? 'Conversation'}</h4>
          )}
          {conv?.isGroup ? (
            <p className="text-[11px] text-muted-foreground">
              {conv.members.length} members{activeTypers > 0 ? ` · ${activeTypers} typing…` : ''}
            </p>
          ) : peer ? (
            <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              {presence[peer.id] !== undefined && (
                <span
                  className={cn(
                    'inline-block h-2 w-2 rounded-full',
                    presence[peer.id] ? 'bg-emerald-500' : 'bg-muted-foreground/40',
                  )}
                />
              )}
              @{peer.username}
              {presence[peer.id] ? ' · online' : ''}
              {conv?.me?.isMuted ? ' · muted' : ''}
            </p>
          ) : null}
        </div>
        {!conv?.isGroup && (
          <>
            <button
              aria-label={dt('Voice call')}
              onClick={() => {
                setIncoming(null);
                setCallMode('audio');
              }}
              className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground active:scale-90"
            >
              <Phone className="h-5 w-5" />
            </button>
            <button
              aria-label={dt('Video call')}
              onClick={() => {
                setIncoming(null);
                setCallMode('video');
              }}
              className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground active:scale-90"
            >
              <VideoIcon className="h-5 w-5" />
            </button>
          </>
        )}
        <div className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={dt('More')}
            className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground active:scale-90"
          >
            <MoreVertical className="h-5 w-5" />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-10 z-40 max-h-[80vh] w-56 overflow-y-auto overflow-x-hidden rounded-xl border border-border bg-card py-1 shadow-xl">
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    setSearchOpen(true);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-sm active:bg-muted"
                >
                  <Search className="h-4 w-4" /> {t('chat.searchInConvo')}
                </button>
                {imageUrls.length > 0 && (
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      setGalleryOpen(true);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-sm active:bg-muted"
                  >
                    <Images className="h-4 w-4" /> {t('chat.mediaGallery')}
                  </button>
                )}
                {conv?.isGroup && (
                  <>
                    <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {t('chat.convoSection')}
                    </div>
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        setMembersOpen(true);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2.5 text-sm active:bg-muted"
                    >
                      <Users className="h-4 w-4" /> {t('chat.members')}
                    </button>
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        groupInvite.mutate(undefined, {
                          onSuccess: (r) => {
                            const link = `https://apex-work-gold.vercel.app/messages/join/${r.token}`;
                            setInviteLink(link);
                            void navigator.clipboard?.writeText(link).catch(() => {});
                            toast.success(dt('Invite link copied'));
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
                        leaveGroup.mutate(
                          { conversationId: id, userId: me?.id ?? '' },
                          { onSuccess: () => router.push('/messages') },
                        );
                      }}
                      className="flex w-full items-center gap-2 border-t border-border px-3 py-2.5 text-sm text-red-500 active:bg-muted"
                    >
                      <LogOut className="h-4 w-4" /> {t('chat.leaveGroup')}
                    </button>
                  </>
                )}
                <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {t('chat.alertSection')}
                </div>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    muteConversation.mutate(!conv?.me?.isMuted);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-sm active:bg-muted"
                >
                  {conv?.me?.isMuted ? (
                    <Bell className="h-4 w-4" />
                  ) : (
                    <BellOff className="h-4 w-4" />
                  )}
                  {conv?.me?.isMuted ? t('chat.unmute') : t('chat.mute')}
                </button>
                <button
                  onClick={() => toggleEnterToSend()}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-sm active:bg-muted"
                >
                  <KeyRound className="h-4 w-4" /> {t('chat.enterToSend')}
                  <span
                    className={cn(
                      'ml-auto h-5 w-9 shrink-0 rounded-full p-0.5 transition-colors',
                      enterToSend ? 'bg-primary' : 'bg-muted',
                    )}
                  >
                    <span
                      className={cn(
                        'block h-4 w-4 rounded-full bg-white transition-transform',
                        enterToSend && 'translate-x-4',
                      )}
                    />
                  </span>
                </button>
                <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {t('chat.moreSection')}
                </div>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    markUnread.mutate(id, { onSuccess: () => router.push('/messages') });
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-sm active:bg-muted"
                >
                  <Mail className="h-4 w-4" /> {t('chat.markUnread')}
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
            placeholder={dt('Search in this conversation…')}
            aria-label={dt('Search in this conversation')}
            className="w-full rounded-full border border-border bg-card px-4 py-2 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/20"
          />
          {searchQ.trim().length >= 2 && (
            <div className="mt-2 max-h-64 overflow-y-auto">
              {searchMessages.isPending ? (
                <div className="py-4 text-center text-xs text-muted-foreground">Searching…</div>
              ) : searchResults.length === 0 ? (
                <div className="py-4 text-center text-xs text-muted-foreground">
                  No matching messages.
                </div>
              ) : (
                searchResults.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => {
                      setSearchOpen(false);
                      setReplyTo(r);
                    }}
                    className="flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left active:bg-muted"
                  >
                    <div
                      className={`grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gradient-to-br text-[10px] font-bold text-white ${gradientFor(r.sender?.id ?? r.sender?.fullName ?? '?')}`}
                    >
                      {initialsOf(r.sender?.fullName ?? '?')}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-bold">{r.sender?.fullName ?? 'Unknown'}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {r.body ?? (r.attachmentType === 'image' ? '🖼️ Photo' : '📎 Attachment')}
                      </div>
                    </div>
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {timeAgo(r.createdAt)}
                    </span>
                  </button>
                ))
              )}
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
            onClick={() => {
              setReplyTo(top);
            }}
            className="z-10 flex w-full items-center gap-2 border-b border-border bg-primary/5 px-3 py-1.5 text-left"
          >
            <Pin className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
              <span className="font-bold text-foreground">{dt('Pinned')}</span> ·{' '}
              {top.body ?? (top.attachmentType === 'image' ? '🖼️ Photo' : '📎 Attachment')}
            </span>
          </button>
        );
      })()}

      {/* Offline / queued-message indicator */}
      {(!online || pending > 0) && (
        <div className="z-10 border-b border-border bg-amber-500/10 px-3 py-1.5 text-center text-[11px] font-semibold text-amber-700 dark:text-amber-500">
          {!online
            ? "You're offline — messages will send when you reconnect"
            : `${pending} queued message${pending === 1 ? '' : 's'} — sending…`}
        </div>
      )}

      {/* Message list */}
      <div
        ref={listRef}
        className="flex-1 overflow-y-auto overflow-x-hidden px-3 pb-6 pt-4"
        aria-live="polite"
        onScroll={listOnScroll}
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
              <p className="mt-2 text-sm">{dt('Say hi to start the conversation')}</p>
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
              {loading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <ArrowLeft className="h-3 w-3" />
              )}
              {t('chat.loadOlder')}
            </button>
          </div>
        )}
        {effectiveMessages.map((m, i) => {
          const prev = effectiveMessages[i - 1];
          const next = effectiveMessages[i + 1];
          const showDate = !prev || dateKey(prev.createdAt) !== dateKey(m.createdAt);
          // Telegram-style grouping: consecutive messages from the same sender
          // merge into one visual block (tighter gap + merged corners). A day
          // change also starts a fresh group.
          const groupStart =
            !prev ||
            showDate ||
            prev.senderId !== m.senderId ||
            prev.attachmentType !== m.attachmentType;
          const groupEnd =
            !next ||
            dateKey(next.createdAt) !== dateKey(m.createdAt) ||
            next.senderId !== m.senderId ||
            next.attachmentType !== m.attachmentType;
          return (
            <div
              key={m.id}
              ref={(el) => {
                msgRefs.current[m.id] = el;
              }}
              className={cn(
                'flex flex-col rounded-xl transition-colors',
                groupStart ? 'mt-2' : 'mt-0.5',
                highlightId === m.id && 'bg-primary/10',
              )}
            >
              {showDate && (
                <div className="my-2 flex justify-center">
                  <span className="rounded-full bg-card px-3 py-1 text-[11px] font-semibold text-muted-foreground shadow-sm">
                    {dateLabel(m.createdAt)}
                  </span>
                </div>
              )}
              <MessageBubble
                m={m}
                isMine={m.senderId === me?.id}
                isGroup={!!conv?.isGroup}
                translation={translations[m.id]}
                members={conv?.members ?? []}
                showAvatar={i === 0 || messages[i - 1]?.senderId !== m.senderId}
                groupStart={groupStart}
                groupEnd={groupEnd}
                onImageClick={setViewerUrl}
                onReactOpen={() => setReactingId(m.id)}
                reactingOpen={reactingId === m.id}
                onReactPick={(emoji) => toggleReaction.mutate({ messageId: m.id, emoji })}
                onReactionTap={(emoji) =>
                  toggleReaction.mutate({ messageId: m.id, emoji: emoji as ReactionEmoji })
                }
                onReactionInfo={(msg, emoji) => setReactionInfo({ messageId: msg.id, emoji })}
                onReactClose={() => setReactingId(null)}
                onOpenActions={() => setActionMsg(m)}
                onReplyJump={jumpTo}
                onReplyStart={setReplyTo}
                onReadTap={(msg) => setReadReceiptId(msg.id)}
                highlight={searchOpen ? searchQ : null}
              />
            </div>
          );
        })}

        {/* Live typing indicator */}
        {activeTypers > 0 && (
          <div className="flex items-center gap-2 px-1 text-[11px] text-muted-foreground">
            <span className="flex gap-0.5">
              <span className="typing-dot" />
              <span className="typing-dot" style={{ animationDelay: '0.2s' }} />
              <span className="typing-dot" style={{ animationDelay: '0.4s' }} />
            </span>
            {typingNames.join(', ')} {typingNames.length > 1 ? 'are' : 'is'} typing…
          </div>
        )}
      </div>

      {/* Composer */}
      {/* Jump-to-latest chip (visible when scrolled up) */}
      {!atBottom && (
        <button
          onClick={jumpToBottom}
          aria-label={dt('Jump to latest messages')}
          className="absolute bottom-24 right-4 z-20 flex items-center gap-1.5 rounded-full border border-border bg-background/95 px-3 py-2 text-xs font-bold text-foreground shadow-lg backdrop-blur active:scale-95"
        >
          {missedCount > 0 && (
            <span className="grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
              {missedCount > 99 ? '99+' : missedCount}
            </span>
          )}
          <ArrowDown className="h-4 w-4" />
          <span className="hidden sm:inline">{t('chat.jumpToLatest')}</span>
        </button>
      )}

      <div
        className="sticky bottom-0 z-10 border-t border-border bg-background/95 px-3 pt-3 backdrop-blur-xl"
        style={{ paddingBottom: 'calc(max(0.875rem, env(safe-area-inset-bottom, 14px)))' }}
      >
        {!smartDismissed && smart.length > 0 && composerMode === 'text' && (
          <div className="mx-auto mb-1.5 flex w-full max-w-md items-start gap-2">
            <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
              {smart.map((s, i) => (
                <button
                  key={`${s}-${i}`}
                  onClick={() => sendReply(s)}
                  disabled={send.isPending}
                  className={cn(
                    'max-w-full truncate rounded-full border px-3 py-1.5 text-xs font-medium transition-transform active:scale-95 disabled:opacity-50',
                    i === 0
                      ? 'border-primary/40 bg-primary/10 text-primary'
                      : 'border-border bg-card text-foreground',
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
            <button
              onClick={() => setSmartDismissed(true)}
              aria-label={t('common.cancel')}
              className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        {scheduled.length > 0 && (
          <div className="mx-auto mb-1.5 w-full max-w-md rounded-xl border border-border bg-muted/40 px-3 py-2">
            <div className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              <CalendarClock className="h-3.5 w-3.5" /> {scheduled.length} {t('chat.scheduled')}
            </div>
            {scheduled.map((s) => (
              <div key={s.id} className="flex items-center gap-2 py-0.5 text-xs">
                <span className="min-w-0 flex-1 truncate">{s.body ?? t('chat.attachment')}</span>
                <span className="shrink-0 text-[11px] text-muted-foreground">
                  {t('chat.atTime', { time: new Date(s.at).toLocaleString() })}
                </span>
                <button
                  onClick={() => setScheduled(removeScheduled(id, s.id))}
                  aria-label={t('common.cancel')}
                  className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-red-500"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
        {replyTo && (
          <div className="mx-auto mb-1.5 flex max-w-md items-center gap-2 rounded-lg border-l-2 border-primary bg-muted/60 px-3 py-1.5">
            <Reply className="h-3.5 w-3.5 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-bold uppercase text-primary">
                Replying to {replyTo.senderId === me?.id ? 'yourself' : replyTo.sender.fullName}
              </div>
              <div className="truncate text-xs text-muted-foreground">
                {replyTo.body ??
                  (replyTo.attachmentType === 'audio' ? '🎤 Voice' : '📎 Attachment')}
              </div>
            </div>
            <button
              onClick={() => setReplyTo(null)}
              aria-label={dt('Cancel reply')}
              className="grid h-6 w-6 place-items-center rounded-full text-muted-foreground active:bg-muted"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        {(() => {
          const u = firstUrlIn(text);
          return u ? (
            <div className={cn('mx-auto mb-1.5 max-w-md', replyTo && 'mt-1')}>
              <LinkPreview url={u} />
            </div>
          ) : null;
        })()}
        <div className="relative mx-auto w-full max-w-md">
          {/* Emoji */}
          {emojiOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setEmojiOpen(false)} />
              <div className="absolute bottom-14 left-0 z-40 grid w-64 grid-cols-8 gap-1 rounded-2xl border border-border bg-card p-3 shadow-2xl">
                {EMOJI_QUICK.map((e) => (
                  <button
                    key={e}
                    onClick={() => {
                      setText(text + e);
                      setEmojiOpen(false);
                    }}
                    className="grid h-8 w-8 place-items-center rounded-lg text-lg hover:bg-muted active:scale-90"
                    aria-label={`Insert ${e}`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </>
          )}
          <StickerPicker
            open={stickerOpen}
            onClose={() => setStickerOpen(false)}
            onPick={(e) => setText(text + e)}
          />
          {/* Save replies (quick replies) */}
          {quickRepliesOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setQuickRepliesOpen(false)} />
              <div className="absolute bottom-14 left-0 z-40 w-64 rounded-2xl border border-border bg-card p-2 shadow-2xl">
                <div className="px-2 pb-1 pt-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                  {t('chat.quickReplies')}
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {replies.length === 0 && (
                    <p className="px-2 py-3 text-xs text-muted-foreground">{t('chat.noReplies')}</p>
                  )}
                  {replies.map((r) => (
                    <div
                      key={r.id}
                      className="group flex items-center gap-1 rounded-lg px-2 py-1.5 hover:bg-muted"
                    >
                      <button
                        onClick={() => {
                          setText(r.body);
                          setQuickRepliesOpen(false);
                        }}
                        className="min-w-0 flex-1 text-left"
                      >
                        <div className="truncate text-xs font-semibold">{r.title}</div>
                        <div className="truncate text-[11px] text-muted-foreground">{r.body}</div>
                      </button>
                      <button
                        onClick={() => removeReply(r.id)}
                        aria-label={dt('Delete reply')}
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
                    if (!body) {
                      toast.error(t('chat.typeReply'));
                      return;
                    }
                    const title = window.prompt(t('chat.nameReply'), body.slice(0, 40) || 'Reply');
                    if (title) {
                      addReply(title, body);
                      setQuickRepliesOpen(false);
                    }
                  }}
                  className="mx-2 mb-1 flex w-[calc(100%-1rem)] items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-2 text-xs font-semibold text-primary active:bg-muted"
                >
                  <Plus className="h-3.5 w-3.5" /> {t('chat.saveReply')}
                </button>
              </div>
            </>
          )}
          {/* Disappearing timer */}
          {timerSec > 0 && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setTimerSec(0)} />
              <div className="absolute bottom-14 left-0 z-40 flex w-56 flex-wrap gap-1 rounded-2xl border border-border bg-card p-2 shadow-2xl">
                {(
                  [
                    { s: 60, l: '1m' },
                    { s: 3600, l: '1h' },
                    { s: 86400, l: '1d' },
                    { s: 604800, l: '1w' },
                  ] as { s: number; l: string }[]
                ).map((o) => (
                  <button
                    key={o.s}
                    onClick={() => setTimerSec(o.s)}
                    className={cn(
                      'flex-1 rounded-lg border px-2 py-1.5 text-xs font-semibold active:bg-muted',
                      timerSec === o.s
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border',
                    )}
                  >
                    <TimerIcon className="mr-1 inline h-3 w-3" />
                    {o.l}
                  </button>
                ))}
                {timerSec > 0 && (
                  <button
                    onClick={() => setTimerSec(0)}
                    className="w-full rounded-lg py-1 text-xs font-semibold text-red-500 active:bg-muted"
                  >
                    {t('common.cancel')}
                  </button>
                )}
              </div>
            </>
          )}
          {/* Schedule send */}
          {scheduledOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setScheduledOpen(false)} />
              <div className="absolute bottom-14 left-0 z-40 w-64 rounded-2xl border border-border bg-card p-2 shadow-2xl">
                <div className="px-2 pb-1 pt-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                  {t('chat.schedule')}
                </div>
                <div className="grid grid-cols-1 gap-1">
                  {(
                    [
                      { ms: 10 * 60 * 1000, l: t('chat.in10m') },
                      { ms: 60 * 60 * 1000, l: t('chat.in1h') },
                      { ms: 3 * 60 * 60 * 1000, l: t('chat.in3h') },
                      { ms: 24 * 60 * 60 * 1000, l: t('chat.tomorrow') },
                    ] as { ms: number; l: string }[]
                  ).map((o) => (
                    <button
                      key={o.ms}
                      onClick={() => {
                        const at = Date.now() + o.ms;
                        const item: ScheduledSend = {
                          id: makeClientId() + '_sch',
                          conversationId: id,
                          body: text.trim(),
                          replyToId: replyTo?.id,
                          clientId: makeClientId(),
                          at,
                        };
                        setScheduled(addScheduled(item));
                        setText('');
                        setReplyTo(null);
                        setScheduledOpen(false);
                        toast.success(t('chat.scheduledNote'));
                      }}
                      className="flex items-center justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-muted"
                    >
                      {o.l}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
          {/* Input row — Telegram-style pill (emoji left, paperclip right) + blue send/+ */}
          {composerMode === 'voice' ? (
            <div className="flex-1">
              <VoiceRecorder
                onSend={async (att) => {
                  await send.mutateAsync({
                    attachmentUrl: att.url,
                    attachmentType: 'audio',
                    attachmentMeta: {
                      duration: att.durationSec,
                      size: att.sizeBytes,
                      waveform: att.waveform,
                    },
                    replyToId: replyTo?.id,
                  });
                  setReplyTo(null);
                  setComposerMode('text');
                }}
              />
              <p className="mt-1.5 px-1 text-center text-[11px] text-muted-foreground">
                {t('chat.voiceHint')}
              </p>
            </div>
          ) : (
            <div className="flex items-end gap-2">
              <div className="flex min-h-11 flex-1 items-center gap-1 overflow-hidden rounded-2xl border border-border bg-card px-2 py-1.5 dark:border-white/10 dark:bg-background/60 dark:shadow-inner">
                <button
                  onClick={() => setEmojiOpen((v) => !v)}
                  aria-label={dt('Emoji')}
                  aria-pressed={emojiOpen}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted-foreground transition-transform hover:bg-muted hover:text-foreground active:scale-90"
                >
                  <Smile className={cn('h-5 w-5', emojiOpen && 'text-primary')} />
                </button>
                <textarea
                  ref={inputRef}
                  value={text}
                  onChange={(e) => handleTextChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && enterToSend) {
                      e.preventDefault();
                      void handleSend();
                    }
                  }}
                  rows={1}
                  placeholder={t('chat.typePlaceholder')}
                  aria-label={t('chat.typePlaceholder')}
                  className="min-w-0 flex-1 resize-none bg-transparent px-1 py-2.5 text-sm leading-6 outline-none placeholder:text-muted-foreground"
                  style={{ maxHeight: '140px', minHeight: '38px' }}
                />
                {text.length >= CHAR_MAX - CHAR_THRESHOLD && (
                  <span
                    className={cn(
                      'shrink-0 select-none pb-1 font-mono text-[10px] tabular-nums',
                      text.length >= CHAR_MAX ? 'text-red-500' : 'text-amber-500',
                    )}
                  >
                    {text.length}
                  </span>
                )}
                <AttachButton
                  disabled={send.isPending}
                  className="h-9 w-9 rounded-full bg-transparent hover:bg-muted"
                  onAttached={async (att) => {
                    await send.mutateAsync({
                      attachmentUrl: att.url,
                      attachmentType: att.type === 'image' ? 'image' : 'file',
                      attachmentMeta: {
                        name: att.name,
                        size: att.sizeBytes,
                        contentType: att.contentType,
                      },
                      replyToId: replyTo?.id,
                    });
                    setReplyTo(null);
                  }}
                />
              </div>
              {timerSec > 0 && (
                <button
                  onClick={() => setTimerSec(0)}
                  title={`${Math.round(timerSec / 60)}m`}
                  aria-label={t('chat.timer')}
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-primary active:scale-90"
                >
                  <TimerIcon className="h-5 w-5" />
                  <span className="-mt-3 grid h-4 w-4 place-items-center rounded-full bg-primary text-[8px] font-bold text-white">
                    {Math.round(timerSec / 60)}
                  </span>
                </button>
              )}
              <button
                onClick={() => {
                  if (text.trim()) {
                    setSendFx((v) => v + 1);
                    void handleSend();
                  } else {
                    setToolsOpen(true);
                  }
                }}
                disabled={send.isPending}
                aria-label={text.trim() ? t('common.post') : t('chat.addTools')}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground shadow-md shadow-primary/40 transition-transform active:scale-90 disabled:opacity-40"
              >
                {send.isPending ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : text.trim() ? (
                  <Send key={sendFx} className={cn('h-5 w-5', sendFx > 0 && 'send-fly')} />
                ) : (
                  <Plus className="h-5 w-5" />
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Tools bottom sheet (slides up) */}
      {toolsOpen && (
        <div
          className="fixed inset-0 z-[96] flex items-end justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setToolsOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-t-3xl border border-b-0 border-border bg-card pb-5"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label={t('chat.addTools')}
          >
            <div className="mx-auto mt-3 h-1.5 w-10 rounded-full bg-muted" />
            <div className="px-4 pt-3">
              <div className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                {t('chat.addTools')}
              </div>
              <PanelRow
                icon={<Mic className="h-4 w-4" />}
                label={t('chat.voice')}
                onClick={() => {
                  setToolsOpen(false);
                  setComposerMode('voice');
                }}
              />
              {me?.role === 'FREELANCER' && (
                <PanelRow
                  icon={<Package className="h-4 w-4" />}
                  label={t('offer.title')}
                  onClick={() => {
                    setToolsOpen(false);
                    setOfferSheetOpen(true);
                  }}
                />
              )}
              <PanelRow
                icon={<Sticker className="h-4 w-4" />}
                label={t('chat.stickers')}
                onClick={() => {
                  setToolsOpen(false);
                  setStickerOpen(true);
                }}
              />
              <PanelRow
                icon={<Zap className="h-4 w-4" />}
                label={t('chat.quickReplies')}
                onClick={() => {
                  setToolsOpen(false);
                  setQuickRepliesOpen(true);
                }}
              />
              <PanelRow
                icon={<TimerIcon className="h-4 w-4" />}
                label={t('chat.timer')}
                onClick={() => {
                  setToolsOpen(false);
                  setTimerSec((v) => (v > 0 ? 0 : 60));
                }}
              />
              <PanelRow
                icon={<CalendarClock className="h-4 w-4" />}
                label={t('chat.schedule')}
                onClick={() => {
                  setToolsOpen(false);
                  setScheduledOpen(true);
                }}
              />
            </div>
          </div>
        </div>
      )}

      <CustomOfferSheet
        open={offerSheetOpen}
        onOpenChange={setOfferSheetOpen}
        conversationId={id}
      />
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
              <div className="text-[11px] text-muted-foreground">
                {peer?.fullName ?? 'Someone'} is calling
              </div>
            </div>
            <button
              onClick={() => setIncoming(null)}
              className="grid h-10 w-10 place-items-center rounded-full bg-red-600 text-white active:scale-90"
              aria-label={dt('Decline')}
            >
              <X className="h-5 w-5" />
            </button>
            <button
              onClick={() => {
                setCallMode(incoming.mode);
                setIncoming(null);
              }}
              className="grad-hero grid h-10 w-10 place-items-center rounded-full text-white active:scale-90"
              aria-label={dt('Accept')}
            >
              <Phone className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      {/* Active call */}
      {callMode && (
        <CallPanel conversationId={id} mode={callMode} onEnd={() => setCallMode(null)} />
      )}

      {/* Group members sheet */}
      {membersOpen && conv?.isGroup && (
        <div
          className="fixed inset-0 z-[90] flex items-end justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setMembersOpen(false)}
        >
          <div
            className="max-h-[75dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-b-0 border-border bg-card p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-muted" />
            <div className="mb-3 flex items-center justify-between">
              {t('chat.members')}
              <button
                onClick={() => setMembersOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-full active:bg-muted"
                aria-label={dt('Close')}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {conv.me?.isAdmin ? (
              <button
                onClick={async () => {
                  const input = window.prompt('Add members by @username, separated by commas');
                  if (!input) return;
                  const names = input
                    .split(',')
                    .map((s) => s.trim().replace(/^@/, ''))
                    .filter(Boolean);
                  const found: string[] = [];
                  for (const name of names) {
                    try {
                      const r = await apiFetch<any>(`/search?q=${encodeURIComponent(name)}`, {
                        token,
                      });
                      const users = (r as any)?.users ?? [];
                      const hit =
                        users.find((u: any) => u.username?.toLowerCase() === name.toLowerCase()) ??
                        users[0];
                      if (hit?.id) found.push(hit.id);
                    } catch {
                      /* skip */
                    }
                  }
                  if (found.length === 0) {
                    toast.error(t('chat.noMatching'));
                    return;
                  }
                  addMembers.mutate(found, {
                    onSuccess: () =>
                      toast.success(`Added ${found.length} member${found.length === 1 ? '' : 's'}`),
                  });
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
                  <div
                    key={m.userId}
                    className="flex items-center gap-3 rounded-xl p-2 hover:bg-muted/50"
                  >
                    <div
                      className={cn(
                        'grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br text-xs font-bold text-white',
                        gradientFor(m.userId),
                      )}
                    >
                      {initialsOf(m.fullName)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 text-sm font-semibold">
                        {m.fullName}{' '}
                        {m.userId === me?.id && (
                          <span className="text-[10px] text-muted-foreground">(you)</span>
                        )}
                        {m.isAdmin && (
                          <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                            admin
                          </span>
                        )}
                        {!m.isAdmin && typeof presence[m.userId] === 'boolean' && (
                          <span
                            className={cn(
                              'inline-block h-1.5 w-1.5 rounded-full',
                              presence[m.userId] ? 'bg-emerald-500' : 'bg-muted-foreground/40',
                            )}
                          />
                        )}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        @{m.username}
                        {typing ? ' · typing…' : ''}
                        {!typing && presence[m.userId] ? ' · online' : ''}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Read-receipt popover: shows exactly who has seen this message */}
      {readReceiptId &&
        (() => {
          const msg = messages.find((x) => x.id === readReceiptId);
          const seenBy = (msg?.readByUserIds ?? []).map((uid) => {
            const member = (conv?.members ?? []).find((mm) => mm.userId === uid);
            return {
              uid,
              fullName: member?.fullName ?? uid,
              username: member?.username ?? '',
              isMe: uid === me?.id,
            };
          });
          const notSeen = (conv?.members ?? []).filter(
            (mm) => mm.userId !== me?.id && !(msg?.readByUserIds ?? []).includes(mm.userId),
          );
          return (
            <div
              className="fixed inset-0 z-[96] flex items-end justify-center bg-black/50 backdrop-blur-sm"
              onClick={() => setReadReceiptId(null)}
            >
              <div
                className="max-h-[70dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-b-0 border-border bg-card p-5"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-muted" />
                <div className="mb-1 flex items-center justify-between">
                  <h2 className="flex items-center gap-2 text-lg font-extrabold">
                    <Eye className="h-5 w-5 text-primary" />
                    {t('chat.readReceipts')}
                  </h2>
                  <button
                    onClick={() => setReadReceiptId(null)}
                    className="grid h-8 w-8 place-items-center rounded-full active:bg-muted"
                    aria-label={dt('Close')}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="truncate text-[11px] text-muted-foreground">
                  {seenBy.length}/{msg?.readByTotal ?? 0} seen · {msg?.body ?? '📎 Attachment'}
                </div>
                <div className="mt-3 space-y-1">
                  {seenBy.length === 0 && (
                    <div className="py-4 text-center text-xs text-muted-foreground">
                      {t('chat.seenBy', { names: '—' })}
                    </div>
                  )}
                  {seenBy.map((m) => {
                    const row = (
                      <div className="flex w-full items-center gap-3 rounded-xl p-2">
                        <div
                          className={cn(
                            'grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br text-xs font-bold text-white',
                            gradientFor(m.uid),
                          )}
                        >
                          {initialsOf(m.fullName)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold">
                            {m.fullName}{' '}
                            {m.isMe && (
                              <span className="text-[10px] text-muted-foreground">(you)</span>
                            )}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            @{m.username || m.uid}
                          </div>
                        </div>
                        <CheckCheck className="h-4 w-4 shrink-0 text-primary" />
                      </div>
                    );
                    return m.isMe || !m.username ? (
                      row
                    ) : (
                      <Link
                        key={m.uid}
                        href={`/u/${m.username}`}
                        className="flex items-center rounded-xl active:bg-muted"
                        onClick={() => setReadReceiptId(null)}
                      >
                        {row}
                      </Link>
                    );
                  })}
                </div>
                {notSeen.length > 0 && (
                  <>
                    <div className="mt-4 pb-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                      {t('chat.readReceiptsNotSeen')}
                    </div>
                    <div className="space-y-1">
                      {notSeen.map((m) => {
                        const row = (
                          <div className="flex w-full items-center gap-3 rounded-xl p-2 opacity-70">
                            <div
                              className={cn(
                                'grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br text-xs font-bold text-white',
                                gradientFor(m.userId),
                              )}
                            >
                              {initialsOf(m.fullName)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-semibold">{m.fullName}</div>
                              <div className="text-[11px] text-muted-foreground">@{m.username}</div>
                            </div>
                            <Check className="h-4 w-4 shrink-0 text-muted-foreground" />
                          </div>
                        );
                        return m.username ? (
                          <Link
                            key={m.userId}
                            href={`/u/${m.username}`}
                            className="flex items-center rounded-xl active:bg-muted"
                            onClick={() => setReadReceiptId(null)}
                          >
                            {row}
                          </Link>
                        ) : (
                          <div key={m.userId}>{row}</div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })()}

      {/* Who-reacted popover: lists everyone who chose this emoji on a message */}
      {reactionInfo &&
        (() => {
          const msg = messages.find((x) => x.id === reactionInfo.messageId);
          const bucket = msg?.reactions?.find((r) => r.emoji === reactionInfo.emoji);
          const reactors = (bucket?.reactorIds ?? []).map((uid) => {
            const member = (conv?.members ?? []).find((mm) => mm.userId === uid);
            return {
              uid,
              fullName: member?.fullName ?? uid,
              username: member?.username ?? '',
              isMe: uid === me?.id,
            };
          });
          return (
            <div
              className="fixed inset-0 z-[96] flex items-end justify-center bg-black/50 backdrop-blur-sm"
              onClick={() => setReactionInfo(null)}
            >
              <div
                className="max-h-[70dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-b-0 border-border bg-card p-5"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-muted" />
                <div className="mb-1 flex items-center justify-between">
                  <h2 className="flex items-center gap-2 text-lg font-extrabold">
                    <span className="text-2xl leading-none">{reactionInfo.emoji}</span>
                    {t('chat.reactions')}
                  </h2>
                  <button
                    onClick={() => setReactionInfo(null)}
                    className="grid h-8 w-8 place-items-center rounded-full active:bg-muted"
                    aria-label={dt('Close')}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="truncate text-[11px] text-muted-foreground">
                  {bucket?.count ?? 0} {t('chat.reactions')} · {msg?.body ?? '📎 Attachment'}
                </div>
                <div className="mt-3 space-y-1">
                  {reactors.length === 0 && (
                    <div className="py-4 text-center text-xs text-muted-foreground">
                      {t('chat.noReactions')}
                    </div>
                  )}
                  {reactors.map((m) => {
                    const row = (
                      <div className="flex w-full items-center gap-3 rounded-xl p-2">
                        <div
                          className={cn(
                            'grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br text-xs font-bold text-white',
                            gradientFor(m.uid),
                          )}
                        >
                          {initialsOf(m.fullName)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold">
                            {m.fullName}{' '}
                            {m.isMe && (
                              <span className="text-[10px] text-muted-foreground">(you)</span>
                            )}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            @{m.username || m.uid}
                          </div>
                        </div>
                        <span className="text-xl">{reactionInfo.emoji}</span>
                      </div>
                    );
                    return m.isMe || !m.username ? (
                      row
                    ) : (
                      <Link
                        key={m.uid}
                        href={`/u/${m.username}`}
                        className="flex items-center rounded-xl active:bg-muted"
                        onClick={() => setReactionInfo(null)}
                      >
                        {row}
                      </Link>
                    );
                  })}
                </div>
                <button
                  onClick={() => {
                    toggleReaction.mutate({
                      messageId: reactionInfo.messageId,
                      emoji: reactionInfo.emoji as ReactionEmoji,
                    });
                    setReactionInfo(null);
                  }}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-border py-2.5 text-sm font-semibold active:scale-[.98]"
                >
                  {bucket?.mine ? t('chat.removeReaction') : t('chat.addReaction')}{' '}
                  {reactionInfo.emoji}
                </button>
              </div>
            </div>
          );
        })()}

      {/* Forward picker */}
      {forwardMsg && (
        <div
          className="fixed inset-0 z-[95] flex items-end justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setForwardMsg(null)}
        >
          <div
            className="max-h-[75dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-b-0 border-border bg-card p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-muted" />
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-extrabold">{t('chat.forward')} →</h2>
              <button
                onClick={() => setForwardMsg(null)}
                className="grid h-8 w-8 place-items-center rounded-full active:bg-muted"
                aria-label={dt('Close')}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mb-3 rounded-lg border-l-2 border-primary bg-muted/50 px-3 py-2">
              <div className="truncate text-xs text-muted-foreground">
                {forwardMsg.body ?? '📎 Attachment'}
              </div>
            </div>
            <div className="space-y-1">
              {(convs?.items ?? [])
                .filter((c) => c.id !== id)
                .map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      forwardMessage.mutate(
                        { messageId: forwardMsg.id, targetConversationId: c.id },
                        {
                          onSuccess: () => {
                            toast.success(dt('Forwarded'));
                            setForwardMsg(null);
                          },
                          onError: (e) => {
                            toast.error((e as Error).message);
                            setForwardMsg(null);
                          },
                        },
                      );
                    }}
                    className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-muted/50"
                  >
                    <div
                      className={cn(
                        'grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br text-xs font-bold text-white',
                        gradientFor(c.id),
                      )}
                    >
                      {initialsOf(c.peer?.fullName ?? c.title ?? 'C')}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">
                        {c.peer?.fullName ?? c.title ?? 'Conversation'}
                      </div>
                      <div className="truncate text-[11px] text-muted-foreground">
                        {c.peer
                          ? `@${c.peer.username}`
                          : `${(c as any).members?.length ?? ''} members`}
                      </div>
                    </div>
                    <Forward className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                ))}
              {(convs?.items ?? []).filter((c) => c.id !== id).length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  {t('chat.noTargets')}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Message actions sheet (labeled) */}
      {actionMsg && (
        <div
          className="fixed inset-0 z-[96] flex items-end justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setActionMsg(null)}
        >
          <div
            className="w-full max-w-md rounded-t-3xl border border-b-0 border-border bg-card py-3"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label={dt('Message actions')}
          >
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-muted" />
            <div className="mx-5 mb-3 flex items-center gap-2 rounded-xl border-l-2 border-primary bg-muted/40 px-3 py-2">
              <div className="flex-1">
                <div className="text-[11px] font-bold text-primary">
                  {actionMsg.senderId === me?.id ? 'You' : actionMsg.sender?.fullName}
                </div>
                <div className="max-h-12 overflow-hidden truncate text-sm text-foreground">
                  {actionMsg.body ??
                    (actionMsg.attachmentType === 'image'
                      ? '🖼️ Photo'
                      : actionMsg.attachmentType === 'audio'
                        ? '🎤 Voice message'
                        : '📎 Attachment')}
                </div>
              </div>
              <span className="shrink-0 text-[11px] text-muted-foreground">
                {timeAgo(actionMsg.createdAt)}
              </span>
            </div>
            <div className="mx-5 mb-2 flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                {t('chat.react')}
              </span>
              <div className="flex gap-1">
                {REACTION_EMOJIS.slice(0, 6).map((e) => (
                  <button
                    key={e}
                    onClick={(ev) => {
                      ev.stopPropagation();
                      toggleReaction.mutate({ messageId: actionMsg.id, emoji: e });
                      setActionMsg(null);
                    }}
                    className="grid h-8 w-8 place-items-center rounded-full text-lg transition-transform hover:bg-muted active:scale-90"
                    aria-label={`React ${e}`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
            <div className="mx-2">
              <ActionRow
                icon={<Reply className="h-4 w-4" />}
                label={t('chat.reply')}
                onClick={() => {
                  setReplyTo(actionMsg);
                  setActionMsg(null);
                }}
              />
              <ActionRow
                icon={<SmilePlus className="h-4 w-4" />}
                label={t('chat.react')}
                onClick={() => {
                  setReactingId(actionMsg.id);
                  setActionMsg(null);
                }}
              />
              <ActionRow
                icon={<Forward className="h-4 w-4" />}
                label={t('chat.forward')}
                onClick={() => {
                  forwardTo(actionMsg);
                  setActionMsg(null);
                }}
              />
              <ActionRow
                icon={<Pin className="h-4 w-4" />}
                label={actionMsg.pinnedAt ? t('chat.unpin') : t('chat.pin')}
                onClick={() => {
                  pinMessage.mutate({ messageId: actionMsg.id, pinned: !actionMsg.pinnedAt });
                  setActionMsg(null);
                }}
              />
              {!conv?.isSaved && (
                <ActionRow
                  icon={<Bookmark className="h-4 w-4" />}
                  label={t('chat.saveAction')}
                  onClick={() => {
                    saveMessage(actionMsg);
                    setActionMsg(null);
                  }}
                />
              )}
              {actionMsg.body && (
                <ActionRow
                  icon={<Copy className="h-4 w-4" />}
                  label={t('chat.copyText')}
                  onClick={() => {
                    void navigator.clipboard?.writeText(actionMsg.body ?? '');
                    toast.success(t('chat.copied'));
                    setActionMsg(null);
                  }}
                />
              )}
              {actionMsg.body && (
                <ActionRow
                  icon={<Languages className="h-4 w-4" />}
                  label={translations[actionMsg.id] ? t('chat.translated') : t('chat.translate')}
                  onClick={() => {
                    void translateMsg(actionMsg);
                    setActionMsg(null);
                  }}
                />
              )}
              {actionMsg.senderId === me?.id &&
                (actionMsg.readByTotal ?? 0) > 0 &&
                conv?.members && (
                  <div className="mx-3 my-1 rounded-xl border border-border/60 bg-muted/20 px-3 py-2">
                    <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                      {t('chat.readReceipts')}
                    </div>
                    <div className="mt-1 text-xs text-foreground">
                      {(actionMsg.readBy ?? 0) > 0
                        ? t('chat.seenBy', {
                            names:
                              conv.members
                                .filter((m) => actionMsg.readByUserIds?.includes(m.userId))
                                .map((m) => m.fullName.split(' ')[0])
                                .join(', ') || '—',
                          })
                        : t('chat.notSeen')}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {t('chat.readFraction', {
                        read: actionMsg.readBy ?? 0,
                        total: actionMsg.readByTotal ?? 0,
                      })}
                    </div>
                  </div>
                )}
              {actionMsg.senderId === me?.id && (
                <>
                  <ActionRow
                    icon={<Pencil className="h-4 w-4" />}
                    label={t('chat.edit')}
                    onClick={() => {
                      const next = window.prompt(t('chat.editMessage'), actionMsg.body ?? '');
                      if (next !== null && next.trim() && next !== actionMsg.body)
                        editMessage.mutate({ messageId: actionMsg.id, body: next.trim() });
                      setActionMsg(null);
                    }}
                  />
                  <ActionRow
                    icon={<Trash2 className="h-4 w-4" />}
                    label={t('chat.deleteForMe')}
                    danger
                    onClick={() => {
                      if (window.confirm(t('chat.deleteMessage')))
                        deleteMessage.mutate(actionMsg.id);
                      setActionMsg(null);
                    }}
                  />
                </>
              )}
            </div>
            <button
              onClick={() => setActionMsg(null)}
              className="mx-5 mt-2 w-[calc(100%-2.5rem)] rounded-2xl border border-border py-3 text-sm font-semibold active:bg-muted"
            >
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
            aria-label={dt('Close gallery')}
            className="safe-top absolute right-4 top-4 z-20 grid h-11 w-11 place-items-center rounded-full bg-black/60 text-white active:scale-90"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="safe-top absolute inset-0 overflow-y-auto p-4 pt-16">
            <h2 className="mb-3 text-sm font-bold text-white/80">{dt('Media in this chat')}</h2>
            <div className="grid grid-cols-3 gap-1">
              {imageUrls
                .slice()
                .reverse()
                .map((url) => (
                  <button
                    key={url}
                    onClick={() => {
                      setGalleryOpen(false);
                      setViewerUrl(url);
                    }}
                    className="relative aspect-square overflow-hidden rounded-lg bg-black/40"
                  >
                    <Image
                      src={url}
                      alt={dt('')}
                      fill
                      unoptimized
                      sizes="(max-width: 640px) 33vw, 128px"
                      className="object-cover"
                    />
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Split a message body into text / link / mention / code segments and render
 * each with a tap action: URLs open, @handles go to that user's profile, and
 * `` `code` `` copies to clipboard. Search-hit text is highlighted. */
function RichBody({
  body,
  isMine,
  highlight,
  className,
}: {
  body: string;
  isMine: boolean;
  highlight?: string | null;
  className?: string;
}) {
  const { t } = useI18n();
  const q = highlight?.trim().toLowerCase();
  const qLen = q && q.length >= 2 ? q.length : 0;

  const highlightText = (s: string, key: string) => {
    if (!qLen) return <span key={key}>{s}</span>;
    const idx = s.toLowerCase().indexOf(q!);
    if (idx < 0) return <span key={key}>{s}</span>;
    return (
      <span key={key}>
        {s.slice(0, idx)}
        <mark
          className={cn(
            'rounded px-0.5 font-bold text-foreground',
            isMine ? 'bg-yellow-300' : 'bg-primary/20',
          )}
        >
          {s.slice(idx, idx + qLen)}
        </mark>
        {s.slice(idx + qLen)}
      </span>
    );
  };

  const copyCode = (code: string) => {
    try {
      void navigator.clipboard?.writeText(code);
      toast.success(t('chat.copiedCode'));
    } catch {
      /* ignore */
    }
  };

  // URL, @mention, #hashtag, or `inline code` (non-greedy code so it doesn't swallow newlines).
  const re = /(https?:\/\/[^\s<]+)|(@[a-zA-Z0-9_]{2,30})|(#[a-zA-Z0-9_]{3,30})|(`[^`\n]+`)/g;
  const out: ReactNode[] = [];
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    if (m.index > last) out.push(highlightText(body.slice(last, m.index), `t${key++}`));
    const tok = m[0];
    if (m[1]) {
      const href = /^https?:\/\//i.test(tok) ? tok : `https://${tok}`;
      out.push(
        <a
          key={`l${key++}`}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className={cn(
            'underline decoration-dotted underline-offset-2',
            isMine ? 'text-white' : 'text-primary',
          )}
        >
          {tok}
        </a>,
      );
    } else if (m[2]) {
      out.push(
        <Link
          key={`l${key++}`}
          href={`/u/${tok.slice(1)}`}
          onClick={(e) => e.stopPropagation()}
          className={cn('font-bold', isMine ? 'text-white' : 'text-primary')}
        >
          {tok}
        </Link>,
      );
    } else if (m[3]) {
      out.push(
        <span
          key={`l${key++}`}
          className={cn('font-semibold', isMine ? 'text-white' : 'text-primary')}
        >
          {tok}
        </span>,
      );
    } else if (m[4]) {
      const code = tok.slice(1, -1);
      out.push(
        <button
          key={`l${key++}`}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            copyCode(code);
          }}
          className={cn(
            'mx-0.5 rounded border px-1 py-0.5 font-mono text-[0.85em]',
            isMine ? 'border-white/30 bg-white/10' : 'border-border bg-muted text-foreground',
          )}
          title={t('chat.copyCode')}
        >
          {code}
        </button>,
      );
    }
    last = m.index + tok.length;
  }
  if (last < body.length) out.push(highlightText(body.slice(last), `t${key++}`));

  return (
    <p className={cn('whitespace-pre-wrap break-words', className)}>{out.length ? out : body}</p>
  );
}

function MessageBubble({
  m,
  isMine,
  isGroup,
  members,
  showAvatar,
  groupStart = true,
  groupEnd = true,
  onImageClick,
  onOpenActions,
  onReactOpen,
  reactingOpen,
  onReactPick,
  onReactionTap,
  onReactClose,
  onReplyJump,
  onReplyStart,
  onReadTap,
  onReactionInfo,
  highlight,
  translation,
}: {
  m: ChatMessage;
  isMine: boolean;
  isGroup?: boolean;
  members?: { userId: string; fullName: string; avatarUrl?: string | null }[];
  showAvatar: boolean;
  /** First of a same-sender run → normal top corners. */
  groupStart?: boolean;
  /** Last of a same-sender run → tail corner. */
  groupEnd?: boolean;
  onImageClick?: (url: string) => void;
  onOpenActions?: () => void;
  onReactOpen?: () => void;
  reactingOpen?: boolean;
  onReactPick?: (e: ReactionEmoji) => void;
  onReactionTap?: (emoji: string) => void;
  onReactClose?: () => void;
  onReplyJump?: (id: string) => void;
  onReplyStart?: (m: ChatMessage) => void;
  onReadTap?: (m: ChatMessage) => void;
  onReactionInfo?: (m: ChatMessage, emoji: string) => void;
  highlight?: string | null;
  /** One-tap translation of the message body (from the actions sheet). */
  translation?: string;
}) {
  const { t } = useI18n();
  const [showTranslation, setShowTranslation] = useState(true);
  const isImage = m.attachmentType === 'image';
  const isAudio = m.attachmentType === 'audio';
  const isFile = m.attachmentType === 'file' || m.attachmentType === 'video';
  const hasAttachment = !!m.attachmentUrl;
  const offerMatch = m.attachmentUrl?.match(/^apex:\/\/offer\/([a-zA-Z0-9_-]+)$/);
  const sticker = isSticker(m.body);

  // Self-destruct timer (disappearing message).
  const timerSec = Number((m.attachmentMeta as any)?.timer);
  const expiresAt = timerSec ? Date.parse(m.createdAt) + timerSec * 1000 : 0;
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (!timerSec) return;
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, [timerSec]);
  const expired = timerSec > 0 && expiresAt <= nowMs;
  const remainingSec = timerSec ? Math.max(0, Math.ceil((expiresAt - nowMs) / 1000)) : 0;

  // Seen-by avatar stack for my own messages.
  const seen = isMine && (m.readByUserIds?.length ?? 0) > 0 ? (m.readByUserIds ?? []) : [];
  const seenMembers = seen
    .map((uid) => members?.find((mm) => mm.userId === uid))
    .filter(Boolean) as { userId: string; fullName: string; avatarUrl?: string | null }[];
  const seenCut = seenMembers.slice(0, 3);
  const seenExtra = seenMembers.length - seenCut.length;

  // Long-press → reply.
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressed = useRef(false);
  // Double-tap to quick-react ❤️ (Telegram-style): a quick second tap cancels the
  // pending "open actions" and reacts instead.
  const lastTap = useRef(0);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startPress = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button, a')) return;
    longPressed.current = false;
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = setTimeout(() => {
      longPressed.current = true;
      haptic();
      onReplyStart?.(m);
    }, 550);
  };
  const cancelPress = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
  };

  // Swipe-right on a bubble → reply (mobile). Kept distinct from the edge
  // swipe-back on the page, which only triggers from the far-left edge.
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const onBubbleTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    if (!t) return;
    swipeStart.current = { x: t.clientX, y: t.clientY };
  };
  const onBubbleTouchEnd = (e: React.TouchEvent) => {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    if (!t) return;
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (dx > 70 && Math.abs(dx) > Math.abs(dy) * 1.6) {
      cancelPress();
      haptic();
      onReplyStart?.(m);
    }
  };

  // Long-press to open the reaction picker on mobile.

  if (offerMatch) {
    return (
      <div className={cn('flex items-end gap-2', isMine ? 'justify-end' : 'justify-start')}>
        {!isMine && <div className="w-8 shrink-0" />}
        <OfferCard offerId={offerMatch[1]!} isMine={isMine} />
      </div>
    );
  }

  // Self-destructed (disappeared) message — show a subtle "message expired" chip.
  if (expired) {
    return (
      <div className={cn('flex items-end gap-2 px-2', isMine ? 'justify-end' : 'justify-start')}>
        <div
          className={cn(
            'rounded-2xl border border-dashed px-3 py-1.5 text-[11px] italic',
            isMine ? 'border-white/20 text-white/50' : 'border-border text-muted-foreground',
          )}
        >
          {t('chat.messageExpired')}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex items-end gap-2', isMine ? 'justify-end' : 'justify-start')}>
      {!isMine && (
        <div className={cn('w-8 shrink-0', showAvatar ? '' : 'invisible')}>
          {showAvatar && (
            <Link
              href={`/u/${m.sender.username}`}
              className="block"
              aria-label={m.sender.fullName}
              title={m.sender.fullName}
            >
              <UserAvatar
                name={m.sender.fullName}
                avatarUrl={m.sender.avatarUrl}
                id={m.sender.id}
                verified={m.sender.isVerified}
                className="h-8 w-8 text-[11px] font-bold"
              />
            </Link>
          )}
        </div>
      )}
      <div className="group flex min-w-0 items-end gap-1">
        <div
          onClick={() => {
            if (longPressed.current) {
              longPressed.current = false;
              return;
            }
            const now = Date.now();
            if (now - lastTap.current < 300) {
              lastTap.current = 0;
              if (tapTimer.current) clearTimeout(tapTimer.current);
              tapTimer.current = null;
              haptic();
              onReactPick?.('❤️');
              return;
            }
            lastTap.current = now;
            if (tapTimer.current) clearTimeout(tapTimer.current);
            tapTimer.current = setTimeout(() => {
              tapTimer.current = null;
              onOpenActions?.();
            }, 240);
          }}
          onPointerDown={startPress}
          onPointerUp={cancelPress}
          onPointerLeave={() => {
            cancelPress();
            if (tapTimer.current) {
              clearTimeout(tapTimer.current);
              tapTimer.current = null;
            }
          }}
          onPointerCancel={() => {
            cancelPress();
            if (tapTimer.current) {
              clearTimeout(tapTimer.current);
              tapTimer.current = null;
            }
          }}
          onTouchStart={onBubbleTouchStart}
          onTouchEnd={onBubbleTouchEnd}
          onContextMenu={(e) => e.preventDefault()}
          role="button"
          tabIndex={0}
          aria-label={dt('Open message actions')}
          className={cn(
            'relative max-w-[min(80vw,720px)] cursor-pointer overflow-hidden text-sm leading-snug',
            // Telegram-style merged corners: flat edge stays small; the tail
            // corner appears only on the last message of a run.
            isImage ? 'p-0' : 'px-3.5 py-2',
            isMine
              ? cn(
                  'grad-hero rounded-l-lg rounded-r-lg text-white shadow-md shadow-primary/30',
                  groupStart ? 'rounded-tl-lg rounded-tr-lg' : 'rounded-tl-none rounded-tr-md',
                  groupEnd ? 'rounded-br-md' : 'rounded-br-none rounded-tr-md',
                )
              : cn(
                  'rounded-l-lg rounded-r-lg bg-card text-foreground',
                  groupStart ? 'rounded-tl-lg rounded-tr-lg' : 'rounded-tl-md rounded-tr-none',
                  groupEnd ? 'rounded-bl-md' : 'rounded-bl-none rounded-tl-md',
                ),
          )}
        >
          <ReactionPicker
            open={!!reactingOpen}
            onSelect={(e) => onReactPick?.(e)}
            onClose={() => onReactClose?.()}
          />
          {(m.attachmentMeta as any)?.forwarded && (
            <div
              className={cn(
                'mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide',
                isMine ? 'text-white/70' : 'text-primary',
              )}
            >
              <Forward className="h-3 w-3" /> {t('chat.forwarded')}
            </div>
          )}
          {m.pinnedAt && (
            <div
              className={cn(
                'mb-1 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold',
                isMine ? 'bg-white/15 text-white' : 'bg-primary/15 text-primary',
              )}
            >
              <Pin className="h-3 w-3" /> {t('chat.pinned')}
            </div>
          )}
          {m.replyTo && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onReplyJump?.(m.replyTo?.id ?? '');
              }}
              className={cn(
                'mb-1 block max-w-full rounded-md border-l-2 px-2 py-1 text-left text-[11px] leading-tight transition-colors active:bg-background/20',
                isMine ? 'border-white/70 bg-white/10' : 'border-primary bg-muted/70',
              )}
            >
              <div className="font-bold opacity-80">↳ {m.replyTo.sender?.fullName ?? 'Reply'}</div>
              <div className="truncate opacity-90">
                {m.replyTo.body ??
                  (m.replyTo.attachmentType === 'audio' ? '🎤 Voice' : '📎 Attachment')}
              </div>
            </button>
          )}
          {isImage && m.attachmentUrl && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onImageClick?.(m.attachmentUrl!);
              }}
              className="block"
            >
              <div className="relative aspect-[4/3] w-64 max-w-full bg-black/20">
                {/* unoptimized so chat thumbnails load their direct URL — the
                    ImageViewer already does this, so inline images match the
                    full preview instead of being blocked by remotePatterns. */}
                <Image
                  src={m.attachmentUrl}
                  alt={dt('Attachment')}
                  fill
                  unoptimized
                  sizes="256px"
                  className="object-cover"
                />
              </div>
            </button>
          )}

          {isAudio &&
            m.attachmentUrl &&
            ((m.attachmentMeta as any)?.waveform?.length ? (
              <WaveformPlayer
                src={m.attachmentUrl}
                waveform={((m.attachmentMeta as any).waveform as number[]) ?? []}
                durationSec={Number((m.attachmentMeta as any).duration) || undefined}
                isMine={isMine}
              />
            ) : (
              <div className="flex items-center gap-2">
                <PlayCircle
                  className={cn('h-5 w-5 shrink-0', isMine ? 'text-white' : 'text-primary')}
                  aria-hidden
                />
                <audio
                  src={m.attachmentUrl}
                  controls
                  preload="metadata"
                  className="h-8 max-w-[220px] flex-1"
                />
              </div>
            ))}

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
              <span
                className={cn(
                  'grid h-10 w-10 shrink-0 place-items-center rounded-lg text-white',
                  isMine ? 'bg-white/20' : 'bg-primary',
                )}
              >
                <FileText className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">
                  {humanFileName(m.attachmentUrl)}
                </span>
                <span
                  className={cn(
                    'block text-[11px]',
                    isMine ? 'text-white/70' : 'text-muted-foreground',
                  )}
                >
                  {fileSizeLabel(m.attachmentMeta?.size)}
                </span>
              </span>
              <Download
                className={cn('h-4 w-4 shrink-0', isMine ? 'text-white' : 'text-primary')}
              />
            </a>
          )}

          {isGroup && !isMine && showAvatar && (
            <div
              className={cn(
                'mb-1 text-[11px] font-bold',
                isMine ? 'text-white/80' : 'text-primary',
              )}
            >
              {m.sender.fullName.split(' ')[0]}
            </div>
          )}
          {m.body &&
            (sticker ? (
              <div
                className={cn('sticker-pop px-2 py-0.5 text-6xl leading-none', isImage && 'p-3')}
              >
                {m.body}
              </div>
            ) : (
              <RichBody
                body={m.body}
                isMine={isMine}
                highlight={highlight}
                className={isImage ? 'p-3' : undefined}
              />
            ))}
          {translation &&
            m.body &&
            !sticker &&
            (showTranslation ? (
              <div
                className={cn(
                  'mt-1 rounded-lg px-2 py-1',
                  isImage ? 'mx-3 mb-1' : '',
                  isMine ? 'bg-white/10' : 'bg-muted/60',
                )}
              >
                <div
                  className={cn(
                    'text-[10px] font-bold uppercase tracking-wide',
                    isMine ? 'text-white/70' : 'text-muted-foreground',
                  )}
                >
                  {t('chat.translated')}
                </div>
                <div className="text-[13px] leading-snug">{translation}</div>
                <button
                  onClick={() => setShowTranslation(false)}
                  className={cn(
                    'mt-0.5 text-[10px] font-semibold underline-offset-2 hover:underline',
                    isMine ? 'text-white/70' : 'text-muted-foreground',
                  )}
                >
                  {t('chat.showOriginal')}
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowTranslation(true)}
                className={cn(
                  'mt-1 text-[10px] font-semibold underline-offset-2 hover:underline',
                  isMine ? 'text-white/70' : 'text-muted-foreground',
                )}
              >
                {t('chat.translated')}
              </button>
            ))}
          {(() => {
            const u = m.body ? firstUrlIn(m.body) : null;
            return u ? <LinkPreview url={u} isMine={isMine} /> : null;
          })()}

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
            {timerSec > 0 && (
              <span
                className={cn(
                  'inline-flex items-center gap-0.5',
                  isMine ? 'text-white' : 'text-primary',
                )}
              >
                <TimerIcon className="h-3 w-3" />
                {formatDuration(remainingSec)}
              </span>
            )}
            {isMine && (m.readBy ?? 0) > 0 ? (
              <button
                onClick={() => onReadTap?.(m)}
                className="inline-flex cursor-pointer items-center text-white active:scale-90"
                aria-label={t('chat.readReceipts')}
                title={t('chat.readReceipts')}
              >
                <CheckCheck className="h-3.5 w-3.5" />
              </button>
            ) : isMine ? (
              <Check className="h-3.5 w-3.5" />
            ) : null}
            {isMine && (m.readBy ?? 0) > 0 && (m.readByTotal ?? 0) > 1 ? (
              <span className="opacity-80">
                {m.readBy}/{m.readByTotal}
              </span>
            ) : null}
          </div>
          {isMine && seenMembers.length > 0 && (
            <button
              onClick={() => onReadTap?.(m)}
              className={cn(
                'mt-1.5 flex items-center gap-1',
                isMine ? 'justify-end' : 'justify-start',
              )}
              aria-label={t('chat.readReceipts')}
            >
              {seenCut.map((mm, idx) => (
                <span
                  key={mm.userId}
                  title={mm.fullName}
                  className={cn(
                    '-ml-1 grid h-5 w-5 place-items-center rounded-full border text-[8px] font-bold text-white',
                    gradientFor(mm.userId),
                    idx === 0 && 'ml-0',
                  )}
                >
                  {initialsOf(mm.fullName)}
                </span>
              ))}
              {seenExtra > 0 && (
                <span
                  title={seenMembers.map((s) => s.fullName).join(', ')}
                  className="grid h-5 w-5 place-items-center rounded-full border border-border bg-card text-[9px] font-bold text-muted-foreground"
                >
                  +{seenExtra}
                </span>
              )}
              <Eye className="ml-0.5 h-3 w-3 opacity-60" />
            </button>
          )}
          {m.attachmentMeta?.transcript && (
            <div
              className={cn(
                'mt-1 border-t px-1 pt-1 text-[11px] italic',
                isMine ? 'border-white/20 text-white/70' : 'border-border text-muted-foreground',
              )}
            >
              &ldquo;{m.attachmentMeta.transcript}&rdquo;
            </div>
          )}
        </div>
        {m.reactions && m.reactions.length > 0 && (
          <div
            className={cn('mt-1 flex flex-wrap gap-1', isMine ? 'justify-end' : 'justify-start')}
          >
            {m.reactions.map((r) => (
              <button
                key={r.emoji}
                onClick={(e) => {
                  e.stopPropagation();
                  onReactionInfo?.(m, r.emoji);
                }}
                className={cn(
                  'inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[11px] transition-transform active:scale-90',
                  r.mine
                    ? 'border-primary/40 bg-primary/15 text-primary'
                    : 'border-border bg-card text-muted-foreground',
                )}
              >
                <span>{r.emoji}</span>
                <span className="font-bold">{r.count}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      {isMine && (
        <div className={cn('w-8 shrink-0', showAvatar ? '' : 'invisible')}>
          {showAvatar && (
            <UserAvatar
              name={m.sender.fullName}
              avatarUrl={m.sender.avatarUrl}
              id={m.sender.id}
              verified={m.sender.isVerified}
              className="h-8 w-8 text-[11px] font-bold"
            />
          )}
        </div>
      )}
    </div>
  );
}

/** A labeled row in the message actions sheet. */
/** A labeled row inside the composer "+" tools panel. */
function PanelRow({
  icon,
  label,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium active:bg-muted"
    >
      <span className="grid h-8 w-8 place-items-center rounded-full bg-primary/10 text-primary">
        {icon}
      </span>
      <span>{label}</span>
    </button>
  );
}

function ActionRow({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium active:bg-muted',
        danger && 'text-red-500',
      )}
    >
      <span
        className={cn(
          'grid h-8 w-8 place-items-center rounded-full',
          danger ? 'bg-red-500/10 text-red-500' : 'bg-primary/10 text-primary',
        )}
      >
        {icon}
      </span>
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
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n >= 10 || i === 0 ? Math.round(n) : n.toFixed(1)} ${units[i]}`;
}

/** Compact duration label for self-destruct countdowns (e.g. 1h 02m, 45s). */
function formatDuration(sec: number): string {
  if (sec <= 0) return '0s';
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`;
  return `${s}s`;
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
