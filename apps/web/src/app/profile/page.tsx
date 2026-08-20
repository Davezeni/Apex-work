'use client';

import { MobileShell } from '@/components/mobile/mobile-shell';
import { Button } from '@/components/ui/button';
import { CheckCircle2, CreditCard, Calendar, Settings, LogOut, ChevronRight } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { useRouter } from 'next/navigation';
import { formatEtb } from '@/lib/utils';

const SKILLS = ['Figma', 'UI/UX', 'Design Systems', 'Webflow', 'Branding'];

export default function ProfilePage() {
  const clear = useAuthStore((s) => s.clear);
  const router = useRouter();

  const logout = () => {
    clear();
    router.push('/');
  };

  return (
    <MobileShell activeTab="profile">
      {/* Hero */}
      <div className="relative pb-6 pt-6 text-center">
        <div className="grad-hero absolute inset-x-0 top-0 h-32 opacity-50" />
        <div className="relative">
          <div className="grad-hero mx-auto grid h-20 w-20 place-items-center rounded-full text-3xl font-bold text-white ring-4 ring-background">
            S
          </div>
          <h2 className="mt-3 flex items-center justify-center gap-1.5 text-xl font-extrabold">
            Selamawit Kebede
            <CheckCircle2 className="h-4 w-4 text-cyan-400" />
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Product Designer · Freelancer</p>
          <p className="text-[11px] text-muted-foreground">📍 Addis Ababa, Ethiopia</p>
        </div>
      </div>

      {/* Stats */}
      <div className="mx-5 grid grid-cols-3 rounded-2xl border border-border bg-card p-4">
        <Stat n="4.9" l="Rating" />
        <Stat n="128" l="Orders" borderLeft />
        <Stat n="98%" l="On-time" borderLeft />
      </div>

      {/* Actions */}
      <div className="mx-5 mt-4 flex gap-2">
        <Button variant="brand" className="flex-1">Edit profile</Button>
        <Button variant="secondary" className="flex-1">Share</Button>
      </div>

      {/* Wallet */}
      <div className="grad-hero mx-5 mt-4 rounded-2xl p-5 text-white shadow-xl shadow-primary/40">
        <div className="text-xs opacity-90">Available balance</div>
        <div className="mt-1 text-3xl font-extrabold tracking-tight">
          {formatEtb(48320)}
        </div>
        <div className="mt-4 flex gap-2">
          <button className="flex-1 rounded-xl bg-white/20 py-2.5 text-xs font-bold backdrop-blur">💸 Withdraw</button>
          <button className="flex-1 rounded-xl bg-white/20 py-2.5 text-xs font-bold backdrop-blur">📊 History</button>
        </div>
      </div>

      {/* Skills */}
      <div className="mt-6 px-5 pb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">Skills</div>
      <div className="flex flex-wrap gap-1.5 px-5 pb-4">
        {SKILLS.map((s) => (
          <span key={s} className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground">
            {s}
          </span>
        ))}
      </div>

      {/* Menu */}
      <div className="mt-2 px-5 pb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">Account</div>
      <div className="px-3 pb-8">
        <MenuItem icon={<CreditCard className="h-4 w-4" />} title="Payment methods" subtitle="Telebirr, CBE Birr" />
        <MenuItem icon={<Calendar className="h-4 w-4" />} title="Availability" subtitle="Mon–Fri · 9AM–6PM" />
        <MenuItem icon={<Settings className="h-4 w-4" />} title="Settings" subtitle="Language, notifications" />
        <MenuItem icon={<LogOut className="h-4 w-4" />} title="Sign out" onClick={logout} destructive />
      </div>
    </MobileShell>
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
  destructive,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  onClick?: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors active:bg-card"
    >
      <div className={`grid h-10 w-10 place-items-center rounded-xl bg-card ${destructive ? 'text-destructive' : 'text-primary'}`}>
        {icon}
      </div>
      <div className="flex-1">
        <div className={`text-sm font-semibold ${destructive ? 'text-destructive' : ''}`}>{title}</div>
        {subtitle && <div className="text-[11px] text-muted-foreground">{subtitle}</div>}
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </button>
  );
}
