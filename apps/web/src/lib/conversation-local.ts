// Per-user conversation preferences (pin / archive) stored locally. Keeping these
// on-device avoids a schema migration; they re-sort the inbox live.

type Rec = Record<string, true>;

const PIN_KEY = (uid: string) => `apex.conv.pin.${uid}`;
const ARCHIVE_KEY = (uid: string) => `apex.conv.archive.${uid}`;

function read(key: string): Rec {
  if (typeof window === 'undefined') return {};
  try {
    return (JSON.parse(window.localStorage.getItem(key) ?? '{}') as Rec) ?? {};
  } catch {
    return {};
  }
}

function write(key: string, val: Rec): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(val));
  } catch {
    /* ignore */
  }
}

export const getPinned = (userId: string): Rec => read(PIN_KEY(userId));
export const getArchived = (userId: string): Rec => read(ARCHIVE_KEY(userId));

export function togglePinned(userId: string, convId: string): Rec {
  const r = getPinned(userId);
  if (r[convId]) delete r[convId];
  else r[convId] = true;
  write(PIN_KEY(userId), r);
  return r;
}

export function toggleArchived(userId: string, convId: string): Rec {
  const r = getArchived(userId);
  if (r[convId]) delete r[convId];
  else r[convId] = true;
  write(ARCHIVE_KEY(userId), r);
  return r;
}
