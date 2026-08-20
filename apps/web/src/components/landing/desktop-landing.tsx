'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Search, Moon, Sun, Menu, X, ArrowRight, Star, MapPin, CheckCircle2 } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { CATEGORIES, APP_NAME } from '@apex-work/shared';
import { cn, formatEtb } from '@/lib/utils';

const stats = [
  { value: '12.4K', label: 'Verified freelancers' },
  { value: '47', label: 'Skill categories' },
  { value: '98%', label: 'Client satisfaction' },
  { value: '24h', label: 'Avg. delivery' },
];

const featured = [
  {
    name: 'Selam Assefa',
    title: 'Senior UI/UX Designer',
    city: 'Addis Ababa',
    rating: 4.98,
    reviews: 312,
    skills: ['Figma', 'Design Systems', 'Webflow', 'Branding'],
    price: 2500,
    initials: 'SA',
    gradient: 'from-violet-500 to-emerald-500',
  },
  {
    name: 'Dawit Tesfaye',
    title: 'Full-Stack Developer',
    city: 'Bahir Dar',
    rating: 5.0,
    reviews: 198,
    skills: ['React', 'Node.js', 'Next.js', 'PostgreSQL'],
    price: 4800,
    initials: 'DT',
    gradient: 'from-amber-500 to-red-500',
  },
  {
    name: 'Hanna Wolde',
    title: 'Amharic Copywriter',
    city: 'Hawassa',
    rating: 4.95,
    reviews: 421,
    skills: ['Amharic', 'SEO', 'Translation', 'Storytelling'],
    price: 1200,
    initials: 'HW',
    gradient: 'from-cyan-500 to-violet-500',
  },
];

export function DesktopLanding() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { theme, setTheme } = useTheme();

  return (
    <div className="mesh-bg min-h-screen">
      {/* Navigation */}
      <nav className="sticky top-4 z-50 mx-auto mt-4 max-w-[1240px] px-4">
        <div className="flex items-center gap-6 rounded-full border border-border bg-background/60 px-5 py-3 shadow-lg backdrop-blur-xl backdrop-saturate-150">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg tracking-tight">
            <span className="grad-hero grid h-8 w-8 place-items-center rounded-xl text-white font-extrabold shadow-md shadow-primary/40">
              A
            </span>
            <span>
              Apex<span className="text-accent">-Work</span>
            </span>
          </Link>
          <div className="ml-auto hidden md:flex gap-1">
            {['Browse', 'How it works', 'AI Tools', 'Pricing'].map((l) => (
              <Link
                key={l}
                href="#"
                className="rounded-full px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                {l}
              </Link>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="grid h-9 w-9 place-items-center rounded-full border border-border bg-background/50 transition-transform hover:rotate-12"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <Button asChild variant="ghost" size="sm" className="hidden md:inline-flex">
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild size="sm" className="hidden md:inline-flex">
              <Link href="/signup">Join free</Link>
            </Button>
            <button
              className="md:hidden grid h-9 w-9 place-items-center rounded-full border border-border"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Menu"
            >
              {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>
        {menuOpen && (
          <div className="md:hidden mt-2 rounded-2xl border border-border bg-background/90 p-4 backdrop-blur-xl">
            <div className="flex flex-col gap-1">
              {['Browse', 'How it works', 'AI Tools', 'Pricing'].map((l) => (
                <Link key={l} href="#" className="rounded-lg px-4 py-3 text-sm font-medium hover:bg-secondary">
                  {l}
                </Link>
              ))}
              <Button asChild variant="brand" className="mt-2">
                <Link href="/signup">Join free</Link>
              </Button>
            </div>
          </div>
        )}
      </nav>

      {/* Hero */}
      <section className="container relative pt-24 pb-20 text-center">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-medium text-primary"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-pulse-brand absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
          </span>
          Now live in Addis Ababa · 12,400+ freelancers
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="mx-auto mt-6 max-w-4xl text-balance font-display text-5xl font-extrabold leading-[1.02] tracking-tighter md:text-7xl lg:text-8xl"
        >
          Ethiopia&apos;s most powerful
          <br />
          <span className="grad-text">freelance marketplace.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="mx-auto mt-6 max-w-2xl text-base text-muted-foreground md:text-xl"
        >
          Hire vetted digital talent or land your next gig — powered by AI, paid in Telebirr,
          built for አማርኛ speakers.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row"
        >
          <Button asChild variant="brand" size="lg">
            <Link href="/browse">
              Find talent <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild size="lg">
            <Link href="/signup">Become a freelancer</Link>
          </Button>
        </motion.div>

        {/* Search */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="mx-auto mt-12 flex max-w-2xl items-center gap-2 rounded-full border border-border bg-card p-2 shadow-lg focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/20"
        >
          <Search className="ml-4 h-5 w-5 shrink-0 text-muted-foreground" />
          <input
            className="flex-1 bg-transparent px-2 py-2 text-sm outline-none placeholder:text-muted-foreground"
            placeholder="Try 'Amharic translator' or 'React developer'…"
          />
          <Button variant="brand" className="hidden sm:inline-flex">
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
          {stats.map((s) => (
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
        <SectionHeader eyebrow="Explore" title="Digital skills, all in one place" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          {CATEGORIES.map((c) => (
            <Link
              key={c.id}
              href={`/browse?category=${c.slug}`}
              className="group relative overflow-hidden rounded-2xl border border-border bg-card p-5 transition-all hover:-translate-y-1 hover:border-primary hover:shadow-lg"
            >
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/15 text-2xl text-primary transition-transform group-hover:-rotate-6 group-hover:scale-110">
                {c.icon}
              </div>
              <h3 className="mt-4 text-sm font-semibold md:text-base">{c.label}</h3>
              <p className="mt-1 text-xs text-muted-foreground">Browse services</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured freelancers */}
      <section className="container py-20">
        <SectionHeader eyebrow="Top talent" title={`Meet Ethiopia's finest`} />
        <div className="grid gap-5 md:grid-cols-3">
          {featured.map((f) => (
            <FreelancerCard key={f.name} f={f} />
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="container py-20">
        <SectionHeader eyebrow="Simple process" title="Hire in 3 steps" />
        <div className="grid gap-8 md:grid-cols-3">
          {[
            { n: 1, t: 'Post your project', d: 'AI turns your description into a professional brief.' },
            { n: 2, t: 'Get matched instantly', d: 'Vetted freelancers apply. Compare, chat, choose.' },
            { n: 3, t: 'Pay when happy', d: 'Escrow via Chapa — funds released on delivery.' },
          ].map((s) => (
            <div key={s.n} className="text-center">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-full border-2 border-border bg-card text-xl font-extrabold transition-all hover:scale-110 hover:border-primary hover:text-primary hover:shadow-lg hover:shadow-primary/30">
                {s.n}
              </div>
              <h3 className="mt-5 text-xl font-bold">{s.t}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="container py-20">
        <div className="relative overflow-hidden rounded-3xl border border-border bg-card p-12 text-center md:p-20">
          <div className="mesh-bg absolute inset-0" />
          <div className="relative">
            <h2 className="text-3xl font-extrabold tracking-tight md:text-5xl">
              Your next project starts here.
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground md:text-lg">
              Join thousands of Ethiopian freelancers and clients building the future of work.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild variant="brand" size="lg">
                <Link href="/signup">Start hiring</Link>
              </Button>
              <Button asChild size="lg">
                <Link href="/signup?role=FREELANCER">Sign up as freelancer</Link>
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
            <div className="text-xs text-muted-foreground">Built on 100% open source</div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function SectionHeader({ eyebrow, title, description }: { eyebrow: string; title: string; description?: string }) {
  return (
    <div className="mx-auto mb-12 max-w-xl text-center">
      <span className="text-xs font-bold uppercase tracking-widest text-accent">{eyebrow}</span>
      <h2 className="mt-3 text-3xl font-extrabold tracking-tight md:text-5xl">{title}</h2>
      {description && <p className="mt-3 text-muted-foreground">{description}</p>}
    </div>
  );
}

function FreelancerCard({ f }: { f: (typeof featured)[number] }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border bg-card transition-all hover:-translate-y-1 hover:shadow-xl">
      <div className={cn('h-24 bg-gradient-to-br', f.gradient)} />
      <div className="px-5 pb-5">
        <div className="-mt-8 flex items-end gap-3">
          <div className={cn('grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br text-xl font-bold text-white ring-4 ring-card', f.gradient)}>
            {f.initials}
          </div>
          <div className="pb-1">
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
            <span key={s} className="rounded-full border border-border bg-secondary px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
              {s}
            </span>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
          <div className="text-xs text-muted-foreground">
            From <span className="text-base font-extrabold text-foreground">{formatEtb(f.price)}</span>
          </div>
          <Button size="sm">Hire</Button>
        </div>
      </div>
    </div>
  );
}
