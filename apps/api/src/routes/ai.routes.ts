import { Router } from 'express';
import {
  aiProposalSchema,
  aiBriefSchema,
  aiTranscribeSchema,
  enhanceResumeSchema,
  aiChatSchema,
  aiResumeReviewSchema,
  aiResumeSkillsSchema,
  aiPortfolioCaseStudySchema,
  aiResumeTailorSchema,
} from '@apex-work/shared';
import { asyncHandler } from '../lib/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { success } from '../lib/response.js';
import { env } from '../config/env.js';
import * as ai from '../services/ai.service.js';
import * as studioAi from '../services/resumeStudioAi.service.js';
import * as tailorAi from '../services/resumeTailorAi.service.js';

const router: Router = Router();

/** Public, non-secret diagnostic so the UI can explain whether live AI is available. */
router.get('/status', (_req, res) => {
  return success(res, {
    configured: !!env.GROQ_API_KEY,
    fallbackAvailable: true,
    fallbackVersion: 'deterministic-v2',
    model: env.GROQ_API_KEY ? 'llama-3.3-70b-versatile' : null,
  });
});

router.use(requireAuth);

router.post(
  '/proposal',
  validate(aiProposalSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as import('@apex-work/shared').AIProposalInput;
    const result = await ai.generateProposal({
      jobDescription: body.jobDescription,
      name: body.name,
      skills: body.skills,
      tone: body.tone,
    });
    return success(res, result);
  }),
);

router.post(
  '/brief',
  validate(aiBriefSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as import('@apex-work/shared').AIBriefInput;
    const result = await ai.generateBrief(body.idea);
    return success(res, result);
  }),
);

router.post(
  '/resume/enhance',
  validate(enhanceResumeSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as import('@apex-work/shared').EnhanceResumeInput;
    const result = await ai.enhanceResume(body.section, body.text);
    return success(res, result);
  }),
);

router.post(
  '/resume/review',
  validate(aiResumeReviewSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as import('@apex-work/shared').AIResumeReviewInput;
    return success(res, await studioAi.reviewResume(body));
  }),
);

router.post(
  '/resume/suggest-skills',
  validate(aiResumeSkillsSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as import('@apex-work/shared').AIResumeSkillsInput;
    return success(res, await studioAi.suggestResumeSkills(body));
  }),
);

router.post(
  '/portfolio/case-study',
  validate(aiPortfolioCaseStudySchema),
  asyncHandler(async (req, res) => {
    const body = req.body as import('@apex-work/shared').AIPortfolioCaseStudyInput;
    return success(res, await studioAi.generatePortfolioCaseStudy(body));
  }),
);

router.post(
  '/resume/tailor',
  validate(aiResumeTailorSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as import('@apex-work/shared').AIResumeTailorInput;
    return success(res, await tailorAi.tailorResume(body));
  }),
);

router.post(
  '/transcribe',
  validate(aiTranscribeSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as import('@apex-work/shared').AITranscribeInput;
    const result = await ai.transcribeAudioUrl(body.audioUrl, body.language);
    return success(res, result);
  }),
);

router.post(
  '/chat',
  validate(aiChatSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as import('@apex-work/shared').AIChatInput;
    const result = await ai.chatAssistant(body.messages);
    return success(res, result);
  }),
);

export default router;
