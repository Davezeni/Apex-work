/**
 * Jobs (Upwork model). Clients post; freelancers bid; client picks a bid
 * which creates an Order (existing Chapa flow reused).
 */
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../lib/errors.js';
import { notify } from './notifications.service.js';
import { ChapaService, chapa } from './chapa.service.js';
import { env } from '../config/env.js';
import { getCategoryFeePercent } from './categories.service.js';

// ---------------- Jobs ----------------

export async function createJob(clientId: string, input: {
  title: string;
  categoryId: string;
  description: string;
  requiredSkills: string[];
  budgetMinEtb?: number;
  budgetMaxEtb?: number;
  isRemote?: boolean;
  attachments?: { url: string; name: string; contentType: string; sizeBytes: number }[];
}) {
  const client = await prisma.user.findUnique({
    where: { id: clientId },
    select: { id: true, role: true, phone: true, isPhoneVerified: true },
  });
  if (!client) throw new NotFoundError('User');
  if (client.role !== 'CLIENT' && client.role !== 'ADMIN') {
    throw new ForbiddenError('Only clients can post jobs');
  }
  if (!client.phone || !client.isPhoneVerified) {
    throw new ConflictError('Verify your phone number before posting a job');
  }
  return prisma.job.create({
    data: {
      clientId,
      title: input.title,
      categoryId: input.categoryId,
      description: input.description,
      requiredSkills: input.requiredSkills.map((s) => s.toLowerCase()),
      budgetMinEtb: input.budgetMinEtb ?? null,
      budgetMaxEtb: input.budgetMaxEtb ?? null,
      isRemote: input.isRemote ?? true,
      ...(input.attachments && input.attachments.length > 0
        ? { attachments: { createMany: { data: input.attachments } } }
        : {}),
    },
    include: { attachments: true },
  });
}

export async function listJobs(opts: {
  category?: string;
  q?: string;
  limit: number;
  cursor?: string;
  onlyOpen?: boolean;
}) {
  const where: Prisma.JobWhereInput = {
    ...(opts.onlyOpen !== false ? { isOpen: true } : {}),
    ...(opts.category ? { categoryId: opts.category } : {}),
    ...(opts.q
      ? {
          OR: [
            { title: { contains: opts.q, mode: 'insensitive' } },
            { description: { contains: opts.q, mode: 'insensitive' } },
            { requiredSkills: { has: opts.q.toLowerCase() } },
          ],
        }
      : {}),
  };
  const items = await prisma.job.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: opts.limit + 1,
    ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
    include: {
      client: { select: { id: true, username: true, fullName: true, avatarUrl: true } },
      _count: { select: { bids: true } },
    },
  });
  const hasMore = items.length > opts.limit;
  const trimmed = hasMore ? items.slice(0, opts.limit) : items;
  return {
    items: trimmed,
    nextCursor: hasMore ? (trimmed[trimmed.length - 1]?.id ?? null) : null,
    hasMore,
  };
}

export async function getJob(id: string, viewerId?: string) {
  const job = await prisma.job.findUnique({
    where: { id },
    include: {
      attachments: { orderBy: { createdAt: 'asc' } },
      client: { select: { id: true, username: true, fullName: true, avatarUrl: true, city: true } },
      bids: {
        where: { withdrawnAt: null },
        orderBy: { createdAt: 'desc' },
        include: {
          freelancer: {
            select: {
              id: true,
              username: true,
              fullName: true,
              avatarUrl: true,
              title: true,
              city: true,
              rating: true,
              ratingCount: true,
            },
          },
        },
      },
    },
  });
  if (!job) throw new NotFoundError('Job');
  // Only the client sees full bid details; others see just bid count/summary.
  if (job.clientId !== viewerId) {
    return {
      ...job,
      bids: [] as typeof job.bids,
      bidCount: job.bids.length,
    };
  }
  return { ...job, bidCount: job.bids.length };
}

export async function closeJob(jobId: string, userId: string) {
  const job = await prisma.job.findUnique({ where: { id: jobId }, select: { clientId: true } });
  if (!job) throw new NotFoundError('Job');
  if (job.clientId !== userId) throw new ForbiddenError();
  return prisma.job.update({
    where: { id: jobId },
    data: { isOpen: false, closedAt: new Date() },
  });
}

// ---------------- Bids ----------------

export async function createBid(
  freelancerId: string,
  jobId: string,
  input: { message: string; priceEtb: number; deliveryDays: number },
) {
  const [freelancer, job] = await Promise.all([
    prisma.user.findUnique({
      where: { id: freelancerId },
      select: { id: true, role: true, isOnboarded: true },
    }),
    prisma.job.findUnique({
      where: { id: jobId },
      select: { id: true, isOpen: true, clientId: true, title: true },
    }),
  ]);
  if (!freelancer) throw new NotFoundError('User');
  if (freelancer.role !== 'FREELANCER') throw new ForbiddenError('Only freelancers can bid');
  if (!freelancer.isOnboarded) throw new BadRequestError('Complete your profile before bidding');
  if (!job) throw new NotFoundError('Job');
  if (!job.isOpen) throw new ConflictError('This job is closed');
  if (job.clientId === freelancerId) throw new BadRequestError('You cannot bid on your own job');

  const bid = await prisma.bid.upsert({
    where: { jobId_freelancerId: { jobId, freelancerId } },
    create: {
      jobId,
      freelancerId,
      message: input.message,
      priceEtb: input.priceEtb,
      deliveryDays: input.deliveryDays,
    },
    update: {
      message: input.message,
      priceEtb: input.priceEtb,
      deliveryDays: input.deliveryDays,
      withdrawnAt: null,
    },
  });

  await notify({
    userId: job.clientId,
    type: 'NEW_BID',
    title: 'New proposal',
    body: `Someone bid ${input.priceEtb} ETB on "${job.title.slice(0, 80)}"`,
    payload: { jobId, bidId: bid.id },
  });

  return bid;
}

export async function withdrawBid(bidId: string, freelancerId: string) {
  const bid = await prisma.bid.findUnique({ where: { id: bidId } });
  if (!bid) throw new NotFoundError('Bid');
  if (bid.freelancerId !== freelancerId) throw new ForbiddenError();
  return prisma.bid.update({ where: { id: bid.id }, data: { withdrawnAt: new Date() } });
}

/**
 * Client accepts a bid → creates a PENDING Order + Chapa checkout, exactly
 * like the gig purchase flow. Reuses the same escrow ledger + notifications.
 */
export async function acceptBid(bidId: string, clientId: string) {
  const bid = await prisma.bid.findUnique({
    where: { id: bidId },
    include: { job: true, freelancer: true },
  });
  if (!bid) throw new NotFoundError('Bid');
  if (bid.job.clientId !== clientId) throw new ForbiddenError();
  if (!bid.job.isOpen) throw new ConflictError('This job is no longer open');
  if (bid.withdrawnAt) throw new ConflictError('That proposal was withdrawn');

  const client = await prisma.user.findUnique({
    where: { id: clientId },
    select: { id: true, email: true, phone: true, isPhoneVerified: true, fullName: true },
  });
  if (!client) throw new NotFoundError('User');
  if (!client.phone || !client.isPhoneVerified) {
    throw new ConflictError('Verify your phone number before accepting a proposal');
  }

  // Per-category fee override (falls back to global platform fee).
  const feePercent = await getCategoryFeePercent(bid.job.categoryId);
  const platformFee = Math.round((bid.priceEtb * feePercent) / 100);
  const sellerNet = bid.priceEtb - platformFee;

  const order = await prisma.$transaction(async (tx) => {
    // Atomically claim/close the job: only succeeds if the job is still open.
    // If a concurrent acceptance already closed it, this matches 0 rows and we
    // abort — so only one order is ever created for a job.
    const claimed = await tx.job.updateMany({
      where: { id: bid.jobId, isOpen: true },
      data: { isOpen: false, closedAt: new Date() },
    });
    if (claimed.count === 0) {
      throw new ConflictError('This job is no longer open');
    }
    return tx.order.create({
      data: {
        clientId,
        sellerId: bid.freelancerId,
        gigId: null, // job-based, no gig
        packageTier: null,
        title: bid.job.title,
        amountEtb: bid.priceEtb,
        platformFeeEtb: platformFee,
        sellerNetEtb: sellerNet,
        deliveryDays: bid.deliveryDays,
        requirements: bid.message,
        deadline: new Date(Date.now() + bid.deliveryDays * 24 * 60 * 60 * 1000),
        status: 'PENDING',
      },
    });
  });

  if (!chapa.isConfigured()) {
    // Do not close the job or leave an unpaid order behind in production.
    // Local development may still use the shortcut for workflow testing.
    if (env.NODE_ENV === 'production') {
      await prisma.$transaction(async (tx) => {
        await tx.order.delete({ where: { id: order.id } });
        await tx.job.update({
          where: { id: bid.jobId },
          data: { isOpen: true, closedAt: null },
        });
      });
      throw new ConflictError('Payment gateway is not configured. Please try again later.');
    }
    return { order, checkoutUrl: null as string | null, devSkipped: true };
  }

  const init = await chapa.initialize({
    amountEtb: bid.priceEtb,
    txRef: `apex-${order.id}`,
    callbackUrl: `${env.API_URL}/v1/payments/webhook`,
    returnUrl: `${env.WEB_URL}/orders/${order.id}?paid=1`,
    customer: {
      email: ChapaService.safeEmail(client.email, client.id),
      firstName: client.fullName.split(' ')[0] ?? 'Customer',
      lastName: client.fullName.split(' ').slice(1).join(' ') || 'Apex',
      phone: client.phone ?? undefined,
    },
    title: 'Apex-Work',
    description: `Job: ${bid.job.title.slice(0, 40)}`,
  });
  if (!init.ok || !init.checkoutUrl) {
    await prisma.order.delete({ where: { id: order.id } }).catch(() => undefined);
    throw new BadRequestError(init.error ?? 'Payment initialization failed');
  }
  await prisma.payment.create({
    data: {
      orderId: order.id,
      amountEtb: bid.priceEtb,
      provider: 'chapa',
      providerRef: `apex-${order.id}`,
      status: 'PENDING',
    },
  });
  return { order, checkoutUrl: init.checkoutUrl, devSkipped: false };
}
