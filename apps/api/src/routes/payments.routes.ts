import { Router } from 'express';
import express from 'express';
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
 * Chapa POSTs here after checkout completion. We:
 *   1. Verify the signature if CHAPA_WEBHOOK_SECRET is configured
 *      (recommended for production; skip in dev).
 *   2. Extract tx_ref from either body or query string (Chapa varies).
 *   3. Re-verify against Chapa's API — NEVER trust the payload alone.
 *   4. Advance the order to ACTIVE.
 *
 * Always respond 200 quickly so Chapa doesn't retry unnecessarily.
 * Any processing errors get logged but don't fail the webhook.
 */
router.post(
  '/webhook',
  // Use a raw body parser so signature verification sees the exact bytes.
  express.raw({ type: '*/*', limit: '512kb' }),
  asyncHandler(async (req, res) => {
    const raw = req.body instanceof Buffer ? req.body.toString('utf8') : '';
    const signature = req.headers['chapa-signature'] as string | undefined ??
                      req.headers['x-chapa-signature'] as string | undefined;

    if (env.CHAPA_WEBHOOK_SECRET) {
      const ok = chapa.verifyWebhookSignature(raw, signature);
      if (!ok) {
        logger.warn({ signature }, 'Chapa webhook signature verification failed');
        return res.status(401).json({ ok: false });
      }
    }

    let payload: Record<string, unknown> = {};
    try {
      payload = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    } catch {
      logger.warn('Chapa webhook body was not JSON');
    }

    const query = req.query as { tx_ref?: string; trx_ref?: string };
    const txRef =
      (payload.tx_ref as string | undefined) ??
      (payload.trx_ref as string | undefined) ??
      query.tx_ref ??
      query.trx_ref;

    if (!txRef || !txRef.startsWith('apex-')) {
      logger.warn({ payload, query: req.query }, 'Chapa webhook missing tx_ref');
      return res.status(200).json({ ok: true, ignored: true });
    }

    try {
      await confirmPaymentByTxRef(txRef);
    } catch (err) {
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
