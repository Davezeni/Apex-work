'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { toast } from 'sonner';

/**
 * Downloads an admin CSV export (`GET /admin/ops/export/:kind`). Fetches with
 * the caller's Bearer token, then triggers a browser download from the blob —
 * so the token never appears in a URL or navigation.
 */
export function ExportButton({
  kind,
  params = {},
  label = 'Export CSV',
  className,
}: {
  kind: 'audit' | 'orders' | 'users';
  params?: Record<string, string | number | boolean | undefined>;
  label?: string;
  className?: string;
}) {
  const token = useAuthStore((s) => s.accessToken);
  const [busy, setBusy] = useState(false);

  const download = async () => {
    if (!token) return;
    setBusy(true);
    try {
      const qs = new URLSearchParams();
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== '') qs.set(k, String(v));
      }
      const url = `/admin/ops/export/${kind}${qs.toString() ? `?${qs}` : ''}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error(body?.error ?? `Export failed (${res.status})`);
        return;
      }
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = `${kind}-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
      toast.success('CSV downloaded');
    } catch (e) {
      toast.error((e as Error).message ?? 'Export failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={download}
      disabled={busy}
      className={`inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-[11px] font-bold text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50 ${className ?? ''}`}
    >
      <Download className="h-3.5 w-3.5" />
      {busy ? '…' : label}
    </button>
  );
}
