'use client';

import { dt } from '@/i18n/auto';
import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
/**
 * App Router global error boundary. Catches uncaught client-side render
 * errors and reports them to Sentry (no-op without a DSN).
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div className="grid min-h-dvh place-items-center px-8 text-center">
          <div>
            <h1 className="text-2xl font-extrabold">{dt('Something went wrong')}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              An unexpected error occurred. Try again, or reload the page.
            </p>
            <Button className="mt-4" onClick={reset}>
              {dt('Reload')}
            </Button>
          </div>
        </div>
      </body>
    </html>
  );
}
