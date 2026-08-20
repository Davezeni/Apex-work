'use client';

import Link from 'next/link';
import { MobileShell } from '@/components/mobile/mobile-shell';
import { Search, Edit3 } from 'lucide-react';
import { cn } from '@/lib/utils';

const CHATS = [
  { id: 'selam', name: 'Selam Assefa', preview: 'typing…', time: 'now', unread: 3, online: true, typing: true, initials: 'SA', gradient: 'from-violet-500 to-emerald-500' },
  { id: 'dawit', name: 'Dawit Tesfaye', preview: '🎤 Voice message · 0:24', time: '12m', unread: 1, initials: 'DT', gradient: 'from-amber-500 to-red-500' },
  { id: 'hanna', name: 'Hanna Wolde', preview: "Great, I'll send the draft tonight 🌙", time: '1h', initials: 'HW', gradient: 'from-cyan-500 to-violet-500' },
  { id: 'team', name: 'Team · Habesha Design', preview: 'Meron: Uploaded new brief', time: '3h', unread: 7, online: true, initials: 'TP', gradient: 'from-emerald-500 to-amber-500' },
  { id: 'tsion', name: 'Tsion G.', preview: '✓✓ Payment received — thank you!', time: 'Yesterday', initials: 'TG', gradient: 'from-red-500 to-violet-500' },
  { id: 'ai', name: 'Apex-Work AI', preview: '💡 3 new matching jobs for you', time: 'Mon', initials: '🤖', gradient: 'from-primary to-accent' },
];

export default function MessagesPage() {
  return (
    <MobileShell activeTab="chat">
      <header className="safe-top flex items-center justify-between px-5 pb-3 pt-4">
        <h1 className="text-2xl font-extrabold tracking-tight">Messages</h1>
        <div className="flex gap-2">
          <button aria-label="Search" className="grid h-10 w-10 place-items-center rounded-full border border-border bg-card">
            <Search className="h-4 w-4" />
          </button>
          <button aria-label="New" className="grid h-10 w-10 place-items-center rounded-full border border-border bg-card">
            <Edit3 className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="px-2">
        {CHATS.map((c) => (
          <Link key={c.id} href={`/messages/${c.id}`} className="flex items-center gap-3 rounded-2xl p-3 active:bg-card">
            <div className="relative">
              <div className={cn('grid h-13 w-13 h-[52px] w-[52px] place-items-center rounded-full bg-gradient-to-br text-lg font-bold text-white', c.gradient)}>
                {c.initials}
              </div>
              {c.online && (
                <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-[3px] border-background bg-emerald-500" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <h4 className="truncate text-[15px] font-semibold">{c.name}</h4>
                <span className="shrink-0 text-[11px] text-muted-foreground">{c.time}</span>
              </div>
              <div className="mt-1 flex items-center justify-between gap-2">
                <p className={cn('truncate text-[13px] text-muted-foreground', c.typing && 'italic text-emerald-500')}>
                  {c.preview}
                </p>
                {c.unread && (
                  <span className="grid h-[22px] min-w-[22px] shrink-0 place-items-center rounded-full bg-primary px-2 text-[11px] font-bold text-primary-foreground">
                    {c.unread}
                  </span>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </MobileShell>
  );
}
