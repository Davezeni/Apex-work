'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { Star, Loader2, Camera, X as XClose } from 'lucide-react';
import { toast } from 'sonner';
import { Sheet } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useCreateReview } from '@/hooks/use-reviews';
import { useUpload } from '@/hooks/use-upload';
import { cn } from '@/lib/utils';
import { useI18n } from '@/i18n';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  sellerName: string;
  onDone?: () => void;
}

/**
 * 1–5 star rating + optional comment. Rating is required, comment optional
 * (matches Fiverr/Upwork norms). Star hover state is emulated with local
 * state — no external tooltip lib needed.
 */
export function RateReviewSheet({ open, onOpenChange, orderId, sellerName, onDone }: Props) {
  const { t } = useI18n();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const upload = useUpload();
  const create = useCreateReview();

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (photos.length >= 4) return toast.error('Max 4 photos');
    if (file.size > 10 * 1024 * 1024) return toast.error('Max 10 MB per photo');
    if (!/^image\//.test(file.type)) return toast.error('Photos only');
    try {
      const r = await upload.mutateAsync({ file, bucket: 'chat-attachments' });
      setPhotos((p) => [...p, r.publicUrl]);
    } catch (err) {
      toast.error((err as { message?: string }).message ?? 'Upload failed');
    }
  };

  const submit = async () => {
    if (rating < 1) {
      toast.error(t('review.pickRating'));
      return;
    }
    try {
      await create.mutateAsync({
        orderId,
        rating,
        comment: comment.trim() || undefined,
        photoUrls: photos,
      });
      toast.success(t('review.thanks'));
      onDone?.();
      onOpenChange(false);
      // Reset for next time
      setRating(0);
      setComment('');
    } catch (err) {
      const e = err as { message?: string };
      toast.error(e.message ?? t('review.failed'));
    }
  };

  const shownRating = hover || rating;

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={t('review.title')}
      description={t('review.subtitle', { name: sellerName })}
    >
      <div className="flex justify-center gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setRating(n)}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            aria-label={t('review.starLabel', { n })}
            className="p-1 transition-transform active:scale-90"
          >
            <Star
              className={cn(
                'h-10 w-10 transition-colors',
                shownRating >= n
                  ? 'fill-amber-400 text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]'
                  : 'text-muted-foreground/40',
              )}
            />
          </button>
        ))}
      </div>

      {rating > 0 && (
        <p className="mt-2 text-center text-sm font-semibold text-primary">
          {t(`review.label${rating}`)}
        </p>
      )}

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={4}
        maxLength={2000}
        placeholder={t('review.commentPlaceholder')}
        className="mt-6 min-h-[100px] w-full resize-none rounded-2xl border border-border bg-background p-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/20"
      />
      <p className="mt-1 text-right text-[11px] text-muted-foreground">
        {comment.length}/2000
      </p>

      {/* Optional photos */}
      <div className="mt-3">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Photos <span className="normal-case font-normal">(optional · max 4)</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {photos.map((url, i) => (
            <div key={url} className="relative h-16 w-16 overflow-hidden rounded-lg border border-border bg-black/20">
              <Image src={url} alt="" fill unoptimized sizes="64px" className="object-cover" />
              <button
                onClick={() => setPhotos(photos.filter((_, j) => j !== i))}
                aria-label="Remove"
                className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-black/80 text-white"
              ><XClose className="h-3 w-3" /></button>
            </div>
          ))}
          {photos.length < 4 && (
            <button
              onClick={() => fileRef.current?.click()}
              disabled={upload.isPending}
              className="grid h-16 w-16 place-items-center rounded-lg border-2 border-dashed border-border bg-card text-muted-foreground active:scale-95"
              aria-label="Add photo"
            >
              {upload.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-5 w-5" />}
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
        </div>
      </div>

      <Button
        variant="brand"
        size="lg"
        className="mt-6 w-full"
        onClick={submit}
        disabled={rating < 1 || create.isPending}
      >
        {create.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          t('review.submit')
        )}
      </Button>
    </Sheet>
  );
}
