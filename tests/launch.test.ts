import { describe, expect, it } from 'vitest';
import request from 'supertest';
import sharp from 'sharp';
import { loadConfig } from '../server/config';
import { MemoryStore } from '../server/store';
import { MemoryBlobs } from '../server/blobs';
import { createApp } from '../server/app';
import { isAppPath, notFoundPage } from '../server/legal';
import { optimisePhoto } from '../server/routes/photos';
import { STATIC_CODE } from './buyerAuth';

const env = { STORE: 'memory', OTP_STATIC_CODE: STATIC_CODE, JWT_SECRET: 'x'.repeat(48), MASTER_PROVISIONING_KEY: 'test-master-provisioning-key' };
const app = createApp(loadConfig({ NODE_ENV: 'test', ...env }), new MemoryStore(), new MemoryBlobs());

describe('launch pages', () => {
  it('serves a privacy policy and terms for the store, as plain pages', async () => {
    for (const [path, heading] of [['/privacy', 'Privacy policy'], ['/terms', 'Terms &amp; conditions']] as const) {
      const res = await request(app).get(path);
      expect(res.status).toBe(200);
      expect(res.type).toBe('text/html');
      expect(res.text).toContain(`<h1>${heading}</h1>`);
      expect(res.text).toContain('Bhakti Jewels');
      expect(res.text).toContain('name="viewport"');
    }
  });
  it('the privacy policy says what the site really does: no cookies, WhatsApp codes, activity tracking', async () => {
    const { text } = await request(app).get('/privacy');
    expect(text).toMatch(/does not set cookies/);
    expect(text).toMatch(/WhatsApp/);
    expect(text).toMatch(/designs you view/);
  });
  it('robots.txt keeps a members-only catalogue out of search but leaves the front and legal pages', async () => {
    const res = await request(app).get('/robots.txt');
    expect(res.type).toBe('text/plain');
    expect(res.text).toContain('Disallow: /');
    expect(res.text).toContain('Allow: /privacy');
    expect(res.text).toMatch(/Sitemap: http:\/\/127\.0\.0\.1:\d+\/sitemap\.xml/);
  });
  it('sitemap.xml lists the public pages', async () => {
    const res = await request(app).get('/sitemap.xml');
    expect(res.type).toBe('application/xml');
    expect(res.text).toContain('/privacy</loc>');
    expect(res.text).toContain('/terms</loc>');
  });
  it('favicon.ico points at the store icon', async () => {
    const res = await request(app).get('/favicon.ico');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/pwa/icon-192.png');
  });
  it('only the app’s own addresses open the app; the 404 page is not indexed', () => {
    expect(['/', '/signup', '/welcome-antarixs', '/signup/'].every(isAppPath)).toBe(true);
    expect(['/robots.txt', '/no-such-page', '/assets/x.js'].some(isAppPath)).toBe(false);
    const html = notFoundPage({ brand: { name: 'Acme <b>' }, contact: { whatsapp: '1' } } as never);
    expect(html).toContain('noindex');
    expect(html).toContain('Page not found');
    expect(html).toContain('Acme &lt;b&gt;'); // names are escaped
  });
});

describe('https', () => {
  const prod = createApp(
    { ...loadConfig({ NODE_ENV: 'test', ...env }), isProduction: true }, // the checks that stop real production starting (Firestore, keys) are not what is tested here
    new MemoryStore(),
    new MemoryBlobs()
  );
  it('sends plain-http requests to https, but not the health check or requests already on https', async () => {
    const moved = await request(prod).get('/privacy?x=1').set('Host', 'bhakti.example.com').set('X-Forwarded-Proto', 'http');
    expect(moved.status).toBe(308);
    expect(moved.headers.location).toBe('https://bhakti.example.com/privacy?x=1');
    expect((await request(prod).get('/health').set('X-Forwarded-Proto', 'http')).status).toBe(200);
    expect((await request(prod).get('/health').set('X-Forwarded-Proto', 'https')).status).toBe(200);
  });
  it('refuses to redirect to a made-up host', async () => {
    const res = await request(prod).get('/').set('Host', 'evil.com/x').set('X-Forwarded-Proto', 'http');
    expect(res.status).not.toBe(308);
  });
});

describe('photo optimising', () => {
  it('shrinks a large photo, keeps its type, and limits its longest side', async () => {
    const raw = Buffer.alloc(3200 * 2400 * 3);
    for (let i = 0; i < raw.length; i++) raw[i] = (i * 7 + (i >> 5)) & 255;
    const big = await sharp(raw, { raw: { width: 3200, height: 2400, channels: 3 } }).jpeg({ quality: 100 }).toBuffer();
    const out = await optimisePhoto(big, 'image/jpeg');
    const meta = await sharp(out).metadata();
    expect(out.length).toBeLessThan(big.length);
    expect(meta.format).toBe('jpeg');
    expect(Math.max(meta.width!, meta.height!)).toBeLessThanOrEqual(2400);
  });
  it('keeps the original when it cannot be read or is not made smaller', async () => {
    const fake = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(40, 1)]);
    expect(await optimisePhoto(fake, 'image/jpeg')).toBe(fake);
  });
});

describe('the Antarixs site (app.<domain>)', () => {
  const get = (path: string) => request(app).get(path).set('Host', 'app.antarixs.com');
  it('has its own privacy and terms, in Antarixs’s name and not a store’s', async () => {
    for (const path of ['/privacy', '/terms']) {
      const res = await get(path);
      expect(res.status).toBe(200);
      expect(res.text).toContain('Antarixs');
      expect(res.text).not.toContain('Bhakti');
    }
    expect((await get('/privacy')).text).toContain('[company legal name]'); // until PLATFORM_LEGAL_NAME is set
  });
  it('shows the operator once it is configured', async () => {
    const named = createApp(loadConfig({ NODE_ENV: 'test', ...env, PLATFORM_LEGAL_NAME: 'Antarixs Technologies Pvt Ltd', PLATFORM_CONTACT_EMAIL: 'hello@antarixs.com' }), new MemoryStore(), new MemoryBlobs());
    const res = await request(named).get('/terms').set('Host', 'app.antarixs.com');
    expect(res.text).toContain('Antarixs Technologies Pvt Ltd');
    expect(res.text).toContain('hello@antarixs.com');
  });
  it('is open to search engines, with a sitemap', async () => {
    const robots = await get('/robots.txt');
    expect(robots.text).toContain('Allow: /');
    expect(robots.text).not.toMatch(/^Disallow: \/$/m);
    expect((await get('/sitemap.xml')).text).toContain('/signup</loc>');
  });
  it('has its own icon files and favicon', async () => {
    const png = await get('/pwa/icon-192.png');
    expect(png.status).toBe(200);
    expect(png.type).toBe('image/png');
    expect(png.body.subarray(1, 4).toString()).toBe('PNG');
    expect((await get('/favicon.ico')).headers.location).toBe('/pwa/icon-192.png');
    expect((await get('/favicon.svg')).type).toBe('image/svg+xml');
  });
  it('a store keeps its own pages on its own address', async () => {
    const res = await request(app).get('/privacy');
    expect(res.text).toContain('Bhakti Jewels');
  });
});

describe('link previews', () => {
  it('leaves out the preview image tags when a site has no image', async () => {
    const { renderIndexHtml } = await import('../server/merchant');
    const fs = await import('fs');
    const tpl = fs.readFileSync('index.html', 'utf-8');
    const base = loadConfig({ NODE_ENV: 'test', ...env }).merchant;
    const none = renderIndexHtml(tpl, { ...base, brand: { ...base.brand, name: 'Antarixs', logoUrl: '' } });
    expect(none).not.toMatch(/og:image|twitter:image/);
    expect(none).toContain('content="summary"');
    expect(none).toContain('og:site_name" content="Antarixs"');
    const some = renderIndexHtml(tpl, base);
    expect(some).toContain('twitter:image');
    expect(some).toContain('summary_large_image');
  });
});
