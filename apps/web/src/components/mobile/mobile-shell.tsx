'use client';

import { dt } from '@/i18n/auto';
import { ReactNode, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Home, Search, MessageCircle, User, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Drawer } from 'vaul';
import { cn } from '@/lib/utils';
import { useOnboardingGuard } from '@/hooks/use-onboarding-guard';

import { useConversations } from '@/hooks/use-chat';
import { useI18n } from '@/i18n';
import { PwaInstall } from '@/components/pwa-install';
import { DesktopSidebar } from '@/components/mobile/desktop-sidebar';
import { useIncomingCall } from '@/hooks/use-incoming-call';
import { ThemeToggle } from '@/components/theme-toggle';
import { useAuthStore } from '@/stores/auth-store';
import { useMe } from '@/hooks/use-me';
import { Phone, PhoneOff } from 'lucide-react';
export type MobileTab = 'home' | 'search' | 'chat' | 'profile';

const TABS: { id: MobileTab; labelKey: string; icon: typeof Home; href: string }[] = [
  { id: 'home', labelKey: 'nav.home', icon: Home, href: '/' },
  { id: 'search', labelKey: 'nav.search', icon: Search, href: '/search' },
  { id: 'chat', labelKey: 'nav.chat', icon: MessageCircle, href: '/messages' },
  { id: 'profile', labelKey: 'nav.profile', icon: User, href: '/profile' },
];

interface Props {
  children: ReactNode;
  activeTab?: MobileTab;
  /** Set false on chat sub-pages etc where you want the input bar to overlap */
  showTabBar?: boolean;
}

export function MobileShell({ children, activeTab, showTabBar = true }: Props) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const { data: me } = useMe();
  const isFreelancer = me?.role === 'FREELANCER';
  const isClient = me?.role === 'CLIENT';
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useI18n();

  // Auto-redirect freelancers who haven't finished onboarding.
  useOnboardingGuard();
  const { data: conversations } = useConversations();
  const unreadChats = conversations?.items.reduce((total, item) => total + item.unread, 0) ?? 0;

  // Global incoming-call ring — visible on every page while signed in.
  const token = useAuthStore((st) => st.accessToken);
  const { incoming: incomingCall, dismiss: dismissCall } = useIncomingCall(!!token);

  const currentTab: MobileTab | undefined =
    activeTab ??
    (pathname === '/'
      ? 'home'
      : pathname.startsWith('/search')
        ? 'search'
        : pathname.startsWith('/messages')
          ? 'chat'
          : pathname.startsWith('/profile')
            ? 'profile'
            : undefined);

  const haptic = () => {
    if (typeof window !== 'undefined' && 'vibrate' in window.navigator) {
      window.navigator.vibrate?.(8);
    }
  };

  return (
    <div className="flex min-h-dvh bg-background text-foreground">
      {/* Desktop: persistent left sidebar; Mobile: hidden (bottom nav instead). */}
      <DesktopSidebar />
      {/* Global incoming-call ring */}
      {incomingCall && (
        <div className="fixed inset-x-0 top-0 z-[120] flex justify-center px-3 pt-3">
          <div className="grad-hero w-full max-w-md rounded-2xl p-4 text-white shadow-2xl shadow-primary/40 ring-1 ring-white/20">
            <div className="flex items-center gap-3">
              <span className="relative flex h-3 w-3 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-75" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-400" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-extrabold">
                  {incomingCall.mode === 'video' ? '📹' : '📞'} Incoming {incomingCall.mode} call
                </div>
                <div className="truncate text-xs text-white/80">
                  {incomingCall.callerName ?? 'Someone'} — Apex-Work
                </div>
              </div>
              <button
                onClick={() => {
                  dismissCall();
                  router.push(`/messages/${incomingCall.conversationId}?call=${incomingCall.mode}`);
                }}
                className="grid h-11 w-11 place-items-center rounded-full bg-emerald-500 shadow-lg active:scale-90"
                aria-label="Answer"
              >
                <Phone className="h-5 w-5" />
              </button>
              <button
                onClick={dismissCall}
                className="grid h-11 w-11 place-items-center rounded-full bg-red-600 shadow-lg active:scale-90"
                aria-label="Decline"
              >
                <PhoneOff className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      )}
      {/* No per-route remount / entrance animation: re-keying <main> on
          pathname replays a 250ms animation and remounts heavy pages on every
          navigation, which made taps feel swallowed ("need a second click")
          and slowed transitions on mid/low-end phones. */}
      <main
        className={cn(
          'safe-head-room min-h-dvh min-w-0 flex-1',
          showTabBar && 'safe-b-nav',
          'md:pb-0',
        )}
      >
        {children}
      </main>
      <PwaInstall />

      {/* Desktop theme toggle — fixed top-right corner (the old floating +
          here was removed: the sidebar Create is the single add affordance). */}
      <div className="fixed right-4 top-4 z-[60] hidden rounded-full border border-border bg-background/80 shadow-md backdrop-blur md:block">
        <ThemeToggle />
      </div>

      {showTabBar && (
        <nav className="safe-bottom mobile-bottom-nav fixed inset-x-0 bottom-0 z-40 md:hidden">
          <div className="mobile-bottom-nav__bar mx-auto grid max-w-md grid-cols-5 items-center px-4 pb-1.5 pt-1">
            <svg
              aria-hidden="true"
              className="mobile-bottom-nav__surface absolute inset-0 h-full w-full"
              viewBox="0 0 100 20"
              preserveAspectRatio="none"
            >
              <path
                className="mobile-bottom-nav__surface-path"
                d="M0 0H34C38 0 39 6 43 9C45 11 47 12 50 12C53 12 55 11 57 9C61 6 62 0 66 0H100V20H0Z"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
            {TABS.slice(0, 2).map((t) => (
              <TabButton key={t.id} tab={t} active={currentTab === t.id} onClick={haptic} />
            ))}

            {/* Center FAB — same action, size, color, and grid position as before. */}
            <div className="mobile-bottom-nav__create relative z-10 -mt-4 flex justify-center">
              <button
                onClick={() => {
                  haptic();
                  setSheetOpen(true);
                }}
                aria-label={dt('Create')}
                className="mobile-bottom-nav__create-button grad-hero grid h-12 w-12 place-items-center rounded-full text-white shadow-xl shadow-primary/50 ring-1 ring-primary-foreground/20 transition-transform active:scale-90"
              >
                <Plus className="h-5 w-5" strokeWidth={3} />
              </button>
            </div>

            {TABS.slice(2).map((t) => (
              <TabButton
                key={t.id}
                tab={t}
                active={currentTab === t.id}
                onClick={haptic}
                badge={t.id === 'chat' && unreadChats > 0 ? unreadChats : undefined}
              />
            ))}
          </div>
        </nav>
      )}

      {/* Create sheet */}
      <Drawer.Root open={sheetOpen} onOpenChange={setSheetOpen}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />
          <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 mt-24 flex h-auto flex-col rounded-t-3xl border border-b-0 border-border bg-card focus:outline-none">
            <div className="mx-auto mt-3 h-1.5 w-10 rounded-full bg-muted" />
            <div className="p-6">
              <Drawer.Title className="text-xl font-extrabold">{t('create.title')}</Drawer.Title>
              <Drawer.Description className="mt-1 text-sm text-muted-foreground">
                {t('chat.createToday')}
              </Drawer.Description>
              <div className="mt-5 flex flex-col gap-2">
                {!isClient && (
                <SheetAction
                  icon="💼"
                  title={t('create.postGig')}
                  subtitle={t('create.postGigSub')}
                  onClick={() => {
                    setSheetOpen(false);
                    router.push('/gigs/new');
                  }}
                  color="violet"
                />
                )}
                {isFreelancer ? (
                <SheetAction
                  icon="📄"
                  title={dt('Build CV / Resume')}
                  subtitle={dt('Create or import your CV')}
                  onClick={() => {
                    setSheetOpen(false);
                    router.push('/resume');
                  }}
                  color="green"
                />
                ) : (
                <SheetAction
                  icon="📢"
                  title={t('create.postJob')}
                  subtitle={t('create.postJobSub')}
                  onClick={() => {
                    setSheetOpen(false);
                    router.push('/jobs/new');
                  }}
                  color="green"
                />
                )}
                {!isClient && (
                <SheetAction
                  icon="✨"
                  title={t('create.aiProposal')}
                  subtitle={t('create.aiProposalSub')}
                  onClick={() => {
                    setSheetOpen(false);
                    router.push('/ai/proposal');
                  }}
                  color="amber"
                />
                )}
                {!isClient && (
                <SheetAction
                  icon="💬"
                  title={t('create.quickOffer')}
                  subtitle={t('create.quickOfferSub')}
                  onClick={() => {
                    setSheetOpen(false);
                    router.push('/messages');
                  }}
                  color="cyan"
                />
                )}
              </div>
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    </div>
  );
}

function TabButton({
  tab,
  active,
  onClick,
  badge,
}: {
  tab: (typeof TABS)[number];
  active: boolean;
  onClick?: () => void;
  badge?: number;
}) {
  const Icon = tab.icon;
  const { t } = useI18n();
  return (
    <Link
      href={tab.href}
      onClick={onClick}
      className={cn(
        'relative flex flex-col items-center gap-0.5 rounded-xl py-1 text-[10px] font-semibold transition-colors',
        active ? 'text-primary' : 'text-muted-foreground',
      )}
    >
      <motion.div
        animate={{ scale: active ? 1.1 : 1 }}
        transition={{ type: 'spring', stiffness: 400, damping: 20 }}
      >
        <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} />
      </motion.div>
      <span>{t(tab.labelKey)}</span>
      <AnimatePresence>
        {badge !== undefined && badge > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            className="absolute right-3 top-1 grid min-w-[18px] items-center rounded-full border-2 border-background bg-destructive px-1.5 text-[10px] font-bold text-white"
          >
            {badge > 99 ? '99+' : badge}
          </motion.span>
        )}
      </AnimatePresence>
    </Link>
  );
}

function SheetAction({
  icon,
  title,
  subtitle,
  onClick,
  color,
}: {
  icon: string;
  title: string;
  subtitle: string;
  onClick?: () => void;
  color: 'violet' | 'green' | 'amber' | 'cyan';
}) {
  const bgs = {
    violet: 'bg-violet-500/15 text-violet-400',
    green: 'bg-emerald-500/15 text-emerald-400',
    amber: 'bg-amber-500/15 text-amber-400',
    cyan: 'bg-cyan-500/15 text-cyan-400',
  } as const;
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 rounded-2xl border border-border bg-background p-4 text-left transition-all active:scale-[.98]"
    >
      <div className={cn('grid h-11 w-11 place-items-center rounded-xl text-xl', bgs[color])}>
        {icon}
      </div>
      <div className="flex-1">
        <div className="text-sm font-bold">{title}</div>
        <div className="text-xs text-muted-foreground">{subtitle}</div>
      </div>
    </button>
  );
}
