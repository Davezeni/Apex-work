/**
 * Orders + payments business logic.
 *
 * Lifecycle:
 *   PENDING  → client just placed order, awaiting Chapa payment
 *   ACTIVE   → payment confirmed via webhook or verify(), work in progress
 *   IN_REVIEW → seller delivered, client is reviewing
 *   DELIVERED → client approved delivery (funds ready to release)
 *   COMPLETED → funds released to seller wallet
 *   CANCELLED / DISPUTED
 *
 * Money flow (escrow, atomic within a transaction):
 *   1) Client pays via Chapa → PENDING order + Payment(SUCCESS)
 *      → order becomes ACTIVE, seller.wallet.pendingEtb += sellerNet
 *   2) Client accepts delivery → COMPLETED
 *      → seller.wallet.pendingEtb -= sellerNet
 *        seller.wallet.balanceEtb += sellerNet
 *        seller.completedOrders++
 *      → freelancer notified they can withdraw
 */
import type { OrderStatus, PackageTier, Prisma, User } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { computeOrderSplit } from '@apex-work/shared';
import { assertOrderTransition, type OrderAction, type OrderState } from '@apex-work/shared';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../lib/errors.js';
import { notify } from './notifications.service.js';

/**
 * Guard that an order may take `action` from `current.status`, translating the
 * state-machine error into our typed ConflictError. This keeps every mutation
 * aligned with the single transition map (see shared/domain/orderState.ts).
 */
function transitionGuard(current: OrderStatus, action: OrderAction, orderId?: string): OrderState {
  try {
    return assertOrderTransition(current, action, { orderId });
  } catch (err) {
    throw new ConflictError((err as Error).message);
  }
}
import { chapa, ChapaService } from './chapa.service.js';
import { env } from '../config/env.js';

const APP_URL = () => env.WEB_URL;

interface Actor {
  id: string;
  email: string | null;
  phone: string | null;
  isPhoneVerified: boolean;
  fullName: string;
}

/**
 * Create a PENDING order for the given gig + tier + client, and return a
 * Chapa checkout URL if payment is configured. If Chapa isn't configured
 * (dev/local), we skip straight to `ACTIVE` so testing still works — but
 * that path is guarded by NODE_ENV !== 'production'.
 */
export async function createOrderAndInitiatePayment(
  clientId: string,
  gigId: string,
  packageTier: PackageTier,
  requirements: string | undefined,
  actor: Actor,
) {
  const gig = await prisma.gig.findUnique({
    where: { id: gigId },
    include: { packages: true, owner: true },
  });
  if (!gig || gig.status !== 'ACTIVE') throw new NotFoundError('Gig');
  if (!actor.phone || !actor.isPhoneVerified) {
    throw new ConflictError('Verify your phone number before placing an order');
  }
  if (gig.ownerId === clientId) {
    throw new BadRequestError('You cannot order your own gig');
  }

  const pkg = gig.packages.find((p) => p.tier === packageTier);
  if (!pkg) throw new BadRequestError('That package is not available for this gig');

  const { feeEtb, sellerNetEtb } = computeOrderSplit(pkg.priceEtb);

  const order = await prisma.order.create({
    data: {
      clientId,
      sellerId: gig.ownerId,
      gigId: gig.id,
      packageTier,
      title: `${gig.title} — ${pkg.title}`,
      amountEtb: pkg.priceEtb,
      platformFeeEtb: feeEtb,
      sellerNetEtb,
      deliveryDays: pkg.deliveryDays,
      requirements: requirements ?? null,
      deadline: new Date(Date.now() + pkg.deliveryDays * 24 * 60 * 60 * 1000),
      status: 'PENDING',
    },
  });

  // Initialize Chapa
  if (!chapa.isConfigured()) {
    // Never create an unpaid order in production. The development shortcut
    // exists only for local testing and must not leave a stuck PENDING row.
    if (env.NODE_ENV === 'production') {
      await prisma.order.delete({ where: { id: order.id } }).catch(() => undefined);
      throw new ConflictError('Payment gateway is not configured. Please try again later.');
    }
    return { order, checkoutUrl: null, devSkipped: true };
  }

  const init = await chapa.initialize({
    amountEtb: pkg.priceEtb,
    txRef: `apex-${order.id}`,
    callbackUrl: `${env.API_URL}/v1/payments/webhook`,
    returnUrl: `${APP_URL()}/orders/${order.id}?paid=1`,
    customer: {
      email: ChapaService.safeEmail(actor.email, actor.id),
      firstName: actor.fullName.split(' ')[0] ?? 'Customer',
      lastName: actor.fullName.split(' ').slice(1).join(' ') || 'Apex',
      phone: actor.phone,
    },
    title: 'Apex-Work',
    description: `Order for ${gig.title.slice(0, 40)}`,
  });

  if (!init.ok || !init.checkoutUrl) {
    // Roll back: the order shouldn't exist if we couldn't initiate payment.
    await prisma.order.delete({ where: { id: order.id } }).catch(() => undefined);
    throw new BadRequestError(
      typeof init.error === 'string'
        ? `Payment initialization failed: ${init.error}`
        : 'Payment initialization failed',
    );
  }

  // Record the pending payment attempt
  await prisma.payment.create({
    data: {
      orderId: order.id,
      amountEtb: pkg.priceEtb,
      provider: 'chapa',
      providerRef: `apex-${order.id}`,
      status: 'PENDING',
    },
  });

  return { order, checkoutUrl: init.checkoutUrl, devSkipped: false };
}

/**
 * Called by both the webhook handler AND the return-URL page (double-safety).
 * Idempotent: safe to invoke multiple times for the same txRef.
 */
export async function confirmPaymentByTxRef(txRef: string) {
  // Strip our prefix; the tx_ref format is `apex-{orderId}`.
  const orderId = txRef.replace(/^apex-/, '');
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { payments: true, seller: true, gig: { select: { title: true } } },
  });
  if (!order) throw new NotFoundError('Order');

  // If already active/further, nothing to do.
  if (order.status !== 'PENDING') {
    return { order, updated: false };
  }

  const verify = await chapa.verify(txRef);
  if (!verify.ok) throw new BadRequestError(`Payment verification failed: ${verify.error}`);
  if (verify.status !== 'success') {
    // Mark payment failed if it definitively failed.
    if (verify.status === 'failed') {
      await prisma.payment.updateMany({
        where: { orderId: order.id, providerRef: txRef },
        data: { status: 'FAILED', rawPayload: verify.raw as Prisma.InputJsonValue },
      });
    }
    return { order, updated: false };
  }

  // Amount tampering guard — reject if the amount doesn't match.
  if (verify.amount !== undefined && Math.round(verify.amount) !== order.amountEtb) {
    throw new BadRequestError('Payment amount mismatch');
  }

  const updatedOrder = await prisma.$transaction(async (tx) => {
    const p = await tx.payment.updateMany({
      where: { orderId: order.id, providerRef: txRef, status: 'PENDING' },
      data: {
        status: 'SUCCESS',
        method: verify.method,
        rawPayload: verify.raw as Prisma.InputJsonValue,
      },
    });
    // Race protection: only advance if we actually flipped a pending payment.
    if (p.count === 0) return order;

    // Ensure the seller has a wallet.
    await tx.wallet.upsert({
      where: { userId: order.sellerId },
      create: { userId: order.sellerId, pendingEtb: order.sellerNetEtb },
      update: { pendingEtb: { increment: order.sellerNetEtb } },
    });

    // Ledger entries.
    await tx.transaction.create({
      data: {
        userId: order.clientId,
        type: 'ORDER_PAYMENT',
        amountEtb: -order.amountEtb,
        description: `Payment for ${order.title}`,
        relatedId: order.id,
      },
    });
    await tx.transaction.create({
      data: {
        userId: order.sellerId,
        type: 'ORDER_PAYMENT',
        amountEtb: order.sellerNetEtb,
        description: `Escrow held for ${order.title}`,
        relatedId: order.id,
      },
    });
    await tx.transaction.create({
      data: {
        userId: order.sellerId,
        type: 'PLATFORM_FEE',
        amountEtb: -order.platformFeeEtb,
        description: `Platform fee on ${order.title}`,
        relatedId: order.id,
      },
    });

    return tx.order.update({
      where: { id: order.id },
      data: { status: 'ACTIVE' },
    });
  });

  // Fire notifications post-commit (never inside the transaction — they use I/O).
  await notify({
    userId: order.sellerId,
    type: 'ORDER_UPDATE',
    title: 'New order! 🎉',
    body: `${order.title} — get started to keep your rating high.`,
    payload: { orderId: order.id },
  });
  await notify({
    userId: order.clientId,
    type: 'PAYMENT',
    title: 'Payment confirmed',
    body: `Your payment for ${order.title} was successful.`,
    payload: { orderId: order.id },
  });

  return { order: updatedOrder, updated: true };
}

/** Client marks the delivery as accepted. Releases funds to seller balance. */
export async function acceptDelivery(orderId: string, clientId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new NotFoundError('Order');
  if (order.clientId !== clientId) throw new ForbiddenError();
  const next = transitionGuard(order.status, 'ACCEPT_DELIVERY', order.id);

  const updated = await prisma.$transaction(async (tx) => {
    await tx.wallet.update({
      where: { userId: order.sellerId },
      data: {
        pendingEtb: { decrement: order.sellerNetEtb },
        balanceEtb: { increment: order.sellerNetEtb },
        lifetimeEarnedEtb: { increment: order.sellerNetEtb },
      },
    });
    await tx.user.update({
      where: { id: order.sellerId },
      data: { completedOrders: { increment: 1 } },
    });
    await tx.transaction.create({
      data: {
        userId: order.sellerId,
        type: 'ORDER_PAYOUT',
        amountEtb: order.sellerNetEtb,
        description: `Released to balance: ${order.title}`,
        relatedId: order.id,
      },
    });
    return tx.order.update({
      where: { id: order.id },
      data: { status: next, completedAt: new Date() },
    });
  });

  await notify({
    userId: order.sellerId,
    type: 'PAYMENT',
    title: 'Funds released 💰',
    body: `${order.title} was accepted. Your balance has been updated.`,
    payload: { orderId: order.id },
  });

  return updated;
}

/** Seller marks the order as delivered → moves to IN_REVIEW. */
export async function markDelivered(
  orderId: string,
  sellerId: string,
  deliverables: { notes?: string; files?: string[] },
) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new NotFoundError('Order');
  if (order.sellerId !== sellerId) throw new ForbiddenError();
  const next = transitionGuard(order.status, 'MARK_DELIVERED', order.id);

  const updated = await prisma.order.update({
    where: { id: order.id },
    data: {
      status: next,
      deliveredAt: new Date(),
      deliverables: {
        notes: deliverables.notes ?? '',
        files: deliverables.files ?? [],
      } as Prisma.InputJsonValue,
    },
  });

  await notify({
    userId: order.clientId,
    type: 'ORDER_UPDATE',
    title: 'Delivery ready 📦',
    body: `${order.title} — please review and accept.`,
    payload: { orderId: order.id },
  });

  return updated;
}

/** Client requests revision → back to ACTIVE. */
export async function requestRevision(orderId: string, clientId: string, notes: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new NotFoundError('Order');
  if (order.clientId !== clientId) throw new ForbiddenError();
  const next = transitionGuard(order.status, 'REQUEST_REVISION', order.id);
  const updated = await prisma.order.update({
    where: { id: order.id },
    data: { status: next },
  });
  await notify({
    userId: order.sellerId,
    type: 'ORDER_UPDATE',
    title: 'Revision requested',
    body: notes.slice(0, 160),
    payload: { orderId: order.id },
  });
  return updated;
}

/** Either party can cancel while PENDING/ACTIVE (before delivery). */
export async function cancelOrder(orderId: string, userId: string, reason?: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new NotFoundError('Order');
  if (order.clientId !== userId && order.sellerId !== userId) throw new ForbiddenError();
  // The transition map only permits CANCEL from PENDING/ACTIVE, so an
  // IN_REVIEW/DELIVERED/COMPLETED/CANCELLED order is rejected uniformly.
  const next = transitionGuard(order.status, 'CANCEL', order.id);

  const updated = await prisma.$transaction(async (tx) => {
    // Refund pending funds to seller wallet ledger (if payment was captured).
    if (order.status === 'ACTIVE') {
      await tx.wallet.update({
        where: { userId: order.sellerId },
        data: { pendingEtb: { decrement: order.sellerNetEtb } },
      });
      await tx.transaction.create({
        data: {
          userId: order.clientId,
          type: 'ORDER_REFUND',
          amountEtb: order.amountEtb,
          description: `Refund for cancelled order: ${order.title}`,
          relatedId: order.id,
        },
      });
    }
    return tx.order.update({
      where: { id: order.id },
      data: { status: next, cancelledAt: new Date() },
    });
  });

  const other = order.clientId === userId ? order.sellerId : order.clientId;
  await notify({
    userId: other,
    type: 'ORDER_UPDATE',
    title: 'Order cancelled',
    body: reason?.slice(0, 160) ?? `${order.title} was cancelled.`,
    payload: { orderId: order.id },
  });

  return updated;
}

export async function listMyOrders(userId: string, role: 'client' | 'seller') {
  const where: Prisma.OrderWhereInput =
    role === 'client' ? { clientId: userId } : { sellerId: userId };
  return prisma.order.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: {
      gig: { select: { slug: true, coverImageUrl: true } },
      client: { select: { id: true, username: true, fullName: true, avatarUrl: true } },
      seller: { select: { id: true, username: true, fullName: true, avatarUrl: true } },
    },
  });
}

export async function getOrder(orderId: string, userId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      gig: { select: { slug: true, title: true, coverImageUrl: true } },
      client: { select: { id: true, username: true, fullName: true, avatarUrl: true } },
      seller: { select: { id: true, username: true, fullName: true, avatarUrl: true } },
      payments: true,
    },
  });
  if (!order) throw new NotFoundError('Order');
  if (order.clientId !== userId && order.sellerId !== userId) {
    throw new ForbiddenError();
  }
  return order;
}

/**
 * Escrow auto-release cron. Orders in DELIVERED state for 7+ days without
 * client action are auto-completed and funds move to the seller wallet.
 * Also fires a reminder to the client 5 days in to nudge action before
 * the auto-release triggers.
 */
export async function autoReleaseEscrow(): Promise<{ released: number; reminded: number }> {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;

  // 1. Remind clients between day 5 and day 7 (one reminder per order —
  //    check for absence of a 'ESCROW_REMINDED' transaction as a cheap marker).
  const reminderCandidates = await prisma.order.findMany({
    where: {
      status: 'DELIVERED',
      deliveredAt: { lte: new Date(now - 5 * day), gt: new Date(now - 7 * day) },
    },
    select: { id: true, clientId: true, title: true },
  });
  let reminded = 0;
  for (const o of reminderCandidates) {
    const already = await prisma.transaction.findFirst({
      where: { relatedId: o.id, description: { startsWith: 'Escrow reminder' } },
      select: { id: true },
    });
    if (already) continue;
    await notify({
      userId: o.clientId,
      type: 'ORDER_UPDATE',
      title: 'Review your delivery',
      body: `"${o.title}" auto-releases in 2 days if you don't accept or dispute.`,
      payload: { orderId: o.id, autoReleaseIn: '2 days' },
    });
    // Zero-amount marker transaction so we don't double-remind.
    await prisma.transaction.create({
      data: {
        userId: o.clientId, type: 'ORDER_PAYMENT', amountEtb: 0,
        description: `Escrow reminder for ${o.title}`, relatedId: o.id,
      },
    });
    reminded++;
  }

  // 2. Auto-release when past 7 days.
  const released = await prisma.order.findMany({
    where: { status: 'DELIVERED', deliveredAt: { lte: new Date(now - 7 * day) } },
    select: { id: true, clientId: true, sellerId: true, title: true, amountEtb: true, sellerNetEtb: true, platformFeeEtb: true, deliveredAt: true },
  });
  let releasedCount = 0;
  for (const o of released) {
    try {
      await prisma.$transaction(async (tx) => {
        await tx.wallet.upsert({
          where: { userId: o.sellerId },
          create: { userId: o.sellerId, balanceEtb: o.sellerNetEtb, lifetimeEarnedEtb: o.sellerNetEtb },
          update: {
            pendingEtb: { decrement: o.sellerNetEtb },
            balanceEtb: { increment: o.sellerNetEtb },
            lifetimeEarnedEtb: { increment: o.sellerNetEtb },
          },
        });
        await tx.user.update({
          where: { id: o.sellerId },
          data: { completedOrders: { increment: 1 } },
        });
        await tx.transaction.create({
          data: {
            userId: o.sellerId, type: 'ORDER_PAYOUT', amountEtb: o.sellerNetEtb,
            description: `Auto-released: ${o.title}`, relatedId: o.id,
          },
        });
        await tx.order.update({
          where: { id: o.id },
          data: { status: 'COMPLETED', completedAt: new Date() },
        });
      });
      await notify({
        userId: o.sellerId, type: 'PAYMENT',
        title: 'Auto-released 💰',
        body: `${o.title} — funds moved to your balance`,
        payload: { orderId: o.id, autoRelease: true },
      });
      releasedCount++;
    } catch {
      // Individual failure shouldn't stop the batch.
    }
  }
  return { released: releasedCount, reminded };
}
