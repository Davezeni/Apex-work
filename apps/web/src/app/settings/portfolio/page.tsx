'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import Image from 'next/image';
import {
  ArrowLeft,
  ImagePlus,
  Loader2,
  Trash2,
  X,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMe } from '@/hooks/use-me';
import { useUpload } from '@/hooks/use-upload';
import {
  useAddPortfolioItem,
  useDeletePortfolioItem,
  useMyPortfolio,
} from '@/hooks/use-portfolio';
import { useI18n } from '@/i18n';

export default function PortfolioPage() {
  const router = useRouter();
  const { data: me, isLoading } = useMe();
  const { data: portfolio, isLoading: pLoading } = useMyPortfolio();
  const upload = useUpload();
  const addItem = useAddPortfolioItem();
  const removeItem = useDeletePortfolioItem();
  const { t } = useI18n();

  const fileRef = useRef<HTMLInputElement>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingImage, setPendingImage] = useState<{ url: string; localPreview: string } | null>(
    null,
  );
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!isLoading && !me) router.replace('/login?next=/settings/portfolio');
    if (!isLoading && me && me.role !== 'FREELANCER') router.replace('/profile');
  }, [isLoading, me, router]);

  const onPickFile = () => fileRef.current?.click();

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file
    if (!file) return;

    // 25MB check mirrored on client for a friendly early message
    if (file.size > 25 * 1024 * 1024) {
      toast.error(t('portfolio.tooLarge'));
      return;
    }
    if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) {
      toast.error(t('portfolio.invalidType'));
      return;
    }

    // Show local preview immediately so user isn't staring at nothing
    const localPreview = URL.createObjectURL(file);
    setPendingImage({ url: '', localPreview });
    setDialogOpen(true);
    setProgress(0);

    try {
      const result = await upload.mutateAsync({
        file,
        bucket: 'portfolio',
        onProgress: setProgress,
      });
      setPendingImage({ url: result.publicUrl, localPreview });
    } catch (err) {
      const e = err as { message?: string };
      toast.error(e.message ?? t('portfolio.uploadFailed'));
      URL.revokeObjectURL(localPreview);
      setPendingImage(null);
      setDialogOpen(false);
    }
  };

  const savePortfolioItem = async () => {
    if (!pendingImage?.url) return;
    if (title.trim().length < 2) {
      toast.error(t('portfolio.needTitle'));
      return;
    }
    try {
      await addItem.mutateAsync({
        title: title.trim(),
        description: description.trim() || undefined,
        imageUrl: pendingImage.url,
      });
      toast.success(t('portfolio.added'));
      closeDialog();
    } catch (err) {
      const e = err as { message?: string };
      toast.error(e.message ?? t('portfolio.saveFailed'));
    }
  };

  const closeDialog = () => {
    if (pendingImage?.localPreview) URL.revokeObjectURL(pendingImage.localPreview);
    setPendingImage(null);
    setDialogOpen(false);
    setTitle('');
    setDescription('');
    setProgress(0);
  };

  if (isLoading || !me) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const items = portfolio?.items ?? [];

  return (
    <div className="min-h-dvh bg-background pb-24">
      <header className="safe-top sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 px-3 py-3 backdrop-blur-xl">
        <button
          onClick={() => router.back()}
          aria-label={t('common.back')}
          className="grid h-9 w-9 place-items-center rounded-full active:scale-90"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-extrabold tracking-tight">{t('portfolio.title')}</h1>
          <p className="text-[11px] text-muted-foreground">{items.length} / 24</p>
        </div>
      </header>

      {pLoading && (
        <div className="grid h-40 place-items-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {!pLoading && items.length === 0 && (
        <div className="mx-4 mt-8 rounded-2xl border border-dashed border-border p-8 text-center">
          <Sparkles className="mx-auto h-8 w-8 text-primary" />
          <p className="mt-3 text-sm font-semibold">{t('portfolio.emptyTitle')}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t('portfolio.emptyBody')}</p>
        </div>
      )}

      <div className="mx-3 mt-4 grid grid-cols-2 gap-2 pb-24 sm:grid-cols-3">
        {items.map((it) => (
          <div key={it.id} className="group relative overflow-hidden rounded-2xl border border-border bg-card">
            <div className="relative aspect-square">
              <Image
                src={it.imageUrl}
                alt={it.title}
                fill
                sizes="(max-width: 640px) 50vw, 33vw"
                className="object-cover"
                unoptimized // Supabase URLs aren't in our next.config images.remotePatterns list yet
              />
            </div>
            <div className="p-2">
              <div className="line-clamp-1 text-xs font-semibold">{it.title}</div>
              {it.description && (
                <p className="mt-0.5 line-clamp-2 text-[10px] text-muted-foreground">
                  {it.description}
                </p>
              )}
            </div>
            <button
              onClick={() => {
                if (!window.confirm(t('portfolio.confirmDelete'))) return;
                removeItem.mutate(it.id, {
                  onSuccess: () => toast.success(t('portfolio.removed')),
                });
              }}
              aria-label={t('common.delete')}
              className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-black/60 text-white opacity-0 backdrop-blur transition-opacity group-hover:opacity-100 sm:opacity-100"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Sticky add button */}
      <div className="safe-bottom fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 px-4 pb-4 pt-3 backdrop-blur-xl">
        <Button
          variant="brand"
          size="lg"
          className="w-full"
          onClick={onPickFile}
          disabled={items.length >= 24 || upload.isPending}
        >
          {upload.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('portfolio.uploading')} {progress}%
            </>
          ) : (
            <>
              <ImagePlus className="h-4 w-4" />
              {t('portfolio.addNew')}
            </>
          )}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={onFile}
          className="hidden"
        />
      </div>

      {/* Add-item dialog */}
      {dialogOpen && pendingImage && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
          onClick={closeDialog}
        >
          <div
            className="w-full max-w-md rounded-t-3xl border border-border bg-card p-5 sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-muted sm:hidden" />
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold">{t('portfolio.detailsTitle')}</h2>
              <button
                onClick={closeDialog}
                className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground"
                aria-label={t('common.cancel')}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="relative aspect-square overflow-hidden rounded-xl bg-muted">
              <Image
                src={pendingImage.url || pendingImage.localPreview}
                alt="Preview"
                fill
                sizes="400px"
                className="object-cover"
                unoptimized
              />
              {upload.isPending && (
                <div className="absolute inset-0 grid place-items-center bg-black/50 text-white">
                  <div className="text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                    <div className="mt-2 text-sm font-semibold">{progress}%</div>
                  </div>
                </div>
              )}
            </div>

            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('portfolio.titlePlaceholder')}
              maxLength={100}
              className="mt-3 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary"
            />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder={t('portfolio.descPlaceholder')}
              className="mt-2 min-h-[70px] w-full resize-none rounded-xl border border-border bg-background p-3 text-sm outline-none focus:border-primary"
            />

            <Button
              variant="brand"
              size="lg"
              className="mt-4 w-full"
              onClick={savePortfolioItem}
              disabled={!pendingImage.url || upload.isPending || addItem.isPending}
            >
              {addItem.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                t('portfolio.save')
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
