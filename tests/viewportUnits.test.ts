import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

// On a phone `100vh` is the page with the browser bars tucked away, so a full-height box is taller than what is on screen and the page scrolls.
// A plain `vh` is allowed only as the fallback line right before the same property in dvh (follows the visible area) or svh (stays put).

const walk = (dir: string, out: string[] = []) => {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
};
const files = [...walk('src'), 'public/offline.html', 'index.html', 'console.html'];
const read = (f: string) => fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const PLAIN_VH = /\dvh\b/;
const SAFE_VH = /\d[sd]vh\b/;

describe('viewport units', () => {
  it('every plain vh in a stylesheet is followed by the same property in dvh or svh', () => {
    const bad: string[] = [];
    for (const f of files.filter((p) => /\.(css|html)$/.test(p))) {
      const decls = [...read(f).matchAll(/([\w-]+)\s*:\s*([^;{}]+)/g)].map((m) => ({ prop: m[1], value: m[2] }));
      decls.forEach((d, i) => {
        if (PLAIN_VH.test(d.value) && !(decls[i + 1]?.prop === d.prop && SAFE_VH.test(decls[i + 1].value))) bad.push(`${f}: ${d.prop}: ${d.value.trim().slice(0, 70)}`);
      });
    }
    expect(bad).toEqual([]);
  });

  it('no component sizes itself in plain vh or Tailwind screen heights', () => {
    const bad: string[] = [];
    for (const f of files.filter((p) => /\.tsx?$/.test(p))) {
      const s = read(f);
      if (PLAIN_VH.test(s) || /\b(min-h|h|max-h)-screen\b/.test(s)) bad.push(f);
    }
    expect(bad).toEqual([]);
  });
});
