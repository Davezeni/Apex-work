import { describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { validate } from './validate.js';
import { ValidationError } from '../lib/errors.js';

function fakeReq(source: Record<string, unknown>) {
  return { body: {}, query: {}, params: {}, ...source } as Request;
}

describe('validate middleware', () => {
  it('coerces and replaces the body with the parsed data on success', () => {
    const schema = z.object({ amount: z.coerce.number(), title: z.string() });
    const req = fakeReq({ body: { amount: '100', title: 'hi' } });
    let nextErr: unknown;
    validate(schema)(req, {} as Response, (e) => (nextErr = e));
    expect(nextErr).toBeUndefined();
    expect((req as unknown as { body: { amount: number } }).body.amount).toBe(100);
  });

  it('wraps a failed parse in ValidationError', () => {
    const schema = z.object({ amount: z.number().min(1) });
    const req = fakeReq({ body: { amount: 0 } });
    let nextErr: unknown;
    validate(schema)(req, {} as Response, (e) => (nextErr = e));
    expect(nextErr).toBeInstanceOf(ValidationError);
  });

  it('validates from querystring when asked', () => {
    const schema = z.object({ status: z.enum(['OPEN', 'CLOSED']) });
    const req = fakeReq({ query: { status: 'OPEN' } });
    let nextErr: unknown;
    validate(schema, 'query')(req, {} as Response, (e) => (nextErr = e));
    expect(nextErr).toBeUndefined();
  });
});
