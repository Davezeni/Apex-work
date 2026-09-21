'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Link as LinkIcon, ArrowLeft } from 'lucide-react';
import { useMe } from '@/hooks/use-me';
import { safeBack } from '@/lib/safe-back';
import { useI18n } from '@/i18n';
import { PortfolioBody } from '@/components/settings/portfolio-body';

export default function PortfolioPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { data: me, isLoading } = useMe();

  useEffect(() => {
    if (!isLoading && !me) router.replace('/login?next=/settings/portfolio');
    if (!isLoading && me && me.role !== 'FREELANCER') router.replace('/profile');
  }, [isLoading, me, router]);

  if (isLoading || !me) {
    return (
      <div className="grid min-h-dvh place-items-center bg-background">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background pb-24">
      <header className="safe-top sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 px-3 py-3 backdrop-blur-xl">
        <button
          onClick={() => safeBack(router)}
          aria-label={t('common.back')}
          className="grid h-9 w-9 place-items-center rounded-full active:scale-90"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-extrabold tracking-tight">Portfolio</h1>
          <p className="text-[11px] text-muted-foreground">Your work, curated</p>
        </div>
        <a
          href={`/u/${me.username}`}
          className="flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-bold active:scale-95"
        >
          <LinkIcon className="h-3.5 w-3.5" /> Share
        </a>
      </header>
      <PortfolioBody />
    </div>
  );
}
