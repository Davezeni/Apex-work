/**
 * Admin CSV exports — audit log, orders and users, reusing the same service
 * queries (so filters stay consistent) and returning ready-to-serve CSV.
 */
import { prisma } from '../../lib/prisma.js';
import { toCsv, csvDate, csvInt } from '../../lib/csv.js';
import { listAudit } from './ops.service.js';

export interface CsvResult {
  filename: string;
  mime: string;
  csv: string;
}

export async function exportAudit(filter?: { adminId?: string; resourceType?: string }): Promise<CsvResult> {
  // Pull up to 10k recent rows (cursor pagination can resume from browser).
  const rows = await listAudit({ ...filter, limit: 10_000 });
  const csv = toCsv(
    ['id', 'at', 'admin', 'role', 'action', 'resourceType', 'resourceId', 'ip'],
    rows.map((r) => [
      r.id, csvDate(r.createdAt), r.adminName ?? r.adminId, r.adminRole ?? '', r.action,
      r.resourceType ?? '', r.resourceId ?? '', r.ip ?? '',
    ]),
  );
  return { filename: 'audit-log.csv', mime: 'text/csv', csv };
}

export async function exportOrders(filter?: { status?: string; q?: string }): Promise<CsvResult> {
  const rows = await prisma.order.findMany({
    where: {
      ...(filter?.status ? { status: filter.status as never } : {}),
      ...(filter?.q
        ? { OR: [{ title: { contains: filter.q, mode: 'insensitive' } }, { orderNumber: { contains: filter.q } }] }
        : {}),
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 10_000,
    select: {
      id: true, orderNumber: true, title: true, amountEtb: true, platformFeeEtb: true,
      sellerNetEtb: true, status: true, createdAt: true,
      client: { select: { username: true, fullName: true } },
      seller: { select: { username: true, fullName: true } },
    },
  });
  const csv = toCsv(
    ['id', 'orderNumber', 'title', 'amountEtb', 'platformFeeEtb', 'sellerNetEtb', 'status', 'createdAt', 'client', 'seller'],
    rows.map((o) => [
      o.id, o.orderNumber, o.title, csvInt(o.amountEtb), csvInt(o.platformFeeEtb), csvInt(o.sellerNetEtb),
      o.status, csvDate(o.createdAt), o.client.fullName, o.seller.fullName,
    ]),
  );
  return { filename: 'orders.csv', mime: 'text/csv', csv };
}

export async function exportUsers(filter?: { role?: string; q?: string; suspended?: boolean }): Promise<CsvResult> {
  const rows = await prisma.user.findMany({
    where: {
      ...(filter?.role ? { role: filter.role as never } : {}),
      ...(filter?.suspended !== undefined ? { suspendedAt: filter.suspended ? { not: null } : null } : {}),
      ...(filter?.q
        ? { OR: [{ username: { contains: filter.q, mode: 'insensitive' } }, { fullName: { contains: filter.q, mode: 'insensitive' } }] }
        : {}),
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 10_000,
    select: {
      id: true, username: true, fullName: true, phone: true, email: true, role: true,
      isPhoneVerified: true, isIdVerified: true, isActive: true, rating: true, completedOrders: true, createdAt: true,
    },
  });
  const csv = toCsv(
    ['id', 'username', 'fullName', 'phone', 'email', 'role', 'phoneVerified', 'idVerified', 'active', 'rating', 'completedOrders', 'createdAt'],
    rows.map((u) => [
      u.id, u.username, u.fullName, u.phone, u.email, u.role,
      u.isPhoneVerified, u.isIdVerified, u.isActive, csvInt(u.rating), csvInt(u.completedOrders), csvDate(u.createdAt),
    ]),
  );
  return { filename: 'users.csv', mime: 'text/csv', csv };
}
