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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (req as any)[source] = result.data as z.infer<S>;
    next();
  };
