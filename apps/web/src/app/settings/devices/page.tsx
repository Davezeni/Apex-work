'use client';

import { dt } from '@/i18n/auto';
/**
 * Signed-in devices management. Lists every trusted device (browser +
 * OS parsed from user-agent) with when it last connected and where.
 * Users can revoke a single device (kicks that browser out on next request)
 * or nuke every session in one tap.
 *
 * Backed by:
 *   GET    /v1/me/devices        — list active devices
 *   DELETE /v1/me/devices/:id    — revoke one
 *   POST   /v1/me/devices/revoke-all — revoke all
 */
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2, Monitor, Smartphone, Tablet, ShieldOff, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import { useMe } from '@/hooks/use-me';
import { useI18n } from '@/i18n';
import { Button } from '@/components/ui/button';
import { timeAgo } from '@/lib/utils';
interface Device {
  id: string;
  label: string | null;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
}

function deviceIcon(ua: string | null | undefined) {
  const u = (ua ?? '').toLowerCase();
  if (/ipad|tablet/.test(u)) return Tablet;
  if (/mobi|iphone|android/.test(u)) return Smartphone;
  return Monitor;
}

function parseLabel(d: Device): string {
  if (d.label) return d.label;
  const ua = d.userAgent ?? '';
  const os = /iphone|ios/i.test(ua)
    ? 'iOS'
    : /android/i.test(ua)
      ? 'Android'
      : /windows/i.test(ua)
        ? 'Windows'
        : /mac os|macintosh/i.test(ua)
          ? 'macOS'
          : /linux/i.test(ua)
            ? 'Linux'
            : 'Unknown';
  const browser = /edg\//i.test(ua)
    ? 'Edge'
    : /chrome/i.test(ua)
      ? 'Chrome'
      : /firefox/i.test(ua)
        ? 'Firefox'
        : /safari/i.test(ua)
          ? 'Safari'
          : 'Browser';
  return `${os} · ${browser}`;
}

export default function DevicesPage() {
  const router = useRouter();
  const { t } = useI18n();
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  const { isLoading: meLoading, isAuthed } = useMe();

  useEffect(() => {
    if (!meLoading && !isAuthed) router.replace('/login?next=/settings/devices');
  }, [meLoading, isAuthed, router]);

  const { data, isLoading } = useQuery<{ items: Device[] }>({
    queryKey: ['devices'],
    queryFn: () => apiFetch('/me/devices', { token }),
    enabled: !!token,
  });

  const revoke = useMutation({
    mutationFn: (id: string) => apiFetch(`/me/devices/${id}`, { method: 'DELETE', token }),
    onSuccess: () => {
      toast.success(dt('Device revoked'));
      qc.invalidateQueries({ queryKey: ['devices'] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const revokeAll = useMutation({
    mutationFn: () => apiFetch('/me/devices/revoke-all', { method: 'POST', token }),
    onSuccess: (r: unknown) => {
      const n = (r as { revoked?: number }).revoked ?? 0;
      toast.success(`Revoked ${n} device${n === 1 ? '' : 's'}`);
      qc.invalidateQueries({ queryKey: ['devices'] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const items = data?.items ?? [];

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
        <h1 className="text-lg font-extrabold tracking-tight">{dt('Active devices')}</h1>
      </header>

      <section className="mx-3 mt-4">
        <p className="mb-4 rounded-2xl border border-border bg-card p-3 text-xs leading-relaxed text-muted-foreground">
          These are browsers or apps currently signed in to your Apex-Work account. Tap the trash
          icon on any row to sign it out immediately.
        </p>

        {isLoading ? (
          <div className="grid h-40 place-items-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center">
            <Monitor className="mx-auto h-8 w-8 text-muted-foreground opacity-60" />
            <p className="mt-2 text-sm font-semibold">{dt('No trusted devices yet')}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Sign in with &ldquo;Remember me&rdquo; ticked and this device will show up here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
            {items.map((d) => {
              const Icon = deviceIcon(d.userAgent);
              return (
                <div key={d.id} className="flex items-start gap-3 px-4 py-3.5">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{parseLabel(d)}</div>
                    <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                      {d.ipAddress ?? '—'} · last active {timeAgo(d.lastUsedAt)}
                    </div>
                    <div className="mt-0.5 text-[10px] text-muted-foreground">
                      Expires {new Date(d.expiresAt).toLocaleDateString()}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      if (window.confirm('Sign this device out?')) revoke.mutate(d.id);
                    }}
                    disabled={revoke.isPending}
                    aria-label={dt('Revoke device')}
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-500 disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {items.length > 0 && (
          <Button
            variant="outline"
            className="mt-4 w-full border-red-500/40 text-red-500 hover:bg-red-500/10"
            disabled={revokeAll.isPending}
            onClick={() => {
              if (
                window.confirm(
                  'Sign out of every device? You will need to sign in again on all your browsers.',
                )
              ) {
                revokeAll.mutate();
              }
            }}
          >
            {revokeAll.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ShieldOff className="mr-2 h-4 w-4" />
            )}
            Sign out of all devices
          </Button>
        )}
      </section>
    </div>
  );
}
