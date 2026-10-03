// Exports one store's data (every collection under stores/<id>) to a JSON file, with the store record.
//   npx tsx scripts/export-store.ts --store bhakti --out bhakti-export.json
// Photos are not inlined; copy them with: gcloud storage cp -r gs://<bucket>/stores/<id>/ <dest>
import fs from 'node:fs';
import { Firestore } from '@google-cloud/firestore';

const args = process.argv.slice(2);
const val = (n: string) => args[args.indexOf(`--${n}`) + 1];
const id = val('store');
const out = val('out') || `${id}-export.json`;
if (!id) throw new Error('Usage: --store <id> [--out file.json]');

const db = new Firestore();
const ref = db.doc(`stores/${id}`);
const record = await ref.get();
if (!record.exists) throw new Error(`No such store: ${id}`);
const collections: Record<string, Record<string, unknown>> = {};
for (const col of await ref.listCollections()) {
  collections[col.id] = Object.fromEntries((await col.get()).docs.map((d) => [d.id, d.data()]));
}
fs.writeFileSync(out, JSON.stringify({ exportedAt: new Date().toISOString(), store: record.data(), collections }, null, 2));
console.log(`Wrote ${out}: ${Object.keys(collections).length} collections`);
