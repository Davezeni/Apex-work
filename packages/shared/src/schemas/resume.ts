import { z } from 'zod';
import { RESUME_TEMPLATE_IDS } from '../constants/resume.js';

const currentYear = new Date().getFullYear();

const templateIdSchema = z.enum(RESUME_TEMPLATE_IDS);
const monthSchema = z.number().int().min(1).max(12);
const yearSchema = z
  .number()
  .int()
  .min(1950)
  .max(currentYear + 1);
const optionalUrl = z.string().trim().url().max(500).nullable().optional();

/** A compact, reusable skills matrix shown by premium templates. */
export const resumeSkillSchema = z.object({
  name: z.string().trim().min(1).max(60),
  level: z.number().int().min(1).max(5).default(3),
  years: z.number().min(0).max(60).nullable().optional(),
});
export type ResumeSkillInput = z.output<typeof resumeSkillSchema>;

/** A project/case-study card that can be rendered in a resume or portfolio PDF. */
export const resumeProjectSchema = z.object({
  id: z.string().trim().max(80).optional(),
  title: z.string().trim().min(2).max(120),
  role: z.string().trim().max(120).nullable().optional(),
  description: z.string().trim().max(1600).nullable().optional(),
  url: optionalUrl,
  technologies: z.array(z.string().trim().min(1).max(40)).max(15).default([]),
  highlights: z.array(z.string().trim().min(2).max(240)).max(8).default([]),
  startYear: yearSchema.nullable().optional(),
  endYear: yearSchema.nullable().optional(),
});
export type ResumeProjectInput = z.output<typeof resumeProjectSchema>;

export const resumeVolunteerSchema = z.object({
  organization: z.string().trim().min(2).max(120),
  role: z.string().trim().max(120).nullable().optional(),
  description: z.string().trim().max(800).nullable().optional(),
  startYear: yearSchema.nullable().optional(),
  endYear: yearSchema.nullable().optional(),
});
export type ResumeVolunteerInput = z.output<typeof resumeVolunteerSchema>;

export const resumeReferenceSchema = z.object({
  name: z.string().trim().min(2).max(120),
  role: z.string().trim().max(120).nullable().optional(),
  company: z.string().trim().max(120).nullable().optional(),
  email: z.string().trim().email().max(200).nullable().optional(),
  phone: z.string().trim().max(40).nullable().optional(),
});
export type ResumeReferenceInput = z.output<typeof resumeReferenceSchema>;

/**
 * Expandable content beyond the original basics/experience/education fields.
 * Kept in one validated JSON document so new Studio sections do not require a
 * database migration every time a freelancer adds a new type of achievement.
 */
export const resumeContentSchema = z.object({
  skills: z.array(resumeSkillSchema).max(40).default([]),
  projects: z.array(resumeProjectSchema).max(20).default([]),
  achievements: z.array(z.string().trim().min(2).max(240)).max(20).default([]),
  volunteer: z.array(resumeVolunteerSchema).max(10).default([]),
  publications: z.array(z.string().trim().min(2).max(300)).max(20).default([]),
  references: z.array(resumeReferenceSchema).max(5).default([]),
  /// Latest AI-generated cover letter (optional; per-job letters live with the user).
  coverLetter: z.string().max(8000).nullable().optional(),
});
export type ResumeContent = z.output<typeof resumeContentSchema>;

/**
 * Resume / CV — a structured version of a freelancer's professional history.
 * The new Studio fields are optional so all existing resumes remain valid.
 */
export const resumeSchema = z.object({
  headline: z.string().trim().max(120).nullable().optional(),
  summary: z.string().trim().max(2000).nullable().optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  email: z.string().trim().email().max(200).nullable().optional(),
  city: z.string().trim().max(80).nullable().optional(),
  website: z.string().trim().url().max(300).nullable().optional(),
  linkedin: z.string().trim().url().max(300).nullable().optional(),
  github: z.string().trim().url().max(300).nullable().optional(),
  targetRole: z.string().trim().max(120).nullable().optional(),
  accentColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .nullable()
    .optional(),
  templateId: templateIdSchema.optional(),
  content: resumeContentSchema.optional(),
  isPublic: z.boolean().optional(),
  languages: z.array(z.string().trim().max(60)).max(15).default([]),
  /** Legacy field retained for older clients; Studio maps it to templateId. */
  theme: z.string().trim().max(60).optional(),
});
export type ResumeInput = z.infer<typeof resumeSchema>;

export const resumeTemplateSelectSchema = z.object({
  templateId: templateIdSchema,
});
export type ResumeTemplateSelectInput = z.infer<typeof resumeTemplateSelectSchema>;

export const resumeTemplateVerifySchema = z.object({
  purchaseId: z.string().trim().min(10).max(80),
});
export type ResumeTemplateVerifyInput = z.infer<typeof resumeTemplateVerifySchema>;

export const workExperienceSchema = z
  .object({
    company: z.string().trim().min(1).max(120),
    role: z.string().trim().min(1).max(120),
    location: z.string().trim().max(120).nullable().optional(),
    startYear: yearSchema,
    startMonth: monthSchema,
    endYear: yearSchema.nullable().optional(),
    endMonth: monthSchema.nullable().optional(),
    description: z.string().trim().max(2000).nullable().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.endYear && v.endMonth) {
      const s = v.startYear * 12 + v.startMonth;
      const e = v.endYear * 12 + v.endMonth;
      if (e < s) {
        ctx.addIssue({ code: 'custom', path: ['endYear'], message: 'End must be after start' });
      }
    }
  });
export type WorkExperienceInput = z.infer<typeof workExperienceSchema>;

export const educationSchema = z.object({
  school: z.string().trim().min(1).max(120),
  degree: z.string().trim().max(120).nullable().optional(),
  fieldOfStudy: z.string().trim().max(120).nullable().optional(),
  startYear: yearSchema,
  endYear: yearSchema.nullable().optional(),
  description: z.string().trim().max(1000).nullable().optional(),
});
export type EducationInput = z.infer<typeof educationSchema>;

export const certificationSchema = z.object({
  name: z.string().trim().min(1).max(160),
  issuer: z.string().trim().min(1).max(160),
  issueYear: yearSchema,
  issueMonth: monthSchema.nullable().optional(),
  credentialUrl: z.string().trim().url().max(300).nullable().optional(),
});
export type CertificationInput = z.infer<typeof certificationSchema>;

/**
 * Whole-CV import (file upload → structured replace). One atomic endpoint
 * instead of N row calls: in 'replace' mode the server wipes the existing
 * experiences/education/certifications inside a transaction and inserts the
 * imported ones, so a new CV upload fully overrides the old one and can
 * never leave a half-imported state.
 */
export const resumeImportSchema = z.object({
  mode: z.enum(['replace', 'merge']).default('replace'),
  profile: resumeSchema.optional(),
  experiences: z.array(workExperienceSchema).max(15).default([]),
  education: z.array(educationSchema).max(10).default([]),
  certifications: z.array(certificationSchema).max(10).default([]),
});
export type ResumeImportInput = z.infer<typeof resumeImportSchema>;

/** AI CV extraction — raw CV text (from paste or a parsed file) in, structured data out. */
export const extractResumeTextSchema = z.object({
  text: z.string().trim().min(20).max(20_000),
});
export type ExtractResumeTextInput = z.infer<typeof extractResumeTextSchema>;

/** AI resume enhance — freelancer sends raw text; model returns polished bullets. */
export const enhanceResumeSchema = z.object({
  section: z.enum(['summary', 'experience', 'education']),
  text: z.string().trim().min(10).max(4000),
});
export type EnhanceResumeInput = z.infer<typeof enhanceResumeSchema>;
