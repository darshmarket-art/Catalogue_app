import { describe, expect, it } from 'vitest';
import { appIdFor, merchantFileFor, merchantFrom, nativeBuildValues } from '../scripts/storeApp';

describe('store app generator', () => {
  it('sanitises app ids', () => {
    expect(appIdFor('acme-jewels')).toBe('com.antarixs.acmejewels');
    expect(appIdFor('Shop_9')).toBe('com.antarixs.shop9');
    expect(appIdFor('9lives')).toBe('com.antarixs.s9lives');
    expect(() => appIdFor('--')).toThrow();
  });
  it('reads live, export and bare shapes', () => {
    const m = { brand: { name: 'Acme' } };
    for (const j of [{ data: m }, { store: { merchant: m } }, m]) expect(merchantFrom(j)).toBe(m);
    expect(() => merchantFrom({})).toThrow();
  });
  it('produces build values and the merchant file', () => {
    const m = { brand: { name: 'Acme', logoUrl: 'https://x/l.png' }, theme: { colors: { surface: '#111111' } } };
    const v = nativeBuildValues('acme', m, 'https://api.example.com/');
    expect(v).toMatchObject({ appId: 'com.antarixs.acme', appName: 'Acme', themeColor: '#111111', env: { MERCHANT: 'acme', VITE_STORE: 'acme', VITE_API_BASE: 'https://api.example.com' } });
    expect(merchantFileFor('acme', m).android.packageName).toBe('com.antarixs.acme');
    expect(() => nativeBuildValues('A!', m, '')).toThrow();
  });
});
