import { logger } from '../config/logger.js';
import { env } from '../config/env.js';
import { redis } from '../lib/redis.js';
import { createHash } from 'node:crypto';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.3-70b-versatile';

type ChatMessage = { role: 'system' | 'user'; content: string };

async function ask(messages: ChatMessage[]): Promise<string> {
  if (!env.GROQ_API_KEY) throw new Error('GROQ_NOT_CONFIGURED');
  const key = `ai:resume-tailor:${createHash('sha1').update(JSON.stringify(messages)).digest('hex').slice(0, 24)}`;
  const cached = await redis.get(key).catch(() => null);
  if (cached) return cached;
  const response = await fetch(GROQ_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.GROQ_API_KEY}` },
    body: JSON.stringify({ model: MODEL, messages, temperature: 0.35, max_tokens: 1_200 }),
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

function stringList(value: unknown, max: number, length = 240): string[] {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim().slice(0, length))
        .filter(Boolean)
        .slice(0, max)
    : [];
}

export interface ResumeTailorInput {
  jobDescription: string;
  targetRole?: string;
  resume: {
    headline?: string;
    summary?: string;
    skills: string[];
    experience: { role: string; company: string; description?: string }[];
    projects: { title: string; description?: string }[];
  };
}

export interface ResumeTailorResult {
  matchScore: number;
  tailoredHeadline: string;
  tailoredSummary: string;
  experienceBullets: { role: string; company: string; bullets: string[] }[];
  keywordGaps: string[];
  recommendations: string[];
  source: 'ai' | 'fallback';
}

export async function tailorResume(input: ResumeTailorInput): Promise<ResumeTailorResult> {
  const system = `You are a truthful CV tailoring coach for an Ethiopian freelancer.
Tailor only from the resume facts. Never add an employer, metric, certification, responsibility, tool, or achievement that is not present.
You may reorder and rewrite existing facts, and identify job keywords that are missing as suggestions only.
Return ONLY JSON: {"matchScore": number 0-100, "tailoredHeadline": string, "tailoredSummary": string, "experienceBullets": [{"role": string, "company": string, "bullets": string[]}], "keywordGaps": string[], "recommendations": string[]}.
Use concise professional English. Keep the summary under 90 words, each bullet under 24 words, and recommendations practical.`;
  try {
    const raw = await ask([
      { role: 'system', content: system },
      { role: 'user', content: JSON.stringify(input) },
    ]);
    const parsed = parseJson(raw);
    const bulletRows = Array.isArray(parsed.experienceBullets) ? parsed.experienceBullets : [];
    return {
      matchScore: Math.max(0, Math.min(100, Math.round(Number(parsed.matchScore) || 0))),
      tailoredHeadline:
        typeof parsed.tailoredHeadline === 'string'
          ? parsed.tailoredHeadline.trim().slice(0, 120)
          : (input.resume.headline ?? ''),
      tailoredSummary:
        typeof parsed.tailoredSummary === 'string'
          ? parsed.tailoredSummary.trim().slice(0, 2000)
          : (input.resume.summary ?? ''),
      experienceBullets: bulletRows
        .filter((row): row is Record<string, unknown> => !!row && typeof row === 'object')
        .slice(0, 20)
        .map((row) => ({
          role: typeof row.role === 'string' ? row.role.slice(0, 120) : '',
          company: typeof row.company === 'string' ? row.company.slice(0, 120) : '',
          bullets: stringList(row.bullets, 6, 240),
        }))
        .filter((row) => row.role || row.company || row.bullets.length > 0),
      keywordGaps: stringList(parsed.keywordGaps, 12, 60),
      recommendations: stringList(parsed.recommendations, 8),
      source: 'ai',
    };
  } catch (error) {
    logger.warn(
      { err: (error as Error).message },
      'resume tailoring AI failed — using factual fallback',
    );
    const jobWords = new Set(input.jobDescription.toLowerCase().match(/[a-z][a-z+#.-]{3,}/g) ?? []);
    const stop = new Set([
      'with',
      'that',
      'this',
      'from',
      'your',
      'will',
      'have',
      'work',
      'looking',
      'need',
      'using',
      'into',
      'for',
      'and',
      'the',
    ]);
    const existing = new Set(input.resume.skills.map((skill) => skill.toLowerCase()));
    const keywordGaps = [...jobWords]
      .filter((word) => !stop.has(word) && !existing.has(word))
      .slice(0, 10);
    const overlap = [...jobWords].filter((word) => existing.has(word)).length;
    const matchScore = Math.min(
      95,
      35 +
        overlap * 10 +
        (input.resume.experience.length > 0 ? 15 : 0) +
        (input.resume.summary ? 10 : 0),
    );
    return {
      matchScore,
      tailoredHeadline: input.resume.headline ?? input.targetRole ?? '',
      tailoredSummary:
        input.resume.summary ??
        'Add a professional summary that connects your verified experience to this role.',
      experienceBullets: input.resume.experience.map((item) => ({
        role: item.role,
        company: item.company,
        bullets: (item.description ?? '')
          .split(/[\n.!?]+/)
          .map((line) => line.trim())
          .filter(Boolean)
          .slice(0, 5),
      })),
      keywordGaps,
      recommendations: [
        'Add only missing keywords you can prove with real work or training.',
        'Replace general duties with the strongest facts from each project.',
        'Save this as a named version before applying changes.',
      ],
      source: 'fallback',
    };
  }
}
