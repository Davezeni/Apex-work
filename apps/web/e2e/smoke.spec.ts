import { test, expect } from '@playwright/test';

/**
 * Smoke tests against the deployed web + API. These verify the public surfaces
 * respond and the core loop is reachable — enough to catch a broken deploy
 * without needing real accounts or payments.
 */

test.describe('public web', () => {
  test('home page loads and shows the brand', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
  });
});

test.describe('public API', () => {
  test('health endpoint responds ok', async ({ request }) => {
    const res = await request.get(
      'https://apex-work-api.onrender.com/v1/health',
    );
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.service).toBe('apex-work-api');
  });

  test('readiness reports db and redis healthy', async ({ request }) => {
    const res = await request.get('https://apex-work-api.onrender.com/v1/ready');
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.checks.db).toBe('ok');
    expect(body.checks.redis).toBe('ok');
  });

  test('search endpoint is reachable (public)', async ({ request }) => {
    const res = await request.get(
      'https://apex-work-api.onrender.com/v1/search?q=design',
    );
    // 200 with data, or a validation error — either way it must not 404.
    expect([200, 400, 422]).toContain(res.status());
  });
});
