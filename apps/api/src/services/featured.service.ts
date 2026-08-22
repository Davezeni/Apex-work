/**
 * Featured (boosted) gigs. Freelancer pays an ETB fee from their wallet
 * balance to pin their gig at the top of its category feed for N days.
 * If the wallet doesn't have enough, we refuse and suggest a withdrawal
 * from an incoming order to top up.
 *
 * A cron worker (`expireFeatured`) flips `isFeatured=false` when
 * `featuredUntil <= now()`.
 */
import { prisma } from '../lib/prisma.js';
import { BOOST_TIERS } from '@apex-work/shared';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../lib/errors.js';
import { notify } from './notifications.service.js';

export async function boostGig(userId: string, gigSlug: string, days: number) {
  const tier = BOOST_TIERS.find((t) => t.days === days);
  if (!tier) throw new BadRequestError('Invalid boost tier');

  const gig = await prisma.gig.findUnique({
    where: { slug: gigSlug },
    select: { id: true, ownerId: true, title: true, featuredUntil: true },
  });
  if (!gig) throw new NotFoundError('Gig');
  if (gig.ownerId !== userId) throw new ForbiddenError('Only the owner can boost');

  return prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.findUnique({ where: { userId } });
    if (!wallet || wallet.balanceEtb < tier.priceEtb) {
      throw new ConflictError(`Need ${tier.priceEtb} ETB in your wallet — currently ${wallet?.balanceEtb ?? 0}`);
    }
    await tx.wallet.update({
      where: { userId },
      data: { balanceEtb: { decrement: tier.priceEtb } },
    });
    await tx.transaction.create({
      data: {
        userId, type: 'PLATFORM_FEE',
        amountEtb: -tier.priceEtb,
        description: `Boost: ${tier.label} for "${gig.title}"`,
        relatedId: gig.id,
      },
    });
    // Extend from existing `featuredUntil` (if in the future) or from now.
    const base = gig.featuredUntil && gig.featuredUntil > new Date() ? gig.featuredUntil : new Date();
    const featuredUntil = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
    const updated = await tx.gig.update({
      where: { id: gig.id },
      data: { isFeatured: true, featuredUntil },
    });
    return updated;
  }).then(async (updated) => {
    await notify({
      userId,
      type: 'SYSTEM',
      title: 'Boost activated 🚀',
      body: `${gig.title} is featured for ${tier.label}`,
      payload: { gigId: gig.id, featuredUntil: updated.featuredUntil?.toISOString() },
    });
    return updated;
  });
}

/** Cron: expire stale boosts. */
export async function expireFeatured(): Promise<{ expired: number }> {
  const now = new Date();
  const result = await prisma.gig.updateMany({
    where: { isFeatured: true, featuredUntil: { lte: now } },
    data: { isFeatured: false, featuredUntil: null },
  });
  return { expired: result.count };
}
