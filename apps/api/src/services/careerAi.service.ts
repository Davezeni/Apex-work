/**
 * Career AI — cover letters and line-level CV rewrites.
 *
 * Ground rules (mirrors the tailor service):
 *   - The model may only rearrange/reword facts that exist in the user's
 *     resume. It may NEVER invent employers, dates, numbers or skills.
 *   - Best-effort: if Groq is unconfigured/unreachable we degrade to a
 *     deterministic letter built from the user's real facts, clearly labeled
 *     source:'fallback'. Bullet rewriting has NO fallback text (anything we
 *     could generate locally would be fake rewriting) — it returns the
 *     original text with a note instead.
 */
import { logger } from '../config/logger.js';
import { env } from '../config/env.js';
import { redis } from '../lib/redis.js';
import { createHash } from 'node:crypto';
import type { AIBulletRewriteInput, AICoverLetterInput } from '@apex-work/shared';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.3-70b-versatile';

type ChatMessage = { role: 'system' | 'user'; content: string };

async function ask(messages: ChatMessage[], maxTokens = 1_000): Promise<string> {
  if (!env.GROQ_API_KEY) throw new Error('GROQ_NOT_CONFIGURED');
  const key = `ai:career:${createHash('sha1').update(JSON.stringify(messages)).digest('hex').slice(0, 24)}`;
  const cached = await redis.get(key).catch(() => null);
  if (cached) return cached;
  const response = await fetch(GROQ_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.GROQ_API_KEY}` },
    body: JSON.stringify({ model: MODEL, messages, temperature: 0.5, max_tokens: maxTokens }),
    signal: AbortSignal.timeout(25_000),
  });
  if (!response.ok) throw new Error(`GROQ_HTTP_${response.status}`);
  const body = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  const text = body.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('GROQ_EMPTY');
  await redis.set(key, text, 'EX', 600).catch(() => undefined);
  return text;
}

function parseJson(raw: string): Record<string, unknown> {
  const clean = raw.replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
  const value = JSON.parse(clean) as unknown;
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

export interface CoverLetterResult {
  letter: string;
  words: number;
  source: 'ai' | 'fallback';
}

const TONE_HINT: Record<AICoverLetterInput['tone'], string> = {
  professional: 'Warm, formal and concise — like a strong LinkedIn message.',
  friendly: 'Friendly and human, but still professional. Short sentences.',
  confident: 'Direct and confident. Lead with the strongest relevant fact.',
};

/**
 * Cover letter from the user's REAL facts. Deterministic fallback keeps the
 * feature alive without Groq and is always clearly labeled in the UI.
 */
export async function generateCoverLetter(input: AICoverLetterInput): Promise<CoverLetterResult> {
  const targetRole = input.targetRole?.trim() || 'the role';
  try {
    const system = [
      'You write honest, specific cover letters for freelancers applying to jobs.',
      'STRICT RULES:',
      '- Use ONLY facts present in the resume JSON. Never invent employers, dates, numbers, degrees or skills.',
      '- If the resume lacks something relevant, do not mention it at all.',
      '- Reference the job description naturally; do not dump keywords.',
      '- 2 to 4 short paragraphs. No placeholders like [Company] unless the job text names the company.',
      '- Output ONLY JSON: {"letter": "<the letter text>"}.',
    ].join(' ');
    const user = JSON.stringify({
      jobDescription: input.jobDescription,
      targetRole,
      tone: TONE_HINT[input.tone],
      length: input.length === 'short' ? 'Under 150 words.' : 'About 200 words.',
      resume: input.resume,
    });
    const raw = await ask(
      [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      900,
    );
    const parsed = parseJson(raw);
    const letter = typeof parsed.letter === 'string' ? parsed.letter.trim() : '';
    if (letter.length < 80 || letter.length > 4000) throw new Error('BAD_LETTER');
    return { letter, words: letter.split(/\s+/).length, source: 'ai' };
  } catch (error) {
    logger.warn({ err: error }, 'cover letter AI failed — using factual fallback');
    return fallbackCoverLetter(input, targetRole);
  }
}

function fallbackCoverLetter(input: AICoverLetterInput, targetRole: string): CoverLetterResult {
  const { resume } = input;
  const skills = resume.skills.slice(0, 4).join(', ');
  const topJob = resume.experience[0];
  const topProject = resume.projects[0];
  const proof = topJob?.description
    ? topJob.description.trim()
    : topProject?.description?.trim() || '';
  const paragraphs = [
    `I am applying for ${targetRole}. ${
      resume.headline ? `${resume.headline.trim()} — ` : ''
    }${skills ? `my core work is ${skills}.` : 'my background fits the brief.'}`.replace(
      /\s+/g,
      ' ',
    ),
    proof ? `Recently: ${proof}` : '',
    `I can share more detail or start with a small paid trial. Thank you for your time.`,
  ].filter(Boolean);
  const letter = paragraphs.join('\n\n');
  return { letter, words: letter.split(/\s+/).length, source: 'fallback' };
}

export interface BulletRewriteResult {
  text: string;
  source: 'ai' | 'fallback';
  note?: string;
}

const MODE_PROMPT: Record<AIBulletRewriteInput['mode'], string> = {
  stronger:
    'Rewrite as one strong achievement-first CV bullet. Start with a verb. Keep every fact identical.',
  metrics:
    'Rewrite for impact. Where a number is clearly implied but unknown, insert a bracketed placeholder like [X%] or [N users] so the user fills it in. NEVER invent a concrete number.',
  shorter: 'Make it as short as possible while keeping every fact. Max 20 words.',
  english: 'Rewrite in clear, simple, professional English. Keep every fact and name identical.',
};

/**
 * Line-level rewrite of one CV bullet. No fallback text: if AI is down we
 * return the original untouched with a note so the UI can explain honestly.
 */
export async function rewriteBullet(input: AIBulletRewriteInput): Promise<BulletRewriteResult> {
  try {
    const system = [
      'You rewrite single CV bullets for freelancers.',
      MODE_PROMPT[input.mode],
      'Never invent employers, dates, numbers or skills that are not in the text.',
      'Output ONLY JSON: {"text": "<rewritten bullet>"}',
    ].join(' ');
    const user = JSON.stringify({ bullet: input.text, targetRole: input.targetRole ?? null });
    const raw = await ask(
      [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      400,
    );
    const parsed = parseJson(raw);
    const text = typeof parsed.text === 'string' ? parsed.text.trim() : '';
    if (!text || text.length > 1500) throw new Error('BAD_BULLET');
    return { text, source: 'ai' };
  } catch (error) {
    logger.warn({ err: error }, 'bullet rewrite AI failed — returning original');
    return {
      text: input.text,
      source: 'fallback',
      note: 'AI is unavailable right now — your text is unchanged. Try again shortly.',
    };
  }
}
