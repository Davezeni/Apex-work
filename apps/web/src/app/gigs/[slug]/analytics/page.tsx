'use client';

import { dt } from '@/i18n/auto';
import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Loader2,
  Eye,
  MessageCircle,
  Package,
  CheckCircle2,
  TrendingUp,
} from 'lucide-react';
import { useMe } from '@/hooks/use-me';
import { useGigAnalytics } from '@/hooks/use-gig-analytics';
import { formatEtb, cn } from '@/lib/utils';
import { safeBack } from '@/lib/safe-back';
/**
 * Freelancer analytics for a single gig. Reads from /v1/gigs/:slug/analytics
 * (owner-only). Shows 5 KPIs + a 30-day sparkline + a funnel.
 */
export default function GigAnalyticsPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const { data: me, isLoading: meLoading, isAuthed } = useMe();
  const { data, isLoading, error } = useGigAnalytics(slug);

  useEffect(() => {
    if (!meLoading && !isAuthed) router.replace('/login?next=/gigs/' + slug + '/analytics');
  }, [meLoading, isAuthed, router, slug]);

  if (isLoading || !me)
    return (
      <div className="grid min-h-dvh place-items-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  if (error)
    return (
      <div className="grid min-h-dvh place-items-center bg-background p-6 text-center text-sm text-muted-foreground">
        You can only view analytics for gigs you own.
      </div>
    );
  if (!data) return null;

  const maxY = Math.max(1, ...data.series.map((s) => s.views));

  return (
    <div className="min-h-dvh bg-background pb-24">
      <header className="safe-top sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 px-3 py-3 backdrop-blur-xl">
        <button
          onClick={() => safeBack(router)}
          aria-label={dt('Back')}
          className="grid h-9 w-9 place-items-center rounded-full active:scale-90"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Analytics · {data.range}
          </div>
          <h1 className="truncate text-sm font-extrabold tracking-tight">{data.gig.title}</h1>
        </div>
      </header>

      {/* KPI grid */}
      <div className="mx-3 mt-4 grid grid-cols-2 gap-2">
        <KPI
          icon={<Eye className="h-4 w-4" />}
          label={dt('Views')}
          value={data.kpis.views.toLocaleString()}
        />
        <KPI
          icon={<MessageCircle className="h-4 w-4" />}
          label={dt('Messages started')}
          value={data.kpis.contacts.toLocaleString()}
        />
        <KPI
          icon={<Package className="h-4 w-4" />}
          label={dt('Orders started')}
          value={data.kpis.starts.toLocaleString()}
        />
        <KPI
          icon={<Package className="h-4 w-4 text-emerald-500" />}
          label={dt('Orders paid')}
          value={data.kpis.orders.toLocaleString()}
        />
        <KPI
          icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />}
          label={dt('Completed')}
          value={data.kpis.completed.toLocaleString()}
        />
        <KPI
          icon={<TrendingUp className="h-4 w-4" />}
          label={dt('Conversion')}
          value={`${data.kpis.contactToOrder}%`}
          sub="msg → paid order"
        />
      </div>

      {/* Sparkline */}
      <section className="mx-3 mt-4 rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <div className="text-sm font-bold">30-day views</div>
          <div className="text-[10px] text-muted-foreground">Total {data.kpis.views}</div>
        </div>
        <svg viewBox="0 0 300 100" className="mt-3 h-24 w-full">
          <defs>
            <linearGradient id="a-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgb(139 92 246)" stopOpacity="0.5" />
              <stop offset="100%" stopColor="rgb(139 92 246)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {(() => {
            const w = 300,
              h = 100;
            const step = data.series.length > 1 ? w / (data.series.length - 1) : w;
            const pts: [number, number][] = data.series.map((s, i) => [
              i * step,
              h - (s.views / maxY) * (h - 8) - 4,
            ]);
            const path = pts
              .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0].toFixed(1)},${p[1].toFixed(1)}`)
              .join(' ');
            const area = `${path} L ${w},${h} L 0,${h} Z`;
            return (
              <>
                <path d={area} fill="url(#a-fill)" />
                <path
                  d={path}
                  fill="none"
                  stroke="rgb(139 92 246)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </>
            );
          })()}
        </svg>
      </section>

      {/* Funnel */}
      <section className="mx-3 mt-4 rounded-2xl border border-border bg-card p-4">
        <div className="text-sm font-bold">{dt('Funnel')}</div>
        <div className="mt-3 space-y-2">
          <FunnelBar label={dt('Views')} value={data.kpis.views} max={data.kpis.views} />
          <FunnelBar label={dt('Contacts')} value={data.kpis.contacts} max={data.kpis.views} />
          <FunnelBar label={dt('Orders started')} value={data.kpis.starts} max={data.kpis.views} />
          <FunnelBar label={dt('Paid')} value={data.kpis.orders} max={data.kpis.views} />
          <FunnelBar label={dt('Completed')} value={data.kpis.completed} max={data.kpis.views} />
        </div>
      </section>
    </div>
  );
}

function KPI({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
      </div>
      <div className="mt-1 text-xl font-extrabold tracking-tight">{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

function FunnelBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex justify-between text-[11px]">
        <span className="font-semibold">{label}</span>
        <span className="text-muted-foreground">{value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className="grad-hero h-full transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
