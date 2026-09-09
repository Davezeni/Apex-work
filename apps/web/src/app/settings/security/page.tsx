'use client';

import { dt } from '@/i18n/auto';
import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Fingerprint,
  KeyRound,
  LockKeyhole,
  Loader2,
  Monitor,
  Smartphone,
  Trash2,
  Plus,
  LogOut,
  ShieldAlert,
  ChevronRight,
  Download,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMe } from '@/hooks/use-me';
import {
  useMyDevices,
  useMyPasskeys,
  useRevokeAllDevices,
  useRevokeDevice,
  useDeletePasskey,
  useRemovePin,
} from '@/hooks/use-security';
import { apiFetch, downloadViaAuth } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import { startRegistration } from '@simplewebauthn/browser';
import { timeAgo } from '@/lib/utils';
import { useQueryClient } from '@tanstack/react-query';
import { useI18n } from '@/i18n';
export default function SecuritySettingsPage() {
  const router = useRouter();
  const { data: me, isLoading } = useMe();
  const devices = useMyDevices();
  const passkeys = useMyPasskeys();
  const revokeAllDevices = useRevokeAllDevices();
  const { t } = useI18n();

  useEffect(() => {
    if (!isLoading && !me) router.replace('/login?next=/settings/security');
  }, [isLoading, me, router]);

  if (isLoading || !me) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const hasPin = me.hasPin;
  const hasPasskeys = (passkeys.data?.items.length ?? 0) > 0;

  return (
    <div className="min-h-dvh bg-background pb-16">
      <header className="safe-top sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 px-3 py-3 backdrop-blur-xl">
        <button
          onClick={() => router.back()}
          aria-label={t('common.back')}
          className="grid h-9 w-9 place-items-center rounded-full active:scale-90"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-extrabold tracking-tight">{t('security.title')}</h1>
      </header>

      {/* Sign-in methods */}
      <Section title={t('security.signInMethods')}>
        <SettingRow
          icon={<LockKeyhole className="h-4 w-4" />}
          title={dt('PIN')}
          subtitle={hasPin ? t('security.pinChange') : t('security.pinAdd')}
          href="/settings/pin?next=/settings/security"
          cta={hasPin ? t('security.change') : t('security.add')}
        />
        <PasskeyControl hasAny={hasPasskeys} />
      </Section>

      {/* Passkey list */}
      {passkeys.data && passkeys.data.items.length > 0 && (
        <Section title={`${t('security.yourPasskeys')} · ${passkeys.data.items.length}`}>
          {passkeys.data.items.map((p) => (
            <PasskeyRow key={p.id} p={p} />
          ))}
        </Section>
      )}

      {/* Devices */}
      <Section
        title={`${t('security.trustedDevices')} · ${devices.data?.items.length ?? 0}`}
        action={
          (devices.data?.items.length ?? 0) > 0 && (
            <button
              onClick={() => {
                if (!window.confirm(t('security.signOutAllConfirm'))) return;
                revokeAllDevices.mutate(undefined, {
                  onSuccess: () => toast.success(t('security.revoked')),
                });
              }}
              disabled={revokeAllDevices.isPending}
              className="flex items-center gap-1 text-xs font-semibold text-destructive"
            >
              <LogOut className="h-3.5 w-3.5" /> {t('security.signOutAll')}
            </button>
          )
        }
      >
        {devices.isLoading && (
          <div className="grid h-16 place-items-center">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}
        {devices.data?.items.length === 0 && (
          <p className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
            {t('security.noDevices')}
          </p>
        )}
        {devices.data?.items.map((d) => (
          <DeviceRow key={d.id} d={d} />
        ))}
      </Section>

      {/* Danger zone */}
      <Section title={dt('Data & privacy')}>
        <SettingRow
          icon={<Download className="h-4 w-4 text-primary" />}
          title={dt('Export my data')}
          subtitle={dt(
            'Download a JSON bundle of everything tied to your account — profile, gigs, jobs, orders, reviews.',
          )}
          onClick={async () => {
            const token = useAuthStore.getState().accessToken;
            if (!token) return;
            try {
              await downloadViaAuth('/me/data-export', token, 'apex-work-data-export.json');
              toast.success(dt('Your data is being downloaded'));
            } catch (e) {
              toast.error((e as Error).message ?? 'Export failed');
            }
          }}
          cta="Export"
        />
        <SettingRow
          icon={<ShieldAlert className="h-4 w-4 text-muted-foreground" />}
          title={dt('GDPR rights')}
          subtitle={dt('You can request deletion of your account and associated data at any time.')}
          href="/settings/delete"
          cta="Manage"
        />
      </Section>
      <Section title={t('security.dangerZone')}>
        <SettingRow
          icon={<ShieldAlert className="h-4 w-4 text-destructive" />}
          title={t('security.lostPhone')}
          subtitle={t('security.lostPhoneSub')}
          onClick={async () => {
            if (!window.confirm(t('security.lostPhoneConfirm'))) return;
            await revokeAllDevices.mutateAsync();
            try {
              await apiFetch('/auth/pin', {
                method: 'DELETE',
                token: useAuthStore.getState().accessToken,
              });
            } catch {
              /* ignore */
            }
            toast.success(t('security.revokedAll'));
            useAuthStore.getState().clearAndForgetDevice();
            router.replace('/login');
          }}
          destructive
        />
      </Section>
    </div>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-4 mt-6">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          {title}
        </h2>
        {action}
      </div>
      <div className="flex flex-col gap-1 rounded-2xl border border-border bg-card p-1">
        {children}
      </div>
    </div>
  );
}

function SettingRow({
  icon,
  title,
  subtitle,
  href,
  onClick,
  cta,
  destructive,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  href?: string;
  onClick?: () => void;
  cta?: string;
  destructive?: boolean;
}) {
  const inner = (
    <>
      <div
        className={`grid h-9 w-9 place-items-center rounded-lg bg-background ${
          destructive ? 'text-destructive' : 'text-primary'
        }`}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className={`text-sm font-semibold ${destructive ? 'text-destructive' : ''}`}>
          {title}
        </div>
        {subtitle && <div className="truncate text-[11px] text-muted-foreground">{subtitle}</div>}
      </div>
      {cta ? (
        <span className="text-xs font-semibold text-primary">{cta}</span>
      ) : (
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      )}
    </>
  );
  const cls = 'flex items-center gap-3 rounded-xl px-3 py-2.5 text-left active:bg-muted';
  if (href) {
    return (
      <Link href={href} className={cls}>
        {inner}
      </Link>
    );
  }
  return (
    <button onClick={onClick} className={cls}>
      {inner}
    </button>
  );
}

function PasskeyControl({ hasAny }: { hasAny: boolean }) {
  const qc = useQueryClient();
  const token = useAuthStore((s) => s.accessToken);
  const { t } = useI18n();

  const addPasskey = async () => {
    try {
      // The @simplewebauthn browser API only works over HTTPS or localhost.
      if (typeof window !== 'undefined' && !window.isSecureContext) {
        toast.error(t('security.biometricRequiresSecure'));
        return;
      }
      const options = await apiFetch<unknown>('/auth/passkey/register-options', { token });
      const attestation = await startRegistration({
        optionsJSON: options as Parameters<typeof startRegistration>[0]['optionsJSON'],
      });
      await apiFetch('/auth/passkey/register', {
        method: 'POST',
        token,
        body: { response: attestation, label: guessDeviceLabel() },
      });
      await qc.invalidateQueries({ queryKey: ['my-passkeys'] });
      toast.success(t('security.biometricHasAny'));
    } catch (err) {
      const e = err as { name?: string; message?: string };
      if (e.name === 'NotAllowedError') return; // user cancelled
      toast.error(e.message ?? t('security.couldNotAddPasskey'));
    }
  };

  return (
    <SettingRow
      icon={<Fingerprint className="h-4 w-4" />}
      title={t('security.biometric')}
      subtitle={hasAny ? t('security.biometricHasAny') : t('security.biometricAddSub')}
      onClick={addPasskey}
      cta={hasAny ? t('security.addAnother') : t('security.enable')}
    />
  );
}

function DeviceRow({
  d,
}: {
  d: {
    id: string;
    label: string | null;
    ipAddress: string | null;
    createdAt: string;
    lastUsedAt: string;
    expiresAt: string;
  };
}) {
  const revoke = useRevokeDevice();
  const { t } = useI18n();
  const isMobile = (d.label ?? '').includes('Mobile') || (d.label ?? '').includes('iOS');
  return (
    <div className="flex items-center gap-3 rounded-xl px-3 py-2.5">
      <div className="grid h-9 w-9 place-items-center rounded-lg bg-background text-primary">
        {isMobile ? <Smartphone className="h-4 w-4" /> : <Monitor className="h-4 w-4" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold">{d.label ?? 'Unknown device'}</div>
        <div className="text-[11px] text-muted-foreground">
          {t('security.lastActive', { when: timeAgo(d.lastUsedAt) })}
          {d.ipAddress ? ` · ${d.ipAddress}` : ''}
        </div>
      </div>
      <button
        onClick={() =>
          revoke.mutate(d.id, { onSuccess: () => toast.success(t('security.revoked')) })
        }
        disabled={revoke.isPending}
        aria-label={t('common.delete')}
        className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:text-destructive active:scale-90 disabled:opacity-50"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

function PasskeyRow({
  p,
}: {
  p: {
    id: string;
    label: string | null;
    deviceType: 'singleDevice' | 'multiDevice' | null;
    backedUp: boolean;
    createdAt: string;
    lastUsedAt: string;
  };
}) {
  const del = useDeletePasskey();
  const { t } = useI18n();
  return (
    <div className="flex items-center gap-3 rounded-xl px-3 py-2.5">
      <div className="grid h-9 w-9 place-items-center rounded-lg bg-background text-primary">
        <KeyRound className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold">{p.label ?? 'Passkey'}</div>
        <div className="text-[11px] text-muted-foreground">
          {p.backedUp ? t('security.syncedAcross') : t('security.thisDeviceOnly')} ·{' '}
          {t('security.addedTimeAgo', { when: timeAgo(p.createdAt) })}
        </div>
      </div>
      <button
        onClick={() => {
          if (!window.confirm(t('security.confirmDeletePasskey'))) return;
          del.mutate(p.id, { onSuccess: () => toast.success(t('security.removed')) });
        }}
        disabled={del.isPending}
        aria-label={t('common.delete')}
        className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:text-destructive active:scale-90 disabled:opacity-50"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

function guessDeviceLabel(): string {
  if (typeof navigator === 'undefined') return 'This device';
  const ua = navigator.userAgent;
  const os = /iPhone|iPad|iOS/i.test(ua)
    ? 'iPhone'
    : /Android/i.test(ua)
      ? 'Android'
      : /Mac OS X/i.test(ua)
        ? 'Mac'
        : /Windows/i.test(ua)
          ? 'Windows'
          : /Linux/i.test(ua)
            ? 'Linux'
            : 'Device';
  return os;
}
