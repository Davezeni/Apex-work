import { z } from 'zod';

/** AI proposal writer — given a job description, tone, and skills, produce a proposal. */
export const aiProposalSchema = z.object({
  jobDescription: z.string().trim().min(30).max(6000),
  name: z.string().trim().max(80).optional(),
  skills: z.string().trim().max(400).optional(),
  tone: z.enum(['friendly', 'professional', 'confident']).default('friendly'),
});
export type AIProposalInput = z.infer<typeof aiProposalSchema>;

/** AI brief generator — turn a rough description into a structured job post. */
export const aiBriefSchema = z.object({
  idea: z.string().trim().min(15).max(2000),
});
export type AIBriefInput = z.infer<typeof aiBriefSchema>;

/** AI voice transcription — accepts a URL to a Supabase-hosted audio blob. */
export const aiTranscribeSchema = z.object({
  audioUrl: z.string().url(),
  /** BCP-47 hint — helps Whisper pick the right script/dialect. */
  language: z.string().trim().max(20).optional(),
});
export type AITranscribeInput = z.infer<typeof aiTranscribeSchema>;

/**
 * AI Chat Assistant — in-app help bot. Client sends the full recent history
 * (small, capped) plus the latest user message. Server prepends a system
 * prompt with Apex-Work product context and calls Groq.
 */
export const aiChatSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().min(1).max(4000),
      }),
    )
    .min(1)
    .max(20),
});
export type AIChatInput = z.infer<typeof aiChatSchema>;

/** AI translate gig — server calls Groq and upserts GigTranslation row. */
export const aiTranslateGigSchema = z.object({
  gigSlug: z.string().min(1).max(120),
  targetLocale: z.enum(['en', 'am']),
});
export type AITranslateGigInput = z.infer<typeof aiTranslateGigSchema>;

/** Resume coach — returns a score and practical fixes without changing data. */
export const aiResumeReviewSchema = z.object({
  targetRole: z.string().trim().max(120).optional(),
  headline: z.string().trim().max(120).optional(),
  summary: z.string().trim().max(2000).optional(),
  skills: z.array(z.string().trim().max(60)).max(40).default([]),
  experience: z
    .array(
      z.object({
        role: z.string().trim().max(120),
        company: z.string().trim().max(120),
        description: z.string().trim().max(2000).optional(),
      }),
    )
    .max(20)
    .default([]),
  projects: z
    .array(
      z.object({
        title: z.string().trim().max(120),
        description: z.string().trim().max(1600).optional(),
      }),
    )
    .max(20)
    .default([]),
});
export type AIResumeReviewInput = z.infer<typeof aiResumeReviewSchema>;

/** Suggest skills and keywords for a target role based on the current CV. */
export const aiResumeSkillsSchema = z.object({
  targetRole: z.string().trim().min(2).max(120),
  existingSkills: z.array(z.string().trim().max(60)).max(40).default([]),
  summary: z.string().trim().max(2000).optional(),
});
export type AIResumeSkillsInput = z.infer<typeof aiResumeSkillsSchema>;

/** Write a truthful portfolio case study from facts the freelancer provides. */
export const aiPortfolioCaseStudySchema = z.object({
  title: z.string().trim().min(2).max(120),
  role: z.string().trim().max(120).optional(),
  tools: z.array(z.string().trim().max(50)).max(20).default([]),
  roughDescription: z.string().trim().min(10).max(3000),
  outcome: z.string().trim().max(1200).optional(),
});
export type AIPortfolioCaseStudyInput = z.infer<typeof aiPortfolioCaseStudySchema>;

/** Tailor a current resume to a specific job brief without inventing facts. */
export const aiResumeTailorSchema = z.object({
  jobDescription: z.string().trim().min(30).max(6000),
  targetRole: z.string().trim().max(120).optional(),
  resume: z.object({
    headline: z.string().trim().max(120).optional(),
    summary: z.string().trim().max(2000).optional(),
    skills: z.array(z.string().trim().max(60)).max(40).default([]),
    experience: z
      .array(
        z.object({
          role: z.string().trim().max(120),
          company: z.string().trim().max(120),
          description: z.string().trim().max(2000).optional(),
        }),
      )
      .max(20)
      .default([]),
    projects: z
      .array(
        z.object({
          title: z.string().trim().max(120),
          description: z.string().trim().max(1600).optional(),
        }),
      )
      .max(20)
      .default([]),
  }),
});
export type AIResumeTailorInput = z.infer<typeof aiResumeTailorSchema>;
