import { describe, it, expect } from 'vitest';
import { analyzeContent, maxSeverity, summarizeFlags, DEFAULT_RULES } from './moderationRules.js';

describe('analyzeContent', () => {
  it('returns no flags for clean text or empty input', () => {
    expect(analyzeContent('Just a normal gig for logo design')).toEqual([]);
    expect(analyzeContent('')).toEqual([]);
    expect(analyzeContent(null)).toEqual([]);
    expect(analyzeContent(undefined)).toEqual([]);
  });

  it('flags off-platform / scam language', () => {
    const flags = analyzeContent('Pay outside the platform, send bitcoin directly to my wallet');
    expect(flags.length).toBeGreaterThan(0);
    expect(flags[0]!.category).toBe('SCAM');
    expect(flags[0]!.severity).toBe('high');
  });

  it('matches case- and spacing-insensitively', () => {
    const flags = analyzeContent('PAY OUTSIDE');
    expect(flags.some((f) => f.matched === 'pay outside')).toBe(true);
  });

  it('collects multiple distinct rule hits', () => {
    const flags = analyzeContent('send bitcoin only, guaranteed returns, buy followers');
    const cats = flags.map((f) => f.category);
    expect(cats).toContain('SCAM');
    expect(cats).toContain('SPAM');
  });

  it('can run against a custom ruleset', () => {
    const custom = [{ id: 'x', category: 'CUSTOM', terms: ['deepfake'], severity: 'medium' as const, reason: 'custom' }];
    expect(analyzeContent('deepfake content', custom)[0]!.category).toBe('CUSTOM');
  });
});

describe('maxSeverity', () => {
  it('returns the highest severity present', () => {
    const flags = analyzeContent('pay outside, buy followers');
    expect(maxSeverity(flags)).toBe('high');
  });
  it('returns null for no flags', () => {
    expect(maxSeverity([])).toBeNull();
  });
});

describe('summarizeFlags', () => {
  it('joins categories and rule ids', () => {
    const flags = analyzeContent('send bitcoin, buy followers');
    const s = summarizeFlags(flags);
    expect(s).toContain('Auto-flagged');
    expect(s).toContain('SCAM');
    expect(s).toContain('SPAM');
  });
  it('returns empty string when nothing matched', () => {
    expect(summarizeFlags([])).toBe('');
  });
});
