import { describe, expect, it } from 'vitest';
import { normalizeEthiopianMsisdn } from './sms-msisdn.js';

describe('normalizeEthiopianMsisdn', () => {
  it('accepts already-normalized numbers', () => {
    expect(normalizeEthiopianMsisdn('251911234567')).toBe('251911234567');
  });
  it('strips the +251 international prefix', () => {
    expect(normalizeEthiopianMsisdn('+251911234567')).toBe('251911234567');
  });
  it('converts local 09 formats', () => {
    expect(normalizeEthiopianMsisdn('0911234567')).toBe('251911234567');
  });
  it('converts bare 9-digit numbers', () => {
    expect(normalizeEthiopianMsisdn('911234567')).toBe('251911234567');
  });
  it('ignores spaces and dashes', () => {
    expect(normalizeEthiopianMsisdn('+251 91-123 4567')).toBe('251911234567');
  });
  it('rejects landlines, short codes and garbage', () => {
    expect(normalizeEthiopianMsisdn('0111234567')).toBeNull();
    expect(normalizeEthiopianMsisdn('8726')).toBeNull();
    expect(normalizeEthiopianMsisdn('')).toBeNull();
    expect(normalizeEthiopianMsisdn('25191123456789')).toBeNull();
    expect(normalizeEthiopianMsisdn('not-a-phone')).toBeNull();
  });
});
