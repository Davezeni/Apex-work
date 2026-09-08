import { describe, expect, it } from 'vitest';
import { updateProfileSchema } from '@apex-work/shared';

describe('updateProfileSchema', () => {
  it('accepts a full profile update', () => {
    const res = updateProfileSchema.safeParse({
      fullName: 'Dawit Tamiru',
      bio: 'Full stack dev',
      city: 'Addis Ababa',
      title: 'Developer',
      hourlyRateEtb: 500,
      avatarUrl: 'https://example.com/a.png',
      email: 'd@example.com',
      latitude: 9.01,
      longitude: 38.75,
    });
    expect(res.success).toBe(true);
  });

  it('accepts null for every nullable field (the profile editor sends null to clear)', () => {
    const res = updateProfileSchema.safeParse({
      fullName: 'Dawit Tamiru',
      bio: null,
      city: null,
      title: null,
      hourlyRateEtb: null,
      avatarUrl: null,
      email: null,
      latitude: null,
      longitude: null,
    });
    expect(res.success).toBe(true);
  });

  it('accepts a partial update (only a name change)', () => {
    expect(updateProfileSchema.safeParse({ fullName: 'Aster Kebede' }).success).toBe(true);
  });

  it('still rejects invalid values', () => {
    expect(updateProfileSchema.safeParse({ bio: 'x'.repeat(2001) }).success).toBe(false);
    expect(updateProfileSchema.safeParse({ hourlyRateEtb: 2_000_000 }).success).toBe(false);
    expect(updateProfileSchema.safeParse({ email: 'not-an-email' }).success).toBe(false);
  });
});
