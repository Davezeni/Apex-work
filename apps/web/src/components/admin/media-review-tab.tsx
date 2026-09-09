'use client';

import { dt } from '@/i18n/auto';
import { useState } from 'react';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { Eye, ShieldOff, Trash2, Flag, RefreshCw } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { apiFetch } from '@/lib/api';
import { cn, timeAgo } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { SectionHead, Badge, Spinner, Empty } from './admin-ui';
interface MediaItem {
  kind: 'avatar' | 'gigCover';
  refId: string;
  url: string;
  ownerName: string;
  ownerUsername: string;
  ownerRole: string;
  title?: string;
  createdAt: string;
}

interface MediaQueue {
  total: number;
  items: MediaItem[];
  nextCursor: string | null;
}

/**
 * Admin photo / media review queue. Surfaces recent user avatars and gig covers
 * so staff can spot unsafe imagery and act on it (remove avatar, flag gig).
 */
export function MediaReviewTab() {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<MediaQueue>({
    queryKey: ['admin', 'media', 'page1'],
    queryFn: () => apiFetch<MediaQueue>('/admin/ops/media?limit=24', { token }),
    enabled: !!token,
  });

  const removeAvatar = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/admin/ops/media/avatar/${id}/remove`, { method: 'POST', token }),
    onSuccess: () => {
      toast.success(dt('Avatar removed'));
      qc.invalidateQueries({ queryKey: ['admin', 'media'] });
    },
    onError: (e) => toast.error((e as Error).message ?? 'Failed'),
  });
  const flagGig = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/admin/ops/media/gig/${id}/flag`, { method: 'POST', token }),
    onSuccess: () => {
      toast.success(dt('Gig flagged for review'));
      qc.invalidateQueries({ queryKey: ['admin', 'media'] });
    },
    onError: (e) => toast.error((e as Error).message ?? 'Failed'),
  });

  const [preview, setPreview] = useState<string | null>(null);
  const [extra, setExtra] = useState<MediaItem[]>([]);
  const [extraCursor, setExtraCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadMore = async () => {
    const cursor = data?.nextCursor ?? extraCursor;
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const res = await apiFetch<MediaQueue>(
        `/admin/ops/media?limit=24&cursor=${encodeURIComponent(cursor)}`,
        { token },
      );
      setExtra((prev) => [...prev, ...res.items]);
      setExtraCursor(res.nextCursor);
    } catch (e) {
      toast.error((e as Error).message ?? 'Failed to load more');
    } finally {
      setLoadingMore(false);
    }
  };

  if (isLoading) return <Spinner label={dt('Loading media queue…')} />;
  const items: MediaItem[] = [...(data?.items ?? []), ...extra];
  const hasMore = Boolean(data?.nextCursor ?? extraCursor);

  return (
    <div className="mx-3 mt-4">
      <SectionHead
        title={dt('Media review')}
        subtitle={dt('Recent avatars & gig covers — remove or flag anything unsafe')}
        actions={
          <button
            onClick={() => qc.invalidateQueries({ queryKey: ['admin', 'media'] })}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-[11px] font-bold text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
        }
      />
      {items.length === 0 ? (
        <Empty message="No media to review right now." />
      ) : (
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((m) => {
            const isAvatar = m.kind === 'avatar';
            return (
              <div
                key={`${m.kind}-${m.refId}`}
                className="overflow-hidden rounded-2xl border border-border bg-card"
              >
                <button
                  onClick={() => setPreview(m.url)}
                  className="block w-full bg-black/10"
                  aria-label={dt('Preview image')}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={m.url}
                    alt={m.title ?? m.ownerName}
                    className="h-36 w-full object-cover"
                  />
                </button>
                <div className="p-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[10px] font-bold',
                        isAvatar
                          ? 'bg-violet-500/10 text-violet-500'
                          : 'bg-sky-500/10 text-sky-500',
                      )}
                    >
                      {isAvatar ? 'Avatar' : 'Gig cover'}
                    </span>
                    <Badge tone={isAvatar ? 'info' : 'warn'}>{m.ownerRole}</Badge>
                    <span className="ml-auto text-[10px] text-muted-foreground">
                      {timeAgo(m.createdAt)}
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-1.5 text-sm font-semibold">
                    <Link href={`/u/${m.ownerUsername}`} className="truncate hover:text-primary">
                      {m.ownerName}
                    </Link>
                  </div>
                  {m.title && (
                    <p className="truncate text-[11px] text-muted-foreground">{m.title}</p>
                  )}
                  <div className="mt-2 flex gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => setPreview(m.url)}
                    >
                      <Eye className="h-3 w-3" /> View
                    </Button>
                    {isAvatar ? (
                      <Button
                        size="sm"
                        variant="destructive"
                        className="flex-1"
                        onClick={() => removeAvatar.mutate(m.refId)}
                        disabled={removeAvatar.isPending}
                      >
                        <Trash2 className="h-3 w-3" /> Remove
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="destructive"
                        className="flex-1"
                        onClick={() => flagGig.mutate(m.refId)}
                        disabled={flagGig.isPending}
                      >
                        <Flag className="h-3 w-3" /> Flag
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {hasMore && (
        <div className="mt-4 flex justify-center">
          <button
            onClick={() => void loadMore()}
            disabled={loadingMore}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-xs font-bold text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loadingMore && 'animate-spin')} />
            {loadingMore ? 'Loading…' : `Load more (${items.length} shown)`}
          </button>
        </div>
      )}

      {preview && (
        <div
          className="fixed inset-0 z-[120] grid place-items-center bg-black/80 p-4"
          onClick={() => setPreview(null)}
          role="dialog"
          aria-label={dt('Image preview')}
        >
          <div className="relative max-h-[85vh] max-w-2xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview}
              alt={dt('Preview')}
              className="max-h-[85vh] w-full rounded-2xl object-contain"
            />
            <button
              onClick={() => setPreview(null)}
              aria-label={dt('Close preview')}
              className="absolute -right-3 -top-3 grid h-8 w-8 place-items-center rounded-full bg-background text-foreground shadow"
            >
              <ShieldOff className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
