'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Calendar, Clock, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/utils';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HOURS = ['06', '08', '10', '12', '14', '16', '18', '20', '22'];

type WeekMap = Record<string, boolean[]>;

const STORAGE = 'apex-availability-v1';
const DEFAULT: WeekMap = Object.fromEntries(
  DAYS.map((d) => [d, HOURS.map((_, i) => i >= 1 && i <= 6 && d !== 'Sat' && d !== 'Sun')] as [string, boolean[]]),
);

export default function AvailabilityPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [grid, setGrid] = useState<WeekMap>(DEFAULT);
  const [vacation, setVacation] = useState(false);
  const [saving, setSaving] = useState(false);
  const token = useAuthStore((s) => s.accessToken);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE);
      if (raw) {
        const parsed = JSON.parse(raw);
        setGrid(parsed.grid ?? DEFAULT);
        setVacation(parsed.vacation ?? false);
      }
    } catch { /* ignore */ }
  }, []);

  const toggle = (day: string, hour: number) => {
    setGrid((g) => {
      const row = g[day] ?? HOURS.map(() => false);
      return { ...g, [day]: row.map((v, i) => (i === hour ? !v : v)) };
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      localStorage.setItem(STORAGE, JSON.stringify({ grid, vacation }));
      // Also persist server-side so it appears on the public profile.
      await apiFetch('/me/availability', {
        method: 'PATCH', token,
        body: { hours: grid, vacation, timezone: 'Africa/Addis_Ababa' },
      }).catch(() => undefined);
      toast.success('Availability saved');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-dvh bg-background pb-24">
      <header className="safe-top sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 px-3 py-3 backdrop-blur-xl">
        <button onClick={() => router.back()} aria-label={t('common.back')} className="grid h-9 w-9 place-items-center rounded-full active:scale-90">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-extrabold tracking-tight">Availability</h1>
      </header>

      <section className="mx-3 mt-4 rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-3">
          <Calendar className="h-5 w-5 text-primary" />
          <div className="flex-1">
            <div className="text-sm font-bold">Vacation mode</div>
            <div className="text-[11px] text-muted-foreground">Pause new orders while you&rsquo;re away.</div>
          </div>
          <button
            onClick={() => setVacation((v) => !v)}
            className={cn('h-6 w-11 rounded-full transition-colors', vacation ? 'bg-primary' : 'bg-muted')}
            aria-pressed={vacation}
          >
            <span className={cn('block h-5 w-5 translate-x-0.5 rounded-full bg-white transition-transform', vacation && 'translate-x-5')} />
          </button>
        </div>
      </section>

      <section className="mx-3 mt-4">
        <h2 className="mb-2 flex items-center gap-1 px-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
          <Clock className="h-3 w-3" /> Weekly schedule
        </h2>
        <div className="overflow-x-auto rounded-2xl border border-border bg-card p-3">
          <table className="min-w-full text-center text-[11px]">
            <thead>
              <tr>
                <th className="w-12" />
                {HOURS.map((h) => <th key={h} className="w-9 py-1 font-semibold text-muted-foreground">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {DAYS.map((d) => {
                const row = grid[d] ?? [];
                return (
                  <tr key={d}>
                    <td className="pr-2 text-right text-xs font-bold">{d}</td>
                    {HOURS.map((h, i) => (
                      <td key={i}>
                        <button
                          onClick={() => toggle(d, i)}
                          className={cn(
                            'my-0.5 h-7 w-7 rounded-md transition-colors',
                            row[i] ? 'bg-primary' : 'bg-muted hover:bg-muted-foreground/20',
                          )}
                          aria-label={`${d} ${h}h ${row[i] ? 'available' : 'unavailable'}`}
                        />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <div className="safe-bottom fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 px-4 pb-4 pt-3 backdrop-blur-xl">
        <Button variant="brand" size="lg" className="w-full" onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save schedule'}
        </Button>
      </div>
    </div>
  );
}
