'use client';

import { Avatar, AvatarFallback, AvatarImage } from './avatar';
import { cn } from '@/lib/utils';

/**
 * A user avatar that renders the real profile photo when available and falls
 * back to a gradient + initials otherwise. Use anywhere a person's picture
 * should appear (chat bubbles, gig owners, reviews, comments, etc.).
 */
export function UserAvatar({
  name,
  avatarUrl,
  className,
  id,
  onError,
}: {
  name: string;
  avatarUrl?: string | null;
  className?: string;
  /** Optional seed for a deterministic gradient in the fallback. */
  id?: string;
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
    <Avatar className={cn('bg-gradient-to-br text-white', className)}>
      {avatarUrl ? (
        <AvatarImage src={avatarUrl} alt={name} onError={onError} />
      ) : null}
      <AvatarFallback className="from-violet-600 to-emerald-500">
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}
