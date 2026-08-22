'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

export default function CookiesPage() {
  const router = useRouter();
  return (
    <div className="min-h-dvh bg-background pb-24">
      <header className="safe-top sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 px-3 py-3 backdrop-blur-xl">
        <button onClick={() => router.back()} aria-label="Back" className="grid h-9 w-9 place-items-center rounded-full active:scale-90">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-extrabold tracking-tight">Cookies</h1>
      </header>
      <article className="mx-4 mt-4 prose prose-invert max-w-none text-sm leading-relaxed">
        <p>Apex-Work uses only strictly-necessary cookies:</p>
        <ul>
          <li><strong>apex-work-session</strong> — keeps you signed in on this device.</li>
          <li><strong>apex-work-locale</strong> — remembers your language choice.</li>
          <li><strong>apex-work-theme</strong> — remembers light/dark mode.</li>
        </ul>
        <p>We do not use advertising or third-party tracking cookies. That&rsquo;s why we don&rsquo;t need a cookie banner.</p>
      </article>
    </div>
  );
}
