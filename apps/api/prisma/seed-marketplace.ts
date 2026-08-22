/**
 * Marketplace seed — populates realistic Ethiopian-flavour test data:
 *   - ~20 freelancers across every category
 *   - ~5 clients
 *   - ~45 gigs (BASIC/STANDARD/PREMIUM packages)
 *   - ~18 open jobs waiting for bids
 *
 * Idempotent: keyed on stable natural IDs (phone / slug / job title hash).
 * Safe to re-run — existing rows are skipped.
 *
 * Run:
 *   DATABASE_URL=... DATABASE_URL_UNPOOLED=... npx tsx apps/api/prisma/seed-marketplace.ts
 */
import { PrismaClient, Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';

const prisma = new PrismaClient();

const slug = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);

const shortHash = (s: string): string =>
  createHash('sha1').update(s).digest('hex').slice(0, 6);

// ---------- FREELANCERS ----------
interface FreelancerSpec {
  phone: string;
  username: string;
  fullName: string;
  title: string;
  bio: string;
  city: string;
  rate: number;
  rating: number;
  ratingCount: number;
  completed: number;
  balance: number;
  gigs: GigSpec[];
}

interface GigSpec {
  title: string;
  categoryId: string;
  tags: string[];
  description: string;
  rating?: number;
  ratingCount?: number;
  ordersCount?: number;
  packages: { tier: 'BASIC' | 'STANDARD' | 'PREMIUM'; title: string; description: string; priceEtb: number; deliveryDays: number; revisions: number }[];
}

const FREELANCERS: FreelancerSpec[] = [
  {
    phone: '+251910000101',
    username: 'kaleb_dev',
    fullName: 'Kaleb Girma',
    title: 'Senior Full-stack Developer',
    bio: 'Ex-Gebeya engineer. I ship production React + Node apps for Ethiopian startups. Fluent in Amharic, English, and Python.',
    city: 'Addis Ababa',
    rate: 1800,
    rating: 4.9,
    ratingCount: 87,
    completed: 112,
    balance: 24_000,
    gigs: [
      {
        title: 'I will build a modern Next.js website with Tailwind',
        categoryId: 'development',
        tags: ['nextjs', 'react', 'tailwind', 'typescript'],
        description:
          'I build blazing-fast Next.js 14 websites — App Router, Tailwind, Framer Motion animations, dark mode, SEO-ready, deployed to Vercel. Handoff includes the GitHub repo and a walk-through Loom.',
        rating: 4.95, ratingCount: 42, ordersCount: 61,
        packages: [
          { tier: 'BASIC', title: 'One page site', description: 'Landing page (hero + 3 sections), mobile responsive, 1 revision', priceEtb: 4500, deliveryDays: 4, revisions: 1 },
          { tier: 'STANDARD', title: '5 pages site', description: 'Home + About + Services + Contact + Blog placeholder, CMS-ready, 3 revisions', priceEtb: 12_000, deliveryDays: 8, revisions: 3 },
          { tier: 'PREMIUM', title: 'Full web app', description: 'Auth, dashboard, DB, payment integration (Chapa/Telebirr), 5 revisions', priceEtb: 35_000, deliveryDays: 21, revisions: 5 },
        ],
      },
      {
        title: 'I will integrate Chapa payments into your app',
        categoryId: 'development',
        tags: ['chapa', 'payments', 'telebirr', 'api'],
        description:
          'Add Chapa / Telebirr / CBE Birr to any existing web or mobile app. Webhook verification, retry logic, and a test-mode checklist included.',
        rating: 5.0, ratingCount: 18, ordersCount: 22,
        packages: [
          { tier: 'BASIC', title: 'Chapa hosted checkout', description: 'Redirect flow + webhook verification', priceEtb: 3500, deliveryDays: 2, revisions: 1 },
          { tier: 'STANDARD', title: 'Chapa + Telebirr direct', description: 'Both rails + a unified backend, orders + refunds', priceEtb: 9000, deliveryDays: 5, revisions: 2 },
          { tier: 'PREMIUM', title: 'Full billing system', description: 'Subscriptions, invoicing, wallet, admin dashboard', priceEtb: 22_000, deliveryDays: 14, revisions: 4 },
        ],
      },
    ],
  },
  {
    phone: '+251910000102',
    username: 'selam_ui',
    fullName: 'Selam Assefa',
    title: 'Product Designer (UI/UX)',
    bio: 'Product designer with 5+ years crafting beautiful, usable interfaces for African startups. Figma nerd. Design systems specialist.',
    city: 'Addis Ababa',
    rate: 1500, rating: 4.9, ratingCount: 42, completed: 58, balance: 12_400,
    gigs: [
      {
        title: 'I will design a modern SaaS landing page in 48h',
        categoryId: 'design',
        tags: ['figma', 'saas', 'landing', 'ui'],
        description:
          'Conversion-focused landing pages for SaaS startups. Modern layouts, brand-consistent visuals, developer-ready handoff.',
        rating: 4.98, ratingCount: 312, ordersCount: 380,
        packages: [
          { tier: 'BASIC', title: 'One-page design', description: 'Hero + 3 sections, 1 revision, Figma file', priceEtb: 2500, deliveryDays: 3, revisions: 1 },
          { tier: 'STANDARD', title: 'Full landing page', description: 'Hero + 6 sections, 3 revisions, Figma + assets', priceEtb: 5500, deliveryDays: 5, revisions: 3 },
          { tier: 'PREMIUM', title: 'Landing + brand kit', description: 'Full page + logo tweak + color/typography guide', priceEtb: 12_000, deliveryDays: 10, revisions: 5 },
        ],
      },
      {
        title: 'I will design a mobile app UI in Figma',
        categoryId: 'design',
        tags: ['figma', 'mobile', 'ios', 'android'],
        description:
          'Complete iOS/Android app design in Figma with prototype and design system. Ready for developer handoff.',
        rating: 4.9, ratingCount: 60, ordersCount: 71,
        packages: [
          { tier: 'BASIC', title: '5-screen MVP', description: 'Onboarding + home + detail + 2 more, prototype', priceEtb: 6000, deliveryDays: 5, revisions: 2 },
          { tier: 'STANDARD', title: '12-screen app', description: 'Full core flow, prototype, design tokens', priceEtb: 15_000, deliveryDays: 10, revisions: 3 },
          { tier: 'PREMIUM', title: 'Full app + design system', description: 'All screens + reusable components + brand kit', priceEtb: 32_000, deliveryDays: 21, revisions: 5 },
        ],
      },
    ],
  },
  {
    phone: '+251910000103', username: 'daniel_writes', fullName: 'Daniel Bekele',
    title: 'Amharic ↔ English Translator', city: 'Bahir Dar',
    bio: 'Certified translator. 400+ documents delivered. Legal, medical, marketing, literary — any tone, any format.',
    rate: 400, rating: 4.85, ratingCount: 156, completed: 210, balance: 8500,
    gigs: [
      {
        title: 'I will translate up to 1000 words between Amharic and English',
        categoryId: 'writing', tags: ['amharic', 'translation', 'english', 'ethiopia'],
        description: 'Fast, native-quality translation. Same-day turnaround for documents under 1000 words. Certified for legal / academic use on request.',
        rating: 4.9, ratingCount: 148, ordersCount: 200,
        packages: [
          { tier: 'BASIC', title: '500 words', description: '24h turnaround, 1 proofread', priceEtb: 600, deliveryDays: 1, revisions: 1 },
          { tier: 'STANDARD', title: '2,000 words', description: '48h turnaround, 2 proofreads', priceEtb: 2200, deliveryDays: 2, revisions: 2 },
          { tier: 'PREMIUM', title: '5,000 words + certified', description: '5 days, notarized translation, 3 revisions', priceEtb: 6500, deliveryDays: 5, revisions: 3 },
        ],
      },
      {
        title: 'I will write SEO-optimized blog posts in English',
        categoryId: 'writing', tags: ['blog', 'seo', 'content', 'copywriting'],
        description: 'Well-researched, plagiarism-free blog posts optimized for Google. Turnaround under a week for most niches.',
        rating: 4.8, ratingCount: 45, ordersCount: 62,
        packages: [
          { tier: 'BASIC', title: '800-word post', description: '1 keyword, meta description, 1 revision', priceEtb: 1500, deliveryDays: 3, revisions: 1 },
          { tier: 'STANDARD', title: '1,500-word pillar post', description: '3 keywords, images sourced, 2 revisions', priceEtb: 3200, deliveryDays: 4, revisions: 2 },
          { tier: 'PREMIUM', title: '3,000-word deep dive', description: 'Full SEO audit + internal linking plan', priceEtb: 6500, deliveryDays: 7, revisions: 3 },
        ],
      },
    ],
  },
  {
    phone: '+251910000104', username: 'meron_video', fullName: 'Meron Tekle',
    title: 'Video Editor & Motion Designer', city: 'Addis Ababa',
    bio: 'Wedding films, Instagram reels, YouTube videos, and motion graphics. Adobe Premiere + After Effects.',
    rate: 700, rating: 4.95, ratingCount: 78, completed: 91, balance: 15_600,
    gigs: [
      {
        title: 'I will edit your Instagram reels and TikTok videos',
        categoryId: 'video', tags: ['reels', 'tiktok', 'instagram', 'video-editing'],
        description: 'Punchy short-form edits with captions, transitions, and trending sound design. Turnaround in under 48h.',
        rating: 4.95, ratingCount: 66, ordersCount: 84,
        packages: [
          { tier: 'BASIC', title: '30-sec reel', description: 'Cut + captions + music', priceEtb: 900, deliveryDays: 2, revisions: 1 },
          { tier: 'STANDARD', title: '3 reels bundle', description: '3 x 30s reels, unified style', priceEtb: 2400, deliveryDays: 3, revisions: 2 },
          { tier: 'PREMIUM', title: '10 reels monthly pack', description: 'Full month of content + posting calendar', priceEtb: 7500, deliveryDays: 10, revisions: 3 },
        ],
      },
      {
        title: 'I will create a professional YouTube intro animation',
        categoryId: 'video', tags: ['youtube', 'intro', 'animation', 'motion-graphics'],
        description: 'Custom animated intros (5-10s) that make your channel look pro. Includes source AE file.',
        rating: 4.9, ratingCount: 22, ordersCount: 30,
        packages: [
          { tier: 'BASIC', title: '5-second intro', description: 'Logo animation + music', priceEtb: 1800, deliveryDays: 3, revisions: 1 },
          { tier: 'STANDARD', title: '10-sec animated intro', description: 'Multiple scenes + sound design', priceEtb: 4000, deliveryDays: 5, revisions: 2 },
          { tier: 'PREMIUM', title: 'Intro + outro + lower thirds', description: 'Complete branding pack', priceEtb: 8500, deliveryDays: 7, revisions: 3 },
        ],
      },
    ],
  },
  {
    phone: '+251910000105', username: 'yohannes_seo', fullName: 'Yohannes Alemu',
    title: 'SEO & Digital Marketing Specialist', city: 'Addis Ababa',
    bio: 'HubSpot & Google Ads certified. I get local Ethiopian businesses ranking on Google. 60+ successful campaigns.',
    rate: 900, rating: 4.8, ratingCount: 51, completed: 63, balance: 9800,
    gigs: [
      {
        title: 'I will do complete SEO audit and keyword research',
        categoryId: 'marketing', tags: ['seo', 'audit', 'keyword-research', 'google'],
        description: 'Deep-dive SEO audit including technical, on-page, off-page, and a prioritized 90-day action plan.',
        rating: 4.85, ratingCount: 34, ordersCount: 45,
        packages: [
          { tier: 'BASIC', title: 'Technical audit', description: '20-point checklist, Screaming Frog report', priceEtb: 2500, deliveryDays: 4, revisions: 1 },
          { tier: 'STANDARD', title: 'Audit + keywords', description: 'Full audit + 50-keyword strategy', priceEtb: 5500, deliveryDays: 6, revisions: 2 },
          { tier: 'PREMIUM', title: 'Audit + 6-month roadmap', description: 'Everything + monthly progress calls', priceEtb: 14_000, deliveryDays: 10, revisions: 3 },
        ],
      },
    ],
  },
  {
    phone: '+251910000106', username: 'liya_voiceover', fullName: 'Liya Haile',
    title: 'Amharic & English Voice Over Artist', city: 'Addis Ababa',
    bio: 'Broadcast-quality voice-over in Amharic, Afaan Oromo, Tigrinya, and English. Home studio with a Rode NT1.',
    rate: 600, rating: 4.9, ratingCount: 96, completed: 130, balance: 18_400,
    gigs: [
      {
        title: 'I will record a professional Amharic voice over',
        categoryId: 'audio', tags: ['voiceover', 'amharic', 'audio', 'narration'],
        description: 'Warm, natural Amharic narration for ads, YouTube, e-learning, and IVR systems. Broadcast quality.',
        rating: 4.95, ratingCount: 78, ordersCount: 110,
        packages: [
          { tier: 'BASIC', title: '150 words', description: 'Single take, MP3', priceEtb: 800, deliveryDays: 2, revisions: 1 },
          { tier: 'STANDARD', title: '500 words', description: 'Directed take + WAV + MP3', priceEtb: 2200, deliveryDays: 3, revisions: 2 },
          { tier: 'PREMIUM', title: '1500 words + sync', description: 'Sync to video + stems + revisions', priceEtb: 5500, deliveryDays: 5, revisions: 3 },
        ],
      },
    ],
  },
  {
    phone: '+251910000107', username: 'binyam_data', fullName: 'Binyam Wolde',
    title: 'Data Scientist & ML Engineer', city: 'Addis Ababa',
    bio: 'PhD candidate at AAU. I turn messy CSVs into dashboards and predictive models. Python, SQL, Tableau, PyTorch.',
    rate: 2000, rating: 5.0, ratingCount: 24, completed: 30, balance: 32_000,
    gigs: [
      {
        title: 'I will build a Tableau or Power BI dashboard',
        categoryId: 'data', tags: ['tableau', 'powerbi', 'dashboard', 'analytics'],
        description: 'Interactive BI dashboards from your raw data. I connect to your DB / spreadsheets and deliver a polished, filterable dashboard.',
        rating: 5.0, ratingCount: 18, ordersCount: 22,
        packages: [
          { tier: 'BASIC', title: 'Single dashboard', description: '1 dashboard, 5 charts, 1 data source', priceEtb: 5500, deliveryDays: 4, revisions: 1 },
          { tier: 'STANDARD', title: '3 dashboards', description: '3 linked dashboards, filters, drill-downs', priceEtb: 13_000, deliveryDays: 8, revisions: 2 },
          { tier: 'PREMIUM', title: 'Full BI system', description: 'Automated ETL + refresh + user training', priceEtb: 32_000, deliveryDays: 15, revisions: 3 },
        ],
      },
    ],
  },
  {
    phone: '+251910000108', username: 'sara_logo', fullName: 'Sara Tesfaye',
    title: 'Logo & Brand Identity Designer', city: 'Hawassa',
    bio: 'I create memorable logos and full brand identities for businesses. Award-winning designs in African markets.',
    rate: 800, rating: 4.85, ratingCount: 134, completed: 178, balance: 21_000,
    gigs: [
      {
        title: 'I will design a professional logo for your business',
        categoryId: 'design', tags: ['logo', 'branding', 'identity', 'design'],
        description: 'Unique, memorable logos with unlimited concepts until you love it. Full brand-safe file pack included.',
        rating: 4.9, ratingCount: 120, ordersCount: 165,
        packages: [
          { tier: 'BASIC', title: '2 logo concepts', description: 'PNG + JPG, 2 revisions', priceEtb: 1200, deliveryDays: 2, revisions: 2 },
          { tier: 'STANDARD', title: '4 concepts + files', description: 'AI + SVG + PNG + JPG, 3 revisions', priceEtb: 3200, deliveryDays: 4, revisions: 3 },
          { tier: 'PREMIUM', title: 'Logo + brand kit', description: 'Logo + business card + letterhead + brand guide', priceEtb: 8500, deliveryDays: 7, revisions: 5 },
        ],
      },
    ],
  },
  {
    phone: '+251910000109', username: 'abel_wp', fullName: 'Abel Fikadu',
    title: 'WordPress & WooCommerce Developer', city: 'Adama',
    bio: 'I build fast, secure WordPress sites and online stores. 100+ sites launched. Elementor & WooCommerce expert.',
    rate: 600, rating: 4.75, ratingCount: 220, completed: 300, balance: 18_500,
    gigs: [
      {
        title: 'I will build your business a WordPress website',
        categoryId: 'development', tags: ['wordpress', 'elementor', 'business', 'website'],
        description: 'Custom WordPress site — SEO-optimized, mobile-responsive, fast. Elementor Pro included. Free hosting setup.',
        rating: 4.8, ratingCount: 195, ordersCount: 260,
        packages: [
          { tier: 'BASIC', title: '5-page site', description: '5 pages, mobile responsive, contact form', priceEtb: 3500, deliveryDays: 5, revisions: 2 },
          { tier: 'STANDARD', title: '10 pages + SEO', description: '10 pages, SEO basics, speed optimization', priceEtb: 7500, deliveryDays: 8, revisions: 3 },
          { tier: 'PREMIUM', title: 'WooCommerce store', description: '20+ products, payment gateway, shipping', priceEtb: 18_000, deliveryDays: 14, revisions: 4 },
        ],
      },
    ],
  },
  {
    phone: '+251910000110', username: 'tsion_social', fullName: 'Tsion Mengistu',
    title: 'Social Media Manager', city: 'Addis Ababa',
    bio: 'I grow Instagram, TikTok, and Facebook accounts for Ethiopian brands. Data-driven content strategy.',
    rate: 700, rating: 4.85, ratingCount: 68, completed: 82, balance: 11_200,
    gigs: [
      {
        title: 'I will manage your social media for a month',
        categoryId: 'marketing', tags: ['social-media', 'instagram', 'tiktok', 'facebook'],
        description: 'Full-service SMM: content calendar, post design, scheduling, engagement, monthly report.',
        rating: 4.9, ratingCount: 52, ordersCount: 68,
        packages: [
          { tier: 'BASIC', title: '1 platform, 15 posts', description: 'Content + scheduling only', priceEtb: 5500, deliveryDays: 30, revisions: 2 },
          { tier: 'STANDARD', title: '2 platforms, 30 posts', description: 'Content + engagement + monthly report', priceEtb: 12_000, deliveryDays: 30, revisions: 3 },
          { tier: 'PREMIUM', title: '3 platforms + ads', description: 'Everything + ₺2K ad budget managed', priceEtb: 28_000, deliveryDays: 30, revisions: 5 },
        ],
      },
    ],
  },
  {
    phone: '+251910000111', username: 'nathan_react', fullName: 'Nathan Solomon',
    title: 'React Native Mobile Developer', city: 'Addis Ababa',
    bio: 'I build cross-platform apps that feel native. 20+ apps on the App Store & Play Store.',
    rate: 1600, rating: 4.9, ratingCount: 34, completed: 42, balance: 28_500,
    gigs: [
      {
        title: 'I will build your idea as a React Native mobile app',
        categoryId: 'development', tags: ['react-native', 'mobile', 'ios', 'android'],
        description: 'Turn your idea into a working iOS + Android app. Includes Firebase backend, push notifications, and app store submission.',
        rating: 4.95, ratingCount: 28, ordersCount: 36,
        packages: [
          { tier: 'BASIC', title: 'MVP app (3 screens)', description: 'Basic app, no backend, 1 revision', priceEtb: 12_000, deliveryDays: 10, revisions: 1 },
          { tier: 'STANDARD', title: 'Full app + backend', description: '8 screens, Firebase auth + DB, 3 revisions', priceEtb: 32_000, deliveryDays: 21, revisions: 3 },
          { tier: 'PREMIUM', title: 'Complete app + stores', description: 'Full app + iOS/Play store submission + 30d support', priceEtb: 75_000, deliveryDays: 45, revisions: 5 },
        ],
      },
    ],
  },
  {
    phone: '+251910000112', username: 'hanna_illustrator', fullName: 'Hanna Kebede',
    title: 'Illustrator & Character Designer', city: 'Addis Ababa',
    bio: 'Custom illustrations for books, apps, and marketing. Ethiopian-flavour art in modern styles.',
    rate: 700, rating: 4.9, ratingCount: 88, completed: 105, balance: 14_200,
    gigs: [
      {
        title: 'I will draw a custom digital illustration',
        categoryId: 'design', tags: ['illustration', 'digital-art', 'character', 'drawing'],
        description: 'Hand-drawn digital illustrations tailored to your brand or story. Style: modern flat, semi-realistic, or cartoon.',
        rating: 4.95, ratingCount: 75, ordersCount: 92,
        packages: [
          { tier: 'BASIC', title: 'Single character', description: '1 character, flat color, 2 revisions', priceEtb: 1800, deliveryDays: 3, revisions: 2 },
          { tier: 'STANDARD', title: 'Scene illustration', description: 'Character + background + 3 revisions', priceEtb: 4500, deliveryDays: 5, revisions: 3 },
          { tier: 'PREMIUM', title: '5-illustration series', description: 'Cohesive series with matching style', priceEtb: 12_000, deliveryDays: 10, revisions: 4 },
        ],
      },
    ],
  },
  {
    phone: '+251910000113', username: 'mikael_python', fullName: 'Mikael Getachew',
    title: 'Python Developer & Web Scraper', city: 'Addis Ababa',
    bio: 'I automate the boring stuff. Web scraping, data pipelines, and API integrations at scale.',
    rate: 1400, rating: 4.9, ratingCount: 45, completed: 58, balance: 19_800,
    gigs: [
      {
        title: 'I will scrape any website and deliver clean data',
        categoryId: 'data', tags: ['python', 'scraping', 'data', 'automation'],
        description: 'Custom Python scrapers that handle anti-bot measures, deliver clean CSV/JSON/DB output. Legal & ethical only.',
        rating: 4.9, ratingCount: 38, ordersCount: 48,
        packages: [
          { tier: 'BASIC', title: 'Single-page scrape', description: 'One-time run, CSV output', priceEtb: 2200, deliveryDays: 2, revisions: 1 },
          { tier: 'STANDARD', title: 'Multi-page scrape', description: 'Pagination + login + CSV/JSON', priceEtb: 5500, deliveryDays: 4, revisions: 2 },
          { tier: 'PREMIUM', title: 'Daily automated feed', description: 'Cron + cloud host + email alerts', priceEtb: 15_000, deliveryDays: 7, revisions: 3 },
        ],
      },
    ],
  },
  {
    phone: '+251910000114', username: 'ruth_business', fullName: 'Ruth Girmay',
    title: 'Virtual Assistant & Bookkeeper', city: 'Addis Ababa',
    bio: 'Ex-Bank of Abyssinia. I handle bookkeeping, admin, and customer support so you can focus on growing your business.',
    rate: 400, rating: 4.9, ratingCount: 110, completed: 145, balance: 8200,
    gigs: [
      {
        title: 'I will be your virtual assistant for 20 hours',
        categoryId: 'business', tags: ['virtual-assistant', 'admin', 'support', 'bookkeeping'],
        description: 'Email management, calendar, data entry, research, customer support. 20 hours over one week.',
        rating: 4.9, ratingCount: 88, ordersCount: 112,
        packages: [
          { tier: 'BASIC', title: '10 hours', description: 'Email + calendar + basic admin', priceEtb: 3000, deliveryDays: 5, revisions: 0 },
          { tier: 'STANDARD', title: '20 hours', description: 'Everything in basic + light research', priceEtb: 5500, deliveryDays: 7, revisions: 0 },
          { tier: 'PREMIUM', title: '40 hours + bookkeeping', description: 'Full-service VA + QuickBooks/Xero entries', priceEtb: 12_000, deliveryDays: 14, revisions: 0 },
        ],
      },
    ],
  },
  {
    phone: '+251910000115', username: 'eyob_3d', fullName: 'Eyob Assefa',
    title: '3D Modeler & Architectural Visualization', city: 'Addis Ababa',
    bio: 'Photorealistic 3D renders for architects and product designers. Blender + Cinema 4D.',
    rate: 1200, rating: 4.85, ratingCount: 32, completed: 40, balance: 15_500,
    gigs: [
      {
        title: 'I will create a photorealistic 3D architectural render',
        categoryId: 'design', tags: ['3d', 'render', 'architecture', 'blender'],
        description: 'Bring your architectural vision to life with photorealistic renders. Interior + exterior + walkthrough available.',
        rating: 4.9, ratingCount: 26, ordersCount: 34,
        packages: [
          { tier: 'BASIC', title: 'One exterior render', description: '4K, daytime lighting, 1 revision', priceEtb: 5500, deliveryDays: 4, revisions: 1 },
          { tier: 'STANDARD', title: '3 renders + walkthrough', description: 'Exterior + 2 interior + short walkthrough video', priceEtb: 16_000, deliveryDays: 8, revisions: 3 },
          { tier: 'PREMIUM', title: 'Full project + VR', description: 'All angles + 60s cinematic + VR walkthrough', priceEtb: 45_000, deliveryDays: 15, revisions: 5 },
        ],
      },
    ],
  },
  {
    phone: '+251910000116', username: 'bethel_translator', fullName: 'Bethel Yohannes',
    title: 'Legal & Medical Translator', city: 'Addis Ababa',
    bio: 'Certified legal & medical translator. Amharic, Tigrinya, Afaan Oromo, English, French, Arabic. Notarized on request.',
    rate: 700, rating: 4.95, ratingCount: 68, completed: 85, balance: 12_800,
    gigs: [
      {
        title: 'I will translate legal and medical documents',
        categoryId: 'writing', tags: ['legal', 'medical', 'translation', 'certified'],
        description: 'Certified legal & medical translation with notarization if needed. Court-admissible in Ethiopia and abroad.',
        rating: 4.95, ratingCount: 55, ordersCount: 72,
        packages: [
          { tier: 'BASIC', title: 'Up to 500 words', description: '48h turnaround, certified stamp', priceEtb: 1500, deliveryDays: 2, revisions: 1 },
          { tier: 'STANDARD', title: 'Up to 2000 words', description: '5 days, certified + notarized', priceEtb: 5500, deliveryDays: 5, revisions: 2 },
          { tier: 'PREMIUM', title: 'Bulk (5000+ words)', description: 'Rush available, certified + notarized', priceEtb: 14_000, deliveryDays: 10, revisions: 3 },
        ],
      },
    ],
  },
  {
    phone: '+251910000117', username: 'aman_devops', fullName: 'Aman Bogale',
    title: 'DevOps & Cloud Engineer', city: 'Addis Ababa',
    bio: 'AWS/GCP certified. I migrate on-prem infra to the cloud and set up bulletproof CI/CD pipelines.',
    rate: 2500, rating: 5.0, ratingCount: 18, completed: 22, balance: 45_000,
    gigs: [
      {
        title: 'I will set up your CI/CD pipeline on AWS or GCP',
        categoryId: 'development', tags: ['devops', 'aws', 'gcp', 'ci-cd'],
        description: 'Complete CI/CD with GitHub Actions / GitLab CI, infrastructure as code (Terraform), and monitoring.',
        rating: 5.0, ratingCount: 15, ordersCount: 20,
        packages: [
          { tier: 'BASIC', title: 'Basic pipeline', description: 'Build + test + deploy to staging', priceEtb: 8000, deliveryDays: 5, revisions: 1 },
          { tier: 'STANDARD', title: 'Full CI/CD + IaC', description: 'Multi-env + Terraform + secrets management', priceEtb: 22_000, deliveryDays: 10, revisions: 2 },
          { tier: 'PREMIUM', title: 'Enterprise setup', description: 'Everything + monitoring + on-call runbook', priceEtb: 55_000, deliveryDays: 20, revisions: 3 },
        ],
      },
    ],
  },
  {
    phone: '+251910000118', username: 'lidiya_content', fullName: 'Lidiya Getnet',
    title: 'Copywriter & Content Strategist', city: 'Addis Ababa',
    bio: 'I write words that sell. Landing pages, email sequences, and product descriptions that convert.',
    rate: 800, rating: 4.9, ratingCount: 74, completed: 92, balance: 13_600,
    gigs: [
      {
        title: 'I will write your website copy that converts',
        categoryId: 'writing', tags: ['copywriting', 'website', 'conversion', 'landing'],
        description: 'Persuasive website copy tailored to your audience. Includes headlines, CTAs, and A/B test suggestions.',
        rating: 4.95, ratingCount: 60, ordersCount: 78,
        packages: [
          { tier: 'BASIC', title: 'Homepage copy', description: 'Hero + 3 sections + CTA', priceEtb: 2500, deliveryDays: 3, revisions: 2 },
          { tier: 'STANDARD', title: '5 pages copy', description: 'Home + About + Services + Contact + one more', priceEtb: 6500, deliveryDays: 5, revisions: 3 },
          { tier: 'PREMIUM', title: 'Full website + email', description: '10 pages + 5-email welcome sequence', priceEtb: 15_000, deliveryDays: 10, revisions: 5 },
        ],
      },
    ],
  },
  {
    phone: '+251910000119', username: 'samuel_music', fullName: 'Samuel Ayele',
    title: 'Music Producer & Sound Designer', city: 'Addis Ababa',
    bio: 'Custom beats, jingles, and sound design. Ableton + Logic. I produced tracks for major Ethiopian artists.',
    rate: 1000, rating: 4.9, ratingCount: 42, completed: 55, balance: 17_200,
    gigs: [
      {
        title: 'I will produce a custom beat or jingle',
        categoryId: 'audio', tags: ['music-production', 'beats', 'jingle', 'sound-design'],
        description: 'Original, royalty-free beats and jingles. Any genre, any tempo. WAV + stems delivered.',
        rating: 4.9, ratingCount: 32, ordersCount: 45,
        packages: [
          { tier: 'BASIC', title: '30-sec jingle', description: 'Custom jingle, 1 revision', priceEtb: 2200, deliveryDays: 3, revisions: 1 },
          { tier: 'STANDARD', title: '3-min beat', description: 'Full beat with intro/outro, stems', priceEtb: 5500, deliveryDays: 5, revisions: 2 },
          { tier: 'PREMIUM', title: 'Album mixing (5 tracks)', description: 'Mix + master, unlimited revisions', priceEtb: 22_000, deliveryDays: 14, revisions: 5 },
        ],
      },
    ],
  },
  {
    phone: '+251910000120', username: 'helen_pm', fullName: 'Helen Yosef',
    title: 'Business Plan & Pitch Deck Consultant', city: 'Addis Ababa',
    bio: 'Ex-McKinsey analyst. I write investor-ready business plans and pitch decks for Ethiopian startups.',
    rate: 2000, rating: 5.0, ratingCount: 26, completed: 32, balance: 38_000,
    gigs: [
      {
        title: 'I will write your investor-ready business plan',
        categoryId: 'business', tags: ['business-plan', 'pitch-deck', 'investor', 'strategy'],
        description: 'Comprehensive business plan with market analysis, financial projections, and investor-focused executive summary.',
        rating: 5.0, ratingCount: 22, ordersCount: 28,
        packages: [
          { tier: 'BASIC', title: 'Lean canvas', description: 'One-page lean canvas + summary', priceEtb: 4500, deliveryDays: 3, revisions: 1 },
          { tier: 'STANDARD', title: 'Full business plan', description: '20-page plan + 3yr financials', priceEtb: 16_000, deliveryDays: 10, revisions: 3 },
          { tier: 'PREMIUM', title: 'Plan + pitch deck', description: 'Everything + 15-slide investor deck', priceEtb: 35_000, deliveryDays: 15, revisions: 5 },
        ],
      },
    ],
  },
];

// ---------- CLIENTS ----------
const CLIENTS = [
  { phone: '+251920000201', username: 'addis_startup', fullName: 'Addis Tech Ltd', city: 'Addis Ababa' },
  { phone: '+251920000202', username: 'habesha_agency', fullName: 'Habesha Digital Agency', city: 'Addis Ababa' },
  { phone: '+251920000203', username: 'yidnekachew_e', fullName: 'Yidnekachew Endale', city: 'Bahir Dar' },
  { phone: '+251920000204', username: 'chalachew_biz', fullName: 'Chalachew Bogale', city: 'Adama' },
  { phone: '+251920000205', username: 'zenebech_shop', fullName: 'Zenebech Fashion', city: 'Mekelle' },
];

// ---------- JOBS ----------
interface JobSpec {
  clientUsername: string;
  title: string;
  categoryId: string;
  description: string;
  budgetMin?: number;
  budgetMax?: number;
  skills: string[];
  isRemote?: boolean;
}

const JOBS: JobSpec[] = [
  {
    clientUsername: 'addis_startup', categoryId: 'development',
    title: 'Build a Telegram bot that takes food orders and forwards to our kitchen',
    description: 'We run a small restaurant in Bole and want a Telegram bot that lets customers pick items from a menu, confirm delivery address, and pay via Telebirr. Orders should ping our kitchen chat.',
    budgetMin: 8000, budgetMax: 20000, skills: ['telegram-bot', 'nodejs', 'telebirr', 'chatbot'],
  },
  {
    clientUsername: 'addis_startup', categoryId: 'design',
    title: 'Redesign our mobile-first e-commerce site — modern & fast',
    description: 'Our current site feels dated. Looking for a designer who can deliver a clean, modern redesign in Figma. Should support Amharic and English. ~15 screens.',
    budgetMin: 15000, budgetMax: 35000, skills: ['figma', 'ui-design', 'ecommerce', 'mobile'],
  },
  {
    clientUsername: 'habesha_agency', categoryId: 'marketing',
    title: 'Manage Instagram + TikTok for a coffee brand for 3 months',
    description: 'We need a social media manager for our specialty coffee brand. Content creation, posting, engagement, monthly reports. Ethiopian coffee culture context important.',
    budgetMin: 25000, budgetMax: 50000, skills: ['social-media', 'instagram', 'tiktok', 'coffee'],
  },
  {
    clientUsername: 'habesha_agency', categoryId: 'writing',
    title: 'Translate our company website (2500 words) EN → Amharic',
    description: 'Marketing agency website — 2500 words including landing page, services, blog samples. Needs a native Amharic writer who understands marketing tone.',
    budgetMin: 3000, budgetMax: 6000, skills: ['amharic', 'translation', 'marketing', 'localization'],
  },
  {
    clientUsername: 'yidnekachew_e', categoryId: 'video',
    title: 'Edit wedding footage — 6 hours raw → 30 min film + 3 min trailer',
    description: 'Traditional Ethiopian wedding. Have ~6 hours of 4K footage + drone shots. Need a 30-min film + 3-min social trailer. Color grading matters — natural, warm tones.',
    budgetMin: 6000, budgetMax: 12000, skills: ['video-editing', 'wedding', 'color-grading', 'davinci'],
  },
  {
    clientUsername: 'yidnekachew_e', categoryId: 'design',
    title: 'Design a logo for my new construction business',
    description: 'Starting a mid-scale construction company in Bahir Dar. Need a logo that feels solid + modern + Ethiopian. 3+ concepts, full brand file pack.',
    budgetMin: 2000, budgetMax: 6000, skills: ['logo', 'branding', 'construction', 'identity'],
  },
  {
    clientUsername: 'chalachew_biz', categoryId: 'development',
    title: 'Convert my WordPress site to Next.js for speed',
    description: 'My WooCommerce site is slow. Want to migrate to Next.js keeping the same look, admin, and product catalog. ~40 products, blog, checkout with Chapa.',
    budgetMin: 20000, budgetMax: 45000, skills: ['nextjs', 'wordpress', 'woocommerce', 'chapa', 'migration'],
  },
  {
    clientUsername: 'chalachew_biz', categoryId: 'data',
    title: 'Build a sales dashboard from my QuickBooks data',
    description: 'Want an interactive dashboard showing daily sales, top products, staff performance. Data lives in QuickBooks Online. Should refresh nightly.',
    budgetMin: 8000, budgetMax: 18000, skills: ['powerbi', 'quickbooks', 'dashboard', 'sql'],
  },
  {
    clientUsername: 'zenebech_shop', categoryId: 'design',
    title: 'Design product-photography backdrops for my fashion shop',
    description: 'Small fashion brand in Mekelle. Need 5 branded backdrop designs I can print (or use digitally) for product shots. Traditional Habesha aesthetic + modern flair.',
    budgetMin: 3500, budgetMax: 7000, skills: ['graphic-design', 'photography', 'fashion', 'branding'],
  },
  {
    clientUsername: 'zenebech_shop', categoryId: 'marketing',
    title: 'Run TikTok ads for my traditional-clothing shop',
    description: 'Need someone to set up + optimize TikTok ads for our shop. Budget is ~10k ETB/month for ads on top of your fee. Target: Ethiopian diaspora + local women 18-40.',
    budgetMin: 5000, budgetMax: 12000, skills: ['tiktok-ads', 'ads-management', 'fashion', 'ethiopia'],
  },
  {
    clientUsername: 'addis_startup', categoryId: 'audio',
    title: 'Amharic voice-over for a 3-minute explainer animation',
    description: 'Animated product explainer, 3 minutes, warm friendly female voice preferred. Script provided (~450 words). Turnaround under a week.',
    budgetMin: 1500, budgetMax: 3500, skills: ['voiceover', 'amharic', 'female', 'explainer'],
  },
  {
    clientUsername: 'habesha_agency', categoryId: 'business',
    title: 'Write a business plan for a food-delivery startup',
    description: 'Launching a food-delivery startup in Addis. Need a full business plan with market analysis, financial projections, and investor summary. 25+ pages.',
    budgetMin: 12000, budgetMax: 30000, skills: ['business-plan', 'food-delivery', 'strategy', 'investor'],
  },
  {
    clientUsername: 'yidnekachew_e', categoryId: 'development',
    title: 'Fix bugs on my Flutter app + submit to Play Store',
    description: 'Existing Flutter app has ~5 bugs (mostly UI + one crash on Android 9). Need someone to fix them, add app icon polish, and submit to Google Play.',
    budgetMin: 4000, budgetMax: 10000, skills: ['flutter', 'bugfixing', 'play-store', 'android'],
  },
  {
    clientUsername: 'chalachew_biz', categoryId: 'writing',
    title: 'Write 10 SEO blog posts about Ethiopian tourism',
    description: 'Travel blog about Ethiopian destinations. 10 posts, 1000-1500 words each, SEO-optimized. Keyword list provided. Native English required.',
    budgetMin: 8000, budgetMax: 18000, skills: ['seo', 'blog', 'travel', 'ethiopia', 'content'],
  },
  {
    clientUsername: 'zenebech_shop', categoryId: 'video',
    title: 'Create 5 product reels for Instagram',
    description: '5 short vertical videos (15-30s each) showcasing fashion products. Trending music + captions. Shot footage will be provided; you handle the edit.',
    budgetMin: 3000, budgetMax: 6500, skills: ['reels', 'instagram', 'fashion', 'video-editing'],
  },
  {
    clientUsername: 'habesha_agency', categoryId: 'data',
    title: 'Scrape Ethiopian government tender listings weekly',
    description: 'Need a weekly Python scraper that pulls tender listings from 4 gov websites into a Google Sheet. Should email a summary to our team on Mondays.',
    budgetMin: 3500, budgetMax: 8000, skills: ['python', 'scraping', 'automation', 'sheets'],
  },
  {
    clientUsername: 'addis_startup', categoryId: 'business',
    title: 'Bookkeeping for our 6-month-old startup',
    description: '~150 transactions/month across Telebirr, CBE, and cash. Need clean books in QuickBooks + monthly P&L. Ongoing engagement possible.',
    budgetMin: 4000, budgetMax: 9000, skills: ['bookkeeping', 'quickbooks', 'accounting', 'startup'],
  },
  {
    clientUsername: 'yidnekachew_e', categoryId: 'design',
    title: 'Design a modern menu + signage for my new café',
    description: 'Opening a specialty coffee shop in Bahir Dar. Need menu design (printable), outdoor signage mockup, and 3 social post templates.',
    budgetMin: 3500, budgetMax: 8000, skills: ['menu-design', 'signage', 'cafe', 'branding'],
  },
];

async function main() {
  console.log('🌱 Marketplace seed starting…');

  // ---------- Freelancers + their gigs ----------
  for (const f of FREELANCERS) {
    const user = await prisma.user.upsert({
      where: { phone: f.phone },
      create: {
        phone: f.phone,
        fullName: f.fullName,
        username: f.username,
        role: 'FREELANCER',
        title: f.title,
        bio: f.bio,
        city: f.city,
        hourlyRateEtb: f.rate,
        rating: f.rating,
        ratingCount: f.ratingCount,
        completedOrders: f.completed,
        isPhoneVerified: true,
        isIdVerified: true,
        isOnboarded: true,
        wallet: { create: { balanceEtb: f.balance, lifetimeEarnedEtb: f.balance * 3 } },
      },
      update: {
        title: f.title, bio: f.bio, city: f.city, hourlyRateEtb: f.rate,
        rating: f.rating, ratingCount: f.ratingCount, completedOrders: f.completed,
      },
    });

    for (const g of f.gigs) {
      const gigSlug = `${slug(g.title)}-${shortHash(user.id + g.title)}`;
      const cheapest = Math.min(...g.packages.map((p) => p.priceEtb));
      const existing = await prisma.gig.findUnique({ where: { slug: gigSlug }, select: { id: true } });
      if (existing) continue;
      await prisma.gig.create({
        data: {
          ownerId: user.id,
          slug: gigSlug,
          title: g.title,
          categoryId: g.categoryId,
          tags: g.tags,
          description: g.description,
          status: 'ACTIVE',
          rating: g.rating ?? 4.8,
          ratingCount: g.ratingCount ?? 0,
          ordersCount: g.ordersCount ?? 0,
          startingPriceEtb: cheapest,
          packages: {
            create: g.packages.map((p) => ({
              tier: p.tier, title: p.title, description: p.description,
              priceEtb: p.priceEtb, deliveryDays: p.deliveryDays, revisions: p.revisions,
            })),
          },
        },
      });
    }
  }

  // ---------- Clients ----------
  const clientMap = new Map<string, string>();
  for (const c of CLIENTS) {
    const u = await prisma.user.upsert({
      where: { phone: c.phone },
      create: {
        phone: c.phone, fullName: c.fullName, username: c.username, city: c.city,
        role: 'CLIENT', isPhoneVerified: true, isOnboarded: true,
        wallet: { create: {} },
      },
      update: { fullName: c.fullName, city: c.city },
    });
    clientMap.set(c.username, u.id);
  }

  // ---------- Jobs ----------
  for (const j of JOBS) {
    const clientId = clientMap.get(j.clientUsername);
    if (!clientId) continue;
    // Idempotency key on (clientId, hash(title))
    const key = shortHash(clientId + j.title);
    const already = await prisma.job.findFirst({
      where: { clientId, title: j.title }, select: { id: true },
    });
    if (already) continue;
    await prisma.job.create({
      data: {
        clientId,
        title: j.title,
        description: j.description,
        categoryId: j.categoryId,
        budgetMinEtb: j.budgetMin ?? null,
        budgetMaxEtb: j.budgetMax ?? null,
        requiredSkills: j.skills,
        isRemote: j.isRemote ?? true,
        isOpen: true,
      },
    });
  }

  const gigCount = await prisma.gig.count({ where: { status: 'ACTIVE' } });
  const jobCount = await prisma.job.count({ where: { isOpen: true } });
  const userCount = await prisma.user.count();
  console.log(`✅ Done. Users=${userCount} · Active gigs=${gigCount} · Open jobs=${jobCount}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
