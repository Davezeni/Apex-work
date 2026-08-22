'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { toast } from 'sonner';
import { useSimilarGigs } from '@/hooks/use-similar';
import { RichViewer } from '@/components/ui/rich-viewer';
import {
  ArrowLeft,
  Share2,
  Heart,
  Star,
  MapPin,
  CheckCircle2,
  Clock,
  Repeat,
  MessageCircle,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useGig } from '@/hooks/use-gigs';
import { useMe } from '@/hooks/use-me';
import { useStartConversation } from '@/hooks/use-chat';
import { useCreateOrder } from '@/hooks/use-orders';
import { cn, formatEtb } from '@/lib/utils';
import { useI18n } from '@/i18n';

const AVATAR_GRADIENTS = [
  'from-violet-500 to-emerald-500',
  'from-amber-500 to-red-500',
  'from-cyan-500 to-violet-500',
  'from-emerald-500 to-amber-500',
  'from-red-500 to-violet-500',
];
function gradientFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length]!;
}
function initialsOf(name: string): string {
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?';
}

type Tier = 'BASIC' | 'STANDARD' | 'PREMIUM';

export default function GigDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const { data: gig, isLoading, error } = useGig(slug);
  const { data: me } = useMe();
  const startConversation = useStartConversation();
  const createOrder = useCreateOrder();
  const { t } = useI18n();
  const [tier, setTier] = useState<Tier>('BASIC');

  if (isLoading) {
    return (
      <div className="min-h-dvh grid place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !gig) {
    return (
      <div className="min-h-dvh grid place-items-center px-8 text-center">
        <div>
          <div className="text-4xl">🤷</div>
          <h1 className="mt-4 text-xl font-bold">{t('gig.notFound')}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t('gig.notFoundBody')}</p>
          <Button asChild variant="brand" className="mt-6">
            <Link href="/">{t('gig.backHome')}</Link>
          </Button>
        </div>
      </div>
    );
  }

  const packages = gig.packages ?? [];
  const selected = packages.find((p) => p.tier === tier) ?? packages[0];
  const canMessage = !!me && me.id !== gig.owner.id;
  const isOwnGig = me?.id === gig.owner.id;

  const handleMessageFreelancer = async () => {
    if (!me) {
      router.push('/login');
      return;
    }
    try {
      const conv = await startConversation.mutateAsync(gig.owner.id);
      router.push(`/messages/${conv.id}`);
    } catch (err) {
      toast.error(t('gig.startFailed'));
    }
  };

  const handleContinue = async () => {
    if (!selected || !gig) return;
    if (!me) {
      router.push(`/login?next=${encodeURIComponent(`/gigs/${slug}`)}`);
      return;
    }
    if (isOwnGig) {
      toast.info(t('gig.cantHireSelf'));
      return;
    }
    try {
      const result = await createOrder.mutateAsync({
        gigId: gig.id,
        packageTier: selected.tier,
      });
      if (result.checkoutUrl) {
        toast.success(t('gig.redirectingCheckout'));
        window.location.href = result.checkoutUrl;
      } else if (result.devSkipped) {
        toast.success(t('gig.orderCreatedDev'));
        router.push(`/orders/${result.order.id}`);
      } else {
        toast.error(t('gig.checkoutFailed'));
      }
    } catch (err) {
      const e = err as { message?: string };
      toast.error(e.message ?? t('gig.somethingWrong'));
    }
  };

  return (
    <div className="min-h-dvh pb-32">
      {/* Hero cover */}
      <div className={cn('relative h-56 bg-gradient-to-br sm:h-72', gradientFor(gig.id))}>
        <div className="safe-top absolute inset-x-0 top-0 z-10 flex items-center justify-between px-4 py-3">
          <button
            onClick={() => router.back()}
            aria-label="Back"
            className="grid h-10 w-10 place-items-center rounded-full bg-black/50 text-white backdrop-blur"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex gap-2">
            <button
              aria-label="Save"
              className="grid h-10 w-10 place-items-center rounded-full bg-black/50 text-white backdrop-blur"
            >
              <Heart className="h-5 w-5" />
            </button>
            <button
              aria-label="Share"
              className="grid h-10 w-10 place-items-center rounded-full bg-black/50 text-white backdrop-blur"
            >
              <Share2 className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Card overlay */}
      <div className="mx-4 -mt-8 rounded-2xl border border-border bg-card p-5 shadow-lg">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              'grid h-14 w-14 shrink-0 place-items-center rounded-full bg-gradient-to-br text-base font-bold text-white ring-4 ring-card',
              gradientFor(gig.owner.id),
            )}
          >
            {initialsOf(gig.owner.fullName)}
          </div>
          <div className="min-w-0 flex-1">
            <Link
              href={`/u/${gig.owner.username}`}
              className="flex items-center gap-1.5 text-sm font-bold"
            >
              {gig.owner.fullName}
              <CheckCircle2 className="h-3.5 w-3.5 text-cyan-400" />
            </Link>
            <p className="text-[11px] text-muted-foreground">@{gig.owner.username}</p>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
              {gig.owner.ratingCount > 0 && (
                <>
                  <span className="flex items-center gap-1">
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                    <span className="font-semibold text-foreground">
                      {gig.owner.rating.toFixed(1)}
                    </span>{' '}
                    ({gig.owner.ratingCount})
                  </span>
                  <span>·</span>
                </>
              )}
              {gig.owner.city && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {gig.owner.city}
                </span>
              )}
              <span>·</span>
              <span>{gig.owner.completedOrders} orders</span>
            </div>
          </div>
        </div>
        <h1 className="mt-4 text-xl font-extrabold leading-tight tracking-tight sm:text-2xl">
          {gig.title}
        </h1>
      </div>

      {/* Description */}
      <div className="mx-4 mt-6">
        <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
          {t('gig.aboutGig')}
        </h2>
        <RichViewer html={gig.description} className="text-sm text-foreground/90" />

        {gig.tags?.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {gig.tags.map((t) => (
              <span
                key={t}
                className="rounded-full border border-border bg-card px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground"
              >
                #{t}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Packages */}
      {packages.length > 0 && (
        <div className="mx-4 mt-8">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">
            {t('gig.choosePackage')}
          </h2>

          {packages.length > 1 ? (
            <div className="mb-3 flex gap-1 rounded-full border border-border bg-card p-1">
              {packages.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setTier(p.tier)}
                  className={cn(
                    'flex-1 rounded-full py-2 text-xs font-bold capitalize transition-colors',
                    tier === p.tier
                      ? 'grad-hero text-white shadow'
                      : 'text-muted-foreground',
                  )}
                >
                  {p.tier.toLowerCase()}
                </button>
              ))}
            </div>
          ) : null}

          {selected && (
            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-baseline justify-between">
                <h3 className="text-lg font-extrabold tracking-tight">{selected.title}</h3>
                <div className="text-2xl font-extrabold tracking-tight">
                  {formatEtb(selected.priceEtb)}
                </div>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{selected.description}</p>
              <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm">
                <span className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-primary" />
                  <span className="font-semibold">{selected.deliveryDays}</span>{' '}
                  <span className="text-muted-foreground">{t('gig.delivery')}</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <Repeat className="h-4 w-4 text-primary" />
                  <span className="font-semibold">
                    {selected.revisions === 0 ? '0' : selected.revisions}
                  </span>{' '}
                  <span className="text-muted-foreground">{t('gig.revisions')}</span>
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* About the freelancer */}
      {gig.owner.bio && (
        <div className="mx-4 mt-8">
          <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
            {t('gig.aboutFreelancer')}
          </h2>
          <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/90">
            {gig.owner.bio}
          </p>
        </div>
      )}

      {/* Similar gigs */}
      <SimilarGigsSection slug={slug} />

      <div className="h-24" />

      {/* Sticky bottom bar */}
      <div className="safe-bottom fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 px-4 pb-4 pt-3 backdrop-blur-xl">
        <div className="mx-auto flex max-w-md items-center gap-2">
          {canMessage && (
            <Button
              variant="outline"
              size="lg"
              className="h-12 w-12 p-0"
              onClick={handleMessageFreelancer}
              disabled={startConversation.isPending}
              aria-label="Message freelancer"
            >
              {startConversation.isPending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <MessageCircle className="h-5 w-5" />
              )}
            </Button>
          )}
          <Button
            variant="brand"
            size="lg"
            className="flex-1"
            onClick={handleContinue}
            disabled={!selected || createOrder.isPending}
          >
            {createOrder.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isOwnGig ? (
              t('gig.preview')
            ) : selected ? (
              `${t('common.continue')} · ${formatEtb(selected.priceEtb)}`
            ) : (
              t('common.continue')
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// SIMILAR GIGS
// -----------------------------------------------------------------------------
function SimilarGigsSection({ slug }: { slug: string }) {
  const { data } = useSimilarGigs(slug);
  const items = data?.items ?? [];
  if (items.length === 0) return null;
  return (
    <div className="mx-4 mt-8">
      <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
        Similar services
      </h2>
      <div className="grid grid-cols-2 gap-2">
        {items.map((g) => (
          <Link key={g.id} href={`/gigs/${g.slug}`} className="rounded-2xl border border-border bg-card p-2 transition-transform active:scale-[0.98]">
            <div className="relative aspect-video overflow-hidden rounded-lg bg-muted">
              {g.coverImageUrl && (
                <Image src={g.coverImageUrl} alt={g.title} fill unoptimized sizes="200px" className="object-cover" />
              )}
            </div>
            <div className="mt-2 line-clamp-2 text-xs font-semibold">{g.title}</div>
            <div className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
              {g.rating > 0 && <><Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" /> {g.rating.toFixed(1)}</>}
              <span className="ml-auto font-bold text-primary">{formatEtb(g.startingPriceEtb)}+</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
