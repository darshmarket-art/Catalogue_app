import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { loadConfig } from '../server/config';
import { MemoryStore } from '../server/store';
import { MemoryBlobs } from '../server/blobs';
import { createApp } from '../server/app';
import { errorHandler, HttpError } from '../server/http';

const config = () => ({ ...loadConfig({ NODE_ENV: 'test', STORE: 'memory', JWT_SECRET: 'x'.repeat(48), MASTER_PROVISIONING_KEY: 'test-master-provisioning-key' }), rateLimit: { auth: 1000, adminRegister: 1000, api: 100000, analytics: 100000 } });

describe('bug reports', () => {
  it('counts a repeated problem once per row, keeps the trail, and keeps every personal report', async () => {
    const root = new MemoryStore();
    const app = createApp(config(), root, new MemoryBlobs());
    const body = { message: 'Failed to load <img> /media/abc12345678', where: 'resource', kind: 'resource', crumbs: ['10:00:01 tap button "Add"'], ctx: '/ · online' };
    for (let i = 0; i < 3; i++) expect((await request(app).post('/api/bug-report').send({ ...body, message: `Failed to load <img> /media/abc1234567${i}` })).status).toBe(200);
    await request(app).post('/api/bug-report').send({ message: 'Reported by a person', where: 'report a problem', kind: 'user', note: 'shortlist empty' });
    await request(app).post('/api/bug-report').send({ message: 'Reported by a person', where: 'report a problem', kind: 'user', note: 'second one' });
    const rows = await root.list('bugReports');
    const res = rows.find((r) => r.kind === 'resource')!;
    expect(res.count).toBe(3);
    expect(res.crumbs).toEqual(body.crumbs);
    expect(rows.filter((r) => r.kind === 'user')).toHaveLength(2);
    expect(rows).toHaveLength(3);
  });

  it('the error handler records a server failure but not an expected 4xx', () => {
    const recordBug = vi.fn();
    const mk = () => ({ locals: { recordBug }, status: () => ({ json: () => undefined }) }) as never;
    const req = { method: 'GET', path: '/api/products', originalUrl: '/api/products?x=1', get: () => undefined } as never;
    errorHandler(new HttpError(404, 'nope'), req, mk(), () => undefined);
    expect(recordBug).not.toHaveBeenCalled();
    errorHandler(new Error('boom'), req, mk(), () => undefined);
    expect(recordBug).toHaveBeenCalledWith(expect.objectContaining({ kind: 'server', message: 'boom', where: 'GET /api/products' }));
  });
});
