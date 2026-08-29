import { Router } from 'express';
import {
  resumeSchema,
  workExperienceSchema,
  educationSchema,
  certificationSchema,
  resumeTemplateSelectSchema,
  resumeTemplateVerifySchema,
  resumeVersionCreateSchema,
  resumeVersionIdSchema,
} from '@apex-work/shared';
import { asyncHandler } from '../lib/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { success } from '../lib/response.js';
import { BadRequestError, NotFoundError } from '../lib/errors.js';
import { prisma } from '../lib/prisma.js';
import * as resume from '../services/resume.service.js';
import * as resumeTemplates from '../services/resumeTemplates.service.js';
import * as resumeVersions from '../services/resumeVersions.service.js';

const router: Router = Router();
router.use(requireAuth);

/** GET /me/resume */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const r = await resume.getResume(req.user!.sub);
    return success(res, r);
  }),
);

/** PATCH /me/resume — top-level fields (headline/summary/etc). */
router.patch(
  '/',
  validate(resumeSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as import('@apex-work/shared').ResumeInput;
    const r = await resume.updateResume(req.user!.sub, body);
    return success(res, r);
  }),
);

// ---------------- Resume Studio versions ----------------
router.get(
  '/versions',
  asyncHandler(async (req, res) => {
    return success(res, { items: await resumeVersions.list(req.user!.sub) });
  }),
);

router.post(
  '/versions',
  validate(resumeVersionCreateSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as import('@apex-work/shared').ResumeVersionCreateInput;
    return success(res, await resumeVersions.create(req.user!.sub, body.name), 201);
  }),
);

router.post(
  '/versions/:id/restore',
  validate(resumeVersionIdSchema, 'params'),
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string };
    return success(res, await resumeVersions.restore(req.user!.sub, id));
  }),
);

router.delete(
  '/versions/:id',
  validate(resumeVersionIdSchema, 'params'),
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string };
    return success(res, await resumeVersions.remove(req.user!.sub, id));
  }),
);

// ---------------- Resume Studio templates ----------------
router.get(
  '/templates',
  asyncHandler(async (req, res) => {
    return success(res, await resumeTemplates.listForUser(req.user!.sub));
  }),
);

router.patch(
  '/template',
  validate(resumeTemplateSelectSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as import('@apex-work/shared').ResumeTemplateSelectInput;
    return success(res, await resumeTemplates.selectForUser(req.user!.sub, body.templateId));
  }),
);

router.post(
  '/templates/:templateId/checkout',
  asyncHandler(async (req, res) => {
    const { templateId } = req.params as { templateId: string };
    const actor = await prisma.user.findUnique({
      where: { id: req.user!.sub },
      select: { id: true, fullName: true, email: true, phone: true, isPhoneVerified: true },
    });
    if (!actor) throw new NotFoundError('User');
    return success(res, await resumeTemplates.startPurchase(actor, templateId));
  }),
);

router.post(
  '/templates/:templateId/verify',
  validate(resumeTemplateVerifySchema),
  asyncHandler(async (req, res) => {
    const { templateId } = req.params as { templateId: string };
    const body = req.body as import('@apex-work/shared').ResumeTemplateVerifyInput;
    const result = await resumeTemplates.confirmForUser(req.user!.sub, body.purchaseId);
    if (result.templateId !== templateId)
      throw new BadRequestError('Template purchase does not match this template');
    return success(res, result);
  }),
);

// ---------------- experience ----------------
router.post(
  '/experience',
  validate(workExperienceSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as import('@apex-work/shared').WorkExperienceInput;
    const row = await resume.addExperience(req.user!.sub, body);
    return success(res, row, 201);
  }),
);
router.patch(
  '/experience/:id',
  validate(workExperienceSchema),
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string };
    const body = req.body as import('@apex-work/shared').WorkExperienceInput;
    const row = await resume.updateExperience(req.user!.sub, id, body);
    return success(res, row);
  }),
);
router.delete(
  '/experience/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string };
    await resume.deleteExperience(req.user!.sub, id);
    return success(res, { ok: true });
  }),
);

// ---------------- education ----------------
router.post(
  '/education',
  validate(educationSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as import('@apex-work/shared').EducationInput;
    const row = await resume.addEducation(req.user!.sub, body);
    return success(res, row, 201);
  }),
);
router.patch(
  '/education/:id',
  validate(educationSchema),
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string };
    const body = req.body as import('@apex-work/shared').EducationInput;
    const row = await resume.updateEducation(req.user!.sub, id, body);
    return success(res, row);
  }),
);
router.delete(
  '/education/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string };
    await resume.deleteEducation(req.user!.sub, id);
    return success(res, { ok: true });
  }),
);

// ---------------- certifications ----------------
router.post(
  '/certification',
  validate(certificationSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as import('@apex-work/shared').CertificationInput;
    const row = await resume.addCertification(req.user!.sub, body);
    return success(res, row, 201);
  }),
);
router.patch(
  '/certification/:id',
  validate(certificationSchema),
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string };
    const body = req.body as import('@apex-work/shared').CertificationInput;
    const row = await resume.updateCertification(req.user!.sub, id, body);
    return success(res, row);
  }),
);
router.delete(
  '/certification/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string };
    await resume.deleteCertification(req.user!.sub, id);
    return success(res, { ok: true });
  }),
);

export default router;
