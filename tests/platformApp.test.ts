import { describe, expect, it } from 'vitest';
import { PLATFORM_APP_ID, platformIconSvg, platformUrl } from '../scripts/platformApp';

describe('Antarixs onboarding app', () => {
  it('opens app.<base domain>', () => {
    expect(platformUrl('antarixs.com')).toBe('https://app.antarixs.com');
    expect(platformUrl('https://Antarixs.com/')).toBe('https://app.antarixs.com');
  });
  it('rejects a base domain that is not a domain', () => {
    expect(() => platformUrl('not a domain')).toThrow();
    expect(() => platformUrl('localhost')).toThrow();
  });
  it('has its own app id, apart from every store app', () => {
    expect(PLATFORM_APP_ID).toBe('com.antarixs.app');
  });
  it('draws the mark on a tile', () => {
    const svg = platformIconSvg();
    expect(svg).toContain('<svg');
    expect(svg).toContain('#1A0B4D'); // the kit's Deep icon tile
    expect(svg).toContain('#7CC4FF');
  });
});
