import { describe, it, expect } from 'vitest';
import { sanitiseAnnouncement } from './announcement.js';

describe('sanitiseAnnouncement', () => {
  it('returns null for missing/empty/invalid input', () => {
    expect(sanitiseAnnouncement(null)).toBeNull();
    expect(sanitiseAnnouncement('')).toBeNull();
    expect(sanitiseAnnouncement({})).toBeNull();
    expect(sanitiseAnnouncement({ text: '   ' })).toBeNull();
  });

  it('defaults tone to info and trims text, clamping length', () => {
    const a = sanitiseAnnouncement({ text: '  Welcome!  ', tone: 'weird' });
    expect(a?.text).toBe('Welcome!');
    expect(a?.tone).toBe('info');
    expect(a?.href).toBeUndefined();
    const long = sanitiseAnnouncement({ text: 'x'.repeat(500) });
    expect(long?.text.length).toBe(240);
  });

  it('preserves promo/urgent tone and valid hrefs', () => {
    const a = sanitiseAnnouncement({ text: 'Spring sale', tone: 'promo', href: '/browse', cta: 'Shop' });
    expect(a?.tone).toBe('promo');
    expect(a?.href).toBe('/browse');
    expect(a?.cta).toBe('Shop');
    const b = sanitiseAnnouncement({ text: 'x', tone: 'urgent', href: 'https://example.com' });
    expect(b?.tone).toBe('urgent');
    expect(b?.href).toBe('https://example.com');
  });

  it('rejects unsafe hrefs (strip cta) and clamps lengths', () => {
    const a = sanitiseAnnouncement({ text: 'x', href: 'javascript:alert(1)', cta: 'Go' });
    expect(a?.href).toBeUndefined();
    expect(a?.cta).toBeUndefined();
    const b = sanitiseAnnouncement({ text: 'x', href: '/' + 'a'.repeat(500) });
    expect(b?.href?.length).toBe(300);
  });
});
