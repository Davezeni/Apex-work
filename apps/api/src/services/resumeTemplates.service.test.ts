import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock, chapaMock } = vi.hoisted(() => ({
  prismaMock: {
    resume: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    resumeTemplatePurchase: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  },
  chapaMock: {
    isConfigured: vi.fn(),
    initialize: vi.fn(),
    verify: vi.fn(),
  },
}));

vi.mock('../lib/prisma.js', () => ({ prisma: prismaMock }));
vi.mock('./chapa.service.js', () => ({
  chapa: chapaMock,
  ChapaService: {
    safeEmail: (email: string | null | undefined) => email ?? 'fallback@apex-work.com',
  },
}));

import {
  assertUnlocked,
  listForUser,
  selectForUser,
  startPurchase,
} from './resumeTemplates.service.js';

describe('Resume Studio templates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.resume.findUnique.mockResolvedValue({ templateId: 'classic', theme: 'classic' });
    prismaMock.resume.upsert.mockImplementation(({ create }: { create: { templateId: string } }) =>
      Promise.resolve({ templateId: create.templateId }),
    );
    prismaMock.resumeTemplatePurchase.findMany.mockResolvedValue([]);
    prismaMock.resumeTemplatePurchase.findUnique.mockResolvedValue(null);
    prismaMock.resumeTemplatePurchase.findFirst.mockResolvedValue(null);
    prismaMock.resumeTemplatePurchase.create.mockResolvedValue({ id: 'purchase-1' });
    prismaMock.resumeTemplatePurchase.update.mockResolvedValue({ id: 'purchase-1' });
    chapaMock.isConfigured.mockReturnValue(true);
    chapaMock.initialize.mockResolvedValue({
      ok: true,
      checkoutUrl: 'https://checkout.example/resume',
    });
  });

  it('marks free templates as owned and premium templates as locked', async () => {
    const result = await listForUser('user-1');
    expect(result.activeTemplateId).toBe('classic');
    expect(result.templates.find((item) => item.id === 'classic')?.owned).toBe(true);
    expect(result.templates.find((item) => item.id === 'executive')?.owned).toBe(false);
  });

  it('allows a purchased premium template to be selected', async () => {
    prismaMock.resumeTemplatePurchase.findUnique.mockResolvedValue({ status: 'PAID' });
    await expect(assertUnlocked('user-1', 'executive')).resolves.toMatchObject({ id: 'executive' });
    await expect(selectForUser('user-1', 'executive')).resolves.toMatchObject({
      templateId: 'executive',
    });
    expect(prismaMock.resume.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { templateId: 'executive', theme: 'executive' },
      }),
    );
  });

  it('starts a one-time Chapa purchase for an unlocked-by-payment template', async () => {
    await expect(
      startPurchase(
        {
          id: 'user-1',
          fullName: 'Apex User',
          email: 'user@example.com',
          phone: '+251911111111',
          isPhoneVerified: true,
        },
        'creative',
      ),
    ).resolves.toMatchObject({
      owned: false,
      templateId: 'creative',
      checkoutUrl: 'https://checkout.example/resume',
    });
    expect(prismaMock.resumeTemplatePurchase.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-1',
          templateId: 'creative',
          amountEtb: 199,
          status: 'PENDING',
        }),
      }),
    );
    expect(chapaMock.initialize).toHaveBeenCalledWith(
      expect.objectContaining({
        amountEtb: 199,
        txRef: expect.stringContaining('apex-resume-'),
      }),
    );
  });
});
