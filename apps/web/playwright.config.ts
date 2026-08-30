import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end smoke tests (open-source Playwright).
 *
 * Targets the deployed web + API by default (set WEB_URL and API_URL), or a
 * local dev server. Browsers are downloaded with `npm run test:e2e:install`.
 * Keep the suite light — these are smoke checks that catch a broken deploy,
 * not a full feature matrix.
 */
const baseURL = process.env.E2E_WEB_URL ?? 'https://apex-work-gold.vercel.app';
const apiBaseURL =
  process.env.E2E_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'https://apex-work-api.onrender.com';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  timeout: 30_000,
  reporter: process.env.CI ? [['list'], ['github']] : [['list']],
  use: {
    baseURL,
    trace: 'on-first-retry',
    // Give the free Render dyno time to cold-start on first hit.
    navigationTimeout: 60_000,
    extraHTTPHeaders: { 'x-e2e-check': '1' },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any);

// Re-export the resolved API base for specs to use directly.
export { apiBaseURL };
