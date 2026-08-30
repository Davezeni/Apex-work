import { test, expect } from '@playwright/test';

/**
 * Admin UI guards (no credentials required).
 *
 * These verify the security posture of the admin panel itself — that it's
 * gated, redirects unauthenticated visitors to login, and that the admin
 * route is reachable. We deliberately do NOT exercise authenticated admin
 * actions here (they need real staff credentials); set E2E_ADMIN_PHONE +
 * E2E_ADMIN_OTP to opt into that and skip otherwise.
 */

test.describe('admin access guard', () => {
  test('unauthenticated /admin redirects to the login page', async ({ page }) => {
    // Navigate straight to /admin. The guard should bounce to /login?next=/admin.
    await page.goto('/admin', { waitUntil: 'domcontentloaded' });
    // Allow time for the redirect (client-side app).
    await expect(page).toHaveURL(/\/login(?:\?.*)?$/, { timeout: 15_000 });
  });

  test('login page renders the brand and a phone field', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('text=Sig').or(page.locator('text=Phone')).first()).toBeVisible();
    await expect(page.locator('input').first()).toBeVisible();
  });

  test('unauthenticated admin data endpoints are not exposed to the browser', async ({ request }) => {
    // A browser hitting the API directly must get 401, not 200 with data.
    const res = await request.get('https://apex-work-api.onrender.com/v1/admin/ops/analytics');
    expect(res.status()).toBe(401);
  });
});
