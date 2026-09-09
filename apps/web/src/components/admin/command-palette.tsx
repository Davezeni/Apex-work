'use client';

import { dt } from '@/i18n/auto';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, CornerDownLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
export interface PaletteAction {
  id: string;
  label: string;
  hint?: string; // secondary line (e.g. section)
  icon?: React.ReactNode;
  onSelect: () => void;
}

/**
 * ⌘K / Ctrl+K command palette for the admin console. Filters a list of
 * actions (currently the visible nav tabs) as you type, supports arrow-key
 * navigation, Enter to run, Esc to close. Mounted inside AdminShell.
 */
export function CommandPalette({
  open,
  onClose,
  actions,
  placeholder,
}: {
  open: boolean;
  onClose: () => void;
  actions: PaletteAction[];
  placeholder?: string;
}) {
  const [q, setQ] = useState('');
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setQ('');
      setIndex(0);
      return;
    }
    // Focus after the transition so the field is ready to type in.
    const t = setTimeout(() => inputRef.current?.focus(), 10);
    return () => clearTimeout(t);
  }, [open]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return actions;
    return actions.filter((a) => `${a.label} ${a.hint ?? ''}`.toLowerCase().includes(needle));
  }, [q, actions]);

  // Clamp the active index when results shrink.
  useEffect(() => {
    setIndex((i) => Math.min(i, Math.max(0, filtered.length - 1)));
  }, [filtered.length]);

  if (!open) return null;

  const run = (a: PaletteAction) => {
    a.onSelect();
    onClose();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[index]) run(filtered[index]!);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center px-4 pt-[12vh]"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div
        role="dialog"
        aria-label={dt('Command palette')}
        className="relative w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd className="rounded-md border border-border px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
            {dt('esc')}
          </kbd>
        </div>
        <div className="max-h-[50vh] overflow-y-auto p-2">
          {filtered.length === 0 && (
            <div className="px-3 py-6 text-center text-xs text-muted-foreground">
              No matches for “{q}”
            </div>
          )}
          {filtered.map((a, i) => (
            <button
              key={a.id}
              onMouseEnter={() => setIndex(i)}
              onClick={() => run(a)}
              className={cn(
                'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm',
                i === index ? 'bg-primary/15 text-primary' : 'text-foreground',
              )}
            >
              {a.icon && <span className="shrink-0 text-current">{a.icon}</span>}
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{a.label}</span>
                {a.hint && (
                  <span className="block truncate text-[10px] text-muted-foreground">{a.hint}</span>
                )}
              </span>
              {i === index && <CornerDownLeft className="h-4 w-4 shrink-0 text-primary/70" />}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 border-t border-border px-4 py-2 text-[10px] text-muted-foreground">
          <span>
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd> navigate
          </span>
          <span>
            <Kbd>↵</Kbd> open
          </span>
          <span>
            <Kbd>{dt('esc')}</Kbd> close
          </span>
        </div>
      </div>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return <span className="rounded border border-border px-1 py-0.5 font-semibold">{children}</span>;
}
