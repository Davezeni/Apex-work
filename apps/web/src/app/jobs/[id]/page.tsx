'use client';

import { dt } from '@/i18n/auto';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, MapPin, Send, CheckCircle2, Lock, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useJob, useCreateBid, useAcceptBid, useCloseJob } from '@/hooks/use-jobs';
import { useMe } from '@/hooks/use-me';
import { useStartConversation } from '@/hooks/use-chat';
import { useI18n } from '@/i18n';
import { formatEtb, timeAgo, cn } from '@/lib/utils';
import { Sheet } from '@/components/ui/sheet';
import { RichViewer } from '@/components/ui/rich-viewer';
export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { t } = useI18n();
  const { data: me } = useMe();
  const { data: job, isLoading, error } = useJob(id);
  const bid = useCreateBid(id);
  const accept = useAcceptBid(id);
  const close = useCloseJob();
  const startConv = useStartConversation();

  const [bidOpen, setBidOpen] = useState(false);
  const [msg, setMsg] = useState('');
  const [price, setPrice] = useState('');
  const [days, setDays] = useState('7');

  if (isLoading || !job) {
    return (
      <div className="grid min-h-dvh place-items-center bg-background">
        {error ? (
          <p className="text-sm text-destructive">{dt('Job not found')}</p>
        ) : (
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        )}
      </div>
    );
  }

  const isOwner = me?.id === job.client.id;
  const isFreelancer = me?.role === 'FREELANCER';
  const myBid = job.bids.find((b) => b.freelancer.id === me?.id);

  const submitBid = async () => {
    if (msg.trim().length < 20) return toast.error(t('jobs.messagePlaceholder'));
    const p = Number(price);
    const d = Number(days);
    if (!p || p < 100) return toast.error(dt('Enter a valid price'));
    if (!d || d < 1 || d > 90) return toast.error(dt('Delivery days 1–90'));
    try {
      await bid.mutateAsync({
        message: msg.trim(),
        priceEtb: Math.floor(p),
        deliveryDays: Math.floor(d),
      });
      toast.success(t('jobs.bidSent'));
      setBidOpen(false);
    } catch (err) {
      const e = err as { message?: string };
      toast.error(e.message ?? t('jobs.bidFailed'));
    }
  };

  const acceptBid = async (bidId: string) => {
    if (!me) {
      router.push(`/login?next=${encodeURIComponent(`/jobs/${id}`)}`);
      return;
    }
    if (!me.phone || !me.isPhoneVerified) {
      router.push(`/settings/phone?next=${encodeURIComponent(`/jobs/${id}`)}`);
      return;
    }
    try {
      const res = await accept.mutateAsync(bidId);
      toast.success(t('jobs.accepted'));
      if (res.checkoutUrl) {
        window.location.href = res.checkoutUrl;
      } else {
        router.push(`/orders/${res.order.id}`);
      }
    } catch (err) {
      const e = err as { message?: string };
      toast.error(e.message ?? t('jobs.acceptFailed'));
    }
  };

  const budget =
    job.budgetMinEtb != null && job.budgetMaxEtb != null
      ? t('jobs.budgetRange', {
          min: formatEtb(job.budgetMinEtb),
          max: formatEtb(job.budgetMaxEtb),
        })
      : job.budgetMinEtb != null
        ? `≥ ${formatEtb(job.budgetMinEtb)}`
        : job.budgetMaxEtb != null
          ? `≤ ${formatEtb(job.budgetMaxEtb)}`
          : t('jobs.budgetOpen');

  return (
    <div className="min-h-dvh bg-background pb-32">
      <header className="safe-top sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 px-3 py-3 backdrop-blur-xl">
        <button
          onClick={() => router.back()}
          aria-label={t('common.back')}
          className="grid h-9 w-9 place-items-center rounded-full active:scale-90"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="truncate text-sm font-bold">{t('jobs.title')}</h1>
      </header>

      <div className="mx-4 mt-4">
        {!job.isOpen && (
          <div className="mb-3 flex items-center gap-2 rounded-xl bg-muted p-3 text-xs font-semibold text-muted-foreground">
            <Lock className="h-4 w-4" /> {t('jobs.closedByClient')}
          </div>
        )}

        <h2 className="text-2xl font-extrabold leading-tight tracking-tight">{job.title}</h2>

        {/* Client */}
        <Link href={`/u/${job.client.username}`} className="mt-3 inline-flex items-center gap-2">
          {job.client.avatarUrl ? (
            <Image
              src={job.client.avatarUrl}
              alt={job.client.fullName}
              width={32}
              height={32}
              unoptimized
              className="h-8 w-8 rounded-full object-cover"
            />
          ) : (
            <div className="grad-hero grid h-8 w-8 place-items-center rounded-full text-[11px] font-bold text-white">
              {(job.client.fullName[0] ?? '?').toUpperCase()}
            </div>
          )}
          <div className="text-xs">
            <div className="font-semibold">{job.client.fullName}</div>
            <div className="text-[10px] text-muted-foreground">
              {t('jobs.posted', { when: timeAgo(job.createdAt) })}
            </div>
          </div>
        </Link>

        {/* Meta */}
        <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-xl border border-border bg-card p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {t('jobs.budget')}
            </div>
            <div className="mt-1 font-extrabold text-primary">{budget}</div>
          </div>
          <div className="rounded-xl border border-border bg-card p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {t('jobs.bids', { n: job.bidCount })}
            </div>
            <div className="mt-1 inline-flex items-center gap-1 font-extrabold">
              {job.isRemote && (
                <>
                  <MapPin className="h-3 w-3" /> {t('jobs.remote')}
                </>
              )}
            </div>
          </div>
        </div>

        {job.requiredSkills.length > 0 && (
          <>
            <h3 className="mt-6 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {t('jobs.skills')}
            </h3>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {job.requiredSkills.map((s) => (
                <span
                  key={s}
                  className="rounded-full border border-border bg-card px-3 py-1 text-xs font-medium"
                >
                  {s}
                </span>
              ))}
            </div>
          </>
        )}

        <h3 className="mt-6 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {t('jobs.description')}
        </h3>
        <RichViewer html={job.description} className="mt-2 text-sm" />

        {'attachments' in job &&
          Array.isArray((job as { attachments?: unknown }).attachments) &&
          (
            job as {
              attachments: { url: string; name: string; sizeBytes: number; contentType: string }[];
            }
          ).attachments.length > 0 && (
            <>
              <h3 className="mt-6 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Attachments
              </h3>
              <div className="mt-2 space-y-1.5">
                {(
                  job as {
                    attachments: {
                      url: string;
                      name: string;
                      sizeBytes: number;
                      contentType: string;
                    }[];
                  }
                ).attachments.map((a, i) => (
                  <a
                    key={i}
                    href={a.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm active:bg-muted"
                  >
                    <span className="text-lg">
                      {a.contentType.startsWith('image/')
                        ? '🖼'
                        : a.contentType.includes('pdf')
                          ? '📄'
                          : '📎'}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{a.name}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {(a.sizeBytes / 1024).toFixed(0)} KB
                    </span>
                  </a>
                ))}
              </div>
            </>
          )}

        {/* Bids */}
        {isOwner && job.bids.length > 0 && (
          <>
            <h3 className="mt-8 text-sm font-bold">{t('jobs.bids', { n: job.bids.length })}</h3>
            <div className="mt-2 space-y-2">
              {job.bids.map((b) => (
                <div key={b.id} className="rounded-2xl border border-border bg-card p-4">
                  <div className="flex items-start gap-3">
                    {b.freelancer.avatarUrl ? (
                      <Image
                        src={b.freelancer.avatarUrl}
                        alt={b.freelancer.fullName}
                        width={40}
                        height={40}
                        unoptimized
                        className="h-10 w-10 shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <div className="grad-hero grid h-10 w-10 shrink-0 place-items-center rounded-full text-xs font-bold text-white">
                        {(b.freelancer.fullName[0] ?? '?').toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/u/${b.freelancer.username}`}
                        className="line-clamp-1 text-sm font-semibold"
                      >
                        {b.freelancer.fullName}
                      </Link>
                      <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        {b.freelancer.title ?? 'Freelancer'}
                        {b.freelancer.ratingCount > 0 && (
                          <span className="inline-flex items-center gap-0.5">
                            · <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                            {b.freelancer.rating.toFixed(1)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-extrabold text-primary">
                        {formatEtb(b.priceEtb)}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {b.deliveryDays}d · {timeAgo(b.createdAt)}
                      </div>
                    </div>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-xs leading-relaxed">{b.message}</p>
                  {job.isOpen && (
                    <div className="mt-3 flex gap-2">
                      <Button
                        variant="brand"
                        size="sm"
                        className="flex-1"
                        onClick={() => acceptBid(b.id)}
                        disabled={accept.isPending}
                      >
                        {accept.isPending ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          t('jobs.acceptBid')
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          startConv.mutate(b.freelancer.id, {
                            onSuccess: (c) => router.push(`/messages/${c.id}`),
                          })
                        }
                      >
                        <Send className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {/* Your existing bid */}
        {myBid && !isOwner && (
          <div className="mt-8 rounded-2xl border-2 border-primary/40 bg-primary/5 p-4">
            <div className="flex items-center gap-1.5 text-sm font-bold text-primary">
              <CheckCircle2 className="h-4 w-4" /> {t('jobs.yourBid')}
            </div>
            <div className="mt-2 flex items-baseline gap-3 text-xs">
              <span className="text-lg font-extrabold text-foreground">
                {formatEtb(myBid.priceEtb)}
              </span>
              <span className="text-muted-foreground">
                · {myBid.deliveryDays} {t('jobs.days')}
              </span>
            </div>
            <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-xs text-muted-foreground">
              {myBid.message}
            </p>
          </div>
        )}
      </div>

      {/* Sticky action */}
      {isOwner && job.isOpen ? (
        <div className="safe-bottom fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 px-4 pb-4 pt-3 backdrop-blur-xl">
          <Button
            variant="outline"
            size="lg"
            className="w-full"
            onClick={() => {
              if (!window.confirm(t('jobs.close') + '?')) return;
              close.mutate(job.id, { onSuccess: () => toast.success(t('jobs.closed2')) });
            }}
            disabled={close.isPending}
          >
            {t('jobs.close')}
          </Button>
        </div>
      ) : !isOwner && job.isOpen && isFreelancer ? (
        <div className="safe-bottom fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 px-4 pb-4 pt-3 backdrop-blur-xl">
          <Button
            variant="brand"
            size="lg"
            className="w-full"
            onClick={() => {
              setPrice(String(job.budgetMinEtb ?? job.budgetMaxEtb ?? 1000));
              setBidOpen(true);
            }}
          >
            <Send className="h-4 w-4" /> {myBid ? t('jobs.yourBid') : t('jobs.sendBid')}
          </Button>
        </div>
      ) : !me?.id ? (
        <div className="safe-bottom fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 px-4 pb-4 pt-3 backdrop-blur-xl">
          <Button asChild variant="brand" size="lg" className="w-full">
            <Link href={`/login?next=/jobs/${job.id}`}>{t('jobs.signInToBid')}</Link>
          </Button>
        </div>
      ) : null}

      <Sheet
        open={bidOpen}
        onOpenChange={setBidOpen}
        title={t('jobs.sendBid')}
        description={job.title}
      >
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t('jobs.message')}
            </label>
            <textarea
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
              rows={5}
              maxLength={3000}
              placeholder={t('jobs.messagePlaceholder')}
              className="w-full resize-none rounded-xl border border-border bg-card p-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/20"
            />
            <p className="mt-1 text-right text-[11px] text-muted-foreground">{msg.length}/3000</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t('jobs.price')}
              </label>
              <input
                value={price}
                onChange={(e) => setPrice(e.target.value.replace(/[^0-9]/g, ''))}
                inputMode="numeric"
                className="w-full rounded-xl border border-border bg-card px-3 py-3 text-sm font-semibold outline-none focus:border-primary focus:ring-4 focus:ring-primary/20"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t('jobs.days')}
              </label>
              <input
                value={days}
                onChange={(e) => setDays(e.target.value.replace(/[^0-9]/g, ''))}
                inputMode="numeric"
                className="w-full rounded-xl border border-border bg-card px-3 py-3 text-sm font-semibold outline-none focus:border-primary focus:ring-4 focus:ring-primary/20"
              />
            </div>
          </div>
          <Button
            variant="brand"
            size="lg"
            className="w-full"
            onClick={submitBid}
            disabled={bid.isPending || msg.trim().length < 20}
          >
            {bid.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t('jobs.submitBid')}
          </Button>
        </div>
      </Sheet>
    </div>
  );
}
