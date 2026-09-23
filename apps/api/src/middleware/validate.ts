import type { NextFunction, Request, Response } from 'express';
import type { ZodTypeAny, z } from 'zod';
import { ValidationError } from '../lib/errors.js';

type Source = 'body' | 'query' | 'params';

/**
 * Validates request[source] against a Zod schema.
 * On success, replaces request[source] with the parsed (and coerced) data.
 */
export const validate =
  <S extends ZodTypeAny>(schema: S, source: Source = 'body') =>
  (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const details = result.error.flatten();
      return next(new ValidationError(details));
    }
    // Express 5: `req.query` (and `req.params`) are GETTER-ONLY — assigning
    // `req.query = parsed` throws "Cannot set property query of
    // #<IncomingMessage>", and the getter returns a FRESH object per access,
    // so mutating it in place is silently lost. Shadow the prototype getter
    // with an own writable property instead — every later `req.query` read
    // (handlers, services) then sees the coerced data. `body` stays a normal
    // property, so plain assignment remains safe there.
    if (source === 'body') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (req as any).body = result.data;
    } else {
      Object.defineProperty(req, source, {
        value: result.data,
        writable: true,
        enumerable: true,
        configurable: true,
      });
    }
    next();
  };
