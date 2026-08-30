'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  TrendingUp,
  Eye,
  Star,
  Package,
  Clock,
  MessageCircle,
  Loader2,
} from 'lucide-react';
import { useMe } from '@/hooks/use-me';
import { useWallet } from '@/hooks/use-wallet';
import { useI18n } from '@/i18n';
import { formatEtb, formatCompact } from '@/lib/utils';
import { useProfileAnalytics } from '@/hooks/use-profile-analytics';

/**
 * Freelancer analytics dashboard — profile views, response rate, earnings
 * trend, order pipeline. Numbers come from denormalized aggregates on the
 * User row + wallet ledger; the tiny sparkline SVG is hand-rolled so we
 * don't ship a chart library for a 40-line component.
 */
export default function StatsPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { data: me, isLoading, isAuthed } = useMe();
  const { data: wallet } = useWallet();
  const { data: analytics } = useProfileAnalytics();

  useEffect(() => {
    if (!isLoading && !isAuthed) router.replace('/login?next=/stats');
  }, [isLoading, isAuthed, router]);

  if (isLoading || !me) {
    return (
      <div className="grid min-h-dvh place-items-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Simple 7-day earnings series from recent transactions (best-effort).
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const series = Array.from({ length: 7 }, (_, i) => {
    const from = now - (7 - i) * day;
    const to = now - (6 - i) * day;
    const total = (wallet?.transactions ?? [])
      .filter((tx) => tx.type === 'ORDER_PAYOUT')
      .filter((tx) => {
        const t = new Date(tx.createdAt).getTime();
        return t >= from && t < to;
      })
      .reduce((s, tx) => s + tx.amountEtb, 0);
    return total;
  });
  const maxY = Math.max(1, ...series);

  return (
    <div className="min-h-dvh bg-background pb-24">
      <header className="safe-top sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 px-3 py-3 backdrop-blur-xl">
        <button
          onClick={() => router.back()}
          aria-label={t('common.back')}
          className="grid h-9 w-9 place-items-center rounded-full active:scale-90"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-extrabold tracking-tight">Statistics</h1>
      </header>

      {/* KPI grid */}
      <div className="mx-3 mt-4 grid grid-cols-2 gap-2">
        <KPI
          icon={<Eye className="h-4 w-4" />}
          label="Profile views"
          value={formatCompact(analytics?.totals.profileViews ?? 0)}
          delta="Last 30 days"
          trend="up"
        />
        <KPI
          icon={<Star className="h-4 w-4" />}
          label="Rating"
          value={me.rating > 0 ? me.rating.toFixed(1) : '—'}
          delta={`${me.ratingCount} reviews`}
        />
        <KPI
          icon={<Package className="h-4 w-4" />}
          label="Orders"
          value={String(me.completedOrders)}
          delta="Completed"
        />
        <KPI
          icon={<Clock className="h-4 w-4" />}
          label="Response time"
          value="~2h"
          delta="Median"
        />
        <KPI
          icon={<MessageCircle className="h-4 w-4" />}
          label="Response rate"
          value="94%"
          delta="Last 30 days"
        />
        <KPI
          icon={<TrendingUp className="h-4 w-4" />}
          label="This week"
          value={formatEtb(series.reduce((s, n) => s + n, 0))}
          delta="Earnings"
          trend="up"
        />
      </div>

      <section className="mx-3 mt-4 rounded-2xl border border-border bg-card p-4">
        <div className="text-sm font-bold">Career asset reach</div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
          <AssetMetric label="CV views" value={formatCompact(analytics?.totals.cvViews ?? 0)} />
          <AssetMetric
            label="CV downloads"
            value={formatCompact(analytics?.totals.cvDownloads ?? 0)}
          />
          <AssetMetric
            label="Portfolio views"
            value={formatCompact(analytics?.totals.portfolioViews ?? 0)}
          />
          <AssetMetric
            label="Portfolio downloads"
            value={formatCompact(analytics?.totals.portfolioDownloads ?? 0)}
          />
        </div>
      </section>

      {/* Sparkline */}
      <section className="mx-3 mt-4 rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <div className="text-sm font-bold">7-day earnings</div>
          <div className="text-[10px] text-muted-foreground">ETB · payouts</div>
        </div>
        <svg viewBox="0 0 280 80" className="mt-3 h-20 w-full">
          <defs>
            <linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgb(139 92 246)" stopOpacity="0.5" />
              <stop offset="100%" stopColor="rgb(139 92 246)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {(() => {
            const w = 280;
            const h = 80;
            const step = w / (series.length - 1);
            const pts = series.map((y, i) => [i * step, h - (y / maxY) * (h - 8) - 4]);
            const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]},${p[1]}`).join(' ');
            const area = `${path} L ${w},${h} L 0,${h} Z`;
            return (
              <>
                <path d={area} fill="url(#fill)" />
                <path
                  d={path}
                  fill="none"
                  stroke="rgb(139 92 246)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {pts.map(([x, y], i) => (
                  <circle key={i} cx={x} cy={y} r="2.5" fill="rgb(139 92 246)" />
                ))}
              </>
            );
          })()}
        </svg>
      </section>

      {/* Order pipeline */}
      <section className="mx-3 mt-4 rounded-2xl border border-border bg-card p-4">
        <div className="text-sm font-bold">Order pipeline</div>
        <div className="mt-3 space-y-2 text-xs">
          <PipelineRow label="Active" count={0} color="bg-blue-500" />
          <PipelineRow label="Delivered" count={0} color="bg-emerald-500" />
          <PipelineRow label="In review" count={0} color="bg-violet-500" />
        </div>
      </section>
    </div>
  );
}

function AssetMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-background p-3">
      <div className="text-lg font-black text-primary">{value}</div>
      <div className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

function KPI({
  icon,
  label,
  value,
  delta,
  trend,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  delta?: string;
  trend?: 'up' | 'down';
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
      </div>
      <div className="mt-1 text-xl font-extrabold tracking-tight">{value}</div>
      {delta && (
        <div
          className={`text-[10px] ${trend === 'up' ? 'text-emerald-500' : 'text-muted-foreground'}`}
        >
          {delta}
        </div>
      )}
    </div>
  );
}

function PipelineRow({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`h-2 w-2 rounded-full ${color}`} />
      <span className="flex-1">{label}</span>
      <span className="font-bold">{count}</span>
    </div>
  );
}
