'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Send, Loader2, Phone, PhoneIncoming, Video as VideoIcon, FileText, PlayCircle, Mic, MoreVertical, Flag, ShieldOff, Package, SmilePlus, Reply, X, Images, Pencil, Trash2, Users, UserPlus, Check, CheckCheck, LogOut } from 'lucide-react';
import { CallPanel } from '@/components/chat/call-panel';
import { cn, timeAgo } from '@/lib/utils';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import { useMessages, useSendMessage, useChatSocket, useConversation, useAddGroupMembers, useLeaveGroup, useUpdateGroup, useEditMessage, useDeleteMessage, type ChatMessage } from '@/hooks/use-chat';
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

export default function ConversationPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: me } = useMe();
  const token = useAuthStore((s) => s.accessToken);
  const { data, isLoading, error } = useMessages(id);
  const { data: conv } = useConversation(id);
  const send = useSendMessage(id);
  const addMembers = useAddGroupMembers(id);
  const leaveGroup = useLeaveGroup();
  const renameGroup = useUpdateGroup(id);
  const editMessage = useEditMessage(id);
  const deleteMessage = useDeleteMessage(id);
  const [typingUsers, setTypingUsers] = useState<Record<string, number>>({});
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
  });
  const { t } = useI18n();
  const draft = useMessageDraft(id);
  const text = draft.text;
  const setText = draft.setText;
  const [composerMode, setComposerMode] = useState<'text' | 'voice'>('text');
  const [offerSheetOpen, setOfferSheetOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [reactingId, setReactingId] = useState<string | null>(null);
  const [membersOpen, setMembersOpen] = useState(false);
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
            {conv?.isGroup ? conv.title : peer?.fullName ?? 'Conversation'}
          </h4>
          {conv?.isGroup ? (
            <p className="text-[11px] text-muted-foreground">{conv.members.length} members{activeTypers > 0 ? ` · ${activeTypers} typing…` : ''}</p>
          ) : peer ? (
            <p className="text-[11px] text-muted-foreground">@{peer.username}</p>
          ) : null}
        </div>
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
                    {conv.me?.isAdmin && (
                      <button
                        onClick={() => {
                          setMenuOpen(false);
                          const name = window.prompt('Group name', conv.title ?? '');
                          if (name && name.trim()) renameGroup.mutate({ title: name.trim() });
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2.5 text-sm active:bg-muted"
                      >
                        <Pencil className="h-4 w-4" /> Rename group
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        if (!window.confirm('Leave this group?')) return;
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
            isGroup={!!conv?.isGroup}
            showAvatar={
              m.senderId !== me?.id &&
              (i === 0 || messages[i - 1]?.senderId !== m.senderId)
            }
            onImageClick={setViewerUrl}
            onReply={() => setReplyTo(m)}
            onReactOpen={() => setReactingId(m.id)}
            reactingOpen={reactingId === m.id}
            onReactPick={(emoji) => toggleReaction.mutate({ messageId: m.id, emoji })}
            onReactionTap={(emoji) => toggleReaction.mutate({ messageId: m.id, emoji: emoji as ReactionEmoji })}
            onReactClose={() => setReactingId(null)}
            onEdit={(body) => editMessage.mutate({ messageId: m.id, body })}
            onDelete={() => deleteMessage.mutate(m.id)}
          />
        ))}

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
      <ImageViewer open={!!viewerUrl} onOpenChange={(v) => !v && setViewerUrl(null)} url={viewerUrl} />

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
              <h2 className="text-lg font-extrabold">Members</h2>
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
                  if (found.length === 0) { toast.error('No matching users found'); return; }
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
                      </div>
                      <div className="text-[11px] text-muted-foreground">@{m.username}{typing ? ' · typing…' : ''}</div>
                    </div>
                  </div>
                );
              })}
            </div>
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
  onReply,
  onReactOpen,
  reactingOpen,
  onReactPick,
  onReactionTap,
  onReactClose,
  onEdit,
  onDelete,
}: {
  m: ChatMessage;
  isMine: boolean;
  isGroup?: boolean;
  showAvatar: boolean;
  onImageClick?: (url: string) => void;
  onReply?: () => void;
  onReactOpen?: () => void;
  reactingOpen?: boolean;
  onReactPick?: (e: ReactionEmoji) => void;
  onReactionTap?: (emoji: string) => void;
  onReactClose?: () => void;
  onEdit?: (body: string) => void;
  onDelete?: () => void;
}) {
  const isImage = m.attachmentType === 'image';
  const isAudio = m.attachmentType === 'audio';
  const isFile = m.attachmentType === 'file' || m.attachmentType === 'video';
  const hasAttachment = !!m.attachmentUrl;
  const offerMatch = m.attachmentUrl?.match(/^apex:\/\/offer\/([a-zA-Z0-9_-]+)$/);

  // Long-press to open the reaction picker on mobile.
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startPress = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = setTimeout(() => onReactOpen?.(), 400);
  };
  const cancelPress = () => {
    if (pressTimer.current) { clearTimeout(pressTimer.current); pressTimer.current = null; }
  };

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
      <div className={cn('group relative flex items-end gap-1', isMine ? 'flex-row-reverse' : '')}>
        {/* Hover / focus quick actions — react + reply */}
        <div className={cn('flex flex-col gap-1 opacity-0 transition-opacity group-hover:opacity-100', isMine && 'items-end')}>
          <button
            onClick={onReactOpen}
            aria-label="React"
            className="grid h-7 w-7 place-items-center rounded-full border border-border bg-card text-muted-foreground hover:text-foreground active:scale-90"
          >
            <SmilePlus className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onReply}
            aria-label="Reply"
            className="grid h-7 w-7 place-items-center rounded-full border border-border bg-card text-muted-foreground hover:text-foreground active:scale-90"
          >
            <Reply className="h-3.5 w-3.5" />
          </button>
          {isMine && (
            <>
              <button
                onClick={() => {
                  const next = window.prompt('Edit message', m.body ?? '');
                  if (next !== null && next.trim() && next !== m.body) onEdit?.(next.trim());
                }}
                aria-label="Edit"
                className="grid h-7 w-7 place-items-center rounded-full border border-border bg-card text-muted-foreground hover:text-foreground active:scale-90"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => {
                  if (window.confirm('Delete this message?')) onDelete?.();
                }}
                aria-label="Delete"
                className="grid h-7 w-7 place-items-center rounded-full border border-border bg-card text-red-500 hover:text-red-600 active:scale-90"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
      <div
        onTouchStart={startPress}
        onTouchEnd={cancelPress}
        onTouchMove={cancelPress}
        className={cn(
          'relative max-w-[80%] overflow-hidden rounded-2xl text-sm leading-snug',
          // Image bubbles are edge-to-edge; text/file bubbles keep padding.
          isImage ? 'p-0' : 'px-3.5 py-2',
          isMine
            ? 'grad-hero rounded-br-md text-white shadow-md shadow-primary/30'
            : 'rounded-bl-md bg-card text-foreground',
        )}
      >
        <ReactionPicker open={!!reactingOpen} onSelect={(e) => onReactPick?.(e)} onClose={() => onReactClose?.()} />
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
            onClick={() => onImageClick?.(m.attachmentUrl!)}
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
            className={cn(
              'flex items-center gap-2 text-sm font-semibold',
              isMine ? 'text-white' : 'text-primary',
            )}
          >
            <FileText className="h-5 w-5" />
            <span className="truncate">{humanFileName(m.attachmentUrl)}</span>
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
              onClick={() => onReactionTap?.(r.emoji)}
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
