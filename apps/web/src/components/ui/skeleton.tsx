import { cn } from '@/lib/utils';

/**
 * Shimmering placeholder. Uses a pure-CSS gradient sweep so we don't pull
 * in extra deps. Respects prefers-reduced-motion by falling back to a
 * static muted block via Tailwind's motion-safe variant.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'relative overflow-hidden rounded-lg bg-muted',
        'motion-safe:after:absolute motion-safe:after:inset-0 motion-safe:after:-translate-x-full',
        'motion-safe:after:animate-[shimmer_1.6s_ease-in-out_infinite]',
        'motion-safe:after:bg-gradient-to-r motion-safe:after:from-transparent motion-safe:after:via-white/10 motion-safe:after:to-transparent',
        className,
      )}
    />
  );
}
