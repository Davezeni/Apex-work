import { logger } from '../config/logger.js';
import { env } from '../config/env.js';
import { redis } from '../lib/redis.js';
import { createHash } from 'node:crypto';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.3-70b-versatile';

type ChatMessage = { role: 'system' | 'user'; content: string };

async function ask(messages: ChatMessage[], maxTokens = 700): Promise<string> {
  if (!env.GROQ_API_KEY) throw new Error('GROQ_NOT_CONFIGURED');
  const key = `ai:resume-studio:${createHash('sha1').update(JSON.stringify(messages)).digest('hex').slice(0, 24)}`;
  const cached = await redis.get(key).catch(() => null);
  if (cached) return cached;
  const response = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({ model: MODEL, messages, temperature: 0.45, max_tokens: maxTokens }),
    signal: AbortSignal.timeout(25_000),
  });
  if (!response.ok) throw new Error(`GROQ_HTTP_${response.status}`);
  const body = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  const text = body.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('GROQ_EMPTY');
  await redis.set(key, text, 'EX', 600).catch(() => undefined);
  return text;
}

function jsonFromModel(raw: string): Record<string, unknown> {
  const clean = raw.replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
  const parsed = JSON.parse(clean) as unknown;
  return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
}

function strings(value: unknown, max: number, maxLength = 240): string[] {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim().slice(0, maxLength))
        .filter(Boolean)
        .slice(0, max)
    : [];
}

export interface ResumeReviewInput {
  targetRole?: string;
  headline?: string;
  summary?: string;
  skills: string[];
  experience: { role: string; company: string; description?: string }[];
  projects: { title: string; description?: string }[];
}

export interface ResumeReviewResult {
  score: number;
  strengths: string[];
  improvements: string[];
  missingSections: string[];
  keywords: string[];
  source: 'ai' | 'fallback';
}

export async function reviewResume(input: ResumeReviewInput): Promise<ResumeReviewResult> {
  const system = `You are a strict but encouraging CV coach for Ethiopian freelancers.
Review only the facts provided. Never invent experience, numbers, employers, certifications, or keywords as if they are true.
Return ONLY JSON: {"score": number 0-100, "strengths": string[], "improvements": string[], "missingSections": string[], "keywords": string[]}.
Score clarity, evidence, ATS readability, target-role alignment, and completeness. Keywords must be suggestions only.`;
  try {
    const raw = await ask(
      [
        { role: 'system', content: system },
        { role: 'user', content: JSON.stringify(input) },
      ],
      650,
    );
    const parsed = jsonFromModel(raw);
    return {
      score: Math.max(0, Math.min(100, Math.round(Number(parsed.score) || 0))),
      strengths: strings(parsed.strengths, 6),
      improvements: strings(parsed.improvements, 8),
      missingSections: strings(parsed.missingSections, 8, 80),
      keywords: strings(parsed.keywords, 12, 60),
      source: 'ai',
    };
  } catch (error) {
    logger.warn(
      { err: (error as Error).message },
      'resume review AI failed — using deterministic coach',
    );
    const missingSections: string[] = [];
    if (!input.headline?.trim()) missingSections.push('Headline');
    if (!input.summary?.trim()) missingSections.push('Professional summary');
    if (input.skills.length < 5) missingSections.push('More skills');
    if (input.experience.length === 0) missingSections.push('Work experience');
    if (input.projects.length === 0) missingSections.push('Projects');
    const score = Math.max(20, 100 - missingSections.length * 12);
    return {
      score,
      strengths: [
        input.targetRole
          ? `Your CV has a target role: ${input.targetRole}`
          : 'You have started your professional profile',
        input.experience.length > 0
          ? 'Work history is available for recruiters to scan'
          : 'Your profile is ready for more detail',
      ],
      improvements: [
        ...missingSections.map((section) => `Add a clear ${section.toLowerCase()} section`),
        'Turn responsibilities into concise achievement bullets',
        'Use the same role keywords as the job description when they are truthful',
      ].slice(0, 6),
      missingSections,
      keywords: input.targetRole ? input.targetRole.split(/\s+/).filter(Boolean).slice(0, 6) : [],
      source: 'fallback',
    };
  }
}

export async function suggestResumeSkills(input: {
  targetRole: string;
  existingSkills: string[];
  summary?: string;
}): Promise<{
  skills: string[];
  keywords: string[];
  rationale: string;
  source: 'ai' | 'fallback';
}> {
  const system = `You are a skills strategist for an Ethiopian freelancer applying for work.
Suggest only relevant skills and ATS keywords for the target role. Never claim the freelancer already has a skill.
Return ONLY JSON: {"skills": string[], "keywords": string[], "rationale": string}. Keep each list concise.`;
  try {
    const raw = await ask(
      [
        { role: 'system', content: system },
        { role: 'user', content: JSON.stringify(input) },
      ],
      450,
    );
    const parsed = jsonFromModel(raw);
    return {
      skills: strings(parsed.skills, 10, 60),
      keywords: strings(parsed.keywords, 12, 60),
      rationale: typeof parsed.rationale === 'string' ? parsed.rationale.trim().slice(0, 500) : '',
      source: 'ai',
    };
  } catch (error) {
    logger.warn(
      { err: (error as Error).message },
      'resume skill AI failed — using role suggestions',
    );
    const role = input.targetRole.toLowerCase();
    const suggestions = /design|ui|ux/.test(role)
      ? ['Figma', 'Design systems', 'User research', 'Prototyping', 'Accessibility']
      : /data|analyst|ai/.test(role)
        ? ['Data analysis', 'Python', 'SQL', 'Data visualization', 'Machine learning']
        : /market|social|content/.test(role)
          ? ['Content strategy', 'SEO', 'Social media', 'Analytics', 'Copywriting']
          : /finance|account/.test(role)
            ? ['Financial reporting', 'Excel', 'Bookkeeping', 'Budgeting', 'Data accuracy']
            : [
                'Communication',
                'Project management',
                'Problem solving',
                'Documentation',
                'Client collaboration',
              ];
    const existing = new Set(input.existingSkills.map((skill) => skill.toLowerCase()));
    return {
      skills: suggestions.filter((skill) => !existing.has(skill.toLowerCase())),
      keywords: [input.targetRole, 'results-driven', 'reliable delivery'],
      rationale: 'These are starting points. Add only skills you can confidently demonstrate.',
      source: 'fallback',
    };
  }
}

export async function generatePortfolioCaseStudy(input: {
  title: string;
  role?: string;
  tools: string[];
  roughDescription: string;
  outcome?: string;
}): Promise<{
  description: string;
  highlights: string[];
  outcome: string;
  source: 'ai' | 'fallback';
}> {
  const system = `You turn a freelancer's project facts into a persuasive portfolio case study.
Never invent metrics or claims. If an outcome is missing, say what was delivered instead of making up results.
Return ONLY JSON: {"description": string, "highlights": string[], "outcome": string}.
Use clear English; keep the description under 100 words and highlights as 3-5 short bullets.`;
  try {
    const raw = await ask(
      [
        { role: 'system', content: system },
        { role: 'user', content: JSON.stringify(input) },
      ],
      500,
    );
    const parsed = jsonFromModel(raw);
    return {
      description:
        typeof parsed.description === 'string'
          ? parsed.description.trim().slice(0, 1600)
          : input.roughDescription,
      highlights: strings(parsed.highlights, 5, 240),
      outcome:
        typeof parsed.outcome === 'string'
          ? parsed.outcome.trim().slice(0, 1200)
          : (input.outcome ?? ''),
      source: 'ai',
    };
  } catch (error) {
    logger.warn(
      { err: (error as Error).message },
      'portfolio case-study AI failed — using fallback',
    );
    return {
      description:
        `${input.roughDescription.trim()}${input.role ? ` I contributed as ${input.role}.` : ''}`.slice(
          0,
          1600,
        ),
      highlights: input.tools.slice(0, 5).map((tool) => `Used ${tool} in the project`),
      outcome: input.outcome?.trim() || 'Delivered the agreed project scope with a clear handoff.',
      source: 'fallback',
    };
  }
}
