'use client';

import { dt } from '@/i18n/auto';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Check, Crown, Loader2, Save, ToggleLeft, ToggleRight } from 'lucide-react';
import { toast } from 'sonner';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import { useMe } from '@/hooks/use-me';
type AdminTemplate = {
  id: string;
  name: string;
  description: string;
  tier: 'free' | 'pro';
  priceEtb: number;
  available: boolean;
  emoji: string;
  bestFor: string;
  updatedAt: string | null;
};

export default function AdminTemplatesPage() {
  const router = useRouter();
  const token = useAuthStore((state) => state.accessToken);
  const { data: me, isLoading: meLoading } = useMe();
  const queryClient = useQueryClient();
  const templates = useQuery<{ items: AdminTemplate[] }>({
    queryKey: ['admin', 'resume-templates'],
    queryFn: () => apiFetch('/admin/resume-templates', { token }),
    enabled: !!token && me?.role === 'ADMIN',
  });
  const update = useMutation({
    mutationFn: ({
      id,
      priceEtb,
      isAvailable,
    }: {
      id: string;
      priceEtb: number;
      isAvailable: boolean;
    }) =>
      apiFetch(`/admin/resume-templates/${id}`, {
        method: 'PATCH',
        token,
        body: { priceEtb, isAvailable },
      }),
    onSuccess: () => {
      toast.success(dt('Template settings saved'));
      queryClient.invalidateQueries({ queryKey: ['admin', 'resume-templates'] });
      queryClient.invalidateQueries({ queryKey: ['resume-templates'] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : 'Could not save template'),
  });

  useEffect(() => {
    if (!meLoading && (!me || me.role !== 'ADMIN')) router.replace('/admin');
  }, [me, meLoading, router]);
  if (meLoading || !me || me.role !== 'ADMIN')
    return (
      <div className="grid min-h-dvh place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );

  return (
    <div className="min-h-dvh bg-background pb-12">
      <header className="safe-top sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 px-3 py-3 backdrop-blur-xl">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label={dt('Back')}
          className="grid h-9 w-9 place-items-center rounded-full active:scale-90"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-extrabold">{dt('Resume template controls')}</h1>
          <p className="text-[10px] text-muted-foreground">
            Change availability and one-time ETB pricing without a code deploy.
          </p>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link href="/admin">{dt('Admin')}</Link>
        </Button>
      </header>
      <main className="mx-auto max-w-4xl px-3 py-6 sm:px-6">
        <div className="space-y-3">
          {templates.isLoading ? (
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
          ) : (
            templates.data?.items.map((template) => (
              <TemplateRow
                key={template.id}
                template={template}
                pending={update.isPending}
                onSave={(next) => update.mutate({ id: template.id, ...next })}
              />
            ))
          )}
        </div>
      </main>
    </div>
  );
}

function TemplateRow({
  template,
  pending,
  onSave,
}: {
  template: AdminTemplate;
  pending: boolean;
  onSave: (next: { priceEtb: number; isAvailable: boolean }) => void;
}) {
  const [price, setPrice] = useState(String(template.priceEtb));
  const [available, setAvailable] = useState(template.available);
  return (
    <article className="rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-start gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary">
          <span className="text-xl font-black">{template.emoji}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="font-extrabold">{template.name}</h2>
            {template.tier === 'pro' ? (
              <Crown className="h-4 w-4 text-amber-500" />
            ) : (
              <Check className="h-4 w-4 text-emerald-500" />
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {template.description} · Best for {template.bestFor}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAvailable((value) => !value)}
          className="inline-flex items-center gap-1 text-xs font-bold text-primary"
        >
          {available ? (
            <ToggleRight className="h-6 w-6" />
          ) : (
            <ToggleLeft className="h-6 w-6 text-muted-foreground" />
          )}
          {available ? 'Available' : 'Hidden'}
        </button>
      </div>
      <div className="mt-4 flex items-end gap-2">
        <label className="flex-1 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
          Price ETB
          <input
            type="number"
            min={0}
            max={100000}
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm font-semibold outline-none focus:border-primary"
          />
        </label>
        <Button
          type="button"
          variant="brand"
          size="sm"
          onClick={() => onSave({ priceEtb: Number(price), isAvailable: available })}
          disabled={pending}
        >
          <Save className="h-4 w-4" /> Save
        </Button>
      </div>
    </article>
  );
}
