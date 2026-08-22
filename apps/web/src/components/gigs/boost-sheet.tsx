'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Zap } from 'lucide-react';
import { Sheet } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useBoostGig } from '@/hooks/use-boost';
import { BOOST_TIERS } from '@apex-work/shared';
import { formatEtb, cn } from '@/lib/utils';

interface Props {
  slug: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Boost tiers → paid from freelancer wallet. Server enforces min-balance.
 * Featured gigs float to the top of the category feed via secondary sort.
 */
export function BoostSheet({ slug, open, onOpenChange }: Props) {
  const [days, setDays] = useState<number>(7);
  const boost = useBoostGig();

  const tier = BOOST_TIERS.find((t) => t.days === days)!;

  const submit = async () => {
    try {
      await boost.mutateAsync({ slug, days });
      toast.success(`Boost activated 🚀 — featured for ${tier.label}`);
      onOpenChange(false);
    } catch (err) {
      toast.error((err as { message?: string }).message ?? 'Could not boost');
    }
  };

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Boost this gig"
      description="Pin your gig to the top of its category — paid from your wallet balance."
    >
      <div className="space-y-3">
        {BOOST_TIERS.map((t) => (
          <button
            key={t.days}
            onClick={() => setDays(t.days)}
            className={cn(
              'flex w-full items-center gap-3 rounded-2xl border-2 p-4 text-left transition-all active:scale-95',
              days === t.days ? 'border-primary bg-primary/10' : 'border-border bg-card',
            )}
          >
            <div className={cn('grid h-11 w-11 place-items-center rounded-xl',
              days === t.days ? 'grad-hero text-white' : 'bg-muted text-muted-foreground')}>
              <Zap className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-bold">{t.label}</div>
              <div className="text-[11px] text-muted-foreground">Top of category feed</div>
            </div>
            <div className="text-right">
              <div className="text-lg font-extrabold text-primary">{formatEtb(t.priceEtb)}</div>
              <div className="text-[10px] text-muted-foreground">from wallet</div>
            </div>
          </button>
        ))}

        <Button variant="brand" size="lg" className="w-full" onClick={submit} disabled={boost.isPending}>
          {boost.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : (
            <><Zap className="h-4 w-4" /> Pay {formatEtb(tier.priceEtb)} · Boost {tier.label}</>
          )}
        </Button>
        <p className="text-center text-[11px] text-muted-foreground">
          If you don&rsquo;t have enough in your wallet, we&rsquo;ll show a
          &ldquo;top up&rdquo; hint. Boosts stack — buying again extends
          the current end-date.
        </p>
      </div>
    </Sheet>
  );
}
