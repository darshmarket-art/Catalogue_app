// Copies the live single-store Firestore data and photos into the multi-store layout (see docs/multistore-design.md).
// DRY RUN by default. Never deletes anything; the old service keeps reading the old locations.
//   npx tsx scripts/migrate-multistore.ts --store bhakti                      (dry run, prints counts)
//   npx tsx scripts/migrate-multistore.ts --store bhakti --apply --confirm-project <gcp-project-id> [--overwrite] [--skip a,b,c]
// Needs GOOGLE_CLOUD_PROJECT, STORAGE_BUCKET and credentials (gcloud ADC).
import fs from 'node:fs';
import path from 'node:path';
import { Firestore } from '@google-cloud/firestore';
import { Storage } from '@google-cloud/storage';
import { FirestoreStore } from '../server/store.ts';
import { GcsBlobs } from '../server/blobs.ts';
import { parseMerchant } from '../server/merchant.ts';
import { migrateToStore, type LegacySource } from '../server/multistoreMigration.ts';

const args = process.argv.slice(2);
const flag = (n: string) => args.includes(`--${n}`);
const val = (n: string) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : undefined);
const id = val('store') || 'bhakti';
const apply = flag('apply');
const bucketName = process.env.STORAGE_BUCKET;
if (!bucketName) throw new Error('Set STORAGE_BUCKET to the merchant bucket.');

const projectId = process.env.GOOGLE_CLOUD_PROJECT;
if (!projectId) throw new Error('Set GOOGLE_CLOUD_PROJECT so the target project is explicit.');
const db = new Firestore({ projectId });
if (apply && val('confirm-project') !== projectId) {
  throw new Error(`Refusing to write: pass --confirm-project ${projectId} to confirm this is the project you mean.`);
}
const bucket = new Storage().bucket(bucketName);

const src: LegacySource = {
  async collections() {
    return (await db.listCollections()).map((c) => c.id);
  },
  async *docs(col) {
    for (const d of (await db.collection(col).get()).docs) yield { id: d.id, data: d.data() };
  },
  async blobNames() {
    const [files] = await bucket.getFiles({ prefix: 'photos/' });
    return files.map((f) => f.name);
  },
  async readBlob(name) {
    const f = bucket.file(name);
    const [data] = await f.download();
    const [meta] = await f.getMetadata();
    return { data, contentType: meta.contentType ?? 'application/octet-stream' };
  }
};

// A merchant.json in the bucket (if any) is what the live service uses today, so it wins over the copy in the repo.
const live = await src.readBlob('merchant.json').catch(() => null);
const raw = live ? JSON.parse(live.data.toString('utf8')) : JSON.parse(fs.readFileSync(path.resolve('merchants', id, 'merchant.json'), 'utf8'));
const merchant = parseMerchant(raw, live ? 'merchant.json in storage' : `merchants/${id}/merchant.json`, id);

const report = await migrateToStore({ src, root: new FirestoreStore(), blobs: new GcsBlobs(bucketName), id, merchant, apply, overwrite: flag('overwrite'), skip: (val('skip') ?? '').split(',').filter(Boolean), progress: (msg) => console.log(msg) });
console.log(apply ? 'APPLIED' : 'DRY RUN (nothing written)', `store=${id} project=${projectId}`);
console.log(JSON.stringify(report, null, 2));
