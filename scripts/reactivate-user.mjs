/**
 * Reactivate an account that's been suspended (isActive = false).
 *
 * The ONLY thing that sets isActive=false in Apex-Work is the admin suspend
 * tool — there is no code path that auto-deactivates an account. So when a
 * user hits the login error "Account inactive", their row has isActive=false
 * (and likely a suspendedAt timestamp) and needs to be re-enabled.
 *
 * Usage (from the repo root, with DATABASE_URL set):
 *   node scripts/reactivate-user.mjs --phone "+251911111111"
 *   node scripts/reactivate-user.mjs --username "davezeni"
 *   node scripts/reactivate-user.mjs --id <userId>
 *   node scripts/reactivate-user.mjs --list   # show suspended accounts
 *
 * It is idempotent: reactivating an already-active account is a no-op, and it
 * will not touch a user if another flag (suspendedAt null, isActive true) says
 * they're fine. Safe to re-run.
 */
import { PrismaClient } from '@prisma/client';
import 'dotenv/config';

const prisma = new PrismaClient();

const args = process.argv.slice(2);
const opt = (flag) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
};

async function main() {
  if (args.includes('--list')) {
    const suspended = await prisma.user.findMany({
      where: { isActive: false },
      select: { id: true, username: true, phone: true, fullName: true, role: true, suspendedAt: true },
      orderBy: { suspendedAt: 'desc' },
      take: 50,
    });
    console.log(`\nSuspended accounts (${suspended.length}):`);
    if (!suspended.length) console.log('  (none)');
    for (const u of suspended) {
      console.log(
        `  ${u.id}  @${u.username}  ${u.phone ?? '—'}  ${u.fullName}  (${u.role})  suspendedAt=${u.suspendedAt?.toISOString() ?? '?'}`,
      );
    }
    return;
  }

  const where = {};
  if (opt('--id')) where.id = opt('--id');
  else if (opt('--username')) where.username = opt('--username');
  else if (opt('--phone')) where.phone = opt('--phone');
  else {
    console.error(
      'Provide --id <userId> | --username <username> | --phone <phone> (or --list to list suspended accounts).',
    );
    process.exit(2);
  }

  const user = await prisma.user.findUnique({ where });
  if (!user) {
    console.error(`No user found for ${JSON.stringify(where)}.`);
    process.exit(1);
  }

  if (user.isActive && !user.suspendedAt) {
    console.log(`@${user.username} (${user.id}) is already active — nothing to do.`);
    return;
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { isActive: true, suspendedAt: null },
    select: { id: true, username: true, isActive: true, suspendedAt: true },
  });
  console.log(`Reactivated @${updated.username} (${updated.id}): isActive=${updated.isActive}, suspendedAt=${updated.suspendedAt}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('Reactivate failed:', err?.message ?? err);
    await prisma.$disconnect().catch(() => undefined);
    process.exit(1);
  });
