'use client';

import { dt } from '@/i18n/auto';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Award,
  Zap,
  Star,
  Trophy,
  ShieldCheck,
  Package,
  Loader2,
  Lock,
} from 'lucide-react';
import { useMe } from '@/hooks/use-me';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/utils';
import { safeBack } from '@/lib/safe-back';
interface Badge {
  id: string;
  name: string;
  desc: string;
  icon: React.ReactNode;
  color: string;
  unlockedIf: (me: {
    rating: number;
    ratingCount: number;
    completedOrders: number;
    isVerified: boolean;
  }) => boolean;
}

const BADGES: Badge[] = [
  {
    id: 'first-order',
    name: 'First order',
    desc: 'Complete your first order',
    icon: <Package className="h-6 w-6" />,
    color: 'from-emerald-400 to-emerald-600',
    unlockedIf: (m) => m.completedOrders >= 1,
  },
  {
    id: 'verified',
    name: 'Verified',
    desc: 'Verify your ID',
    icon: <ShieldCheck className="h-6 w-6" />,
    color: 'from-cyan-400 to-cyan-600',
    unlockedIf: (m) => m.isVerified,
  },
  {
    id: 'ten-orders',
    name: 'Rising star',
    desc: 'Complete 10 orders',
    icon: <Star className="h-6 w-6" />,
    color: 'from-amber-400 to-amber-600',
    unlockedIf: (m) => m.completedOrders >= 10,
  },
  {
    id: 'fifty-orders',
    name: 'Pro',
    desc: 'Complete 50 orders',
    icon: <Zap className="h-6 w-6" />,
    color: 'from-violet-400 to-violet-600',
    unlockedIf: (m) => m.completedOrders >= 50,
  },
  {
    id: 'hundred-orders',
    name: 'Elite',
    desc: 'Complete 100 orders',
    icon: <Trophy className="h-6 w-6" />,
    color: 'from-red-400 to-red-600',
    unlockedIf: (m) => m.completedOrders >= 100,
  },
  {
    id: 'top-rated',
    name: 'Top rated',
    desc: 'Maintain 4.9★ over 20 reviews',
    icon: <Award className="h-6 w-6" />,
    color: 'from-yellow-400 to-yellow-600',
    unlockedIf: (m) => m.rating >= 4.9 && m.ratingCount >= 20,
  },
];

export default function AchievementsPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { data: me, isLoading, isAuthed } = useMe();

  useEffect(() => {
    if (!isLoading && !isAuthed) router.replace('/login?next=/achievements');
  }, [isLoading, isAuthed, router]);

  if (isLoading || !me) {
    return (
      <div className="grid min-h-dvh place-items-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const unlockedCount = BADGES.filter((b) => b.unlockedIf(me)).length;

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
        <h1 className="text-lg font-extrabold tracking-tight">{dt('Achievements')}</h1>
      </header>

      <section className="mx-4 mt-6 text-center">
        <div className="grad-hero mx-auto grid h-20 w-20 place-items-center rounded-3xl text-white shadow-lg shadow-primary/40">
          <Trophy className="h-10 w-10" />
        </div>
        <div className="mt-3 text-3xl font-extrabold tracking-tight">
          {unlockedCount} / {BADGES.length}
        </div>
        <div className="text-xs text-muted-foreground">{dt('badges unlocked')}</div>
      </section>

      <div className="mx-3 mt-6 grid grid-cols-2 gap-3">
        {BADGES.map((b) => {
          const unlocked = b.unlockedIf(me);
          return (
            <div
              key={b.id}
              className={cn(
                'flex flex-col items-center gap-2 rounded-2xl border p-4 text-center transition-all',
                unlocked ? 'border-border bg-card' : 'border-dashed border-border/60 bg-muted/30',
              )}
            >
              <div
                className={cn(
                  'grid h-14 w-14 place-items-center rounded-2xl text-white shadow-md',
                  unlocked
                    ? `bg-gradient-to-br ${b.color} shadow-primary/20`
                    : 'bg-muted-foreground/30',
                )}
              >
                {unlocked ? b.icon : <Lock className="h-5 w-5" />}
              </div>
              <div className={cn('text-sm font-bold', !unlocked && 'text-muted-foreground')}>
                {b.name}
              </div>
              <div className="text-[10px] text-muted-foreground">{b.desc}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
