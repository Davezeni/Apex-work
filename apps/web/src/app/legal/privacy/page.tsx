'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

export default function PrivacyPage() {
  const router = useRouter();
  return (
    <div className="min-h-dvh bg-background pb-24">
      <header className="safe-top sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 px-3 py-3 backdrop-blur-xl">
        <button onClick={() => router.back()} aria-label="Back" className="grid h-9 w-9 place-items-center rounded-full active:scale-90">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-extrabold tracking-tight">Privacy Policy</h1>
      </header>
      <article className="mx-4 mt-4 prose prose-invert max-w-none text-sm leading-relaxed">
        <p className="text-xs text-muted-foreground">Last updated: August 2026</p>
        <h2 className="mt-4 text-base font-bold">Data we collect</h2>
        <p>Phone number, name, email (optional), profile info you provide, uploaded portfolio, chat messages, payment info processed via Chapa.</p>
        <h2 className="mt-4 text-base font-bold">How we use it</h2>
        <p>To operate the platform, verify your identity, process payments, send notifications, and prevent fraud. We do not sell your data.</p>
        <h2 className="mt-4 text-base font-bold">Storage & security</h2>
        <p>Data lives in encrypted Neon Postgres (Frankfurt) and Supabase Storage. Passwords/PINs are Argon2-hashed. Passkeys are cryptographic — we never see your biometrics.</p>
        <h2 className="mt-4 text-base font-bold">Your rights</h2>
        <p>You can export or delete your data at any time from Settings → Account. We honor requests within 30 days.</p>
        <h2 className="mt-4 text-base font-bold">Cookies</h2>
        <p>We use strictly-necessary cookies for authentication and preferences. No advertising or third-party trackers.</p>
        <p className="mt-6 text-xs text-muted-foreground">Contact: privacy@apex-work.com</p>
      </article>
    </div>
  );
}
