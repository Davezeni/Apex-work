import { describe, expect, it } from 'vitest';
import express from 'express';
import { z } from 'zod';
import type { Server } from 'node:http';
import { validate } from './validate.js';
import { ValidationError } from '../lib/errors.js';

/**
 * Express-5 regression guard (incident: every GET with query validation
 * crashed with "Cannot set property query of #<IncomingMessage> which has
 * only a getter" — prod outage). Express 5 makes req.query getter-only and
 * the getter returns a FRESH object per access, so both assignment and
 * in-place mutation are broken. The middleware shadows the getter via
 * Object.defineProperty; these tests exercise the REAL middleware over real
 * HTTP so a regression fails loudly.
 */

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
  q: z.string().trim().max(80).optional(),
});

function buildApp() {
  const app = express();
  app.get(
    '/probe',
    validate(listQuerySchema, 'query'),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (req, res) => res.json({ echoed: req.query as any }),
  );
  app.use(
    (err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      const status = err instanceof ValidationError ? 400 : 500;
      res.status(status).json({ ok: false });
    },
  );
  return app;
}

async function withServer(run: (base: string) => Promise<void>): Promise<void> {
  const app = buildApp();
  const server: Server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.on('listening', resolve));
  const addr = server.address();
  if (!addr || typeof addr === 'string') throw new Error('no address');
  try {
    await run(`http://127.0.0.1:${addr.port}`);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((e) => (e ? reject(e) : resolve())),
    );
  }
}

describe('validate(query) under Express 5', () => {
  it('serves GET with query validation (no "Cannot set property query" crash)', async () => {
    await withServer(async (base) => {
      const res = await fetch(`${base}/probe?limit=3&q=tea`);
      expect(res.status).toBe(200);
    });
  });

  it('hands the handler COERCED + defaulted values (shadowing actually takes effect)', async () => {
    await withServer(async (base) => {
      const res = await fetch(`${base}/probe?limit=3&q=tea`);
      const body = (await res.json()) as { echoed: { limit: number; q: string } };
      // the getter-fresh-object trap: in-place mutation would leave these as
      // raw strings / undefined — only defineProperty shadowing coerces them
      expect(body.echoed.limit).toBe(3);
      expect(typeof body.echoed.limit).toBe('number');
      expect(body.echoed.q).toBe('tea');
    });
  });

  it('applies schema defaults for absent params', async () => {
    await withServer(async (base) => {
      const res = await fetch(`${base}/probe`);
      const body = (await res.json()) as { echoed: { limit: number } };
      expect(res.status).toBe(200);
      expect(body.echoed.limit).toBe(10);
    });
  });

  it('still rejects invalid queries with 400', async () => {
    await withServer(async (base) => {
      const res = await fetch(`${base}/probe?limit=999`);
      expect(res.status).toBe(400);
    });
  });
});
