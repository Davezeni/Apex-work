/**
 * Apex Resume Studio catalog. Keep these IDs stable because they are stored
 * on a user's resume and in template purchases.
 */
export const RESUME_TEMPLATE_IDS = [
  'classic',
  'modern',
  'minimal',
  'ats-clean',
  'executive',
  'creative',
  'tech-grid',
  'academic',
] as const;

export type ResumeTemplateId = (typeof RESUME_TEMPLATE_IDS)[number];

export type ResumeTemplateTier = 'free' | 'pro';

export interface ResumeTemplateDefinition {
  id: ResumeTemplateId;
  name: string;
  description: string;
  tier: ResumeTemplateTier;
  priceEtb: number;
  emoji: string;
  bestFor: string;
  features: readonly string[];
}

export const RESUME_TEMPLATES = [
  {
    id: 'classic',
    name: 'Classic ATS',
    description: 'Clean, recruiter-friendly and easy to scan.',
    tier: 'free',
    priceEtb: 0,
    emoji: '📄',
    bestFor: 'Any industry',
    features: ['ATS-friendly', 'A4 export', 'Print-ready'],
  },
  {
    id: 'modern',
    name: 'Modern Split',
    description: 'A confident two-column layout for experienced talent.',
    tier: 'free',
    priceEtb: 0,
    emoji: '◐',
    bestFor: 'Experienced freelancers',
    features: ['Two-column layout', 'Skills sidebar', 'A4 export'],
  },
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Elegant typography with generous breathing room.',
    tier: 'free',
    priceEtb: 0,
    emoji: '✦',
    bestFor: 'Design and leadership',
    features: ['Elegant spacing', 'One-page option', 'A4 export'],
  },
  {
    id: 'ats-clean',
    name: 'ATS Clean',
    description: 'Ultra-readable plain format built for online applications.',
    tier: 'free',
    priceEtb: 0,
    emoji: '✓',
    bestFor: 'Online applications',
    features: ['Maximum readability', 'US Letter export', 'Keyword-focused'],
  },
  {
    id: 'executive',
    name: 'Executive',
    description: 'A polished leadership layout with premium hierarchy.',
    tier: 'pro',
    priceEtb: 149,
    emoji: '◆',
    bestFor: 'Managers and founders',
    features: ['Premium layout', 'Accent customization', 'A4 + Letter export'],
  },
  {
    id: 'creative',
    name: 'Creative Portfolio',
    description: 'Visual storytelling for designers, creators and marketers.',
    tier: 'pro',
    priceEtb: 199,
    emoji: '✺',
    bestFor: 'Creators and designers',
    features: ['Portfolio highlights', 'Visual project cards', 'Portfolio PDF'],
  },
  {
    id: 'tech-grid',
    name: 'Tech Grid',
    description: 'A high-signal engineering format for technical careers.',
    tier: 'pro',
    priceEtb: 149,
    emoji: '</>',
    bestFor: 'Developers and data talent',
    features: ['Skills matrix', 'Project highlights', 'ATS-safe structure'],
  },
  {
    id: 'academic',
    name: 'Academic CV',
    description: 'Room for publications, teaching, awards and research.',
    tier: 'pro',
    priceEtb: 99,
    emoji: '🎓',
    bestFor: 'Researchers and academics',
    features: ['Long-form CV', 'Publications section', 'References section'],
  },
] as const satisfies readonly ResumeTemplateDefinition[];

export const RESUME_FORMATS = [
  {
    id: 'a4',
    name: 'A4 Resume',
    description: 'Standard Ethiopia / international job application PDF',
  },
  {
    id: 'letter',
    name: 'US Letter',
    description: 'North American application format',
  },
  {
    id: 'one-page',
    name: 'One-page CV',
    description: 'Compact high-signal summary',
  },
  {
    id: 'portfolio',
    name: 'Portfolio PDF',
    description: 'Resume plus selected project highlights',
  },
] as const;

export type ResumeFormatId = (typeof RESUME_FORMATS)[number]['id'];

export function resumeTemplateById(id: string): ResumeTemplateDefinition | undefined {
  return RESUME_TEMPLATES.find((template) => template.id === id);
}
