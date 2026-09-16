'use client';

import { dt } from '@/i18n/auto';
import { useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  ArrowLeft,
  FileSpreadsheet,
  Loader2,
  CheckCircle,
  MessageCircle,
  Clock,
  AlertCircle,
  XCircle,
  Package,
  Download,
  LayoutDashboard,
  FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useOrder, useOrderAction, useVerifyPayment, type OrderStatus } from '@/hooks/use-orders';
import { useQueryClient } from '@tanstack/react-query';
import { useMe } from '@/hooks/use-me';
import { useStartConversation } from '@/hooks/use-chat';
import { useMyReviewForOrder } from '@/hooks/use-reviews';
import { LazyRateReviewSheet as RateReviewSheet } from '@/components/lazy';
import { MilestonePanel } from '@/components/orders/milestone-panel';
import { useAuthStore } from '@/stores/auth-store';
import { downloadViaAuth } from '@/lib/api';
import { InvoiceDocument, invoiceCsv } from '@/components/orders/invoice-document';
import { downloadHtmlPdf } from '@/lib/resume-export';
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
  const qc = useQueryClient();
  const verify = useVerifyPayment();
  const startConv = useStartConversation();
  const [reviewOpen, setReviewOpen] = useState(false);
  const [invoiceExporting, setInvoiceExporting] = useState(false);
  const token = useAuthStore((s) => s.accessToken);
  const myReview = useMyReviewForOrder(order?.status === 'COMPLETED' ? id : undefined);

  // If we just came back from Chapa's return URL (?paid=1), force a verify
  // in case the webhook is still queued.
  useEffect(() => {
    if (params.get('paid') === '1' && id) {
      verify
        .mutateAsync(id)
        .then((r) => {
          if (r.updated) toast.success(dt('Payment confirmed 🎉'));
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
            <p className="mt-2 text-sm">{dt('Order not found')}</p>
            <Button asChild variant="brand" size="sm" className="mt-4">
              <Link href="/orders">{dt('Back to orders')}</Link>
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

  const downloadInvoice = async () => {
    const element = document.getElementById(`invoice-${order.id}`);
    if (!element) return toast.error(dt('Receipt is not ready yet'));
    setInvoiceExporting(true);
    try {
      await downloadHtmlPdf(element, `apex-work-receipt-${order.orderNumber}.pdf`);
      toast.success(dt('Receipt downloaded'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Receipt download failed');
    } finally {
      setInvoiceExporting(false);
    }
  };

  const downloadServerReceipt = async () => {
    setInvoiceExporting(true);
    try {
      await downloadViaAuth(`/orders/${order.id}/receipt`, token);
      toast.success(dt('Receipt downloaded'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Receipt download failed');
    } finally {
      setInvoiceExporting(false);
    }
  };

  const downloadCsv = () => {
    try {
      const csv = invoiceCsv(order, isSeller);
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `apex-work-invoice-${order.orderNumber}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(dt('CSV downloaded'));
    } catch {
      toast.error(dt('Could not export CSV'));
    }
  };

  const doAction = async (input: Record<string, unknown>, successMsg: string) => {
    try {
      await action.mutateAsync(input);
      toast.success(successMsg);
    } catch (err) {
      const e = err as { message?: string };
      toast.error(e.message ?? 'Action failed');
      // The failure may mean another tap/tab/device already moved the order —
      // re-sync so the correct action buttons render.
      void qc.invalidateQueries({ queryKey: ['order', id] });
      void qc.invalidateQueries({ queryKey: ['orders'] });
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
      toast.error(dt('Could not open chat'));
    }
  };

  return (
    <div className="min-h-dvh pb-32">
      {/* Header */}
      <header className="safe-top sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-background/95 px-3 py-3 backdrop-blur-xl">
        <button
          onClick={() => router.back()}
          aria-label={dt('Back')}
          className="grid h-9 w-9 place-items-center rounded-full active:scale-90"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{dt('Order')}</div>
          <div className="truncate font-mono text-[10px] text-muted-foreground">
            #{order.orderNumber.slice(0, 12)}
          </div>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link href={`/orders/${order.id}/workspace`}>
            <LayoutDashboard className="h-4 w-4" />{' '}
            <span className="hidden sm:inline">{dt('Workspace')}</span>
          </Link>
        </Button>
        <Button size="sm" variant="outline" onClick={downloadInvoice} disabled={invoiceExporting}>
          {invoiceExporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          <span className="hidden sm:inline">{dt('Receipt')}</span>
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={downloadServerReceipt}
          disabled={invoiceExporting}
        >
          {invoiceExporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileText className="h-4 w-4" />
          )}
          <span className="hidden sm:inline">{dt('HTML')}</span>
        </Button>
        <Button size="sm" variant="ghost" onClick={downloadCsv} aria-label={dt('Export CSV')}>
          <FileSpreadsheet className="h-4 w-4" />
        </Button>
      </header>

      <div id={`invoice-${order.id}`} className="pointer-events-none fixed -left-[10000px] top-0">
        <InvoiceDocument order={order} isSeller={isSeller} />
      </div>

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
        <OrderFlowStepper status={order.status} isSeller={isSeller} />
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
            aria-label={dt('Message')}
            className="grad-hero grid h-9 w-9 place-items-center rounded-full text-white"
          >
            <MessageCircle className="h-4 w-4" />
          </button>
        </Link>
      </Section>

      {/* Escrow status timeline — where the money is right now */}
      <Section title={dt('Funds')}>
        <EscrowTimeline status={order.status} />
      </Section>

      {/* Payment summary */}
      <Section title={dt('Payment')}>
        <div className="space-y-2 rounded-2xl border border-border bg-card p-4 text-sm">
          <PaymentRow k="Order total" v={formatEtb(order.amountEtb)} bold />
          {isSeller && (
            <>
              <PaymentRow k="Platform fee" v={`− ${formatEtb(order.platformFeeEtb)}`} muted />
              <div className="border-t border-border pt-2">
                <PaymentRow k="Your net" v={formatEtb(order.sellerNetEtb)} bold />
              </div>
            </>
          )}
          {order.payments[0] && (
            <div className="mt-2 border-t border-border pt-2 text-xs text-muted-foreground">
              <span className="mr-2">Method:</span>
              <span className="font-semibold text-foreground">
                {order.payments[0].method ?? 'Chapa'} · {order.payments[0].status.toLowerCase()}
              </span>
            </div>
          )}
        </div>
      </Section>

      {/* Milestones — only meaningful once escrow has funded (ACTIVE+). */}
      {order.status !== 'PENDING' && order.status !== 'CANCELLED' && (
        <Section title={dt('Milestones')}>
          <MilestonePanel
            orderId={order.id}
            amountEtb={order.amountEtb}
            isClient={!isSeller}
            isSeller={isSeller}
            orderStatus={order.status}
          />
        </Section>
      )}

      {/* Dispute */}
      {['ACTIVE', 'IN_REVIEW', 'DELIVERED', 'DISPUTED'].includes(order.status) && (
        <Section title={dt('Trouble with this order?')}>
          <DisputeBox orderId={order.id} status={order.status} />
        </Section>
      )}

      {/* Requirements */}
      {order.requirements && (
        <Section title={dt('Requirements from client')}>
          <div className="whitespace-pre-line rounded-2xl border border-border bg-card p-4 text-sm">
            {order.requirements}
          </div>
        </Section>
      )}

      {/* Deliverables */}
      {order.deliverables && (
        <Section title={dt('Delivery')}>
          <div className="rounded-2xl border border-border bg-card p-4 text-sm">
            {order.deliverables.notes && (
              <p className="whitespace-pre-line">{order.deliverables.notes}</p>
            )}
            {order.deliverables.files && order.deliverables.files.length > 0 && (
              <ul className="mt-2 flex flex-col gap-1">
                {order.deliverables.files.map((f) => (
                  <li key={f}>
                    <a href={f} target="_blank" rel="noreferrer" className="text-primary underline">
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
        <Section title={dt('Review')}>
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
                <span className="ml-1 text-sm font-semibold">{myReview.data.review.rating}/5</span>
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
              <p className="mt-2 text-sm font-semibold">{dt('How was your experience?')}</p>
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
      <span className={cn(bold && 'text-base font-extrabold', muted && 'text-muted-foreground')}>
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

// -----------------------------------------------------------------------------
// DISPUTE BOX
// -----------------------------------------------------------------------------
import { AlertTriangle, Loader2 as SpinnerIcon } from 'lucide-react';
import { useOpenDispute } from '@/hooks/use-disputes';
function DisputeBox({ orderId, status }: { orderId: string; status: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const openDispute = useOpenDispute();

  const submit = async () => {
    if (reason.trim().length < 20) return toast.error(dt('Explain the issue (20+ chars)'));
    try {
      await openDispute.mutateAsync({ orderId, reason: reason.trim() });
      toast.success(dt('Dispute opened — an admin will review within 48h'));
      setOpen(false);
      setReason('');
    } catch (err) {
      toast.error((err as { message?: string }).message ?? 'Could not open dispute');
    }
  };

  if (status === 'DISPUTED') {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-4 text-sm">
        <div className="flex items-center gap-2 font-bold text-red-500">
          <AlertTriangle className="h-4 w-4" /> Dispute is open
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          An admin will review and rule within 48h. You&rsquo;ll be notified with the outcome.
        </p>
      </div>
    );
  }
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 text-xs font-bold text-red-500 underline"
      >
        Open a dispute →
      </button>
    );
  }
  return (
    <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-4">
      <div className="flex items-center gap-2 text-sm font-bold text-red-500">
        <AlertTriangle className="h-4 w-4" /> Open a dispute
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Only use this if you can&rsquo;t resolve it in chat. Escrow stays frozen until an admin
        rules.
      </p>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={4}
        maxLength={4000}
        placeholder={dt('Describe what went wrong — dates, deliverables, screenshots links…')}
        className="mt-3 w-full resize-none rounded-xl border border-border bg-background p-3 text-sm outline-none focus:border-red-500 focus:ring-4 focus:ring-red-500/20"
      />
      <div className="mt-2 flex gap-2">
        <Button size="sm" variant="outline" className="flex-1" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Button
          size="sm"
          variant="destructive"
          className="flex-1"
          onClick={submit}
          disabled={openDispute.isPending}
        >
          {openDispute.isPending ? (
            <SpinnerIcon className="h-3.5 w-3.5 animate-spin" />
          ) : (
            'Open dispute'
          )}
        </Button>
      </div>
    </div>
  );
}

// Escrow / funds status timeline — reassures both parties where the money is.
function OrderFlowStepper({ status, isSeller }: { status: string; isSeller: boolean }) {
  const steps = [dt('Ordered'), dt('In progress'), dt('In review'), dt('Completed')];
  const idx =
    status === 'PENDING'
      ? 0
      : status === 'ACTIVE'
        ? 1
        : status === 'IN_REVIEW' || status === 'DELIVERED'
          ? 2
          : 3;
  const hint =
    status === 'PENDING'
      ? isSeller
        ? dt('Waiting for the client to pay — work has not started yet.')
        : dt('Complete payment to start the order.')
      : status === 'ACTIVE'
        ? isSeller
          ? dt('Do the work, then mark it delivered.')
          : dt('Work is in progress. You can cancel or dispute while you wait.')
        : status === 'IN_REVIEW' || status === 'DELIVERED'
          ? isSeller
            ? dt('Client is reviewing — funds auto-release 7 days after delivery.')
            : dt(
                'Accept & release, request a revision, or dispute. Funds auto-release after 7 days.',
              )
          : status === 'COMPLETED'
            ? dt('Done — funds were released to the freelancer.')
            : null;

  if (status === 'CANCELLED' || status === 'DISPUTED') return null;

  return (
    <div className="mt-4 border-t border-border pt-3">
      <div className="flex items-center">
        {steps.map((label, i) => (
          <div key={label} className="flex flex-1 items-center">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`grid h-5 w-5 place-items-center rounded-full text-[9px] font-black ${
                  i < idx
                    ? 'bg-emerald-500 text-white'
                    : i === idx
                      ? 'bg-primary text-white'
                      : 'bg-muted text-muted-foreground'
                }`}
              >
                {i < idx ? '✓' : i + 1}
              </div>
              <span
                className={`text-center text-[9px] font-semibold leading-tight ${
                  i <= idx ? 'text-foreground' : 'text-muted-foreground'
                }`}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={`mx-1 mb-3.5 h-0.5 flex-1 rounded ${i < idx ? 'bg-emerald-500/60' : 'bg-muted'}`}
              />
            )}
          </div>
        ))}
      </div>
      {hint && <p className="mt-2 text-center text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function EscrowTimeline({ status }: { status: string }) {
  // Stage order: money goes from client → held in escrow → released to seller.
  // Reject/Cancelled leaves it clear. DISPUTED = held pending admin ruling.
  const stages: { key: string; label: string; done: boolean; active: boolean }[] = [];
  const paid = status !== 'PENDING';
  const released = status === 'COMPLETED';
  const held = paid && !released && status !== 'CANCELLED';
  stages.push({ key: 'client', label: 'Client pays', done: paid, active: !paid });
  stages.push({ key: 'held', label: 'Held in escrow', done: held, active: paid && !held });
  stages.push({
    key: 'released',
    label: 'Released to seller',
    done: released,
    active: !released && !held,
  });

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center">
        {stages.map((s, i) => (
          <div key={s.key} className="flex flex-1 items-center">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`grid h-6 w-6 place-items-center rounded-full text-[10px] font-black ${
                  s.done
                    ? 'bg-emerald-500 text-white'
                    : s.active
                      ? 'bg-primary text-white'
                      : 'bg-muted text-muted-foreground'
                }`}
              >
                {s.done ? '✓' : i + 1}
              </div>
              <span
                className={`text-center text-[9px] font-semibold leading-tight ${s.done ? 'text-emerald-600' : s.active ? 'text-foreground' : 'text-muted-foreground'}`}
              >
                {s.label}
              </span>
            </div>
            {i < stages.length - 1 && (
              <div
                className={`mx-1 mb-4 h-0.5 flex-1 rounded ${s.done ? 'bg-emerald-500/60' : 'bg-muted'}`}
              />
            )}
          </div>
        ))}
      </div>
      {status === 'DISPUTED' && (
        <p className="mt-2 text-center text-[11px] text-amber-600">
          {dt('Funds are held while this order is disputed.')}
        </p>
      )}
    </div>
  );
}
