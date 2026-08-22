import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../lib/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { optionalAuth } from '../middleware/auth.js';
import { success } from '../lib/response.js';
import * as geo from '../services/geo.service.js';
import { cache } from '../middleware/cache.js';

const router: Router = Router();

const nearbyQuery = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
  radiusKm: z.coerce.number().min(0.5).max(500).default(20),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

/**
 * GET /geo/nearby-freelancers?lat=&lon=&radiusKm= — public map endpoint.
 * Cached 60s per unique lat/lon/radius; typical map interactions land on
 * a stable rounded coord so cache hit rate is very high in practice.
 */
router.get(
  '/nearby-freelancers',
  optionalAuth,
  validate(nearbyQuery, 'query'),
  cache({ ttlSeconds: 60, swrAfterSeconds: 20 }),
  asyncHandler(async (req, res) => {
    const q = req.query as unknown as z.infer<typeof nearbyQuery>;
    const items = await geo.nearbyFreelancers(q.lat, q.lon, q.radiusKm, q.limit);
    return success(res, { items });
  }),
);

export default router;
