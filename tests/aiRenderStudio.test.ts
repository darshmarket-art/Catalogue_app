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
