'use client';

import { BadgeCheck } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from './avatar';
import { cn } from '@/lib/utils';

/**
 * A user avatar that renders the real profile photo when available and falls
 * back to a gradient + initials otherwise. Use anywhere a person's picture
 * should appear (chat bubbles, gig owners, reviews, comments, etc.).
 *
 * Pass `verified` to draw a cyan ring + a small check badge (from the upstream
 * `isVerified` flag: phone + ID verified). The badge is rendered on an OUTER
 * wrapper (not the circular, overflow-hidden image), so it is never clipped.
 */
export function UserAvatar({
  name,
  avatarUrl,
  className,
  id,
  verified,
  onError,
}: {
  name: string;
  avatarUrl?: string | null;
  className?: string;
  /** Optional seed for a deterministic gradient in the fallback. */
  id?: string;
  verified?: boolean;
  onError?: () => void;
}) {
  const initials = (name || '?')
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const size = className?.match(/h-(\d+)/)?.[1] ?? '10';
  const badgeCls =
    size === '5' ? 'h-3.5 w-3.5'
    : size === '6' ? 'h-3 w-3'
    : size === '7' ? 'h-3.5 w-3.5'
    : size === '8' ? 'h-4 w-4'
    : size === '10' ? 'h-4 w-4'
    : size === '14' ? 'h-5 w-5'
    : size === '20' ? 'h-6 w-6'
    : 'h-4 w-4';

  return (
    <span className={cn('relative inline-block shrink-0', className)}>
      <Avatar
        className={cn(
          'h-full w-full bg-gradient-to-br text-white',
          verified && 'ring-2 ring-cyan-400 ring-offset-1 ring-offset-background',
        )}
      >
        {avatarUrl ? (
          <AvatarImage src={avatarUrl} alt={name} onError={onError} />
        ) : null}
        <AvatarFallback className="from-violet-600 to-emerald-500">
          {initials}
        </AvatarFallback>
      </Avatar>
      {verified && (
        <span
          className="absolute -bottom-[3px] -right-[3px] grid place-items-center rounded-full bg-background p-[2px]"
          title="Verified"
          aria-label={`${name} is verified`}
        >
          <BadgeCheck className={cn(badgeCls, 'fill-cyan-400 text-white')} />
        </span>
      )}
    </span>
  );
}
