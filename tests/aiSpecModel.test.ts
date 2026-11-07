import { afterEach, describe, expect, it, vi } from 'vitest';
import { analyseStones, forgetWorkingModel, specCandidates } from '../server/aiSpec';
vi.mock('../server/cloudStats', () => ({ googleToken: async () => 't', projectId: async () => 'p' }));
describe('model fallback', () => {
  afterEach(() => { forgetWorkingModel(); vi.unstubAllGlobals(); });
  it('tries the configured model first, then others and other places', () => {
    const c = specCandidates({ AI_SPEC_MODEL: 'my-model', AI_SPEC_LOCATION: 'europe-west4' } as NodeJS.ProcessEnv);
    expect(c[0]).toEqual({ model: 'my-model', loc: 'europe-west4' });
    expect(c.some((x) => x.model === 'gemini-2.5-flash' && x.loc === 'us-central1')).toBe(true);
  });
  it('moves past 404s, remembers the one that answers, and says so when none does', async () => {
    const urls: string[] = [];
    const ok = { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ pieceType: 'Ring', metal: '', features: [], groups: [] }) }] } }] }) };
    let calls = 0;
    vi.stubGlobal('fetch', async (u: string) => { urls.push(u); calls += 1; return calls < 3 ? { ok: false, status: 404, json: async () => ({}) } : ok; });
    const spec = await analyseStones(Buffer.from('x'), 'image/png');
    expect(spec.pieceType).toBe('Ring');
    expect(urls).toHaveLength(3);
    urls.length = 0;
    await analyseStones(Buffer.from('x'), 'image/png');
    expect(urls).toHaveLength(1); // straight to the one that worked
    forgetWorkingModel();
    vi.stubGlobal('fetch', async () => ({ ok: false, status: 404, json: async () => ({}) }));
    await expect(analyseStones(Buffer.from('x'), 'image/png')).rejects.toThrow(/no Gemini model is available/);
  });
});

describe('image model fallback', () => {
  afterEach(() => { forgetWorkingModel(); vi.unstubAllGlobals(); });
  it('last candidate is the render model, asked in plain text, and its fenced JSON is read', async () => {
    const bodies: any[] = [];
    vi.stubGlobal('fetch', async (u: string, init: any) => {
      bodies.push({ u, body: JSON.parse(init.body) });
      if (!/nano-banana/.test(u)) return { ok: false, status: 404, json: async () => ({}) };
      return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: '```json\n' + JSON.stringify({ pieceType: 'Necklace', metal: '', features: [], groups: [{ name: 'Pavé', setting: 'Pavé', shape: 'Round', countMin: 3, countMax: 5, mmMin: 1, mmMax: 1.2 }] }) + '\n```' }] } }] }) };
    });
    const spec = await analyseStones(Buffer.from('x'), 'image/png');
    expect(spec.groups[0].countMax).toBe(5);
    const last = bodies[bodies.length - 1];
    expect(last.body.generationConfig).toEqual({ responseModalities: ['TEXT', 'IMAGE'] });
    expect(last.body.generationConfig.responseSchema).toBeUndefined();
  });
});
