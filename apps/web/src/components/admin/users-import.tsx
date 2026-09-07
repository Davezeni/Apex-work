'use client';

import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload, X } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';

const CSV_ORDER = ['fullName', 'username', 'phone', 'email', 'role', 'password']; // eslint-disable-line

/**
 * Bulk-create users by pasting or uploading a CSV. Header row (optional) maps
 * columns: fullName, username, phone, email, role, password. On submit it posts
 * the parsed rows to `/admin/ops/users/import` and shows a summary.
 */
export function UsersImportButton() {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [csv, setCsv] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const mutate = useMutation({
    mutationFn: (text: string) => {
      const rows = parseCsv(text).map((cols) => {
        // Column order with a header we detect by looking for known labels.
        const isHeader = cols.some((c) => /fullname|name|email|phone|role/i.test(c));
        const headers = isHeader ? cols : CSV_ORDER;
        const obj: Record<string, string> = {};
        cols.forEach((v, i) => (obj[headers[i]!] = v.trim()));
        return obj;
      });
      return apiFetch<{ created: number; skipped: number; errors: { line: number; message: string }[] }>(
        '/admin/ops/users/import',
        { method: 'POST', token, body: { rows } },
      );
    },
    onSuccess: (r) => {
      toast.success(`Imported ${r.created} users (${r.skipped} skipped)`);
      setOpen(false);
      setCsv('');
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
    onError: (e) => toast.error((e as Error).message ?? 'Import failed'),
  });

  const readFile = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCsv(String(reader.result ?? ''));
    reader.readAsText(file);
  };

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Upload className="h-3.5 w-3.5" /> Import
      </Button>
      {open && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/50 p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold">Bulk import users</h3>
              <button onClick={() => setOpen(false)} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-full hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              CSV columns: <code className="font-mono">fullName, username, phone, email, role, password</code>. role is CLIENT/FREELANCER/ADMIN (optional).
            </p>
            <div className="mt-3 flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>Choose file…</Button>
              <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => readFile(e.target.files?.[0] ?? null)} />
              <span className="text-[11px] text-muted-foreground">or paste below</span>
            </div>
            <textarea
              value={csv}
              onChange={(e) => setCsv(e.target.value)}
              rows={8}
              placeholder={'fullName,username,phone,email,role,password\nDawit Tamiru,dawittamiru,+251911000000,dawit@example.com,FREELANCER,secret1'}
              className="mt-2 w-full resize-y rounded-xl border border-border bg-background p-3 font-mono text-xs outline-none focus:border-primary"
            />
            <div className="mt-3 flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button size="sm" variant="brand" onClick={() => mutate.mutate(csv)} disabled={mutate.isPending || !csv.trim()}>
                {mutate.isPending ? 'Importing…' : `Create users${csv.split('\n').filter(Boolean).length ? ` (${csv.split('\n').filter(Boolean).length} rows)` : ''}`}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** Minimal CSV parser (comma-separated, quote-aware). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cur += '"'; i++; } else inQuotes = false;
      } else cur += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') { row.push(cur); cur = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cur); cur = '';
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
    } else cur += ch;
  }
  if (cur.trim() !== '' || row.length) { row.push(cur); if (row.some((c) => c.trim() !== '')) rows.push(row); }
  return rows;
}
