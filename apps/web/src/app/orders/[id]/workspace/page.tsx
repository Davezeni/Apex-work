'use client';

import { dt } from '@/i18n/auto';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  FileText,
  Loader2,
  MessageCircle,
  Milestone,
  Package,
  WalletCards,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { MilestonePanel } from '@/components/orders/milestone-panel';
import { useMe } from '@/hooks/use-me';
import { useOrder, type OrderStatus } from '@/hooks/use-orders';
import { useStartConversation } from '@/hooks/use-chat';
import { cn, formatEtb } from '@/lib/utils';
const statusLabels: Record<OrderStatus, string> = {
  PENDING: 'Awaiting payment',
  ACTIVE: 'In progress',
  IN_REVIEW: 'In review',
  DELIVERED: 'Delivered',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  DISPUTED: 'Disputed',
};

export default function ProjectWorkspacePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: me } = useMe();
  const { data: order, isLoading, error } = useOrder(id);
  const startConversation = useStartConversation();

  if (isLoading || !order || !me)
    return (
      <div className="grid min-h-dvh place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  if (error)
    return (
      <div className="grid min-h-dvh place-items-center p-6 text-center">
        <p className="text-sm">{dt('Project workspace unavailable.')}</p>
        <Button asChild variant="brand" className="mt-4">
          <Link href="/orders">{dt('Back to orders')}</Link>
        </Button>
      </div>
    );

  const isSeller = me.id === order.seller.id;
  const other = isSeller ? order.client : order.seller;
  const canUseMilestones = !['PENDING', 'CANCELLED'].includes(order.status);
  const openChat = async () => {
    try {
      const conversation = await startConversation.mutateAsync(other.id);
      router.push(`/messages/${conversation.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not open project chat');
    }
  };

  return (
    <div className="min-h-dvh bg-background pb-10">
      <header className="safe-top sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-background/95 px-3 py-3 backdrop-blur-xl">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label={dt('Back')}
          className="grid h-9 w-9 place-items-center rounded-full active:scale-90"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Project workspace
          </div>
          <h1 className="truncate text-lg font-extrabold">{order.title}</h1>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={openChat}
          disabled={startConversation.isPending}
        >
          <MessageCircle className="h-4 w-4" /> Chat
        </Button>
        <Button asChild size="sm" variant="brand">
          <Link href={`/orders/${order.id}`}>{dt('Order')}</Link>
        </Button>
      </header>

      <main className="mx-auto max-w-5xl px-3 py-5 sm:px-6">
        <section className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest',
                  order.status === 'COMPLETED'
                    ? 'bg-emerald-500/10 text-emerald-600'
                    : 'bg-primary/10 text-primary',
                )}
              >
                {order.status === 'COMPLETED' ? (
                  <CheckCircle2 className="h-3 w-3" />
                ) : (
                  <Clock3 className="h-3 w-3" />
                )}{' '}
                {statusLabels[order.status]}
              </span>
              <h2 className="mt-3 text-2xl font-black tracking-tight">
                One place for the whole project.
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Keep requirements, milestones, delivery files, conversations and escrow context
                together.
              </p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-black">{formatEtb(order.amountEtb)}</div>
              <div className="text-[11px] text-muted-foreground">
                Order #{order.orderNumber.slice(0, 12)}
              </div>
            </div>
          </div>
          <div className="mt-5 grid gap-2 sm:grid-cols-4">
            <WorkspaceKpi
              icon={<WalletCards className="h-4 w-4" />}
              label={dt('Escrow')}
              value={
                order.payments[0]?.status === 'SUCCESS'
                  ? 'Funded'
                  : order.status === 'PENDING'
                    ? 'Pending'
                    : 'Protected'
              }
            />
            <WorkspaceKpi
              icon={<Clock3 className="h-4 w-4" />}
              label={dt('Deadline')}
              value={order.deadline ? new Date(order.deadline).toLocaleDateString() : 'Not set'}
            />
            <WorkspaceKpi
              icon={<Package className="h-4 w-4" />}
              label={dt('Delivery')}
              value={order.deliveredAt ? 'Delivered' : 'In progress'}
            />
            <WorkspaceKpi
              icon={<MessageCircle className="h-4 w-4" />}
              label={dt('Partner')}
              value={other.fullName}
            />
          </div>
        </section>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
          <div className="space-y-4">
            <WorkspaceCard icon={<FileText className="h-4 w-4" />} title={dt('Requirements')}>
              <div className="whitespace-pre-line rounded-xl bg-background p-3 text-sm leading-relaxed">
                {order.requirements ||
                  'No written requirements were added yet. Use project chat to confirm scope before work begins.'}
              </div>
            </WorkspaceCard>
            <WorkspaceCard icon={<Package className="h-4 w-4" />} title={dt('Delivery files')}>
              <div className="rounded-xl bg-background p-3 text-sm">
                {order.deliverables?.files?.length ? (
                  <ul className="space-y-2">
                    {order.deliverables.files.map((file) => (
                      <li key={file}>
                        <a
                          href={file}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 text-primary underline"
                        >
                          <FileText className="h-4 w-4" /> Download delivery
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-muted-foreground">{dt('No delivery files yet.')}</span>
                )}
                {order.deliverables?.notes && (
                  <p className="mt-3 whitespace-pre-line text-xs text-muted-foreground">
                    {order.deliverables.notes}
                  </p>
                )}
              </div>
            </WorkspaceCard>
          </div>
          <div className="space-y-4">
            <WorkspaceCard
              icon={<MessageCircle className="h-4 w-4" />}
              title={dt('Project communication')}
            >
              <p className="text-xs leading-relaxed text-muted-foreground">
                Use one conversation for scope decisions, feedback, files and handover. This keeps
                the project history clear for both sides and support.
              </p>
              <Button
                type="button"
                variant="brand"
                className="mt-3 w-full"
                onClick={openChat}
                disabled={startConversation.isPending}
              >
                <MessageCircle className="h-4 w-4" /> Open project chat
              </Button>
            </WorkspaceCard>
            <WorkspaceCard
              icon={<Milestone className="h-4 w-4" />}
              title={dt('Escrow and milestones')}
            >
              <p className="text-xs leading-relaxed text-muted-foreground">
                Break larger work into checkpoints. Approvals release each milestone through the
                existing escrow workflow.
              </p>
              {canUseMilestones ? (
                <MilestonePanel
                  orderId={order.id}
                  amountEtb={order.amountEtb}
                  isClient={!isSeller}
                  isSeller={isSeller}
                  orderStatus={order.status}
                />
              ) : (
                <div className="mt-3 rounded-xl bg-background p-3 text-xs text-muted-foreground">
                  Milestones become available after payment is confirmed.
                </div>
              )}
            </WorkspaceCard>
          </div>
        </div>

        <section className="mt-4 rounded-2xl border border-border bg-card p-4">
          <h2 className="text-sm font-extrabold">{dt('Project checklist')}</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <Checklist done={!!order.requirements} label={dt('Scope confirmed')} />
            <Checklist
              done={!!order.payments[0] && order.payments[0].status === 'SUCCESS'}
              label={dt('Payment protected')}
            />
            <Checklist done={!!order.deliveredAt} label={dt('First delivery')} />
          </div>
        </section>
      </main>
    </div>
  );
}

function WorkspaceKpi({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-background p-3">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
      </div>
      <div className="mt-1 truncate text-sm font-bold">{value}</div>
    </div>
  );
}
function WorkspaceCard({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <h2 className="flex items-center gap-2 text-sm font-extrabold">
        <span className="text-primary">{icon}</span>
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}
function Checklist({ done, label }: { done: boolean; label: string }) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-xl border p-3 text-xs font-semibold',
        done
          ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-600'
          : 'border-border text-muted-foreground',
      )}
    >
      {done ? <CheckCircle2 className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}
      {label}
    </div>
  );
}
