'use client';

import { dt } from '@/i18n/auto';
import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { searchStickers, STICKER_CATEGORIES } from './emoji-data';
export function StickerPicker({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (emoji: string) => void;
}) {
  const [cat, setCat] = useState(STICKER_CATEGORIES[0]!.id);
  const [q, setQ] = useState('');

  const shown = useMemo(() => {
    if (q.trim()) return searchStickers(q);
    return STICKER_CATEGORIES.find((c) => c.id === cat)?.items.map(([e]) => e) ?? [];
  }, [q, cat]);

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-30" onClick={onClose} />
      <div className="absolute bottom-14 left-0 z-40 max-h-80 w-72 overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center gap-2 border-b border-border p-2">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={dt('Search stickers…')}
            aria-label={dt('Search stickers')}
            className="h-8 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div className="flex max-h-48 flex-wrap gap-1 overflow-y-auto p-2">
          {shown.map((e) => (
            <button
              key={e}
              onClick={() => {
                onPick(e);
                onClose();
              }}
              className="grid h-10 w-10 place-items-center rounded-xl text-2xl hover:bg-muted active:scale-90"
              aria-label={`Sticker ${e}`}
            >
              {e}
            </button>
          ))}
          {shown.length === 0 && (
            <p className="w-full px-2 py-6 text-center text-xs text-muted-foreground">
              {dt('No stickers found.')}
            </p>
          )}
        </div>
        {!q.trim() && (
          <div className="flex gap-1 border-t border-border p-2">
            {STICKER_CATEGORIES.map((c) => (
              <button
                key={c.id}
                onClick={() => setCat(c.id)}
                title={c.label}
                className={cn(
                  'grid h-9 flex-1 place-items-center rounded-lg text-lg transition-colors',
                  cat === c.id ? 'bg-primary/15' : 'hover:bg-muted',
                )}
              >
                {c.emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
