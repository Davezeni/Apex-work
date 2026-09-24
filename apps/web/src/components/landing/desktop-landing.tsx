'use client';

import { dt } from '@/i18n/auto';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Search, Moon, Sun, Menu, X, ArrowRight, Star, MapPin, CheckCircle2 } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { useHomeConfig, type HomeConfig } from '@/hooks/use-home-config';
import { CATEGORIES, APP_NAME } from '@apex-work/shared';
import { CATEGORY_COLORS } from '@/lib/category-colors';
import { cn, formatEtb } from '@/lib/utils';
import Image from 'next/image';
/** Floating hero labels: category chips drifting on the photo's empty space.
 *  Each uses the color that best describes its category. */
const HERO_CHIPS = [
  { id: 'development', label: 'Development', pos: { top: '5%', left: '-3%' }, duration: '5.5s' },
  { id: 'design', label: 'Design', pos: { top: '13%', right: '-2%' }, duration: '6.5s' },
  {
    id: 'marketing',
    label: 'Digital Marketing',
    pos: { top: '34%', right: '8%' },
    duration: '6.8s',
  },
  {
    id: 'writing',
    label: 'Writing & Translation',
    pos: { top: '44%', left: '-6%' },
    duration: '6s',
  },
  { id: 'video', label: 'Video & Animation', pos: { top: '58%', right: '-4%' }, duration: '5s' },
  { id: 'audio', label: 'Music & Audio', pos: { bottom: '16%', left: '1%' }, duration: '7s' },
  { id: 'data', label: 'Data & AI', pos: { bottom: '5%', right: '5%' }, duration: '5.8s' },
] as const;

const DEFAULT_HOME: HomeConfig = {
  heroBadge: 'Now live in Addis Ababa · 12,400+ freelancers',
  heroTitle: 'Skip the Overhead.',
  heroTitleAccent: 'Hire the Expert.',
  heroSubtitle:
    'Hire vetted digital talent or land your next gig — powered by AI, paid in Telebirr, built for አማርኛ speakers.',
  heroCtaPrimary: 'Find talent',
  heroCtaSecondary: 'Become a freelancer',
  searchPlaceholder: "Try 'Amharic translator' or 'React developer'…",
  stats: [
    { value: '12.4K', label: 'Verified freelancers' },
    { value: '47', label: 'Skill categories' },
    { value: '98%', label: 'Client satisfaction' },
    { value: '24h', label: 'Avg. delivery' },
  ],
  howItWorks: [
    {
      title: 'Post your project',
      description: 'AI turns your description into a professional brief.',
    },
    {
      title: 'Get matched instantly',
      description: 'Vetted freelancers apply. Compare, chat, choose.',
    },
    { title: 'Pay when happy', description: 'Escrow via Chapa — funds released on delivery.' },
  ],
  featured: [
    {
      name: 'Selam Assefa',
      title: 'Senior UI/UX Designer',
      city: 'Addis Ababa',
      rating: '4.98',
      reviews: 312,
      skills: ['Figma', 'Design Systems', 'Webflow', 'Branding'],
      price: 2500,
      gradient: 'from-primary to-primary/50',
    },
    {
      name: 'Dawit Tesfaye',
      title: 'Full-Stack Developer',
      city: 'Bahir Dar',
      rating: '5.0',
      reviews: 198,
      skills: ['React', 'Node.js', 'Next.js', 'PostgreSQL'],
      price: 4800,
      gradient: 'from-indigo-600 to-slate-600',
    },
    {
      name: 'Hanna Wolde',
      title: 'Amharic Copywriter',
      city: 'Hawassa',
      rating: '4.95',
      reviews: 421,
      skills: ['Amharic', 'SEO', 'Translation', 'Storytelling'],
      price: 1200,
      gradient: 'from-primary/70 to-primary/40',
    },
  ],
  pricingClient: {
    heading: 'For clients',
    price: 'Free to post',
    description: 'Browse talent, chat, and compare proposals before you hire.',
    cta: 'Post a job',
  },
  pricingFreelancer: {
    heading: 'For freelancers',
    price: 'Join free',
    description: 'Create your profile, showcase work, and apply to jobs.',
    cta: 'Become a freelancer',
  },
  cta: {
    title: 'Your next project starts here.',
    subtitle: 'Join thousands of Ethiopian freelancers and clients building the future of work.',
    primary: 'Start hiring',
    secondary: 'Sign up as freelancer',
  },
};

export function DesktopLanding() {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState('');
  const { theme, setTheme } = useTheme();
  // Admin-editable marketing copy; falls back to DEFAULT_HOME until loaded.
  const { data } = useHomeConfig();
  const home = data ?? DEFAULT_HOME;

  const runSearch = () => {
    const query = search.trim();
    router.push(query ? `/search?q=${encodeURIComponent(query)}` : '/search');
  };

  const navLinks = [
    { label: 'Browse', href: '/browse' },
    { label: 'How it works', href: '/how-it-works' },
    { label: 'AI Tools', href: '/ai' },
    { label: 'About', href: '/about' },
  ];

  return (
    <div className="mesh-bg min-h-screen">
      {/* Navigation */}
      <nav className="sticky top-4 z-50 mx-auto mt-4 max-w-[1240px] px-4">
        <div className="flex items-center gap-6 rounded-full border border-border bg-background/60 px-5 py-3 shadow-lg backdrop-blur-xl backdrop-saturate-150">
          <Link href="/" className="flex items-center gap-2 text-lg font-bold tracking-tight">
            <span className="grad-hero grid h-8 w-8 place-items-center rounded-xl font-extrabold text-white shadow-md shadow-primary/40">
              A
            </span>
            <span>
              Apex<span className="text-accent">-Work</span>
            </span>
          </Link>
          <div className="ml-auto hidden gap-1 md:flex">
            {navLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="rounded-full px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="grid h-9 w-9 place-items-center rounded-full border border-border bg-background/50 transition-transform hover:rotate-12"
              aria-label={dt('Toggle theme')}
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <Button asChild variant="ghost" size="sm" className="hidden md:inline-flex">
              <Link href="/login">{dt('Sign in')}</Link>
            </Button>
            <Button asChild size="sm" className="hidden md:inline-flex">
              <Link href="/signup">{dt('Join free')}</Link>
            </Button>
            <button
              className="grid h-9 w-9 place-items-center rounded-full border border-border md:hidden"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label={dt('Menu')}
            >
              {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>
        {menuOpen && (
          <div className="mt-2 rounded-2xl border border-border bg-background/90 p-4 backdrop-blur-xl md:hidden">
            <div className="flex flex-col gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className="rounded-lg px-4 py-3 text-sm font-medium hover:bg-secondary"
                >
                  {link.label}
                </Link>
              ))}
              <Button asChild variant="brand" className="mt-2">
                <Link href="/signup">{dt('Join free')}</Link>
              </Button>
            </div>
          </div>
        )}
      </nav>

      {/* Hero */}
      <section className="container relative pb-20 pt-2 text-center lg:text-left">
        <div className="grid items-center gap-14 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-medium text-primary"
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-pulse-brand rounded-full bg-accent opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
              </span>
              {home.heroBadge}
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
              className="mx-auto mt-6 max-w-4xl text-balance font-display text-4xl font-extrabold leading-[1.05] tracking-tighter md:text-5xl lg:text-6xl xl:text-7xl"
            >
              {home.heroTitle}
              <br />
              <span className="text-[#0D9488] dark:text-[#2DD4BF]">{home.heroTitleAccent}</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="mx-auto mt-6 max-w-2xl text-base text-muted-foreground md:text-xl lg:mx-0"
            >
              {home.heroSubtitle}
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row lg:justify-start"
            >
              <Button asChild variant="brand" size="lg">
                <Link href="/browse">
                  {home.heroCtaPrimary} <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg">
                <Link href="/signup">{home.heroCtaSecondary}</Link>
              </Button>
            </motion.div>
          </div>

          {/* Hero visual — the photo doubles as the stage: floating category
              labels drift on its empty white space, each in the color that
              best describes the category. Left edge fades into the hero. */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.9, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="relative hidden lg:block"
          >
            <div
              className="overflow-hidden rounded-[2rem]"
              style={{
                maskImage:
                  'linear-gradient(to right, transparent, black 9%, black 91%, transparent)',
                WebkitMaskImage:
                  'linear-gradient(to right, transparent, black 9%, black 91%, transparent)',
              }}
            >
              <Image
                src="/hero/hero-beanbag.jpg"
                alt={dt('A freelancer working comfortably on a laptop')}
                width={626}
                height={428}
                priority
                className="h-auto w-full object-cover"
              />
            </div>
            {HERO_CHIPS.map((chip, i) => (
              <div
                key={chip.id}
                className="animate-float absolute z-10 flex items-center gap-2 rounded-full border border-border bg-card/95 py-2 pl-3 pr-4 shadow-xl backdrop-blur"
                style={{
                  ...chip.pos,
                  animationDelay: `${i * 0.7}s`,
                  animationDuration: chip.duration,
                }}
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: CATEGORY_COLORS[chip.id] }}
                />
                <span
                  className="whitespace-nowrap text-xs font-bold"
                  style={{ color: CATEGORY_COLORS[chip.id] }}
                >
                  {chip.label}
                </span>
              </div>
            ))}
          </motion.div>
        </div>

        {/* Search — centered across the full hero, a touch wider */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="mx-auto mt-10 flex w-full max-w-3xl items-center gap-2 rounded-full border border-border bg-card p-2 shadow-lg focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/20"
        >
          <Search className="ml-4 h-5 w-5 shrink-0 text-muted-foreground" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') runSearch();
            }}
            className="flex-1 bg-transparent px-2 py-2 text-sm outline-none placeholder:text-muted-foreground"
            placeholder={home.searchPlaceholder}
            aria-label={dt('Search freelancers and services')}
          />
          <Button variant="brand" className="hidden sm:inline-flex" onClick={runSearch}>
            Search
          </Button>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="mt-16 grid grid-cols-2 gap-8 md:flex md:justify-center md:gap-16"
        >
          {home.stats.map((s) => (
            <div key={s.label} className="text-center">
              <div className="grad-text text-3xl font-extrabold tracking-tight md:text-4xl">
                {s.value}
              </div>
              <div className="mt-1 text-xs text-muted-foreground md:text-sm">{s.label}</div>
            </div>
          ))}
        </motion.div>
      </section>

      {/* Categories */}
      <section className="container py-20">
        <SectionHeader eyebrow="Explore" title={dt('Digital skills, all in one place')} />
        {/* Auto-scrolling marquee — same machinery as the browse chips
            (.chip-marquee: pauses on hover/press, static for reduced-motion).
            The clone half makes the -50% translate loop seamless. */}
        <div className="mt-10 overflow-hidden">
          <div className="chip-marquee flex w-max">
            <div className="flex shrink-0 gap-4 pr-4">
              {CATEGORIES.map((c) => (
                <Link
                  key={c.id}
                  href={`/browse?category=${c.slug}`}
                  className="group relative w-56 shrink-0 overflow-hidden rounded-2xl border border-border bg-card p-5 transition-all hover:-translate-y-1 hover:border-primary hover:shadow-lg"
                >
                  <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-2xl transition-transform group-hover:-rotate-6 group-hover:scale-110">
                    {c.icon}
                  </div>
                  <h3 className="mt-4 text-sm font-semibold md:text-base">{c.label}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">{dt('Browse services')}</p>
                </Link>
              ))}
            </div>
            <div aria-hidden="true" className="flex shrink-0 gap-4 pr-4">
              {CATEGORIES.map((c) => (
                <Link
                  key={`dup-${c.id}`}
                  tabIndex={-1}
                  href={`/browse?category=${c.slug}`}
                  className="group relative w-56 shrink-0 overflow-hidden rounded-2xl border border-border bg-card p-5 transition-all hover:-translate-y-1 hover:border-primary hover:shadow-lg"
                >
                  <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-2xl transition-transform group-hover:-rotate-6 group-hover:scale-110">
                    {c.icon}
                  </div>
                  <h3 className="mt-4 text-sm font-semibold md:text-base">{c.label}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">{dt('Browse services')}</p>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Featured freelancers */}
      <section className="container py-20">
        <SectionHeader eyebrow="Top talent" title={`Meet Ethiopia's finest`} />
        <div className="grid gap-5 md:grid-cols-3">
          {home.featured.map((f) => (
            <FreelancerCard key={f.name} f={f} />
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="container scroll-mt-24 py-20">
        <SectionHeader eyebrow="Simple process" title={dt('Hire in 3 steps')} />
        <div className="grid gap-8 md:grid-cols-3">
          {home.howItWorks.map((s, idx) => (
            <div key={idx} className="text-center">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-full border-2 border-border bg-card text-xl font-extrabold transition-all hover:scale-110 hover:border-primary hover:text-primary hover:shadow-lg hover:shadow-primary/30">
                {idx + 1}
              </div>
              <h3 className="mt-5 text-xl font-bold">{s.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="container scroll-mt-24 py-20">
        <SectionHeader
          eyebrow="Simple pricing"
          title={dt('Keep more of what you earn')}
          description="Start free. Pay only when you complete a paid project."
        />
        <div className="mx-auto grid max-w-4xl gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="text-sm font-bold text-primary">{home.pricingClient.heading}</div>
            <div className="mt-2 text-3xl font-extrabold">{home.pricingClient.price}</div>
            <p className="mt-2 text-sm text-muted-foreground">{home.pricingClient.description}</p>
            <Button asChild variant="brand" className="mt-5 w-full">
              <Link href="/jobs/new">{home.pricingClient.cta}</Link>
            </Button>
          </div>
          <div className="rounded-2xl border border-primary/40 bg-primary/5 p-6">
            <div className="text-sm font-bold text-accent">{home.pricingFreelancer.heading}</div>
            <div className="mt-2 text-3xl font-extrabold">{home.pricingFreelancer.price}</div>
            <p className="mt-2 text-sm text-muted-foreground">
              {home.pricingFreelancer.description}
            </p>
            <Button asChild className="mt-5 w-full">
              <Link href="/signup?role=FREELANCER">{home.pricingFreelancer.cta}</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container py-20">
        <div className="relative overflow-hidden rounded-3xl border border-border bg-card p-12 text-center md:p-20">
          <div className="mesh-bg absolute inset-0" />
          <div className="relative">
            <h2 className="text-3xl font-extrabold tracking-tight md:text-5xl">{home.cta.title}</h2>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground md:text-lg">
              {home.cta.subtitle}
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild variant="brand" size="lg">
                <Link href="/signup">{home.cta.primary}</Link>
              </Button>
              <Button asChild size="lg">
                <Link href="/signup?role=FREELANCER">{home.cta.secondary}</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="container pb-10 pt-16">
        <div className="border-t border-border pt-8">
          <div className="flex flex-col items-center gap-4 md:flex-row md:justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="grad-hero grid h-6 w-6 place-items-center rounded-md text-xs font-bold text-white">
                A
              </span>
              © 2026 {APP_NAME} · Made with 🇪🇹 in Addis Ababa
            </div>
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <Link className="hover:text-foreground" href="/about">
                About
              </Link>
              <Link className="hover:text-foreground" href="/contact">
                Contact
              </Link>
              <Link className="hover:text-foreground" href="/trust-safety">
                Trust & safety
              </Link>
              <Link className="hover:text-foreground" href="/legal/privacy">
                Privacy
              </Link>
              <Link className="hover:text-foreground" href="/legal/terms">
                Terms
              </Link>
              <span>{dt('Built on 100% open source')}</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function SectionHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="mx-auto mb-12 max-w-xl text-center">
      <span className="text-xs font-bold uppercase tracking-widest text-accent">{eyebrow}</span>
      <h2 className="mt-3 text-3xl font-extrabold tracking-tight md:text-5xl">{title}</h2>
      {description && <p className="mt-3 text-muted-foreground">{description}</p>}
    </div>
  );
}

function FreelancerCard({ f }: { f: HomeConfig['featured'][number] }) {
  const initials = (f.name || '?')
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border bg-card transition-all hover:-translate-y-1 hover:shadow-xl">
      <div className={cn('h-24 bg-gradient-to-br', f.gradient)} />
      <div className="px-5 pb-5">
        <div className="-mt-8 flex items-center gap-3">
          <div
            className={cn(
              'grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br text-xl font-bold text-white ring-4 ring-card',
              f.gradient,
            )}
          >
            {initials}
          </div>
          <div className="self-start pt-1.5">
            <h3 className="flex items-center gap-1.5 text-base font-bold">
              {f.name}
              <CheckCircle2 className="h-4 w-4 text-cyan-400" />
            </h3>
            <p className="text-xs text-muted-foreground">{f.title}</p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
            <span className="font-semibold text-foreground">{f.rating}</span> ({f.reviews})
          </span>
          <span>·</span>
          <span className="flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {f.city}
          </span>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {f.skills.map((s) => (
            <span
              key={s}
              className="rounded-full border border-border bg-secondary px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
            >
              {s}
            </span>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
          <div className="text-xs text-muted-foreground">
            From{' '}
            <span className="text-base font-extrabold text-foreground">{formatEtb(f.price)}</span>
          </div>
          <Button asChild size="sm">
            <Link href="/browse">{dt('Hire')}</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
