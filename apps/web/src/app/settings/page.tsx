'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  User,
  Shield,
  Bell,
  Globe,
  Palette,
  Database,
  Link2,
  HelpCircle,
  FileText,
  Trash2,
  ChevronRight,
  LogOut,
  KeyRound,
  ShieldOff,
  ImageIcon,
  Fingerprint,
} from 'lucide-react';
import { useI18n } from '@/i18n';
import { useMe, useLogout } from '@/hooks/use-me';

export default function SettingsPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { data: me } = useMe();
  const logout = useLogout();

  return (
    <div className="min-h-dvh bg-background pb-24">
      <header className="safe-top sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 px-3 py-3 backdrop-blur-xl">
        <button
          onClick={() => router.back()}
          aria-label={t('common.back')}
          className="grid h-9 w-9 place-items-center rounded-full active:scale-90"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-extrabold tracking-tight">{t('settings.title')}</h1>
      </header>

      <Section title={t('settings.account')}>
        <Row icon={<User className="h-4 w-4" />} title={t('editProfile.title')} href="/settings/profile" />
        {me?.role === 'FREELANCER' && (
          <Row icon={<ImageIcon className="h-4 w-4" />} title={t('portfolio.title')} href="/settings/portfolio" />
        )}
      </Section>

      <Section title={t('settings.securityGroup')}>
        <Row icon={<Shield className="h-4 w-4" />} title={t('security.title')} href="/settings/security" />
        <Row icon={<KeyRound className="h-4 w-4" />} title={t('pin.set')} href="/settings/pin" />
        <Row icon={<Fingerprint className="h-4 w-4" />} title={t('settings.devices')} href="/settings/devices" />
      </Section>

      <Section title={t('settings.privacy')}>
        <Row icon={<ShieldOff className="h-4 w-4" />} title={t('block.listTitle')} href="/settings/blocks" />
        <Row icon={<Bell className="h-4 w-4" />} title={t('settings.notifications')} href="/settings/notifications" />
      </Section>

      <Section title={t('settings.preferences')}>
        <Row icon={<Globe className="h-4 w-4" />} title={t('settings.language')} href="/settings/language" />
        <Row icon={<Palette className="h-4 w-4" />} title={t('settings.appearance')} href="/settings/appearance" />
        <Row icon={<Database className="h-4 w-4" />} title={t('settings.dataStorage')} href="/settings/storage" />
        <Row icon={<Link2 className="h-4 w-4" />} title={t('settings.connectedApps')} href="/settings/connected" />
      </Section>

      <Section title={t('settings.about')}>
        <Row icon={<HelpCircle className="h-4 w-4" />} title={t('settings.help')} href="/settings/help" />
        <Row icon={<FileText className="h-4 w-4" />} title={t('settings.legal')} href="/settings/legal" />
        <Row icon={<Trash2 className="h-4 w-4" />} title={t('settings.deleteAccount')} href="/settings/delete" destructive />
      </Section>

      <div className="mx-3 mt-6">
        <button
          onClick={() => !logout.isPending && logout.mutate(false)}
          className="flex w-full items-center gap-3 rounded-xl border border-border bg-card px-4 py-3.5 text-sm font-semibold text-red-500 active:scale-95"
        >
          <LogOut className="h-4 w-4" />
          {logout.isPending ? t('common.signingOut') : t('common.signOut')}
        </button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-3 mt-5">
      <h2 className="mb-2 px-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
        {title}
      </h2>
      <div className="overflow-hidden rounded-2xl border border-border bg-card divide-y divide-border">
        {children}
      </div>
    </div>
  );
}

function Row({
  icon,
  title,
  href,
  destructive,
}: {
  icon: React.ReactNode;
  title: string;
  href: string;
  destructive?: boolean;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-4 py-3.5 text-sm font-semibold transition-colors active:bg-muted"
    >
      <span className={destructive ? 'text-red-500' : 'text-muted-foreground'}>{icon}</span>
      <span className={destructive ? 'text-red-500' : ''}>{title}</span>
      <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />
    </Link>
  );
}
