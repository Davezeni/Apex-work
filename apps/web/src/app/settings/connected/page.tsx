'use client';

import { dt } from '@/i18n/auto';
/**
 * Connected apps / integrations. Lists the account-backed passkeys and
 * Chapa checkout options, plus the live Google/GitHub sign-in entry point.
 * Provider credentials stay on the API; this page never handles secrets.
 */
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  CheckCircle2,
  Chrome,
  ExternalLink,
  Github,
  KeyRound,
  CreditCard,
  Loader2,
  Trash2,
  Plus,
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import { useMe } from '@/hooks/use-me';
import {
  useOAuthAccounts,
  useUnlinkOAuthAccount,
  useStartOAuthLink,
  type OAuthAccount,
} from '@/hooks/use-oauth-accounts';
import { useI18n } from '@/i18n';
import { Button } from '@/components/ui/button';
interface Passkey {
  id: string;
  label: string | null;
  createdAt: string;
  lastUsedAt: string;
}

export default function ConnectedAppsPage() {
  const router = useRouter();
  const { t } = useI18n();
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  const { isLoading: meLoading, isAuthed, data: me } = useMe();
  const oauthAccounts = useOAuthAccounts();
  const unlinkOAuth = useUnlinkOAuthAccount();
  const linkOAuth = useStartOAuthLink();

  useEffect(() => {
    if (!meLoading && !isAuthed) router.replace('/login?next=/settings/connected');
  }, [meLoading, isAuthed, router]);

  const passkeys = useQuery<{ items: Passkey[] }>({
    queryKey: ['passkeys'],
    queryFn: () => apiFetch('/auth/passkey', { token }),
    enabled: !!token,
  });

  const deletePasskey = useMutation({
    mutationFn: (id: string) => apiFetch(`/auth/passkey/${id}`, { method: 'DELETE', token }),
    onSuccess: () => {
      toast.success(dt('Passkey removed'));
      qc.invalidateQueries({ queryKey: ['passkeys'] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const pkItems = passkeys.data?.items ?? [];

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
        <h1 className="text-lg font-extrabold tracking-tight">{t('settings.connectedApps')}</h1>
      </header>

      {/* Passkeys — real, backed by /auth/passkey */}
      <section className="mx-3 mt-5">
        <SectionHeader
          icon={<KeyRound className="h-4 w-4" />}
          title={dt('Passkeys')}
          subtitle={dt('Face ID, Touch ID, Windows Hello, YubiKey')}
        />
        {passkeys.isLoading ? (
          <div className="grid h-24 place-items-center rounded-2xl border border-border bg-card">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : pkItems.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-6 text-center">
            <p className="text-sm font-semibold">{dt('No passkeys yet')}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Add a passkey for lightning-fast sign-in without a password.
            </p>
            <Button asChild size="sm" variant="brand" className="mt-4">
              <Link href="/settings/security">
                <Plus className="mr-1 h-3 w-3" /> Add passkey
              </Link>
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
            {pkItems.map((p) => (
              <div key={p.id} className="flex items-center gap-3 px-4 py-3.5">
                <KeyRound className="h-4 w-4 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{p.label ?? 'Passkey'}</div>
                  <div className="text-[11px] text-muted-foreground">
                    Added {new Date(p.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (window.confirm('Remove this passkey?')) deletePasskey.mutate(p.id);
                  }}
                  disabled={deletePasskey.isPending}
                  aria-label={dt('Remove passkey')}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-red-500/10 hover:text-red-500"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            <div className="p-3">
              <Button asChild size="sm" variant="outline" className="w-full">
                <Link href="/settings/security">
                  <Plus className="mr-1 h-3 w-3" /> Add another passkey
                </Link>
              </Button>
            </div>
          </div>
        )}
      </section>

      {/* Payment methods — real, links to existing page */}
      <section className="mx-3 mt-6">
        <SectionHeader
          icon={<CreditCard className="h-4 w-4" />}
          title={dt('Payment methods')}
          subtitle={dt('Telebirr, CBE, Awash, Chapa card')}
        />
        <Link
          href="/settings/payment-methods"
          className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 text-sm font-semibold active:bg-muted"
        >
          <CreditCard className="h-4 w-4 text-muted-foreground" />
          <span>{dt('Manage payment methods')}</span>
          <ExternalLink className="ml-auto h-4 w-4 text-muted-foreground" />
        </Link>
      </section>

      {/* Social sign-in — real OAuth accounts with safe unlinking. */}
      <section className="mx-3 mt-6">
        <SectionHeader
          icon={<KeyRound className="h-4 w-4" />}
          title={dt('Social sign-in')}
          subtitle={dt('Google & GitHub')}
        />
        <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          <OAuthRow
            provider="google"
            account={oauthAccounts.data?.items.find((item) => item.provider === 'google')}
            busy={unlinkOAuth.isPending || linkOAuth.isPending}
            onLink={() => {
              linkOAuth.mutate('google', {
                onSuccess: ({ authorizationUrl }) => window.location.assign(authorizationUrl),
                onError: (error) => toast.error(error.message),
              });
            }}
            onUnlink={() => {
              if (!window.confirm('Disconnect Google sign-in?')) return;
              unlinkOAuth.mutate('google', {
                onSuccess: () => toast.success(dt('Google sign-in disconnected')),
                onError: (error) => toast.error(error.message),
              });
            }}
          />
          <OAuthRow
            provider="github"
            account={oauthAccounts.data?.items.find((item) => item.provider === 'github')}
            busy={unlinkOAuth.isPending || linkOAuth.isPending}
            onLink={() => {
              linkOAuth.mutate('github', {
                onSuccess: ({ authorizationUrl }) => window.location.assign(authorizationUrl),
                onError: (error) => toast.error(error.message),
              });
            }}
            onUnlink={() => {
              if (!window.confirm('Disconnect GitHub sign-in?')) return;
              unlinkOAuth.mutate('github', {
                onSuccess: () => toast.success(dt('GitHub sign-in disconnected')),
                onError: (error) => toast.error(error.message),
              });
            }}
          />
          <div className="p-3 text-center text-[11px] text-muted-foreground">
            Connect stays on this Apex-Work account; it will not create a second account.
          </div>
        </div>
      </section>

      {me?.email && (
        <p className="mx-4 mt-6 text-center text-[11px] text-muted-foreground">
          Signed in as <span className="font-semibold">{me.email}</span>
        </p>
      )}
    </div>
  );
}

function OAuthRow({
  provider,
  account,
  busy,
  onLink,
  onUnlink,
}: {
  provider: 'google' | 'github';
  account?: OAuthAccount;
  busy: boolean;
  onLink: () => void;
  onUnlink: () => void;
}) {
  const isGoogle = provider === 'google';
  const Icon = isGoogle ? Chrome : Github;
  const label = isGoogle ? 'Google' : 'GitHub';
  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-muted text-foreground">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-bold">{label}</div>
        {account ? (
          <div className="truncate text-[11px] text-muted-foreground">
            {account.email || account.profileName || 'Connected'}
          </div>
        ) : (
          <div className="text-[11px] text-muted-foreground">{dt('Available at sign in')}</div>
        )}
      </div>
      {account ? (
        <>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] font-bold text-emerald-600">
            <CheckCircle2 className="h-3 w-3" /> Connected
          </span>
          <button
            onClick={onUnlink}
            disabled={busy}
            className="text-[11px] font-semibold text-muted-foreground hover:text-destructive disabled:opacity-50"
          >
            Disconnect
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={onLink}
          disabled={busy}
          className="inline-flex items-center gap-1 text-[11px] font-bold text-primary disabled:opacity-50"
        >
          {busy && <Loader2 className="h-3 w-3 animate-spin" />}
          Connect
        </button>
      )}
    </div>
  );
}

function SectionHeader({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="mb-2 flex items-center gap-2 px-2">
      <span className="text-muted-foreground">{icon}</span>
      <div>
        <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          {title}
        </div>
        <div className="text-[10px] text-muted-foreground/80">{subtitle}</div>
      </div>
    </div>
  );
}
