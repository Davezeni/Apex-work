'use client';

import Link from 'next/link';
import { MobileShell } from '@/components/mobile/mobile-shell';
import { Button } from '@/components/ui/button';
import {
  CheckCircle2,
  CreditCard,
  Calendar,
  Settings,
  LogOut,
  ChevronRight,
  Loader2,
  LogIn,
  Sparkles,
  Package,
  Bell,
  ShieldCheck,
  ImageIcon,
  BarChart3,
  Trophy,
  Gift,
  FileText,
  Award,
} from 'lucide-react';
import { useMe, useLogout } from '@/hooks/use-me';
import { formatEtb } from '@/lib/utils';
import { LanguageSwitcher } from '@/components/language-switcher';
import { useI18n } from '@/i18n';

export default function ProfilePage() {
  const { data: me, isLoading, isSignedIn, isAuthed } = useMe();
  const logout = useLogout();
  const { t } = useI18n();

  // Not signed in → show sign-in CTA
  if (!isAuthed) {
    return (
      <MobileShell activeTab="profile">
        <SignedOutView />
      </MobileShell>
    );
  }

  // Signed in but data still loading
  if (isLoading || !me) {
    return (
      <MobileShell activeTab="profile">
        <div className="grid h-[60dvh] place-items-center text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      </MobileShell>
    );
  }

  const initials = me.fullName
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <MobileShell activeTab="profile">
      {/* Hero */}
      <div className="relative pb-6 pt-6 text-center">
        <div className="grad-hero absolute inset-x-0 top-0 h-32 opacity-50" />
        <div className="relative">
          <div className="grad-hero mx-auto grid h-20 w-20 place-items-center rounded-full text-3xl font-bold text-white ring-4 ring-background">
            {initials || '?'}
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
          <Link href="/settings/profile">Edit profile</Link>
        </Button>
        <Button asChild variant="secondary" className="flex-1">
          <Link href={`/u/${me.username}`}>Share</Link>
        </Button>
      </div>

      {/* Wallet — only for freelancers */}
      {me.role === 'FREELANCER' && (
        <Link
          href="/wallet"
          className="grad-hero mx-5 mt-4 block rounded-2xl p-5 text-white shadow-xl shadow-primary/40 transition-transform active:scale-[0.98]"
        >
          <div className="text-xs opacity-90">{t('wallet.balance')}</div>
          <div className="mt-1 text-3xl font-extrabold tracking-tight">{formatEtb(0)}</div>
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
      <div className="px-3 pb-8">
        <MenuItem
          icon={<Package className="h-4 w-4" />}
          title="Orders"
          subtitle="Your purchases and sales"
          href="/orders"
        />
        <MenuItem
          icon={<Bell className="h-4 w-4" />}
          title="Notifications"
          subtitle="Alerts & activity"
          href="/notifications"
        />
        <MenuItem
          icon={<CreditCard className="h-4 w-4" />}
          title={t('profile.paymentMethods')}
          subtitle="Telebirr, CBE Birr"
          href="/settings/payment-methods"
        />
        {me.role === 'FREELANCER' && (
          <>
            <MenuItem
              icon={<Calendar className="h-4 w-4" />}
              title={t('profile.availability')}
              subtitle="Working hours & vacation"
              href="/settings/availability"
            />
            <MenuItem
              icon={<BarChart3 className="h-4 w-4" />}
              title="Statistics"
              subtitle="Views, earnings, response rate"
              href="/stats"
            />
            <MenuItem
              icon={<Trophy className="h-4 w-4" />}
              title="Achievements"
              subtitle="Badges & milestones"
              href="/achievements"
            />
          </>
        )}
        <MenuItem
          icon={<Gift className="h-4 w-4" />}
          title="Refer friends"
          subtitle="Earn 100 ETB per invite"
          href="/referrals"
        />
        {me.role === 'FREELANCER' && (
          <>
            <MenuItem
              icon={<ImageIcon className="h-4 w-4" />}
              title={t('portfolio.title')}
              subtitle={t('portfolio.menuSubtitle')}
              href="/settings/portfolio"
            />
            <MenuItem
              icon={<FileText className="h-4 w-4" />}
              title="Resume / CV"
              subtitle="Build your professional CV"
              href="/resume"
            />
            <MenuItem
              icon={<Award className="h-4 w-4" />}
              title="Skills"
              subtitle="Add and rank your skills"
              href="/settings/skills"
            />
          </>
        )}
        <MenuItem
          icon={<ShieldCheck className="h-4 w-4" />}
          title={t('profile.security')}
          subtitle={t('profile.securitySubtitle')}
          href="/settings/security"
        />
        <MenuItem
          icon={<ShieldCheck className="h-4 w-4" />}
          title={t('block.listTitle')}
          subtitle={t('block.menuSubtitle')}
          href="/settings/blocks"
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
            title="Admin panel"
            subtitle="Reports, withdrawals, users"
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
    </MobileShell>
  );
}

function SignedOutView() {
  return (
    <div className="flex min-h-[80dvh] flex-col items-center justify-center px-6 text-center">
      <div className="grad-hero grid h-16 w-16 place-items-center rounded-2xl text-2xl font-extrabold text-white shadow-lg shadow-primary/40">
        <Sparkles className="h-8 w-8" />
      </div>
      <h2 className="mt-6 text-2xl font-extrabold tracking-tight">Join Apex-Work</h2>
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
        className={`grid h-10 w-10 place-items-center rounded-xl bg-card ${
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
    'flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors active:bg-card disabled:opacity-60';
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
