import type { Response } from 'express';
import type { ApiFailure, ApiSuccess } from '@apex-work/shared';

export const success = <T>(res: Response, data: T, statusCode = 200): Response => {
  const body: ApiSuccess<T> = { ok: true, data };
  return res.status(statusCode).json(body);
};

export const failure = (
  res: Response,
  code: string,
  message: string,
  statusCode = 400,
  details?: unknown,
): Response => {
  const body: ApiFailure = { ok: false, error: { code, message, details } };
  return res.status(statusCode).json(body);
};
