// Benchmark server: the real app on an in-memory store seeded with N products (default 20,568, Bhakti's size). Nothing touches GCP.
//   PORT=4511 N=20568 npx tsx scripts/bench-serve.ts        then        BASE=http://127.0.0.1:4511 node scripts/bench-http.mjs
// Uses only APIs that also exist before the catalogue index, so the same file runs against an older checkout for the "before" numbers.
import http from 'node:http';
import { loadConfig } from '../server/config';
import { MemoryStore } from '../server/store';
import { MemoryBlobs } from '../server/blobs';
import { createApp } from '../server/app';
import { newStoreRecord, scopeStore } from '../server/tenancy';
import { makeProducts } from '../tests/catalogueData';

const N = Number(process.env.N ?? 20568);
const PORT = Number(process.env.PORT ?? 4511);
const config = {
  ...loadConfig({ NODE_ENV: 'test', STORE: 'memory', OTP_STATIC_CODE: '123456', JWT_SECRET: 'x'.repeat(48), MASTER_PROVISIONING_KEY: 'bench-master-key' }),
  rateLimit: { auth: 1e9, adminRegister: 1e9, api: 1e9, analytics: 1e9 }
};
const root = new MemoryStore();
await root.set('stores', 'bhakti', newStoreRecord(config.merchant as any, { plan: 'founder' }));
const data = scopeStore(root, 'bhakti');
for (const [i, name] of ['Rings', 'Bridal Chokers & Haar', 'Pendants', 'Jhumka', 'Bangles'].entries()) {
  await data.set('categories', `cat-${i}`, { id: `cat-${i}`, name, tag: 'Other', image: 'https://example.com/c.jpg', createdAt: new Date(1e12 + i).toISOString() });
}
for (const d of makeProducts(N)) await data.set('products', d.id, d);
http.createServer(createApp(config, root, new MemoryBlobs())).listen(PORT, '127.0.0.1', () => console.log(`bench server on ${PORT} with ${N} products`));
