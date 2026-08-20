/**
 * Seed script — creates categories, skills, and a couple of demo users/gigs.
 * Idempotent: safe to re-run.
 */
import { PrismaClient } from '@prisma/client';
import { CATEGORIES } from '@apex-work/shared';

const prisma = new PrismaClient();

const SKILLS = [
  { name: 'React', category: 'development' },
  { name: 'Next.js', category: 'development' },
  { name: 'Node.js', category: 'development' },
  { name: 'TypeScript', category: 'development' },
  { name: 'PostgreSQL', category: 'development' },
  { name: 'Figma', category: 'design' },
  { name: 'UI/UX', category: 'design' },
  { name: 'Logo Design', category: 'design' },
  { name: 'Amharic Translation', category: 'writing' },
  { name: 'SEO', category: 'marketing' },
  { name: 'Video Editing', category: 'video' },
  { name: 'Motion Graphics', category: 'video' },
  { name: 'Voice Over', category: 'audio' },
  { name: 'Data Analysis', category: 'data' },
];

const slugify = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

async function main() {
  console.log('🌱 Seeding…');

  // Skills
  for (const s of SKILLS) {
    await prisma.skill.upsert({
      where: { name: s.name },
      create: { name: s.name, slug: slugify(s.name), category: s.category },
      update: {},
    });
  }
  console.log(`  ✓ ${SKILLS.length} skills`);
  console.log(`  ✓ ${CATEGORIES.length} categories (constants, no DB rows needed)`);

  // Demo users — only in non-prod
  if (process.env.NODE_ENV !== 'production') {
    const demoClient = await prisma.user.upsert({
      where: { phone: '+251911111111' },
      create: {
        phone: '+251911111111',
        fullName: 'Demo Client',
        username: 'democlient',
        role: 'CLIENT',
        isPhoneVerified: true,
        isOnboarded: true,
        wallet: { create: {} },
      },
      update: {},
    });

    const demoSeller = await prisma.user.upsert({
      where: { phone: '+251922222222' },
      create: {
        phone: '+251922222222',
        fullName: 'Selam Assefa',
        username: 'selamdesigns',
        role: 'FREELANCER',
        title: 'Senior UI/UX Designer',
        bio: 'Product designer with 5+ years of experience building beautiful, usable interfaces for African startups.',
        city: 'Addis Ababa',
        hourlyRateEtb: 1500,
        isPhoneVerified: true,
        isIdVerified: true,
        isOnboarded: true,
        rating: 4.9,
        ratingCount: 42,
        completedOrders: 58,
        wallet: { create: { balanceEtb: 12_400 } },
      },
      update: {},
    });

    // Demo gig
    const gigSlug = 'modern-saas-landing-page-design';
    await prisma.gig.upsert({
      where: { slug: gigSlug },
      create: {
        ownerId: demoSeller.id,
        title: 'I will design a modern SaaS landing page in 48h',
        slug: gigSlug,
        categoryId: 'design',
        tags: ['figma', 'saas', 'landing', 'ui'],
        description:
          'I design conversion-focused landing pages for SaaS startups. You get modern layouts, brand-consistent visuals, and mobile-responsive designs ready for developer handoff.',
        status: 'ACTIVE',
        startingPriceEtb: 2500,
        rating: 4.98,
        ratingCount: 312,
        packages: {
          create: [
            {
              tier: 'BASIC',
              title: 'One-page design',
              description: 'Hero + 3 sections, 1 revision, Figma file',
              priceEtb: 2500,
              deliveryDays: 3,
              revisions: 1,
            },
            {
              tier: 'STANDARD',
              title: 'Full landing page',
              description: 'Hero + 6 sections, 3 revisions, Figma + assets',
              priceEtb: 5500,
              deliveryDays: 5,
              revisions: 3,
            },
            {
              tier: 'PREMIUM',
              title: 'Landing + brand kit',
              description: 'Full page + logo tweak + color/typography guide',
              priceEtb: 12_000,
              deliveryDays: 10,
              revisions: 5,
            },
          ],
        },
      },
      update: {},
    });

    console.log(`  ✓ Demo users: ${demoClient.username}, ${demoSeller.username}`);
    console.log(`  ✓ Demo gig: ${gigSlug}`);
  }

  console.log('✅ Seed complete');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
