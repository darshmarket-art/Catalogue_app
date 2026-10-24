import fs from 'fs';
import path from 'path';
import { request } from '@playwright/test';
import { BASE, MASTER_KEY, OWNER, STATIC_CODE, STORE_ID, outDir, type Sessions } from './env';

const BUYER_PHONE = '919876501234';

/** Runs once after the server is up: makes the owner and one buyer through the real API and hands their tokens to the workers. */
export default async function globalSetup() {
  const api = await request.newContext({ baseURL: BASE(), extraHTTPHeaders: { 'X-Store': STORE_ID } });
  const ok = async (r: Awaited<ReturnType<typeof api.post>>, what: string): Promise<any> => {
    if (!r.ok()) throw new Error(`${what} failed: ${r.status()} ${await r.text()}`);
    return r.json();
  };
  const owner = await ok(await api.post('/api/auth/admin/register', { data: { ...OWNER, role: 'owner', masterProvisioningKey: MASTER_KEY } }), 'owner register');
  await ok(await api.post('/api/auth/retailer/request-otp', { data: { phone: BUYER_PHONE } }), 'buyer request-otp');
  const buyer = await ok(await api.post('/api/auth/retailer/verify-otp', { data: { phone: BUYER_PHONE, code: STATIC_CODE, firmName: 'Responsive Test Buyer', ownerName: 'Test Buyer' } }), 'buyer verify-otp');
  await api.dispose();
  process.env.PW_SESSIONS = JSON.stringify({ buyer: { token: buyer.token, phone: BUYER_PHONE }, owner: { token: owner.sessionToken } } satisfies Sessions);
  fs.rmSync(path.join(outDir(), '.parts'), { recursive: true, force: true });
}
