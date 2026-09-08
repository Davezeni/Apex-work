'use client';

import { DesktopSidebar } from '@/components/mobile/desktop-sidebar';
import { DesktopConversationRail } from '@/components/desktop/conversation-rail';

/**
 * Desktop two-pane messenger shell for an open thread.
 *
 * Renders the app sidebar + an always-visible conversation rail beside the
 * chat on large screens (`md`/`lg`+), so a desktop user can navigate and
 * switch conversations without losing the thread. Both panes are hidden on
 * mobile, where the full-screen thread stays as-is.
 */
export default function ThreadLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh bg-background text-foreground">
      <DesktopSidebar />
      <DesktopConversationRail />
      <main className="min-h-dvh min-w-0 flex-1 overflow-x-clip">{children}</main>
    </div>
  );
}
