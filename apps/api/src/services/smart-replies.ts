// Pure, dependency-free helpers for AI smart replies. Kept outside ai.service so
// they can be unit-tested without the config/env module (which requires env).

/** Split either a JSON array or newline/bullet-separated LLM output into reply strings. */
export function parseRepliesAnswers(out: string): string[] {
  const trimmed = out.trim();
  try {
    const arr = JSON.parse(trimmed);
    if (Array.isArray(arr)) return arr.map((s) => String(s).trim()).filter(Boolean);
  } catch {
    /* not json */
  }
  return trimmed
    .split(/\n+/)
    .map((l) => l.replace(/^\s*[-*•\d.)\s]+\s*/, '').trim())
    .filter(Boolean);
}

/** Deterministic, language-aware fallback replies when the provider is unavailable. */
export function fallbackReplies(last: string): string[] {
  const q = last.toLowerCase();
  const am = /[\u1200-\u137f]/.test(last);
  if (am) {
    if (/እንዴት|ዋጋ|ትክክል|ጊዜ/.test(last)) {
      return ['በግምት 1 ሰዓት ይወስዳል', 'እንዴት እንቀጥል?', 'ጥሩ ሃሳብ ነው'];
    }
    return ['እሺ ተረዳሁ', 'በዝርዝር ይንገሩኝ', 'በ 10 ደቂቃ እመልሳለሁ'];
  }
  if (/price|cost|fee|how much|cheaper|budget/.test(q)) {
    return ["What's your best price?", 'Can we negotiate?', 'Can you share a quote?'];
  }
  if (/when|time|ready|done|deadline|how long/.test(q)) {
    return ['I can do it in about a day', 'Let me confirm the timeline', 'I will update you shortly'];
  }
  if (/hi|hello|hey|selam|good (morning|day|evening)/.test(q)) {
    return ['Hi! How can I help?', 'Hey, good to hear from you', 'How are things going?'];
  }
  if (/\?$/.test(last.trim())) {
    return ['Good question — let me check', 'I will get back to you on that', 'Yes, that works for me'];
  }
  return ['Sounds good', 'Tell me more', 'Let me check and get back to you'];
}
