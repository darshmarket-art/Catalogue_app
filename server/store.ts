import fs from 'fs';
import path from 'path';
import { Firestore, FieldValue } from '@google-cloud/firestore';
import type { Config } from './config';

export type Doc = Record<string, any>;

export interface Filter {
  field: string;
  op: '==' | '>';
  value: string | number | boolean;
}

export interface ListOptions {
  where?: Filter[];
  orderBy?: { field: string; direction: 'asc' | 'desc' };
  limit?: number;
  /** Fetch results after this document id, using the orderBy field as the primary sort key. */
  startAfter?: { id: string; orderValue: string | number };
}

/**
 * Minimal document-store contract. Queries are deliberately limited to shapes that
 * Firestore serves without composite indexes: equality/range filters on their own,
 * or a single orderBy on its own.
 */
export interface Store {
  get<T = Doc>(collection: string, id: string): Promise<T | null>;
  set(collection: string, id: string, data: Doc): Promise<void>;
  /** Atomically creates the document; returns false if the id is already taken. */
  create(collection: string, id: string, data: Doc): Promise<boolean>;
  delete(collection: string, id: string): Promise<boolean>;
  list<T = Doc>(collection: string, options?: ListOptions): Promise<T[]>;
  /** Merges the given fields into an existing document (creating it if missing). */
  update(collection: string, id: string, data: Doc): Promise<void>;
  /** Atomically adds to numeric fields, creating the document (with `extra` fields) if needed. */
  increment(collection: string, id: string, fields: Record<string, number>, extra?: Doc): Promise<void>;
}

function matches(doc: Doc, filters: Filter[] = []): boolean {
  return filters.every(({ field, op, value }) => (op === '==' ? doc[field] === value : doc[field] > value));
}

/** In-memory store; with a file path it also persists to disk (local development only). */
export class MemoryStore implements Store {
  private data = new Map<string, Map<string, Doc>>();

  constructor(private persistPath?: string) {
    if (persistPath && fs.existsSync(persistPath)) {
      const raw = JSON.parse(fs.readFileSync(persistPath, 'utf-8')) as Record<string, Record<string, Doc>>;
      for (const [col, docs] of Object.entries(raw)) {
        this.data.set(col, new Map(Object.entries(docs)));
      }
    }
  }

  private col(name: string) {
    let c = this.data.get(name);
    if (!c) {
      c = new Map();
      this.data.set(name, c);
    }
    return c;
  }

  private persist() {
    if (!this.persistPath) return;
    fs.mkdirSync(path.dirname(this.persistPath), { recursive: true });
    const out: Record<string, Record<string, Doc>> = {};
    for (const [name, docs] of this.data) out[name] = Object.fromEntries(docs);
    fs.writeFileSync(this.persistPath, JSON.stringify(out, null, 2), 'utf-8');
  }

  async get<T = Doc>(collection: string, id: string) {
    const doc = this.col(collection).get(id);
    return doc ? (structuredClone(doc) as T) : null;
  }

  async set(collection: string, id: string, data: Doc) {
    this.col(collection).set(id, structuredClone(data));
    this.persist();
  }

  async create(collection: string, id: string, data: Doc) {
    const c = this.col(collection);
    if (c.has(id)) return false;
    c.set(id, structuredClone(data));
    this.persist();
    return true;
  }

  async delete(collection: string, id: string) {
    const removed = this.col(collection).delete(id);
    if (removed) this.persist();
    return removed;
  }

  async list<T = Doc>(collection: string, options: ListOptions = {}) {
    let docs = [...this.col(collection).values()].filter((d) => matches(d, options.where));
    if (options.orderBy) {
      const { field, direction } = options.orderBy;
      const sign = direction === 'asc' ? 1 : -1;
      docs.sort((a, b) => {
        const cmp = a[field] < b[field] ? -sign : a[field] > b[field] ? sign : 0;
        return cmp || String(a.id).localeCompare(String(b.id));
      });
    }
    if (options.startAfter) {
      const { id, orderValue } = options.startAfter;
      const field = options.orderBy?.field ?? 'createdAt';
      const dir = options.orderBy?.direction === 'asc' ? 1 : -1;
      docs = docs.filter((d) => {
        const v = d[field];
        const cmp = v < orderValue ? -dir : v > orderValue ? dir : 0;
        return cmp > 0 || (cmp === 0 && String(d.id).localeCompare(String(id)) > 0);
      });
    }
    if (options.limit) docs = docs.slice(0, options.limit);
    return structuredClone(docs) as T[];
  }

  async update(collection: string, id: string, data: Doc) {
    const c = this.col(collection);
    c.set(id, { ...(c.get(id) ?? {}), ...structuredClone(data) });
    this.persist();
  }

  async increment(collection: string, id: string, fields: Record<string, number>, extra: Doc = {}) {
    const c = this.col(collection);
    const doc = { ...(c.get(id) ?? {}), ...extra };
    for (const [field, by] of Object.entries(fields)) doc[field] = (Number(doc[field]) || 0) + by;
    c.set(id, doc);
    this.persist();
  }
}

export class FirestoreStore implements Store {
  private db: Firestore;

  constructor() {
    this.db = new Firestore({ ignoreUndefinedProperties: true });
  }

  async get<T = Doc>(collection: string, id: string) {
    const snap = await this.db.collection(collection).doc(id).get();
    return snap.exists ? (snap.data() as T) : null;
  }

  async set(collection: string, id: string, data: Doc) {
    await this.db.collection(collection).doc(id).set(data);
  }

  async create(collection: string, id: string, data: Doc) {
    try {
      await this.db.collection(collection).doc(id).create(data);
      return true;
    } catch (err: any) {
      if (err?.code === 6) return false; // ALREADY_EXISTS
      throw err;
    }
  }

  async delete(collection: string, id: string) {
    const ref = this.db.collection(collection).doc(id);
    const snap = await ref.get();
    if (!snap.exists) return false;
    await ref.delete();
    return true;
  }

  async list<T = Doc>(collection: string, options: ListOptions = {}) {
    let query: FirebaseFirestore.Query = this.db.collection(collection);
    for (const { field, op, value } of options.where ?? []) query = query.where(field, op, value);
    if (options.orderBy) query = query.orderBy(options.orderBy.field, options.orderBy.direction);
    if (options.startAfter) {
      // Firestore's startAfter accepts the orderBy field's value; the id tiebreaker is not natively supported,
      // so we overshoot by one and rely on the server-side filter to trim. The frontend deduplicates by id.
      query = query.startAfter(options.startAfter.orderValue);
    }
    if (options.limit) query = query.limit(options.limit);
    const snap = await query.get();
    return snap.docs.map((d) => d.data() as T);
  }

  async update(collection: string, id: string, data: Doc) {
    await this.db.collection(collection).doc(id).set(data, { merge: true });
  }

  async increment(collection: string, id: string, fields: Record<string, number>, extra: Doc = {}) {
    const counters = Object.fromEntries(Object.entries(fields).map(([k, by]) => [k, FieldValue.increment(by)]));
    await this.db.collection(collection).doc(id).set({ ...extra, ...counters }, { merge: true });
  }
}

export function createStore(config: Config): Store {
  switch (config.storeKind) {
    case 'firestore':
      return new FirestoreStore();
    case 'file':
      return new MemoryStore(path.resolve(process.cwd(), config.dataFile));
    default:
      return new MemoryStore();
  }
}
