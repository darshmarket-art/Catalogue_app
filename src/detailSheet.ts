import { countText, ctText, groupCt, mmText, totalsOf, type StoneSpec } from '../shared/stoneSpec';

/**
 * The design detail sheet: the store's enhanced photo beside the design's details, with the stones table under it. Drawn with the canvas so every
 * letter is exact (an image model would garble the numbers) and so it uses the store's own colours and fonts, read from the page's theme variables.
 * 2000 x 2000 px, white ground, hairlines, serif title, spaced small capitals for labels, the same as the storefront.
 */
export interface SheetInput {
  brand: string;
  title: string;
  collection: string;
  sku?: string;
  purity: string;
  grossWt: number;
  stoneWt: number;
  netWt: number;
  huid?: string;
  photo: CanvasImageSource & { width: number; height: number };
  spec: StoneSpec;
}

export const SHEET_SIZE = 2000;
const DISCLAIMER = 'Stone counts, sizes and carat weights are approximate and estimated from the photograph. The certificate or invoice of the piece governs.';

interface Theme { ground: string; surface: string; ink: string; muted: string; hair: string; accent: string; serif: string; sans: string }

/** The storefront's own tokens (Maison), with the same defaults, so the sheet matches the store it is made for. */
export function themeOf(): Theme {
  const el = document.querySelector('[data-layout]') ?? document.documentElement;
  const cs = getComputedStyle(el);
  const v = (name: string, d: string) => cs.getPropertyValue(name).trim() || d;
  const first = (stack: string, d: string) => (stack.split(',')[0] ?? d).replace(/["']/g, '').trim() || d;
  return {
    ground: v('--mx-ground', '#ffffff'), surface: v('--mx-surface', '#f3f1ee'), ink: v('--mx-ink', '#1b1b1b'), muted: v('--mx-muted', '#6b6966'),
    hair: v('--mx-hair', '#dedbd6'), accent: v('--mx-brand', v('--mx-accent', '#1b1b1b')),
    serif: first(v('--mx-serif', ''), 'Cormorant Garamond'), sans: first(v('--mx-sans', ''), 'Jost')
  };
}

/** Wraps text to a width; returns the lines (the last is cut with an ellipsis when it would run past maxLines). */
function wrap(ctx: CanvasRenderingContext2D, text: string, width: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width <= width || !line) line = next;
    else { lines.push(line); line = w; }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    let last = kept[maxLines - 1];
    while (last.length > 1 && ctx.measureText(last + '…').width > width) last = last.slice(0, -1);
    kept[maxLines - 1] = last + '…';
    return kept;
  }
  return lines;
}

export async function drawSheet(input: SheetInput): Promise<HTMLCanvasElement> {
  const T = themeOf();
  // The page's fonts load lazily; ask for the ones used here so the first draw is not in a fallback face.
  await Promise.all([`600 40px "${T.serif}"`, `500 40px "${T.serif}"`, `400 24px "${T.sans}"`, `500 24px "${T.sans}"`].map((f) => document.fonts?.load(f).catch(() => [])));
  const S = SHEET_SIZE;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d')!;
  const serif = (w: number, px: number) => `${w} ${px}px "${T.serif}", "Didot", Georgia, serif`;
  const sans = (w: number, px: number) => `${w} ${px}px "${T.sans}", "Futura", "Century Gothic", sans-serif`;
  const spaced = (px: number) => { (ctx as any).letterSpacing = `${px}px`; };
  const caps = (text: string, x: number, y: number, o: { size?: number; color?: string; align?: CanvasTextAlign; weight?: number; track?: number } = {}) => {
    ctx.font = sans(o.weight ?? 500, o.size ?? 22); ctx.fillStyle = o.color ?? T.muted; ctx.textAlign = o.align ?? 'left'; spaced(o.track ?? 4);
    ctx.fillText(text.toUpperCase(), x, y);
    spaced(0);
  };
  const line = (x1: number, y: number, x2: number, color = T.hair, w = 2) => { ctx.fillStyle = color; ctx.fillRect(x1, y, x2 - x1, w); };

  ctx.fillStyle = T.ground; ctx.fillRect(0, 0, S, S);
  const M = 100;

  // Header
  ctx.textBaseline = 'alphabetic';
  caps(input.brand, M, 112, { size: 26, color: T.ink, weight: 500, track: 8 });
  caps('Design details', S - M, 112, { size: 22, align: 'right' });
  line(M, 146, S - M, T.hair);
  line(M, 144, M + 120, T.accent, 6);

  // Photo, whole (never cropped), on the surface tone
  const px = M, py = 200, pw = 860, ph = 860;
  ctx.fillStyle = T.surface; ctx.fillRect(px, py, pw, ph);
  const iw = input.photo.width, ih = input.photo.height, k = Math.min(pw / iw, ph / ih);
  ctx.drawImage(input.photo, px + (pw - iw * k) / 2, py + (ph - ih * k) / 2, iw * k, ih * k);

  // Right column
  const rx = 1040, rw = S - M - rx;
  caps(input.collection, rx, 236, { size: 22 });
  ctx.font = serif(500, 80); ctx.fillStyle = T.ink; ctx.textAlign = 'left';
  const title = wrap(ctx, input.title, rw, 3);
  title.forEach((l, i) => ctx.fillText(l, rx, 330 + i * 88));

  const g = (n: number) => `${n.toFixed(3)} g`;
  const rows: Array<[string, string]> = [
    ...(input.sku ? [['SKU', input.sku] as [string, string]] : []),
    ['Purity', input.purity],
    ['Gross weight', g(input.grossWt)],
    ...(input.stoneWt > 0 ? [['Stone weight', g(input.stoneWt)] as [string, string]] : []),
    ['Net weight', g(input.netWt)],
    ...(input.huid ? [['HUID', input.huid] as [string, string]] : [])
  ];
  const step = 68, top = py + ph - rows.length * step;
  rows.forEach(([k2, v], i) => {
    const y = top + i * step;
    line(rx, y, S - M, T.hair);
    caps(k2, rx, y + 44, { size: 20 });
    ctx.font = sans(500, 32); ctx.fillStyle = T.ink; ctx.textAlign = 'right'; ctx.fillText(v, S - M, y + 46);
  });
  line(rx, top + rows.length * step, S - M, T.hair);

  // Stones
  const tot = totalsOf(input.spec.groups);
  const sy = 1150;
  ctx.font = serif(500, 58); ctx.fillStyle = T.ink; ctx.textAlign = 'left'; ctx.fillText('Diamonds', M, sy + 40);
  caps('Approximate, from the photo', S - M, sy + 36, { size: 20, align: 'right' });
  const col = { part: M, set: 740, n: 1330, mm: 1580, ct: S - M };
  const hy = sy + 110;
  line(M, hy - 40, S - M, T.ink, 3);
  caps('Part', col.part, hy, { size: 19 }); caps('Setting', col.set, hy, { size: 19 }); caps('Stones', col.n, hy, { size: 19, align: 'right' });
  caps('Size mm', col.mm, hy, { size: 19, align: 'right' }); caps('Approx. ct', col.ct, hy, { size: 19, align: 'right' });
  const groups = input.spec.groups.slice(0, 6);
  let y = hy + 24;
  if (groups.length === 0) {
    line(M, y, S - M, T.hair);
    ctx.font = sans(400, 30); ctx.fillStyle = T.muted; ctx.textAlign = 'left'; ctx.fillText('No stones are visible in this design.', col.part, y + 52);
    y += 78;
  }
  groups.forEach((gr) => {
    line(M, y, S - M, T.hair);
    const ct = groupCt(gr);
    ctx.font = serif(500, 38); ctx.fillStyle = T.ink; ctx.textAlign = 'left';
    ctx.fillText(wrap(ctx, gr.name, col.set - col.part - 30, 1)[0], col.part, y + 50);
    ctx.font = sans(400, 28); ctx.fillText(wrap(ctx, [gr.setting, /^round$/i.test(gr.shape) ? '' : gr.shape].filter(Boolean).join(' · '), col.n - 250 - col.set, 1)[0] ?? '', col.set, y + 48);
    ctx.textAlign = 'right';
    ctx.fillText(countText(gr.countMin, gr.countMax), col.n, y + 48);
    ctx.fillText(mmText(gr.mmMin, gr.mmMax), col.mm, y + 48);
    ctx.fillText(ctText(ct.min, ct.max), col.ct, y + 48);
    y += 68;
  });
  if (groups.length) {
    line(M, y, S - M, T.ink, 3);
    ctx.font = sans(500, 28); ctx.fillStyle = T.ink; ctx.textAlign = 'left'; spaced(4); ctx.fillText('TOTAL', col.part, y + 52); spaced(0);
    ctx.font = sans(500, 32); ctx.textAlign = 'right';
    ctx.fillText(countText(tot.countMin, tot.countMax), col.n, y + 52);
    ctx.fillStyle = T.accent; ctx.fillText(`${ctText(tot.ctMin, tot.ctMax)} ct`, col.ct, y + 52);
    y += 72;
  }

  // Metal and design notes
  const note = (label: string, text: string, ny: number) => {
    caps(label, M, ny, { size: 19 });
    ctx.font = sans(400, 28); ctx.fillStyle = T.ink; ctx.textAlign = 'left';
    ctx.fillText(wrap(ctx, text, S - 2 * M - 250, 1)[0] ?? '', M + 250, ny + 2);
  };
  let ny = Math.max(y + 56, 1760);
  if (input.spec.metal) { note('Metal', input.spec.metal, ny); ny += 50; }
  if (input.spec.features.length) { note('Design', input.spec.features.join(' · '), ny); }

  // Footer
  line(M, 1884, S - M, T.hair);
  ctx.font = sans(400, 22); ctx.fillStyle = T.muted; ctx.textAlign = 'left';
  wrap(ctx, DISCLAIMER, S - 2 * M, 2).forEach((l, i) => ctx.fillText(l, M, 1928 + i * 32));
  return c;
}

export const sheetFile = (c: HTMLCanvasElement, name: string): Promise<File> =>
  new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(new File([b], `${name}.png`, { type: 'image/png' })) : reject(new Error('The sheet could not be made.'))), 'image/png'));
