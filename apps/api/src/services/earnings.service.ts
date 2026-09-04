/**
 * User-facing downloadable receipts & monthly earnings statements.
 *
 * `receiptForOrder` loads a single order (with its payment + parties) and
 * builds a printable HTML receipt, enforcing that the caller is a party to the
 * order. `monthlyStatement` aggregates the caller's completed orders for a
 * given calendar month and builds an HTML earnings statement. Both reuse the
 * pure `lib/statement` builders.
 */
import { prisma } from '../lib/prisma.js';
import { buildOrderReceipt, buildMonthlyStatement, type StatementRow } from '../lib/statement.js';
import { NotFoundError, ForbiddenError } from '../lib/errors.js';

export async function receiptForOrder(orderId: string, userId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true, orderNumber: true, title: true, status: true, amountEtb: true,
      platformFeeEtb: true, sellerNetEtb: true, createdAt: true,
      clientId: true, sellerId: true,
      client: { select: { username: true, fullName: true } },
      seller: { select: { username: true, fullName: true } },
      payments: { select: { method: true, status: true, providerRef: true }, orderBy: { createdAt: 'desc' }, take: 1 },
    },
  });
  if (!order) throw new NotFoundError('Order');
  if (order.clientId !== userId && order.sellerId !== userId) throw new ForbiddenError('Not your order');

  const payment = order.payments[0];
  const { html, filename } = buildOrderReceipt({
    orderNumber: order.orderNumber,
    title: order.title,
    createdAt: order.createdAt,
    status: order.status,
    clientName: order.client.fullName || order.client.username,
    sellerName: order.seller.fullName || order.seller.username,
    amountEtb: order.amountEtb,
    platformFeeEtb: order.platformFeeEtb,
    sellerNetEtb: order.sellerNetEtb,
    paymentMethod: payment?.method ?? null,
    paymentStatus: payment?.status ?? null,
    providerRef: payment?.providerRef ?? null,
  });
  return { html, filename };
}

export async function monthlyStatement(userId: string, month: string) {
  // Validate/derive the month range (YYYY-MM).
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  const m = match ? Number(match[2]) : new Date().getMonth() + 1;
  const y = match ? Number(match[1]) : new Date().getFullYear();
  const monthLabel = `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}`;
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 1));

  const [orders, user] = await Promise.all([
    prisma.order.findMany({
      where: {
        sellerId: userId,
        status: 'COMPLETED',
        completedAt: { gte: start, lt: end },
      },
      select: {
        orderNumber: true, amountEtb: true, platformFeeEtb: true, sellerNetEtb: true,
        completedAt: true, createdAt: true,
        client: { select: { fullName: true, username: true } },
      },
      orderBy: { completedAt: 'asc' },
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { fullName: true, username: true } }),
  ]);

  const rows: StatementRow[] = orders.map((o) => ({
    date: o.completedAt ?? o.createdAt,
    orderNumber: o.orderNumber,
    clientName: o.client.fullName || o.client.username,
    amountEtb: o.amountEtb,
    platformFeeEtb: o.platformFeeEtb,
    sellerNetEtb: o.sellerNetEtb,
  }));

  const holder = user ? (user.fullName || user.username) : userId;
  return buildMonthlyStatement(monthLabel, rows, holder);
}
