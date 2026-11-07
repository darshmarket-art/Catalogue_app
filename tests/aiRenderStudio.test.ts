import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../server/cloudStats', () => ({ googleToken: async () => 't', projectId: async () => 'p' }));
import { renderStudio } from '../server/aiRender';

const reply = { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: Buffer.from('out').toString('base64') } }] } }] }) };
const sent = (fetchMock: ReturnType<typeof vi.fn>) => JSON.parse((fetchMock.mock.calls[0] as any)[1].body).contents[0].parts;
afterEach(() => vi.unstubAllGlobals());

describe('renderStudio request shape (fetch faked, no Google call)', () => {
  it('single image: one image part then the prompt (unchanged)', async () => {
    const f = vi.fn(async () => reply); vi.stubGlobal('fetch', f);
    await renderStudio(Buffer.from('a'), 'image/jpeg', 'P');
    const parts = sent(f);
    expect(parts).toHaveLength(2);
    expect(parts[0].inlineData).toEqual({ mimeType: 'image/jpeg', data: Buffer.from('a').toString('base64') });
    expect(parts[1]).toEqual({ text: 'P' });
  });
  it('two images: image 1, image 2, then the prompt; 2K still requested', async () => {
    const f = vi.fn(async () => reply); vi.stubGlobal('fetch', f);
    await renderStudio(Buffer.from('base'), 'image/png', 'P', [{ data: Buffer.from('prod'), mimeType: 'image/webp' }]);
    const parts = sent(f);
    expect(parts.map((p: any) => p.inlineData?.mimeType ?? 'text')).toEqual(['image/png', 'image/webp', 'text']);
    expect(Buffer.from(parts[1].inlineData.data, 'base64').toString()).toBe('prod');
    expect(JSON.parse((f.mock.calls[0] as any)[1].body).generationConfig.imageConfig).toEqual({ imageSize: '2K' });
  });
  it('no image: text only', async () => {
    const f = vi.fn(async () => reply); vi.stubGlobal('fetch', f);
    await renderStudio(null, '', 'P');
    expect(sent(f)).toEqual([{ text: 'P' }]);
  });
});

import sharp from 'sharp';
import { aspectOf, KEEP_IDENTICAL, STYLES, UNSQUEEZE } from '../server/aiRender';
describe('squeezed photos', () => {
  const png = (w: number, h: number) => sharp({ create: { width: w, height: h, channels: 3, background: '#888' } }).png().toBuffer();
  it('asks for the photo\'s own aspect ratio, not a square', async () => {
    expect(await aspectOf(await png(800, 600))).toBe('4:3');
    expect(await aspectOf(await png(600, 800))).toBe('3:4');
    expect(await aspectOf(await png(500, 500))).toBe('1:1');
    expect(await aspectOf(Buffer.from('not an image'))).toBeUndefined();
    expect(await aspectOf(null)).toBeUndefined();
  });
  it('sends the ratio with the request, and falls back to a plain request if the model refuses it', async () => {
    const calls: any[] = [];
    vi.stubGlobal('fetch', async (_u: string, init: any) => {
      calls.push(JSON.parse(init.body).generationConfig.imageConfig);
      return calls.length < 3 ? { ok: false, status: 400, json: async () => ({}) } : reply;
    });
    await renderStudio(await png(800, 600), 'image/png', 'P');
    expect(calls).toEqual([{ imageSize: '2K', aspectRatio: '4:3' }, { aspectRatio: '4:3' }, undefined]);
  });
  it('every style tells the model to un-squeeze and ignore padding', () => {
    expect(KEEP_IDENTICAL).toContain(UNSQUEEZE);
    expect(STYLES.cad()).toContain('squeezed or stretched');
    expect(STYLES.silk()).toContain('Ignore any padding');
  });
});
