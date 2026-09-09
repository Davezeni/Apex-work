'use client';

import { dt } from '@/i18n/auto';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePathname } from 'next/navigation';
import {
  Compass,
  Search,
  MessageCircle,
  Briefcase,
  Bookmark,
  Bell,
  Wallet,
  User,
  Settings,
  Plus,
  Home,
  Award,
} from 'lucide-react';
import { CommandPalette, type PaletteAction } from '@/components/admin/command-palette';
import { useI18n } from '@/i18n';
/**
 * Global ⌘K / Ctrl+K command palette, mounted once in the app shell so it's
 * available on every route. Reuses the admin CommandPalette component and
 * feeds it navigation actions (all primary routes + a "new gig" compose
 * shortcut). Esc closes it; ⌘K toggles it.
 *
 * Also registers a couple of plain keyboard shortcuts:
 *   - "/" focuses the browse search (when on /browse)
 *   - "g" then "m" jumps to Messages (Gmail-style map)
 */
export function GlobalCommandPalette() {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  // Allow other UI (e.g. the desktop sidebar ⌘K button) to open the palette.
  useEffect(() => {
    const openIt = () => setOpen(true);
    window.addEventListener('apex:open-command-palette', openIt);
    return () => window.removeEventListener('apex:open-command-palette', openIt);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // ⌘K / Ctrl+K toggles the palette (don't hijack inside inputs).
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        // Allow the browser-level "open something" if already typing in an input.
        const target = e.target as HTMLElement | null;
        const inField =
          target?.tagName === 'INPUT' ||
          target?.tagName === 'TEXTAREA' ||
          target?.isContentEditable;
        if (inField) {
          // Still let ⌘K work in inputs, but don't preventDefault so native find
          // isn't broken when explicitly toggling. For simplicity we toggle.
          e.preventDefault();
        } else {
          e.preventDefault();
        }
        setOpen((v) => !v);
        return;
      }
      // "/" -> focus search on browse.
      if (e.key === '/' && pathname.startsWith('/browse')) {
        const target = e.target as HTMLElement | null;
        const inField =
          target?.tagName === 'INPUT' ||
          target?.tagName === 'TEXTAREA' ||
          target?.isContentEditable;
        if (!inField) {
          e.preventDefault();
          document.getElementById('browse-search')?.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pathname]);

  const actions: PaletteAction[] = [
    {
      id: 'home',
      label: t('nav.home'),
      hint: 'Home',
      icon: <Home className="h-4 w-4" />,
      onSelect: () => router.push('/'),
    },
    {
      id: 'browse',
      label: t('nav.browse'),
      hint: 'Explore gigs',
      icon: <Compass className="h-4 w-4" />,
      onSelect: () => router.push('/browse'),
    },
    {
      id: 'search',
      label: t('nav.search'),
      hint: 'Search everything',
      icon: <Search className="h-4 w-4" />,
      onSelect: () => router.push('/search'),
    },
    {
      id: 'messages',
      label: t('nav.chat'),
      hint: 'Messages',
      icon: <MessageCircle className="h-4 w-4" />,
      onSelect: () => router.push('/messages'),
    },
    {
      id: 'jobs',
      label: t('nav.jobs'),
      hint: 'Job board',
      icon: <Briefcase className="h-4 w-4" />,
      onSelect: () => router.push('/jobs'),
    },
    {
      id: 'saved',
      label: t('nav.saved'),
      hint: 'Saved gigs',
      icon: <Bookmark className="h-4 w-4" />,
      onSelect: () => router.push('/saved'),
    },
    {
      id: 'notifications',
      label: t('nav.notifications'),
      hint: 'Notifications',
      icon: <Bell className="h-4 w-4" />,
      onSelect: () => router.push('/notifications'),
    },
    {
      id: 'wallet',
      label: t('nav.wallet'),
      hint: 'Wallet & earnings',
      icon: <Wallet className="h-4 w-4" />,
      onSelect: () => router.push('/wallet'),
    },
    {
      id: 'profile',
      label: t('nav.profile'),
      hint: 'Your profile',
      icon: <User className="h-4 w-4" />,
      onSelect: () => router.push('/profile'),
    },
    {
      id: 'settings',
      label: t('nav.settings'),
      hint: 'Settings',
      icon: <Settings className="h-4 w-4" />,
      onSelect: () => router.push('/settings'),
    },
    {
      id: 'new-gig',
      label: t('nav.postGig'),
      hint: 'Compose',
      icon: <Plus className="h-4 w-4" />,
      onSelect: () => router.push('/gigs/new'),
    },
    {
      id: 'achievements',
      label: t('nav.achievements'),
      hint: 'Milestones',
      icon: <Award className="h-4 w-4" />,
      onSelect: () => router.push('/achievements'),
    },
  ];

  return (
    <CommandPalette
      open={open}
      onClose={() => setOpen(false)}
      actions={actions}
      placeholder={dt('Search or jump to…')}
    />
  );
}
