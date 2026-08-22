'use client';

import { Drawer } from 'vaul';
import { cn } from '@/lib/utils';

/**
 * Thin, opinionated wrapper around `vaul` so every bottom-sheet in the app
 * looks the same. Full-height on mobile via `snapPoints={[1]}` behaviour is
 * NOT what we want here — most of our sheets fit in ~60% viewport, so we
 * let vaul auto-size and cap height in CSS.
 */
interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export function Sheet({ open, onOpenChange, title, description, children, className }: Props) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <Drawer.Content
          className={cn(
            'fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-3xl border border-b-0 border-border bg-card focus:outline-none',
            className,
          )}
        >
          <div className="mx-auto mt-3 h-1.5 w-10 shrink-0 rounded-full bg-muted" aria-hidden />
          {(title || description) && (
            <div className="px-6 pt-2">
              {title && <Drawer.Title className="text-xl font-extrabold">{title}</Drawer.Title>}
              {description && (
                <Drawer.Description className="mt-1 text-sm text-muted-foreground">
                  {description}
                </Drawer.Description>
              )}
            </div>
          )}
          <div className="min-h-0 flex-1 overflow-y-auto p-6 pb-8">{children}</div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
