import { describe, expect, it } from 'vitest';
import { generateCoverLetter, rewriteBullet } from './careerAi.service.js';

const baseResume = {
  skills: ['React', 'Figma'],
  experience: [{ role: 'Designer', company: 'Acme', description: 'Shipped the agent app.' }],
  projects: [],
};

describe('generateCoverLetter (no AI configured → factual fallback)', () => {
  it('builds a letter from real facts and labels it fallback', async () => {
    const result = await generateCoverLetter({
      jobDescription:
        'We are hiring a product designer to build mobile money experiences for agents across Ethiopia.',
      tone: 'professional',
      length: 'short',
      resume: baseResume,
    });
    expect(result.source).toBe('fallback');
    expect(result.words).toBeGreaterThan(5);
    expect(result.letter).toMatch(/React/);
    expect(result.letter).toMatch(/Shipped the agent app/);
  });
});

describe('rewriteBullet (no AI configured → honest no-op)', () => {
  it('returns the original text with a note instead of inventing a rewrite', async () => {
    const result = await rewriteBullet({
      text: 'Built checkout flow used by 200 vendors',
      mode: 'stronger',
    });
    expect(result.source).toBe('fallback');
    expect(result.text).toBe('Built checkout flow used by 200 vendors');
    expect(result.note).toBeTruthy();
  });
});
