'use client';

import { dt } from '@/i18n/auto';
import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Send, Loader2, CheckCircle2, Star, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useMe } from '@/hooks/use-me';
import { useTicket, useReplyTicket, useSetTicketStatus, useSubmitCsat } from '@/hooks/use-support';
import { cn, timeAgo } from '@/lib/utils';
import { safeBack } from '@/lib/safe-back';
export default function TicketPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: me } = useMe();
  const { data: t, isLoading } = useTicket(id);
  const reply = useReplyTicket(id);
  const setStatus = useSetTicketStatus(id);
  const submitCsat = useSubmitCsat(id);
  const [text, setText] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [t?.messages?.length]);

  if (isLoading || !t)
    return (
      <div className="grid min-h-dvh place-items-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );

  const send = async () => {
    const body = text.trim();
    if (!body) return;
    setText('');
    try {
      await reply.mutateAsync({ body });
    } catch (err) {
      setText(body);
      toast.error((err as { message?: string }).message ?? 'Send failed');
    }
  };

  const closed = t.status === 'CLOSED' || t.status === 'RESOLVED';

  return (
    <div className="flex h-dvh flex-col bg-background">
      <header className="safe-top sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-background/95 px-3 py-3 backdrop-blur-xl">
        <button
          onClick={() => safeBack(router)}
          aria-label={dt('Back')}
          className="grid h-9 w-9 place-items-center rounded-full active:scale-90"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold">{t.subject}</div>
          <div className="text-[10px] text-muted-foreground">
            {t.category} · {t.status.replace('_', ' ')}
          </div>
        </div>
        {!closed && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setStatus.mutate('RESOLVED')}
            disabled={setStatus.isPending}
          >
            <CheckCircle2 className="h-4 w-4" /> Resolve
          </Button>
        )}
      </header>

      {closed && t.csatRating === null && (
        <CsatPrompt
          onRate={(rating, comment) => submitCsat.mutate({ rating, comment })}
          pending={submitCsat.isPending}
        />
      )}

      <div ref={listRef} className="flex-1 space-y-2 overflow-y-auto px-3 py-4">
        {(t.messages ?? []).map((m) => {
          const isMine = m.senderId === me?.id;
          return (
            <div key={m.id} className={cn('flex', isMine ? 'justify-end' : 'justify-start')}>
              <div
                className={cn(
                  'max-w-[80%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm',
                  m.isStaff
                    ? 'border border-emerald-500/30 bg-emerald-500/15 text-foreground'
                    : isMine
                      ? 'grad-hero rounded-br-md text-white'
                      : 'rounded-bl-md bg-card',
                )}
              >
                {m.isStaff && (
                  <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-emerald-500">
                    {dt('STAFF')}
                  </div>
                )}
                {m.body}
                <div
                  className={cn(
                    'mt-1 text-[10px]',
                    isMine ? 'text-white/70' : 'text-muted-foreground',
                  )}
                >
                  {timeAgo(m.createdAt)}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {!closed && (
        <div className="safe-bottom sticky bottom-0 border-t border-border bg-background/95 px-2 py-2 backdrop-blur-xl">
          <div className="mx-auto flex max-w-md items-end gap-2">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={1}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              placeholder={dt('Reply…')}
              className="flex-1 resize-none rounded-2xl border border-border bg-card px-4 py-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/20"
              style={{ maxHeight: '120px' }}
            />
            <button
              onClick={send}
              disabled={!text.trim() || reply.isPending}
              className="grad-hero grid h-11 w-11 shrink-0 place-items-center rounded-full text-white active:scale-90 disabled:opacity-40"
              aria-label={dt('Send')}
            >
              {reply.isPending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** One-time satisfaction prompt shown when a ticket is resolved/closed and
 *  the user hasn't rated it yet. Un-rating closes the card for the session. */
function CsatPrompt({
  onRate,
  pending,
}: {
  onRate: (rating: number, comment?: string) => void;
  pending: boolean;
}) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="mx-3 mt-3 rounded-2xl border border-border bg-card p-4">
      <button
        onClick={() => setDismissed(true)}
        aria-label={dt('Close')}
        className="float-right grid h-7 w-7 place-items-center rounded-full text-muted-foreground hover:bg-muted"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="text-sm font-bold">{dt('How was our support?')}</div>
      <div className="mt-1 text-xs text-muted-foreground">
        {dt('Your feedback helps us improve. It only takes a moment.')}
      </div>
      <div className="mt-3 flex gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            onClick={() => setRating(n)}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            aria-label={`${n} star${n > 1 ? 's' : ''}`}
            className="active:scale-90"
          >
            <Star
              className={cn(
                'h-8 w-8 transition-colors',
                n <= (hover || rating)
                  ? 'fill-amber-400 text-amber-400'
                  : 'text-muted-foreground/30',
              )}
            />
          </button>
        ))}
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        maxLength={2000}
        rows={2}
        placeholder={dt('Anything we could do better? (optional)')}
        className="mt-3 w-full resize-none rounded-xl border border-border bg-background p-3 text-xs outline-none focus:border-primary"
      />
      <Button
        size="sm"
        disabled={rating === 0 || pending}
        onClick={() => onRate(rating, comment.trim() || undefined)}
        className="mt-2 w-full"
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          `Submit ${rating ? `${rating}★` : ''}`
        )}
      </Button>
    </div>
  );
}
