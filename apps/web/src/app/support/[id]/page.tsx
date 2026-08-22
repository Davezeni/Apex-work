'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Send, Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useMe } from '@/hooks/use-me';
import { useTicket, useReplyTicket, useSetTicketStatus } from '@/hooks/use-support';
import { cn, timeAgo } from '@/lib/utils';

export default function TicketPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: me } = useMe();
  const { data: t, isLoading } = useTicket(id);
  const reply = useReplyTicket(id);
  const setStatus = useSetTicketStatus(id);
  const [text, setText] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [t?.messages?.length]);

  if (isLoading || !t) return <div className="grid min-h-dvh place-items-center bg-background"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

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
        <button onClick={() => router.back()} aria-label="Back" className="grid h-9 w-9 place-items-center rounded-full active:scale-90">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold">{t.subject}</div>
          <div className="text-[10px] text-muted-foreground">{t.category} · {t.status.replace('_', ' ')}</div>
        </div>
        {!closed && (
          <Button size="sm" variant="outline" onClick={() => setStatus.mutate('RESOLVED')} disabled={setStatus.isPending}>
            <CheckCircle2 className="h-4 w-4" /> Resolve
          </Button>
        )}
      </header>

      <div ref={listRef} className="flex-1 space-y-2 overflow-y-auto px-3 py-4">
        {(t.messages ?? []).map((m) => {
          const isMine = m.senderId === me?.id;
          return (
            <div key={m.id} className={cn('flex', isMine ? 'justify-end' : 'justify-start')}>
              <div className={cn(
                'max-w-[80%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm',
                m.isStaff ? 'bg-emerald-500/15 text-foreground border border-emerald-500/30' :
                isMine ? 'grad-hero rounded-br-md text-white' : 'rounded-bl-md bg-card',
              )}>
                {m.isStaff && (
                  <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-emerald-500">STAFF</div>
                )}
                {m.body}
                <div className={cn('mt-1 text-[10px]', isMine ? 'text-white/70' : 'text-muted-foreground')}>
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
              value={text} onChange={(e) => setText(e.target.value)} rows={1}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }}
              placeholder="Reply…"
              className="flex-1 resize-none rounded-2xl border border-border bg-card px-4 py-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/20"
              style={{ maxHeight: '120px' }}
            />
            <button onClick={send} disabled={!text.trim() || reply.isPending}
              className="grad-hero grid h-11 w-11 shrink-0 place-items-center rounded-full text-white disabled:opacity-40 active:scale-90"
              aria-label="Send">
              {reply.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
