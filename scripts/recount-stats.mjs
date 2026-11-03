// Compares a store's design counters (stores/<id>/settings/catalogueStats) with its products.
// DRY RUN by default: it only READS (one scan of the store's products, one read of the counter document) and prints the difference.
//   npx tsx scripts/recount-stats.mjs --store bhakti                        (dry run)
//   npx tsx scripts/recount-stats.mjs --all                                 (dry run, every store)
//   npx tsx scripts/recount-stats.mjs --store bhakti --apply --confirm-project <gcp-project-id>
// --apply rewrites the counter document only (never a product). The console's "Recount store" button does the same for one store.
// Needs GOOGLE_CLOUD_PROJECT and credentials (gcloud ADC).
import { FirestoreStore } from '../server/store.ts';
import { scopeStore } from '../server/tenancy.ts';
import { CatalogueStore } from '../server/catalogueIndex.ts';

const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const val = (n) => (flag(n) ? args[args.indexOf(`--${n}`) + 1] : undefined);
const apply = flag('apply');
const projectId = process.env.GOOGLE_CLOUD_PROJECT;
if (!projectId) throw new Error('Set GOOGLE_CLOUD_PROJECT so the target project is explicit.');
if (apply && val('confirm-project') !== projectId) {
  throw new Error(`Refusing to write: pass --confirm-project ${projectId} to confirm this is the project you mean.`);
}

const root = new FirestoreStore();
const ids = flag('all') ? (await root.list('stores')).map((s) => s.id) : [val('store') || 'bhakti'];
for (const id of ids) {
  const cat = new CatalogueStore(scopeStore(root, id));
  const { stored, actual, drift } = await cat.check(); // read-only
  console.log(`${id}: counters ${stored ? `total=${stored.total}${stored.stale ? ' (untrusted)' : ''}` : 'missing'}, products say total=${actual.total} in ${Object.keys(actual.byCat).length} collections -> ${drift ? 'DRIFT' : 'ok'}`);
  if (drift && apply) {
    const r = await cat.recount();
    console.log(`  rewritten: total=${r.after.total}, rev=${r.after.rev}`);
  } else if (drift) {
    console.log('  (dry run: nothing written; add --apply --confirm-project to fix. A missing/untrusted doc is also rebuilt lazily on the first request.)');
  }
}
