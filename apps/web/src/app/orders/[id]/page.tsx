'use client';

import { useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Loader2,
  CheckCircle,
  MessageCircle,
  Clock,
  AlertCircle,
  XCircle,
  Package,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useOrder, useOrderAction, useVerifyPayment, type OrderStatus } from '@/hooks/use-orders';
import { useMe } from '@/hooks/use-me';
import { useStartConversation } from '@/hooks/use-chat';
import { useMyReviewForOrder } from '@/hooks/use-reviews';
import { LazyRateReviewSheet as RateReviewSheet } from '@/components/lazy';
import { MilestonePanel } from '@/components/orders/milestone-panel';
import { cn, formatEtb, timeAgo } from '@/lib/utils';
import { useState } from 'react';
import { Star } from 'lucide-react';

const STATUS_STYLE: Record<
  OrderStatus,
  { label: string; className: string; icon: typeof Package }
> = {
  PENDING: { label: 'Awaiting payment', className: 'text-amber-500', icon: Clock },
  ACTIVE: { label: 'In progress', className: 'text-blue-500', icon: Package },
  IN_REVIEW: { label: 'In review', className: 'text-violet-500', icon: AlertCircle },
  DELIVERED: { label: 'Delivered', className: 'text-emerald-500', icon: CheckCircle },
  COMPLETED: { label: 'Completed', className: 'text-emerald-500', icon: CheckCircle },
  CANCELLED: { label: 'Cancelled', className: 'text-muted-foreground', icon: XCircle },
  DISPUTED: { label: 'Disputed', className: 'text-red-500', icon: AlertCircle },
};

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const router = useRouter();
  const { data: me } = useMe();
  const { data: order, isLoading, error, refetch } = useOrder(id);
  const action = useOrderAction(id);
  const verify = useVerifyPayment();
  const startConv = useStartConversation();
  const [reviewOpen, setReviewOpen] = useState(false);
  const myReview = useMyReviewForOrder(order?.status === 'COMPLETED' ? id : undefined);

  // If we just came back from Chapa's return URL (?paid=1), force a verify
  // in case the webhook is still queued.
  useEffect(() => {
    if (params.get('paid') === '1' && id) {
      verify
        .mutateAsync(id)
        .then((r) => {
          if (r.updated) toast.success('Payment confirmed 🎉');
        })
        .catch(() => {
          // silent — polling below will pick up when Chapa finalizes
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Poll while PENDING for up to ~2 minutes in case the webhook is delayed.
  useEffect(() => {
    if (order?.status !== 'PENDING') return;
    const t = setInterval(() => refetch(), 5000);
    const stop = setTimeout(() => clearInterval(t), 120_000);
    return () => {
      clearInterval(t);
      clearTimeout(stop);
    };
  }, [order?.status, refetch]);

  if (isLoading || !order) {
    return (
      <div className="grid min-h-dvh place-items-center">
        {error ? (
          <div className="text-center">
            <XCircle className="mx-auto h-8 w-8 text-destructive" />
            <p className="mt-2 text-sm">Order not found</p>
            <Button asChild variant="brand" size="sm" className="mt-4">
              <Link href="/orders">Back to orders</Link>
            </Button>
          </div>
        ) : (
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        )}
      </div>
    );
  }

  const isSeller = me?.id === order.seller.id;
  const other = isSeller ? order.client : order.seller;
  const status = STATUS_STYLE[order.status];
  const StatusIcon = status.icon;

  const doAction = async (input: Record<string, unknown>, successMsg: string) => {
    try {
      await action.mutateAsync(input);
      toast.success(successMsg);
    } catch (err) {
      const e = err as { message?: string };
      toast.error(e.message ?? 'Action failed');
    }
  };

  const startChat = async () => {
    if (!me) {
      router.push('/login');
      return;
    }
    try {
      const conv = await startConv.mutateAsync(other.id);
      router.push(`/messages/${conv.id}`);
    } catch {
      toast.error('Could not open chat');
    }
  };

  return (
    <div className="min-h-dvh pb-32">
      {/* Header */}
      <header className="safe-top sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-background/95 px-3 py-3 backdrop-blur-xl">
        <button
          onClick={() => router.back()}
          aria-label="Back"
          className="grid h-9 w-9 place-items-center rounded-full active:scale-90"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">Order</div>
          <div className="truncate font-mono text-[10px] text-muted-foreground">
            #{order.orderNumber.slice(0, 12)}
          </div>
        </div>
      </header>

      {/* Status card */}
      <div className="mx-4 mt-4 rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-2">
          <StatusIcon className={cn('h-5 w-5', status.className)} />
          <span className={cn('text-sm font-bold', status.className)}>{status.label}</span>
        </div>
        <h1 className="mt-3 text-lg font-extrabold leading-tight">{order.title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          <span>Created {timeAgo(order.createdAt)}</span>
          {order.deadline && (
            <>
              <span>·</span>
              <span>Due {new Date(order.deadline).toLocaleDateString()}</span>
            </>
          )}
        </div>
      </div>

      {/* Parties */}
      <Section title={isSeller ? 'Client' : 'Freelancer'}>
        <Link
          href={`/u/${other.username}`}
          className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 active:scale-[.99]"
        >
          <div className="grad-hero grid h-11 w-11 place-items-center rounded-full text-sm font-bold text-white">
            {other.fullName
              .split(' ')
              .map((w) => w[0])
              .slice(0, 2)
              .join('')
              .toUpperCase()}
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold">{other.fullName}</div>
            <div className="text-[11px] text-muted-foreground">@{other.username}</div>
          </div>
          <button
            onClick={(e) => {
              e.preventDefault();
              void startChat();
            }}
            aria-label="Message"
            className="grad-hero grid h-9 w-9 place-items-center rounded-full text-white"
          >
            <MessageCircle className="h-4 w-4" />
          </button>
        </Link>
      </Section>

      {/* Payment summary */}
      <Section title="Payment">
        <div className="space-y-2 rounded-2xl border border-border bg-card p-4 text-sm">
          <PaymentRow k="Order total" v={formatEtb(order.amountEtb)} bold />
          {isSeller && (
            <>
              <PaymentRow
                k="Platform fee"
                v={`− ${formatEtb(order.platformFeeEtb)}`}
                muted
              />
              <div className="border-t border-border pt-2">
                <PaymentRow k="Your net" v={formatEtb(order.sellerNetEtb)} bold />
              </div>
            </>
          )}
          {order.payments[0] && (
            <div className="mt-2 border-t border-border pt-2 text-xs text-muted-foreground">
              <span className="mr-2">Method:</span>
              <span className="font-semibold text-foreground">
                {order.payments[0].method ?? 'Chapa'} ·{' '}
                {order.payments[0].status.toLowerCase()}
              </span>
            </div>
          )}
        </div>
      </Section>

      {/* Milestones — only meaningful once escrow has funded (ACTIVE+). */}
      {order.status !== 'PENDING' && order.status !== 'CANCELLED' && (
        <Section title="Milestones">
          <MilestonePanel
            orderId={order.id}
            amountEtb={order.amountEtb}
            isClient={!isSeller}
            isSeller={isSeller}
            orderStatus={order.status}
          />
        </Section>
      )}

      {/* Requirements */}
      {order.requirements && (
        <Section title="Requirements from client">
          <div className="rounded-2xl border border-border bg-card p-4 text-sm whitespace-pre-line">
            {order.requirements}
          </div>
        </Section>
      )}

      {/* Deliverables */}
      {order.deliverables && (
        <Section title="Delivery">
          <div className="rounded-2xl border border-border bg-card p-4 text-sm">
            {order.deliverables.notes && (
              <p className="whitespace-pre-line">{order.deliverables.notes}</p>
            )}
            {order.deliverables.files && order.deliverables.files.length > 0 && (
              <ul className="mt-2 flex flex-col gap-1">
                {order.deliverables.files.map((f) => (
                  <li key={f}>
                    <a
                      href={f}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary underline"
                    >
                      Download attachment
                    </a>
                  </li>
                ))}
              </ul>
            )}
            {order.deliveredAt && (
              <div className="mt-2 text-[11px] text-muted-foreground">
                Delivered {timeAgo(order.deliveredAt)}
              </div>
            )}
          </div>
        </Section>
      )}

      {/* Review — only shown after completion, only to the client */}
      {order.status === 'COMPLETED' && !isSeller && (
        <Section title="Review">
          {myReview.data?.review ? (
            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star
                    key={n}
                    className={cn(
                      'h-5 w-5',
                      (myReview.data?.review?.rating ?? 0) >= n
                        ? 'fill-amber-400 text-amber-400'
                        : 'text-muted-foreground/30',
                    )}
                  />
                ))}
                <span className="ml-1 text-sm font-semibold">
                  {myReview.data.review.rating}/5
                </span>
              </div>
              {myReview.data.review.comment && (
                <p className="mt-2 whitespace-pre-line text-sm text-foreground/90">
                  {myReview.data.review.comment}
                </p>
              )}
              <div className="mt-2 text-[11px] text-muted-foreground">
                Reviewed {timeAgo(myReview.data.review.createdAt)}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-card p-4 text-center">
              <Star className="mx-auto h-8 w-8 text-amber-400" />
              <p className="mt-2 text-sm font-semibold">How was your experience?</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Your review helps {order.seller.fullName.split(' ')[0]} and other clients.
              </p>
              <Button
                variant="brand"
                size="sm"
                className="mt-3"
                onClick={() => setReviewOpen(true)}
              >
                Leave a review
              </Button>
            </div>
          )}
        </Section>
      )}

      <RateReviewSheet
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        orderId={order.id}
        sellerName={order.seller.fullName}
        onDone={() => myReview.refetch()}
      />

      {/* Sticky action bar */}
      <div className="safe-bottom fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 px-4 pb-4 pt-3 backdrop-blur-xl">
        <div className="mx-auto flex max-w-md gap-2">
          <OrderActions
            status={order.status}
            isSeller={isSeller}
            pending={action.isPending}
            onDeliver={() => doAction({ action: 'deliver' }, 'Marked as delivered')}
            onAccept={() => doAction({ action: 'accept' }, 'Order completed 🎉')}
            onRevise={() => {
              const notes = window.prompt('What needs revision?');
              if (!notes || notes.length < 5) return;
              void doAction({ action: 'revise', notes }, 'Revision requested');
            }}
            onCancel={() => {
              if (!window.confirm('Are you sure you want to cancel this order?')) return;
              void doAction({ action: 'cancel' }, 'Order cancelled');
            }}
          />
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-4 mt-6">
      <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
        {title}
      </h2>
      {children}
    </div>
  );
}

function PaymentRow({
  k,
  v,
  bold,
  muted,
}: {
  k: string;
  v: string;
  bold?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={muted ? 'text-muted-foreground' : ''}>{k}</span>
      <span
        className={cn(
          bold && 'text-base font-extrabold',
          muted && 'text-muted-foreground',
        )}
      >
        {v}
      </span>
    </div>
  );
}

function OrderActions({
  status,
  isSeller,
  pending,
  onDeliver,
  onAccept,
  onRevise,
  onCancel,
}: {
  status: OrderStatus;
  isSeller: boolean;
  pending: boolean;
  onDeliver: () => void;
  onAccept: () => void;
  onRevise: () => void;
  onCancel: () => void;
}) {
  if (pending) {
    return (
      <Button variant="brand" size="lg" className="flex-1" disabled>
        <Loader2 className="h-4 w-4 animate-spin" />
      </Button>
    );
  }
  if (status === 'PENDING') {
    return (
      <>
        <Button variant="outline" size="lg" className="flex-1" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="brand" size="lg" className="flex-1" disabled>
          <Loader2 className="h-4 w-4 animate-spin" /> Waiting…
        </Button>
      </>
    );
  }
  if (status === 'ACTIVE' && isSeller) {
    return (
      <>
        <Button variant="outline" size="lg" className="flex-1" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="brand" size="lg" className="flex-1" onClick={onDeliver}>
          Mark delivered
        </Button>
      </>
    );
  }
  if (status === 'IN_REVIEW' && !isSeller) {
    return (
      <>
        <Button variant="outline" size="lg" className="flex-1" onClick={onRevise}>
          Request revision
        </Button>
        <Button variant="brand" size="lg" className="flex-1" onClick={onAccept}>
          Accept & release
        </Button>
      </>
    );
  }
  return (
    <Button variant="outline" size="lg" className="flex-1" disabled>
      No actions available
    </Button>
  );
}
