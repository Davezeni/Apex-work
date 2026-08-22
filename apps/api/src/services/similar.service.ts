/**
 * "Similar gigs" — a lightweight recommendation feed shown on gig detail
 * pages. Uses trigram overlap on title + shared tags to rank; falls back
 * to same-category by rating when the query returns too few rows.
 *
 * Cheap enough to run on every gig page load, but wrapped by our cache
 * middleware for a 60s window anyway.
 */
import { prisma } from '../lib/prisma.js';

export async function similarGigs(slug: string, limit = 6) {
  const seed = await prisma.gig.findUnique({
    where: { slug },
    select: { id: true, title: true, categoryId: true, tags: true, ownerId: true },
  });
  if (!seed) return [];
  // Same category, active, not the same gig, sorted by trigram + tag overlap.
  // Coalesce for gigs without shared tags so they still bubble up above unrelated ones.
  const rows = await prisma.$queryRaw<Array<{
    id: string; slug: string; title: string; coverImageUrl: string | null;
    startingPriceEtb: number; rating: number; ratingCount: number;
    ownerFullName: string; ownerUsername: string; ownerAvatarUrl: string | null;
    score: number;
  }>>`
    SELECT g."id", g."slug", g."title", g."coverImageUrl",
           g."startingPriceEtb", g."rating", g."ratingCount",
           u."fullName" AS "ownerFullName",
           u."username" AS "ownerUsername",
           u."avatarUrl" AS "ownerAvatarUrl",
           (
             similarity(g."title", ${seed.title}) * 3
             + (SELECT COUNT(*) FROM unnest(g."tags") t WHERE t = ANY(${seed.tags}::text[]))::float * 0.5
             + (CASE WHEN g."categoryId" = ${seed.categoryId} THEN 1 ELSE 0 END)
             + LEAST(g."rating", 5) * 0.1
           ) AS score
    FROM "Gig" g
    JOIN "User" u ON u."id" = g."ownerId"
    WHERE g."status" = 'ACTIVE'
      AND g."id" != ${seed.id}
    ORDER BY score DESC, g."rating" DESC
    LIMIT ${limit}
  `;
  return rows.map((r) => ({
    id: r.id, slug: r.slug, title: r.title, coverImageUrl: r.coverImageUrl,
    startingPriceEtb: r.startingPriceEtb, rating: r.rating, ratingCount: r.ratingCount,
    owner: { fullName: r.ownerFullName, username: r.ownerUsername, avatarUrl: r.ownerAvatarUrl },
  }));
}
