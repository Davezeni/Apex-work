import { prisma } from '../../lib/prisma.js';
import { hashPassword } from '../../lib/hash.js';
import type { UserRole } from '@apex-work/shared';

export interface ImportRow {
  fullName: string;
  username?: string;
  phone?: string;
  email?: string;
  role?: UserRole;
  password?: string;
}

export interface ImportResult {
  created: number;
  skipped: number;
  errors: { line: number; message: string }[];
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 16) || 'user';
}

/**
 * Bulk-create user accounts from parsed CSV rows (admin onboarding). Each row
 * needs at least a `fullName`; user gets a UNIQUE username (sluggified, with a
 * numeric suffix on collision), optional phone/email, optional role, and an
 * optional plaintext password (hashed with bcrypt). Missing phone/email means
 * the account signs in via OTP once one is added.
 */
export async function importUsers(rows: ImportRow[]): Promise<ImportResult> {
  const result: ImportResult = { created: 0, skipped: 0, errors: [] };

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]!;
    const line = i + 2; // +2: header row is line 1
    try {
      const fullName = (r.fullName ?? '').trim();
      if (!fullName) {
        result.skipped++;
        result.errors.push({ line, message: 'Missing fullName' });
        continue;
      }
      const role: UserRole = r.role === 'FREELANCER' ? 'FREELANCER' : r.role === 'ADMIN' ? 'ADMIN' : 'CLIENT';
      const phone = r.phone?.trim() || null;
      const email = r.email?.trim() || null;

      if (phone) {
        const exists = await prisma.user.findUnique({ where: { phone } });
        if (exists) {
          result.skipped++;
          result.errors.push({ line, message: `Phone ${phone} already exists` });
          continue;
        }
      }
      if (email) {
        const exists = await prisma.user.findUnique({ where: { email } });
        if (exists) {
          result.skipped++;
          result.errors.push({ line, message: `Email ${email} already exists` });
          continue;
        }
      }

      // Generate a unique username if not provided.
      let username = (r.username?.trim() || slugify(fullName)).toLowerCase();
      let candidate = username;
      let n = 1;
      while (await prisma.user.findUnique({ where: { username: candidate } })) {
        candidate = `${username}${n++}`;
      }
      username = candidate;

      const passwordHash = r.password ? await hashPassword(r.password) : null;

      await prisma.user.create({
        data: {
          fullName,
          username,
          phone,
          email,
          role,
          avatarUrl: null,
          passwordHash,
          country: 'ET',
          isPhoneVerified: !!phone,
          isEmailVerified: !!email,
          isOnboarded: true,
          referralCode: `ref_import_${candidate.slice(0, 8)}_${Date.now().toString(36)}`,
        },
      });
      result.created++;
    } catch (err) {
      result.skipped++;
      result.errors.push({ line, message: (err as Error).message ?? 'Unknown error' });
    }
  }

  return result;
}

/** Very small CSV parser that respects quoted fields with commas. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(cur);
      cur = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cur);
      cur = '';
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
    } else {
      cur += ch;
    }
  }
  if (cur.trim() !== '' || row.length) {
    row.push(cur);
    if (row.some((c) => c.trim() !== '')) rows.push(row);
  }
  return rows;
}
