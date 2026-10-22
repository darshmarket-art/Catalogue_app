import { describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { MemoryStore } from '../server/store';
import { aboutRoutes } from '../server/routes/about';
import { errorHandler } from '../server/http';

const mk = (translate: (t: string[]) => Promise<string[]>, admin = true) => {
  const app = express();
  app.use(express.json());
  const guard: express.RequestHandler = (_req, res, next) => (admin ? next() : void res.status(403).json({ status: 'error', message: 'Admins only.' }));
  app.use('/api/about', aboutRoutes(new MemoryStore(), guard, guard, undefined, translate));
  app.use(errorHandler);
  return app;
};

describe('About us: English to Hindi', () => {
  it('translates the texts in order, admins only, and says so plainly when translation is down', async () => {
    const ok = mk(async (t) => t.map((s) => `हिंदी:${s}`));
    const r = await request(ok).post('/api/about/hindi').send({ texts: ['Founder', 'Zaveri Bazaar'] });
    expect(r.body.data.texts).toEqual(['हिंदी:Founder', 'हिंदी:Zaveri Bazaar']);
    expect((await request(ok).post('/api/about/hindi').send({ texts: [] })).status).toBe(400);
    expect((await request(mk(async (t) => t, false)).post('/api/about/hindi').send({ texts: ['x'] })).status).toBe(403);
    const down = await request(mk(async () => { throw new Error('quota'); })).post('/api/about/hindi').send({ texts: ['x'] });
    expect(down.status).toBe(503);
    expect(down.body.message).toContain('type the Hindi yourself');
  });
});
