/**
 * Availability iCalendar feed.
 *
 * Given a freelancer's availabilityJson (7×9 grid of 2-hour slots), we
 * synthesize a recurring VEVENT per (day, contiguous-slot-run) so that
 * calendar apps show "Kaleb — Working hours" every week.
 *
 * We intentionally return ONE feed that anyone subscribing to
 * `/v1/users/{username}/availability.ics` can add to their calendar
 * (Google Calendar → Add via URL → paste). No auth; the feed contains
 * no PII beyond the freelancer's public name.
 */

const DAY_MAP: Record<string, string> = {
  Mon: 'MO', Tue: 'TU', Wed: 'WE', Thu: 'TH', Fri: 'FR', Sat: 'SA', Sun: 'SU',
};
const HOUR_STARTS = ['06', '08', '10', '12', '14', '16', '18', '20', '22'];

interface AvailabilityInput {
  hours?: Record<string, boolean[]>;
  timezone?: string;
  vacation?: boolean;
}

interface UserFacts {
  username: string;
  fullName: string;
}

export function buildAvailabilityIcs(user: UserFacts, av: AvailabilityInput | null): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Apex-Work//Availability//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(user.fullName)} — Working hours`,
    `X-WR-TIMEZONE:${av?.timezone ?? 'Africa/Addis_Ababa'}`,
  ];

  const av2 = av ?? {};
  if (av2.vacation) {
    // Whole-day event today so subscribers see "On vacation" immediately.
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    lines.push(
      'BEGIN:VEVENT',
      `UID:vacation-${user.username}-${y}${m}${d}@apex-work.com`,
      `DTSTAMP:${icsNow()}`,
      `DTSTART;VALUE=DATE:${y}${m}${d}`,
      `DTEND;VALUE=DATE:${y}${m}${d}`,
      `SUMMARY:${escapeText(user.fullName)} — On vacation`,
      'RRULE:FREQ=DAILY;COUNT=7',
      'END:VEVENT',
    );
  } else if (av2.hours) {
    for (const [day, slots] of Object.entries(av2.hours)) {
      const byday = DAY_MAP[day];
      if (!byday || !slots) continue;
      // Collapse contiguous available slots into one VEVENT per range.
      let runStart = -1;
      for (let i = 0; i <= slots.length; i++) {
        const on = i < slots.length && slots[i] === true;
        if (on && runStart < 0) runStart = i;
        if ((!on || i === slots.length) && runStart >= 0) {
          const startH = HOUR_STARTS[runStart];
          const endH = HOUR_STARTS[i] ?? '23'; // fall off end → 23:00
          if (startH && endH && startH !== endH) {
            const uid = `avail-${user.username}-${day}-${runStart}-${i}@apex-work.com`;
            lines.push(
              'BEGIN:VEVENT',
              `UID:${uid}`,
              `DTSTAMP:${icsNow()}`,
              // Next occurrence of `day` at startH:00.
              `DTSTART;TZID=${av2.timezone ?? 'Africa/Addis_Ababa'}:${nextByDay(byday)}T${startH}0000`,
              `DTEND;TZID=${av2.timezone ?? 'Africa/Addis_Ababa'}:${nextByDay(byday)}T${endH}0000`,
              `RRULE:FREQ=WEEKLY;BYDAY=${byday}`,
              `SUMMARY:${escapeText(user.fullName)} — Available`,
              `DESCRIPTION:Working hours on Apex-Work`,
              'END:VEVENT',
            );
          }
          runStart = -1;
        }
      }
    }
  }

  lines.push('END:VCALENDAR');
  // CRLF is required by RFC 5545.
  return lines.join('\r\n') + '\r\n';
}

function icsNow(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const h = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  const ss = String(d.getUTCSeconds()).padStart(2, '0');
  return `${y}${m}${dd}T${h}${mm}${ss}Z`;
}

// Given a two-letter iCal weekday (MO..SU), return the next matching
// date as a YYYYMMDD string. This ensures DTSTART is in the future,
// which some calendar clients require for RRULE to expand correctly.
function nextByDay(byday: string): string {
  const map: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
  const target = map[byday] ?? 1;
  const now = new Date();
  const diff = (target - now.getDay() + 7) % 7 || 7;
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diff);
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

function escapeText(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}
