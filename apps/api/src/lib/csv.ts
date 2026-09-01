/**
 * Minimal CSV serialisation (RFC 4180). Pure + unit-testable; used by the
 * admin export endpoints. Returns UTF-8 CSV text with a trailing newline.
 */

/** Escape a single cell: quote if it needs it, double any internal quotes. */
export function escapeCell(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Build a CSV document from a header row and rows of mixed-typed cells. */
export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [escapeCsvLine(headers), ...rows.map(escapeCsvLine)];
  return `${lines.join('\r\n')}\r\n`;
}

function escapeCsvLine(cells: unknown[]): string {
  return cells.map(escapeCell).join(',');
}

/** Convert an ISO date (or Date) to a readable local date string. */
export function csvDate(value: Date | string | null | undefined): string {
  if (!value) return '';
  const d = typeof value === 'string' ? new Date(value) : value;
  return Number.isNaN(d.getTime()) ? '' : d.toISOString();
}

/** ETB integer → plain integer string (no currency symbol in CSVs). */
export function csvInt(value: unknown): string {
  return Number(value ?? 0).toLocaleString('en-US');
}
