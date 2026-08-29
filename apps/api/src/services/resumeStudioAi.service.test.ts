import { describe, expect, it, vi } from 'vitest';

const { redisMock } = vi.hoisted(() => ({
  redisMock: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
  },
}));

vi.mock('../lib/redis.js', () => ({ redis: redisMock }));

import {
  generatePortfolioCaseStudy,
  reviewResume,
  suggestResumeSkills,
} from './resumeStudioAi.service.js';
import { tailorResume } from './resumeTailorAi.service.js';

describe('Resume Studio AI fallbacks', () => {
  it('scores missing resume sections without inventing facts', async () => {
    const result = await reviewResume({
      targetRole: 'Product Designer',
      headline: '',
      summary: '',
      skills: [],
      experience: [],
      projects: [],
    });

    expect(result.source).toBe('fallback');
    expect(result.score).toBe(40);
    expect(result.missingSections).toContain('Professional summary');
    expect(result.improvements.join(' ')).not.toContain('invent');
  });

  it('suggests role-aware starter skills and keeps existing skills out', async () => {
    const result = await suggestResumeSkills({
      targetRole: 'UI Designer',
      existingSkills: ['Figma'],
      summary: 'I design mobile products.',
    });

    expect(result.source).toBe('fallback');
    expect(result.skills).not.toContain('Figma');
    expect(result.skills).toContain('Design systems');
    expect(result.rationale).toContain('only skills');
  });

  it('tailors a resume using existing facts when AI is unavailable', async () => {
    const result = await tailorResume({
      jobDescription: 'We need a React developer with strong communication and project management.',
      targetRole: 'Frontend Developer',
      resume: {
        headline: 'Frontend Developer',
        summary: 'I build reliable web interfaces.',
        skills: ['React'],
        experience: [
          {
            role: 'Developer',
            company: 'Apex',
            description: 'Built dashboards and improved documentation.',
          },
        ],
        projects: [],
      },
    });

    expect(result.source).toBe('fallback');
    expect(result.tailoredHeadline).toBe('Frontend Developer');
    expect(result.experienceBullets[0]?.bullets).toContain(
      'Built dashboards and improved documentation',
    );
    expect(result.recommendations.join(' ')).toContain('only missing keywords');
  });

  it('turns portfolio facts into a safe deterministic case study', async () => {
    const result = await generatePortfolioCaseStudy({
      title: 'Cafe website',
      role: 'Frontend developer',
      tools: ['Next.js', 'Tailwind'],
      roughDescription: 'Built a responsive website for a local cafe.',
    });

    expect(result.source).toBe('fallback');
    expect(result.description).toContain('local cafe');
    expect(result.description).toContain('Frontend developer');
    expect(result.highlights).toEqual([
      'Used Next.js in the project',
      'Used Tailwind in the project',
    ]);
  });
});
