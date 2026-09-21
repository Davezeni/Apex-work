import type { ErrorRequestHandler, RequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { AppError, NotFoundError, ValidationError } from '../lib/errors.js';
import { logger } from '../config/logger.js';
import { failure } from '../lib/response.js';
import { isProd } from '../config/env.js';
import { captureException } from '../config/sentry.js';

/** 404 for unmatched routes */
export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(new NotFoundError('Route'));
};

/** Global error handler — MUST be the LAST middleware */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  // ZodError from `.parse()` calls that weren't wrapped
  if (err instanceof ZodError) {
    return failure(res, 'VALIDATION_ERROR', 'Validation failed', 400, err.flatten());
  }

  // Prisma known errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      // Unique constraint violation
      const target = (err.meta?.target as string[] | undefined)?.join(', ') ?? 'field';
      return failure(res, 'CONFLICT', `Duplicate value for ${target}`, 409);
    }
    if (err.code === 'P2025') {
      return failure(res, 'NOT_FOUND', 'Resource not found', 404);
    }
    logger.warn({ err, code: err.code }, 'Prisma known error');
    return failure(res, 'DB_ERROR', 'Database error', 400);
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    return failure(res, 'VALIDATION_ERROR', 'Invalid database query', 400);
  }

  // Malformed request bodies (express.json SyntaxError etc.) — client error,
  // NOT a server fault: must not 500 or pollute Sentry.
  if (
    (err as Error)?.name === 'SyntaxError' ||
    (err as { type?: string })?.type === 'entity.parse.failed' ||
    (err as { type?: string })?.type === 'entity.too.large'
  ) {
    const tooLarge = (err as { type?: string })?.type === 'entity.too.large';
    return failure(
      res,
      tooLarge ? 'PAYLOAD_TOO_LARGE' : 'BAD_JSON',
      tooLarge ? 'Request body too large' : 'Malformed JSON body',
      tooLarge ? 413 : 400,
    );
  }

  // Our typed errors
  if (err instanceof AppError) {
    if (err instanceof ValidationError) {
      return failure(res, err.code, err.message, err.statusCode, err.details);
    }
    return failure(res, err.code, err.message, err.statusCode, err.details);
  }

  // Fallback — unexpected
  logger.error(
    {
      err,
      errName: (err as Error)?.name,
      errMessage: (err as Error)?.message,
      errStack: (err as Error)?.stack?.split('\n').slice(0, 5),
      path: req.path,
      method: req.method,
    },
    'Unhandled error',
  );
  captureException(err);
  return failure(
    res,
    'INTERNAL_ERROR',
    isProd ? 'Something went wrong' : ((err as Error)?.message ?? 'Unknown error'),
    500,
  );
};
