import fs from 'fs';
import { describe, expect, it } from 'vitest';

// Every Maison buyer colour comes from the tokens at the top of maison.css (see the THEME COLOUR TOOLKIT comment there).
const dir = 'src/layouts/maison';
const css = fs.readFileSync(`${dir}/maison.css`, 'utf8');
const body = css.slice(css.indexOf('[data-layout="maison"][data-role] {')).replace(/\/\*[\s\S]*?\*\//g, '');
const COLOUR = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/;

describe('Maison theme tokens', () => {
  it('has no hard-coded colour outside the token block', () => {
    expect(body.match(COLOUR)).toBeNull();
  });
  it('buyer TSX has no hard-coded colour', () => {
    for (const f of ['Header', 'Home', 'Catalogue', 'ProductDetail', 'Shortlist', 'Orders', 'Profile', 'ui', 'Welcome', 'About', 'CartSheet']) {
      expect(fs.readFileSync(`${dir}/${f}.tsx`, 'utf8').match(COLOUR), f).toBeNull();
    }
  });
  it('defines the three presets and the one-place ratios', () => {
    for (const k of ['midnight', 'garnet', '--mx-tile-ratio', '--mx-hero-ratio', '--mx-accent', '--mx-brand']) expect(css).toContain(k);
  });
});
