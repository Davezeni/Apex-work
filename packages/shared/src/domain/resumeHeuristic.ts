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
  startYear: number | null; // null = the CV never showed a year (never invented)
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
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

const BULLET = /^[\u2022\-*·◦‣▪○●]\s*/;

/**
 * Job-title keywords — the signal that a short line is a ROLE, not a company.
 * Built from common Ethiopian + international CV titles (tech, business,
 * health, government, trades). Order-independent of the company line.
 */
const TITLE_RE =
  /\b(senior|junior|lead|head of|chief|principal|freelance|assistant|deputy|director|manager|supervisor|coordinator|officer|specialist|consultant|analyst|administrator|architect|developer|engineer|programmer|designer|devops|data scientist|data entry|qa|tester|accountant|auditor|bookkeeper|cashier|banker|finance|economist|marketer|marketing|sales|customer service|receptionist|secretary|clerk|secretariat|driver|messenger|guard|cleaner|electrician|plumber|carpenter|mason|welder|mechanic|tailor|chef|cook|waiter|bartender|barista|teacher|lecturer|professor|tutor|instructor|nurse|midwife|doctor|pharmacist|lab technician|health officer|veterinarian|agronomist|lawyer|attorney|advisor|advocate|judge|translator|interpreter|journalist|editor|writer|photographer|videographer|social media|community manager|recruiter|hr|procurement|logistics|storekeeper|purchaser|project manager|program manager|intern|trainee|volunteer|consultancy|operator)\b/i;

/** Institution keywords — the signal that a line is a SCHOOL. */
const INSTITUTION_RE =
  /\b(university|college|institute|academy|polytechnic|school|campus|faculty)\b/i;

/** Degree tokens for splitting single-line education entries. */
const DEGREE_TOKEN_RE =
  /\b(BSc|B\.?Sc|BA|B\.?A\.?|BEd|MSc|M\.?Sc|MA|M\.?A\.?|MBA|MEd|PhD|Ph\.?D|Diploma|Certificate|Bachelor(?:'s)?|Master(?:'s)?|Doctorate|High School|Degree|TVET|Level [-–]?\s?[1-5])\b/i;

/** Personal-information labels — NEVER a job role, company, or school. */
const PERSONAL_LABEL_RE =
  /^(driver'?s? ?licen[cs]e|licence|name|full name|email( address)?|e-mail|phone( number)?|mobile|address|date of birth|place of birth|gender|sex|nationality|civil status|marital status|religion|birth date|linkedin|github|portfolio|website)\b\s*:?\s*$/i;

/** Personal-information VALUES — never a job role or employer. */
const PERSONAL_VALUE_RE =
  /^(married|single|divorced|widowed|male|female|ethiopian|none|n\/a|auto(.*,?.*)?|taxi[- ]?2?)\s*$/i;

/** Language proficiency labels — they DESCRIBE a language, they are not one. */
const PROFICIENCY_RE =
  /^(native|bilingual|mother tongue|professional|full professional|limited working|advanced|intermediate|elementary|beginner|fluent|conversational)\b/i;

/** Exact provider names — an issuer-FIRST cert line swaps onto these. */
const STRICT_ISSUER_RE =
  /^(coursera|udemy|google|aws|amazon web services|amazon|microsoft|ibm|linkedin( learning)?|meta|huawei|oracle|cisco|adobe|edx|udacity|freecodecamp|hubspot|salesforce|ethio telecom)$/i;

/** Known certificate issuers — used to pick the issuer part of a cert line. */
const KNOWN_ISSUER_RE =
  /(coursera|udemy|google|aws|amazon|microsoft|ibm|linkedin( learning)?|meta|huawei|oracle|cisco|adobe|edx|udacity|freecodecamp|hubspot|salesforce|ethio telecom|nbe|aau|comp?aTIA)/i;

/** Remove a matched date range from a line, returning the remaining text. */
function stripRange(line: string): string {
  return line
    .replace(DATE_RANGE, ' ')
    .replace(YEAR_RANGE, ' ')
    .replace(/[\u2022\-*·|,;]+\s*$/, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .replace(/[-–—|,;:\/]\s*$/, '')
    .trim();
}

/** Split a single-line education entry into degree / field / school. */
function splitEduLine(cleaned: string): {
  school: string | null;
  degree: string | null;
  fieldOfStudy: string | null;
} | null {
  if (!DEGREE_TOKEN_RE.test(cleaned) && !INSTITUTION_RE.test(cleaned)) return null;
  const parts = cleaned
    .split(/[,·]| \|| \//)
    .map((part) => part.replace(BULLET, '').trim())
    .filter((part) => part.length >= 2 && !/^\d{4}/.test(part));
  if (parts.length < 2) return null;
  let school: string | null = null;
  let degree: string | null = null;
  let fieldOfStudy: string | null = null;
  for (const part of parts) {
    const isInst = INSTITUTION_RE.test(part);
    const isDegree = DEGREE_TOKEN_RE.test(part);
    if (isInst && !school) {
      school = part;
      continue;
    }
    if (isDegree && !degree) {
      degree = part;
      const field = part.match(/\b(?:in|of)\s+([A-Za-z][A-Za-z .&]{2,60})$/i);
      if (field) fieldOfStudy = (field[1] ?? '').trim();
      continue;
    }
    if (!degree && part.split(/\s+/).length <= 8) degree = part;
    else if (!school) school = part;
  }
  school = school ? clampStr(school, 120) : null;
  degree = degree ? clampStr(degree, 120) : null;
  fieldOfStudy = fieldOfStudy ? clampStr(fieldOfStudy, 120) : null;
  if (!school && !degree) return null;
  return { school, degree, fieldOfStudy };
}

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

function rangeFrom(text: string): {
  startYear: number;
  startMonth: number;
  endYear: number | null;
  endMonth: number | null;
} | null {
  const m = text.match(DATE_RANGE);
  if (m) {
    const startMonth = parseMonth(m[1] ?? '');
    const startYear = Number(m[2]);
    const endToken = (m[3] ?? '').toLowerCase();
    const endYear = /present|now|current/.test(endToken) ? null : Number(m[4] ?? NaN);
    if (
      startMonth &&
      startYear >= YEAR_MIN &&
      startYear <= YEAR_MAX &&
      (endYear === null || (endYear >= YEAR_MIN && endYear <= YEAR_MAX))
    ) {
      const endMonth = endYear === null ? null : (parseMonth(m[3] ?? '') ?? 12);
      return { startYear, startMonth, endYear, endMonth };
    }
  }
  const y = text.match(YEAR_RANGE);
  if (y) {
    const startYear = Number(y[1]);
    const endRaw = (y[2] ?? '').toLowerCase();
    const endYear = /present|now/.test(endRaw) ? null : Number(endRaw);
    if (
      startYear >= YEAR_MIN &&
      startYear <= YEAR_MAX &&
      (endYear === null || (endYear >= YEAR_MIN && endYear <= YEAR_MAX))
    ) {
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
  if (
    /^(work experience|professional experience|experience|employment( history)?|career history)$/.test(
      l,
    )
  )
    return 'experience';
  if (/^(education( & training)?|academic background|academics)$/.test(l)) return 'education';
  if (/^(projects?|portfolio|selected projects)$/.test(l)) return 'projects';
  if (
    /^(technology stack|tech stack|technical skills|core competencies|competencies|skills( & tools)?|areas of expertise)$/.test(
      l,
    )
  )
    return 'skills';
  if (/^(summary( of qualifications)?|profile|about me?|objective)$/.test(l)) return 'summary';
  if (/^(certifications?|licenses?|certificates)$/.test(l)) return 'certifications';
  if (/^(achievements?|awards|additional contributions|contributions|key achievements)$/.test(l))
    return 'achievements';
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

  const phoneMatch =
    text.match(/(?:\+?251|0)[\s-]?9\d[\s-]?\d{3}[\s-]?\d{3,4}/) ||
    text.match(/(?:\+?\d{1,3}[\s-]?)?\d{3}[\s-]?\d{3}[\s-]?\d{3,4}/);
  let phone = clampStr(phoneMatch?.[0], LIMITS.phone);
  if (phone && phone.replace(/\D/g, '').length < 7) phone = null;

  const bareProfile = dedupe(
    (text.match(/\b(?:linkedin\.com|github\.com)\/[^\s|)<>\]]+/gi) ?? []).map(
      (u) => `https://${u.replace(/[.,;)\]]+$/, '')}`,
    ),
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
      // protect parenthesised groups ("Programming (Python, Java, C++)")
      .replace(
        /\(([^)]*)\)/g,
        (_m, inner: string) => `\u0001${String(inner).replace(/,/g, '\u0003')}\u0002`,
      )
      .split(/[,|·;/]| {2,}/)
      .map((item) =>
        clampStr(
          item
            .replace(/\u0001/g, '(')
            .replace(/\u0002/g, ')')
            .replace(/\u0003/g, ',')
            .replace(/\.+$/, ''),
          LIMITS.skill,
        ),
      )
      .filter(
        (item): item is string => !!item && item.length >= 2 && item.split(/\s+/).length <= 6,
      );
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

  // ---- name + headline: "Name - Title" split, or title-keyword detection ----
  // Discipline: the headline is a PROFESSIONAL TITLE, never the person's name
  // echoed back. If the first line carries no title, headline stays null.
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
  if (!headline && !name) {
    // "Full Stack Developer" alone on top, or a bare person name on top.
    const firstClean = clampStr(first, LIMITS.headline);
    if (firstClean) {
      if (TITLE_RE.test(firstClean)) {
        headline = firstClean;
      } else if (!/\d/.test(firstClean) && firstClean.split(/\s+/).length <= 5) {
        name = firstClean;
      }
    }
  }
  if (!headline && name) {
    // "Abebe Kebede" / "Software Developer" — the title often sits directly
    // under the name. Only a short, non-heading title-phrase qualifies.
    for (const line of lines.slice(1, 4)) {
      const candidate = clampStr(line, LIMITS.headline);
      if (!candidate) continue;
      if (HEADING_RE.test(candidate)) break;
      if (candidate.length > 48) break;
      if (TITLE_RE.test(candidate) && candidate.split(/\s+/).length <= 8) {
        headline = candidate;
      }
      break;
    }
  }

  // ---- summary: labeled section, else intro paragraph before first heading ----
  let summary: string | null = null;
  const summarySection = get('summary');
  if (summarySection && summarySection.lines.length > 0) {
    summary = clampStr(summarySection.lines.join(' '), LIMITS.summary);
  } else {
    const preamble = get('preamble');
    if (preamble) {
      const introLines = preamble.lines
        .filter((line) => line !== first && line.length > 40)
        .slice(0, 4);
      summary = clampStr(introLines.join(' '), LIMITS.summary);
    }
  }

  // ---- skills ----
  let skills: string[] = [];
  const skillsSection = get('skills');
  if (skillsSection) {
    // Two-column PDFs often split one skill across lines ("Programming
    // (Python" / "Java" / "C++)") — re-join while parentheses stay unbalanced.
    const merged: string[] = [];
    for (const raw of skillsSection.lines) {
      const line = raw.trim();
      if (!line) continue;
      const open = (merged[merged.length - 1] ?? '').split('(').length - 1;
      const close = (merged[merged.length - 1] ?? '').split(')').length - 1;
      if (merged.length > 0 && open > close) {
        merged[merged.length - 1] = `${merged[merged.length - 1]} ${line}`;
      } else {
        merged.push(line);
      }
    }
    for (const line of merged) {
      if (HEADING_RE.test(line)) continue;
      skills.push(...splitSkillLine(line));
    }
  } else {
    // Inline labeled line: "Skills: React, Node.js, SQL" (no section).
    const labeled = text.match(/^\s*(?:skills|technical skills|tech stack)\s*:\s*(.+)$/im);
    if (labeled) skills.push(...splitSkillLine(labeled[1] ?? ''));
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
  const languages = dedupe(
    spoken
      .map((s) =>
        clampStr(
          s.replace(
            /\s*\((?:native|fluent|advanced|intermediate|beginner|elementary|professional|conversational)[^)]*\)/i,
            '',
          ),
          LIMITS.language,
        ),
      )
      .filter((s): s is string => !!s && !PROFICIENCY_RE.test(s))
      .filter((s) => s.split(/\s+/).length <= 3),
  ).slice(0, 15);

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
  interests = dedupe(
    interests.map((s) => clampStr(s, LIMITS.skill)).filter((s): s is string => !!s),
  ).slice(0, 10);

  // ---- experience: dated blocks inside the experience section ----
  const experiences: HeuristicExperience[] = [];
  const expSection = get('experience');
  if (expSection) {
    const body = expSection.lines;
    const dateHits: {
      index: number;
      range: NonNullable<ReturnType<typeof rangeFrom>>;
    }[] = [];
    body.forEach((line, index) => {
      const range = rangeFrom(line);
      if (range) dateHits.push({ index, range });
    });
    for (let d = 0; d < dateHits.length; d += 1) {
      const hit = dateHits[d];
      if (!hit) continue;
      const nextHit = dateHits[d + 1];
      const end = nextHit ? nextHit.index : body.length;

      // Candidate employer/role lines: short lines between the previous date
      // and this one, PLUS the remainder of the date line itself (many CVs
      // write "Acme Corp — Software Developer Jan 2021 - Present" on one
      // line). The job-title keyword decides which line is the ROLE; page
      // order varies between CVs, so adjacency alone kept swapping them.
      // Helper: skip personal-info noise (labels, the candidate's own name,
      // emails, proficiency words) — a "Driver's license" line must never
      // become a job title.
      const isNoise = (line: string): boolean => {
        const t = line.trim();
        if (!t) return true;
        if (PERSONAL_LABEL_RE.test(t)) return true;
        if (PERSONAL_VALUE_RE.test(t)) return true;
        if (PROFICIENCY_RE.test(t) && t.split(/\s+/).length <= 3) return true;
        if (t.includes('@') || /^https?:/i.test(t)) return true;
        if (name && t.length >= 4) {
          const n = name.toLowerCase();
          const l = t.toLowerCase();
          if (l === n || n.startsWith(l) || l.startsWith(n.split(' ').slice(0, 2).join(' '))) {
            return true;
          }
        }
        return false;
      };

      const above: string[] = [];
      const startScan = d > 0 ? (dateHits[d - 1]?.index ?? 0) + 1 : 0;
      for (let i = startScan; i < hit.index; i += 1) {
        const line = body[i] ?? '';
        if (isNoise(line)) continue;
        if (looksLikeShortName(line)) above.push(line);
      }
      const aboveLenBeforeSegs = above.length; // segs from the date line land AFTER this mark
      const sameLine = stripRange(body[hit.index] ?? '');
      if (sameLine) {
        // "Acme Corp — Software Developer" / "Acme | Developer" / "Acme at NGO"
        for (const seg of sameLine.split(/\s*[\u2014\u2013|]\s*|\s+at\s+/i)) {
          if (seg && looksLikeShortName(seg)) above.push(seg);
        }
      }

      let role: string | null = null;
      let company: string | null = null;
      // "DATE + Role" layout ("Sep 2023 - Present Internal Control - II" with
      // the employer on the NEXT line) — very common in CV templates. The
      // remainder after the date IS the role; the company follows below.
      const singleSeg =
        sameLine && looksLikeShortName(sameLine) && !/[\u2014\u2013|]/.test(sameLine)
          ? sameLine
          : null;
      let companyBelowIndex = -1;
      if (singleSeg && !TITLE_RE.test(sameLine)) {
        role = clampStr(singleSeg, LIMITS.headline);
        for (let i = hit.index + 1; i < end; i += 1) {
          const line = body[i] ?? '';
          if (BULLET.test(line)) continue;
          if (isNoise(line)) continue;
          if (looksLikeShortName(line)) {
            company = clampStr(line, LIMITS.name);
            companyBelowIndex = i;
            break;
          }
          break;
        }
      }
      const titleIndex = (() => {
        for (let i = above.length - 1; i >= 0; i -= 1) {
          if (TITLE_RE.test(above[i] ?? '')) return i;
        }
        return -1;
      })();
      if (role && companyBelowIndex >= 0) {
        // date-leading layout already resolved — description starts BELOW
        // the company line we consumed.
      } else if (titleIndex >= 0) {
        const titleLine = (above[titleIndex] ?? '').trim();
        role = clampStr(titleLine, LIMITS.headline);
        // "Ethio Telecom | Customer Service Officer" — employer and title on
        // ONE line: the title segment is the role, the other is the company.
        if (/[\u2014\u2013|]/.test(titleLine)) {
          const segs = titleLine.split(/\s*[\u2014\u2013|]\s*/).filter((seg) => seg);
          const titleSeg = segs.find((seg) => TITLE_RE.test(seg));
          const otherSeg = segs.find((seg) => seg !== titleSeg && looksLikeShortName(seg));
          if (titleSeg) role = clampStr(titleSeg, LIMITS.headline);
          if (!company && otherSeg) company = clampStr(otherSeg, LIMITS.name);
        }
        // company = nearest short line ABOVE the role (the org comes first in
        // most layouts); fall back to the nearest one below.
        for (let i = titleIndex - 1; i >= 0; i -= 1) {
          const candidate = clampStr(above[i] ?? null, LIMITS.name);
          if (candidate && !TITLE_RE.test(candidate)) {
            company = candidate;
            break;
          }
        }
        if (!company) {
          for (let i = titleIndex + 1; i < above.length; i += 1) {
            const candidate = clampStr(above[i] ?? null, LIMITS.name);
            if (candidate && !TITLE_RE.test(candidate)) {
              company = candidate;
              break;
            }
          }
        }
        // Template layout: the title sat ON the date line ALONE ("Sep 2023 -
        // Present Internal Control - II") — the employer is the first short
        // line BELOW the date. But when the date line carried BOTH parts
        // ("Acme — Developer Jan 2021 - Present"), the employer is the other
        // segment right above the title — do NOT go looking below.
        const sameLineSegCount = above.length - aboveLenBeforeSegs;
        const titleFromSameLine = titleIndex >= aboveLenBeforeSegs && sameLineSegCount <= 1;
        if (titleFromSameLine || (company && isNoise(company))) company = null;
        if (!company) {
          for (let i = hit.index + 1; i < end; i += 1) {
            const line = body[i] ?? '';
            if (BULLET.test(line)) continue;
            if (isNoise(line)) continue;
            if (looksLikeShortName(line) && !TITLE_RE.test(line)) {
              company = clampStr(line, LIMITS.name);
              companyBelowIndex = i;
              break;
            }
            break;
          }
        }
      } else {
        // No recognizable title: keep the legacy adjacency heuristic
        // (role directly above the date, company above the role).
        const roleCandidate = above[above.length - 1] ?? null;
        const companyCandidate = above[above.length - 2] ?? null;
        role = clampStr(roleCandidate, LIMITS.headline);
        company = clampStr(companyCandidate, LIMITS.name);
      }
      // Final safety: personal-info noise can never be a role or employer.
      if (role && isNoise(role)) role = null;
      if (company && isNoise(company)) company = null;
      // description: bullets/labels between the date and the next entry
      const descStart = role && companyBelowIndex >= 0 ? companyBelowIndex + 1 : hit.index + 1;
      const descLines: string[] = [];
      for (let i = descStart; i < end; i += 1) {
        const line = body[i] ?? '';
        if (/^core competencies/i.test(line)) break;
        if (isNoise(line)) continue;
        if (looksLikeShortName(line) && i > descStart && descLines.length > 0) break;
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

  // ---- education: institution lines start entries; degree/year lines and
  // single-line entries ("BSc in CS, Addis Ababa University, 2018-2022") are
  // split into their fields. Years are only set when the CV SHOWS them — a
  // missing year must reach the review screen empty, never invented. ----
  const education: HeuristicEducation[] = [];
  const eduSection = get('education');
  if (eduSection) {
    const body = eduSection.lines;
    let current: HeuristicEducation | null = null;
    // "DATE + Degree" templates put the years BEFORE the institution line
    // ("Jun 2017 - Jul 2022 Computer Science" / "Rift Valley University").
    // Carry them forward so they land on the entry that follows.
    let pending: {
      range: NonNullable<ReturnType<typeof rangeFrom>>;
      degree: string | null;
    } | null = null;
    const flush = () => {
      if (current && current.school) {
        if (!education.some((e) => e.school.toLowerCase() === current!.school!.toLowerCase())) {
          education.push(current);
        }
      }
      current = null;
    };
    for (let i = 0; i < body.length; i += 1) {
      const line = body[i] ?? '';
      if (HEADING_RE.test(line)) continue;
      const range = rangeFrom(line);
      const cleaned = range ? stripRange(line) : line;
      const inline = splitEduLine(cleaned);
      const isInstitution = INSTITUTION_RE.test(line) && looksLikeShortName(line);

      if (isInstitution) {
        // A new institution line: flush the previous entry, start a new one —
        // adopting any "DATE + Degree" pair pending from the line above.
        flush();
        const school = clampStr(line, LIMITS.name);
        if (school) {
          current = {
            school,
            degree: pending?.degree ?? null,
            fieldOfStudy: null,
            startYear: pending?.range.startYear ?? range?.startYear ?? null,
            endYear: pending?.range.endYear ?? range?.endYear ?? null,
            description: null,
          };
        }
        pending = null;
        continue;
      }
      if (inline && inline.school && (!current || INSTITUTION_RE.test(cleaned))) {
        // Single-line entry: "BSc in Computer Science, AAU, 2018-2022".
        flush();
        const school = clampStr(inline.school, LIMITS.name);
        if (school) {
          current = {
            school,
            degree: inline.degree,
            fieldOfStudy: inline.fieldOfStudy,
            startYear: range?.startYear ?? null,
            endYear: range?.endYear ?? null,
            description: null,
          };
        }
        flush();
        continue;
      }
      // Degree / field / year line belonging to the current institution.
      const degreePart = inline ?? splitEduLine(cleaned.replace(/,?\s*\d{4}.*$/, '').trim());
      // A bare degree line ("BSc in Computer Science") is common directly
      // under the school — attach it even though it has no comma parts.
      const directDegree =
        !degreePart && DEGREE_TOKEN_RE.test(cleaned)
          ? {
              degree: cleaned,
              fieldOfStudy:
                cleaned.match(/\b(?:in|of)\s+([A-Za-z][A-Za-z .&]{2,60})$/i)?.[1] ?? null,
            }
          : null;
      const deg = degreePart ?? directDegree;
      // A bare "DATE + degree/field" line BEFORE any institution belongs to
      // the NEXT institution ("Jun 2017 - Jul 2022 Computer Science").
      if (range && !current) {
        pending = {
          range,
          degree:
            cleaned && cleaned.length <= 60 && looksLikeShortName(cleaned)
              ? clampStr(cleaned, LIMITS.name)
              : null,
        };
        continue;
      }
      if (current) {
        if (deg?.degree && !current.degree) current.degree = clampStr(deg.degree, LIMITS.name);
        if (deg?.fieldOfStudy && !current.fieldOfStudy) {
          current.fieldOfStudy = clampStr(deg.fieldOfStudy, LIMITS.name);
        }
        if (degreePart?.school && !current.school) current.school = degreePart.school;
        if (range) {
          // Years for an entry that already has years signal the NEXT
          // entry starting (this template) — flush and carry forward.
          if (current.startYear !== null) {
            flush();
            pending = {
              range,
              degree:
                cleaned && cleaned.length <= 60 && looksLikeShortName(cleaned)
                  ? clampStr(cleaned, LIMITS.name)
                  : null,
            };
          } else {
            current.startYear = range.startYear;
            current.endYear = range.endYear;
          }
        }
      } else if (degreePart?.school) {
        const school = clampStr(degreePart.school, LIMITS.name);
        if (school) {
          current = {
            school,
            degree: degreePart.degree,
            fieldOfStudy: degreePart.fieldOfStudy,
            startYear: range?.startYear ?? null,
            endYear: range?.endYear ?? null,
            description: null,
          };
        }
      }
    }
    flush();
  }

  // ---- certifications ----
  const certifications: HeuristicCertification[] = [];
  const certSection = get('certifications');
  if (certSection) {
    for (const line of certSection.lines) {
      if (HEADING_RE.test(line)) continue;
      // Year: the LAST 4-digit year on the line ("Name, 2020" / "Name (2020)").
      const yearMatches = [...line.matchAll(/\b(19\d{2}|20\d{2})\b/g)];
      const issueYearRaw =
        yearMatches.length > 0 ? Number(yearMatches[yearMatches.length - 1]?.[1]) : null;
      const issueYear =
        issueYearRaw !== null && issueYearRaw >= YEAR_MIN && issueYearRaw <= YEAR_MAX
          ? issueYearRaw
          : null;
      if (issueYear === null) continue;
      const parts = line
        .replace(BULLET, '')
        .replace(/\((?:19|20)\d{2}\)/g, ' ')
        .split(/\s*[-–—|,]\s*/)
        .map((part) => clampStr(part, LIMITS.cert))
        .filter(
          (part): part is string => !!part && part.length >= 2 && !/^(19|20)\d{2}$/.test(part),
        );
      if (parts.length === 0) continue;
      // Name = the FIRST part ("AWS Certified Developer" stays the name even
      // though it contains 'AWS'). Issuer = a known provider among the REST,
      // else the second part. Issuer-first layouts ("Coursera - X") swap only
      // when the first part is EXACTLY a provider name.
      let certName: string | null = parts[0] ?? null;
      let issuer: string | null =
        parts.slice(1).find((x) => KNOWN_ISSUER_RE.test(x)) ?? parts[1] ?? certName;
      // A leading month-year ("Jul 2019 Peachtree and QuickBooks…") is the
      // ISSUE DATE, not part of the certificate title.
      certName = certName
        ? clampStr(
            certName.replace(/^[A-Za-z]{3,9}\.?\s+(?:19|20)\d{2}\s*[-–—|,]?\s*/, ''),
            LIMITS.cert,
          )
        : null;
      issuer = issuer
        ? clampStr(
            issuer.replace(/^[A-Za-z]{3,9}\.?\s+(?:19|20)\d{2}\s*[-–—|,]?\s*/, ''),
            LIMITS.cert,
          )
        : null;
      if (
        parts.length > 1 &&
        STRICT_ISSUER_RE.test(parts[0] ?? '') &&
        !STRICT_ISSUER_RE.test(parts[1] ?? '')
      ) {
        issuer = parts[0] ?? issuer;
        certName = parts[1] ?? certName;
      }
      if (certName && issuer) {
        certifications.push({ name: certName, issuer, issueYear, issueMonth: null });
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
      if (
        /^tasks?\s*:/i.test(line) ||
        /^responsibilities\s*:/i.test(line) ||
        (collecting && /^links?\s*:/i.test(line))
      ) {
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
  const finalProjects = projects.filter((p) => p.title.length >= 2).slice(0, 20);

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
