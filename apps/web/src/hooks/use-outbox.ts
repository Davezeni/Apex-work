'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import { list, remove, bump, type OutboxItem } from '@/lib/outbox';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Background outbox flusher. Runs once per mount and again whenever the
 * browser fires `online`. Each item retries with an exponential backoff
 * cap so we never hammer a still-broken server.
 *
 * Attempts beyond 8 are silently dropped — at that point the message is
 * probably invalid (deleted conversation, blocked user, etc) and the
 * chat UI's error toast has already told the user.
 */
export function useOutboxSync() {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  const [pending, setPending] = useState(0);

  useEffect(() => {
    if (!token || typeof window === 'undefined') return;

    let cancelled = false;

    async function flush() {
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;
      const items = await list().catch(() => [] as OutboxItem[]);
      setPending(items.length);
      if (items.length === 0) return;

      for (const item of items) {
        if (cancelled) return;
        if (item.attempts >= 8) {
          await remove(item.clientId);
          continue;
        }
        try {
          await apiFetch(`/conversations/${item.conversationId}/messages`, {
            method: 'POST',
            token,
            body: {
              body: item.body,
              attachmentUrl: item.attachmentUrl,
              attachmentType: item.attachmentType,
              attachmentMeta: item.attachmentMeta,
              replyToId: item.replyToId,
              clientId: item.clientId,
            },
          });
          await remove(item.clientId);
          qc.invalidateQueries({ queryKey: ['messages', item.conversationId] });
        } catch {
          await bump(item.clientId);
          // Give the network a break before the next item.
          await new Promise((r) => setTimeout(r, 500 + item.attempts * 500));
        }
      }
      const after = await list().catch(() => [] as OutboxItem[]);
      setPending(after.length);
      if (items.length > 0 && after.length === 0) {
        toast.success(`Sent ${items.length} queued message${items.length === 1 ? '' : 's'} ✅`);
      }
    }

    flush();
    const onOnline = () => flush();
    window.addEventListener('online', onOnline);
    // Also poll every 30s while the tab is open — cheap safety net.
    const timer = setInterval(flush, 30_000);
    return () => {
      cancelled = true;
      window.removeEventListener('online', onOnline);
      clearInterval(timer);
    };
  }, [token, qc]);

  return { pending };
}
