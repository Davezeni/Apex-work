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

const DEFAULT_ABOUT = `Apex-Work is Ethiopia's freelance marketplace — built to connect **clients** with **vetted local talent** in design, development, writing, marketing and more.

## Our mission

We believe world-class work shouldn't require leaving the country. Apex-Work makes it easy to hire trusted Ethiopian professionals and for freelancers to earn securely, with **escrow-protected payments**, transparent fees, and work you can actually trust.

## What makes us different

- **Local-first** — payments in ETB, built for Telebirr, CBE Birr and bank transfer
- **Safety first** — every payment held in escrow until delivery is accepted
- **Fair fees** — a simple 10% platform fee, half of what global platforms charge
- **Genuine trust** — verified IDs, ratings and a reputation you can rely on

## Our values

We're proudly open source, we support the local community, and we're building the future of work for Ethiopia — in Amharic and English.

_Made with ❤️ in Addis Ababa 🇪🇹_`;

const DEFAULT_CONTACT = `We'd love to hear from you. Choose the channel that suits you best — we usually reply within a few hours on business days.

- **Email** — support@apex-work.com
- **Telegram** — t.me/apex_work_support
- **Phone** — +251 911 000 000

Use the **Help** screen to open a support ticket for account, payment or order issues so we can track and resolve them faster.

_For legal or privacy questions, write to legal@apex-work.com._`;

const DEFAULT_HOW = `Hiring on Apex-Work is as simple as 1-2-3-4.

## 1. Browse or search

Search thousands of services by skill, city or keyword, or post a job and let freelancers apply.

## 2. Compare & chat

Compare profiles, ratings and portfolios. Message the freelancer directly to discuss scope and price.

## 3. Pay into escrow

Your money is held **securely in escrow** — the freelancer doesn't get paid until you confirm the work is done.

## 4. Accept & rate

Check the delivery, accept it, and funds are released. Then leave a review to build trust for everyone.

**For freelancers:** create a profile, list your services, and get paid the moment your clients accept delivery.`;

const DEFAULT_TRUST = `Trust is at the heart of Apex-Work. Here's how we keep transactions safe for everyone.

## Escrow protection

Client payments are held in escrow and only released when the client accepts delivery (or after 7 days of inactivity). Nobody can be paid for work that wasn't delivered.

## Verified identities

We verify phone numbers and government IDs before members can transact, so you always know who you're working with.

## Fair dispute mediation

If something goes wrong, our support team mediates within **48 hours**. Funds remain locked in escrow until a resolution is agreed.

## Honest reviews

Reviews come only from real, completed orders. We remove fake or abusive reviews and ban repeat offenders.

## We never sell your data

Your data is encrypted, never sold, and you can export or delete it at any time.

_Have a concern? Open a ticket from the Help screen._`;

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
  { slug: 'about', title: 'About us', markdown: DEFAULT_ABOUT },
  { slug: 'contact', title: 'Contact us', markdown: DEFAULT_CONTACT },
  { slug: 'how-it-works', title: 'How it works', markdown: DEFAULT_HOW },
  { slug: 'trust-safety', title: 'Trust & safety', markdown: DEFAULT_TRUST },
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

// -----------------------------------------------------------------------------
// Site config — brand + contact details surfaced across the app (help, support,
// legal, footer, contact page). Was hard-coded; now admin-editable.
// -----------------------------------------------------------------------------

export type SiteConfig = {
  brandName: string;
  tagline: string;
  supportEmail: string;
  supportPhone: string;
  supportTelegram: string;
  privacyEmail: string;
  legalEmail: string;
};

const SITE_CONFIG_KEY = 'content.site';
const SITE_CONFIG_CACHE_KEY = cacheKey('content:site');

const siteConfigSchema = z.object({
  brandName: z.string().trim().min(1).max(60),
  tagline: z.string().trim().max(200),
  supportEmail: z.string().trim().toLowerCase().email().max(160),
  supportPhone: z.string().trim().max(30),
  supportTelegram: z.string().trim().max(200),
  privacyEmail: z.string().trim().toLowerCase().email().max(160),
  legalEmail: z.string().trim().toLowerCase().email().max(160),
});

export const DEFAULT_SITE_CONFIG: SiteConfig = {
  brandName: 'Apex-Work',
  tagline: 'Ethiopia’s freelance marketplace',
  supportEmail: 'support@apex-work.com',
  supportPhone: '+251911000000',
  supportTelegram: 'https://t.me/apex_work_support',
  privacyEmail: 'privacy@apex-work.com',
  legalEmail: 'legal@apex-work.com',
};

/** Current site config, with built-in defaults when unset (cached in Redis). */
export async function getSiteConfig(): Promise<SiteConfig> {
  const raw = await cachedRead(
    SITE_CONFIG_CACHE_KEY,
    async () => {
      const row = await prisma.appSetting.findUnique({ where: { key: SITE_CONFIG_KEY } });
      if (!row) return null;
      const parsed = siteConfigSchema.safeParse(row.value);
      return parsed.success ? parsed.data : null;
    },
    300,
  );
  return { ...DEFAULT_SITE_CONFIG, ...(raw ?? {}) };
}

/** Persist an admin edit of the site config and drop the cache. */
export async function upsertSiteConfig(
  input: SiteConfig,
  updatedById: string,
): Promise<SiteConfig> {
  const parsed = siteConfigSchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Invalid site config');
  await prisma.appSetting.upsert({
    where: { key: SITE_CONFIG_KEY },
    update: { value: parsed.data, updatedById },
    create: {
      key: SITE_CONFIG_KEY,
      value: parsed.data,
      updatedById,
      description: 'Editable brand & contact info',
    },
  });
  await invalidate(SITE_CONFIG_CACHE_KEY);
  return parsed.data;
}

/** The content page schema, exported for admin route validation reuse. */
export const contentPageSchema = pageSchema;
