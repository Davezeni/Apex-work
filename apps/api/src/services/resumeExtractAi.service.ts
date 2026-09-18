/**
 * AI-powered CV/resume extraction.
 *
 * A raw CV (PDF/DOCX text) is unstructured: sections have a hundred different
 * names, dates come in every format, and naive line heuristics mis-file data
 * (a skill becomes a headline, an employer becomes a project). A well-prompted
 * LLM does the *identification* step — which fact belongs to which field —
 * and this service then clamps + validates every value against the exact
 * resume schema limits so the result is always saveable.
 *
 * Accuracy rules baked into the prompt:
 *   - extract ONLY facts present in the CV (never invent)
 *   - months are 1-12 (default 1 when the CV shows only a year)
 *   - a current role has no end date
 *   - certifications are separate from education
 *   - skills are concrete (tools/technologies/languages), never sentences
 *
 * Every field is optional — the importer UI shows whatever was found.
 */
import { logger } from '../config/logger.js';
import { env } from '../config/env.js';
import { redis } from '../lib/redis.js';
import { createHash } from 'node:crypto';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.3-70b-versatile';
const MAX_INPUT_CHARS = 15_000;

export interface ExtractedExperience {
  company: string;
  role: string;
  location: string | null;
  startYear: number;
  startMonth: number;
  endYear: number | null;
  endMonth: number | null;
  description: string | null;
}
export interface ExtractedEducation {
  school: string;
  degree: string | null;
  fieldOfStudy: string | null;
  startYear: number;
  endYear: number | null;
  description: string | null;
}
export interface ExtractedCertification {
  name: string;
  issuer: string;
  issueYear: number;
  issueMonth: number | null;
}
export interface ExtractedProject {
  title: string;
  description: string | null;
}
export interface ExtractedResume {
  name: string | null;
  headline: string | null;
  targetRole: string | null;
  summary: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  website: string | null;
  linkedin: string | null;
  github: string | null;
  skills: string[];
  languages: string[];
  achievements: string[];
  interests: string[];
  experiences: ExtractedExperience[];
  education: ExtractedEducation[];
  certifications: ExtractedCertification[];
  projects: ExtractedProject[];
}

type ChatMessage = { role: 'system' | 'user'; content: string };

const SYSTEM_PROMPT = `You are a precise CV/resume data extractor. Read the CV text and return ONLY a JSON object — no markdown fences, no commentary — with EXACTLY these keys:

{"name":string|null,"headline":string|null,"targetRole":string|null,"summary":string|null,"email":string|null,"phone":string|null,"city":string|null,"website":string|null,"linkedin":string|null,"github":string|null,"skills":string[],"languages":string[],"achievements":string[],"interests":string[],"experiences":[{"company":string,"role":string,"location":string|null,"startYear":number,"startMonth":number,"endYear":number|null,"endMonth":number|null,"description":string|null}],"education":[{"school":string,"degree":string|null,"fieldOfStudy":string|null,"startYear":number,"endYear":number|null,"description":string|null}],"certifications":[{"name":string,"issuer":string,"issueYear":number,"issueMonth":number|null}],"projects":[{"title":string,"description":string|null}]}

STRICT RULES:
1. Extract ONLY facts present in the CV. Never invent or guess employers, degrees, or dates.
2. Months are integers 1-12. If the CV shows only a year, use month 1.
3. A CURRENT role ("Present", "Now") has endYear=null, endMonth=null.
4. name = the person's full name (usually near the top). headline = their professional title line (e.g. "Senior UI/UX Designer").
5. summary = the profile/summary/objective paragraph text (or null if the CV has none).
6. skills = concrete skills only (technologies, tools, programming languages, domains) — never sentences, never section headings.
7. certifications (with issuer + year) are NOT education entries. Degree programs (BSc, MSc, diploma) go in education.
8. interests/hobbies: only if the CV lists them.
9. languages = spoken/written languages (e.g. "Amharic", "English") — not programming languages.
10. Clean formatting: no bullets/dashes at the start of strings, no ALL-CAPS shouting (title-case employers/roles).
11. If the first line is "Name - Title(s)" or "Name | Title", SPLIT it: the person's name goes to name, the title part becomes headline.
12. Undated "Role:" / "Tasks:" blocks describing a product or client engagement are PROJECTS (portfolio pieces): title = the product/project name, description = what was built + tasks. Only blocks with explicit date ranges are experience entries.
13. For "Category: item, item, item" lines, extract the ITEMS after the colon (concrete skills), never the category label and never sentences.`;

async function ask(messages: ChatMessage[]): Promise<string> {
  if (!env.GROQ_API_KEY) throw new Error('GROQ_NOT_CONFIGURED');
  const key = `ai:resume-extract:${createHash('sha1').update(JSON.stringify(messages)).digest('hex').slice(0, 24)}`;
  const cached = await redis.get(key).catch(() => null);
  if (cached) return cached;
  let lastError: unknown = new Error('GROQ_UNREACHABLE');
  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 1500));
    try {
      const response = await fetch(GROQ_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.GROQ_API_KEY}` },
        body: JSON.stringify({
          model: MODEL,
          messages,
          temperature: 0.1, // extraction = facts, not creativity
          max_tokens: 4000,
          response_format: { type: 'json_object' }, // the model MUST answer with JSON
        }),
        signal: AbortSignal.timeout(45_000),
      });
      if (!response.ok) throw new Error(`GROQ_HTTP_${response.status}`);
      const body = (await response.json()) as { choices?: { message?: { content?: string } }[] };
      const text = body.choices?.[0]?.message?.content?.trim();
      if (!text) throw new Error('GROQ_EMPTY');
      await redis.set(key, text, 'EX', 600).catch(() => undefined);
      return text;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('GROQ_FAILED');
}

// ---------- defensive coercion (schema-exact clamps) ----------
const YEAR_MIN = 1950;
const YEAR_MAX = new Date().getFullYear() + 1;

function str(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const s = v
    .replace(/^[-•*\u2022]\s*/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
  return s ? s.slice(0, max) : null;
}
function urlStr(v: unknown, max = 300): string | null {
  let s = str(v, max + 40);
  if (!s) return null;
  // Model output is untrusted: strip whitespace/punctuation, prefix the scheme,
  // then REQUIRE the result to actually parse as a URL — a poisoned value must
  // become null (field omitted), never fail the whole save.
  s = s.replace(/\s+/g, '').replace(/[.,;)\]]+$/, '');
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  if (!/^[\x21-\x7E]+$/.test(s)) return null;
  try {
    const u = new URL(s);
    if ((u.protocol !== 'http:' && u.protocol !== 'https:') || !u.hostname.includes('.')) {
      return null;
    }
  } catch {
    return null;
  }
  return s.slice(0, max);
}
function emailStr(v: unknown): string | null {
  const s = str(v, 200);
  return s && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? s : null;
}
function num(v: unknown): number | null {
  const n =
    typeof v === 'number' ? v : typeof v === 'string' ? Number(v.replace(/[^0-9]/g, '')) : NaN;
  return Number.isFinite(n) ? Math.round(n) : null;
}
function year(v: unknown): number | null {
  const n = num(v);
  return n !== null && n >= YEAR_MIN && n <= YEAR_MAX ? n : null;
}
function month(v: unknown): number | null {
  const n = num(v);
  return n !== null && n >= 1 && n <= 12 ? n : null;
}
function strArr(v: unknown, maxItems: number, maxLen: number): string[] {
  if (!Array.isArray(v)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of v) {
    const s = str(item, maxLen);
    if (!s || s.length < 2) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
    if (out.length >= maxItems) break;
  }
  return out;
}
function objArr(v: unknown, maxItems: number): Record<string, unknown>[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((i): i is Record<string, unknown> => !!i && typeof i === 'object' && !Array.isArray(i))
    .slice(0, maxItems);
}
function fixUrl(v: unknown): string | null {
  const s = urlStr(v);
  try {
    if (!s) return null;
    const u = new URL(s);
    return u.hostname.includes('.') ? s.slice(0, 300) : null;
  } catch {
    return null;
  }
}

function coerce(raw: unknown): ExtractedResume {
  const o =
    raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const empty: ExtractedResume = {
    name: null,
    headline: null,
    targetRole: null,
    summary: null,
    email: null,
    phone: null,
    city: null,
    website: null,
    linkedin: null,
    github: null,
    skills: [],
    languages: [],
    achievements: [],
    interests: [],
    experiences: [],
    education: [],
    certifications: [],
    projects: [],
  };

  const experiences: ExtractedExperience[] = [];
  for (const e of objArr(o.experiences, 15)) {
    const company = str(e.company, 120);
    const role = str(e.role, 120);
    const startYear = year(e.startYear);
    if (!company || !role || startYear === null) continue;
    let endYear = year(e.endYear);
    let endMonth = month(e.endMonth);
    const startMonth = month(e.startMonth) ?? 1;
    if (endYear !== null && endMonth === null) endMonth = 12;
    // Schema invariant: end must not precede start — otherwise treat as current.
    if (
      endYear !== null &&
      endMonth !== null &&
      endYear * 12 + endMonth < startYear * 12 + startMonth
    ) {
      endYear = null;
      endMonth = null;
    }
    experiences.push({
      company,
      role,
      location: str(e.location, 120),
      startYear,
      startMonth,
      endYear,
      endMonth,
      description: str(e.description, 2000),
    });
  }

  const education: ExtractedEducation[] = [];
  for (const e of objArr(o.education, 10)) {
    const school = str(e.school, 120);
    if (!school) continue;
    const endYear = year(e.endYear);
    const startYear = year(e.startYear) ?? endYear ?? YEAR_MAX - 1;
    education.push({
      school,
      degree: str(e.degree, 120),
      fieldOfStudy: str(e.fieldOfStudy, 120),
      startYear,
      endYear,
      description: str(e.description, 1000),
    });
  }

  const certifications: ExtractedCertification[] = [];
  for (const c of objArr(o.certifications, 10)) {
    const name = str(c.name, 160);
    const issuer = str(c.issuer, 160);
    const issueYear = year(c.issueYear);
    if (!name || !issuer || issueYear === null) continue;
    certifications.push({ name, issuer, issueYear, issueMonth: month(c.issueMonth) });
  }

  const projects: ExtractedProject[] = [];
  for (const p of objArr(o.projects, 10)) {
    const title = str(p.title, 120);
    if (!title) continue;
    projects.push({ title, description: str(p.description, 1600) });
  }

  return {
    name: str(o.name, 120),
    headline: str(o.headline, 120),
    targetRole: str(o.targetRole, 120),
    summary: str(o.summary, 2000),
    email: emailStr(o.email),
    phone: str(o.phone, 40),
    city: str(o.city, 80),
    website: fixUrl(o.website),
    linkedin: fixUrl(o.linkedin),
    github: fixUrl(o.github),
    skills: strArr(o.skills, 40, 60),
    languages: strArr(o.languages, 15, 60),
    achievements: strArr(o.achievements, 20, 240),
    interests: strArr(o.interests, 10, 60),
    experiences,
    education,
    certifications,
    projects,
  };
}

/** Exposed for regression tests: raw model JSON -> saveable extraction. */
export const coerceExtraction = coerce;

function jsonFromModel(raw: string): unknown {
  const clean = raw.replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
  const start = clean.indexOf('{');
  const end = clean.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('NO_JSON');
  return JSON.parse(clean.slice(start, end + 1)) as unknown;
}

/**
 * Extract structured resume data from CV text. Throws only when the AI
 * provider is unavailable — callers fall back to heuristic parsing.
 */
export async function extractResumeData(rawText: string): Promise<ExtractedResume> {
  const text = rawText.slice(0, MAX_INPUT_CHARS);
  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: `CV text:\n"""\n${text}\n"""` },
  ];
  try {
    const raw = await ask(messages);
    return coerce(jsonFromModel(raw));
  } catch (err) {
    logger.warn({ err: (err as Error).message }, 'resume AI extraction failed');
    throw err;
  }
}

export function isAiConfigured(): boolean {
  return !!env.GROQ_API_KEY;
}
