'use client';

import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { CheckCircle2, XCircle, Clock, Loader2, Package } from 'lucide-react';
import { useOffer, useRespondOffer } from '@/hooks/use-moderation';
import { useMe } from '@/hooks/use-me';
import { useI18n } from '@/i18n';
import { cn, formatEtb, timeAgo } from '@/lib/utils';

interface Props {
  offerId: string;
  isMine: boolean;
}

/**
 * Inline card rendered for messages whose attachmentUrl is `apex://offer/{id}`.
 * Loads the offer, shows accept/decline (for recipient) or cancel (for sender),
 * and redirects to Chapa checkout on accept.
 */
export function OfferCard({ offerId, isMine }: Props) {
  const router = useRouter();
  const { t } = useI18n();
  const { data: me } = useMe();
  const { data: offer, isLoading } = useOffer(offerId);
  const respond = useRespondOffer();

  if (isLoading || !offer) {
    return (
      <div
        className={cn(
          'flex items-center gap-2 rounded-2xl px-4 py-3 text-xs',
          isMine ? 'bg-white/10 text-white/80' : 'bg-muted text-muted-foreground',
        )}
      >
        <Loader2 className="h-3 w-3 animate-spin" /> {t('offer.loading')}
      </div>
    );
  }

  const isSender = me?.id === offer.senderId;
  const isRecipient = me?.id === offer.recipientId;
  const expired = new Date(offer.expiresAt) < new Date();
  const status = expired && offer.status === 'PENDING' ? 'EXPIRED' : offer.status;

  const doAction = async (action: 'accept' | 'decline' | 'cancel') => {
    try {
      const res = await respond.mutateAsync({ id: offer.id, action });
      if (action === 'accept') {
        toast.success(t('offer.accepted'));
        if (res.checkoutUrl) {
          window.location.href = res.checkoutUrl;
        } else if (res.order) {
          router.push(`/orders/${res.order.id}`);
        }
      } else if (action === 'decline') {
        toast.success(t('offer.declined'));
      } else {
        toast.success(t('offer.cancelled'));
      }
    } catch (err) {
      const e = err as { message?: string };
      toast.error(e.message ?? t('offer.sendFailed'));
    }
  };

  return (
    <div
      className={cn(
        'w-72 max-w-full overflow-hidden rounded-2xl border bg-card text-foreground shadow-lg',
        status === 'ACCEPTED'
          ? 'border-emerald-500/40'
          : status === 'DECLINED' || status === 'CANCELLED' || status === 'EXPIRED'
            ? 'border-muted'
            : 'border-primary/40',
      )}
    >
      <div className="grad-hero flex items-center gap-2 px-4 py-2 text-white">
        <Package className="h-4 w-4" />
        <span className="text-xs font-bold uppercase tracking-wider">{t('offer.cardTitle')}</span>
        <StatusBadge status={status} />
      </div>
      <div className="px-4 py-3">
        <div className="text-sm font-extrabold leading-snug">{offer.title}</div>
        {offer.description && (
          <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">{offer.description}</p>
        )}
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {t('offer.priceLabel')}
            </div>
            <div className="text-base font-extrabold text-primary">
              {formatEtb(offer.priceEtb)}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {t('offer.deliveryLabel')}
            </div>
            <div className="text-base font-extrabold">
              {offer.deliveryDays === 1
                ? t('offer.dayUnit')
                : t('offer.daysUnit', { n: offer.deliveryDays })}
            </div>
          </div>
        </div>

        {status === 'PENDING' && isRecipient && (
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => doAction('accept')}
              disabled={respond.isPending}
              className="grad-hero flex-1 rounded-lg py-2 text-xs font-bold text-white shadow-md shadow-primary/30 active:scale-95 disabled:opacity-40"
            >
              {t('offer.accept')}
            </button>
            <button
              onClick={() => doAction('decline')}
              disabled={respond.isPending}
              className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-muted-foreground active:scale-95"
            >
              {t('offer.decline')}
            </button>
          </div>
        )}
        {status === 'PENDING' && isSender && (
          <button
            onClick={() => doAction('cancel')}
            disabled={respond.isPending}
            className="mt-3 w-full rounded-lg border border-border bg-card py-2 text-xs font-semibold text-muted-foreground active:scale-95"
          >
            {t('offer.cancel')}
          </button>
        )}
        {status === 'ACCEPTED' && offer.orderId && (
          <button
            onClick={() => router.push(`/orders/${offer.orderId}`)}
            className="mt-3 w-full rounded-lg bg-emerald-500/10 py-2 text-xs font-bold text-emerald-600 active:scale-95"
          >
            View order →
          </button>
        )}
        <div className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground">
          <Clock className="h-3 w-3" />
          {status === 'PENDING'
            ? t('offer.expires', { when: timeAgo(offer.expiresAt) })
            : timeAgo(offer.createdAt)}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const { t } = useI18n();
  if (status === 'PENDING') return null;
  const color =
    status === 'ACCEPTED'
      ? 'bg-emerald-500/30'
      : status === 'DECLINED' || status === 'CANCELLED'
        ? 'bg-red-500/30'
        : 'bg-muted-foreground/30';
  const icon =
    status === 'ACCEPTED' ? (
      <CheckCircle2 className="h-3 w-3" />
    ) : (
      <XCircle className="h-3 w-3" />
    );
  const label: Record<string, string> = {
    ACCEPTED: t('offer.accepted'),
    DECLINED: t('offer.declined'),
    CANCELLED: t('offer.cancelled'),
    EXPIRED: t('offer.expired'),
  };
  return (
    <span
      className={cn(
        'ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold',
        color,
      )}
    >
      {icon}
      {label[status] ?? status}
    </span>
  );
}
