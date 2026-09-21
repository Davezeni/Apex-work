/**
 * One-click user data export (GDPR-style). Bundles a user's own records into
 * a portable JSON document the user can download. `buildExportPayload` is a
 * pure function (unit-testable); the service gathers the records and renders
 * the payload.
 */
import { prisma } from '../lib/prisma.js';

/** Input order shape (createdAt is a Date read from the DB). */
export interface ExportRecord {
  id: string;
  title: string;
  status: string;
  amountEtb: number;
  createdAt: Date;
  otherParty?: { id: string; username: string; fullName: string } | null;
  role: 'client' | 'seller';
}

/** Serialised order shape in the download (createdAt is an ISO string). */
export interface ExportOrderItem {
  id: string;
  title: string;
  status: string;
  amountEtb: number;
  createdAt: string;
  otherParty: { id: string; username: string; fullName: string } | null;
  role: 'client' | 'seller';
}

export interface ExportPayload {
  generatedAt: string;
  user: {
    id: string;
    username: string;
    fullName: string;
    email: string;
    phone: string;
    role: string;
    createdAt: string;
  };
  counts: { gigs: number; jobs: number; orders: number; reviews: number; conversations: number };
  gigs: { id: string; title: string; status: string; priceEtb: number; createdAt: string }[];
  jobs: {
    id: string;
    title: string;
    isOpen: boolean;
    budgetEtb: number | null;
    createdAt: string;
  }[];
  orders: ExportOrderItem[];
  reviews: {
    id: string;
    rating: number;
    comment: string | null;
    createdAt: string;
    direction: 'given' | 'received';
  }[];
}

/**
 * Pure mapper: transforms gathered records into the export payload.
 * Kept free of DB so it can be unit tested and so we never leak internal
 * relations into the user's download.
 */
export function buildExportPayload(input: {
  user: {
    id: string;
    username: string;
    fullName: string;
    email: string;
    phone: string;
    role: string;
    createdAt: Date;
  };
  gigs: { id: string; title: string; status: string; priceEtb: number; createdAt: Date }[];
  jobs: { id: string; title: string; isOpen: boolean; budgetEtb: number | null; createdAt: Date }[];
  orders: ExportRecord[];
  reviewsGiven: { id: string; rating: number; comment: string | null; createdAt: Date }[];
  reviewsReceived: { id: string; rating: number; comment: string | null; createdAt: Date }[];
  conversationCount: number;
}): ExportPayload {
  const iso = (d: Date) => d.toISOString();
  return {
    generatedAt: new Date().toISOString(),
    user: {
      id: input.user.id,
      username: input.user.username,
      fullName: input.user.fullName,
      email: input.user.email,
      phone: input.user.phone,
      role: input.user.role,
      createdAt: iso(input.user.createdAt),
    },
    counts: {
      gigs: input.gigs.length,
      jobs: input.jobs.length,
      orders: input.orders.length,
      reviews: input.reviewsGiven.length + input.reviewsReceived.length,
      conversations: input.conversationCount,
    },
    gigs: input.gigs.map((g) => ({
      id: g.id,
      title: g.title,
      status: g.status,
      priceEtb: g.priceEtb,
      createdAt: iso(g.createdAt),
    })),
    jobs: input.jobs.map((j) => ({
      id: j.id,
      title: j.title,
      isOpen: j.isOpen,
      budgetEtb: j.budgetEtb,
      createdAt: iso(j.createdAt),
    })),
    orders: input.orders.map((o) => ({
      id: o.id,
      title: o.title,
      status: o.status,
      amountEtb: o.amountEtb,
      createdAt: iso(o.createdAt),
      otherParty: o.otherParty
        ? { id: o.otherParty.id, username: o.otherParty.username, fullName: o.otherParty.fullName }
        : null,
      role: o.role,
    })),
    reviews: [
      ...input.reviewsGiven.map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        createdAt: iso(r.createdAt),
        direction: 'given' as const,
      })),
      ...input.reviewsReceived.map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        createdAt: iso(r.createdAt),
        direction: 'received' as const,
      })),
    ],
  };
}

/** Gather the authenticated user's records and render the export payload. */
export async function dataExport(userId: string): Promise<ExportPayload> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      fullName: true,
      email: true,
      phone: true,
      role: true,
      createdAt: true,
    },
  });
  const [
    gigs,
    jobs,
    ordersAsClient,
    ordersAsSeller,
    reviewsGiven,
    reviewsReceived,
    conversationCount,
  ] = await Promise.all([
    prisma.gig.findMany({
      where: { ownerId: userId },
      select: {
        id: true,
        title: true,
        status: true,
        createdAt: true,
        packages: { select: { priceEtb: true }, orderBy: { tier: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.job.findMany({
      where: { clientId: userId },
      select: {
        id: true,
        title: true,
        isOpen: true,
        budgetMinEtb: true,
        budgetMaxEtb: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.order.findMany({
      where: { clientId: userId },
      select: {
        id: true,
        title: true,
        status: true,
        amountEtb: true,
        createdAt: true,
        seller: { select: { id: true, username: true, fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.order.findMany({
      where: { sellerId: userId },
      select: {
        id: true,
        title: true,
        status: true,
        amountEtb: true,
        createdAt: true,
        client: { select: { id: true, username: true, fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.review.findMany({
      where: { authorId: userId },
      select: { id: true, rating: true, comment: true, createdAt: true },
    }),
    prisma.review.findMany({
      where: { subjectId: userId },
      select: { id: true, rating: true, comment: true, createdAt: true },
    }),
    prisma.conversation.count({ where: { members: { some: { userId } } } }),
  ]);

  const gigRows = gigs.map((g) => ({
    id: g.id,
    title: g.title,
    status: g.status,
    priceEtb: g.packages[0]?.priceEtb ?? 0,
    createdAt: g.createdAt,
  }));
  const jobRows = jobs.map((j) => ({
    id: j.id,
    title: j.title,
    isOpen: j.isOpen,
    budgetEtb: j.budgetMaxEtb ?? j.budgetMinEtb,
    createdAt: j.createdAt,
  }));
  const orders: ExportRecord[] = [
    ...ordersAsClient.map((o) => ({
      id: o.id,
      title: o.title,
      status: o.status,
      amountEtb: o.amountEtb,
      createdAt: o.createdAt,
      otherParty: o.seller,
      role: 'client' as const,
    })),
    ...ordersAsSeller.map((o) => ({
      id: o.id,
      title: o.title,
      status: o.status,
      amountEtb: o.amountEtb,
      createdAt: o.createdAt,
      otherParty: o.client,
      role: 'seller' as const,
    })),
  ];

  return buildExportPayload({
    user: { ...user, email: user.email ?? '', phone: user.phone ?? '' },
    gigs: gigRows,
    jobs: jobRows,
    orders,
    reviewsGiven,
    reviewsReceived,
    conversationCount,
  });
}

// ---------- XLSX workbook builder (structured Excel export) ----------
import ExcelJS from 'exceljs';

type SheetSpec = { name: string; rows: Record<string, unknown>[] };

function sheetSpecs(p: ExportPayload): SheetSpec[] {
  const summary = [
    { Field: 'Generated at', Value: p.generatedAt },
    { Field: 'Name', Value: p.user.fullName },
    { Field: 'Username', Value: p.user.username },
    { Field: 'Email', Value: p.user.email },
    { Field: 'Phone', Value: p.user.phone },
    { Field: 'Role', Value: p.user.role },
    { Field: 'Member since', Value: p.user.createdAt },
    { Field: 'Gigs', Value: p.counts.gigs },
    { Field: 'Jobs', Value: p.counts.jobs },
    { Field: 'Orders', Value: p.counts.orders },
    { Field: 'Reviews', Value: p.counts.reviews },
    { Field: 'Conversations', Value: p.counts.conversations },
  ];
  return [
    { name: 'Summary', rows: summary },
    { name: 'Gigs', rows: p.gigs as unknown as Record<string, unknown>[] },
    { name: 'Jobs', rows: p.jobs as unknown as Record<string, unknown>[] },
    { name: 'Orders', rows: p.orders as unknown as Record<string, unknown>[] },
    { name: 'Reviews', rows: p.reviews as unknown as Record<string, unknown>[] },
  ];
}

/**
 * Build the user's data export as a structured Excel workbook:
 * one sheet per entity, styled header row, sensible column widths.
 */
export async function buildExportWorkbook(payload: ExportPayload): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Apex-Work data export';
  wb.created = new Date(payload.generatedAt);

  for (const spec of sheetSpecs(payload)) {
    const ws = wb.addWorksheet(spec.name, {
      views: [{ state: 'frozen', ySplit: 1 }],
    });
    const columns =
      spec.rows.length > 0
        ? Object.keys(spec.rows[0] as Record<string, unknown>)
        : ['Field', 'Value'];
    ws.columns = columns.map((header) => ({
      header,
      key: header,
      width: Math.min(42, Math.max(12, header.length + 6)),
    }));
    const headerRow = ws.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D9488' } };
    for (const row of spec.rows) {
      ws.addRow(row);
    }
    ws.addRow([]); // breathing room
  }

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
