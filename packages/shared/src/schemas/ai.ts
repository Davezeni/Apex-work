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
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().min(1).max(4000),
  })).min(1).max(20),
});
export type AIChatInput = z.infer<typeof aiChatSchema>;

/** AI translate gig — server calls Groq and upserts GigTranslation row. */
export const aiTranslateGigSchema = z.object({
  gigSlug: z.string().min(1).max(120),
  targetLocale: z.enum(['en', 'am']),
});
export type AITranslateGigInput = z.infer<typeof aiTranslateGigSchema>;
