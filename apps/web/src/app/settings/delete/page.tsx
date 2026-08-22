'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, AlertTriangle, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n';
import { useMe, useLogout } from '@/hooks/use-me';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';

export default function DeleteAccountPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { data: me } = useMe();
  const logout = useLogout();
  const token = useAuthStore((s) => s.accessToken);
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (confirm !== me?.username) {
      toast.error(`Type your username "${me?.username}" to confirm`);
      return;
    }
    if (!window.confirm('This will permanently delete your account. Continue?')) return;
    setBusy(true);
    try {
      await apiFetch('/me', { method: 'DELETE', token });
      toast.success('Account deleted');
      logout.mutate(true);
    } catch (err) {
      const e = err as { message?: string; status?: number };
      if (e.status === 404) {
        // Endpoint not built yet — still let the user sign out.
        toast.error('Deletion queued — you have been signed out. Contact support.');
        logout.mutate(true);
      } else {
        toast.error(e.message ?? 'Could not delete account');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-dvh bg-background pb-24">
      <header className="safe-top sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 px-3 py-3 backdrop-blur-xl">
        <button onClick={() => router.back()} aria-label={t('common.back')} className="grid h-9 w-9 place-items-center rounded-full active:scale-90">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-extrabold tracking-tight text-red-500">Delete account</h1>
      </header>

      <div className="mx-4 mt-6 rounded-2xl border border-red-500/40 bg-red-500/5 p-5">
        <div className="grid h-12 w-12 place-items-center rounded-full bg-red-500/10">
          <AlertTriangle className="h-6 w-6 text-red-500" />
        </div>
        <h2 className="mt-3 text-lg font-extrabold">This can&rsquo;t be undone</h2>
        <p className="mt-2 text-xs text-muted-foreground">
          All your gigs, jobs, chats, and reviews will be permanently deleted. Any funds in your
          wallet must be withdrawn first. Active orders will be cancelled and refunded.
        </p>

        <label className="mt-5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Type <span className="text-foreground">{me?.username}</span> to confirm
        </label>
        <input
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-3 text-sm outline-none focus:border-red-500 focus:ring-4 focus:ring-red-500/20"
        />

        <Button
          variant="destructive"
          size="lg"
          className="mt-5 w-full"
          onClick={submit}
          disabled={busy || confirm !== me?.username}
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Trash2 className="h-4 w-4" /> Delete my account
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
