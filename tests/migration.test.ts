import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { loadConfig } from '../server/config';
import { MemoryStore } from '../server/store';
import { MemoryBlobs } from '../server/blobs';
import { createApp } from '../server/app';
import { migrateToStore, type LegacySource } from '../server/multistoreMigration';

const legacy = (data: Record<string, Record<string, any>>, blobs: Record<string, Buffer>): LegacySource => ({
  collections: async () => Object.keys(data),
  async *docs(c) {
    for (const [id, d] of Object.entries(data[c])) yield { id, data: d };
  },
  blobNames: async () => Object.keys(blobs),
  readBlob: async (n) => (blobs[n] ? { data: blobs[n], contentType: 'image/jpeg' } : null)
});

describe('migration of the live store into store 1', () => {
  const config = loadConfig({ NODE_ENV: 'test', STORE: 'memory', JWT_SECRET: 'x'.repeat(48) });
  const src = legacy(
    { buyers: { '9820000001': { phone: '9820000001', firmName: 'Old Buyer', verified: true } }, products: { p1: { id: 'p1', sku: 'S1', title: 'Ring' } } },
    { ['photos/' + 'a'.repeat(32) + '.jpg']: Buffer.from('jpg') }
  );

  it('dry run writes nothing; apply copies; a re-run changes nothing; the founder store then serves the data', async () => {
    const root = new MemoryStore();
    const blobs = new MemoryBlobs();
    const run = (apply: boolean, overwrite = false) => migrateToStore({ src, root, blobs, id: 'bhakti', merchant: config.merchant, apply, overwrite });

    const dry = await run(false);
    expect(dry.record).toBe('created');
    expect(dry.docs.buyers.copied).toBe(1);
    expect(await root.get('stores', 'bhakti')).toBeNull();
    expect(await root.list('stores/bhakti/buyers')).toEqual([]);

    await run(true);
    const rec = (await root.get('stores', 'bhakti'))!;
    expect(rec.plan).toBe('founder');
    expect((await root.get('stores/bhakti/buyers', '9820000001'))!.firmName).toBe('Old Buyer');
    expect(await blobs.exists('stores/bhakti/photos/' + 'a'.repeat(32) + '.jpg')).toBe(true);

    await root.update('stores/bhakti/buyers', '9820000001', { firmName: 'Edited' });
    const again = await run(true);
    expect(again.docs.buyers).toEqual({ copied: 0, skipped: 1 });
    expect((await root.get('stores/bhakti/buyers', '9820000001'))!.firmName).toBe('Edited'); // never overwritten by default
    await run(true, true);
    expect((await root.get('stores/bhakti/buyers', '9820000001'))!.firmName).toBe('Old Buyer'); // final re-sync

    // the app serves the migrated data as the default store
    const app = createApp(config, root, blobs);
    expect((await request(app).get('/api/entitlements')).body.data.plan).toBe('founder');
    const login = await request(app).get('/api/products').set('Authorization', 'Bearer x');
    expect(login.status).toBe(401);
  });
});
