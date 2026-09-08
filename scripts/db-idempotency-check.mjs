/**
 * CI-only database-level financial idempotency check.
 *
 * Requires a reachable Postgres (DATABASE_URL) with the migrations already
 * applied (`prisma migrate deploy`). Verifies that the unique key
 * `Transaction(userId, type, relatedId)` actually rejects a duplicate financial
 * event — the guarantee that makes retried/duplicate webhooks, callback
 * verifications and cron runs unable to double-credit or double-debit a wallet.
 *
 * Exits non-zero on failure so the CI pipeline blocks a broken guarantee.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const uniqueIndexExists = await findUniqueIndex();
  if (!uniqueIndexExists) {
    throw new Error(
      'Expected unique index "Transaction_userId_type_relatedId_key" on Transaction(userId,type,relatedId) was not found.',
    );
  }
  console.log('✔ Idempotency unique index present on Transaction(userId, type, relatedId).');

  // Create a throwaway user so the FK on Transaction is satisfied.
  const user = await prisma.user.create({
    data: {
      phone: '+2519' + Math.floor(100000000 + Math.random() * 899999999).toString(),
      fullName: 'CI Idempotency Check',
      username: 'ci_idem_' + Math.random().toString(36).slice(2, 10),
      email: `ci-${Date.now()}@example.com`,
    },
  });

  const relatedId = 'ci-idem-' + Math.random().toString(36).slice(2, 10);
  const ledger = {
    userId: user.id,
    type: 'MANUAL_ADJUSTMENT',
    amountEtb: 123,
    description: 'CI idempotency probe',
    relatedId,
  };

  // First insert must succeed.
  await prisma.transaction.create({ data: ledger });
  console.log('✔ First record of a (user, type, relatedId) event succeeded.');

  // A duplicate insert of the SAME financial event must be rejected.
  let rejected = false;
  try {
    await prisma.transaction.create({ data: ledger });
  } catch (err) {
    if (err && err.code === 'P2002') rejected = true;
  }
  if (!rejected) {
    throw new Error('Duplicate (user,type,relatedId) ledger row was NOT rejected — idempotency broken.');
  }
  console.log('✔ Duplicate (user, type, relatedId) ledger row correctly rejected (P2002).');

  // Clean up the test user (cascade removes the probe transactions).
  await prisma.user.delete({ where: { id: user.id } });
  console.log('✔ Cleaned up probe user + transaction rows.');
  console.log('\nDB-level financial idempotency: PASS.');
}

async function findUniqueIndex() {
  const rows = await prisma.$queryRaw`
    SELECT indexname
    FROM pg_indexes
    WHERE tablename = 'Transaction'
      AND indexname = 'Transaction_userId_type_relatedId_key';
  `;
  return Array.isArray(rows) && rows.length > 0;
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('\nDB-level financial idempotency check failed:', err?.message ?? err);
    await prisma.$disconnect().catch(() => undefined);
    process.exit(1);
  });
