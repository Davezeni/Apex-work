/**
 * Proactive moderation rules engine.
 *
 * `analyzeContent` scans free-text content against a declarative ruleset and
 * returns structured flags (category, matched terms, severity, suggestion).
 * Purely synchronous + dependency-free so it's trivial to unit test and to
 * run in a scan job without touching the DB. The route layer decides how to
 * persist flags (e.g. set `isFlagged`/`flaggedReason`).
 */

export type Severity = 'low' | 'medium' | 'high';

export interface ModerationRule {
  id: string;
  category: string;
  /** Lowercased substrings; a hit when any appears in the text. */
  terms: string[];
  severity: Severity;
  /** Human-readable suggestion for the moderator. */
  reason: string;
}

export interface ModerationFlag {
  ruleId: string;
  category: string;
  matched: string;
  severity: Severity;
  reason: string;
}

/** Case/timing-insensitive match on a substring. */
function hit(text: string, term: string): boolean {
  return text.includes(term.toLowerCase());
}

/**
 * Built-in ruleset covering common marketplace-abuse patterns. Keep it
 * conservative — false positives are worse than misses for an MVP — so only
 * clear-cut abuse is surfaced. Override/extend per instance if needed.
 */
export const DEFAULT_RULES: ModerationRule[] = [
  {
    id: 'scam-offline',
    category: 'SCAM',
    terms: ['pay outside', 'send bitcoin', 'bitcoin only', 'western union', 'cash app me', 'pay me directly', 'no escrow', 'off the platform'],
    severity: 'high',
    reason: 'Likely off-platform payment / scam attempt',
  },
  {
    id: 'scam-guarantee',
    category: 'SCAM',
    terms: ['guaranteed income', 'make money fast', 'get rich quick', 'no risk', 'instant wealth', 'guaranteed returns'],
    severity: 'high',
    reason: 'Unrealistic guarantee — likely a scam or spam',
  },
  {
    id: 'prohibited-cc',
    category: 'PROHIBITED',
    terms: ['credit card numbers', 'ssn', 'fullz', 'cvv', 'bank login', 'stolen account'],
    severity: 'high',
    reason: 'Sensitive credential / prohibited data exchange',
  },
  {
    id: 'prohibited-warez',
    category: 'PROHIBITED',
    terms: ['crack keygen', 'piracy', 'torrent', 'cracked software', 'account for sale'],
    severity: 'high',
    reason: 'Copyright-infringing or account-trading request',
  },
  {
    id: 'contact-info',
    category: 'CONTACT',
    terms: ['whatsapp +', 'telegram @', 'viber +', 'skype:', 'call me at', 'gmail.com', 'outlook.com', 'wechat'],
    severity: 'medium',
    reason: 'Off-platform contact details — review for policy breach',
  },
  {
    id: 'privacy-pii',
    category: 'PII',
    terms: ['full name of', 'their phone', 'their address', 'give me her number', 'leak', 'dox'],
    severity: 'high',
    reason: 'Potential personal data / doxxing request',
  },
  {
    id: 'adult',
    category: 'ADULT',
    terms: ['escort', 'onlyfans', 'nsfw', '18+ video', 'adult content'],
    severity: 'medium',
    reason: 'Adult content — may be prohibited for this marketplace',
  },
  {
    id: 'spam-repetition',
    category: 'SPAM',
    terms: ['buy followers', 'boost my post', '1000 views', 'mass dm', 'spam links'],
    severity: 'low',
    reason: 'Likely spam / growth-hacking request',
  },
];

/** Score a text against a ruleset, collecting every matching rule. */
export function analyzeContent(text: string | null | undefined, rules: ModerationRule[] = DEFAULT_RULES): ModerationFlag[] {
  if (!text) return [];
  const lower = text.toLowerCase();
  const flags: ModerationFlag[] = [];
  for (const rule of rules) {
    const matched = rule.terms.find((t) => hit(lower, t));
    if (matched) {
      flags.push({ ruleId: rule.id, category: rule.category, matched, severity: rule.severity, reason: rule.reason });
    }
  }
  return flags;
}

/** Highest severity present in a set of flags (or none). */
export function maxSeverity(flags: ModerationFlag[]): Severity | null {
  const rank: Record<Severity, number> = { low: 1, medium: 2, high: 3 };
  let best: Severity | null = null;
  for (const f of flags) {
    if (!best || rank[f.severity] > rank[best]) best = f.severity;
  }
  return best;
}

/** Join matched flags into a compact reason string (for `flaggedReason`). */
export function summarizeFlags(flags: ModerationFlag[]): string {
  if (flags.length === 0) return '';
  const cats = [...new Set(flags.map((f) => f.category))];
  return `Auto-flagged: ${cats.join(', ')} (${flags.map((f) => f.ruleId).join(', ')})`;
}
