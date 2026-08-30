import { PRO_PLANS, type ProPlanId } from '@apex-work/shared';
import { prisma } from '../lib/prisma.js';
import { BadRequestError, ConflictError, NotFoundError } from '../lib/errors.js';
import { randomToken } from '../lib/hash.js';
import { env } from '../config/env.js';
import { chapa, ChapaService } from './chapa.service.js';

const PASS_DAYS = 30;

export interface SubscriptionActor {
  id: string;
  // `role` may be any Prisma UserRole (incl. staff roles); only the
  // FREELANCER/CLIENT split matters here.
  role: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  isPhoneVerified: boolean;
}

function planOrThrow(plan: string) {
  const value = PRO_PLANS.find((item) => item.id === plan);
  if (!value) throw new NotFoundError('Pro plan');
  return value;
}

export async function mine(userId: string) {
  await prisma.subscription.updateMany({
    where: { userId, status: 'ACTIVE', expiresAt: { lt: new Date() } },
    data: { status: 'EXPIRED' },
  });
  const active = await prisma.subscription.findFirst({
    where: { userId, status: 'ACTIVE', expiresAt: { gt: new Date() } },
    orderBy: { expiresAt: 'desc' },
    select: {
      id: true,
      plan: true,
      status: true,
      amountEtb: true,
      startedAt: true,
      expiresAt: true,
    },
  });
  return { plan: active?.plan ?? 'FREE', subscription: active, plans: PRO_PLANS };
}

export async function startPurchase(actor: SubscriptionActor, planId: string) {
  const plan = planOrThrow(planId);
  if (plan.id === 'FREELANCER_PRO' && actor.role !== 'FREELANCER') {
    throw new ConflictError('Freelancer Pro is available to freelancer accounts');
  }
  if (plan.id === 'CLIENT_PRO' && actor.role !== 'CLIENT') {
    throw new ConflictError('Client Pro is available to client accounts');
  }
  if (!actor.phone || !actor.isPhoneVerified) {
    throw new ConflictError('Verify your phone number before activating Pro');
  }

  const active = await prisma.subscription.findFirst({
    where: { userId: actor.id, plan: plan.id, status: 'ACTIVE', expiresAt: { gt: new Date() } },
    select: { id: true, expiresAt: true },
  });
  if (active) return { owned: true, purchaseId: active.id, plan: plan.id, checkoutUrl: null };
  const pending = await prisma.subscription.findFirst({
    where: { userId: actor.id, plan: plan.id, status: 'PENDING' },
    select: { id: true },
  });
  if (pending)
    throw new ConflictError(
      'A Pro payment is already in progress. Return here after checkout to verify it.',
    );
  if (!chapa.isConfigured()) throw new ConflictError('Pro checkout is temporarily unavailable');

  const providerRef = `apex-pro-${randomToken(16)}`;
  const purchase = await prisma.subscription.create({
    data: { userId: actor.id, plan: plan.id, amountEtb: plan.priceEtb, providerRef },
  });
  const init = await chapa.initialize({
    amountEtb: plan.priceEtb,
    txRef: providerRef,
    callbackUrl: `${env.API_URL}/v1/payments/webhook`,
    returnUrl: `${env.WEB_URL}/pro?purchase=${purchase.id}&plan=${plan.id}`,
    customer: {
      email: ChapaService.safeEmail(actor.email, actor.id),
      firstName: actor.fullName.split(' ')[0] ?? 'Apex',
      lastName: actor.fullName.split(' ').slice(1).join(' ') || 'User',
      phone: actor.phone,
    },
    title: 'Apex-Work Pro',
    description: plan.name,
  });
  if (!init.ok || !init.checkoutUrl) {
    await prisma.subscription
      .update({ where: { id: purchase.id }, data: { status: 'CANCELLED' } })
      .catch(() => undefined);
    throw new BadRequestError(
      typeof init.error === 'string' ? `Pro payment failed: ${init.error}` : 'Pro payment failed',
    );
  }
  return { owned: false, purchaseId: purchase.id, plan: plan.id, checkoutUrl: init.checkoutUrl };
}

export async function confirmByProviderRef(providerRef: string) {
  const purchase = await prisma.subscription.findUnique({ where: { providerRef } });
  if (!purchase) throw new NotFoundError('Pro purchase');
  if (purchase.status === 'ACTIVE') return { purchase, updated: false };
  const verified = await chapa.verify(providerRef);
  if (!verified.ok) throw new BadRequestError(`Pro payment verification failed: ${verified.error}`);
  if (verified.status !== 'success') {
    if (verified.status === 'failed')
      await prisma.subscription.updateMany({
        where: { id: purchase.id, status: 'PENDING' },
        data: { status: 'CANCELLED' },
      });
    return { purchase, updated: false };
  }
  if (verified.amount !== undefined && Math.round(verified.amount) !== purchase.amountEtb)
    throw new BadRequestError('Pro payment amount mismatch');
  const now = new Date();
  const updated = await prisma.subscription.updateMany({
    where: { id: purchase.id, status: 'PENDING' },
    data: {
      status: 'ACTIVE',
      startedAt: now,
      expiresAt: new Date(now.getTime() + PASS_DAYS * 24 * 60 * 60 * 1000),
    },
  });
  const latest = await prisma.subscription.findUnique({ where: { id: purchase.id } });
  return { purchase: latest ?? purchase, updated: updated.count > 0 };
}

export async function confirmForUser(userId: string, purchaseId: string, planId: string) {
  const purchase = await prisma.subscription.findFirst({
    where: { id: purchaseId, userId },
    select: { providerRef: true, plan: true },
  });
  if (!purchase || purchase.plan !== planId)
    throw new BadRequestError('Pro purchase does not match this plan');
  const result = await confirmByProviderRef(purchase.providerRef);
  return {
    purchaseId,
    plan: result.purchase.plan,
    status: result.purchase.status,
    active: result.purchase.status === 'ACTIVE',
    expiresAt: result.purchase.expiresAt,
  };
}

export async function confirmByTransactionRef(txRef: string) {
  if (!txRef.startsWith('apex-pro-')) return null;
  return confirmByProviderRef(txRef);
}
