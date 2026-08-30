'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/auth-store';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import { SectionHead, Badge, Spinner, Empty, inputCls } from './admin-ui';

type Setting = { key: string; description: string; value: unknown; updatedAt: string | null; updatedByName?: string; exists: boolean };

export function SettingsTab() {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<any>({
    queryKey: ['admin/settings'],
    queryFn: () => apiFetch('/admin/ops/settings', { token }),
  });
  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const save = useMutation({
    mutationFn: (item: Setting) => apiFetch('/admin/ops/settings', { method: 'POST', token, body: { key: item.key, value: draft[item.key] } }),
    onSuccess: () => { toast.success('Setting saved'); qc.invalidateQueries({ queryKey: ['admin/settings'] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  const items: Setting[] = data?.items ?? [];
  // Seed the draft with current values once loaded.
  if (!Object.keys(draft).length && items.length) {
    for (const it of items) draft[it.key] = it.value;
  }

  return (
    <div className="space-y-4">
      <SectionHead title="Platform settings" subtitle="Fees, limits and feature flags (runtime tunable)" />
      {isLoading ? <Spinner label="Loading settings…" /> : items.length === 0 ? <Empty message="No settings" /> : (
        <div className="grid gap-3 md:grid-cols-2">
          {items.map((it) => {
            const value = draft[it.key];
            const isBool = typeof it.value === 'boolean';
            const isNum = typeof it.value === 'number' || (value != null && typeof value === 'number');
            return (
              <div key={it.key} className="space-y-2 rounded-2xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div><div className="text-sm font-extrabold">{it.key}</div><div className="text-[11px] text-muted-foreground">{it.description}</div></div>
                  {it.updatedByName && <Badge tone="info">{it.updatedByName}</Badge>}
                </div>
                {isBool ? (
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={!!value} disabled={save.isPending}
                      onChange={(e) => setDraft({ ...draft, [it.key]: e.target.checked })} />
                    {value ? 'Enabled' : 'Disabled'}
                  </label>
                ) : isNum ? (
                  <input type="number" value={value as number ?? ''} className={inputCls}
                    onChange={(e) => setDraft({ ...draft, [it.key]: Number(e.target.value) })} />
                ) : (
                  <input type="text" value={String(value ?? '')} className={inputCls}
                    onChange={(e) => setDraft({ ...draft, [it.key]: e.target.value })} />
                )}
                <Button size="sm" variant="brand" disabled={save.isPending} onClick={() => save.mutate(it)}>Save</Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
