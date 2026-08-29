/**
 * User skills — the LinkedIn-style skill tags on a freelancer's profile.
 * Backed by (User, Skill) many-to-many with a `level` 1-5. Users can
 * either attach an existing Skill by id or create-and-attach a new one
 * by name in the same call.
 */
import { prisma } from '../lib/prisma.js';
import { BadRequestError, NotFoundError } from '../lib/errors.js';

function slug(s: string): string {
  const ascii = s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
  if (ascii.length >= 2 && !/[^\x00-\x7f]/.test(s)) return ascii;
  const unicodeSlug = [...s.trim()]
    .map((char) => char.codePointAt(0)?.toString(36) ?? '')
    .filter(Boolean)
    .join('-')
    .slice(0, 54);
  return `skill-${unicodeSlug}`.slice(0, 60);
}

export async function listMySkills(userId: string) {
  return prisma.userSkill.findMany({
    where: { userId },
    include: { skill: true },
    orderBy: [{ level: 'desc' }, { skill: { name: 'asc' } }],
  });
}

export async function addSkill(
  userId: string,
  input: { skillId?: string; name?: string; level: number },
) {
  let skillId = input.skillId;
  if (!skillId) {
    if (!input.name) throw new BadRequestError('skillId or name required');
    const skill = await prisma.skill.upsert({
      where: { name: input.name },
      create: { name: input.name, slug: slug(input.name), category: 'general' },
      update: {},
    });
    skillId = skill.id;
  } else {
    const exists = await prisma.skill.findUnique({ where: { id: skillId }, select: { id: true } });
    if (!exists) throw new NotFoundError('Skill');
  }
  return prisma.userSkill.upsert({
    where: { userId_skillId: { userId, skillId } },
    create: { userId, skillId, level: input.level },
    update: { level: input.level },
    include: { skill: true },
  });
}

export async function updateLevel(userId: string, skillId: string, level: number) {
  return prisma.userSkill.update({
    where: { userId_skillId: { userId, skillId } },
    data: { level },
    include: { skill: true },
  });
}

export async function removeSkill(userId: string, skillId: string) {
  await prisma.userSkill.deleteMany({ where: { userId, skillId } });
  return { ok: true };
}
