'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Database, Trash2, Wifi } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n';

/**
 * Data & storage — mostly informational, but lets the user nuke the SW
 * cache when things feel stale or wants to save mobile data. Uses the
 * `navigator.storage.estimate()` API to show real usage numbers.
 */
export default function StoragePage() {
  const router = useRouter();
  const { t } = useI18n();
  const [used, setUsed] = useState<number | null>(null);
  const [quota, setQuota] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof navigator === 'undefined') return;
    if (!('storage' in navigator) || !navigator.storage.estimate) return;
    navigator.storage.estimate().then((e) => {
      setUsed(e.usage ?? null);
      setQuota(e.quota ?? null);
    }).catch(() => undefined);
  }, []);

  const clearCache = async () => {
    setBusy(true);
    try {
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.update()));
      }
      toast.success('Cache cleared');
      const est = await navigator.storage.estimate?.().catch(() => null);
      if (est) { setUsed(est.usage ?? null); setQuota(est.quota ?? null); }
    } catch {
      toast.error('Could not clear cache');
    } finally {
      setBusy(false);
    }
  };

  const pct = used && quota ? Math.min(100, Math.round((used / quota) * 100)) : 0;
  const fmt = (b: number | null): string => {
    if (b == null) return '—';
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / 1024 / 1024).toFixed(1)} MB`;
  };

  return (
    <div className="min-h-dvh bg-background pb-24">
      <header className="safe-top sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 px-3 py-3 backdrop-blur-xl">
        <button onClick={() => router.back()} aria-label={t('common.back')} className="grid h-9 w-9 place-items-center rounded-full active:scale-90">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-extrabold tracking-tight">{t('settings.dataStorage')}</h1>
      </header>

      <section className="mx-3 mt-4 rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-3">
          <Database className="h-5 w-5 text-primary" />
          <div className="flex-1">
            <div className="text-sm font-bold">Cache & offline data</div>
            <div className="text-[11px] text-muted-foreground">
              Apex-Work saves recent pages so it works offline.
            </div>
          </div>
        </div>
        <div className="mt-4">
          <div className="mb-1 flex justify-between text-xs">
            <span className="font-semibold">Using {fmt(used)}</span>
            <span className="text-muted-foreground">of {fmt(quota)}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="grad-hero h-full rounded-full" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={clearCache} disabled={busy} className="mt-4 w-full">
          <Trash2 className="h-4 w-4" /> Clear cache
        </Button>
      </section>

      <section className="mx-3 mt-4 rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-3">
          <Wifi className="h-5 w-5 text-primary" />
          <div className="flex-1">
            <div className="text-sm font-bold">Data saver</div>
            <div className="text-[11px] text-muted-foreground">Serve smaller images on slow connections.</div>
          </div>
          <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] font-bold text-emerald-500">AUTO</span>
        </div>
      </section>
    </div>
  );
}
