import { describe, expect, it, vi } from 'vitest';
import { success, failure } from './response.js';

function fakeRes() {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  return { res: { status, json } as never, status, json };
}

describe('response helpers', () => {
  it('success encodes {ok:true,data} with a default 200', () => {
    const { res, status, json } = fakeRes();
    success(res, { value: 1 });
    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith({ ok: true, data: { value: 1 } });
  });

  it('success honors an explicit status code', () => {
    const { res, status } = fakeRes();
    success(res, { id: 'x' }, 201);
    expect(status).toHaveBeenCalledWith(201);
  });

  it('failure encodes the standard ApiFailure shape', () => {
    const { res, status, json } = fakeRes();
    failure(res, 'NOT_FOUND', 'missing', 404, { detail: true });
    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({
      ok: false,
      error: { code: 'NOT_FOUND', message: 'missing', details: { detail: true } },
    });
  });
});
