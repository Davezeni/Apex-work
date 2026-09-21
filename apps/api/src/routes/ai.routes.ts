import { Router, RequestHandler } from 'express';
import {
  aiProposalSchema,
  aiBriefSchema,
  aiTranscribeSchema,
  enhanceResumeSchema,
  aiChatSchema,
  aiRepliesSchema,
  aiResumeReviewSchema,
  aiResumeSkillsSchema,
  aiPortfolioCaseStudySchema,
  aiResumeTailorSchema,
  aiCoverLetterSchema,
  aiBulletRewriteSchema,
} from '@apex-work/shared';
import { asyncHandler } from '../lib/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { redis } from '../lib/redis.js';
import { failure } from '../lib/response.js';
import { requireAuth } from '../middleware/auth.js';
import { aiLimiter } from '../middleware/rateLimit.js';
import { success } from '../lib/response.js';
import { env, isProd } from '../config/env.js';
import * as ai from '../services/ai.service.js';
import * as studioAi from '../services/resumeStudioAi.service.js';
import * as tailorAi from '../services/resumeTailorAi.service.js';
import * as careerAi from '../services/careerAi.service.js';

const router: Router = Router();

// Every AI call hits an LLM provider, so cap the whole /ai namespace (incl.
// the public /status probe) tighter than the general API limiter.
/**
 * Per-user daily AI quota (production only): protects the Groq budget from
 * runaway or scripted abuse while staying invisible to normal users.
 * Counters are Redis INCR keys that expire at the end of the next day.
 */
const AI_DAILY_LIMIT = Number(process.env.AI_DAILY_LIMIT ?? 150);

const aiDailyQuota: RequestHandler = async (req, res, next) => {
  if (!isProd) return next();
  const userId = (req as unknown as { user?: { id?: string } }).user?.id;
  if (!userId) return next(); // auth middleware runs first; safe no-op otherwise
  const day = new Date().toISOString().slice(0, 10);
  const key = `ai:quota:${userId}:${day}`;
  try {
    const used = await redis.incr(key);
    if (used === 1) await redis.expire(key, 60 * 60 * 48);
    if (used > AI_DAILY_LIMIT) {
      return failure(
        res,
        'AI_QUOTA',
        `Daily AI limit reached (${AI_DAILY_LIMIT}). Back tomorrow.`,
        429,
      );
    }
    return next();
  } catch {
    return next(); // quota must never break the feature if Redis hiccups
  }
};

router.use(aiLimiter);

/** Public, non-secret diagnostic so the UI can explain whether live AI is available. */
router.get('/status', (_req, res) => {
  return success(res, {
    configured: !!env.GROQ_API_KEY,
    fallbackAvailable: true,
    fallbackVersion: 'deterministic-v2',
    model: env.GROQ_API_KEY ? 'llama-3.3-70b-versatile' : null,
    providerReachable: ai.aiProviderStatus().reachable,
    lastProviderError: ai.aiProviderStatus().lastError,
  });
});

router.use(requireAuth);
router.use(aiDailyQuota);

router.post(
  '/replies',
  validate(aiRepliesSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as import('@apex-work/shared').AIRepliesInput;
    return success(res, await ai.suggestReplies(body.history));
  }),
);

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
  '/cover-letter',
  validate(aiCoverLetterSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as import('@apex-work/shared').AICoverLetterInput;
    return success(res, await careerAi.generateCoverLetter(body));
  }),
);

router.post(
  '/resume/bullet',
  validate(aiBulletRewriteSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as import('@apex-work/shared').AIBulletRewriteInput;
    return success(res, await careerAi.rewriteBullet(body));
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
