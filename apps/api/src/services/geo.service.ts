/**
 * Nearby freelancer discovery. Uses the Haversine formula in raw SQL —
 * fast enough at our scale (< 100k rows) without needing PostGIS.
 *
 * Returns freelancers within `radiusKm` of (lat, lon), sorted by distance,
 * with a lightweight profile payload for map markers + list rows.
 */
import { prisma } from '../lib/prisma.js';

const EARTH_KM = 6371;

export async function nearbyFreelancers(lat: number, lon: number, radiusKm: number, limit = 50) {
  // Cheap bounding-box pre-filter, then exact Haversine in a subquery so
  // we can filter on the computed distance without needing GROUP BY.
  const dLat = radiusKm / 111; // ~degrees per km latitude
  const dLon = radiusKm / (111 * Math.cos((lat * Math.PI) / 180) || 1);
  const rows = await prisma.$queryRaw<Array<{
    id: string; username: string; fullName: string; avatarUrl: string | null;
    title: string | null; city: string | null; rating: number; ratingCount: number;
    hourlyRateEtb: number | null; latitude: number; longitude: number;
    distanceKm: number;
  }>>`
    SELECT * FROM (
      SELECT "id", "username", "fullName", "avatarUrl", "title", "city",
             "rating", "ratingCount", "hourlyRateEtb", "latitude", "longitude",
             (
               ${EARTH_KM}::float * acos(
                 greatest(-1, least(1,
                   cos(radians(${lat}::float)) * cos(radians("latitude")) *
                   cos(radians("longitude") - radians(${lon}::float)) +
                   sin(radians(${lat}::float)) * sin(radians("latitude"))
                 ))
               )
             ) AS "distanceKm"
      FROM "User"
      WHERE "role" = 'FREELANCER'
        AND "isActive" = true
        AND "latitude" IS NOT NULL
        AND "longitude" IS NOT NULL
        AND "latitude" BETWEEN ${lat - dLat} AND ${lat + dLat}
        AND "longitude" BETWEEN ${lon - dLon} AND ${lon + dLon}
    ) AS c
    WHERE "distanceKm" <= ${radiusKm}::float
    ORDER BY "distanceKm" ASC
    LIMIT ${limit}
  `;
  return rows;
}
