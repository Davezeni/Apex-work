/**
 * Moderation flag-queue triage.
 *
 * `buildQueueSummary` is a pure, dependency-free fold over flag-queue items
 * (flagged gigs) that derives the queue stats and the worst-first ordering an
 * admin needs. Kept pure and unit-testable so the triage logic (and any bulk
 * resolve semantics) live in one auditable place.
 */

export type ModerationStatus = 'QUEUED' | 'IN_REVIEW' | 'RESOLVED' | 'DISMISSED';

export interface QueueItem {
  id: string;
  title: string;
  flaggedReason: string | null;
  status: ModerationStatus;
  assignee: string | null;
  createdAt: Date;
  updatedAt: Date;
  viewsCount: number;
  ordersCount: number;
}

export interface QueueSummary {
  queued: number;
  inReview: number;
  resolved: number;
  dismissed: number;
  total: number;
  /** items still needing action, oldest-flagged first. */
  open: QueueItem[];
}

const OPEN_STATUSES = new Set<ModerationStatus>(['QUEUED', 'IN_REVIEW']);

/** Derive queue counts and the open (actionable) items ordered oldest-first. */
export function buildQueueSummary(items: QueueItem[]): QueueSummary {
  const queued = items.filter((i) => i.status === 'QUEUED').length;
  const inReview = items.filter((i) => i.status === 'IN_REVIEW').length;
  const resolved = items.filter((i) => i.status === 'RESOLVED').length;
  const dismissed = items.filter((i) => i.status === 'DISMISSED').length;

  const open = items
    .filter((i) => OPEN_STATUSES.has(i.status))
    .sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime());

  return { queued, inReview, resolved, dismissed, total: items.length, open };
}

/** Terminal statuses we allow bulk-moving a group into. */
export type BulkTarget = Extract<ModerationStatus, 'RESOLVED' | 'DISMISSED'>;

/** Whether a set of items can be bulk-resolved in one go (all actionable). */
export function canBulkResolve(items: QueueItem[], target: BulkTarget): boolean {
  return items.length > 0 && items.every((i) => OPEN_STATUSES.has(i.status));
}
