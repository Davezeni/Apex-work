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
import type { OrderStatus, PackageTier, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { computeOrderSplit } from '@apex-work/shared';
import { getCategoryFeePercent } from './categories.service.js';
import { assertOrderTransition, type OrderAction, type OrderState } from '@apex-work/shared';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../lib/errors.js';
import { notify } from './notifications.service.js';
import { ledgerOnce } from './financialIdempotency.js';

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

  // Per-category fee override (falls back to global platform fee).
  const feePercent = await getCategoryFeePercent(gig.categoryId);
  const { feeEtb, sellerNetEtb } = computeOrderSplit(pkg.priceEtb, feePercent);

  // Create the order AND its pending payment record ATOMICALLY, so there is no
  // window where an order exists without its payment record (recoverable). The
  // payment is upserted on the unique providerRef (`apex-{orderId}`) so a retried
  // checkout for the same order can never create a duplicate payment.
  const order = await prisma.$transaction(async (tx) => {
    const o = await tx.order.create({
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
    const providerRef = `apex-${o.id}`;
    await tx.payment.upsert({
      where: { providerRef },
      create: {
        orderId: o.id,
        amountEtb: pkg.priceEtb,
        provider: 'chapa',
        providerRef,
        status: 'PENDING',
      },
      // If a prior attempt already recorded this payment, keep it as-is (never
      // downgrade a SUCCESS/FAILED row back to PENDING).
      update: {},
    });
    return o;
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

  const updated = await prisma.$transaction(async (tx) => {
    // ── PAYMENT-CONFIRMATION ↔ CANCELLATION RACE ─────────────────────────────
    // Atomically claim the order PENDING → ACTIVE FIRST. This is the single
    // source of truth for "this order is now paid". A concurrent cancelOrder()
    // claims PENDING/ACTIVE → CANCELLED with its own CAS, so exactly one of
    // them wins. If we lose (0 rows — the order was cancelled or already
    // activated under us), we back out here and NEVER credit escrow to a
    // cancelled or double-activated order.
    const orderClaim = await tx.order.updateMany({
      where: { id: order.id, status: 'PENDING' },
      data: { status: 'ACTIVE' },
    });
    if (orderClaim.count === 0) {
      // Not pending anymore (cancelled during checkout, or already paid). No
      // money to move, no notification to send.
      return { activated: false };
    }

    // Mark the payment SUCCESS (idempotent). The order gate above already
    // serializes this path, so only the winning confirmation reaches here.
    await tx.payment.updateMany({
      where: { orderId: order.id, providerRef: txRef, status: 'PENDING' },
      data: {
        status: 'SUCCESS',
        method: verify.method,
        rawPayload: verify.raw as Prisma.InputJsonValue,
      },
    });

    // Escrow credit — DB-level idempotent (ledgerOnce). The ledger row and the
    // wallet mutation commit atomically, so a retry can never double-credit.
    await ledgerOnce(tx, {
      userId: order.clientId,
      type: 'ORDER_PAYMENT',
      amountEtb: -order.amountEtb,
      description: `Payment for ${order.title}`,
      relatedId: order.id,
    });
    await ledgerOnce(
      tx,
      {
        userId: order.sellerId,
        type: 'ORDER_PAYMENT',
        amountEtb: order.sellerNetEtb,
        description: `Escrow held for ${order.title}`,
        relatedId: order.id,
      },
      async () => {
        await tx.wallet.upsert({
          where: { userId: order.sellerId },
          create: { userId: order.sellerId, pendingEtb: order.sellerNetEtb },
          update: { pendingEtb: { increment: order.sellerNetEtb } },
        });
      },
    );
    await ledgerOnce(tx, {
      userId: order.sellerId,
      type: 'PLATFORM_FEE',
      amountEtb: -order.platformFeeEtb,
      description: `Platform fee on ${order.title}`,
      relatedId: order.id,
    });

    return { activated: true };
  });

  // Notify only when THIS request actually activated the order — a duplicate
  // webhook (or a cancellation that lost the race) stays silent.
  if (updated.activated) {
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
  }

  return { order, updated: updated.activated };
}

/** Client marks the delivery as accepted. Releases funds to seller balance. */
export async function acceptDelivery(orderId: string, clientId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new NotFoundError('Order');
  if (order.clientId !== clientId) throw new ForbiddenError();
  // Double-tap / stale-tab guard: state machine's raw message would confuse users.
  if (order.status === 'COMPLETED')
    throw new ConflictError('Delivery was already accepted — the funds have been released.');
  const next = transitionGuard(order.status, 'ACCEPT_DELIVERY', order.id);

  const updated = await prisma.$transaction(async (tx) => {
    // Compare-and-set FIRST: atomically require the pre-transition status.
    // If a concurrent request already transitioned the order, this matches 0
    // rows and we abort — the wallet/ledger changes below never run, so a
    // delivery can't be paid out twice.
    const claimed = await tx.order.updateMany({
      where: { id: order.id, status: order.status },
      data: { status: next, completedAt: new Date() },
    });
    if (claimed.count === 0) {
      throw new ConflictError('Order has already been accepted or changed');
    }
    // DB-level idempotent payout: ledger row keyed uniquely on
    // (seller, ORDER_PAYOUT, order) + atomic wallet mutation.
    const { applied } = await ledgerOnce(
      tx,
      {
        userId: order.sellerId,
        type: 'ORDER_PAYOUT',
        amountEtb: order.sellerNetEtb,
        description: `Released to balance: ${order.title}`,
        relatedId: order.id,
      },
      async () => {
        await tx.wallet.update({
          where: { userId: order.sellerId },
          data: {
            pendingEtb: { decrement: order.sellerNetEtb },
            balanceEtb: { increment: order.sellerNetEtb },
            lifetimeEarnedEtb: { increment: order.sellerNetEtb },
          },
        });
      },
    );
    if (!applied) throw new ConflictError('Order has already been paid out');
    await tx.user.update({
      where: { id: order.sellerId },
      data: { completedOrders: { increment: 1 } },
    });
    return tx.order.findUniqueOrThrow({ where: { id: order.id } });
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
  // Double-tap / second-device guard: the first tap already flipped the order
  // to IN_REVIEW. Say that in plain words instead of a state-machine error.
  if (order.status === 'IN_REVIEW')
    throw new ConflictError(
      'Already delivered — waiting for the client to accept or request a revision.',
    );
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
  if (order.status === 'ACTIVE')
    throw new ConflictError('A revision was already requested — the freelancer is working on it.');
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
    // ── CANCELLATION ↔ PAYMENT-CONFIRMATION RACE ─────────────────────────────
    // Cancel CAS-claims the order from the EXACT status we read. This is the
    // counterpart gate to confirmPaymentByTxRef (which claims PENDING → ACTIVE).
    // Exactly one of them wins:
    //   * we win → we transition from `order.status` and, if that was ACTIVE,
    //     we release escrow. Because we only ever refund the status we actually
    //     transitioned from, we never end up with a cancelled order that still
    //     holds escrow (the "stuck funds" outcome).
    //   * we lose → a concurrent confirm/another cancel changed the order, so
    //     we abort and the caller retries against the fresh state.
    const claimed = await tx.order.updateMany({
      where: { id: order.id, status: order.status },
      data: { status: next, cancelledAt: new Date() },
    });
    if (claimed.count === 0) {
      throw new ConflictError('Order has already been cancelled or changed');
    }
    // Refund exactly when we transitioned from ACTIVE (the only state holding
    // escrow). Idempotent via the unique ledger key, so a retried refund can't
    // double-credit the client.
    if (order.status === 'ACTIVE') {
      await ledgerOnce(
        tx,
        {
          userId: order.clientId,
          type: 'ORDER_REFUND',
          amountEtb: order.amountEtb,
          description: `Refund for cancelled order: ${order.title}`,
          relatedId: order.id,
        },
        async () => {
          await tx.wallet.update({
            where: { userId: order.sellerId },
            data: { pendingEtb: { decrement: order.sellerNetEtb } },
          });
        },
      );
    }
    return tx.order.findUniqueOrThrow({ where: { id: order.id } });
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
      milestones: {
        orderBy: { position: 'asc' },
        select: { id: true, title: true, amountEtb: true, status: true, dueDate: true },
      },
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
    // Zero-amount marker so we don't double-remind. Uses its own ledger type
    // (ESCROW_REMINDER) so it can never collide with the client's real
    // ORDER_PAYMENT row for the same order under the idempotency unique key.
    await prisma.transaction
      .createMany({
        data: [
          {
            userId: o.clientId,
            type: 'ESCROW_REMINDER',
            amountEtb: 0,
            description: `Escrow reminder for ${o.title}`,
            relatedId: o.id,
          },
        ],
        skipDuplicates: true,
      })
      .catch(() => undefined);
    reminded++;
  }

  // 2. Auto-release when past 7 days.
  const released = await prisma.order.findMany({
    where: { status: 'DELIVERED', deliveredAt: { lte: new Date(now - 7 * day) } },
    select: {
      id: true,
      clientId: true,
      sellerId: true,
      title: true,
      amountEtb: true,
      sellerNetEtb: true,
      platformFeeEtb: true,
      deliveredAt: true,
    },
  });
  let releasedCount = 0;
  for (const o of released) {
    let outcome: 'released' | 'skipped' = 'skipped';
    try {
      outcome = await prisma.$transaction(async (tx) => {
        // Atomically claim DELIVERED → COMPLETED BEFORE paying. The request that
        // matches exactly one row owns the payout; a concurrent one matches 0
        // rows and returns 'skipped', so funds move at most once.
        const claimed = await tx.order.updateMany({
          where: { id: o.id, status: 'DELIVERED' },
          data: { status: 'COMPLETED', completedAt: new Date() },
        });
        if (claimed.count === 0) return 'skipped';

        // DB-level idempotency: the ORDER_PAYOUT ledger row is keyed uniquely on
        // (seller, ORDER_PAYOUT, order) — a retried/concurrent release or a
        // manual accept that already paid this order matches 0 rows on the
        // ledger insert (or the CAS above), so it never double-pays.
        const { applied } = await ledgerOnce(
          tx,
          {
            userId: o.sellerId,
            type: 'ORDER_PAYOUT',
            amountEtb: o.sellerNetEtb,
            description: `Auto-released: ${o.title}`,
            relatedId: o.id,
          },
          async () => {
            await tx.wallet.upsert({
              where: { userId: o.sellerId },
              create: {
                userId: o.sellerId,
                balanceEtb: o.sellerNetEtb,
                lifetimeEarnedEtb: o.sellerNetEtb,
              },
              update: {
                pendingEtb: { decrement: o.sellerNetEtb },
                balanceEtb: { increment: o.sellerNetEtb },
                lifetimeEarnedEtb: { increment: o.sellerNetEtb },
              },
            });
          },
        );
        if (!applied) return 'skipped';

        await tx.user.update({
          where: { id: o.sellerId },
          data: { completedOrders: { increment: 1 } },
        });
        return 'released';
      });
    } catch {
      // Individual failure (e.g. transient DB error) shouldn't stop the batch.
      continue;
    }
    if (outcome === 'released') {
      await notify({
        userId: o.sellerId,
        type: 'PAYMENT',
        title: 'Auto-released 💰',
        body: `${o.title} — funds moved to your balance`,
        payload: { orderId: o.id, autoRelease: true },
      });
      releasedCount++;
    }
  }
  return { released: releasedCount, reminded };
}
