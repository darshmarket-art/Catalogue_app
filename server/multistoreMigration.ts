import type { Store } from './store';
import type { Blobs } from './blobs';
import type { MerchantConfig } from './merchant';
import { newStoreRecord } from './tenancy';

/** Where the legacy (single-store) data is read from. Doc ids matter, so this is not the Store interface. */
export interface LegacySource {
  collections(): Promise<string[]>;
  docs(collection: string): AsyncIterable<{ id: string; data: Record<string, any> }>;
  /** Object names of every legacy photo ("photos/<file>"). */
  blobNames(): Promise<string[]>;
  /** Bytes of one legacy object (also used for merchant.json). */
  readBlob(name: string): Promise<{ data: Buffer; contentType: string } | null>;
}

export interface MigrationReport {
  record: 'created' | 'exists';
  docs: Record<string, { copied: number; skipped: number }>;
  blobs: { copied: number; skipped: number };
}

/**
 * Copies a single-store deployment's data into the multi-store layout as store `id`:
 * collections -> stores/<id>/<collection>, photos/ -> stores/<id>/photos/, plus the stores/<id> record.
 * It only ever reads the legacy data and never deletes anything, so the old service keeps working untouched.
 * Existing documents in the new place are kept unless `overwrite` is set (use it for the final re-sync at cut-over).
 * With apply=false nothing is written (dry run); the report says what would be.
 */
export async function migrateToStore(o: {
  src: LegacySource;
  root: Store;
  /** Root blobs (unscoped); photos land under stores/<id>/. */
  blobs: Blobs;
  id: string;
  merchant: MerchantConfig;
  apply: boolean;
  overwrite?: boolean;
  /** Collections to leave out (bulky analytics can be copied in a later pass). */
  skip?: string[];
  progress?: (msg: string) => void;
}): Promise<MigrationReport> {
  const { src, root, blobs, id, apply } = o;
  const report: MigrationReport = { record: 'exists', docs: {}, blobs: { copied: 0, skipped: 0 } };

  if (!(await root.get('stores', id))) {
    report.record = 'created';
    if (apply) await root.create('stores', id, newStoreRecord(o.merchant, { plan: id === 'bhakti' ? 'founder' : 'basic' }) as any);
  }

  for (const col of await src.collections()) {
    if (col === 'stores' || o.skip?.includes(col)) continue;
    const r = (report.docs[col] = { copied: 0, skipped: 0 });
    o.progress?.(`collection ${col}...`);
    for await (const { id: docId, data } of src.docs(col)) {
      const target = `stores/${id}/${col}`;
      const exists = !o.overwrite && (await root.get(target, docId)) !== null;
      if (exists) r.skipped++;
      else {
        r.copied++;
        if (apply) await root.set(target, docId, data);
      }
    }
  }

  o.progress?.(`photos...`);
  for (const name of await src.blobNames()) {
    const target = `stores/${id}/${name}`;
    if (!o.overwrite && (await blobs.exists(target))) {
      report.blobs.skipped++;
      continue;
    }
    report.blobs.copied++;
    if (apply) {
      const b = await src.readBlob(name);
      if (b) await blobs.put(target, b.data, b.contentType);
    }
  }
  return report;
}
