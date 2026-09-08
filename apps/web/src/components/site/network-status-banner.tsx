'use client';

import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

/**
 * Global network status banner.
 *
 * Sits in the Providers tree so it appears on every route. When the browser
 * goes offline a slim fixed banner slides in from the top, letting the user
 * know requests will be queued / fail until they reconnect. It auto-dismisses
 * the moment the connection is back. SSR-safe: nothing renders until mounted.
 */
export function NetworkStatusBanner() {
  const [online, setOnline] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setOnline(typeof navigator === 'undefined' ? true : navigator.onLine);
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);

  return (
    <AnimatePresence>
      {mounted && !online && (
        <motion.div
          initial={{ y: -48, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -48, opacity: 0 }}
          transition={{ duration: 0.18 }}
          role="status"
          aria-live="polite"
          className="fixed inset-x-0 top-0 z-[60] flex items-center justify-center gap-2 bg-amber-500 px-4 py-2 text-center text-xs font-bold text-amber-950 shadow-lg"
        >
          <WifiOff className="h-3.5 w-3.5 shrink-0" />
          No connection — you seem to be offline. Reconnect to keep using Apex-Work.
        </motion.div>
      )}
    </AnimatePresence>
  );
}
