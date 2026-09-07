'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Home,
  Search,
  MessageCircle,
  User,
  Plus,
  Compass,
  Briefcase,
  Bookmark,
  Bell,
  Wallet,
  Settings,
  LayoutDashboard,
  LogOut,
} from 'lucide-react';
import { useState } from 'react';
import { Drawer } from 'vaul';
import { cn } from '@/lib/utils';
import { useConversations } from '@/hooks/use-chat';
import { useMe } from '@/hooks/use-me';
import { useAuthStore } from '@/stores/auth-store';
import { UserAvatar } from '@/components/ui/user-avatar';
import { useI18n } from '@/i18n';

interface NavItem {
  label: string;
  icon: typeof Home;
  href: string;
  badge?: number;
}

/** Desktop left sidebar that renders inside the responsive app shell. */
export function DesktopSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useI18n();
  const { data: me } = useMe();
  const clear = useAuthStore((s) => s.clear);
  const [sheetOpen, setSheetOpen] = useState(false);
  const { data: conversations } = useConversations();
  const unreadChats = conversations?.items.reduce((total, item) => total + item.unread, 0) ?? 0;

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

  const main: NavItem[] = [
    { label: t('nav.browse'), icon: Compass, href: '/browse' },
    { label: t('nav.search'), icon: Search, href: '/search' },
    { label: t('nav.chat'), icon: MessageCircle, href: '/messages', badge: unreadChats },
    { label: t('nav.jobs'), icon: Briefcase, href: '/jobs' },
    { label: t('nav.saved'), icon: Bookmark, href: '/saved' },
    { label: t('nav.notifications'), icon: Bell, href: '/notifications' },
    { label: t('nav.wallet'), icon: Wallet, href: '/wallet' },
  ];

  const other: NavItem[] = [
    { label: t('nav.profile'), icon: User, href: '/profile' },
    { label: t('nav.settings'), icon: Settings, href: '/settings' },
  ];

  const signOut = () => {
    clear();
    router.push('/');
  };

  const Item = ({ it }: { it: NavItem }) => {
    const Icon = it.icon;
    const active = isActive(it.href);
    return (
      <Link
        href={it.href}
        className={cn(
          'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors',
          active
            ? 'bg-primary/10 text-primary'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        )}
      >
        <Icon className="h-5 w-5 shrink-0" strokeWidth={active ? 2.5 : 2} />
        <span className="flex-1 truncate">{it.label}</span>
        {it.badge && it.badge > 0 && (
          <span className="grid min-w-[20px] place-items-center rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-bold text-white">
            {it.badge > 99 ? '99+' : it.badge}
          </span>
        )}
      </Link>
    );
  };

  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-border bg-card/60 backdrop-blur-xl md:flex">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2.5 px-5 py-5">
        <div className="grad-hero grid h-9 w-9 place-items-center rounded-xl text-lg font-extrabold text-white shadow-lg shadow-primary/40">
          A
        </div>
        <span className="text-lg font-extrabold tracking-tight">Apex-Work</span>
      </Link>

      {/* Create */}
      <div className="px-4">
        <button
          onClick={() => setSheetOpen(true)}
          className="grad-hero flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold text-white shadow-lg shadow-primary/30 transition-all hover:brightness-110"
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} />
          {t('nav.create')}
        </button>
      </div>

      {/* Nav */}
      <nav className="mt-4 flex-1 space-y-1 overflow-y-auto px-4">
        <div className="mb-1 px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
          {t('nav.workspace')}
        </div>
        {main.map((it) => (
          <Item key={it.href} it={it} />
        ))}
        <div className="mb-1 mt-4 px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
          {t('nav.account')}
        </div>
        {other.map((it) => (
          <Item key={it.href} it={it} />
        ))}
      </nav>

      {/* Bottom: user card + sign out */}
      {me && (
        <div className="border-t border-border p-4">
          <div className="flex items-center gap-3">
            <Link href="/profile">
              <UserAvatar
                name={me.fullName}
                avatarUrl={me.avatarUrl}
                id={me.id}
                verified={me.isVerified}
                className="h-9 w-9 text-sm font-bold"
              />
            </Link>
            <div className="min-w-0 flex-1">
              <Link href="/profile" className="block truncate text-sm font-bold hover:text-primary">
                {me.fullName}
              </Link>
              <div className="truncate text-[11px] text-muted-foreground">@{me.username}</div>
            </div>
          </div>
          <button
            onClick={signOut}
            className="mt-3 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut className="h-4 w-4" />
            {t('nav.signOut')}
          </button>
        </div>
      )}

      {/* Create sheet (reuses the same actions) */}
      <Drawer.Root open={sheetOpen} onOpenChange={setSheetOpen}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />
          <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 mt-24 flex h-auto flex-col rounded-t-3xl border border-b-0 border-border bg-card focus:outline-none">
            <div className="mx-auto mt-3 h-1.5 w-10 rounded-full bg-muted" />
            <div className="p-6">
              <Drawer.Title className="text-xl font-extrabold">{t('nav.create')}</Drawer.Title>
              <div className="mt-5 grid grid-cols-2 gap-2">
                <CreateAction
                  icon="💼"
                  title={t('nav.postGig')}
                  onClick={() => {
                    setSheetOpen(false);
                    router.push('/gigs/new');
                  }}
                />
                <CreateAction
                  icon="📢"
                  title={t('nav.postJob')}
                  onClick={() => {
                    setSheetOpen(false);
                    router.push('/jobs/new');
                  }}
                />
                <CreateAction
                  icon="✨"
                  title={t('nav.aiProposal')}
                  onClick={() => {
                    setSheetOpen(false);
                    router.push('/ai/proposal');
                  }}
                />
                <CreateAction
                  icon="💬"
                  title={t('nav.quickOffer')}
                  onClick={() => {
                    setSheetOpen(false);
                    router.push('/messages');
                  }}
                />
              </div>
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    </aside>
  );
}

function CreateAction({
  icon,
  title,
  onClick,
}: {
  icon: string;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 rounded-2xl border border-border bg-background p-4 text-left transition-all active:scale-[.98]"
    >
      <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/15 text-xl">
        {icon}
      </div>
      <div className="text-sm font-bold">{title}</div>
    </button>
  );
}
