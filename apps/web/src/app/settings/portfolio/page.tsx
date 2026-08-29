'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import Image from 'next/image';
import {
  ArrowLeft,
  ImagePlus,
  Pencil,
  Loader2,
  Trash2,
  X,
  Sparkles,
  FileText,
  Video,
  Share2,
  WandSparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMe } from '@/hooks/use-me';
import { useUpload } from '@/hooks/use-upload';
import {
  useAddPortfolioItem,
  useDeletePortfolioItem,
  useMyPortfolio,
  useUpdatePortfolioItem,
  type PortfolioItem,
} from '@/hooks/use-portfolio';
import { useI18n } from '@/i18n';
import { useAIPortfolioCaseStudy } from '@/hooks/use-ai';
import {
  PORTFOLIO_ACCEPT,
  contentTypeForFile,
  extensionOf,
  isImageType,
  isVideoType,
} from '@/lib/file-types';

export default function PortfolioPage() {
  const router = useRouter();
  const { data: me, isLoading } = useMe();
  const { data: portfolio, isLoading: pLoading } = useMyPortfolio();
  const upload = useUpload();
  const addItem = useAddPortfolioItem();
  const removeItem = useDeletePortfolioItem();
  const updateItem = useUpdatePortfolioItem();
  const caseStudy = useAIPortfolioCaseStudy();
  const { t } = useI18n();

  const fileRef = useRef<HTMLInputElement>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingImage, setPendingImage] = useState<{
    url: string;
    localPreview: string;
    contentType: string;
    isImage: boolean;
    name: string;
  } | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [role, setRole] = useState('');
  const [tools, setTools] = useState('');
  const [outcome, setOutcome] = useState('');
  const [externalUrl, setExternalUrl] = useState('');
  const [featured, setFeatured] = useState(false);
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
    const contentType = contentTypeForFile(file);
    const allowed =
      /^(image\/(jpeg|png|webp|gif)|video\/(mp4|webm|quicktime)|application\/(pdf|msword|vnd\.ms-(excel|powerpoint)|vnd\.openxmlformats-officedocument\.(wordprocessingml\.document|spreadsheetml\.sheet|presentationml\.presentation)|rtf)|text\/(plain|csv))$/.test(
        contentType,
      );
    if (!allowed) {
      toast.error(t('portfolio.invalidType'));
      return;
    }

    // Show local preview immediately so user isn't staring at nothing.
    const localPreview = URL.createObjectURL(file);
    setEditingId(null);
    setPendingImage({
      url: '',
      localPreview,
      contentType,
      isImage: isImageType(contentType),
      name: file.name,
    });
    setDialogOpen(true);
    setProgress(0);

    try {
      const result = await upload.mutateAsync({
        file,
        bucket: 'portfolio',
        onProgress: setProgress,
      });
      setPendingImage((current) =>
        current ? { ...current, url: result.publicUrl, contentType: result.contentType } : current,
      );
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
    const payload = {
      title: title.trim(),
      description: description.trim() || undefined,
      imageUrl: pendingImage.url,
      externalUrl: externalUrl.trim() || undefined,
      role: role.trim() || undefined,
      tools: tools
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 20),
      outcome: outcome.trim() || undefined,
      featured,
    };
    try {
      if (editingId) {
        await updateItem.mutateAsync({ id: editingId, ...payload });
        toast.success('Portfolio project updated');
      } else {
        await addItem.mutateAsync(payload);
        toast.success(t('portfolio.added'));
      }
      closeDialog();
    } catch (err) {
      const e = err as { message?: string };
      toast.error(e.message ?? t('portfolio.saveFailed'));
    }
  };

  const openEdit = (item: PortfolioItem) => {
    const image = isImageType('', item.imageUrl);
    setEditingId(item.id);
    setPendingImage({
      url: item.imageUrl,
      localPreview: item.imageUrl,
      contentType: image ? 'image/jpeg' : 'application/pdf',
      isImage: image,
      name: item.title,
    });
    setTitle(item.title);
    setDescription(item.description ?? '');
    setRole(item.role ?? '');
    setTools(item.tools.join(', '));
    setOutcome(item.outcome ?? '');
    setExternalUrl(item.externalUrl ?? '');
    setFeatured(item.featured);
    setDialogOpen(true);
  };

  const generateCaseStudy = () => {
    if (title.trim().length < 2 || description.trim().length < 10) {
      toast.error('Add a project title and a few facts first');
      return;
    }
    caseStudy.mutate(
      {
        title: title.trim(),
        role: role.trim() || undefined,
        tools: tools
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)
          .slice(0, 20),
        roughDescription: description.trim(),
        outcome: outcome.trim() || undefined,
      },
      {
        onSuccess: (result) => {
          setDescription(result.description);
          setOutcome(result.outcome);
          toast.success(
            result.source === 'ai'
              ? 'Case study polished with AI ✨'
              : 'Starter case study generated',
          );
        },
        onError: (error) => toast.error(error.message),
      },
    );
  };

  const closeDialog = () => {
    if (pendingImage?.localPreview?.startsWith('blob:'))
      URL.revokeObjectURL(pendingImage.localPreview);
    setEditingId(null);
    setPendingImage(null);
    setDialogOpen(false);
    setTitle('');
    setDescription('');
    setRole('');
    setTools('');
    setOutcome('');
    setExternalUrl('');
    setFeatured(false);
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
          <p className="text-[11px] text-muted-foreground">
            {items.length} / 24 projects · drag to curate your story
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href={`/u/${me.username}`}>
              <Share2 className="h-4 w-4" /> Share
            </Link>
          </Button>
        </div>
      </header>

      <section className="mx-3 mt-4 rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-xl">
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-primary">
              <Sparkles className="h-3 w-3" /> Portfolio Studio
            </span>
            <h2 className="mt-3 text-2xl font-black tracking-tight">
              Turn finished work into proof.
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Upload the work, explain the problem, and let AI turn your raw notes into a credible
              case study. Never fake metrics — show the craft.
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/resume/templates">
              <FileText className="h-4 w-4" /> Resume Studio
            </Link>
          </Button>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-background p-3">
            <div className="text-lg font-black text-primary">{items.length}</div>
            <div className="text-[11px] text-muted-foreground">Curated projects</div>
          </div>
          <div className="rounded-xl bg-background p-3">
            <div className="text-lg font-black text-emerald-500">
              {items.filter((item) => !!item.externalUrl).length}
            </div>
            <div className="text-[11px] text-muted-foreground">Live project links</div>
          </div>
          <div className="rounded-xl bg-background p-3">
            <div className="text-lg font-black text-amber-500">AI</div>
            <div className="text-[11px] text-muted-foreground">Case-study assistant</div>
          </div>
        </div>
      </section>

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

      <SortablePortfolio
        items={items}
        onRemove={(id) => {
          if (!window.confirm(t('portfolio.confirmDelete'))) return;
          removeItem.mutate(id, { onSuccess: () => toast.success(t('portfolio.removed')) });
        }}
        onEdit={openEdit}
      />

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
          accept={PORTFOLIO_ACCEPT}
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
              {pendingImage.isImage ? (
                <Image
                  src={pendingImage.url || pendingImage.localPreview}
                  alt="Preview"
                  fill
                  sizes="400px"
                  className="object-cover"
                  unoptimized
                />
              ) : isVideoType(pendingImage.contentType) ? (
                <video
                  src={pendingImage.url || pendingImage.localPreview}
                  controls
                  className="h-full w-full object-contain"
                  preload="metadata"
                />
              ) : (
                <a
                  href={pendingImage.url || pendingImage.localPreview}
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-primary"
                >
                  <FileText className="h-12 w-12" />
                  <span className="break-all text-sm font-semibold">{pendingImage.name}</span>
                  <span className="text-xs text-muted-foreground">Open file preview</span>
                </a>
              )}
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
              maxLength={1600}
              placeholder="What was the problem, what did you deliver, and how did you solve it?"
              className="mt-2 min-h-[70px] w-full resize-none rounded-xl border border-border bg-background p-3 text-sm outline-none focus:border-primary"
            />
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <input
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="Your role (e.g. Lead designer)"
                className="h-10 rounded-xl border border-border bg-background px-3 text-xs outline-none focus:border-primary"
              />
              <input
                value={tools}
                onChange={(e) => setTools(e.target.value)}
                placeholder="Tools / skills, comma separated"
                className="h-10 rounded-xl border border-border bg-background px-3 text-xs outline-none focus:border-primary"
              />
            </div>
            <input
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
              placeholder="Outcome or result (optional — do not invent numbers)"
              className="mt-2 h-10 w-full rounded-xl border border-border bg-background px-3 text-xs outline-none focus:border-primary"
            />
            <input
              value={externalUrl}
              onChange={(e) => setExternalUrl(e.target.value)}
              placeholder="Live project URL (optional)"
              className="mt-2 h-10 w-full rounded-xl border border-border bg-background px-3 text-xs outline-none focus:border-primary"
            />
            <label className="mt-2 flex items-center gap-2 text-xs font-semibold">
              <input
                type="checkbox"
                checked={featured}
                onChange={(e) => setFeatured(e.target.checked)}
              />
              Feature this project on my public profile
            </label>
            <Button
              type="button"
              variant="outline"
              className="mt-3 w-full"
              onClick={generateCaseStudy}
              disabled={caseStudy.isPending}
            >
              <WandSparkles className="h-4 w-4" />
              {caseStudy.isPending ? 'Writing case study…' : 'Improve case study with AI'}
            </Button>

            <Button
              variant="brand"
              size="lg"
              className="mt-4 w-full"
              onClick={savePortfolioItem}
              disabled={
                !pendingImage.url || upload.isPending || addItem.isPending || updateItem.isPending
              }
            >
              {addItem.isPending || updateItem.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : editingId ? (
                'Update project'
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

// -----------------------------------------------------------------------------
// SORTABLE GRID
// -----------------------------------------------------------------------------
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
  arrayMove,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { useReorderPortfolio } from '@/hooks/use-portfolio';
import { useEffect as useEffectRe, useState as useStateRe } from 'react';

function SortablePortfolio({
  items,
  onRemove,
  onEdit,
}: {
  items: PortfolioItem[];
  onRemove: (id: string) => void;
  onEdit: (item: PortfolioItem) => void;
}) {
  const reorder = useReorderPortfolio();
  const [ordered, setOrdered] = useStateRe<PortfolioItem[]>(items);

  // Keep local order in sync when the query refetches.
  useEffectRe(() => {
    setOrdered(items);
  }, [items]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = ordered.findIndex((i) => i.id === active.id);
    const newIndex = ordered.findIndex((i) => i.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(ordered, oldIndex, newIndex);
    setOrdered(next);
    reorder.mutate(next.map((i) => i.id));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={ordered.map((i) => i.id)} strategy={rectSortingStrategy}>
        <div className="mx-3 mt-4 grid grid-cols-2 gap-2 pb-24 sm:grid-cols-3">
          {ordered.map((it) => (
            <PortfolioTile key={it.id} it={it} onRemove={onRemove} onEdit={onEdit} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function PortfolioTile({
  it,
  onRemove,
  onEdit,
}: {
  it: PortfolioItem;
  onRemove: (id: string) => void;
  onEdit: (item: PortfolioItem) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: it.id,
  });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative overflow-hidden rounded-2xl border border-border bg-card ${isDragging ? 'z-20 opacity-70 shadow-xl' : ''}`}
    >
      <div className="relative aspect-square">
        {isImageType('', it.imageUrl) ? (
          <Image
            src={it.imageUrl}
            alt={it.title}
            fill
            sizes="(max-width: 640px) 50vw, 33vw"
            className="object-cover"
            unoptimized
          />
        ) : isVideoType('', it.imageUrl) ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 bg-black/80 text-white">
            <Video className="h-8 w-8" />
            <span className="text-[10px] font-semibold">Video</span>
          </div>
        ) : (
          <a
            href={it.imageUrl}
            target="_blank"
            rel="noreferrer"
            className="flex h-full flex-col items-center justify-center gap-2 bg-primary/5 p-3 text-center text-primary"
          >
            <FileText className="h-8 w-8" />
            <span className="text-[10px] font-bold">{extensionOf(it.imageUrl)} · Open</span>
          </a>
        )}
      </div>
      <div className="p-2">
        <div className="flex items-center gap-1">
          <div className="line-clamp-1 flex-1 text-xs font-semibold">{it.title}</div>
          {it.featured && (
            <span className="rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-bold text-amber-600">
              Featured
            </span>
          )}
        </div>
        {it.role && <div className="mt-0.5 text-[10px] font-semibold text-primary">{it.role}</div>}
        {it.description && (
          <p className="mt-0.5 line-clamp-2 text-[10px] text-muted-foreground">{it.description}</p>
        )}
        {it.outcome && (
          <p className="mt-1 line-clamp-1 text-[10px] text-emerald-600">Outcome: {it.outcome}</p>
        )}
        {it.tools.length > 0 && (
          <p className="mt-1 line-clamp-1 text-[9px] text-muted-foreground">
            {it.tools.join(' · ')}
          </p>
        )}
      </div>
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
        className="absolute left-2 top-2 grid h-7 w-7 cursor-grab place-items-center rounded-full bg-black/60 text-white backdrop-blur active:cursor-grabbing sm:opacity-0 sm:group-hover:opacity-100"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={() => onEdit(it)}
        aria-label="Edit project"
        className="absolute right-11 top-2 grid h-7 w-7 place-items-center rounded-full bg-black/60 text-white backdrop-blur sm:opacity-0 sm:group-hover:opacity-100"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={() => onRemove(it.id)}
        aria-label="Delete"
        className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-black/60 text-white backdrop-blur sm:opacity-0 sm:group-hover:opacity-100"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
