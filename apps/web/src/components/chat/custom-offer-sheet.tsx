'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Sheet } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useCreateOffer } from '@/hooks/use-moderation';
import { useI18n } from '@/i18n';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
}

/**
 * Freelancer composes a one-off deal for the client in-chat. On send we
 * create a CustomOffer row + post an `apex://offer/{id}` message that the
 * chat renders as an interactive card.
 */
export function CustomOfferSheet({ open, onOpenChange, conversationId }: Props) {
  const { t } = useI18n();
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [price, setPrice] = useState('');
  const [days, setDays] = useState('3');
  const create = useCreateOffer();

  const submit = async () => {
    const p = Number(price);
    const d = Number(days);
    if (title.trim().length < 3) return toast.error(t('offer.offerTitle'));
    if (!p || p < 100) return toast.error('Min 100 ETB');
    if (!d || d < 1 || d > 90) return toast.error('1–90 days');
    try {
      await create.mutateAsync({
        conversationId,
        title: title.trim(),
        description: desc.trim() || undefined,
        priceEtb: Math.floor(p),
        deliveryDays: Math.floor(d),
      });
      toast.success(t('offer.sent'));
      onOpenChange(false);
      setTitle('');
      setDesc('');
      setPrice('');
      setDays('3');
    } catch (err) {
      const e = err as { message?: string };
      toast.error(e.message ?? t('offer.sendFailed'));
    }
  };

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={t('offer.title')}
      description={t('offer.subtitle')}
    >
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t('offer.offerTitle')}
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            placeholder="Landing page in React + Tailwind"
            className="w-full rounded-xl border border-border bg-card px-3 py-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/20"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t('offer.offerDesc')}
          </label>
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            rows={4}
            maxLength={2000}
            className="w-full resize-none rounded-xl border border-border bg-card px-3 py-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/20"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t('offer.price')}
            </label>
            <input
              inputMode="numeric"
              value={price}
              onChange={(e) => setPrice(e.target.value.replace(/[^0-9]/g, ''))}
              className="w-full rounded-xl border border-border bg-card px-3 py-3 text-sm font-semibold outline-none focus:border-primary focus:ring-4 focus:ring-primary/20"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t('offer.days')}
            </label>
            <input
              inputMode="numeric"
              value={days}
              onChange={(e) => setDays(e.target.value.replace(/[^0-9]/g, ''))}
              className="w-full rounded-xl border border-border bg-card px-3 py-3 text-sm font-semibold outline-none focus:border-primary focus:ring-4 focus:ring-primary/20"
            />
          </div>
        </div>
        <Button
          variant="brand"
          size="lg"
          className="w-full"
          onClick={submit}
          disabled={create.isPending || title.trim().length < 3}
        >
          {create.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            t('offer.send')
          )}
        </Button>
      </div>
    </Sheet>
  );
}
