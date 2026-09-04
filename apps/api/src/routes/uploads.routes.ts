import { Router } from 'express';
import { signUploadSchema, uploadBucketSchema } from '@apex-work/shared';
import { asyncHandler } from '../lib/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { success } from '../lib/response.js';
import { BadRequestError, ConflictError } from '../lib/errors.js';
import { storage } from '../services/storage.service.js';

const router: Router = Router();

/**
 * GET /files/:id — stream a self-hosted file back to the client.
 * Public (unguessable cuid id) so <img>/<audio> tags load without auth, like a
 * public storage bucket. Served from the Postgres object store.
 */
router.get(
  '/files/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string };
    const { prisma } = await import('../lib/prisma.js');
    const row = await prisma.upload.findUnique({ where: { id }, select: { data: true, contentType: true, bucket: true, sizeBytes: true } });
    if (!row) throw new BadRequestError('File not found');
    res.setHeader('Content-Type', row.contentType);
    res.setHeader('Content-Length', String(row.sizeBytes));
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    // Inline images/audio, attach otherwise.
    if (row.contentType.startsWith('image/') || row.contentType.startsWith('audio/') || row.contentType.startsWith('video/')) {
      res.setHeader('Content-Disposition', 'inline');
    } else {
      res.setHeader('Content-Disposition', 'attachment');
    }
    return res.send(Buffer.isBuffer(row.data) ? row.data : Buffer.from(row.data));
  }),
);

router.use(requireAuth);

/**
 * POST /uploads/sign — mint a one-shot signed upload URL.
 * Client will then PUT directly to Supabase Storage.
 * We validate size + MIME here (defense-in-depth with bucket policies).
 */
router.post(
  '/sign',
  validate(signUploadSchema),
  asyncHandler(async (req, res) => {
    if (!storage.isConfigured()) {
      throw new ConflictError('File uploads are not configured on this environment');
    }
    const body = req.body as import('@apex-work/shared').SignUploadInput;

    const check = storage.validate(body);
    if (!check.ok) throw new BadRequestError(check.error ?? 'Invalid upload');

    const result = await storage.createSignedUpload({
      ...body,
      ownerId: req.user!.sub,
      contentType: check.contentType,
    });
    return success(res, result);
  }),
);

/**
 * PUT /uploads/proxy — authenticated raw-byte fallback.
 *
 * A browser can fail the cross-origin Supabase PUT even when the signed URL
 * is valid (in-app browsers, strict privacy modes, or a mobile firewall).
 * This endpoint accepts the file as the request body and streams it into a
 * bounded in-memory buffer before sending it to Supabase with service_role.
 * It deliberately does not use multipart/form-data, so no multer/temp disk is
 * required on Render's free tier.
 *
 * Query string:
 *   bucket   one of portfolio, chat-attachments, avatars
 *   filename original filename (used for MIME inference and safe object name)
 */
router.put(
  '/proxy',
  asyncHandler(async (req, res) => {
    if (!storage.isConfigured()) {
      throw new ConflictError('File uploads are not configured on this environment');
    }

    const query = req.query as { bucket?: unknown; filename?: unknown };
    const bucketResult = uploadBucketSchema.safeParse(query.bucket);
    if (!bucketResult.success) throw new BadRequestError('Invalid upload bucket');

    const filename = typeof query.filename === 'string' ? query.filename.trim() : '';
    if (!filename || filename.length > 120) {
      throw new BadRequestError('A valid filename is required');
    }

    const rawContentType = req.headers['content-type'];
    const contentType = Array.isArray(rawContentType)
      ? (rawContentType[0] ?? 'application/octet-stream')
      : rawContentType || 'application/octet-stream';
    const rawLength = req.headers['content-length'];
    const declaredSizeBytes = rawLength ? Number(rawLength) : undefined;

    if (declaredSizeBytes !== undefined && (!Number.isFinite(declaredSizeBytes) || declaredSizeBytes < 0)) {
      throw new BadRequestError('Invalid upload size');
    }

    // Validate type before consuming the body. The service checks the final
    // byte count again while reading, including when Content-Length is absent.
    const check = storage.validate({
      bucket: bucketResult.data,
      filename,
      contentType,
      sizeBytes: Math.max(1, declaredSizeBytes ?? 1),
    });
    if (!check.ok) throw new BadRequestError(check.error ?? 'Invalid upload');

    const result = await storage.uploadProxy(req, {
      bucket: bucketResult.data,
      filename,
      contentType: check.contentType,
      declaredSizeBytes,
      ownerId: req.user!.sub,
    });
    return success(res, result);
  }),
);

export default router;
