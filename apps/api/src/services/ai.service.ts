/**
 * AI service — wraps the Groq LLM API (free tier, ~500 tokens/sec on
 * llama-3.1-70b) and OpenAI Whisper for voice transcription (also free
 * via Groq's Whisper endpoint).
 *
 * Design goals:
 *   - Every call is best-effort. If Groq is misconfigured or over quota,
 *     fall back to the deterministic local generator so the UX doesn't
 *     break. Log the failure loudly for the operator.
 *   - Never leak API keys to the client; every AI call is proxied through
 *     the API server, rate-limited, and authed.
 *   - Cache identical prompts for 10 min in Redis to save quota.
 */
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { redis } from '../lib/redis.js';
import { createHash } from 'node:crypto';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_TRANSCRIBE_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';
// Fast + free model that follows instructions well and knows Amharic context.
const DEFAULT_MODEL = 'llama-3.3-70b-versatile';
const WHISPER_MODEL = 'whisper-large-v3-turbo';

function isConfigured(): boolean {
  return !!env.GROQ_API_KEY;
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

async function callGroq(
  messages: ChatMessage[],
  opts: { model?: string; temperature?: number; maxTokens?: number } = {},
): Promise<string> {
  if (!isConfigured()) throw new Error('GROQ_NOT_CONFIGURED');

  const key = 'ai:groq:' + createHash('sha1').update(JSON.stringify({ messages, ...opts })).digest('hex').slice(0, 24);
  const cached = await redis.get(key).catch(() => null);
  if (cached) return cached;

  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: opts.model ?? DEFAULT_MODEL,
      messages,
      temperature: opts.temperature ?? 0.7,
      max_tokens: opts.maxTokens ?? 800,
    }),
    // Ensure we never hang forever on a slow provider.
    signal: AbortSignal.timeout(25_000),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    logger.warn({ status: res.status, txt: txt.slice(0, 300) }, 'Groq request failed');
    throw new Error(`GROQ_HTTP_${res.status}`);
  }

  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const out = json.choices?.[0]?.message?.content?.trim() ?? '';
  if (!out) throw new Error('GROQ_EMPTY');

  // Cache for 10 minutes — identical prompts return the same result cheaply.
  await redis.set(key, out, 'EX', 600).catch(() => undefined);
  return out;
}

// ---------------- PROPOSAL WRITER ----------------

export async function generateProposal(input: {
  jobDescription: string;
  name?: string;
  skills?: string;
  tone: 'friendly' | 'professional' | 'confident';
}): Promise<{ text: string; source: 'ai' | 'fallback' }> {
  const system = `You are a world-class freelance-proposal writer for Ethiopian freelancers on Apex-Work.
Write in ENGLISH by default, but if the job description looks Amharic, respond in Amharic.
Never invent credentials the freelancer didn't claim. Never quote a specific price unless one is given.
Structure: warm 1-sentence opener → 2-3 bullets showing you understood the ask → a 3-step plan → close with a soft CTA.
Keep it under 220 words. Use plain Markdown (dashes for bullets).`;

  const user = `Job description:
"""
${input.jobDescription}
"""
Freelancer name: ${input.name ?? '(not provided)'}
Freelancer key skills: ${input.skills ?? '(not provided)'}
Tone: ${input.tone}

Write a proposal to send this client.`;

  try {
    const text = await callGroq(
      [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      { temperature: 0.75, maxTokens: 500 },
    );
    return { text, source: 'ai' };
  } catch (err) {
    logger.warn({ err: (err as Error).message }, 'proposal AI failed — using fallback');
    return { text: fallbackProposal(input), source: 'fallback' };
  }
}

function fallbackProposal(i: { jobDescription: string; name?: string; skills?: string; tone: string }): string {
  const name = i.name || 'there';
  const skills = i.skills?.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 4).join(', ') || '';
  return `Hi ${name === 'there' ? 'there' : name}! 👋

I read your brief and this looks like a great fit for me. Here's what I understood:
- You need someone reliable, fast, and detail-oriented
- Delivery quality matters more than the cheapest bid
- A quick kickoff and clear communication throughout

My approach:
1. 30-min discovery call to lock scope
2. First deliverable in 3 days for early feedback
3. Refinements + polish, then final handover

${skills ? `I'll rely on my strengths in ${skills}.\n\n` : ''}Ready to start today if this looks right. What time works for a quick chat?

Best,
${i.name ?? '—'}`;
}

// ---------------- BRIEF GENERATOR ----------------

export async function generateBrief(idea: string): Promise<{
  title: string;
  description: string;
  skills: string[];
  budgetMinEtb: number;
  budgetMaxEtb: number;
  source: 'ai' | 'fallback';
}> {
  const system = `You turn a client's rough idea into a well-structured freelance JOB POST for Ethiopian freelancers.
Return ONLY valid JSON matching this shape, no prose:
{ "title": string (10-100 chars), "description": string (150-800 chars, plain text with bullet points via "- "), "skills": string[] (3-8 slugs like "react", "amharic-copy"), "budgetMinEtb": number, "budgetMaxEtb": number }
Budgets should be realistic for Ethiopia in ETB (100-500,000 range). Never mention you're an AI.`;

  try {
    const raw = await callGroq(
      [
        { role: 'system', content: system },
        { role: 'user', content: idea },
      ],
      { temperature: 0.5, maxTokens: 600 },
    );
    // Strip markdown fences if the model added them.
    const clean = raw.replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
    const parsed = JSON.parse(clean);
    return {
      title: String(parsed.title ?? '').slice(0, 140),
      description: String(parsed.description ?? '').slice(0, 6000),
      skills: Array.isArray(parsed.skills)
        ? parsed.skills.slice(0, 10).map((s: unknown) => String(s).trim().toLowerCase().slice(0, 40))
        : [],
      budgetMinEtb: Math.max(100, Math.min(500_000, Number(parsed.budgetMinEtb) || 3000)),
      budgetMaxEtb: Math.max(100, Math.min(500_000, Number(parsed.budgetMaxEtb) || 15_000)),
      source: 'ai',
    };
  } catch (err) {
    logger.warn({ err: (err as Error).message }, 'brief AI failed — using fallback');
    return { ...fallbackBrief(idea), source: 'fallback' };
  }
}

function fallbackBrief(idea: string) {
  const lower = idea.toLowerCase();
  const cat =
    /app|mobile|ios|android/.test(lower) ? { skills: ['react-native', 'flutter', 'firebase'], min: 15_000, max: 60_000 }
      : /website|landing|next|react/.test(lower) ? { skills: ['nextjs', 'tailwind', 'typescript'], min: 8000, max: 30_000 }
      : /logo|brand|design|figma/.test(lower) ? { skills: ['figma', 'ui-design', 'branding'], min: 3000, max: 12_000 }
      : /video|reel|tiktok/.test(lower) ? { skills: ['video-editing', 'premiere', 'motion-graphics'], min: 3000, max: 10_000 }
      : /translate|write|blog|seo/.test(lower) ? { skills: ['copywriting', 'seo', 'amharic'], min: 2000, max: 8000 }
      : { skills: ['communication', 'time-management'], min: 3000, max: 12_000 };
  return {
    title: (idea.length > 100 ? idea.slice(0, 97) + '…' : idea).replace(/^i (need|want)/i, 'Looking for someone to'),
    description: `${idea}\n\nDeliverables:\n- Quality work on time\n- Regular progress updates\n- Post-delivery support`,
    skills: cat.skills,
    budgetMinEtb: cat.min,
    budgetMaxEtb: cat.max,
  };
}

// ---------------- RESUME ENHANCE ----------------

export async function enhanceResume(section: 'summary' | 'experience' | 'education', text: string): Promise<{ text: string; source: 'ai' | 'fallback' }> {
  const system =
    section === 'summary'
      ? `You rewrite a freelancer's ABOUT/SUMMARY section for their CV. Keep it 2-4 sentences, first person, warm but confident. Never invent facts. English by default; Amharic if the input is Amharic.`
      : section === 'experience'
        ? `You rewrite a job DESCRIPTION for a CV/resume as 3-5 punchy achievement bullets (each starting with a strong verb). Never invent numbers. Return bullets separated by newlines, each starting with "- ".`
        : `You rewrite an EDUCATION entry description for a CV as 1-3 short bullets highlighting relevant coursework or achievements.`;
  try {
    const out = await callGroq(
      [
        { role: 'system', content: system },
        { role: 'user', content: text },
      ],
      { temperature: 0.4, maxTokens: 350 },
    );
    return { text: out, source: 'ai' };
  } catch {
    return { text, source: 'fallback' };
  }
}

// ---------------- CHAT ASSISTANT ----------------

const HELP_SYSTEM = `You are Apex, the in-app help assistant for Apex-Work — Ethiopia's freelance marketplace (Fiverr + Upwork + LinkedIn + Telegram in one).

Product facts (ONLY answer with these):
- 10% platform fee on completed orders (lower than Fiverr's 20%).
- Payments via Chapa (Telebirr, CBE Birr, cards). Withdrawals go to Telebirr/CBE Birr/major Ethiopian banks. Minimum withdrawal 100 ETB.
- Escrow: client's payment is held until they accept delivery, or auto-released 7 days after delivery.
- Two sides: clients HIRE freelancers via Gigs (fixed price) or Jobs (bid-based). Freelancers can send custom offers in chat.
- Fully bilingual English + አማርኛ; UI toggle in Settings → Language.
- Voice messages, voice search, and voice-to-text via Whisper.
- Passkeys (biometric) + 6-digit PIN + trusted devices for fast sign-in.
- Verified badge = both phone and ID verified.
- Report a user from their profile menu or the chat header.
- Free to join. No monthly fees. No listing fees.

Style: be warm, concise (under 120 words), and always answer in the SAME LANGUAGE as the user. Use "we" for Apex-Work.
If the user asks something outside these facts, say briefly that you don't have that info and suggest they email support@apex-work.com or Telegram @apex_work_support.`;

export async function chatAssistant(history: { role: 'user' | 'assistant'; content: string }[]): Promise<{ text: string; source: 'ai' | 'fallback' }> {
  try {
    const text = await callGroq(
      [{ role: 'system', content: HELP_SYSTEM }, ...history],
      { temperature: 0.4, maxTokens: 400 },
    );
    return { text, source: 'ai' };
  } catch {
    const last = history[history.length - 1]?.content ?? '';
    return {
      text: `I'm having trouble reaching my brain right now — please try again in a moment. Meanwhile you can email support@apex-work.com. (You asked: "${last.slice(0, 120)}")`,
      source: 'fallback',
    };
  }
}

// ---------------- GIG TRANSLATION ----------------

export async function translateGig(sourceTitle: string, sourceDescription: string, targetLocale: 'en' | 'am'): Promise<{
  title: string; description: string; source: 'ai' | 'fallback';
}> {
  const languageName = targetLocale === 'am' ? 'Amharic (አማርኛ)' : 'English';
  const system = `You are a professional translator. Translate the JSON below into ${languageName}.
Preserve any HTML tags in the description exactly (don't translate tag names).
Preserve numbers, brand names, and prices. Keep the tone natural and marketing-friendly.
Return ONLY a valid JSON object of shape { "title": string, "description": string }. No prose.`;

  const user = JSON.stringify({ title: sourceTitle, description: sourceDescription });

  try {
    const raw = await callGroq(
      [{ role: 'system', content: system }, { role: 'user', content: user }],
      { temperature: 0.3, maxTokens: 2000 },
    );
    const clean = raw.replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
    const parsed = JSON.parse(clean);
    return {
      title: String(parsed.title ?? sourceTitle).slice(0, 200),
      description: String(parsed.description ?? sourceDescription).slice(0, 8000),
      source: 'ai',
    };
  } catch (err) {
    logger.warn({ err: (err as Error).message }, 'translate failed — fallback returns source');
    return { title: sourceTitle, description: sourceDescription, source: 'fallback' };
  }
}

// ---------------- TRANSCRIPTION ----------------

export async function transcribeAudioUrl(audioUrl: string, language?: string): Promise<{ text: string; source: 'ai' | 'fallback' }> {
  if (!isConfigured()) return { text: '', source: 'fallback' };
  try {
    // Fetch the audio bytes from Supabase → forward to Groq's Whisper endpoint.
    const audioRes = await fetch(audioUrl, { signal: AbortSignal.timeout(15_000) });
    if (!audioRes.ok) throw new Error(`AUDIO_FETCH_${audioRes.status}`);
    const buf = await audioRes.arrayBuffer();
    const form = new FormData();
    form.append('file', new Blob([buf], { type: audioRes.headers.get('content-type') ?? 'audio/webm' }), 'voice.webm');
    form.append('model', WHISPER_MODEL);
    if (language) form.append('language', language);
    form.append('response_format', 'json');

    const res = await fetch(GROQ_TRANSCRIBE_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.GROQ_API_KEY}` },
      body: form,
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`WHISPER_HTTP_${res.status}`);
    const json = (await res.json()) as { text?: string };
    return { text: (json.text ?? '').trim(), source: 'ai' };
  } catch (err) {
    logger.warn({ err: (err as Error).message }, 'transcription failed');
    return { text: '', source: 'fallback' };
  }
}
