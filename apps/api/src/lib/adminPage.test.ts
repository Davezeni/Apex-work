import { describe, expect, it, vi, type Mock } from 'vitest';
import { paginate } from './adminPage.js';
import { encodeCursor } from './cursor.js';

const at = (iso: string) => new Date(iso);
const row = (i: number) => ({ createdAt: at(`2026-08-30T10:00:0${i % 10}Z`), id: `r${i}` });
type Row = ReturnType<typeof row>;
type Fetch = (opts: { limit: number; cursorWhere?: Record<string, unknown> }) => Promise<Row[]>;

function fakeReq(q: Record<string, string>) {
  return { query: q } as never;
}

describe('adminPage.paginate', () => {
  it('returns hasMore + cursor when the fetched page is full', async () => {
    const fetch = vi.fn<Fetch>().mockResolvedValue(Array.from({ length: 11 }, (_, i) => row(i)));
    const res = await paginate(fakeReq({ limit: '10' }), { fetch });
    expect(res.items).toHaveLength(10); // trims limit+1
    expect(res.hasMore).toBe(true);
    expect(res.cursor).toBeTruthy();
    // Fetch was told the (unsliced) limit + no cursor initially.
    expect(fetch).toHaveBeenCalledWith({ limit: 10, cursorWhere: undefined });
  });

  it('returns no cursor when the page is not full', async () => {
    const fetch = vi.fn<Fetch>().mockResolvedValue(Array.from({ length: 3 }, (_, i) => row(i)));
    const res = await paginate(fakeReq({ limit: '10' }), { fetch });
    expect(res.items).toHaveLength(3);
    expect(res.hasMore).toBe(false);
    expect(res.cursor).toBeNull();
  });

  it('decodes an incoming cursor into a where clause for the next page', async () => {
    const cursor = encodeCursor(at('2026-08-30T10:00:00Z'), 'r0');
    const fetch = vi.fn<Fetch>().mockResolvedValue([]);
    await paginate(fakeReq({ limit: '10', cursor }), { fetch });
    const arg = fetch.mock.calls[0]![0];
    expect(arg.cursorWhere).toBeDefined();
    expect(arg.cursorWhere!.OR).toHaveLength(2);
  });

  it('clamps the limit to safe bounds', async () => {
    const fetch = vi.fn<Fetch>().mockResolvedValue([]);
    await paginate(fakeReq({ limit: '99999' }), { fetch });
    expect(fetch.mock.calls[0]![0].limit).toBe(100); // MAX_LIMIT
    await paginate(fakeReq({ limit: '-3' }), { fetch });
    expect(fetch.mock.calls[1]![0].limit).toBe(1);
  });
});
