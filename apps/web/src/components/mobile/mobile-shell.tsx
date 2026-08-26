'use client';

import { ReactNode, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Home, Search, MessageCircle, User, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Drawer } from 'vaul';
import { cn } from '@/lib/utils';
import { useOnboardingGuard } from '@/hooks/use-onboarding-guard';
import { useNotificationSocket } from '@/hooks/use-notifications';
import { useConversations } from '@/hooks/use-chat';
import { PwaInstall } from '@/components/pwa-install';

export type MobileTab = 'home' | 'search' | 'chat' | 'profile';

const TABS: { id: MobileTab; label: string; icon: typeof Home; href: string }[] = [
  { id: 'home', label: 'Home', icon: Home, href: '/' },
  { id: 'search', label: 'Search', icon: Search, href: '/search' },
  { id: 'chat', label: 'Chat', icon: MessageCircle, href: '/messages' },
  { id: 'profile', label: 'Profile', icon: User, href: '/profile' },
];

interface Props {
  children: ReactNode;
  activeTab?: MobileTab;
  /** Set false on chat sub-pages etc where you want the input bar to overlap */
  showTabBar?: boolean;
}

export function MobileShell({ children, activeTab, showTabBar = true }: Props) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  // Auto-redirect freelancers who haven't finished onboarding.
  useOnboardingGuard();
  // Subscribe to the user's realtime notification stream (silent when signed out).
  useNotificationSocket();
  const { data: conversations } = useConversations();
  const unreadChats = conversations?.items.reduce((total, item) => total + item.unread, 0) ?? 0;

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
    <div className="min-h-dvh bg-background text-foreground">
      <main className={cn('min-h-dvh', showTabBar && 'safe-b-nav')}>{children}</main>
      <PwaInstall />

      {showTabBar && (
        <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/85 backdrop-blur-xl backdrop-saturate-150">
          <div className="mx-auto grid max-w-md grid-cols-5 items-center px-4 pt-1 pb-1.5">
            {TABS.slice(0, 2).map((t) => (
              <TabButton key={t.id} tab={t} active={currentTab === t.id} onClick={haptic} />
            ))}

            {/* Center FAB */}
            <div className="-mt-4 flex justify-center">
              <button
                onClick={() => {
                  haptic();
                  setSheetOpen(true);
                }}
                aria-label="Create"
                className="grad-hero grid h-11 w-11 place-items-center rounded-full text-white shadow-xl shadow-primary/50 transition-transform active:scale-90"
              >
                <Plus className="h-5 w-5" strokeWidth={2.5} />
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
          <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 mt-24 flex h-auto flex-col rounded-t-3xl border border-border border-b-0 bg-card focus:outline-none">
            <div className="mx-auto mt-3 h-1.5 w-10 rounded-full bg-muted" />
            <div className="p-6">
              <Drawer.Title className="text-xl font-extrabold">Create</Drawer.Title>
              <Drawer.Description className="mt-1 text-sm text-muted-foreground">
                What would you like to do today?
              </Drawer.Description>
              <div className="mt-5 flex flex-col gap-2">
                <SheetAction
                  icon="💼"
                  title="Post a Gig"
                  subtitle="Sell your service · Fixed price"
                  onClick={() => {
                    setSheetOpen(false);
                    router.push('/gigs/new');
                  }}
                  color="violet"
                />
                <SheetAction
                  icon="📢"
                  title="Post a Job"
                  subtitle="Hire freelancers · Get bids"
                  onClick={() => {
                    setSheetOpen(false);
                    router.push('/jobs/new');
                  }}
                  color="green"
                />
                <SheetAction
                  icon="✨"
                  title="AI Proposal"
                  subtitle="Let AI write your proposal"
                  onClick={() => {
                    setSheetOpen(false);
                    router.push('/ai/proposal');
                  }}
                  color="amber"
                />
                <SheetAction
                  icon="💬"
                  title="Send Quick Offer"
                  subtitle="Custom offer to a client"
                  onClick={() => {
                    setSheetOpen(false);
                    router.push('/messages');
                  }}
                  color="cyan"
                />
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
  return (
    <Link
      href={tab.href}
      onClick={onClick}
      className={cn(
        'relative flex flex-col items-center gap-0.5 rounded-xl py-1 text-[10px] font-semibold transition-colors',
        active ? 'text-primary' : 'text-muted-foreground',
      )}
    >
      <motion.div animate={{ scale: active ? 1.1 : 1 }} transition={{ type: 'spring', stiffness: 400, damping: 20 }}>
        <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} />
      </motion.div>
      <span>{tab.label}</span>
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
      <div className={cn('grid h-11 w-11 place-items-center rounded-xl text-xl', bgs[color])}>{icon}</div>
      <div className="flex-1">
        <div className="text-sm font-bold">{title}</div>
        <div className="text-xs text-muted-foreground">{subtitle}</div>
      </div>
    </button>
  );
}
