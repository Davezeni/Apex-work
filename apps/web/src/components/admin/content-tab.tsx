'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/auth-store';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import { SectionHead, Spinner, Empty } from './admin-ui';
import { Markdown } from '@/components/markdown';

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
      toast.success('Brand & contact saved');
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
          <div className="text-sm font-extrabold">Brand & contact</div>
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

export function ContentTab() {
  const token = useAuthStore((s) => s.accessToken);
  const { data, isLoading } = useQuery<{ items: ContentPage[]; site: SiteConfig }>({
    queryKey: ['admin/content'],
    queryFn: () => apiFetch('/admin/ops/content', { token }),
  });

  return (
    <div className="space-y-4">
      <SectionHead
        title="Site content"
        subtitle="Editable pages, FAQ & contact info — served to the public, cached in Redis"
      />
      {isLoading ? (
        <Spinner label="Loading content…" />
      ) : !data?.items?.length ? (
        <Empty message="No content pages" />
      ) : (
        <div className="grid gap-3">
          {data.site && <SiteConfigCard site={data.site} token={token} />}
          {data.items.map((p) => (
            <EditingCard key={p.slug} page={p} token={token} />
          ))}
        </div>
      )}
    </div>
  );
}
