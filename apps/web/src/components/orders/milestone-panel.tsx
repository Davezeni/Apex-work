'use client';

import { dt } from '@/i18n/auto';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, Clock, AlertCircle, Loader2, Plus, Trash2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  useMilestones,
  useSetMilestones,
  useMilestoneAction,
  type Milestone,
} from '@/hooks/use-milestones';
import { cn, formatEtb } from '@/lib/utils';
interface Props {
  orderId: string;
  amountEtb: number;
  isClient: boolean;
  isSeller: boolean;
  orderStatus: string;
}

/**
 * Milestones UI. Everyone sees the plan; the client can (re)plan while
 * the order hasn't started fund-flow. Freelancer marks delivered; client
 * approves to release each slice of escrow.
 */
export function MilestonePanel({ orderId, amountEtb, isClient, isSeller, orderStatus }: Props) {
  const { data, isLoading } = useMilestones(orderId);
  const setPlan = useSetMilestones(orderId);
  const action = useMilestoneAction(orderId);

  const [planning, setPlanning] = useState(false);
  const [drafts, setDrafts] = useState<
    { title: string; amount: string; dueDate: string; description: string }[]
  >([]);

  useEffect(() => {
    if (planning && drafts.length === 0) {
      // Seed with a single milestone equal to the whole order.
      setDrafts([
        { title: 'Full delivery', amount: String(amountEtb), dueDate: '', description: '' },
      ]);
    }
  }, [planning, drafts.length, amountEtb]);

  const canPlan =
    isClient &&
    (orderStatus === 'PENDING' || orderStatus === 'ACTIVE') &&
    !(data?.items ?? []).some((m) => m.status === 'APPROVED');

  const items = data?.items ?? [];
  const total = items.reduce((a, m) => a + m.amountEtb, 0);
  const paid = items.filter((m) => m.status === 'APPROVED').reduce((a, m) => a + m.amountEtb, 0);

  const submitPlan = async () => {
    if (drafts.some((d) => !d.title.trim() || !d.amount))
      return toast.error(dt('Fill every milestone'));
    const sum = drafts.reduce((a, d) => a + Number(d.amount || 0), 0);
    if (sum !== amountEtb)
      return toast.error(`Amounts must sum to ${formatEtb(amountEtb)} — got ${formatEtb(sum)}`);
    try {
      await setPlan.mutateAsync(
        drafts.map((d) => ({
          title: d.title.trim(),
          amountEtb: Number(d.amount),
          description: d.description.trim() || null,
          dueDate: d.dueDate ? new Date(d.dueDate).toISOString() : null,
        })),
      );
      setPlanning(false);
      setDrafts([]);
      toast.success(dt('Milestones saved'));
    } catch (err) {
      toast.error((err as { message?: string }).message ?? 'Save failed');
    }
  };

  if (isLoading) {
    return (
      <div className="grid h-20 place-items-center">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-extrabold uppercase tracking-widest text-muted-foreground">
            {dt('Milestones')}
          </h3>
          {items.length > 0 && (
            <div className="mt-1 text-[11px] text-muted-foreground">
              {formatEtb(paid)} of {formatEtb(total)} released
            </div>
          )}
        </div>
        {canPlan && !planning && (
          <Button size="sm" variant="outline" onClick={() => setPlanning(true)}>
            {items.length > 0 ? 'Edit plan' : 'Add milestones'}
          </Button>
        )}
      </div>

      {items.length > 0 && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="grad-hero h-full transition-all"
            style={{ width: `${(paid / (total || 1)) * 100}%` }}
          />
        </div>
      )}

      {!planning && (
        <div className="mt-3 space-y-2">
          {items.map((m, i) => (
            <MilestoneRow
              key={m.id}
              index={i + 1}
              m={m}
              busy={action.isPending}
              canDeliver={isSeller && (m.status === 'PENDING' || m.status === 'DISPUTED')}
              canApprove={isClient && m.status === 'DELIVERED'}
              canDispute={(isClient || isSeller) && m.status !== 'APPROVED'}
              onDeliver={() => action.mutate({ id: m.id, action: 'deliver' })}
              onApprove={() => {
                if (!window.confirm(`Release ${formatEtb(m.amountEtb)} to the freelancer?`)) return;
                action.mutate({ id: m.id, action: 'approve' });
              }}
              onDispute={() => {
                const reason = window.prompt('Briefly describe the issue');
                if (!reason) return;
                action.mutate({ id: m.id, action: 'dispute', reason });
              }}
            />
          ))}
          {items.length === 0 && (
            <p className="mt-2 text-center text-xs text-muted-foreground">
              No milestones yet — the client can plan them here.
            </p>
          )}
        </div>
      )}

      {planning && (
        <div className="mt-3 space-y-3">
          {drafts.map((d, i) => (
            <div
              key={i}
              className="rounded-xl border border-dashed border-primary/30 bg-primary/5 p-3"
            >
              <div className="flex items-center gap-2">
                <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary text-[10px] font-bold text-white">
                  {i + 1}
                </div>
                <input
                  value={d.title}
                  onChange={(e) =>
                    setDrafts(drafts.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))
                  }
                  placeholder={dt('Milestone title')}
                  className="flex-1 rounded-lg border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-primary"
                  maxLength={140}
                />
                {drafts.length > 1 && (
                  <button
                    onClick={() => setDrafts(drafts.filter((_, j) => j !== i))}
                    aria-label={dt('Remove')}
                    className="grid h-7 w-7 place-items-center rounded-full text-red-500"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <input
                  value={d.amount}
                  onChange={(e) =>
                    setDrafts(
                      drafts.map((x, j) =>
                        j === i ? { ...x, amount: e.target.value.replace(/[^0-9]/g, '') } : x,
                      ),
                    )
                  }
                  inputMode="numeric"
                  placeholder={dt('Amount (ETB)')}
                  className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-primary"
                />
                <input
                  type="date"
                  value={d.dueDate}
                  onChange={(e) =>
                    setDrafts(
                      drafts.map((x, j) => (j === i ? { ...x, dueDate: e.target.value } : x)),
                    )
                  }
                  className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-primary"
                />
              </div>
              <textarea
                value={d.description}
                onChange={(e) =>
                  setDrafts(
                    drafts.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)),
                  )
                }
                rows={2}
                placeholder={dt("What's delivered? (optional)")}
                className="mt-2 w-full resize-none rounded-lg border border-border bg-background p-2 text-xs outline-none focus:border-primary"
                maxLength={2000}
              />
            </div>
          ))}
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              onClick={() =>
                setDrafts([...drafts, { title: '', amount: '', dueDate: '', description: '' }])
              }
              disabled={drafts.length >= 20}
            >
              <Plus className="h-3.5 w-3.5" /> Add
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              onClick={() => {
                setPlanning(false);
                setDrafts([]);
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              variant="brand"
              className="flex-1"
              onClick={submitPlan}
              disabled={setPlan.isPending}
            >
              {setPlan.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Save'}
            </Button>
          </div>
          <p className="text-center text-[11px] text-muted-foreground">
            Must sum to {formatEtb(amountEtb)} · current:{' '}
            {formatEtb(drafts.reduce((a, d) => a + Number(d.amount || 0), 0))}
          </p>
        </div>
      )}
    </section>
  );
}

function MilestoneRow({
  index,
  m,
  busy,
  canDeliver,
  canApprove,
  canDispute,
  onDeliver,
  onApprove,
  onDispute,
}: {
  index: number;
  m: Milestone;
  busy: boolean;
  canDeliver: boolean;
  canApprove: boolean;
  canDispute: boolean;
  onDeliver: () => void;
  onApprove: () => void;
  onDispute: () => void;
}) {
  const statusMeta = {
    PENDING: {
      icon: <Clock className="h-3.5 w-3.5" />,
      cls: 'bg-muted text-muted-foreground',
      label: 'Pending',
    },
    DELIVERED: {
      icon: <Send className="h-3.5 w-3.5" />,
      cls: 'bg-amber-500/10 text-amber-500',
      label: 'Delivered',
    },
    APPROVED: {
      icon: <CheckCircle2 className="h-3.5 w-3.5" />,
      cls: 'bg-emerald-500/10 text-emerald-500',
      label: 'Paid',
    },
    DISPUTED: {
      icon: <AlertCircle className="h-3.5 w-3.5" />,
      cls: 'bg-red-500/10 text-red-500',
      label: 'Disputed',
    },
  }[m.status];
  return (
    <div
      className={cn(
        'rounded-xl border p-3',
        m.status === 'APPROVED' ? 'border-emerald-500/30' : 'border-border',
      )}
    >
      <div className="flex items-start gap-2">
        <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-muted text-[10px] font-bold">
          {index}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="truncate text-sm font-bold">{m.title}</div>
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold',
                statusMeta.cls,
              )}
            >
              {statusMeta.icon}
              {statusMeta.label}
            </span>
          </div>
          {m.description && <p className="mt-1 text-xs text-muted-foreground">{m.description}</p>}
          <div className="mt-1 text-[11px]">
            <span className="font-extrabold text-primary">{formatEtb(m.amountEtb)}</span>
            {m.dueDate && (
              <span className="text-muted-foreground">
                {' '}
                · due {new Date(m.dueDate).toLocaleDateString()}
              </span>
            )}
          </div>
          {(canDeliver || canApprove || canDispute) && (
            <div className="mt-2 flex gap-2">
              {canDeliver && (
                <Button size="sm" variant="brand" onClick={onDeliver} disabled={busy}>
                  <Send className="h-3 w-3" /> Mark delivered
                </Button>
              )}
              {canApprove && (
                <Button size="sm" variant="brand" onClick={onApprove} disabled={busy}>
                  <CheckCircle2 className="h-3 w-3" /> Approve · release
                </Button>
              )}
              {canDispute && (
                <Button size="sm" variant="outline" onClick={onDispute} disabled={busy}>
                  Dispute
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
