import crypto from 'crypto';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { FcmSender } from '../server/notify';

const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } });
const fcm = () => new FcmSender({ projectId: 'proj', clientEmail: 'svc@proj.iam.gserviceaccount.com', privateKey });
afterEach(() => vi.unstubAllGlobals());

describe('FCM sender', () => {
  it('signs in once, posts the notification, and treats UNREGISTERED as gone', async () => {
    const calls: Array<{ url: string; body: any }> = [];
    let result: Response;
    vi.stubGlobal('fetch', async (url: string, init: any) => {
      calls.push({ url, body: init.body });
      return url.includes('oauth2') ? new Response(JSON.stringify({ access_token: 'tok', expires_in: 3600 })) : result;
    });
    const s = fcm();
    result = new Response('{}');
    expect(await s.send({ token: 't1' }, { title: 'Shop: order placed', body: 'PO-1', tag: 'PO-1' })).toBe('ok');
    result = new Response(JSON.stringify({ error: { details: [{ errorCode: 'UNREGISTERED' }] } }), { status: 404 });
    expect(await s.send({ token: 't2' }, { title: 'x' })).toBe('gone');
    expect(calls.filter((c) => c.url.includes('oauth2'))).toHaveLength(1);
    const msg = JSON.parse(calls.find((c) => c.url.includes('messages:send'))!.body).message;
    expect(msg).toMatchObject({ token: 't1', notification: { title: 'Shop: order placed', body: 'PO-1' } });
    result = new Response('boom', { status: 500 });
    await expect(s.send({ token: 't3' }, { title: 'x' })).rejects.toThrow(/FCM push failed: 500/);
  });
});
