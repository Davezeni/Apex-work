import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { cachedRead, cacheKey, invalidate } from '../lib/cache.js';

/**
 * Editable site content — legal pages (privacy, terms, cookies) and the FAQ.
 *
 * These used to be hard-coded strings in the web app, so changing them meant a
 * deploy. Now they live in the AppSetting key/value store under a namespaced
 * key (`content.page.<slug>`), edited from the admin Content panel, served to
 * the public content route, and read through the Redis cache so the (rarely
 * changing) text doesn't hit Postgres on every page view.
 *
 * Each page stores `{ title, markdown }`. When unset we fall back to a sensible
 * built-in default so the public pages never render blank.
 */

export type ContentPage = {
  slug: string;
  title: string;
  markdown: string;
  updatedAt: string | null;
};

const pageSchema = z.object({
  title: z.string().trim().min(1).max(120),
  markdown: z.string().min(0).max(60_000),
});

const DEFAULT_PRIVACY = `Last updated: August 2026

## Data we collect

Phone number, name, email (optional), profile info you provide, uploaded portfolio, chat messages, payment info processed via Chapa.

## How we use it

To operate the platform, verify your identity, process payments, send notifications, and prevent fraud. We do not sell your data.

## Storage & security

Data lives in encrypted Neon Postgres (Frankfurt) and Supabase Storage. Passwords/PINs are Argon2-hashed. Passkeys are cryptographic — we never see your biometrics.

## Your rights

You can export or delete your data at any time from **Settings → Account**. We honor requests within 30 days.

## Cookies

We use strictly-necessary cookies for authentication and preferences. No advertising or third-party trackers.

_Contact: privacy@apex-work.com_`;

const DEFAULT_TERMS = `Last updated: August 2026

## 1. Acceptance

By using Apex-Work you agree to these Terms and our Privacy Policy.

## 2. Platform role

Apex-Work is a marketplace that connects clients with freelancers. We are not a party to service contracts between users.

## 3. Payments & escrow

Client payments are held in escrow. Funds are released when the client accepts delivery, or automatically after 7 days of inactivity following delivery. Apex-Work charges a 10% platform fee on completed orders.

## 4. Prohibited conduct

No spam, harassment, fraud, or off-platform payment circumvention. Violations may result in immediate account suspension.

## 5. Content

You retain ownership of content you upload. You grant Apex-Work a limited license to host and display it for the purpose of operating the platform.

## 6. Limitation of liability

Apex-Work is provided "as is". We are not liable for indirect or consequential damages arising from your use of the platform.

## 7. Governing law

These Terms are governed by the laws of the Federal Democratic Republic of Ethiopia.

_Contact: legal@apex-work.com_`;

const DEFAULT_COOKIES = `Apex-Work uses only strictly-necessary cookies:

- **apex-work-session** — keeps you signed in on this device
- **apex-work-locale** — remembers your language choice
- **apex-work-theme** — remembers light/dark mode

We do not use advertising or third-party tracking cookies. That's why we don't need a cookie banner.`;

const DEFAULT_FAQ = `## How do I get paid on Apex-Work?

When a client releases funds from escrow, we credit your wallet within minutes. From there you can withdraw to Telebirr, CBE Birr, or your bank.

## What is the platform fee?

We take 10% of every completed order — half of what Fiverr and Upwork charge. No monthly fees, no listing fees.

## How long do withdrawals take?

Telebirr / CBE Birr payouts arrive within a few hours on business days. Bank transfers usually take 1-2 business days.

## What if there is a dispute?

Funds stay in escrow until the client accepts delivery. If a dispute happens, contact support — we mediate within 48 hours.

## Can I use Apex-Work in Amharic?

Yes. Tap **Settings → Language** and pick አማርኛ. The whole app translates instantly.

## How do I verify my ID?

Go to **Profile → Security → Verify identity**. Upload your Kebele ID or passport — usually approved in a few hours.`;

type PageDef = { slug: string; title: string; markdown: string };
export const CONTENT_PAGES: PageDef[] = [
  { slug: 'privacy', title: 'Privacy Policy', markdown: DEFAULT_PRIVACY },
  { slug: 'terms', title: 'Terms & Conditions', markdown: DEFAULT_TERMS },
  { slug: 'cookies', title: 'Cookie Policy', markdown: DEFAULT_COOKIES },
  { slug: 'faq', title: 'Frequently Asked Questions', markdown: DEFAULT_FAQ },
];

const keyFor = (slug: string) => `content.page.${slug}`;

/** Resolve a known page definition (case-insensitive slug) or undefined. */
function findDef(slug: string): PageDef | undefined {
  return CONTENT_PAGES.find((p) => p.slug === slug);
}

/** Full list of editable content pages, with stored-or-default text. */
export async function listContentPages(): Promise<ContentPage[]> {
  const slugs = await prisma.appSetting.findMany({
    where: { key: { startsWith: 'content.page.' } },
    orderBy: { key: 'asc' },
  });
  const byKey = new Map(slugs.map((s) => [s.key, s]));
  return CONTENT_PAGES.map((def) => {
    const row = byKey.get(keyFor(def.slug));
    let title = def.title;
    let markdown = def.markdown;
    let updatedAt: string | null = null;
    if (row && typeof row.value === 'object' && row.value) {
      const parsed = pageSchema.safeParse(row.value);
      if (parsed.success) {
        title = parsed.data.title;
        markdown = parsed.data.markdown;
        updatedAt = row.updatedAt?.toISOString() ?? null;
      }
    }
    return { slug: def.slug, title, markdown, updatedAt };
  });
}

/** Read a single content page for the (public) content route. Cached in Redis. */
export async function getContentPage(slug: string): Promise<ContentPage | null> {
  const def = findDef(slug);
  if (!def) return null;

  const raw = await cachedRead(
    cacheKey('content:page', def.slug),
    async () => {
      const row = await prisma.appSetting.findUnique({ where: { key: keyFor(def.slug) } });
      if (!row) return null;
      const parsed = pageSchema.safeParse(row.value);
      if (!parsed.success) return null;
      return {
        title: parsed.data.title,
        markdown: parsed.data.markdown,
        updatedAt: row.updatedAt?.toISOString() ?? null,
      };
    },
    300,
  );

  if (!raw) {
    return { slug: def.slug, title: def.title, markdown: def.markdown, updatedAt: null };
  }
  return { slug: def.slug, ...raw };
}

/** Persist an admin edit for a known content page and drop the cache. */
export async function upsertContentPage(
  slug: string,
  input: { title: string; markdown: string },
  updatedById: string,
): Promise<ContentPage> {
  const def = findDef(slug);
  if (!def) throw new Error(`Unknown content page: ${slug}`);
  const parsed = pageSchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Invalid content');

  const row = await prisma.appSetting.upsert({
    where: { key: keyFor(slug) },
    update: { value: parsed.data, updatedById },
    create: {
      key: keyFor(slug),
      value: parsed.data,
      updatedById,
      description: `Editable content: ${def.title}`,
    },
  });

  await invalidate(cacheKey('content:page', slug));
  return {
    slug,
    title: parsed.data.title,
    markdown: parsed.data.markdown,
    updatedAt: row.updatedAt?.toISOString() ?? null,
  };
}
