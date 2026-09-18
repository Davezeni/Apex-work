import { Router } from 'express';
import mammoth from 'mammoth';
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
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
import { logger } from '../config/logger.js';
import { extractResumeData, isAiConfigured } from '../services/resumeExtractAi.service.js';
import { extractResumeTextSchema } from '@apex-work/shared';
import { prisma } from '../lib/prisma.js';
import * as resume from '../services/resume.service.js';
import * as resumeTemplates from '../services/resumeTemplates.service.js';
import * as resumeVersions from '../services/resumeVersions.service.js';

const router: Router = Router();
router.use(requireAuth);

/**
 * POST /me/resume/parse-file?filename=resume.pdf — extract plain text from an
 * uploaded CV (PDF, DOCX, TXT/MD) so the web import page can prefill and let
 * the user review before saving. Raw bytes in the body, like /uploads/proxy.
 */
router.post(
  '/parse-file',
  asyncHandler(async (req, res) => {
    const filename = ((req.query as { filename?: string }).filename ?? '').trim();
    const ext = filename.toLowerCase().split('.').pop() ?? '';
    if (!['pdf', 'docx', 'txt', 'md'].includes(ext)) {
      throw new BadRequestError('Upload a PDF, DOCX or plain-text CV');
    }

    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const buf = Buffer.concat(chunks);
    if (buf.length < 64) throw new BadRequestError('The file looks empty');
    if (buf.length > 15 * 1024 * 1024) throw new BadRequestError('Max 15 MB per CV');

    let text = '';
    if (ext === 'pdf') {
      const out = await pdfParse(buf);
      text = out.text;
    } else if (ext === 'docx') {
      const out = await mammoth.extractRawText({ buffer: buf });
      text = out.value;
    } else {
      text = buf.toString('utf8');
    }
    if (text.replace(/\s+/g, '').length < 40) {
      throw new BadRequestError('Could not find readable text — try a text-based PDF');
    }
    const clean = text.slice(0, 60_000);
    let extracted: unknown = null;
    let engine = 'basic';
    let aiNote: string | null = isAiConfigured() ? null : 'AI_NOT_CONFIGURED';
    if (isAiConfigured()) {
      try {
        extracted = await extractResumeData(clean);
        engine = 'ai';
        aiNote = null;
      } catch (error) {
        aiNote = `AI_ERROR: ${error instanceof Error ? error.message : 'unknown'}`;
        logger.warn({ note: aiNote }, 'resume AI extraction failed — client falls back to heuristic');
      }
    }
    return success(res, { text: clean, extracted, engine, aiNote });
  }),
);

/**
 * POST /me/resume/extract — AI-structured extraction from pasted CV text
 * (same engine as parse-file, for the paste / LinkedIn-About path).
 */
router.post(
  '/extract',
  validate(extractResumeTextSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as import('@apex-work/shared').ExtractResumeTextInput;
    if (!isAiConfigured()) return success(res, { extracted: null, engine: 'basic', aiNote: 'AI_NOT_CONFIGURED' });
    try {
      return success(res, { extracted: await extractResumeData(body.text), engine: 'ai', aiNote: null });
    } catch (error) {
      const note = `AI_ERROR: ${error instanceof Error ? error.message : 'unknown'}`;
      logger.warn({ note }, 'resume AI extraction failed — client falls back to heuristic');
      return success(res, { extracted: null, engine: 'basic', aiNote: note });
    }
  }),
);

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
