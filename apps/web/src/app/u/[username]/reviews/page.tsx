'use client';

import { dt } from '@/i18n/auto';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { ArrowLeft, Star, Loader2, MessageSquareReply, Trash2 } from 'lucide-react';
import { usePublicUser } from '@/hooks/use-public-user';
import { useMe } from '@/hooks/use-me';
import { UserAvatar } from '@/components/ui/user-avatar';
import {
  useUserReviews,
  useUpsertReviewReply,
  useDeleteReviewReply,
  type Review,
} from '@/hooks/use-reviews';
import { useI18n } from '@/i18n';
import { cn, timeAgo } from '@/lib/utils';
import { safeBack } from '@/lib/safe-back';
export default function AllReviewsPage() {
  const { username } = useParams<{ username: string }>();
  const router = useRouter();
  const { t } = useI18n();
  const { data: user } = usePublicUser(username);
  const { data: me, isSignedIn } = useMe();
  const { data, isLoading } = useUserReviews(user?.id);
  const items = data?.items ?? [];

  const dist: number[] = [0, 0, 0, 0, 0];
  items.forEach((r) => {
    if (r.rating >= 1 && r.rating <= 5) {
      const idx = 5 - r.rating;
      dist[idx] = (dist[idx] ?? 0) + 1;
    }
  });
  const total = items.length;

  return (
    <div className="min-h-dvh bg-background pb-24">
      <header className="safe-top sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 px-3 py-3 backdrop-blur-xl">
        <button
          onClick={() => safeBack(router)}
          aria-label={t('common.back')}
          className="grid h-9 w-9 place-items-center rounded-full active:scale-90"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-extrabold tracking-tight">{t('review.reviewsHeading')}</h1>
      </header>

      {user && (
        <section className="mx-3 mt-4 rounded-2xl border border-border bg-card p-4">
          <div className="flex items-start gap-3">
            <div className="text-center">
              <div className="text-4xl font-extrabold text-primary">
                {user.rating > 0 ? user.rating.toFixed(1) : '—'}
              </div>
              <div className="mt-1 flex justify-center gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={cn(
                      'h-3 w-3',
                      i < Math.round(user.rating)
                        ? 'fill-amber-400 text-amber-400'
                        : 'text-muted-foreground/30',
                    )}
                  />
                ))}
              </div>
              <div className="mt-1 text-[10px] text-muted-foreground">
                {user.ratingCount} reviews
              </div>
            </div>
            <div className="flex-1 space-y-1.5">
              {dist.map((n, i) => {
                const stars = 5 - i;
                const pct = total ? (n / total) * 100 : 0;
                return (
                  <div key={stars} className="flex items-center gap-2 text-[11px]">
                    <span className="w-2 text-muted-foreground">{stars}</span>
                    <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-6 text-right text-muted-foreground">{n}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      <div className="mx-3 mt-4 space-y-2">
        {isLoading && (
          <div className="grid h-40 place-items-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
        {!isLoading && items.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center">
            <Star className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-sm font-semibold">{dt('No reviews yet')}</p>
          </div>
        )}
        {items.map((r) => (
          <ReviewCardWithReply
            key={r.id}
            review={r}
            isOwner={isSignedIn && me?.id === r.subjectId}
          />
        ))}
      </div>
    </div>
  );
}

/** A single review, with the seller's rebuttal rendered below (and, when the
 *  signed-in user is the seller, the controls to post / edit / remove it). */
function ReviewCardWithReply({ review: r, isOwner }: { review: Review; isOwner: boolean }) {
  const { t } = useI18n();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(r.sellerReply ?? '');
  const upsert = useUpsertReviewReply();
  const remove = useDeleteReviewReply();

  const save = async () => {
    if (!text.trim()) return;
    await upsert.mutateAsync({ reviewId: r.id, comment: text.trim() });
    setEditing(false);
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <Link href={`/u/${r.author.username}`} aria-label={r.author.fullName}>
          <UserAvatar
            name={r.author.fullName}
            avatarUrl={r.author.avatarUrl}
            id={r.author.id}
            verified={r.author.isVerified}
            className="h-8 w-8 text-[10px] font-bold"
          />
        </Link>
        <div className="min-w-0 flex-1">
          <Link
            href={`/u/${r.author.username}`}
            className="flex items-center gap-1 truncate text-xs font-semibold hover:text-primary"
          >
            <span className="truncate">{r.author.fullName}</span>
          </Link>
          <div className="text-[10px] text-muted-foreground">{timeAgo(r.createdAt)}</div>
        </div>
        <div className="flex gap-0.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              className={cn(
                'h-3 w-3',
                i < r.rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30',
              )}
            />
          ))}
        </div>
      </div>
      {r.comment && <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed">{r.comment}</p>}
      {r.photoUrls && r.photoUrls.length > 0 && (
        <div className="mt-2 flex gap-1.5">
          {r.photoUrls.map((url) => (
            <a
              key={url}
              href={url}
              target="_blank"
              rel="noreferrer"
              className="relative h-16 w-16 overflow-hidden rounded-lg bg-black/20"
            >
              <Image
                src={url}
                alt={dt('')}
                fill
                unoptimized
                sizes="64px"
                className="object-cover"
              />
            </a>
          ))}
        </div>
      )}

      {/* Seller rebuttal */}
      {r.sellerReply && !editing && (
        <div className="mt-3 rounded-xl border-l-2 border-primary bg-muted/40 p-3">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-primary">
            <MessageSquareReply className="h-3 w-3" />
            {t('review.responseFromSeller')}
          </div>
          <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed">{r.sellerReply}</p>
          {r.sellerReplyEditedAt && (
            <div className="mt-1 text-[10px] text-muted-foreground">
              {t('review.replyEdited')} · {timeAgo(r.sellerReplyEditedAt)}
            </div>
          )}
        </div>
      )}

      {/* Owner controls */}
      {isOwner && !editing && (
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs font-bold text-primary active:scale-95"
          >
            <MessageSquareReply className="h-3.5 w-3.5" />
            {r.sellerReply ? t('review.editReply') : t('review.reply')}
          </button>
          {r.sellerReply && (
            <button
              onClick={async () => {
                await remove.mutateAsync(r.id);
                setText('');
              }}
              className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs font-bold text-destructive active:scale-95"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {t('review.removeReply')}
            </button>
          )}
        </div>
      )}

      {/* Owner reply editor */}
      {isOwner && editing && (
        <div className="mt-3 space-y-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={2000}
            rows={3}
            autoFocus
            placeholder={t('review.writeReplyPlaceholder')}
            className="w-full resize-none rounded-xl border border-border bg-background p-3 text-xs outline-none focus:border-primary"
          />
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">{text.length}/2000</span>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setEditing(false);
                  setText(r.sellerReply ?? '');
                }}
                className="rounded-xl border border-border px-3 py-1.5 text-xs font-bold text-muted-foreground active:scale-95"
              >
                {t('review.cancelReply')}
              </button>
              <button
                onClick={save}
                disabled={!text.trim() || upsert.isPending}
                className="rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-white active:scale-95 disabled:opacity-50"
              >
                {upsert.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  t('review.saveReply')
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
