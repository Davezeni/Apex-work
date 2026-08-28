import { Router } from 'express';
import { asyncHandler } from '../lib/asyncHandler.js';
import { success } from '../lib/response.js';
import { logger } from '../config/logger.js';
import { confirmPaymentByTxRef } from '../services/orders.service.js';
import { chapa } from '../services/chapa.service.js';
import { env } from '../config/env.js';

const router: Router = Router();

/**
 * Chapa webhook.
 *
 * The app-level middleware captures the raw bytes before express.json(). We:
 *   1. Verify either Chapa signature header when a webhook secret is set.
 *   2. Extract tx_ref from common Chapa payload shapes/query variants.
 *   3. Re-verify the transaction against Chapa's API — never trust payload.
 *   4. Advance the order to ACTIVE exactly once.
 */
router.post(
  '/webhook',
  asyncHandler(async (req, res) => {
    const raw = Buffer.isBuffer(req.body)
      ? req.body.toString('utf8')
      : JSON.stringify(req.body ?? {});
    const headers = [
      req.headers['chapa-signature'],
      req.headers['x-chapa-signature'],
    ].flatMap((value) => (Array.isArray(value) ? value : value ? [value] : []));

    if (env.CHAPA_WEBHOOK_SECRET) {
      const verified = headers.some((signature) =>
        chapa.verifyWebhookSignature(raw, signature),
      );
      if (!verified) {
        logger.warn({ hasSignature: headers.length > 0 }, 'Chapa webhook signature verification failed');
        return res.status(401).json({ ok: false });
      }
    }

    let payload: Record<string, unknown> = {};
    try {
      payload = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    } catch {
      logger.warn('Chapa webhook body was not JSON');
    }

    const nested = payload.data && typeof payload.data === 'object'
      ? payload.data as Record<string, unknown>
      : {};
    const query = req.query as { tx_ref?: string; trx_ref?: string };
    const txRef = [
      payload.tx_ref,
      payload.trx_ref,
      nested.tx_ref,
      nested.trx_ref,
      query.tx_ref,
      query.trx_ref,
    ].find((value): value is string => typeof value === 'string' && value.length > 0);

    if (!txRef || !txRef.startsWith('apex-')) {
      logger.warn({ payloadKeys: Object.keys(payload), query }, 'Chapa webhook missing tx_ref');
      return res.status(200).json({ ok: true, ignored: true });
    }

    try {
      await confirmPaymentByTxRef(txRef);
    } catch (err) {
      // Return 200 so Chapa does not retry a transaction that is already being
      // verified; the order page's return verification/polling is the second
      // safety net and the error is available in Render logs.
      logger.error({ err, txRef }, 'confirmPaymentByTxRef failed');
    }
    return res.status(200).json({ ok: true });
  }),
);

/**
 * GET /payments/config — public config the frontend needs.
 * Exposes the public key + whether payments are enabled.
 */
router.get(
  '/config',
  asyncHandler(async (_req, res) => {
    return success(res, {
      enabled: chapa.isConfigured(),
      publicKey: env.CHAPA_PUBLIC_KEY ?? null,
    });
  }),
);

export default router;
