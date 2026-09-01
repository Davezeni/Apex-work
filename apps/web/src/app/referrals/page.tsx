'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Copy, Share2, Gift, Users, Sparkles, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useMe } from '@/hooks/use-me';
import { useI18n } from '@/i18n';
import { formatEtb } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth-store';
import { apiFetch } from '@/lib/api';

interface ReferralResp {
  referralCode: string;
  shareUrl: string;
  stats: { total: number; pending: number; active: number; attributedGmvEtb: number; commissionEtb: number; topBySpend: { username: string; fullName: string; spentEtb: number } | null };
  referred: { userId: string; username: string; fullName: string; joinedAt: string; completedOrders: number; spentEtb: number }[];
}

export default function ReferralsPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { data: me, isLoading, isAuthed } = useMe();
  const token = useAuthStore((s) => s.accessToken);
  const { data: ref } = useQuery<ReferralResp>({
    queryKey: ['me', 'referrals'],
    queryFn: () => apiFetch('/me/referrals', { token }),
    enabled: !!token,
  });
  const [origin, setOrigin] = useState('https://apex-work-gold.vercel.app');

  useEffect(() => {
    if (typeof window !== 'undefined') setOrigin(window.location.origin);
  }, []);
  useEffect(() => {
    if (!isLoading && !isAuthed) router.replace('/login?next=/referrals');
  }, [isLoading, isAuthed, router]);

  if (isLoading || !me) {
    return (
      <div className="grid min-h-dvh place-items-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const code = (me as unknown as { referralCode?: string }).referralCode ?? me.username;
  const link = `${origin}/signup?ref=${code}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast.success('Referral link copied');
    } catch {
      toast.error('Copy failed');
    }
  };

  const share = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: 'Join Apex-Work', text: 'Join me on Apex-Work — Ethiopia\'s freelance marketplace.', url: link });
      } catch { /* user cancelled */ }
    } else {
      copy();
    }
  };

  return (
    <div className="min-h-dvh bg-background pb-24">
      <header className="safe-top sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 px-3 py-3 backdrop-blur-xl">
        <button onClick={() => router.back()} aria-label={t('common.back')} className="grid h-9 w-9 place-items-center rounded-full active:scale-90">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-extrabold tracking-tight">Referrals</h1>
      </header>

      <section className="mx-4 mt-6 text-center">
        <div className="grad-hero mx-auto grid h-20 w-20 place-items-center rounded-3xl text-white shadow-lg shadow-primary/40">
          <Gift className="h-10 w-10" />
        </div>
        <h2 className="mt-4 text-2xl font-extrabold tracking-tight">Earn 100 ETB per friend</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Invite friends to Apex-Work — you both get a bonus when they complete their first order.
        </p>
      </section>

      <section className="mx-3 mt-6 rounded-2xl border border-border bg-card p-4">
        <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Your link</div>
        <div className="mt-2 flex items-center gap-2 rounded-xl bg-muted/60 px-3 py-2.5">
          <div className="min-w-0 flex-1 truncate text-xs">{link}</div>
          <button onClick={copy} aria-label="Copy" className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary active:scale-90">
            <Copy className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-3 flex gap-2">
          <Button variant="outline" size="lg" className="flex-1" onClick={copy}>
            <Copy className="h-4 w-4" /> Copy
          </Button>
          <Button variant="brand" size="lg" className="flex-1" onClick={share}>
            <Share2 className="h-4 w-4" /> Share
          </Button>
        </div>
      </section>

      <section className="mx-3 mt-4 grid grid-cols-3 gap-2">
        <Stat icon={<Users className="h-4 w-4" />} label="Referred" value={String(ref?.stats.total ?? 0)} />
        <Stat icon={<Sparkles className="h-4 w-4" />} label="Active" value={String(ref?.stats.active ?? 0)} />
        <Stat icon={<Gift className="h-4 w-4" />} label="Earned" value={formatEtb(ref?.stats.commissionEtb ?? 0)} />
      </section>

      {ref && ref.referred.length > 0 && (
        <section className="mx-3 mt-4 rounded-2xl border border-border bg-card p-4">
          <div className="text-sm font-bold">Your referrals</div>
          <div className="mt-2 space-y-2">
            {ref.referred.slice(0, 20).map((r) => (
              <div key={r.userId} className="flex items-center justify-between gap-2 text-xs">
                <div className="min-w-0 truncate font-semibold">{r.fullName} <span className="text-muted-foreground">@{r.username}</span></div>
                <div className="shrink-0 text-right">
                  <div className="font-bold">{formatEtb(r.spentEtb)}</div>
                  <div className="text-muted-foreground">{r.completedOrders > 0 ? `${r.completedOrders} order(s)` : 'no orders yet'}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mx-3 mt-4 rounded-2xl border border-border bg-card p-4">
        <div className="text-sm font-bold">How it works</div>
        <ol className="mt-3 space-y-3 text-xs">
          <Step n={1} title="Share your link" desc="Send it to friends who need freelance help or want to earn." />
          <Step n={2} title="They sign up" desc="Your friend creates an account using your link." />
          <Step n={3} title="You both earn" desc="When they complete their first order, 100 ETB is added to each wallet." />
        </ol>
      </section>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 text-center">
      <div className="mx-auto grid h-8 w-8 place-items-center rounded-full bg-primary/10 text-primary">{icon}</div>
      <div className="mt-2 text-lg font-extrabold">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

function Step({ n, title, desc }: { n: number; title: string; desc: string }) {
  return (
    <li className="flex gap-3">
      <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary text-[10px] font-bold text-white">{n}</div>
      <div>
        <div className="font-bold">{title}</div>
        <div className="text-muted-foreground">{desc}</div>
      </div>
    </li>
  );
}
