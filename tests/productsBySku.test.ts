import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { loadConfig } from '../server/config';
import { MemoryStore } from '../server/store';
import { MemoryBlobs } from '../server/blobs';
import { createApp } from '../server/app';
import { newStoreRecord, scopeStore } from '../server/tenancy';
import { seedDemoCatalogue } from '../server/seed';
import type { MerchantConfig } from '../server/merchant';
import { STATIC_CODE, otpBuyer } from './buyerAuth';

const KEY = 'test-master-provisioning-key';

async function build() {
  const config = { ...loadConfig({ NODE_ENV: 'test', STORE: 'memory', OTP_STATIC_CODE: STATIC_CODE, JWT_SECRET: 'x'.repeat(48), MASTER_PROVISIONING_KEY: KEY, SEED_DEMO_CATALOGUE: 'true' }), rateLimit: { auth: 1000, adminRegister: 1000, api: 100000, analytics: 100000 } };
  const root = new MemoryStore();
  await root.set('stores', 'bhakti', newStoreRecord(config.merchant as MerchantConfig, { plan: 'pro' }));
  await seedDemoCatalogue(scopeStore(root, 'bhakti'), 'bhakti');
  const app = createApp(config, root, new MemoryBlobs());
  const reg = await request(app).post('/api/auth/admin/register').send({ email: 'o@example.com', password: 'AdminPass@2026', role: 'owner', masterProvisioningKey: KEY });
  const admin = { Authorization: `Bearer ${reg.body.sessionToken}` };
  const buyer = { Authorization: `Bearer ${(await otpBuyer(app, { phone: '9820000001', firmName: 'Test Jewellers' })).body.token}` };
  const cats = (await request(app).get('/api/categories').set(admin)).body.data as Array<{ id: string; name: string; image: string }>;
  return { app, admin, buyer, cats };
}

describe('designs by SKU (shortlist)', () => {
  it('returns the requested designs wherever they sit, and ignores unknown SKUs', async () => {
    const { app, buyer } = await build();
    const all = (await request(app).get('/api/products?limit=500').set(buyer)).body.data as Array<{ sku: string }>;
    const want = [all[all.length - 1].sku, all[0].sku];
    const res = await request(app).get(`/api/products/by-sku?skus=${want.join(',')},NOPE`).set(buyer);
    expect(res.status).toBe(200);
    expect((res.body.data as Array<{ sku: string }>).map((p) => p.sku).sort()).toEqual([...want].sort());
  });
});
