import {
  RESUME_TEMPLATES,
  resumeTemplateById,
  type ResumeTemplateDefinition,
  type ResumeTemplateId,
} from '@apex-work/shared';
import { prisma } from '../lib/prisma.js';
import { BadRequestError, ConflictError, NotFoundError } from '../lib/errors.js';
import { randomToken } from '../lib/hash.js';
import { env } from '../config/env.js';
import { chapa, ChapaService } from './chapa.service.js';

export interface ResumeActor {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  isPhoneVerified: boolean;
}

export interface ResumeTemplatePurchaseResult {
  owned: boolean;
  purchaseId?: string;
  templateId: ResumeTemplateId;
  checkoutUrl?: string | null;
}

function templateOrThrow(templateId: string): ResumeTemplateDefinition {
  const template = resumeTemplateById(templateId);
  if (!template) throw new NotFoundError('Resume template');
  return template;
}

function isFree(template: ResumeTemplateDefinition): boolean {
  return template.tier === 'free' || template.priceEtb === 0;
}

export function publicTemplate(template: ResumeTemplateDefinition) {
  return {
    ...template,
    features: [...template.features],
  };
}

/** Return the catalog and the current user's unlocked template IDs. */
export async function listForUser(userId: string) {
  const [resume, purchases] = await Promise.all([
    prisma.resume.findUnique({ where: { userId }, select: { templateId: true, theme: true } }),
    prisma.resumeTemplatePurchase.findMany({
      where: { userId, status: 'PAID' },
      select: { templateId: true },
    }),
  ]);
  const purchased = new Set(purchases.map((purchase) => purchase.templateId));
  const activeTemplateId = resume?.templateId || resume?.theme || 'classic';
  return {
    templates: RESUME_TEMPLATES.map((template) => ({
      ...publicTemplate(template),
      owned: isFree(template) || purchased.has(template.id),
      active: template.id === activeTemplateId,
    })),
    activeTemplateId,
  };
}

export async function assertUnlocked(
  userId: string,
  templateId: string,
): Promise<ResumeTemplateDefinition> {
  const template = templateOrThrow(templateId);
  if (isFree(template)) return template;
  const purchase = await prisma.resumeTemplatePurchase.findUnique({
    where: { userId_templateId: { userId, templateId: template.id } },
    select: { status: true },
  });
  if (purchase?.status !== 'PAID') {
    throw new ConflictError(`Unlock the ${template.name} template before selecting it`);
  }
  return template;
}

/** Select an unlocked template for the user's resume. */
export async function selectForUser(userId: string, templateId: string) {
  const template = await assertUnlocked(userId, templateId);
  const resume = await prisma.resume.upsert({
    where: { userId },
    create: { userId, templateId: template.id, theme: template.id },
    update: { templateId: template.id, theme: template.id },
  });
  return { templateId: resume.templateId, template: publicTemplate(template) };
}

/**
 * Create a one-time Chapa checkout for a premium template. The purchase row
 * is owned by the user and remains PENDING until Chapa verification succeeds.
 */
export async function startPurchase(
  actor: ResumeActor,
  templateId: string,
): Promise<ResumeTemplatePurchaseResult> {
  const template = templateOrThrow(templateId);
  if (isFree(template)) {
    return { owned: true, templateId: template.id };
  }
  if (!actor.phone || !actor.isPhoneVerified) {
    throw new ConflictError('Verify your phone number before buying a Pro template');
  }

  const existing = await prisma.resumeTemplatePurchase.findUnique({
    where: { userId_templateId: { userId: actor.id, templateId: template.id } },
    select: { id: true, status: true },
  });
  if (existing?.status === 'PAID') {
    return { owned: true, purchaseId: existing.id, templateId: template.id };
  }
  if (existing?.status === 'PENDING') {
    throw new ConflictError(
      'A payment for this template is already in progress. Return to Resume Studio to verify it.',
    );
  }

  if (!chapa.isConfigured()) {
    throw new ConflictError(
      'Template checkout is temporarily unavailable. Please try again later.',
    );
  }

  const providerRef = `apex-resume-${randomToken(16)}`;
  const purchase = existing
    ? await prisma.resumeTemplatePurchase.update({
        where: { id: existing.id },
        data: { amountEtb: template.priceEtb, providerRef, status: 'PENDING', paidAt: null },
      })
    : await prisma.resumeTemplatePurchase.create({
        data: {
          userId: actor.id,
          templateId: template.id,
          amountEtb: template.priceEtb,
          providerRef,
          status: 'PENDING',
        },
      });

  const init = await chapa.initialize({
    amountEtb: template.priceEtb,
    txRef: providerRef,
    callbackUrl: `${env.API_URL}/v1/payments/webhook`,
    returnUrl: `${env.WEB_URL}/resume/templates?purchase=${purchase.id}&template=${template.id}`,
    customer: {
      email: ChapaService.safeEmail(actor.email, actor.id),
      firstName: actor.fullName.split(' ')[0] ?? 'Freelancer',
      lastName: actor.fullName.split(' ').slice(1).join(' ') || 'Apex',
      phone: actor.phone ?? undefined,
    },
    title: 'Apex Resume Studio',
    description: `Unlock ${template.name}`,
  });

  if (!init.ok || !init.checkoutUrl) {
    await prisma.resumeTemplatePurchase
      .update({
        where: { id: purchase.id },
        data: { status: 'FAILED' },
      })
      .catch(() => undefined);
    throw new BadRequestError(
      typeof init.error === 'string'
        ? `Template payment failed: ${init.error}`
        : 'Template payment failed',
    );
  }

  return {
    owned: false,
    purchaseId: purchase.id,
    templateId: template.id,
    checkoutUrl: init.checkoutUrl,
  };
}

/** Verify a template purchase after Chapa's webhook or browser return. */
export async function confirmByProviderRef(providerRef: string) {
  const purchase = await prisma.resumeTemplatePurchase.findUnique({
    where: { providerRef },
    include: { user: { select: { id: true } } },
  });
  if (!purchase) throw new NotFoundError('Resume template purchase');
  if (purchase.status === 'PAID') return { purchase, updated: false };

  const verified = await chapa.verify(providerRef);
  if (!verified.ok)
    throw new BadRequestError(`Template payment verification failed: ${verified.error}`);
  if (verified.status !== 'success') {
    if (verified.status === 'failed') {
      await prisma.resumeTemplatePurchase.updateMany({
        where: { id: purchase.id, status: 'PENDING' },
        data: { status: 'FAILED' },
      });
    }
    return { purchase, updated: false };
  }
  if (verified.amount !== undefined && Math.round(verified.amount) !== purchase.amountEtb) {
    throw new BadRequestError('Template payment amount mismatch');
  }

  const updated = await prisma.resumeTemplatePurchase.updateMany({
    where: { id: purchase.id, status: 'PENDING' },
    data: { status: 'PAID', paidAt: new Date() },
  });
  const latest = await prisma.resumeTemplatePurchase.findUnique({ where: { id: purchase.id } });
  return { purchase: latest ?? purchase, updated: updated.count > 0 };
}

export async function confirmForUser(userId: string, purchaseId: string) {
  const purchase = await prisma.resumeTemplatePurchase.findFirst({
    where: { id: purchaseId, userId },
    select: { id: true, providerRef: true, templateId: true, status: true },
  });
  if (!purchase) throw new NotFoundError('Resume template purchase');
  const result = await confirmByProviderRef(purchase.providerRef);
  return {
    purchaseId: result.purchase.id,
    templateId: result.purchase.templateId,
    status: result.purchase.status,
    owned: result.purchase.status === 'PAID',
  };
}

export async function confirmByTransactionRef(txRef: string) {
  if (!txRef.startsWith('apex-resume-')) return null;
  return confirmByProviderRef(txRef);
}
