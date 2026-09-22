'use client';

/**
 * Recent activity — the user's own slice of the platform audit trail.
 * Shows security + money events that concern this account (deliveries,
 * approvals, payouts, device/PIN/phone changes, automatic escrow releases)
 * newest first. Read-only; backed by GET /v1/me/activity.
 */
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Loader2,
  Banknote,
  CheckCircle2,
  History,
  KeyRound,
  MonitorSmartphone,
  PackageCheck,
  Phone,
  ReceiptText,
  RotateCcw,
  Scale,
  Send,
  Timer,
  XCircle,
  AlertTriangle,
  BadgeCheck,
  type LucideIcon,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import { useMe } from '@/hooks/use-me';
import { useI18n } from '@/i18n';
import { timeAgo } from '@/lib/utils';
import { safeBack } from '@/lib/safe-back';

interface ActivityItem {
  id: string;
  at: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  actorType: string;
  meta: unknown;
}

/** Audit action → icon + locale key. Unknown actions fall back to History. */
const ACTION_MAP: Record<string, { icon: LucideIcon; key: string }> = {
  'ORDER.FUNDED': { icon: ReceiptText, key: 'orderFunded' },
  'ORDER.APPROVED': { icon: CheckCircle2, key: 'orderApproved' },
  'ORDER.DELIVERED': { icon: PackageCheck, key: 'orderDelivered' },
  'ORDER.REVISION_REQUESTED': { icon: RotateCcw, key: 'orderRevision' },
  'ORDER.CANCELLED': { icon: XCircle, key: 'orderCancelled' },
  'ORDER.AUTO_RELEASED': { icon: Timer, key: 'orderAutoReleased' },
  'MILESTONE.DELIVERED': { icon: PackageCheck, key: 'milestoneDelivered' },
  'MILESTONE.APPROVED': { icon: CheckCircle2, key: 'milestoneApproved' },
  'MILESTONE.DISPUTED': { icon: AlertTriangle, key: 'milestoneDisputed' },
  'MILESTONE.AUTO_RELEASED': { icon: Timer, key: 'milestoneAutoReleased' },
  'DISPUTE.OPENED': { icon: Scale, key: 'disputeOpened' },
  'DISPUTE.RESOLVED': { icon: Scale, key: 'disputeResolved' },
  'PAYOUT.REQUESTED': { icon: Banknote, key: 'payoutRequested' },
  'PAYOUT.SENT_TO_PROVIDER': { icon: Send, key: 'payoutSent' },
  'PAYOUT.SUCCEEDED': { icon: BadgeCheck, key: 'payoutSucceeded' },
  'PAYOUT.FAILED': { icon: XCircle, key: 'payoutFailed' },
  'PAYOUT.CANCELLED': { icon: XCircle, key: 'payoutCancelled' },
  'AUTH.PIN_SET': { icon: KeyRound, key: 'pinSet' },
  'AUTH.PIN_REMOVED': { icon: KeyRound, key: 'pinRemoved' },
  'AUTH.PHONE_BOUND': { icon: Phone, key: 'phoneBound' },
  'AUTH.DEVICE_ADDED': { icon: MonitorSmartphone, key: 'deviceAdded' },
};

const ICON_BG = {
  money: 'bg-teal-600/10 text-teal-600',
  ok: 'bg-emerald-500/10 text-emerald-600',
  warn: 'bg-amber-500/10 text-amber-600',
  bad: 'bg-red-500/10 text-red-500',
  neutral: 'bg-muted text-muted-foreground',
} as const;

function toneFor(action: string): string {
  if (/FAILED|CANCELLED|DISPUTED/.test(action)) return ICON_BG.bad;
  if (/APPROVED|SUCCEEDED|DELIVERED/.test(action)) return ICON_BG.ok;
  if (/FUNDED|PAYOUT|SENT/.test(action)) return ICON_BG.money;
  if (/AUTO_RELEASED|REVISION/.test(action)) return ICON_BG.warn;
  return ICON_BG.neutral;
}

export default function ActivityPage() {
  const router = useRouter();
  const { t } = useI18n();
  const token = useAuthStore((s) => s.accessToken);
  const { isLoading: meLoading, isAuthed } = useMe();

  useEffect(() => {
    if (!meLoading && !isAuthed) router.replace('/login?next=/settings/activity');
  }, [meLoading, isAuthed, router]);

  const { data, isLoading } = useQuery<{ items: ActivityItem[] }>({
    queryKey: ['activity'],
    queryFn: () => apiFetch('/me/activity', { token }),
    enabled: !!token,
  });

  const items = data?.items ?? [];

  return (
    <div className="min-h-dvh bg-background pb-24">
      <header className="safe-top sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 px-3 py-3 backdrop-blur-xl">
        <button
          onClick={() => safeBack(router)}
          aria-label={t('common.back')}
          className="grid h-9 w-9 place-items-center rounded-full active:scale-90"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-extrabold tracking-tight">{t('activity.title')}</h1>
      </header>

      <section className="mx-3 mt-4">
        <p className="mb-4 rounded-2xl border border-border bg-card p-3 text-xs leading-relaxed text-muted-foreground">
          {t('activity.subtitle')}
        </p>

        {isLoading ? (
          <div className="grid h-40 place-items-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center">
            <History className="mx-auto h-8 w-8 text-muted-foreground opacity-60" />
            <p className="mt-2 text-sm font-semibold">{t('activity.empty')}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t('activity.emptyBody')}</p>
          </div>
        ) : (
          <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
            {items.map((item) => {
              const conf = ACTION_MAP[item.action] ?? { icon: History, key: 'updated' };
              const Icon = conf.icon;
              const isSystem = item.actorType === 'SYSTEM';
              return (
                <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                  <span
                    className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${toneFor(item.action)}`}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold">{t(`activity.${conf.key}`)}</span>
                      {isSystem ? (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                          {t('activity.system')}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{timeAgo(item.at)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
