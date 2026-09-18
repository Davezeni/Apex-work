import { describe, expect, it } from 'vitest';
import {
  certificationSchema,
  educationSchema,
  resumeSchema,
  workExperienceSchema,
} from '@apex-work/shared';
import { coerceExtraction } from './resumeExtractAi.service.js';

describe('resume extraction coercion', () => {
  it('never emits a URL/email that fails the resume schema', () => {
    const junk = [
      'www.linkedin.com/in/john doe', // space -> invalid URL
      'LinkedIn: github.com/x', // label junk -> invalid port/host
      'not a url at all', // no dot in host
      'in/johndoe', // no dot in host
      'über.dev', // non-ASCII
      'github.com/a and gitlab.com/b', // two URLs merged
      'https://ok.example.com/profile?x=1', // valid — must survive
      'linkedin.com/in/john.', // trailing punctuation — cleaned
    ];
    for (const value of junk) {
      const out = coerceExtraction({ website: value, linkedin: value, github: value });
      for (const field of ['website', 'linkedin', 'github'] as const) {
        const parsed = resumeSchema.safeParse({ [field]: out[field] });
        expect(parsed.success, `${field}=${String(out[field])}`).toBe(true);
      }
    }
    expect(coerceExtraction({ website: junk[0] }).website).toBe('https://www.linkedin.com/in/johndoe'); // spaces stripped -> valid
    expect(coerceExtraction({ website: junk[2] }).website).toBeNull();
    expect(coerceExtraction({ website: junk[4] }).website).toBeNull();
    expect(coerceExtraction({ website: junk[6] }).website).toBe(
      'https://ok.example.com/profile?x=1',
    );
    expect(coerceExtraction({ website: junk[7] }).website).toBe('https://linkedin.com/in/john');
    expect(coerceExtraction({ email: 'jane at x.com' }).email).toBeNull();
    expect(coerceExtraction({ email: 'jane@x.com' }).email).toBe('jane@x.com');
  });

  it('coerced model output always satisfies the shared schemas', () => {
    const x = coerceExtraction({
      name: 'John Doe',
      headline: 'Frontend Developer',
      summary: 'I build things',
      email: 'JOHN@Example.com',
      phone: '+251 911 000 000',
      city: 'Addis Ababa',
      website: 'johndoe.dev',
      linkedin: 'linkedin.com/in/johndoe',
      github: 'github.com/johndoe',
      skills: ['React', 'react', '', 'TypeScript'],
      languages: ['English', 'Amharic'],
      achievements: ['Led a team of 5'],
      interests: ['Chess'],
      experiences: [
        {
          company: 'Acme',
          role: 'Engineer',
          location: 'Addis',
          startYear: 2021,
          startMonth: 3,
          endYear: 2024,
          endMonth: 2,
          description: 'Built things',
        },
        {
          company: 'Bad Dates',
          role: 'Eng',
          startYear: 2024,
          startMonth: 5,
          endYear: 2020,
          endMonth: 1,
        },
      ],
      education: [
        { school: 'AAU', degree: 'BSc', fieldOfStudy: 'CS', startYear: 2016, endYear: 2020 },
      ],
      certifications: [{ name: 'AWS CCP', issuer: 'Amazon', issueYear: 2022 }],
      projects: [{ title: 'Apollo', description: 'Cool project' }],
    });
    expect(x.skills).toEqual(['React', 'TypeScript']); // deduped case-insensitively
    expect(x.email).toBe('JOHN@Example.com');
    expect(x.website).toBe('https://johndoe.dev');
    expect(x.experiences[1]?.endYear).toBeNull(); // end before start -> treated as current

    const body = {
      headline: x.headline,
      summary: x.summary,
      phone: x.phone,
      email: x.email,
      city: x.city,
      website: x.website,
      linkedin: x.linkedin,
      github: x.github,
      targetRole: x.targetRole,
      languages: x.languages,
      theme: 'classic',
      content: {
        skills: x.skills.map((name) => ({ name, level: 3 as const })),
        achievements: x.achievements,
        projects: x.projects.map((p) => ({ title: p.title, description: p.description })),
      },
    };
    expect(resumeSchema.safeParse(body).success).toBe(true);
    for (const e of x.experiences) {
      expect(workExperienceSchema.safeParse(e).success).toBe(true);
    }
    for (const d of x.education) {
      expect(educationSchema.safeParse(d).success).toBe(true);
    }
    for (const c of x.certifications) {
      expect(certificationSchema.safeParse(c).success).toBe(true);
    }
  });

  it('drops non-object / wrong-typed junk without throwing', () => {
    const x = coerceExtraction({
      email: 'nope',
      website: 'javascript:alert(1)',
      skills: 'not-an-array',
      experiences: 'nope',
      education: null,
      certifications: 42,
    });
    expect(x.email).toBeNull();
    expect(x.website).toBeNull();
    expect(x.skills).toEqual([]);
    expect(x.experiences).toEqual([]);
    expect(x.education).toEqual([]);
    expect(x.certifications).toEqual([]);
  });
});
