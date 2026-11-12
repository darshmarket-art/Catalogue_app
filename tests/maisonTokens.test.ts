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
  it('the second sheet (Welcome, sign-in, order placed, Noir) has no hard-coded colour either', () => {
    expect(fs.readFileSync(`${dir}/immersive.css`, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').match(COLOUR)).toBeNull();
  });
  it('dark bands pair the deep ground with its own text: never the button colour, which is light on the dark looks', () => {
    // The Welcome page and the order-placed page were blank in Noir: light text on the light button colour.
    const all = css + fs.readFileSync(`${dir}/immersive.css`, 'utf8');
    for (const band of ['.mx-welcome', '.mx-booked', '.mx-foot', '.mx-pl']) {
      const rule = all.split('\n').find((l) => new RegExp(`${band.replace('.', '\\.')} \\{`).test(l) && l.includes('background'));
      expect(rule, band).toBeTruthy();
      expect(rule, band).toContain('var(--mx-deep)');
      expect(rule, band).not.toContain('--mx-btn-bg');
    }
  });
  it('buyer TSX has no hard-coded colour', () => {
    for (const f of ['Header', 'Home', 'Catalogue', 'ProductDetail', 'Shortlist', 'Orders', 'Profile', 'ui', 'Welcome', 'About', 'CartSheet', 'Placed', 'TagPage']) {
      expect(fs.readFileSync(`${dir}/${f}.tsx`, 'utf8').match(COLOUR), f).toBeNull();
    }
  });
  it('defines the three presets and the one-place ratios', () => {
    for (const k of ['midnight', 'garnet', '--mx-tile-ratio', '--mx-hero-ratio', '--mx-accent', '--mx-brand']) expect(css).toContain(k);
  });
});
