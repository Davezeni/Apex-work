'use client';

import { dt } from '@/i18n/auto';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Loader2, LifeBuoy, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useMe } from '@/hooks/use-me';
import { useMyTickets, useCreateTicket, type SupportTicket } from '@/hooks/use-support';
import { cn, timeAgo } from '@/lib/utils';
export default function SupportPage() {
  const router = useRouter();
  const { data: me, isLoading: meLoading, isAuthed } = useMe();
  const { data, isLoading } = useMyTickets();
  const create = useCreateTicket();

  const [opening, setOpening] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState<'billing' | 'dispute' | 'tech' | 'general'>('general');

  useEffect(() => {
    if (!meLoading && !isAuthed) router.replace('/login?next=/support');
  }, [meLoading, isAuthed, router]);

  if (isLoading || !me)
    return (
      <div className="grid min-h-dvh place-items-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );

  const submit = async () => {
    if (subject.trim().length < 4) return toast.error(dt('Add a short subject'));
    if (body.trim().length < 10) return toast.error(dt('Describe the problem'));
    try {
      const t = await create.mutateAsync({ subject: subject.trim(), category, body: body.trim() });
      setOpening(false);
      setSubject('');
      setBody('');
      setCategory('general');
      router.push(`/support/${t.id}`);
    } catch (err) {
      toast.error((err as { message?: string }).message ?? 'Could not open ticket');
    }
  };

  const items = data?.items ?? [];

  return (
    <div className="min-h-dvh bg-background pb-24">
      <header className="safe-top sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 px-3 py-3 backdrop-blur-xl">
        <button
          onClick={() => router.back()}
          aria-label={dt('Back')}
          className="grid h-9 w-9 place-items-center rounded-full active:scale-90"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-extrabold tracking-tight">{dt('Support')}</h1>
        <Button size="sm" variant="brand" className="ml-auto" onClick={() => setOpening(true)}>
          <Plus className="h-4 w-4" /> New
        </Button>
      </header>

      {opening && (
        <section className="mx-3 mt-4 rounded-2xl border border-primary/30 bg-primary/5 p-4">
          <div className="text-sm font-bold">{dt('Open a ticket')}</div>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            maxLength={140}
            placeholder={dt('Subject')}
            className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <div className="mt-2 flex flex-wrap gap-1">
            {(['general', 'billing', 'dispute', 'tech'] as const).map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={cn(
                  'rounded-full px-2.5 py-1 text-[11px] font-bold capitalize',
                  category === c
                    ? 'bg-primary text-white'
                    : 'border border-border bg-card text-muted-foreground',
                )}
              >
                {c}
              </button>
            ))}
          </div>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            maxLength={4000}
            placeholder={dt('Describe the issue…')}
            className="mt-2 w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <div className="mt-2 flex gap-2">
            <Button
              variant="outline"
              size="default"
              className="flex-1"
              onClick={() => setOpening(false)}
            >
              {dt('Cancel')}
            </Button>
            <Button
              variant="brand"
              size="default"
              className="flex-1"
              onClick={submit}
              disabled={create.isPending}
            >
              {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Open ticket'}
            </Button>
          </div>
        </section>
      )}

      {items.length === 0 && !opening && (
        <div className="mx-4 mt-8 rounded-2xl border border-dashed border-border p-8 text-center">
          <LifeBuoy className="mx-auto h-8 w-8 text-primary" />
          <p className="mt-3 text-sm font-semibold">{dt('No tickets yet')}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Open one for anything the AI assistant can&rsquo;t resolve.
          </p>
        </div>
      )}

      <div className="mx-3 mt-4 space-y-2">
        {items.map((t) => (
          <TicketRow key={t.id} t={t} />
        ))}
      </div>
    </div>
  );
}

function TicketRow({ t }: { t: SupportTicket }) {
  const meta =
    t.status === 'RESOLVED' || t.status === 'CLOSED'
      ? 'bg-emerald-500/10 text-emerald-500'
      : t.status === 'WAITING_STAFF'
        ? 'bg-amber-500/10 text-amber-500'
        : t.status === 'WAITING_USER'
          ? 'bg-primary/10 text-primary'
          : 'bg-muted text-muted-foreground';
  return (
    <Link
      href={`/support/${t.id}`}
      className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3"
    >
      <div className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 text-primary">
        <MessageCircle className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-bold">{t.subject}</div>
        <div className="text-[11px] text-muted-foreground">
          {t.category} · updated {timeAgo(t.updatedAt)}
        </div>
      </div>
      <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold', meta)}>
        {t.status.replace('_', ' ')}
      </span>
    </Link>
  );
}
