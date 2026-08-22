'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Sheet } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useCreateReport } from '@/hooks/use-moderation';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/utils';

type Reason = 'SPAM' | 'HARASSMENT' | 'SCAM' | 'INAPPROPRIATE' | 'IMPERSONATION' | 'OTHER';
const REASONS: Reason[] = ['SPAM', 'HARASSMENT', 'SCAM', 'INAPPROPRIATE', 'IMPERSONATION', 'OTHER'];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetType: 'USER' | 'GIG' | 'MESSAGE' | 'CONVERSATION';
  targetId: string;
}

export function ReportUserSheet({ open, onOpenChange, targetType, targetId }: Props) {
  const { t } = useI18n();
  const [reason, setReason] = useState<Reason>('SPAM');
  const [details, setDetails] = useState('');
  const create = useCreateReport();

  const submit = async () => {
    try {
      await create.mutateAsync({ targetType, targetId, reason, details: details.trim() || undefined });
      toast.success(t('report.sent'));
      onOpenChange(false);
      setDetails('');
      setReason('SPAM');
    } catch (err) {
      const e = err as { message?: string };
      toast.error(e.message ?? t('report.failed'));
    }
  };

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={t('report.title')}
      description={t('report.subtitle')}
    >
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t('report.reason')}
          </label>
          <div className="space-y-1">
            {REASONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setReason(r)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left text-sm font-semibold transition-colors active:scale-95',
                  reason === r
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-card',
                )}
              >
                <span
                  className={cn(
                    'grid h-4 w-4 shrink-0 place-items-center rounded-full border-2',
                    reason === r ? 'border-primary' : 'border-border',
                  )}
                >
                  {reason === r && <span className="h-2 w-2 rounded-full bg-primary" />}
                </span>
                {t(`report.reason.${r}`)}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t('report.details')}
          </label>
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            rows={4}
            maxLength={2000}
            placeholder={t('report.detailsPlaceholder')}
            className="w-full resize-none rounded-xl border border-border bg-card p-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/20"
          />
        </div>

        <Button
          variant="brand"
          size="lg"
          className="w-full"
          onClick={submit}
          disabled={create.isPending}
        >
          {create.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            t('report.submit')
          )}
        </Button>
      </div>
    </Sheet>
  );
}
