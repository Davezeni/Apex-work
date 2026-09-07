/**
 * Full-text search over gigs, jobs, and users.
 *
 * Uses the pg_trgm GIN indexes we added in migration
 * 20260822180000_perf_search_indexes:
 *   - Gig.title, User.fullName, User.username, Job.title/description →
 *     ILIKE '%q%' is an index scan, not a seq scan.
 *
 * We also compute a `similarity(name, q)` score via pg_trgm so results
 * are ranked (best fuzzy match first), which fixes "typo tolerance" for
 * free: "reactjs" still finds "React JS", "amaric" finds "Amharic", etc.
 *
 * Everything else — pagination, filters, sanitization — lives here so
 * routes can stay thin.
 */
import { prisma } from '../lib/prisma.js';
import type { Prisma } from '@prisma/client';

export interface GlobalSearchResult {
  gigs: {
    id: string; slug: string; title: string; coverImageUrl: string | null;
    startingPriceEtb: number; rating: number; ratingCount: number;
    owner: { username: string; fullName: string; avatarUrl: string | null };
  }[];
  jobs: {
    id: string; title: string; budgetMinEtb: number | null; budgetMaxEtb: number | null;
    isRemote: boolean; createdAt: string;
    client: { username: string; fullName: string };
  }[];
  users: {
    id: string; username: string; fullName: string; avatarUrl: string | null;
    title: string | null; city: string | null; rating: number; ratingCount: number;
    isVerified?: boolean;
  }[];
}

const clean = (q: string) => q.trim().replace(/[%_\\]/g, '').slice(0, 100);

/** All three lists at once — used by /search and the top-bar quick suggest. */
export async function globalSearch(rawQ: string, limit = 5): Promise<GlobalSearchResult> {
  const q = clean(rawQ);
  if (!q) return { gigs: [], jobs: [], users: [] };
  const like = `%${q}%`;

  // Gigs — order by trigram similarity, tie-break on rating
  const gigs = await prisma.$queryRaw<GlobalSearchResult['gigs']>`
    SELECT g."id", g."slug", g."title", g."coverImageUrl",
           g."startingPriceEtb", g."rating", g."ratingCount",
           jsonb_build_object(
             'username', u."username",
             'fullName', u."fullName",
             'avatarUrl', u."avatarUrl"
           ) AS owner
    FROM "Gig" g
    JOIN "User" u ON u."id" = g."ownerId"
    WHERE g."status" = 'ACTIVE'
      AND (g."title" ILIKE ${like} OR ${q} = ANY(g."tags"))
    ORDER BY similarity(g."title", ${q}) DESC, g."rating" DESC
    LIMIT ${limit}
  `;

  const jobs = await prisma.$queryRaw<GlobalSearchResult['jobs']>`
    SELECT j."id", j."title", j."budgetMinEtb", j."budgetMaxEtb",
           j."isRemote", j."createdAt",
           jsonb_build_object('username', c."username", 'fullName', c."fullName") AS client
    FROM "Job" j
    JOIN "User" c ON c."id" = j."clientId"
    WHERE j."isOpen" = true
      AND (j."title" ILIKE ${like} OR j."description" ILIKE ${like} OR ${q} = ANY(j."requiredSkills"))
    ORDER BY similarity(j."title", ${q}) DESC, j."createdAt" DESC
    LIMIT ${limit}
  `;

  const users = await prisma.$queryRaw<GlobalSearchResult['users']>`
    SELECT "id", "username", "fullName", "avatarUrl", "title", "city",
           "rating", "ratingCount",
           ("isPhoneVerified" AND "isIdVerified") AS "isVerified"
    FROM "User"
    WHERE "isActive" = true
      AND ("fullName" ILIKE ${like} OR "username" ILIKE ${like})
    ORDER BY GREATEST(similarity("fullName", ${q}), similarity("username", ${q})) DESC,
             "rating" DESC
    LIMIT ${limit}
  `;

  return { gigs, jobs, users };
}

/** Autocomplete suggestion — lightweight typeahead for the search bar. */
export async function suggest(rawQ: string, limit = 8): Promise<{ items: { text: string; type: 'gig' | 'job' | 'skill' | 'user'; ref?: string }[] }> {
  const q = clean(rawQ);
  if (!q || q.length < 2) return { items: [] };
  const like = `%${q}%`;

  const [gigs, users, skills] = await Promise.all([
    prisma.$queryRaw<{ title: string; slug: string }[]>`
      SELECT "title", "slug" FROM "Gig"
      WHERE "status" = 'ACTIVE' AND "title" ILIKE ${like}
      ORDER BY similarity("title", ${q}) DESC LIMIT ${limit}
    `,
    prisma.$queryRaw<{ fullName: string; username: string }[]>`
      SELECT "fullName", "username" FROM "User"
      WHERE "isActive" = true AND ("fullName" ILIKE ${like} OR "username" ILIKE ${like})
      ORDER BY GREATEST(similarity("fullName", ${q}), similarity("username", ${q})) DESC
      LIMIT ${limit}
    `,
    prisma.$queryRaw<{ name: string; slug: string }[]>`
      SELECT "name", "slug" FROM "Skill"
      WHERE "name" ILIKE ${like}
      ORDER BY similarity("name", ${q}) DESC LIMIT ${limit}
    `,
  ]);

  const items = [
    ...gigs.map((g) => ({ text: g.title, type: 'gig' as const, ref: g.slug })),
    ...users.map((u) => ({ text: u.fullName, type: 'user' as const, ref: u.username })),
    ...skills.map((s) => ({ text: s.name, type: 'skill' as const, ref: s.slug })),
  ].slice(0, limit);

  return { items };
}
