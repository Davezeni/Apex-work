import { Router } from 'express';
import {
  resumeSchema,
  workExperienceSchema,
  educationSchema,
  certificationSchema,
} from '@apex-work/shared';
import { asyncHandler } from '../lib/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { success } from '../lib/response.js';
import * as resume from '../services/resume.service.js';

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
