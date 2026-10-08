import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { loadConfig } from '../server/config';
import { MemoryStore } from '../server/store';
import { MemoryBlobs } from '../server/blobs';
import { createApp } from '../server/app';
import { newStoreRecord, scopeStore } from '../server/tenancy';
import type { MerchantConfig } from '../server/merchant';
import { STATIC_CODE, otpBuyer } from './buyerAuth';

const KEY = 'test-master-provisioning-key';

async function build(plan: 'basic' | 'pro') {
  const config = { ...loadConfig({ NODE_ENV: 'test', STORE: 'memory', OTP_STATIC_CODE: STATIC_CODE, JWT_SECRET: 'x'.repeat(48), MASTER_PROVISIONING_KEY: KEY }), rateLimit: { auth: 1000, adminRegister: 1000, api: 100000, analytics: 100000 } };
  const root = new MemoryStore();
  await root.set('stores', 'bhakti', newStoreRecord(config.merchant as MerchantConfig, { plan }));
  const app = createApp(config, root, new MemoryBlobs());
  const reg = await request(app).post('/api/auth/admin/register').send({ email: 'o@example.com', password: 'AdminPass@2026', role: 'staff', masterProvisioningKey: KEY });
  const admin = { Authorization: `Bearer ${reg.body.sessionToken}` };
  const buyer = { Authorization: `Bearer ${(await otpBuyer(app, { phone: '9820000001', firmName: 'Test Jewellers' })).body.token}` };
  return { app, admin, buyer, store: scopeStore(root, 'bhakti') };
}

describe('WhatsApp enquiries', () => {
  it('a buyer records one; the admin of a Pro store lists it with the buyer from the account', async () => {
    const { app, admin, buyer } = await build('pro');
    const sent = await request(app).post('/api/enquiries').set(buyer).send({ kind: 'design', sku: 'R-1', title: 'Temple Haar', purity: '22K 916', firmName: 'Spoofed' });
    expect(sent.status).toBe(201);
    await request(app).post('/api/enquiries').set(buyer).send({ kind: 'shortlist', count: 4 });
    const list = await request(app).get('/api/admin/enquiries').set(admin);
    expect(list.status).toBe(200);
    expect(list.body.count).toBe(2);
    expect(list.body.data[0]).toMatchObject({ kind: 'shortlist', count: 4, buyerPhone: '9820000001', firmName: 'Test Jewellers' });
    expect(list.body.data[1]).toMatchObject({ kind: 'design', sku: 'R-1', firmName: 'Test Jewellers' });
  });

  it('reading is Pro: Basic gets 402, yet a Basic buyer can still record', async () => {
    const { app, admin, buyer } = await build('basic');
    expect((await request(app).post('/api/enquiries').set(buyer).send({ kind: 'order', count: 3 })).status).toBe(201);
    expect((await request(app).get('/api/admin/enquiries').set(admin)).status).toBe(402);
  });

  it('needs a buyer to record and an admin to read; bad bodies are 400', async () => {
    const { app, admin, buyer } = await build('pro');
    expect((await request(app).post('/api/enquiries').send({ kind: 'design' })).status).toBe(401);
    expect((await request(app).post('/api/enquiries').set(admin).send({ kind: 'design' })).status).toBe(403);
    expect((await request(app).get('/api/admin/enquiries').set(buyer)).status).toBe(403);
    expect((await request(app).post('/api/enquiries').set(buyer).send({ kind: 'nonsense' })).status).toBe(400);
  });

  it('the admin can remove a buyer (no owner-only check)', async () => {
    const { app, admin, buyer } = await build('pro');
    expect((await request(app).delete('/api/admin/buyers/9820000001').set(admin)).status).toBe(200);
    expect((await request(app).get('/api/auth/me').set(buyer)).status).toBe(401);
  });

  it('Reply marks an enquiry replied, and the admin summary counts what is waiting', async () => {
    const { app, admin, buyer } = await build('pro');
    await request(app).post('/api/enquiries').set(buyer).send({ kind: 'design', sku: 'R-1', title: 'Haar' });
    await request(app).post('/api/enquiries').set(buyer).send({ kind: 'shortlist', count: 2 });
    const before = await request(app).get('/api/admin/summary').set(admin);
    expect(before.body.data).toMatchObject({ newOrders: 0, enquiriesWaiting: 2, messagesFailed: 0 });
    const first = (await request(app).get('/api/admin/enquiries').set(admin)).body.data[0];
    expect((await request(app).post(`/api/admin/enquiries/${first.id}/replied`).set(admin)).status).toBe(200);
    expect((await request(app).get('/api/admin/summary').set(admin)).body.data.enquiriesWaiting).toBe(1);
    expect((await request(app).post('/api/admin/enquiries/nope/replied').set(admin)).status).toBe(404);
    expect((await request(app).get('/api/admin/summary').set(buyer)).status).toBe(403);
  });

  it('a Basic store has no waiting enquiries or orders to count', async () => {
    const { app, admin, buyer } = await build('basic');
    await request(app).post('/api/enquiries').set(buyer).send({ kind: 'design' });
    expect((await request(app).get('/api/admin/summary').set(admin)).body.data).toMatchObject({ newOrders: 0, enquiriesWaiting: 0 });
  });
});
