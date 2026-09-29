import { test, expect, type Page } from '@playwright/test';

/**
 * Avatar upload E2E (authenticated).
 *
 * Opt-in, like admin.spec.ts: the suite is skipped unless a dedicated test
 * account exists. To enable:
 *   1. Create a test account that has an email + password (signup with a
 *      password, or via admin user import).
 *   2. Add the repo secrets E2E_USER_EMAIL + E2E_USER_PASSWORD — ci.yml
 *      already forwards them to the E2E job.
 *
 * The test logs in through the API (email + password), seeds the persisted
 * auth store in localStorage (same shape the store persists), then drives
 * the real UI: pick a file → upload → preview swaps → Save → back to
 * /profile.
 */

const API = 'https://apex-work-api.onrender.com/v1';
const EMAIL = process.env.E2E_USER_EMAIL;
const PASSWORD = process.env.E2E_USER_PASSWORD;

test.skip(
  !(EMAIL && PASSWORD),
  'Set E2E_USER_EMAIL + E2E_USER_PASSWORD to enable the authenticated avatar test.',
);

/** 1×1 valid PNG — passes the avatar MIME/size checks without a repo asset. */
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

/** Log in via the API and seed the persisted auth store before app code runs. */
async function loginAndSeedSession(page: Page): Promise<void> {
  const res = await page.request.post(`${API}/auth/login`, {
    data: { email: EMAIL, password: PASSWORD },
  });
  expect(res.ok(), `login failed with status ${res.status()}`).toBeTruthy();
  const { data } = (await res.json()) as {
    data: {
      tokens: { accessToken: string; refreshToken: string; expiresIn: number };
    };
  };
  const session = JSON.stringify({
    state: {
      accessToken: data.tokens.accessToken,
      refreshToken: data.tokens.refreshToken,
      expiresAt: Date.now() + data.tokens.expiresIn * 1000,
      lastPhone: null,
    },
    version: 0,
  });
  await page.addInitScript((raw) => window.localStorage.setItem('apex-work-auth', raw), session);
}

test('avatar upload: pick file, preview updates, save returns to profile', async ({ page }) => {
  // Live deploy + Render cold starts can stretch the loop well past 30s.
  test.setTimeout(120_000);
  await loginAndSeedSession(page);

  await page.goto('/settings/profile');
  const circle = page.locator('.grad-hero').first();
  await expect(circle).toBeVisible({ timeout: 30_000 });

  // Accounts from a previous run may already show an avatar; the assertion
  // below is meaningful either way because every upload lands on a fresh
  // storage path, so the preview src must change.
  const before = await circle
    .locator('img')
    .getAttribute('src')
    .catch(() => null);

  await page.locator('input[type="file"]').setInputFiles({
    name: 'avatar.png',
    mimeType: 'image/png',
    buffer: PNG_1X1,
  });

  await expect
    .poll(
      async () => {
        const img = circle.locator('img');
        if ((await img.count()) === 0) return null;
        return img.getAttribute('src');
      },
      { timeout: 60_000 },
    )
    .not.toBe(before);

  // Save persists the new avatar and returns to the profile page
  // (safeBack pushes its fallback on a fresh browser context).
  await page.locator('div.fixed.inset-x-0.bottom-0 button').first().click();
  await expect(page).toHaveURL(/\/profile$/, { timeout: 30_000 });
});
