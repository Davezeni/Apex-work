// Client-side scheduled ("send later") queue, persisted in localStorage.
// Messages are held locally and sent over the wire when `at` arrives while the
// app is open & online. Safe: a cancelled/due-skipped entry stays local only.

export interface ScheduledSend {
  id: string;
  conversationId: string;
  body?: string;
  attachmentUrl?: string;
  attachmentType?: 'image' | 'audio' | 'video' | 'file';
  attachmentMeta?: Record<string, unknown>;
  replyToId?: string;
  clientId: string;
  at: number; // epoch ms
}

const KEY = (cid: string) => `apex.scheduled.${cid}`;

export function listScheduled(conversationId: string): ScheduledSend[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEY(conversationId));
    if (!raw) return [];
    const arr = JSON.parse(raw) as ScheduledSend[];
    return Array.isArray(arr) ? arr.sort((a, b) => a.at - b.at) : [];
  } catch {
    return [];
  }
}

function persist(conversationId: string, items: ScheduledSend[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY(conversationId), JSON.stringify(items));
  } catch {
    /* storage full/unavailable — ignore */
  }
}

export function addScheduled(item: ScheduledSend): ScheduledSend[] {
  const items = listScheduled(item.conversationId);
  const next = [...items, item];
  persist(item.conversationId, next);
  return next;
}

export function removeScheduled(conversationId: string, id: string): ScheduledSend[] {
  const next = listScheduled(conversationId).filter((it) => it.id !== id);
  persist(conversationId, next);
  return next;
}

export function makeClientId(): string {
  return `c_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
