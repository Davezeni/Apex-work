/**
 * In-chat custom offers. Freelancer proposes a price/timeline; client can
 * accept → creates an Order + Chapa checkout (reusing the exact same
 * payment path used by gigs and job-bid acceptance).
 *
 * Offers expire after 7 days if untouched. We surface them as special
 * messages in the conversation (attachmentType='offer' + attachmentUrl
 * pointing to the offer id, so the chat UI can render an interactive card).
 */
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { PLATFORM_FEE_PERCENT } from '@apex-work/shared';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../lib/errors.js';
import { assertMember, sendMessage } from './chat.service.js';
import { notify } from './notifications.service.js';
import { ChapaService, chapa } from './chapa.service.js';
import { env } from '../config/env.js';

const OFFER_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export async function createOffer(
  senderId: string,
  input: {
    conversationId: string;
    title: string;
    description?: string;
    priceEtb: number;
    deliveryDays: number;
    gigId?: string;
  },
) {
  await assertMember(input.conversationId, senderId);

  const sender = await prisma.user.findUnique({
    where: { id: senderId },
    select: { id: true, role: true, isOnboarded: true },
  });
  if (!sender) throw new NotFoundError('User');
  if (sender.role !== 'FREELANCER') {
    throw new ForbiddenError('Only freelancers can send offers');
  }
  if (!sender.isOnboarded) {
    throw new BadRequestError('Complete your profile before sending offers');
  }

  // Find the other member — direct chats are 2 members; for now we only
  // support offers in 1:1. Groups can be added when we support group orders.
  const members = await prisma.conversationMember.findMany({
    where: { conversationId: input.conversationId },
    select: { userId: true },
  });
  const recipient = members.find((m) => m.userId !== senderId);
  if (!recipient) throw new BadRequestError('Offers only work in 1:1 chats');

  const offer = await prisma.customOffer.create({
    data: {
      conversationId: input.conversationId,
      senderId,
      recipientId: recipient.userId,
      gigId: input.gigId ?? null,
      title: input.title,
      description: input.description ?? null,
      priceEtb: input.priceEtb,
      deliveryDays: input.deliveryDays,
      expiresAt: new Date(Date.now() + OFFER_TTL_MS),
    },
  });

  // Post the offer as a chat message so it renders inline.
  await sendMessage({
    conversationId: input.conversationId,
    senderId,
    body: `📩 Sent an offer: ${input.title} — ${input.priceEtb} ETB`,
    attachmentType: 'file', // placeholder type; the frontend keys off attachmentMeta
    attachmentUrl: `apex://offer/${offer.id}`,
  }).catch(() => undefined);

  return offer;
}

export async function respondToOffer(
  offerId: string,
  userId: string,
  action: 'accept' | 'decline' | 'cancel',
) {
  const offer = await prisma.customOffer.findUnique({
    where: { id: offerId },
    include: { sender: true, recipient: true },
  });
  if (!offer) throw new NotFoundError('Offer');
  if (offer.status !== 'PENDING') throw new ConflictError('This offer is no longer active');
  if (offer.expiresAt < new Date()) {
    await prisma.customOffer.update({ where: { id: offer.id }, data: { status: 'EXPIRED' } });
    throw new ConflictError('This offer has expired');
  }

  if (action === 'cancel') {
    if (offer.senderId !== userId) throw new ForbiddenError();
    return prisma.customOffer.update({
      where: { id: offer.id },
      data: { status: 'CANCELLED', respondedAt: new Date() },
    });
  }
  if (offer.recipientId !== userId) throw new ForbiddenError();

  if (action === 'decline') {
    await notify({
      userId: offer.senderId,
      type: 'ORDER_UPDATE',
      title: 'Offer declined',
      body: offer.title,
      payload: { offerId },
    });
    return prisma.customOffer.update({
      where: { id: offer.id },
      data: { status: 'DECLINED', respondedAt: new Date() },
    });
  }

  // action === 'accept' — create order + initiate Chapa (same as gig purchase).
  const fee = Math.round((offer.priceEtb * PLATFORM_FEE_PERCENT) / 100);
  const sellerNet = offer.priceEtb - fee;

  const order = await prisma.$transaction(async (tx) => {
    const o = await tx.order.create({
      data: {
        clientId: offer.recipientId,
        sellerId: offer.senderId,
        gigId: offer.gigId ?? null,
        packageTier: null,
        title: offer.title,
        amountEtb: offer.priceEtb,
        platformFeeEtb: fee,
        sellerNetEtb: sellerNet,
        deliveryDays: offer.deliveryDays,
        requirements: offer.description,
        deadline: new Date(Date.now() + offer.deliveryDays * 24 * 60 * 60 * 1000),
        status: 'PENDING',
      },
    });
    await tx.customOffer.update({
      where: { id: offer.id },
      data: { status: 'ACCEPTED', respondedAt: new Date(), orderId: o.id },
    });
    return o;
  });

  if (!chapa.isConfigured()) {
    return { offer, order, checkoutUrl: null as string | null };
  }

  const client = await prisma.user.findUnique({
    where: { id: offer.recipientId },
    select: { id: true, email: true, phone: true, fullName: true },
  });
  if (!client) throw new NotFoundError('User');

  const init = await chapa.initialize({
    amountEtb: offer.priceEtb,
    txRef: `apex-${order.id}`,
    callbackUrl: `${env.API_URL}/v1/payments/webhook`,
    returnUrl: `${env.WEB_URL}/orders/${order.id}?paid=1`,
    customer: {
      email: ChapaService.safeEmail(client.email, client.id),
      firstName: client.fullName.split(' ')[0] ?? 'Customer',
      lastName: client.fullName.split(' ').slice(1).join(' ') || 'Apex',
      phone: client.phone,
    },
    title: 'Apex-Work',
    description: `Offer: ${offer.title.slice(0, 40)}`,
  });
  if (!init.ok || !init.checkoutUrl) {
    throw new BadRequestError(init.error ?? 'Payment initialization failed');
  }
  await prisma.payment.create({
    data: {
      orderId: order.id,
      amountEtb: offer.priceEtb,
      provider: 'chapa',
      providerRef: `apex-${order.id}`,
      status: 'PENDING',
    },
  });
  return { offer, order, checkoutUrl: init.checkoutUrl };
}

export async function getOffer(offerId: string, userId: string) {
  const offer = await prisma.customOffer.findUnique({
    where: { id: offerId },
    include: {
      sender: { select: { id: true, username: true, fullName: true, avatarUrl: true } },
      recipient: { select: { id: true, username: true, fullName: true, avatarUrl: true } },
    },
  });
  if (!offer) throw new NotFoundError('Offer');
  if (offer.senderId !== userId && offer.recipientId !== userId) throw new ForbiddenError();
  return offer;
}
