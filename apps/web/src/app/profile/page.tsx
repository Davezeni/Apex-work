'use client';

import { dt } from '@/i18n/auto';
import Link from 'next/link';
import Image from 'next/image';
import { MobileShell } from '@/components/mobile/mobile-shell';
import { Button } from '@/components/ui/button';
import {
  CheckCircle2,
  Settings,
  LogOut,
  ChevronRight,
  Loader2,
  LogIn,
  Sparkles,
  Package,
  Bell,
  ShieldCheck,
  BarChart3,
  Trophy,
  Gift,
  FileText,
  Users,
  Bookmark,
  MapPin,
  LifeBuoy,
} from 'lucide-react';
import { useMe, useLogout } from '@/hooks/use-me';
import { useSavedGigs, type SavedGig } from '@/hooks/use-saved-gigs';
import { useWallet } from '@/hooks/use-wallet';
import { ThemeToggle } from '@/components/theme-toggle';
import { formatEtb, cn } from '@/lib/utils';
import { LanguageSwitcher } from '@/components/language-switcher';
import { Skeleton } from '@/components/ui/skeleton';
import { UserAvatar } from '@/components/ui/user-avatar';
import { useI18n } from '@/i18n';
export default function ProfilePage() {
  const { data: me, isLoading, isSignedIn, isAuthed } = useMe();
  const logout = useLogout();
  const savedGigs = useSavedGigs();
  const wallet = useWallet();
  const { t } = useI18n();

  // Not signed in → show sign-in CTA
  if (!isAuthed) {
    return (
      <MobileShell activeTab="profile">
        <SignedOutView />
      </MobileShell>
    );
  }

  // Signed in but data still loading — show a skeleton mirroring the layout.
  if (isLoading || !me) {
    return (
      <MobileShell activeTab="profile">
        <div className="px-4 pt-6">
          <div className="mb-5 flex items-center justify-between">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-9 w-9 rounded-full" />
          </div>
          <div className="flex flex-col items-center py-6 text-center">
            <Skeleton className="h-24 w-24 rounded-full" />
            <Skeleton className="mt-4 h-6 w-40" />
            <Skeleton className="mt-2 h-4 w-28" />
          </div>
          <div className="mt-6 grid grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-2xl" />
            ))}
          </div>
          <div className="mt-6 space-y-3">
            <Skeleton className="h-16 w-full rounded-2xl" />
            <Skeleton className="h-16 w-full rounded-2xl" />
            <Skeleton className="h-16 w-full rounded-2xl" />
          </div>
        </div>
      </MobileShell>
    );
  }

  return (
    <MobileShell activeTab="profile">
      <div className="mx-auto w-full max-w-2xl">
        {/* Hero */}
        <div className="relative overflow-hidden border-b border-border pb-6 pt-6 text-center">
          <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-muted/70 to-transparent dark:from-muted/40" />
          <div className="absolute right-3 top-3 z-10 rounded-full border border-border bg-background/70 shadow-sm backdrop-blur">
            <ThemeToggle />
          </div>
          <div className="relative">
            <div className="mx-auto h-20 w-20">
              <UserAvatar
                name={me.fullName}
                avatarUrl={me.avatarUrl}
                id={me.id}
                verified={me.isVerified}
                className="h-20 w-20 rounded-full text-3xl font-bold ring-4 ring-background"
              />
            </div>
            <h2 className="mt-3 flex items-center justify-center gap-1.5 text-xl font-extrabold">
              {me.fullName}
              {me.isVerified && <CheckCircle2 className="h-4 w-4 text-cyan-400" />}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {me.title ?? (me.role === 'FREELANCER' ? 'Freelancer' : 'Client')} · @{me.username}
            </p>
            {me.city && <p className="text-[11px] text-muted-foreground">📍 {me.city}</p>}
          </div>
        </div>

        {/* Stats */}
        <div className="mx-5 grid grid-cols-3 rounded-2xl border border-border bg-card p-4">
          <Stat n={me.rating > 0 ? me.rating.toFixed(1) : '—'} l="Rating" />
          <Stat n={String(me.completedOrders)} l="Orders" borderLeft />
          <Stat n={me.isVerified ? '✓' : '—'} l="Verified" borderLeft />
        </div>

        {/* Actions */}
        <div className="mx-5 mt-4 flex gap-2">
          <Button asChild variant="brand" className="flex-1">
            <Link href="/settings/profile">{dt('Edit profile')}</Link>
          </Button>
          <Button asChild variant="secondary" className="flex-1">
            <Link href={`/u/${me.username}`}>{dt('Share')}</Link>
          </Button>
        </div>

        {!me.isPhoneVerified && (
          <div className="mx-5 mt-4 flex items-center gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-3">
            <ShieldCheck className="h-5 w-5 shrink-0 text-amber-500" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold">{dt('Verify your phone')}</div>
              <p className="text-[11px] text-muted-foreground">
                Required before messaging, ordering, posting, or withdrawing.
              </p>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link href="/settings/phone?next=/profile">{dt('Verify')}</Link>
            </Button>
          </div>
        )}

        {/* Saved gigs — visible on the profile so saved services are not hidden in a menu. */}
        <ProfileSavedGigs saved={savedGigs.data?.items ?? []} isLoading={savedGigs.isLoading} />

        {/* Wallet — only for freelancers */}
        {me.role === 'FREELANCER' && (
          <Link
            href="/wallet"
            className="grad-hero mx-5 mt-4 block rounded-2xl p-5 text-white shadow-xl shadow-primary/40 transition-transform active:scale-[0.98]"
          >
            <div className="text-xs opacity-90">{t('wallet.balance')}</div>
            <div className="mt-1 text-3xl font-extrabold tracking-tight">
              {formatEtb(wallet.data?.wallet.balanceEtb ?? 0)}
            </div>
            {wallet.data?.wallet.pendingEtb ? (
              <div className="mt-1 text-[11px] opacity-90">
                +{formatEtb(wallet.data.wallet.pendingEtb)} {dt('in escrow (orders under review)')}
              </div>
            ) : null}
            <div className="mt-4 flex gap-2">
              <div className="flex-1 rounded-xl bg-white/20 py-2.5 text-center text-xs font-bold backdrop-blur">
                💸 {t('wallet.withdraw')}
              </div>
              <div className="flex-1 rounded-xl bg-white/20 py-2.5 text-center text-xs font-bold backdrop-blur">
                📊 {t('wallet.history')}
              </div>
            </div>
          </Link>
        )}

        {/* Language switcher */}
        <div className="mt-6 flex items-center justify-between px-5">
          <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            {t('language.label')}
          </div>
          <LanguageSwitcher />
        </div>

        {/* Menu */}
        <div className="mt-4 px-5 pb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
          {t('profile.account')}
        </div>
        <div className="grid gap-1.5 px-3 pb-8 sm:grid-cols-2 sm:gap-2">
          <MenuItem
            icon={<Package className="h-4 w-4" />}
            title={dt('Orders')}
            subtitle={dt('Your purchases and sales')}
            href="/orders"
          />
          <MenuItem
            icon={<Bell className="h-4 w-4" />}
            title={dt('Notifications')}
            subtitle={dt('Alerts & activity')}
            href="/notifications"
          />
          {me.role === 'FREELANCER' && (
            <>
              <MenuItem
                icon={<BarChart3 className="h-4 w-4" />}
                title={dt('Statistics')}
                subtitle={dt('Views, earnings, response rate')}
                href="/stats"
              />
              <MenuItem
                icon={<Trophy className="h-4 w-4" />}
                title={dt('Achievements')}
                subtitle={dt('Badges & milestones')}
                href="/achievements"
              />
              <MenuItem
                icon={<FileText className="h-4 w-4" />}
                title={dt('Resume / CV')}
                subtitle={dt('Build your professional CV')}
                href="/resume"
              />
            </>
          )}
          <MenuItem
            icon={<Users className="h-4 w-4" />}
            title={dt('Teams & agencies')}
            subtitle={dt('Collaborate on larger projects')}
            href="/teams"
          />
          <MenuItem
            icon={<Gift className="h-4 w-4" />}
            title={dt('Refer friends')}
            subtitle={dt('Earn 100 ETB per invite')}
            href="/referrals"
          />
          <MenuItem
            icon={<Bookmark className="h-4 w-4" />}
            title={dt('Saved gigs')}
            subtitle={dt('Keep services you want to hire later')}
            href="/saved"
          />
          <MenuItem
            icon={<MapPin className="h-4 w-4" />}
            title={dt('Nearby freelancers')}
            subtitle={dt('Discover local talent on a map')}
            href="/nearby"
          />
          <MenuItem
            icon={<LifeBuoy className="h-4 w-4" />}
            title={dt('Support tickets')}
            subtitle={dt('Get help beyond the AI bot')}
            href="/support"
          />
          <MenuItem
            icon={<Settings className="h-4 w-4" />}
            title={t('profile.settings')}
            subtitle={t('language.label')}
            href="/settings"
          />
          {me.role === 'ADMIN' && (
            <MenuItem
              icon={<ShieldCheck className="h-4 w-4" />}
              title={dt('Admin panel')}
              subtitle={dt('Reports, withdrawals, users')}
              href="/admin"
            />
          )}
          <MenuItem
            icon={
              logout.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <LogOut className="h-4 w-4" />
              )
            }
            title={logout.isPending ? t('common.signingOut') : t('common.signOut')}
            onClick={() => !logout.isPending && logout.mutate(false)}
            destructive
            disabled={logout.isPending}
          />
        </div>
      </div>
    </MobileShell>
  );
}

function ProfileSavedGigs({ saved, isLoading }: { saved: SavedGig[]; isLoading: boolean }) {
  return (
    <section className="mx-5 mt-5">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bookmark className="h-4 w-4 text-primary" />
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Saved gigs
          </h2>
        </div>
        <Link href="/saved" className="text-xs font-semibold text-primary">
          View all
        </Link>
      </div>
      {isLoading ? (
        <div className="grid h-24 place-items-center rounded-2xl border border-border bg-card">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : saved.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-4 text-center">
          <p className="text-xs font-semibold">{dt('You have not saved a gig yet.')}</p>
          <Link href="/browse" className="mt-2 inline-block text-xs font-bold text-primary">
            Browse gigs
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {saved.slice(0, 3).map((item) => (
            <Link
              key={item.id}
              href={`/gigs/${item.gig.slug}`}
              className={cn(
                'overflow-hidden rounded-xl border border-border bg-card',
                item.gig.status !== 'ACTIVE' && 'opacity-70',
              )}
            >
              <div className="relative aspect-square overflow-hidden bg-gradient-to-br from-primary/25 to-primary/10">
                {item.gig.coverImageUrl ? (
                  <Image
                    src={item.gig.coverImageUrl}
                    alt={item.gig.title}
                    fill
                    unoptimized
                    sizes="120px"
                    className="object-cover"
                  />
                ) : (
                  <div className="grid h-full place-items-center text-lg font-extrabold text-primary">
                    {item.gig.title.slice(0, 1).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="truncate px-2 py-2 text-[10px] font-semibold">{item.gig.title}</div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

function SignedOutView() {
  return (
    <div className="flex min-h-[80dvh] flex-col items-center justify-center px-6 text-center">
      <div className="grad-hero grid h-16 w-16 place-items-center rounded-2xl text-2xl font-extrabold text-white shadow-lg shadow-primary/40">
        <Sparkles className="h-8 w-8" />
      </div>
      <h2 className="mt-6 text-2xl font-extrabold tracking-tight">{dt('Join Apex-Work')}</h2>
      <p className="mt-2 max-w-xs text-sm text-muted-foreground">
        Sign in to see your profile, wallet, and manage your gigs.
      </p>
      <div className="mt-8 flex w-full max-w-xs flex-col gap-3">
        <Button asChild variant="brand" size="lg">
          <Link href="/signup">
            <Sparkles className="h-4 w-4" /> Create an account
          </Link>
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href="/login">
            <LogIn className="h-4 w-4" /> I already have an account
          </Link>
        </Button>
      </div>
    </div>
  );
}

function Stat({ n, l, borderLeft }: { n: string; l: string; borderLeft?: boolean }) {
  return (
    <div className={`text-center ${borderLeft ? 'border-l border-border' : ''}`}>
      <div className="text-xl font-extrabold tracking-tight">{n}</div>
      <div className="mt-0.5 text-[11px] text-muted-foreground">{l}</div>
    </div>
  );
}

function MenuItem({
  icon,
  title,
  subtitle,
  onClick,
  href,
  destructive,
  disabled,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  onClick?: () => void;
  href?: string;
  destructive?: boolean;
  disabled?: boolean;
}) {
  const inner = (
    <>
      <div
        className={`grid h-10 w-10 place-items-center rounded-xl bg-primary/10 ${
          destructive ? 'text-destructive' : 'text-primary'
        }`}
      >
        {icon}
      </div>
      <div className="flex-1">
        <div className={`text-sm font-semibold ${destructive ? 'text-destructive' : ''}`}>
          {title}
        </div>
        {subtitle && <div className="text-[11px] text-muted-foreground">{subtitle}</div>}
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </>
  );
  const cls =
    'flex h-full w-full items-center gap-3 rounded-2xl border border-border bg-card px-3 py-3 text-left transition-all hover:border-primary/40 disabled:opacity-60';
  if (href) {
    return (
      <Link href={href} className={cls}>
        {inner}
      </Link>
    );
  }
  return (
    <button onClick={onClick} disabled={disabled} className={cls}>
      {inner}
    </button>
  );
}
