'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { BrandMark } from '@/components/brand/brand-logo';
import { Button } from '@/components/ui/button';
import { dt } from '@/i18n/auto';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Mobile boarding moment: shown after a successful login ("Welcome back")
 * or first entry after signup ("Welcome to Apex-Work") instead of dropping
 * straight onto the feed. Desktop skips it (auto-continues) — this is a
 * mobile-only screen per product decision. The silent authenticated
 * redirect on /login deliberately does NOT route through here.
 */
export default function WelcomePage() {
  const router = useRouter();
  const params = useSearchParams();
  const accessToken = useAuthStore((s) => s.accessToken);

  const mode = params.get('mode') === 'new' ? 'new' : 'back';
  const next = params.get('next') ?? '/';
  const target = next.startsWith('/') ? next : '/';

  useEffect(() => {
    if (!accessToken) {
      router.replace('/login');
      return;
    }
    // Desktop: not a mobile-mode surface — continue immediately.
    if (window.matchMedia('(min-width: 768px)').matches) {
      router.replace(target);
    }
  }, [accessToken, router, target]);

  const heading = mode === 'new' ? dt('Welcome to Apex-Work') : dt('Welcome back');
  const sub =
    mode === 'new'
      ? dt('Your account is ready. Explore services or post your first job.')
      : dt('Good to see you again. Your workspace is ready.');

  return (
    <main className="safe-top flex min-h-dvh flex-col items-center justify-center bg-background px-6 text-center">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="flex flex-col items-center"
      >
        <BrandMark size={84} />
        <h1 className="mt-8 text-3xl font-extrabold tracking-tight">{heading}</h1>
        <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">{sub}</p>
        <Button
          variant="brand"
          size="lg"
          className="mt-10 w-full max-w-xs"
          onClick={() => router.replace(target)}
        >
          {dt('Continue')}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </motion.div>
    </main>
  );
}
