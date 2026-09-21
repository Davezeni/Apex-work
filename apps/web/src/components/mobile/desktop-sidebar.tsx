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
  LogOut,
  ChevronLeft,
  ChevronRight,
  ShoppingBag,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Drawer } from 'vaul';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { dt } from '@/i18n/auto';
import { useConversations } from '@/hooks/use-chat';
import { useMe } from '@/hooks/use-me';
import { useUnreadCount } from '@/hooks/use-notifications';
import { useAuthStore } from '@/stores/auth-store';
import { UserAvatar } from '@/components/ui/user-avatar';
import { NotificationsPanel } from '@/components/notifications-panel';
import { useI18n } from '@/i18n';

interface NavItem {
  label: string;
  icon: typeof Home;
  href: string;
  badge?: number;
}

const COLLAPSE_KEY = 'apex-sidebar-collapsed';

export function DesktopSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useI18n();
  const { data: me } = useMe();
  const clear = useAuthStore((s) => s.clear);
  const [sheetOpen, setSheetOpen] = useState(false);
  const { data: conversations } = useConversations();
  const unreadChats = conversations?.items.reduce((total, item) => total + item.unread, 0) ?? 0;
  const { data: notif } = useUnreadCount();
  const unreadNotifs = notif?.count ?? 0;

  // Collapsed state is persisted so the user's preference sticks across visits.
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === '1');
    } catch {
      /* ignore */
    }
  }, []);
  const toggleCollapse = () => {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    const [base, query] = href.split('?');
    if (!base || !pathname.startsWith(base)) return false;
    // Links that target a specific tab only light up for that tab.
    if (query) {
      if (typeof window === 'undefined') return false;
      return window.location.search.includes(query);
    }
    return true;
  };

  const isFreelancer = me?.role === 'FREELANCER';
  const isClient = me?.role === 'CLIENT';
  const main: NavItem[] = [
    // Freelancers: Browse (= posted jobs; /browse is role-pure → jobs) + Gigs.
    // Clients: Browse (gigs) + Jobs.
    // (Role items wait for `me` to load so they never flash the wrong way.)
    ...(isFreelancer
      ? [
          { label: t('nav.browse'), icon: Compass, href: '/browse' },
          { label: dt('Gigs'), icon: ShoppingBag, href: '/browse?tab=gigs' },
        ]
      : me
        ? [
            { label: t('nav.browse'), icon: Compass, href: '/browse' },
            { label: t('nav.jobs'), icon: Briefcase, href: '/jobs' },
          ]
        : []),
    { label: t('nav.search'), icon: Search, href: '/search' },
    { label: t('nav.chat'), icon: MessageCircle, href: '/messages', badge: unreadChats },
    { label: t('nav.saved'), icon: Bookmark, href: '/saved' },
    { label: t('nav.notifications'), icon: Bell, href: '/notifications', badge: unreadNotifs },
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
        title={collapsed ? it.label : undefined}
        className={cn(
          'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors',
          active
            ? 'bg-primary/15 text-primary'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
          collapsed && 'justify-center px-0',
        )}
      >
        <Icon className="h-5 w-5 shrink-0" strokeWidth={active ? 2.5 : 2} />
        {!collapsed && <span className="flex-1 truncate">{it.label}</span>}
        {/* Always show counters (0 = muted chip) so it's obvious the inbox is empty. */}
        {!collapsed && it.badge != null && (
          <span
            className={cn(
              'grid min-w-[20px] place-items-center rounded-full px-1.5 py-0.5 text-[10px] font-bold',
              it.badge > 0 ? 'bg-destructive text-white' : 'bg-muted text-muted-foreground',
            )}
          >
            {it.badge > 99 ? '99+' : it.badge}
          </span>
        )}
        {collapsed && it.badge != null && (
          <span
            className={cn(
              'absolute right-1.5 top-1.5 grid h-4 min-w-[16px] place-items-center rounded-full px-1 text-[9px] font-bold',
              it.badge > 0 ? 'bg-destructive text-white' : 'bg-muted text-muted-foreground',
            )}
          >
            {it.badge > 99 ? '99+' : it.badge}
          </span>
        )}
        {/* Active rail indicator */}
        {active && (
          <motion.span
            layoutId="sidebar-rail"
            className={cn(
              'absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-primary',
              !collapsed && 'hidden',
            )}
          />
        )}
      </Link>
    );
  };

  return (
    <>
      {/* In-flow spacer: reserves the sidebar's slot in the flex row and
          animates in lockstep so page content shifts smoothly on collapse.
          The real bar is FIXED — it can never scroll up/down with the page. */}
      <motion.div
        aria-hidden
        animate={{ width: collapsed ? 76 : 256 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="hidden shrink-0 md:block"
      />
      <motion.aside
        initial={false}
        animate={{ width: collapsed ? 76 : 256 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="fixed inset-y-0 left-0 z-40 hidden flex-col overflow-hidden border-r border-border bg-card/60 backdrop-blur-xl md:flex"
      >
        {/* Logo / brand. Collapsed: the expand button gets its own full-size
          row under the logo — squeezing it into the 76px row made it nearly
          impossible to find/tap. */}
        {collapsed ? (
          <div className="flex flex-col items-center gap-2 px-3 py-4">
            <Link href="/" className="flex shrink-0">
              <div className="grad-hero grid h-9 w-9 place-items-center rounded-xl text-lg font-extrabold text-white shadow-lg shadow-primary/40">
                A
              </div>
            </Link>
            <button
              onClick={toggleCollapse}
              aria-label="Expand sidebar"
              title="Expand"
              className="grid h-10 w-10 place-items-center rounded-xl border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-90"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2.5 px-4 py-5">
            <Link href="/" className="flex shrink-0 items-center gap-2.5">
              <div className="grad-hero grid h-9 w-9 place-items-center rounded-xl text-lg font-extrabold text-white shadow-lg shadow-primary/40">
                A
              </div>
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="whitespace-nowrap text-lg font-extrabold tracking-tight"
              >
                Apex-Work
              </motion.span>
            </Link>
            <div className="ml-auto flex items-center gap-0.5">
              <button
                onClick={toggleCollapse}
                aria-label="Collapse sidebar"
                title="Collapse"
                className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Command launcher (⌘K / Ctrl+K) — a quick way to jump anywhere. */}
        {!collapsed && (
          <div className="px-4 pb-1">
            <button
              type="button"
              onClick={() => window.dispatchEvent(new Event('apex:open-command-palette'))}
              className="flex w-full items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-muted"
            >
              <Search className="h-4 w-4 shrink-0" />
              <span className="flex-1">Search or jump to…</span>
              <kbd className="rounded-md border border-border bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                ⌘K
              </kbd>
            </button>
          </div>
        )}

        {/* Create */}
        <div className="px-4">
          {!collapsed ? (
            <button
              onClick={() => setSheetOpen(true)}
              className="grad-hero flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold text-white shadow-lg shadow-primary/30 transition-all hover:shadow-xl hover:brightness-110"
            >
              <Plus className="h-4 w-4" strokeWidth={2.5} />
              {t('nav.create')}
            </button>
          ) : (
            <button
              onClick={() => setSheetOpen(true)}
              title={t('nav.create')}
              className="grad-hero mx-auto grid h-10 w-10 place-items-center rounded-xl text-white shadow-lg shadow-primary/30 transition-transform hover:scale-105"
            >
              <Plus className="h-5 w-5" strokeWidth={2.5} />
            </button>
          )}
        </div>

        {/* Nav */}
        <nav className="mt-4 flex-1 space-y-1 overflow-y-auto px-4">
          {!collapsed && (
            <div className="mb-1 px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
              {t('nav.workspace')}
            </div>
          )}
          {main.map((it) => (
            <Item key={it.href} it={it} />
          ))}
          {!collapsed && (
            <div className="mb-1 mt-4 px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
              {t('nav.account')}
            </div>
          )}
          {other.map((it) => (
            <Item key={it.href} it={it} />
          ))}
        </nav>

        {/* Bottom: user card + sign out */}
        {me && (
          <div className="border-t border-border p-4">
            <div className={cn('flex items-center gap-3', collapsed && 'justify-center gap-0')}>
              <Link href="/profile">
                <UserAvatar
                  name={me.fullName}
                  avatarUrl={me.avatarUrl}
                  id={me.id}
                  verified={me.isVerified}
                  className="h-9 w-9 text-sm font-bold"
                />
              </Link>
              {!collapsed && (
                <>
                  <div className="min-w-0 flex-1">
                    <Link
                      href="/profile"
                      className="block truncate text-sm font-bold hover:text-primary"
                    >
                      {me.fullName}
                    </Link>
                    <div className="truncate text-[11px] text-muted-foreground">@{me.username}</div>
                  </div>
                  <NotificationsPanel align="left" className="shrink-0" />
                  <Link
                    href="/settings"
                    title={t('nav.settings')}
                    className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <Settings className="h-4 w-4" />
                  </Link>
                </>
              )}
            </div>
            {!collapsed && (
              <button
                onClick={signOut}
                className="mt-3 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              >
                <LogOut className="h-4 w-4" />
                {t('nav.signOut')}
              </button>
            )}
            {collapsed && (
              <button
                onClick={signOut}
                title={t('nav.signOut')}
                className="mx-auto mt-3 grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              >
                <LogOut className="h-4 w-4" />
              </button>
            )}
          </div>
        )}

        {/* Create sheet */}
        <Drawer.Root open={sheetOpen} onOpenChange={setSheetOpen}>
          <Drawer.Portal>
            <Drawer.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />
            <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 mt-24 flex h-auto flex-col rounded-t-3xl border border-b-0 border-border bg-card focus:outline-none">
              <div className="mx-auto mt-3 h-1.5 w-10 rounded-full bg-muted" />
              <div className="p-6">
                <Drawer.Title className="text-xl font-extrabold">{t('nav.create')}</Drawer.Title>
                <div className="mt-5 grid gap-2 sm:grid-cols-2">
                  {!isClient && (
                    <CreateAction
                      icon="💼"
                      title={t('nav.postGig')}
                      onClick={() => {
                        setSheetOpen(false);
                        router.push('/gigs/new');
                      }}
                    />
                  )}
                  {isFreelancer ? (
                    <CreateAction
                      icon="📄"
                      title={dt('Build CV / Resume')}
                      onClick={() => {
                        setSheetOpen(false);
                        router.push('/resume');
                      }}
                    />
                  ) : (
                    <CreateAction
                      icon="📢"
                      title={t('nav.postJob')}
                      onClick={() => {
                        setSheetOpen(false);
                        router.push('/jobs/new');
                      }}
                    />
                  )}
                  {!isClient && (
                    <CreateAction
                      icon="✨"
                      title={t('nav.aiProposal')}
                      onClick={() => {
                        setSheetOpen(false);
                        router.push('/ai/proposal');
                      }}
                    />
                  )}
                  {!isClient && (
                    <CreateAction
                      icon="💬"
                      title={t('nav.quickOffer')}
                      onClick={() => {
                        setSheetOpen(false);
                        router.push('/messages');
                      }}
                    />
                  )}
                </div>
              </div>
            </Drawer.Content>
          </Drawer.Portal>
        </Drawer.Root>
      </motion.aside>
    </>
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
      className="flex items-center gap-3 rounded-2xl border border-border bg-background p-4 text-left transition-all hover:border-primary/40 hover:shadow-md active:scale-[.98]"
    >
      <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/15 text-xl">
        {icon}
      </div>
      <div className="text-sm font-bold">{title}</div>
    </button>
  );
}
