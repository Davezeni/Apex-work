import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    gig: { findUnique: vi.fn(), update: vi.fn() },
    job: { findUnique: vi.fn(), update: vi.fn() },
    review: { findUnique: vi.fn(), update: vi.fn(), findMany: vi.fn() },
  },
}));

vi.mock('../../lib/prisma.js', () => ({ prisma: prismaMock }));

import { moderateGig, moderateJob, moderateReview } from './moderation.service.js';
import { NotFoundError } from '../../lib/errors.js';

describe('moderation.service', () => {
  beforeEach(() => vi.clearAllMocks());

  it('flags a gig and clears the reason when un-flagged', async () => {
    prismaMock.gig.findUnique.mockResolvedValue({ id: 'g1', status: 'ACTIVE', isFlagged: true, flaggedReason: 'spam' });
    prismaMock.gig.update.mockResolvedValue({ id: 'g1', title: 'logo', status: 'ACTIVE', isFeatured: false, isFlagged: false, flaggedReason: null, pinnedAt: null, featuredUntil: null });
    const res = await moderateGig('g1', { isFlagged: false });
    expect(prismaMock.gig.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isFlagged: false, flaggedReason: null }),
      }),
    );
    expect(res.isFlagged).toBe(false);
  });

  it('throws NotFoundError for an unknown gig', async () => {
    prismaMock.gig.findUnique.mockResolvedValue(null);
    await expect(moderateGig('nope', { status: 'PAUSED' })).rejects.toBeInstanceOf(NotFoundError);
  });

  it('pins/unpins a job and toggles open state with closedAt', async () => {
    prismaMock.job.findUnique.mockResolvedValue({ id: 'j1', isOpen: true, pinnedAt: null });
    prismaMock.job.update.mockImplementation(({ data }) => Promise.resolve({ id: 'j1', isOpen: data.isOpen, pinnedAt: data.pinnedAt }));
    const res = await moderateJob('j1', { isOpen: false, pinned: true });
    expect(prismaMock.job.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ isOpen: false, pinnedAt: expect.any(Date) }) }),
    );
    expect(res.isOpen).toBe(false);
    expect(res.pinnedAt).toBeTruthy();
  });

  it('hides a review with the acting admin and reason, then restores it', async () => {
    prismaMock.review.findUnique.mockResolvedValue({ id: 'r1' });
    prismaMock.review.update
      .mockResolvedValueOnce({ id: 'r1', hiddenAt: new Date(), hiddenById: 'admin-1', hiddenReason: 'abuse' })
      .mockResolvedValueOnce({ id: 'r1', hiddenAt: null, hiddenById: null, hiddenReason: null });
    const hidden = await moderateReview('r1', 'HIDE', 'admin-1', 'abuse');
    expect(hidden.hiddenById).toBe('admin-1');
    const restored = await moderateReview('r1', 'RESTORE', 'admin-1');
    expect(restored.hiddenById).toBeNull();
    expect(restored.hiddenAt).toBeNull();
  });
});
