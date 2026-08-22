'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, FileText, Shield, Cookie, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useI18n } from '@/i18n';

export default function LegalPage() {
  const router = useRouter();
  const { t } = useI18n();

  return (
    <div className="min-h-dvh bg-background pb-24">
      <header className="safe-top sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 px-3 py-3 backdrop-blur-xl">
        <button onClick={() => router.back()} aria-label={t('common.back')} className="grid h-9 w-9 place-items-center rounded-full active:scale-90">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-extrabold tracking-tight">Legal & Privacy</h1>
      </header>

      <section className="mx-4 mt-6 text-center">
        <div className="grad-hero mx-auto grid h-16 w-16 place-items-center rounded-2xl text-white shadow-lg shadow-primary/40">
          <span className="text-2xl font-extrabold">A</span>
        </div>
        <div className="mt-3 text-xl font-extrabold">Apex-Work</div>
        <div className="text-xs text-muted-foreground">Version 1.0.0 · Made in Ethiopia 🇪🇹</div>
      </section>

      <div className="mx-3 mt-6 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
        <LegalRow href="/legal/terms" icon={<FileText className="h-4 w-4" />} label="Terms of Service" />
        <LegalRow href="/legal/privacy" icon={<Shield className="h-4 w-4" />} label="Privacy Policy" />
        <LegalRow href="/legal/cookies" icon={<Cookie className="h-4 w-4" />} label="Cookies" />
        <LegalRow href="/settings/delete" icon={<Trash2 className="h-4 w-4" />} label="Delete my account" destructive />
      </div>

      <p className="mx-4 mt-8 text-center text-[11px] text-muted-foreground">
        © 2026 Apex-Work. All rights reserved. Built with ❤️ for Ethiopia.
      </p>
    </div>
  );
}

function LegalRow({
  href, icon, label, destructive,
}: { href: string; icon: React.ReactNode; label: string; destructive?: boolean }) {
  return (
    <Link href={href} className="flex items-center gap-3 px-4 py-3.5 text-sm font-semibold active:bg-muted">
      <span className={destructive ? 'text-red-500' : 'text-muted-foreground'}>{icon}</span>
      <span className={destructive ? 'text-red-500' : ''}>{label}</span>
    </Link>
  );
}
