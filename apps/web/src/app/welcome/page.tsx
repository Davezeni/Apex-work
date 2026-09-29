'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { BrandMark } from '@/components/brand/brand-logo';
import { dt } from '@/i18n/auto';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Mobile boarding splash: the mark and a warm greeting animate in, hold a
 * beat, then glide on to the feed/workspace — no tap required. Shown after
 * login (mode=back) or a fresh client signup (mode=new). Desktop skips it
 * (auto-continues) — mobile-only surface per product decision. The silent
 * authenticated redirect on /login deliberately does NOT route through here.
 */
const HOLD_MS = 2800;
const EASE = [0.22, 1, 0.36, 1] as const;

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
      return;
    }
    const t = setTimeout(() => router.replace(target), HOLD_MS);
    return () => clearTimeout(t);
  }, [accessToken, router, target]);

  return (
    <motion.main
      className="safe-top flex min-h-dvh flex-col items-center justify-center bg-background px-6 text-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 1, 1, 0] }}
      transition={{ duration: HOLD_MS / 1000, times: [0, 0.12, 0.86, 1], ease: 'easeInOut' }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.84, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.7, ease: EASE }}
      >
        <BrandMark size={92} />
      </motion.div>
      <motion.h1
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.28, ease: EASE }}
        className="mt-9 text-3xl font-extrabold tracking-tight"
      >
        {mode === 'new' ? dt('Welcome to Apex-Work') : dt('Welcome back')}
      </motion.h1>
    </motion.main>
  );
}
