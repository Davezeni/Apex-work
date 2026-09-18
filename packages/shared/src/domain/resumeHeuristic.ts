/**
 * Deterministic fallback CV parser (no AI, no deps).
 *
 * Used when the AI extractor is unavailable (missing key, provider outage,
 * timeout). It will never match the AI at identification, but it handles the
 * common real-world CV shapes decently:
 *
 *   - first line "Name - Title" / "Name | Title"  -> name + headline
 *   - intro paragraph before the first heading     -> summary
 *   - "Work Experience" section with date ranges   -> experience entries
 *     (company = nearest short line above the role, role = line above the
 *      date, description = bullets after the date)
 *   - "Role:" / "Tasks:" blocks without dates      -> project entries
 *   - "Technology Stack" / "Skills" / "Core
 *     Competencies" incl. "Category: a, b, c" lines -> flat skill list
 *   - Education / Certifications / Achievements /
 *     Languages / Hobbies sections                  -> their fields
 *   - email / phone / LinkedIn / GitHub / URLs       -> contact fields
 *
 * Every value is clamped to the same limits the resume schema enforces, so
 * the output is always saveable.
 */

export interface HeuristicExperience {
  company: string;
  role: string;
  location: string | null;
  startYear: number;
  startMonth: number;
  endYear: number | null;
  endMonth: number | null;
  description: string | null;
}
export interface HeuristicEducation {
  school: string;
  degree: string | null;
  fieldOfStudy: string | null;
  startYear: number;
  endYear: number | null;
  description: string | null;
}
export interface HeuristicCertification {
  name: string;
  issuer: string;
  issueYear: number;
  issueMonth: number | null;
}
export interface HeuristicProject {
  title: string;
  description: string | null;
}
export interface HeuristicResume {
  name: string | null;
  headline: string | null;
  targetRole: string | null;
  summary: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  website: string | null;
  linkedin: string | null;
  github: string | null;
  skills: string[];
  languages: string[];
  achievements: string[];
  interests: string[];
  experiences: HeuristicExperience[];
  education: HeuristicEducation[];
  certifications: HeuristicCertification[];
  projects: HeuristicProject[];
}

const LIMITS = {
  name: 120,
  headline: 120,
  targetRole: 120,
  summary: 2000,
  email: 200,
  phone: 40,
  city: 80,
  url: 300,
  skill: 60,
  language: 60,
  achievement: 240,
  experienceDesc: 2000,
  educationDesc: 1000,
  cert: 160,
  projectTitle: 120,
  projectDesc: 1600,
};

const YEAR_MIN = 1950;
const YEAR_MAX = new Date().getFullYear() + 1;

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

const BULLET = /^[\u2022\-*·◦‣▪○●]\s*/;

function clampStr(v: string | undefined | null, max: number): string | null {
  if (!v) return null;
  const s = v.replace(BULLET, '').replace(/\s+/g, ' ').trim().slice(0, max);
  return s.length > 0 ? s : null;
}

function dedupe(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const key = item.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(item);
    }
  }
  return out;
}

function parseMonth(token: string): number | null {
  const m = token.toLowerCase().slice(0, 3);
  if (m in MONTHS) return MONTHS[m] ?? null;
  const n = Number(token);
  return n >= 1 && n <= 12 ? Math.round(n) : null;
}

/** "January 2021 - Present" / "Jan 2019 – Dec 2020" / "2018-2020" / "2019 to 2021" */
const DATE_RANGE =
  /\b([A-Za-z]{3,9}\.?|\d{1,2})\s+(\d{4})\s*(?:-|–|—|to|until)\s*(Present|Now|Current|[A-Za-z]{3,9}\.?|\d{1,2})\s*(\d{4})?\b/i;
const YEAR_RANGE = /\b(19\d{2}|20\d{2})\s*(?:-|–|—|to)\s*(19\d{2}|20\d{2}|Present|Now)\b/i;

function rangeFrom(
  text: string,
): { startYear: number; startMonth: number; endYear: number | null; endMonth: number | null } | null {
  const m = text.match(DATE_RANGE);
  if (m) {
    const startMonth = parseMonth(m[1] ?? '');
    const startYear = Number(m[2]);
    const endToken = (m[3] ?? '').toLowerCase();
    const endYear = /present|now|current/.test(endToken) ? null : Number(m[4] ?? NaN);
    if (startMonth && startYear >= YEAR_MIN && startYear <= YEAR_MAX && (endYear === null || (endYear >= YEAR_MIN && endYear <= YEAR_MAX))) {
      const endMonth = endYear === null ? null : parseMonth(m[3] ?? '') ?? 12;
      return { startYear, startMonth, endYear, endMonth };
    }
  }
  const y = text.match(YEAR_RANGE);
  if (y) {
    const startYear = Number(y[1]);
    const endRaw = (y[2] ?? '').toLowerCase();
    const endYear = /present|now/.test(endRaw) ? null : Number(endRaw);
    if (startYear >= YEAR_MIN && startYear <= YEAR_MAX && (endYear === null || (endYear >= YEAR_MIN && endYear <= YEAR_MAX))) {
      return { startYear, startMonth: 1, endYear, endMonth: endYear === null ? null : 12 };
    }
  }
  return null;
}

const HEADING_RE =
  /^(work experience|professional experience|experience|employment( history)?|education( & training)?|academic background|projects?|portfolio|selected projects|technology stack|tech stack|technical skills|core competencies|competencies|skills( & tools)?|summary( of qualifications)?|profile|about me?|objective|certifications?|licenses?|achievements?|awards|additional contributions|contributions|languages|hobbies( & interests)?|interests|volunteer( work|ing)?|references|publications)\s*:?\s*$/i;

/** Section keys we care about, mapped from heading text. */
function headingKey(line: string): string | null {
  const l = line.replace(/:$/, '').trim().toLowerCase();
  if (/^(work experience|professional experience|experience|employment( history)?|career history)$/.test(l)) return 'experience';
  if (/^(education( & training)?|academic background|academics)$/.test(l)) return 'education';
  if (/^(projects?|portfolio|selected projects)$/.test(l)) return 'projects';
  if (/^(technology stack|tech stack|technical skills|core competencies|competencies|skills( & tools)?|areas of expertise)$/.test(l)) return 'skills';
  if (/^(summary( of qualifications)?|profile|about me?|objective)$/.test(l)) return 'summary';
  if (/^(certifications?|licenses?|certificates)$/.test(l)) return 'certifications';
  if (/^(achievements?|awards|additional contributions|contributions|key achievements)$/.test(l)) return 'achievements';
  if (/^languages$/.test(l)) return 'languages';
  if (/^(hobbies( & interests)?|interests)$/.test(l)) return 'interests';
  return null;
}

interface Section {
  key: string;
  lines: string[];
}

function splitSections(lines: string[]): { sections: Section[]; headingIndexes: Set<number> } {
  const sections: Section[] = [];
  const headingIndexes = new Set<number>();
  let current: Section | null = null;
  lines.forEach((line, index) => {
    const key = headingKey(line);
    if (key) {
      headingIndexes.add(index);
      current = { key, lines: [] };
      sections.push(current);
      return;
    }
    if (!current) {
      current = { key: 'preamble', lines: [] };
      sections.push(current);
    }
    current.lines.push(line);
  });
  return { sections, headingIndexes };
}

function cleanContact(text: string): {
  email: string | null;
  phone: string | null;
  website: string | null;
  linkedin: string | null;
  github: string | null;
} {
  const emailMatch = text.match(/[^\s<>,;"']+@[^\s<>,;"']+\.[^\s<>,;"']{2,}/);
  let email = clampStr(emailMatch?.[0], LIMITS.email);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) email = null;

  const phoneMatch = text.match(/(?:\+?251|0)[\s-]?9\d[\s-]?\d{3}[\s-]?\d{3,4}/) ||
    text.match(/(?:\+?\d{1,3}[\s-]?)?\d{3}[\s-]?\d{3}[\s-]?\d{3,4}/);
  let phone = clampStr(phoneMatch?.[0], LIMITS.phone);
  if (phone && phone.replace(/\D/g, '').length < 7) phone = null;

  const bareProfile = dedupe(
    (text.match(/\b(?:linkedin\.com|github\.com)\/[^\s|)<>\]]+/gi) ?? []).map((u) => `https://${u.replace(/[.,;)\]]+$/, '')}`),
  );
  const urls = [...bareProfile, ...(text.match(/\b(?:https?:\/\/|www\.)[^\s|)<>\]]+/gi) ?? [])]
    .map((u) => u.replace(/[.,;)\]]+$/, '').trim())
    .map((u) => {
      const full = /^https?:\/\//i.test(u) ? u : `https://${u}`;
      try {
        new URL(full);
        return full.slice(0, LIMITS.url);
      } catch {
        return null;
      }
    })
    .filter((u): u is string => !!u);
  const uniqueUrls = dedupe(urls);
  const linkedin = uniqueUrls.find((u) => /linkedin\./i.test(u)) ?? null;
  const github = uniqueUrls.find((u) => /github\./i.test(u)) ?? null;
  const website = uniqueUrls.find((u) => u !== linkedin && u !== github) ?? null;
  return { email, phone, website, linkedin, github };
}

/** "Category: a, b, c" / "Languages: JavaScript, Python" -> items */
function splitSkillLine(line: string): string[] {
  const cleaned = line.replace(BULLET, '').trim();
  const toItems = (chunk: string): string[] =>
    chunk
      .split(/[,|·;/]| {2,}/)
      .map((item) => clampStr(item.replace(/\([^)]*\)/g, '').replace(/\.+$/, ''), LIMITS.skill))
      .filter((item): item is string => !!item && item.length >= 2 && item.split(/\s+/).length <= 4);
  const labeled = cleaned.match(/^([A-Za-z][A-Za-z0-9 /&+.#-]{1,40}?)\s*:\s*(.+)$/);
  if (labeled) {
    const items = toItems(labeled[2] ?? '');
    if (items.length > 0) return items;
  }
  return toItems(cleaned).filter((item) => !item.includes(':'));
}

function looksLikeShortName(line: string): boolean {
  const s = line.trim();
  return (
    s.length >= 2 &&
    s.length <= 48 &&
    !BULLET.test(s) &&
    !/[.]$/.test(s) &&
    !/\d{4}/.test(s) &&
    !/:$/.test(s) &&
    !/^role\s*:/i.test(s) &&
    !/^tasks?\s*:/i.test(s) &&
    !/^responsibilities\s*:/i.test(s)
  );
}

export function parseResumeHeuristic(raw: string): HeuristicResume {
  const text = raw.replace(/\r/g, '');
  const lines = text
    .split('\n')
    .map((line) => line.replace(/\s+$/g, '').trim())
    .filter((line) => line.length > 0);
  const { sections, headingIndexes } = splitSections(lines);
  const get = (key: string): Section | undefined => sections.find((s) => s.key === key);
  const contact = cleanContact(text);

  // ---- name + headline: first line "Name - Title" / "Name | Title" ----
  let name: string | null = null;
  let headline: string | null = null;
  const first = lines[0] ?? '';
  const nameSplit = first.match(/^(.{3,60}?)\s+[-\u2013\u2014|]\s+(.{2,})$/);
  if (nameSplit) {
    const candidate = clampStr(nameSplit[1], LIMITS.name);
    if (candidate && candidate.split(/\s+/).length <= 5 && !/\d/.test(candidate)) {
      name = candidate;
      headline = clampStr(nameSplit[2], LIMITS.headline);
    }
  }
  if (!headline) headline = clampStr(first, LIMITS.headline);

  // ---- summary: labeled section, else intro paragraph before first heading ----
  let summary: string | null = null;
  const summarySection = get('summary');
  if (summarySection && summarySection.lines.length > 0) {
    summary = clampStr(summarySection.lines.join(' '), LIMITS.summary);
  } else {
    const preamble = get('preamble');
    if (preamble) {
      const introLines = preamble.lines.filter((line) => line !== first && line.length > 40).slice(0, 4);
      summary = clampStr(introLines.join(' '), LIMITS.summary);
    }
  }

  // ---- skills ----
  let skills: string[] = [];
  const skillsSection = get('skills');
  if (skillsSection) {
    for (const line of skillsSection.lines) {
      if (HEADING_RE.test(line)) continue;
      skills.push(...splitSkillLine(line));
    }
  }
  skills = dedupe(skills.filter((s) => s.length >= 2 && s.length <= LIMITS.skill)).slice(0, 40);

  // ---- spoken languages ----
  let spoken: string[] = [];
  const langSection = get('languages');
  if (langSection) {
    for (const line of langSection.lines) spoken.push(...splitSkillLine(line));
  } else {
    const labeled = text.match(/^\s*languages\s*:\s*(.+)$/im);
    if (labeled) spoken = splitSkillLine(labeled[1] ?? '');
  }
  const languages = dedupe(spoken.map((s) => clampStr(s, LIMITS.language)).filter((s): s is string => !!s)).slice(0, 15);

  // ---- achievements ----
  const achievements: string[] = [];
  for (const key of ['achievements'] as const) {
    const section = get(key);
    if (!section) continue;
    for (const line of section.lines) {
      if (HEADING_RE.test(line)) continue;
      const value = clampStr(line, LIMITS.achievement);
      if (value && value.length >= 2) achievements.push(value);
    }
  }

  // ---- interests ----
  let interests: string[] = [];
  const interestSection = get('interests');
  if (interestSection) {
    for (const line of interestSection.lines) interests.push(...splitSkillLine(line));
  } else {
    const labeledInterest = text.match(/^\s*(?:hobbies|interests)\s*:\s*(.+)$/im);
    if (labeledInterest) interests = splitSkillLine(labeledInterest[1] ?? '');
  }
  interests = dedupe(interests.map((s) => clampStr(s, LIMITS.skill)).filter((s): s is string => !!s)).slice(0, 10);

  // ---- experience: dated blocks inside the experience section ----
  const experiences: HeuristicExperience[] = [];
  const expSection = get('experience');
  if (expSection) {
    const body = expSection.lines;
    const dateHits: { index: number; range: NonNullable<ReturnType<typeof rangeFrom>> }[] = [];
    body.forEach((line, index) => {
      const range = rangeFrom(line);
      if (range) dateHits.push({ index, range });
    });
    for (let d = 0; d < dateHits.length; d += 1) {
      const hit = dateHits[d];
      if (!hit) continue;
      const nextHit = dateHits[d + 1];
      const end = nextHit ? nextHit.index : body.length;
      // role: nearest line above the date that isn't a company paragraph
      let roleIndex = hit.index - 1;
      while (roleIndex >= 0 && !looksLikeShortName(body[roleIndex] ?? '')) roleIndex -= 1;
      // company: nearest short line above the role
      let companyIndex = roleIndex - 1;
      while (companyIndex >= 0 && !looksLikeShortName(body[companyIndex] ?? '')) companyIndex -= 1;
      const role = clampStr(body[roleIndex] ?? null, LIMITS.headline);
      const company = clampStr(body[companyIndex] ?? null, LIMITS.name);
      // description: bullets/labels between the date and the next entry
      const descLines: string[] = [];
      for (let i = hit.index + 1; i < end; i += 1) {
        const line = body[i] ?? '';
        if (/^core competencies/i.test(line)) break;
        if (looksLikeShortName(line) && i > hit.index + 1 && descLines.length > 0) break;
        descLines.push(line);
      }
      if (role && company && hit.range.startYear >= YEAR_MIN) {
        experiences.push({
          company,
          role,
          location: null,
          startYear: hit.range.startYear,
          startMonth: hit.range.startMonth,
          endYear: hit.range.endYear,
          endMonth: hit.range.endMonth,
          description: clampStr(descLines.join(' '), LIMITS.experienceDesc),
        });
      }
    }
  }

  // ---- education ----
  const education: HeuristicEducation[] = [];
  const eduSection = get('education');
  if (eduSection) {
    const body = eduSection.lines;
    for (let i = 0; i < body.length; i += 1) {
      const line = body[i] ?? '';
      if (HEADING_RE.test(line)) continue;
      const range = rangeFrom(line);
      const school = looksLikeShortName(line) ? clampStr(line, LIMITS.name) : null;
      if (!school) continue;
      const lookahead = body.slice(i + 1, i + 4).join(' ');
      const degreeMatch = (lookahead + ' ' + line).match(
        /\b(BSc|B\.?Sc|BA|B\.?A\.?|BEd|MSc|M\.?Sc|MA|M\.?A\.?|MBA|PhD|Ph\.?D|Diploma|Certificate|Bachelor(?:'s)?|Master(?:'s)?|Doctorate|High School|Degree)\b[^·•]*/i,
      );
      const years = range ?? rangeFrom(lookahead);
      education.push({
        school,
        degree: clampStr(degreeMatch?.[0]?.replace(/\s+/g, ' ').trim(), LIMITS.name),
        fieldOfStudy: null,
        startYear: years?.startYear ?? new Date().getFullYear() - 4,
        endYear: years?.endYear ?? null,
        description: null,
      });
    }
  }

  // ---- certifications ----
  const certifications: HeuristicCertification[] = [];
  const certSection = get('certifications');
  if (certSection) {
    for (const line of certSection.lines) {
      if (HEADING_RE.test(line)) continue;
      const yearMatch = line.match(/\b(19\d{2}|20\d{2})\b/);
      const issueYear = yearMatch ? Number(yearMatch[1]) : null;
      if (issueYear === null || issueYear < YEAR_MIN || issueYear > YEAR_MAX) continue;
      const parts = line
        .replace(BULLET, '')
        .split(/\s*[-–—|,]\s*/)
        .map((part) => clampStr(part, LIMITS.cert))
        .filter((part): part is string => !!part && part.length >= 2 && !/^\d{4}$/.test(part));
      const certName = parts[0] ?? null;
      const issuer = parts[1] ?? null;
      if (certName) {
        certifications.push({ name: certName, issuer: issuer ?? certName, issueYear, issueMonth: null });
      }
    }
  }

  // ---- projects: "Role:" blocks (undated portfolio pieces) + Projects section ----
  const projects: HeuristicProject[] = [];
  const projectLinesBySection = get('projects');
  if (projectLinesBySection) {
    let currentTitle: string | null = null;
    const desc: string[] = [];
    const flush = () => {
      const title = currentTitle;
      if (title) {
        projects.push({ title, description: clampStr(desc.join(' '), LIMITS.projectDesc) });
      }
      currentTitle = null;
      desc.length = 0;
    };
    for (const line of projectLinesBySection.lines) {
      if (HEADING_RE.test(line)) continue;
      if (looksLikeShortName(line) && desc.length === 0) {
        if (currentTitle) flush();
        currentTitle = clampStr(line, LIMITS.projectTitle);
        continue;
      }
      desc.push(line);
    }
    flush();
  }
  // "Role:" blocks elsewhere in the document (portfolio pieces like
  // "YeneHealth / <subtitle> / <paragraph> / Role: X / Tasks: bullets").
  // The project title is the FIRST short line queued since the last flush.
  {
    let pendingTitle: string | null = null;
    let currentTitle: string | null = null;
    let collecting = false;
    const desc: string[] = [];
    const flush = () => {
      const title = currentTitle;
      if (title && desc.length > 0) {
        const key = title.toLowerCase();
        if (!projects.some((p) => p.title.toLowerCase() === key)) {
          projects.push({ title, description: clampStr(desc.join(' '), LIMITS.projectDesc) });
        }
      }
      currentTitle = null;
      pendingTitle = null;
      collecting = false;
      desc.length = 0;
    };
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index] ?? '';
      if (headingIndexes.has(index)) {
        if (collecting) flush();
        pendingTitle = null;
        continue;
      }
      if (rangeFrom(line)) {
        // a dated line marks an experience entry, not a project
        if (collecting) flush();
        pendingTitle = null;
        continue;
      }
      if (/^role\s*:/i.test(line)) {
        if (!currentTitle) currentTitle = pendingTitle;
        collecting = true;
        desc.push(line);
        continue;
      }
      if ((/^tasks?\s*:/i.test(line) || /^responsibilities\s*:/i.test(line)) ||
        (collecting && /^links?\s*:/i.test(line))) {
        desc.push(line);
        continue;
      }
      if (collecting && (BULLET.test(line) || line.length > 48)) {
        desc.push(line);
        continue;
      }
      if (looksLikeShortName(line)) {
        if (collecting) flush();
        if (!pendingTitle) pendingTitle = clampStr(line, LIMITS.projectTitle);
      }
    }
    flush();
  }
  const finalProjects = projects
    .filter((p) => p.title.length >= 2)
    .slice(0, 20);

  return {
    name,
    headline,
    targetRole: headline,
    summary,
    email: contact.email,
    phone: contact.phone,
    city: null,
    website: contact.website,
    linkedin: contact.linkedin,
    github: contact.github,
    skills,
    languages,
    achievements,
    interests,
    experiences: experiences.slice(0, 15),
    education: education.slice(0, 10),
    certifications: certifications.slice(0, 10),
    projects: finalProjects,
  };
}

