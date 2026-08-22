'use client';

/**
 * Connected apps / integrations. Lists the third-party services that CAN
 * be connected to your Apex-Work account (Telegram bot notifications,
 * Google / GitHub OAuth, Chapa payment methods), showing which are
 * currently linked and letting you connect/disconnect each.
 *
 * Where no first-class OAuth flow exists yet, we show the integration as
 * "Available soon" with a small note explaining how it will work — this
 * gives users transparency about the roadmap rather than a dead route.
 */
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2, Send, ExternalLink, KeyRound, CreditCard, Trash2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import { useMe } from '@/hooks/use-me';
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
      toast.success('Passkey removed');
      qc.invalidateQueries({ queryKey: ['passkeys'] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const pkItems = passkeys.data?.items ?? [];

  return (
    <div className="min-h-dvh bg-background pb-24">
      <header className="safe-top sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 px-3 py-3 backdrop-blur-xl">
        <button onClick={() => router.back()} aria-label={t('common.back')} className="grid h-9 w-9 place-items-center rounded-full active:scale-90">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-extrabold tracking-tight">{t('settings.connectedApps')}</h1>
      </header>

      {/* Passkeys — real, backed by /auth/passkey */}
      <section className="mx-3 mt-5">
        <SectionHeader
          icon={<KeyRound className="h-4 w-4" />}
          title="Passkeys"
          subtitle="Face ID, Touch ID, Windows Hello, YubiKey"
        />
        {passkeys.isLoading ? (
          <div className="grid h-24 place-items-center rounded-2xl border border-border bg-card">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : pkItems.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-6 text-center">
            <p className="text-sm font-semibold">No passkeys yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Add a passkey for lightning-fast sign-in without a password.
            </p>
            <Button asChild size="sm" variant="brand" className="mt-4">
              <Link href="/settings/security"><Plus className="mr-1 h-3 w-3" /> Add passkey</Link>
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
                  aria-label="Remove passkey"
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-red-500/10 hover:text-red-500"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            <div className="p-3">
              <Button asChild size="sm" variant="outline" className="w-full">
                <Link href="/settings/security"><Plus className="mr-1 h-3 w-3" /> Add another passkey</Link>
              </Button>
            </div>
          </div>
        )}
      </section>

      {/* Payment methods — real, links to existing page */}
      <section className="mx-3 mt-6">
        <SectionHeader
          icon={<CreditCard className="h-4 w-4" />}
          title="Payment methods"
          subtitle="Telebirr, CBE, Awash, Chapa card"
        />
        <Link
          href="/settings/payment-methods"
          className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 text-sm font-semibold active:bg-muted"
        >
          <CreditCard className="h-4 w-4 text-muted-foreground" />
          <span>Manage payment methods</span>
          <ExternalLink className="ml-auto h-4 w-4 text-muted-foreground" />
        </Link>
      </section>

      {/* Telegram bot — roadmap */}
      <section className="mx-3 mt-6">
        <SectionHeader
          icon={<Send className="h-4 w-4" />}
          title="Telegram notifications"
          subtitle="Get orders, chats & alerts on Telegram"
        />
        <div className="rounded-2xl border border-dashed border-border bg-card p-4">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sky-500/10 text-sky-500">
              <Send className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold">Coming soon</div>
              <p className="mt-1 text-xs text-muted-foreground">
                Link your Telegram account to <b>@apex_work_bot</b> and get instant push
                notifications for new orders, chat messages, and dispute updates — even when
                the app is closed.
              </p>
              <a
                href="https://t.me/apex_work_support"
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary"
              >
                Ask support to get early access
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* OAuth roadmap */}
      <section className="mx-3 mt-6">
        <SectionHeader
          icon={<KeyRound className="h-4 w-4" />}
          title="Social sign-in"
          subtitle="Google & GitHub"
        />
        <div className="rounded-2xl border border-dashed border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">
            One-tap sign-in with your Google or GitHub account is on the roadmap. For now you can
            already use a <b>passkey</b> (Face ID, Touch ID) for the same one-tap experience —
            add one above.
          </p>
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

function SectionHeader({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="mb-2 flex items-center gap-2 px-2">
      <span className="text-muted-foreground">{icon}</span>
      <div>
        <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{title}</div>
        <div className="text-[10px] text-muted-foreground/80">{subtitle}</div>
      </div>
    </div>
  );
}
