'use client';

import { ThemeProvider } from 'next-themes';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { useState } from 'react';
import { I18nProvider } from '@/i18n';
import { ServiceWorkerRegister } from './sw-register';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Match the API's response-cache TTL so we don't refetch fresh data.
            staleTime: 60 * 1000,
            gcTime: 10 * 60 * 1000,
            retry: (failureCount, error) => {
              // Don't retry 4xx errors
              const status = (error as { status?: number })?.status;
              if (status && status >= 400 && status < 500) return false;
              return failureCount < 2;
            },
            refetchOnWindowFocus: false,
            // Reconnect-refetch is fine (recovers from flaky mobile networks)
            refetchOnReconnect: true,
            // Never block navigation waiting for a refetch — always serve the cache.
            refetchOnMount: false,
          },
          mutations: {
            retry: false,
            networkMode: 'online',
          },
        },
      }),
  );

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        <I18nProvider>
          {children}
          <Toaster richColors position="top-center" />
          <ServiceWorkerRegister />
        </I18nProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
