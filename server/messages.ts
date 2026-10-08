import crypto from 'crypto';
import type { Store } from './store';

export type MessageKind = 'otp' | 'signup-otp' | 'admin-reset' | 'order' | 'store-full' | 'test' | 'trial';
export type MessageStatus = 'accepted' | 'sent' | 'delivered' | 'read' | 'failed';
export type FailureKind = 'not-on-whatsapp' | 'undeliverable' | 'other';

export interface MessageDoc {
  id: string;
  storeId: string | null;
  kind: MessageKind;
  /** Digits with country code. Masked before it reaches an owner. */
  to: string;
  wamid: string | null;
  status: MessageStatus;
  failure?: FailureKind;
  errorCode?: number | null;
  errorTitle?: string;
  createdAt: string;
  createdMs: number;
  updatedAt: string;
  receiptAt?: string;
}

export interface StatusError { code?: number; title?: string; message?: string }

export const RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
const PRUNE_EVERY_MS = 6 * 60 * 60 * 1000;
// accepted < sent < delivered < read; failed is final for that message.
const RANK: Record<MessageStatus, number> = { accepted: 0, sent: 1, delivered: 2, read: 3, failed: 4 };

/** Buyer-facing reason for a failed delivery; Meta error codes stay in the owner's view only. */
export function failureOf(code: number | null | undefined): FailureKind {
  if (code === 131026) return 'not-on-whatsapp';
  if (code === 131047 || code === 131049 || code === 130472 || code === 131053) return 'undeliverable';
  return 'other';
}

export const isStatus = (s: unknown): s is MessageStatus => typeof s === 'string' && s in RANK;

export function createMessageLog(root: Store) {
  let lastPrune = 0;

  const prune = async (now = Date.now()) => {
    lastPrune = now;
    for (const m of await root.list<MessageDoc>('messages')) {
      if (now - m.createdMs > RETENTION_MS) {
        await root.delete('messages', m.id);
        if (m.wamid) await root.delete('wamids', m.wamid);
      }
    }
  };

  return {
    /** Logs an attempt as `accepted` (with the Meta id) or `failed` (with the send error). */
    async record(input: { storeId: string | null; kind: MessageKind; to: string; wamid?: string | null; error?: string | null; errorCode?: number | null }, now = Date.now()): Promise<MessageDoc> {
      const at = new Date(now).toISOString();
      const doc: MessageDoc = {
        id: `msg-${crypto.randomUUID()}`, storeId: input.storeId, kind: input.kind, to: input.to, wamid: input.wamid ?? null,
        status: input.error ? 'failed' : 'accepted', createdAt: at, createdMs: now, updatedAt: at,
        ...(input.error ? { failure: failureOf(input.errorCode), errorCode: input.errorCode ?? null, errorTitle: input.error.slice(0, 200) } : {})
      };
      await root.set('messages', doc.id, doc);
      if (doc.wamid) await root.set('wamids', doc.wamid, { id: doc.wamid, messageId: doc.id, storeId: doc.storeId });
      if (now - lastPrune > PRUNE_EVERY_MS) prune(now).catch(() => {});
      return doc;
    },

    get: (id: string) => root.get<MessageDoc>('messages', id),

    /** A status receipt from Meta. Out-of-order and duplicate receipts never move a message backwards. */
    async applyStatus(wamid: string, status: MessageStatus, timestampSec: number | null, errors: StatusError[] = [], now = Date.now()): Promise<MessageDoc | null> {
      const idx = await root.get<{ messageId: string }>('wamids', wamid);
      const doc = idx ? await root.get<MessageDoc>('messages', idx.messageId) : null;
      if (!doc) return null;
      if (doc.status === 'failed' || RANK[status] <= RANK[doc.status]) return doc;
      const e = errors[0];
      const patch: Partial<MessageDoc> = {
        status,
        updatedAt: new Date(now).toISOString(),
        receiptAt: new Date(timestampSec ? timestampSec * 1000 : now).toISOString(),
        ...(status === 'failed' ? { failure: failureOf(e?.code), errorCode: e?.code ?? null, errorTitle: (e?.title ?? e?.message ?? 'Not delivered').slice(0, 200) } : {})
      };
      await root.update('messages', doc.id, patch);
      return { ...doc, ...patch };
    },

    /** Newest first, within retention. */
    async listForStore(storeId: string, now = Date.now()): Promise<MessageDoc[]> {
      const rows = await root.list<MessageDoc>('messages', { where: [{ field: 'storeId', op: '==', value: storeId }] });
      return rows.filter((m) => now - m.createdMs <= RETENTION_MS).sort((a, b) => b.createdMs - a.createdMs);
    },

    async listSince(sinceMs: number): Promise<MessageDoc[]> {
      return (await root.list<MessageDoc>('messages')).filter((m) => m.createdMs >= sinceMs);
    },

    async touchReceipt(now = Date.now()) {
      await root.set('settings', 'whatsapp-receipts', { id: 'whatsapp-receipts', lastAt: new Date(now).toISOString() });
    },
    async lastReceiptAt(): Promise<string | null> {
      return (await root.get<{ lastAt: string }>('settings', 'whatsapp-receipts'))?.lastAt ?? null;
    },
    prune
  };
}
export type MessageLog = ReturnType<typeof createMessageLog>;

/** Counts an owner cares about, over the given rows. */
export function deliverySummary(rows: MessageDoc[]) {
  const delivered = rows.filter((m) => m.status === 'delivered' || m.status === 'read').length;
  const failed = rows.filter((m) => m.status === 'failed').length;
  const settled = delivered + failed;
  return { total: rows.length, delivered, failed, deliveredRate: settled ? Math.round((delivered / settled) * 100) : null };
}
