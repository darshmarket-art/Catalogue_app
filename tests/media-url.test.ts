import { describe, expect, it } from 'vitest';
import { normalizePhoto } from '../server/media';

const file = 'a'.repeat(32) + '.jpg';

describe('normalizePhoto', () => {
  it.each([`/media/${file}?e=1&s=x`, `https://catalogue-app.example.run.app/media/${file}?e=1&s=x`])('turns %s back into a stored ref', (v) => {
    expect(normalizePhoto(v)).toBe(`media:${file}`);
  });
  it('keeps other http(s) URLs and rejects junk', () => {
    expect(normalizePhoto('https://cdn.example.com/a.jpg')).toBe('https://cdn.example.com/a.jpg');
    expect(normalizePhoto('javascript:alert(1)')).toBeNull();
  });
});
