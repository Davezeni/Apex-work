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
 * `isVerified` flag: phone + ID verified) so trusted talent pops everywhere.
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

  return (
    <Avatar
      className={cn(
        'bg-gradient-to-br text-white',
        verified && 'ring-2 ring-cyan-400 ring-offset-1 ring-offset-background',
        className,
      )}
    >
      {avatarUrl ? (
        <AvatarImage src={avatarUrl} alt={name} onError={onError} />
      ) : null}
      <AvatarFallback className="from-violet-600 to-emerald-500">
        {initials}
      </AvatarFallback>
      {verified && (
        <span
          className="absolute -bottom-0.5 -right-0.5 grid place-items-center rounded-full bg-background p-[2px]"
          title="Verified"
        >
          <BadgeCheck className="h-3.5 w-3.5 fill-cyan-400 text-white" />
        </span>
      )}
    </Avatar>
  );
}
