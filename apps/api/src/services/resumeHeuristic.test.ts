import { describe, expect, it } from 'vitest';
import {
  certificationSchema,
  educationSchema,
  parseResumeHeuristic,
  resumeSchema,
  workExperienceSchema,
} from '@apex-work/shared';

const CV = `Sara Haile - Full Stack Developer
Sara builds web platforms for Ethiopian startups with a focus on shipping fast and clean design.

Work Experience
Addis Tech
Addis Tech is a software company building logistics products for East Africa.
Full Stack Developer
March 2022 - Present
Responsibilities:
● Built the shipment dashboard with React and TypeScript.
● Reduced page load times by 40%.

Qefo Delivery
Role: Frontend Developer
Tasks:
● Built the rider tracking map with Mapbox and React.
● Link: Qefo

Technology Stack
● Frontend: React, Next.js, Tailwind CSS.
● Databases:, PostgreSQL, MySQL

Additional Contributions
● Mentored 5 junior developers.
● Led the internal design system effort.

Languages: Amharic, English
Interests: Chess, Running

Education
Addis Ababa University
BSc in Computer Science, 2015 - 2019

Certifications
AWS Certified Developer - Amazon Web Services - 2023

sara@qefo.com
+251 911 234 567
github.com/sara`;

describe('resume heuristic fallback parser', () => {
  const r = parseResumeHeuristic(CV);

  it('splits name/headline and keeps the intro paragraph as summary', () => {
    expect(r.name).toBe('Sara Haile');
    expect(r.headline).toBe('Full Stack Developer');
    expect(r.targetRole).toBe('Full Stack Developer');
    expect(r.summary).toContain('Ethiopian startups');
  });

  it('extracts the dated job with company, role, dates and description', () => {
    expect(r.experiences).toHaveLength(1);
    const e = r.experiences[0];
    expect(e?.company).toBe('Addis Tech');
    expect(e?.role).toBe('Full Stack Developer');
    expect(e?.startYear).toBe(2022);
    expect(e?.startMonth).toBe(3);
    expect(e?.endYear).toBeNull(); // Present
    expect(e?.description).toContain('shipment dashboard');
  });

  it('extracts undated Role: blocks as projects', () => {
    const titles = r.projects.map((p) => p.title);
    expect(titles).toContain('Qefo Delivery');
    const qefo = r.projects.find((p) => p.title === 'Qefo Delivery');
    expect(qefo?.description).toContain('rider tracking map');
  });

  it('extracts concrete skills (items, not categories, no trailing dots)', () => {
    expect(r.skills).toContain('React');
    expect(r.skills).toContain('Next.js');
    expect(r.skills).toContain('Tailwind CSS');
    expect(r.skills).toContain('PostgreSQL');
    expect(r.skills.some((skill) => /frontend|databases/i.test(skill))).toBe(false);
    expect(r.skills.every((skill) => !skill.endsWith('.'))).toBe(true);
  });

  it('extracts achievements, spoken languages, interests, contact', () => {
    expect(r.achievements.some((a) => a.includes('Mentored'))).toBe(true);
    expect(r.languages).toEqual(expect.arrayContaining(['Amharic', 'English']));
    expect(r.interests).toEqual(expect.arrayContaining(['Chess', 'Running']));
    expect(r.email).toBe('sara@qefo.com');
    expect(r.phone).not.toBeNull();
    expect(r.github).toBe('https://github.com/sara');
  });

  it('extracts education and certifications', () => {
    expect(r.education[0]?.school).toBe('Addis Ababa University');
    expect(r.education[0]?.degree).toContain('BSc');
    expect(r.education[0]?.startYear).toBe(2015);
    expect(r.education[0]?.endYear).toBe(2019);
    expect(r.certifications[0]?.name).toContain('AWS Certified Developer');
    expect(r.certifications[0]?.issuer).toContain('Amazon');
    expect(r.certifications[0]?.issueYear).toBe(2023);
  });

  it('heuristic output passes the exact save schemas', () => {
    expect(
      resumeSchema.safeParse({
        headline: r.headline,
        summary: r.summary,
        phone: r.phone,
        email: r.email,
        website: r.website,
        linkedin: r.linkedin,
        github: r.github,
        targetRole: r.targetRole,
        languages: r.languages,
        theme: 'classic',
        content: {
          skills: r.skills.map((name) => ({ name, level: 3 as const })),
          achievements: r.achievements,
          projects: r.projects,
        },
      }).success,
    ).toBe(true);
    for (const e of r.experiences) expect(workExperienceSchema.safeParse(e).success).toBe(true);
    for (const d of r.education) expect(educationSchema.safeParse(d).success).toBe(true);
    for (const c of r.certifications) expect(certificationSchema.safeParse(c).success).toBe(true);
  });

  it('never throws on garbage', () => {
    const junk = parseResumeHeuristic('\n\n@@@\n   \n---\n');
    expect(junk.skills).toEqual([]);
    expect(junk.experiences).toEqual([]);
  });
});
