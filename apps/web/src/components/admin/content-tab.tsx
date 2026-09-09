'use client';

import { dt } from '@/i18n/auto';
import { useState } from 'react';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/auth-store';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import { SectionHead, Spinner, Empty } from './admin-ui';
import { Markdown } from '@/components/markdown';
import type { HomeConfig } from '@/hooks/use-home-config';
type ContentPage = { slug: string; title: string; markdown: string; updatedAt: string | null };
type SiteConfig = {
  brandName: string;
  tagline: string;
  supportEmail: string;
  supportPhone: string;
  supportTelegram: string;
  privacyEmail: string;
  legalEmail: string;
};

function SiteConfigCard({ site, token }: { site: SiteConfig; token: string | null }) {
  const qc = useQueryClient();
  const [f, setF] = useState<SiteConfig>(site);
  const save = useMutation({
    mutationFn: () =>
      apiFetch<SiteConfig>('/admin/ops/content/site', { method: 'PUT', token, body: f }),
    onSuccess: () => {
      toast.success(dt('Brand & contact saved'));
      qc.invalidateQueries({ queryKey: ['admin/content'] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const fields: { key: keyof SiteConfig; label: string; type?: string }[] = [
    { key: 'brandName', label: 'Brand name' },
    { key: 'tagline', label: 'Tagline' },
    { key: 'supportEmail', label: 'Support email', type: 'email' },
    { key: 'supportPhone', label: 'Support phone' },
    { key: 'supportTelegram', label: 'Support Telegram link' },
    { key: 'privacyEmail', label: 'Privacy email', type: 'email' },
    { key: 'legalEmail', label: 'Legal email', type: 'email' },
  ];

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-sm font-extrabold">{dt('Brand & contact')}</div>
          <div className="text-[11px] text-muted-foreground">
            Used on the Help, Contact, legal and footer across the app.
          </div>
        </div>
        <Button size="sm" variant="brand" onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? 'Saving…' : 'Save'}
        </Button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {fields.map((fld) => (
          <div key={fld.key}>
            <label className="mb-1 block text-[11px] font-bold uppercase text-muted-foreground">
              {fld.label}
            </label>
            <input
              type={fld.type ?? 'text'}
              value={f[fld.key]}
              onChange={(e) => setF((prev) => ({ ...prev, [fld.key]: e.target.value }))}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Live preview toggle inside the editor card. */
function EditingCard({ page, token }: { page: ContentPage; token: string | null }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState(page.title);
  const [markdown, setMarkdown] = useState(page.markdown);
  const [preview, setPreview] = useState(false);
  const save = useMutation({
    mutationFn: () =>
      apiFetch<ContentPage>(`/admin/ops/content/${page.slug}`, {
        method: 'PUT',
        token,
        body: { title, markdown },
      }),
    onSuccess: () => {
      toast.success(`“${title}” saved`);
      qc.invalidateQueries({ queryKey: ['admin/content'] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-extrabold">{page.slug}</div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setPreview((v) => !v)}
            className={cn(
              'rounded-full px-3 py-1 text-[11px] font-bold',
              preview ? 'bg-primary text-white' : 'border border-border text-muted-foreground',
            )}
          >
            {preview ? 'Edit' : 'Preview'}
          </button>
          <Button size="sm" variant="brand" onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>

      {preview ? (
        <div className="rounded-xl border border-border bg-background p-3">
          <div className="mb-2 text-lg font-extrabold">{title}</div>
          <Markdown>{markdown}</Markdown>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase text-muted-foreground">
              Title
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase text-muted-foreground">
              Markdown body
            </label>
            <textarea
              value={markdown}
              onChange={(e) => setMarkdown(e.target.value)}
              rows={14}
              className="w-full resize-y rounded-xl border border-border bg-background px-3 py-2 font-mono text-xs outline-none focus:border-primary"
            />
            <p className="mt-1 text-[10px] text-muted-foreground">
              Supports headings (<code>## </code>), paragraphs, <code>**bold**</code>,{' '}
              <code>*italic*</code>, lists, links, and <code>&gt; quote</code>.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-bold uppercase text-muted-foreground">
        {label}
      </label>
      <input
        type={type ?? 'text'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
      />
    </div>
  );
}

function HomeConfigCard({ home, token }: { home: HomeConfig; token: string | null }) {
  const qc = useQueryClient();
  const [f, setF] = useState<HomeConfig>(home);
  const save = useMutation({
    mutationFn: () =>
      apiFetch<HomeConfig>('/admin/ops/content/home', { method: 'PUT', token, body: f }),
    onSuccess: () => {
      toast.success(dt('Home page copy saved'));
      qc.invalidateQueries({ queryKey: ['admin/content'] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-sm font-extrabold">{dt('Landing page')}</div>
          <div className="text-[11px] text-muted-foreground">
            Hero, stats, how-it-works, featured freelancers, pricing & CTA.
          </div>
        </div>
        <Button size="sm" variant="brand" onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? 'Saving…' : 'Save'}
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Field
          label={dt('Hero badge')}
          value={f.heroBadge}
          onChange={(v) => setF({ ...f, heroBadge: v })}
        />
        <Field
          label={dt('Hero title')}
          value={f.heroTitle}
          onChange={(v) => setF({ ...f, heroTitle: v })}
        />
        <Field
          label={dt('Hero accent')}
          value={f.heroTitleAccent}
          onChange={(v) => setF({ ...f, heroTitleAccent: v })}
        />
        <Field
          label={dt('Search placeholder')}
          value={f.searchPlaceholder}
          onChange={(v) => setF({ ...f, searchPlaceholder: v })}
        />
        <Field
          label={dt('Hero CTA (primary)')}
          value={f.heroCtaPrimary}
          onChange={(v) => setF({ ...f, heroCtaPrimary: v })}
        />
        <Field
          label={dt('Hero CTA (secondary)')}
          value={f.heroCtaSecondary}
          onChange={(v) => setF({ ...f, heroCtaSecondary: v })}
        />
      </div>
      <div className="mt-3">
        <Field
          label={dt('Hero subtitle')}
          value={f.heroSubtitle}
          onChange={(v) => setF({ ...f, heroSubtitle: v })}
        />
      </div>

      <div className="mt-4 border-t border-border pt-3">
        <div className="mb-2 text-[11px] font-bold uppercase text-muted-foreground">
          {dt('Stats')}
        </div>
        {f.stats.map((s, idx) => (
          <div key={idx} className="mb-2 grid grid-cols-2 gap-2">
            <input
              value={s.value}
              onChange={(e) => {
                const v = e.target.value;
                setF((prev) => ({
                  ...prev,
                  stats: prev.stats.map((st, i) => (i === idx ? { ...st, value: v } : st)),
                }));
              }}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              placeholder={dt('12.4K')}
            />
            <input
              value={s.label}
              onChange={(e) => {
                const v = e.target.value;
                setF((prev) => ({
                  ...prev,
                  stats: prev.stats.map((st, i) => (i === idx ? { ...st, label: v } : st)),
                }));
              }}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              placeholder={dt('Verified freelancers')}
            />
          </div>
        ))}
        <button
          onClick={() => setF({ ...f, stats: [...f.stats, { value: '', label: '' }] })}
          className="rounded-full border border-border px-3 py-1 text-[11px] font-bold text-muted-foreground"
        >
          + Add stat
        </button>
      </div>

      <div className="mt-4 border-t border-border pt-3">
        <div className="mb-2 text-[11px] font-bold uppercase text-muted-foreground">
          How it works
        </div>
        {f.howItWorks.map((s, idx) => (
          <div key={idx} className="mb-2 grid gap-1">
            <input
              value={s.title}
              onChange={(e) => {
                const v = e.target.value;
                setF((prev) => ({
                  ...prev,
                  howItWorks: prev.howItWorks.map((st, i) =>
                    i === idx ? { ...st, title: v } : st,
                  ),
                }));
              }}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              placeholder={dt('Step title')}
            />
            <input
              value={s.description}
              onChange={(e) => {
                const v = e.target.value;
                setF((prev) => ({
                  ...prev,
                  howItWorks: prev.howItWorks.map((st, i) =>
                    i === idx ? { ...st, description: v } : st,
                  ),
                }));
              }}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              placeholder={dt('Step description')}
            />
          </div>
        ))}
        <button
          onClick={() =>
            setF({ ...f, howItWorks: [...f.howItWorks, { title: '', description: '' }] })
          }
          className="rounded-full border border-border px-3 py-1 text-[11px] font-bold text-muted-foreground"
        >
          + Add step
        </button>
      </div>

      <div className="mt-4 border-t border-border pt-3">
        <div className="mb-2 text-[11px] font-bold uppercase text-muted-foreground">
          {dt('CTA')}
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <Field
            label={dt('CTA title')}
            value={f.cta.title}
            onChange={(v) => setF({ ...f, cta: { ...f.cta, title: v } })}
          />
          <Field
            label={dt('CTA subtitle')}
            value={f.cta.subtitle}
            onChange={(v) => setF({ ...f, cta: { ...f.cta, subtitle: v } })}
          />
          <Field
            label={dt('CTA primary')}
            value={f.cta.primary}
            onChange={(v) => setF({ ...f, cta: { ...f.cta, primary: v } })}
          />
          <Field
            label={dt('CTA secondary')}
            value={f.cta.secondary}
            onChange={(v) => setF({ ...f, cta: { ...f.cta, secondary: v } })}
          />
        </div>
      </div>

      <div className="mt-4 border-t border-border pt-3">
        <div className="mb-2 text-[11px] font-bold uppercase text-muted-foreground">
          Pricing cards
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {(['client', 'freelancer'] as const).map((k) => {
            const card = k === 'client' ? f.pricingClient : f.pricingFreelancer;
            const set = (patch: Partial<typeof card>) =>
              setF(
                k === 'client'
                  ? { ...f, pricingClient: { ...card, ...patch } }
                  : { ...f, pricingFreelancer: { ...card, ...patch } },
              );
            return (
              <div key={k} className="rounded-xl border border-border bg-background p-3">
                <div className="mb-2 text-xs font-bold capitalize">{k}</div>
                <div className="space-y-2">
                  <Field
                    label={dt('Heading')}
                    value={card.heading}
                    onChange={(v) => set({ heading: v })}
                  />
                  <Field
                    label={dt('Price')}
                    value={card.price}
                    onChange={(v) => set({ price: v })}
                  />
                  <Field
                    label={dt('Description')}
                    value={card.description}
                    onChange={(v) => set({ description: v })}
                  />
                  <Field label={dt('CTA')} value={card.cta} onChange={(v) => set({ cta: v })} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function ContentTab() {
  const token = useAuthStore((s) => s.accessToken);
  const { data, isLoading } = useQuery<{
    items: ContentPage[];
    site: SiteConfig;
    home: HomeConfig;
  }>({
    queryKey: ['admin/content'],
    queryFn: () => apiFetch('/admin/ops/content', { token }),
  });

  return (
    <div className="space-y-4">
      <SectionHead
        title={dt('Site content')}
        subtitle={dt('Editable pages, FAQ & contact info — served to the public, cached in Redis')}
      />
      {isLoading ? (
        <Spinner label={dt('Loading content…')} />
      ) : !data?.items?.length ? (
        <Empty message="No content pages" />
      ) : (
        <div className="grid gap-3">
          {data.home && <HomeConfigCard home={data.home} token={token} />}
          {data.site && <SiteConfigCard site={data.site} token={token} />}
          {data.items.map((p) => (
            <EditingCard key={p.slug} page={p} token={token} />
          ))}
        </div>
      )}
    </div>
  );
}
