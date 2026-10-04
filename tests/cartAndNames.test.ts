import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { loadConfig } from '../server/config';
import { MemoryStore } from '../server/store';
import { MemoryBlobs } from '../server/blobs';
import { createApp } from '../server/app';
import { seedDemoCatalogue } from '../server/seed';
import { newStoreRecord, scopeStore } from '../server/tenancy';
import { STATIC_CODE, otpBuyer } from './buyerAuth';

const KEY = 'test-master-provisioning-key';

async function build() {
  const config = { ...loadConfig({ NODE_ENV: 'test', STORE: 'memory', OTP_STATIC_CODE: STATIC_CODE, JWT_SECRET: 'x'.repeat(48), MASTER_PROVISIONING_KEY: KEY }), rateLimit: { auth: 1000, adminRegister: 1000, api: 100000, analytics: 100000 } };
  const root = new MemoryStore();
  await root.set('stores', 'bhakti', newStoreRecord(config.merchant, { plan: 'pro' }));
  await seedDemoCatalogue(scopeStore(root, 'bhakti'), 'bhakti');
  const app = createApp(config, root, new MemoryBlobs());
  const reg = await request(app).post('/api/auth/admin/register').send({ email: 'o@example.com', password: 'AdminPass@2026', masterProvisioningKey: KEY });
  return { app, root, admin: { Authorization: `Bearer ${reg.body.sessionToken}` } };
}

describe('the order: one line per design', () => {
  it('adding the same design again raises the quantity instead of making a second line', async () => {
    const { app } = await build();
    const t = await otpBuyer(app, { firmName: 'Ramesh Shah', phone: '9820000011' });
    const auth = { Authorization: `Bearer ${t.body.token}` };
    const add = (batchQty: number, sku = 'B2B-COIN-0010') => request(app).post('/api/orders/items').set(auth).send({ sku, batchQty });
    const first = await add(2);
    expect(first.status).toBe(201);
    const again = await add(3);
    expect(again.status).toBe(200);
    expect(again.body.data.id).toBe(first.body.data.id);
    expect(again.body.data.batchQty).toBe(5);
    const other = await add(1, 'B2B-KND-9082');
    expect(other.status).toBe(201);
    const list = await request(app).get('/api/orders').set(auth);
    expect(list.body.data).toHaveLength(2);
    expect(list.body.data.find((i: any) => i.sku === 'B2B-COIN-0010').batchQty).toBe(5);
    // weights follow the quantity
    expect(again.body.data.totalNetGold).toBeCloseTo(first.body.data.totalNetGold * 2.5, 3);
  });

  it('two buyers never share a line', async () => {
    const { app } = await build();
    const a = { Authorization: `Bearer ${(await otpBuyer(app, { firmName: 'A Shop', phone: '9820000012' })).body.token}` };
    const b = { Authorization: `Bearer ${(await otpBuyer(app, { firmName: 'B Shop', phone: '9820000013' })).body.token}` };
    expect((await request(app).post('/api/orders/items').set(a).send({ sku: 'B2B-COIN-0010', batchQty: 1 })).status).toBe(201);
    expect((await request(app).post('/api/orders/items').set(b).send({ sku: 'B2B-COIN-0010', batchQty: 1 })).status).toBe(201);
  });
});

describe('buyer name at sign-in', () => {
  it('records the name for a new buyer, shows it to the admin, and updates it for a returning buyer', async () => {
    const { app, root, admin } = await build();
    const first = await otpBuyer(app, { firmName: 'Ramesh Shah', ownerName: 'Ramesh Shah', phone: '9820000014' });
    expect(first.body.user.storeName).toBe('Ramesh Shah');
    const list = await request(app).get('/api/admin/buyers').set(admin);
    const row = list.body.data.find((b: any) => b.phone === '9820000014');
    expect(row).toMatchObject({ firmName: 'Ramesh Shah', ownerName: 'Ramesh Shah', phone: '9820000014' });
    // a returning buyer gives a corrected name at a later sign-in: it replaces the old one
    await scopeStore(root, 'bhakti').delete('otps', '9820000014'); // (skip the 30 s resend wait)
    const again = await otpBuyer(app, { firmName: 'Ramesh Shah & Sons', phone: '9820000014' });
    expect(again.status).toBe(200);
    expect(again.body.user.storeName).toBe('Ramesh Shah & Sons');
    const after = await request(app).get('/api/admin/buyers').set(admin);
    expect(after.body.data.filter((x: any) => x.phone === '9820000014')).toHaveLength(1);
    expect(after.body.data.find((x: any) => x.phone === '9820000014').firmName).toBe('Ramesh Shah & Sons');
  });
});
