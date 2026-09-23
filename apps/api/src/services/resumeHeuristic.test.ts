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
    for (const d of r.education) {
      if (d.startYear !== null) expect(educationSchema.safeParse(d).success).toBe(true);
    }
    for (const c of r.certifications) expect(certificationSchema.safeParse(c).success).toBe(true);
  });

  it('classifies role vs company by TITLE, not page order (role above company)', () => {
    const cv = [
      'Work Experience',
      'Software Developer',
      'Privacy Electronics',
      'January 2021 - Present',
      'Built embedded dashboards.',
    ].join('\n');
    const r2 = parseResumeHeuristic(cv);
    expect(r2.experiences).toHaveLength(1);
    expect(r2.experiences[0]?.role).toBe('Software Developer');
    expect(r2.experiences[0]?.company).toBe('Privacy Electronics');
    expect(r2.experiences[0]?.startYear).toBe(2021);
    expect(r2.experiences[0]?.endYear).toBeNull();
  });

  it('parses company + role + dates written on ONE line', () => {
    const cv = [
      'Work Experience',
      'Privacy Electronics — Software Developer Jan 2021 - Present',
      'Built embedded dashboards.',
    ].join('\n');
    const r2 = parseResumeHeuristic(cv);
    expect(r2.experiences).toHaveLength(1);
    expect(r2.experiences[0]?.company).toBe('Privacy Electronics');
    expect(r2.experiences[0]?.role).toBe('Software Developer');
    expect(r2.experiences[0]?.startYear).toBe(2021);
  });

  it('splits a single-line education entry into degree / school / years', () => {
    const cv = ['Education', 'BSc in Computer Science, Unity University, 2018 - 2022'].join('\n');
    const r2 = parseResumeHeuristic(cv);
    expect(r2.education).toHaveLength(1);
    expect(r2.education[0]?.school).toBe('Unity University');
    expect(r2.education[0]?.degree).toContain('BSc');
    expect(r2.education[0]?.fieldOfStudy).toBe('Computer Science');
    expect(r2.education[0]?.startYear).toBe(2018);
    expect(r2.education[0]?.endYear).toBe(2022);
  });

  it('never invents education years the CV does not show', () => {
    const cv = ['Education', 'Addis Ababa University', 'BSc in Computer Science'].join('\n');
    const r2 = parseResumeHeuristic(cv);
    expect(r2.education).toHaveLength(1);
    expect(r2.education[0]?.school).toBe('Addis Ababa University');
    expect(r2.education[0]?.degree).toContain('BSc');
    expect(r2.education[0]?.startYear).toBeNull();
    expect(r2.education[0]?.endYear).toBeNull();
  });

  it('never echoes the name as the headline', () => {
    const r2 = parseResumeHeuristic('Sara Haile\nSome intro text that is long enough here.\n');
    expect(r2.name).toBe('Sara Haile');
    expect(r2.headline).toBeNull();
  });

  it('picks the issuer and the LAST year from a certification line', () => {
    const cv = ['Certifications', 'Google Data Analytics Certificate (2021)'].join('\n');
    const r2 = parseResumeHeuristic(cv);
    expect(r2.certifications).toHaveLength(1);
    expect(r2.certifications[0]?.name).toContain('Data Analytics');
    expect(r2.certifications[0]?.issuer).toBe('Google Data Analytics Certificate');
    expect(r2.certifications[0]?.issueYear).toBe(2021);
  });

  it('parses the real-world Ethiopian bank-CV template (date+role same line, personal block mid-document)', () => {
    const CV2 = `Dawit Tamiru Asfaw
EDUCATION
Jun 2017 - Jul 2022 Computer Science
Rift Valley University, Addis Ababa
In-depth knowledge of algorithms and data structures to optimize
software performance and solve complex problems.
Proficiency  in  multiple  programming  languages  including  Python,
Java, and C++ for diverse application development.
Understanding  of  computer  architecture,  operating  systems,  and
networking principles to design efficient systems.
Familiarity  with  database  management  systems,  SQL,  and  data
modeling for robust data storage and retrieval solutions.
Jun 2016 - Jul 2019 Accounting and Finance
Addis Ababa University, Addis Ababa
Comprehensive  understanding  of  financial  accounting  principles,
including GAAP and IFRS standards.
Proficiency  in  financial  statement  preparation,  analysis,  and
interpretation to support business decision-making.
Knowledge of managerial accounting techniques such as budgeting,
cost analysis, and performance measurement.
Skills  in  financial  management,  including  capital  budgeting,
investment analysis, and risk management.
Experience with accounting software and ERP systems for accurate
financial reporting and audit preparedness.
Understanding of auditing principles and practices, including internal
controls and compliance requirements.
EMPLOYMENT
Sep 2023 - Present Internal Control - II
Amhara Bank S.C, Addis Ababa
Conducted  comprehensive  internal  audits  to  evaluate  the
effectiveness  of  internal  controls  and  compliance  with  regulatory
requirements in Addis Ababa operations.
Developed and implemented risk management strategies to identify,
assess,  and  mitigate  financial  and  operational  risks  within  the
organization.
Monitored adherence to internal policies and procedures, ensuring
alignment  with  corporate  governance  standards  and  minimizing
fraud risks.
Dawit Tamiru
Name
Dawit Tamiru Asfaw
Email address
tamirud8@gmail.com
Phone number
0931503559
Address
Addis Ababa, Ethiopia
1000 Addis Ababa
Date of birth
April 6, 1992
Place of birth
Addis Ababa
Driver's license
Auto, Taxi-2
Gender
Male
Nationality
Ethiopian
Civil status
Married
• 
• 
• 
• 
• 
• 
• 
• 
• 
• 
• 
• 
• 
Sep 2022 - Sep 2023 Customer Service executive - II
Amhara Bank S.C, Addis Ababa
Managed daily customer interactions, ensuring timely resolution of
inquiries and complaints to enhance customer satisfaction.
Processed orders and transactions accurately, maintaining detailed
records to support financial and operational reporting.
Collaborated with cross-functional teams to address customer needs
and provide tailored solutions, improving service delivery.
Conducted  customer  feedback  analysis  to  identify  trends  and
recommend service improvements to management.
Jun 2021 - Sep 2022 Customer service Officer - II
Abay Bank S.C, Addis Ababa
Managed daily customer interactions, ensuring timely resolution of
inquiries  and  complaints  to  enhance  customer  satisfaction  in  the
Addis Ababa branch.
Processed  customer  orders  and  transactions  accurately  while
maintaining  detailed  records  to  support  operational  reporting  and
compliance.
Collaborated  with  cross-functional  teams  to  identify  and  address
customer  needs,  delivering  tailored  solutions  to  improve  service
quality.
Analyzed  customer  feedback  and  data  to  identify  trends  and
recommend  actionable  improvements  to  customer  service
management.
Developed and maintained strong relationships with clients in Addis
Ababa to foster loyalty and encourage repeat business.
Jan 2021 - Jun 2021 Internal - I
Belayab Motors Pvt.Ltd.Co, Addis Ababa
Developed and implemented risk management strategies tailored to
mitigate  financial  and  operational  risks  specific  to  Addis  Ababa
operations.
Conducted  comprehensive  internal  audits  to  evaluate  the
effectiveness of internal controls and regulatory compliance within
the Addis Ababa branch.
Prepared detailed audit reports with actionable recommendations for
senior  management  to  drive  continuous  improvement  in  Addis
Ababa's internal control frameworks.
Collaborated  closely  with  department  heads  in  Addis  Ababa  to
develop and implement corrective action plans strengthening internal
controls and compliance.
Sep 2019 - Jan 2021 Purchase Clerk
Belayab Motors Pvt.Ltd.Co, Addis Ababa
Processed purchase orders efficiently, ensuring timely procurement
of goods and services to meet organizational needs in Addis Ababa.
Maintained  accurate  records  of  purchase  transactions,  vendor
invoices, and delivery schedules to support financial reporting and
auditing.
Coordinated with suppliers and vendors to negotiate pricing, terms,
and delivery schedules, optimizing costs and ensuring supply chain
reliability.
Reviewed and verified purchase requisitions and approvals to ensure
compliance with company policies and budget constraints.
SKILLS
Internal Auditing
Risk Management
Financial Reporting
Customer Service
Data Analysis
Compliance Monitoring
Programming (Python, Java, C++)
Database Management
Financial Accounting
Team Collaboration
Audit Reporting
Transaction Reconciliation
Software Development Lifecycle
• 
• 
• 
• 
• 
• 
• 
• 
• 
• 
• 
• 
• 
• 
• 
• 
• 
CERTIFICATES
Jul 2019 Peachtree and QuickBooks software based IFRS
training
Completed  comprehensive  training  on  Peachtree  accounting
software with a focus on IFRS standards and compliance.
Achieved  proficiency  in  QuickBooks  software  for  financial  data
management and IFRS-based financial reporting.
Certified in advanced bookkeeping and accounting principles using
Peachtree and QuickBooks under IFRS guidelines.
Feb 2024 Internal control and Auditing
Certified Internal Auditor (CIA) demonstrating expertise in internal
control and auditing principles.
Association  of  Certified  Fraud  Examiners  (ACFE)  certification
emphasizing fraud prevention and detection within internal audits.
Certified  Risk  Management  Assurance  (CRMA)  credential
showcasing skills in risk management and control assurance.
May 2022 Customer Service and experience
Certified  Customer  Service  Professional  (CCSP)  highlighting
expertise  in  managing  customer  interactions  and  improving
satisfaction.
Certification in Customer Experience Management emphasizing the
development and implementation of customer retention strategies.
LANGUAGES
English
Amharic
HOBBIES
Reading■
Coding■
Hiking■
Traveling■
Gaming■
Fitness■
Cooking■
Volunteering■
• 
• 
• 
• 
• 
• 
• 
• `;
    const r2 = parseResumeHeuristic(CV2);
    expect(r2.name).toBe('Dawit Tamiru Asfaw');
    // every job paired with its true employer — nothing invented, none missing
    expect(r2.experiences.map((e) => [e.company, e.role, e.startYear])).toEqual([
      ['Amhara Bank S.C, Addis Ababa', 'Internal Control - II', 2023],
      ['Amhara Bank S.C, Addis Ababa', 'Customer Service executive - II', 2022],
      ['Abay Bank S.C, Addis Ababa', 'Customer service Officer - II', 2021],
      ['Belayab Motors Pvt.Ltd.Co, Addis Ababa', 'Internal - I', 2021],
      ['Belayab Motors Pvt.Ltd.Co, Addis Ababa', 'Purchase Clerk', 2019],
    ]);
    expect(r2.experiences[0]?.endYear).toBeNull(); // Present
    // personal block must never become an entry
    expect(r2.experiences.some((e) => /driver|marital|married/i.test(e.role + e.company))).toBe(
      false,
    );
    // education: degree+years stay with the right institution
    expect(r2.education.map((e) => [e.school, e.degree, e.startYear, e.endYear])).toEqual([
      ['Rift Valley University, Addis Ababa', 'Computer Science', 2017, 2022],
      ['Addis Ababa University, Addis Ababa', 'Accounting and Finance', 2016, 2019],
    ]);
    // proficiency labels are not languages
    expect(r2.languages).toEqual(['English', 'Amharic']);
    // skill with parentheses survives as one item; cert dates stripped
    expect(r2.skills).toContain('Programming (Python, Java, C++)');
    expect(r2.certifications[0]?.name).not.toMatch(/^Jul 2019/);
  });

  it('parses more template shapes: long months, pipe layouts, single-line BSc', () => {
    const t1 = parseResumeHeuristic(
      [
        'WORK EXPERIENCE',
        'January 2020 - March 2022 Senior Accountant',
        'Commercial Bank of Ethiopia',
        '- Reconciled ledgers.',
        '',
        'EDUCATION',
        'September 2015 - July 2019 BSc in Accounting',
        'Mekelle University',
      ].join('\n'),
    );
    expect(t1.experiences[0]).toMatchObject({
      company: 'Commercial Bank of Ethiopia',
      role: 'Senior Accountant',
      startYear: 2020,
      endYear: 2022,
    });
    expect(t1.education[0]).toMatchObject({
      school: 'Mekelle University',
      degree: 'BSc in Accounting',
      startYear: 2015,
      endYear: 2019,
    });

    const t2 = parseResumeHeuristic(
      [
        'Work Experience',
        'Ethio Telecom | Customer Service Officer',
        'Feb 2019 - Dec 2021',
        'Handled billing inquiries.',
        'EDUCATION',
        'BSc, Addis Ababa University, 2014-2018',
      ].join('\n'),
    );
    expect(t2.experiences[0]).toMatchObject({
      company: 'Ethio Telecom',
      role: 'Customer Service Officer',
      startYear: 2019,
      endYear: 2021,
    });
    expect(t2.education[0]).toMatchObject({
      school: 'Addis Ababa University',
      degree: 'BSc',
      startYear: 2014,
      endYear: 2018,
    });

    const t3 = parseResumeHeuristic(
      [
        'Experience',
        'Software Engineer',
        'Google',
        '2020 - Present',
        'Shipped search features.',
      ].join('\n'),
    );
    expect(t3.experiences[0]).toMatchObject({
      company: 'Google',
      role: 'Software Engineer',
      startYear: 2020,
    });
  });

  it('never throws on garbage', () => {
    const junk = parseResumeHeuristic('\n\n@@@\n   \n---\n');
    expect(junk.skills).toEqual([]);
    expect(junk.experiences).toEqual([]);
  });
});
