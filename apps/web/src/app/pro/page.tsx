'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Check, Crown, Loader2, Sparkles, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useMe } from '@/hooks/use-me';
import { useBuyPro, useSubscription, useVerifyPro } from '@/hooks/use-subscription';
import { formatEtb } from '@/lib/utils';

export default function ProPage() {
  const router = useRouter();
  const params = useSearchParams();
  const { data: me, isLoading: meLoading, isAuthed } = useMe();
  const subscription = useSubscription();
  const buy = useBuyPro();
  const verify = useVerifyPro();
  const processed = useRef<string | null>(null);
  const purchaseId = params.get('purchase');

  useEffect(() => {
    if (!meLoading && !isAuthed) router.replace('/login?next=/pro');
  }, [isAuthed, meLoading, router]);

  useEffect(() => {
    if (!purchaseId || processed.current === purchaseId || !isAuthed) return;
    processed.current = purchaseId;
    verify.mutate(purchaseId, {
      onSuccess: (result) => {
        toast[result.active ? 'success' : 'error'](
          result.active ? 'Pro is active for 30 days' : 'Payment is still processing',
        );
        router.replace('/pro');
      },
      onError: (error) => {
        toast.error(error.message);
        router.replace('/pro');
      },
    });
  }, [isAuthed, purchaseId, router, verify]);

  if (meLoading || subscription.isLoading || !me)
    return (
      <div className="grid min-h-dvh place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  const active = subscription.data?.subscription;
  const eligible = me.role === 'FREELANCER' ? 'FREELANCER_PRO' : 'CLIENT_PRO';
  const plans = subscription.data?.plans.filter((plan) => plan.id === eligible) ?? [];

  return (
    <div className="min-h-dvh bg-background pb-12">
      <header className="safe-top sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/90 px-3 py-3 backdrop-blur-xl">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Back"
          className="grid h-9 w-9 place-items-center rounded-full active:scale-90"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-extrabold">Apex Pro</h1>
          <p className="text-[10px] text-muted-foreground">More visibility, insight and AI power</p>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link href="/resume">
            <Sparkles className="h-4 w-4" /> Studio
          </Link>
        </Button>
      </header>
      <main className="mx-auto max-w-4xl px-3 py-6 sm:px-6">
        <section className="relative overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/15 via-card to-primary/10 p-6 sm:p-9">
          <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-primary/20 blur-3xl" />
          <div className="relative">
            <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-primary-foreground">
              <Crown className="h-3 w-3" /> Pro pass
            </span>
            <h2 className="mt-4 text-3xl font-black tracking-tight">
              Build momentum, not just a profile.
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
              A 30-day Pro pass unlocks the tools that help serious freelancers and clients move
              faster. No recurring billing is enabled yet.
            </p>
            {active && (
              <div className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-600">
                <Check className="h-4 w-4" /> {active.plan.replace('_', ' ')} active until{' '}
                {active.expiresAt ? new Date(active.expiresAt).toLocaleDateString() : 'soon'}
              </div>
            )}
          </div>
        </section>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {plans.map((plan) => (
            <article key={plan.id} className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center gap-2">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                  <Zap className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-extrabold">{plan.name}</h3>
                  <p className="text-[11px] text-muted-foreground">{plan.audience}</p>
                </div>
              </div>
              <div className="mt-5 text-3xl font-black">
                {formatEtb(plan.priceEtb)}
                <span className="ml-1 text-xs font-semibold text-muted-foreground">/ 30 days</span>
              </div>
              <ul className="mt-4 space-y-2 text-sm">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                    {feature}
                  </li>
                ))}
              </ul>
              <Button
                className="mt-6 w-full"
                variant="brand"
                disabled={buy.isPending || !!active}
                onClick={() =>
                  buy.mutate(plan.id, {
                    onSuccess: ({ checkoutUrl }) => {
                      if (checkoutUrl) window.location.assign(checkoutUrl);
                    },
                    onError: (error) => toast.error(error.message),
                  })
                }
              >
                {buy.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : active ? (
                  'Already active'
                ) : (
                  `Activate for ${formatEtb(plan.priceEtb)}`
                )}
              </Button>
            </article>
          ))}
        </div>
        <p className="mt-5 text-center text-[11px] text-muted-foreground">
          Payments are hosted by Chapa. Use sandbox credentials while the gateway is in test mode.
        </p>
      </main>
    </div>
  );
}
