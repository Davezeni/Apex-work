import { describe, it, expect } from 'vitest';
import { escapeCell, toCsv, csvDate, csvInt } from './csv.js';

describe('escapeCell', () => {
  it('leaves plain values untouched', () => {
    expect(escapeCell('hello')).toBe('hello');
    expect(escapeCell(42)).toBe('42');
    expect(escapeCell(null)).toBe('');
    expect(escapeCell(undefined)).toBe('');
  });

  it('quotes cells containing commas, quotes or newlines', () => {
    expect(escapeCell('a,b')).toBe('"a,b"');
    expect(escapeCell('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCell('line1\nline2')).toBe('"line1\nline2"');
  });
});

describe('toCsv', () => {
  it('writes a header row plus rows with CRLF line endings', () => {
    const out = toCsv(['a', 'b', 'c'], [[1, 'x,y', true]]);
    expect(out).toBe('a,b,c\r\n1,"x,y",true\r\n');
  });

  it('always ends with a newline', () => {
    const out = toCsv(['a'], [[1], [2]]);
    expect(out.endsWith('\r\n')).toBe(true);
    expect(out.match(/\r\n/g)?.length).toBe(3);
  });
});

describe('csvDate', () => {
  it('ISO-formats a Date and parses ISO strings', () => {
    expect(csvDate(new Date('2026-09-01T12:00:00.000Z'))).toBe('2026-09-01T12:00:00.000Z');
    expect(csvDate('2026-09-01T00:00:00.000Z')).toBe('2026-09-01T00:00:00.000Z');
  });
  it('returns empty string for null/undefined/invalid', () => {
    expect(csvDate(null)).toBe('');
    expect(csvDate('nope')).toBe('');
  });
});

describe('csvInt', () => {
  it('formats numbers with thousands separators, defaulting to 0', () => {
    expect(csvInt(1234567)).toBe('1,234,567');
    expect(csvInt(null)).toBe('0');
  });
});
