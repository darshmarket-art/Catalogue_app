import QRCode from 'qrcode';
import type { Category, Product } from './types';
import { logoSrc, merchant } from './merchant';
import { antarixsMarkPng } from './antarixsLogo';
import { saveFile } from './saveFile';
import { UserError } from './bugReport';
import { PHOTO_VARIANT_WIDTHS } from '../shared/photoSpecs';
import {
  GOLD, MAX_PDF_DESIGNS, caption, paletteFor, ellipsize, geometry, groupByCollection, loadPdfOptions, mixHex, normaliseOptions, photoBox, planPages, rgb, trimBox,
  type CropBox, type PdfOptions, type PdfPage
} from './pdfLayout';

type RGB = [number, number, number];
const PT = 0.352778; // mm per point
const PX_PER_MM = 6; // photos are drawn at about 150 dpi
const MEDIA_LINK = /\/media\/[a-f0-9]{32}\.(?:jpg|png|webp)\?/;

/** A signed /media link is fetched at the width the PDF needs (never the 1440 px original for a 85 mm card). */
function sized(src: string, mm: number) {
  if (!MEDIA_LINK.test(src)) return src;
  const need = mm * PX_PER_MM;
  const w = PHOTO_VARIANT_WIDTHS.find((v) => v >= need) ?? PHOTO_VARIANT_WIDTHS[PHOTO_VARIANT_WIDTHS.length - 1];
  return `${src}&w=${w}`;
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    const timer = setTimeout(() => resolve(null), 20_000); // a photo that never answers is a missing photo
    img.crossOrigin = 'anonymous';
    img.onload = () => (clearTimeout(timer), resolve(img));
    img.onerror = () => (clearTimeout(timer), resolve(null));
    img.src = new URL(src, window.location.origin).href;
  });
}

/** One brand mark across the middle of the photo, in the pixels themselves, so it cannot be peeled off the PDF as a separate layer. */
function stamp(ctx: CanvasRenderingContext2D, text: string, w: number, h: number) {
  const label = text.toUpperCase();
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.rotate(-Math.PI / 6);
  let size = w * 0.07;
  do ctx.font = `700 ${size--}px Helvetica, Arial, sans-serif`;
  while (ctx.measureText(label).width > w * 0.7 && size > 10);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = Math.max(1, w * 0.005);
  ctx.strokeStyle = 'rgba(0,0,0,0.28)';
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.strokeText(label, 0, 0);
  ctx.fillText(label, 0, 0);
  ctx.restore();
}

/** The part of the photo inside any baked-in white or black bars, in the photo's own pixels. Found on a small copy; the whole photo if that cannot be read. */
function cropOf(img: HTMLImageElement): CropBox {
  const whole = { x: 0, y: 0, w: img.naturalWidth, h: img.naturalHeight };
  const s = Math.min(1, 240 / Math.max(img.naturalWidth, img.naturalHeight));
  const sw = Math.max(1, Math.round(img.naturalWidth * s)), sh = Math.max(1, Math.round(img.naturalHeight * s));
  const c = document.createElement('canvas');
  try {
    c.width = sw;
    c.height = sh;
    const x = c.getContext('2d', { willReadFrequently: true })!;
    x.drawImage(img, 0, 0, sw, sh);
    const b = trimBox(x.getImageData(0, 0, sw, sh).data, sw, sh);
    if (b.x === 0 && b.y === 0 && b.w === sw && b.h === sh) return whole;
    return { x: Math.round(b.x / s), y: Math.round(b.y / s), w: Math.min(whole.w, Math.round(b.w / s)), h: Math.min(whole.h, Math.round(b.h / s)) };
  } catch {
    return whole;
  } finally {
    c.width = c.height = 0;
  }
}

/** The photo as a JPEG exactly the size of its box: whole (never cropped) on the tile colour, or cropped to fill (cover page). Null if the browser will not let us read it. */
function photoJpeg(img: HTMLImageElement, boxMm: { w: number; h: number }, fill: boolean, tile: string, watermark: string | null, trim = false): string | null {
  const w = Math.round(boxMm.w * PX_PER_MM);
  const h = Math.round(boxMm.h * PX_PER_MM);
  const canvas = document.createElement('canvas');
  try {
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = tile;
    ctx.fillRect(0, 0, w, h);
    // Bars baked into the photo are cut off first (the part of the photo that is the piece is what gets placed). Scale is always even: never stretched or squeezed.
    const c = trim ? cropOf(img) : { x: 0, y: 0, w: img.naturalWidth, h: img.naturalHeight };
    const k = (fill ? Math.max : Math.min)(w / c.w, h / c.h);
    const dw = c.w * k;
    const dh = c.h * k;
    ctx.drawImage(img, c.x, c.y, c.w, c.h, (w - dw) / 2, (h - dh) / 2, dw, dh);
    if (watermark) stamp(ctx, watermark, w, h);
    return canvas.toDataURL('image/jpeg', 0.8);
  } catch {
    return null;
  } finally {
    canvas.width = canvas.height = 0; // hands the pixels back at once (phones)
    img.src = '';
  }
}

/** The store logo as a PNG for the PDF, with its shape; null when there is none or it cannot be read. */
async function logoPng(): Promise<{ data: string; w: number; h: number } | null> {
  const src = logoSrc();
  const img = src ? await loadImage(src) : null;
  if (!img || !img.naturalWidth) return null;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.getContext('2d')!.drawImage(img, 0, 0);
    return { data: canvas.toDataURL('image/png'), w: img.naturalWidth, h: img.naturalHeight };
  } catch {
    return null; // another site's image without permission to read it
  }
}

/**
 * Builds a PDF of one collection and downloads it. The PDF library is loaded only when this is used.
 */
export async function downloadCataloguePdf(category: Category, products: Product[], onProgress?: (done: number, total: number) => void) {
  const items = products.filter((p) => p.category === category.name);
  if (items.length === 0) throw new UserError('This collection has no designs yet.');
  return downloadDesignsPdf(category.name, items, onProgress);
}

export interface PdfRun {
  options?: Partial<PdfOptions>;
  /** Aborting stops the build between pages; the promise rejects with an AbortError. */
  signal?: AbortSignal;
}

/**
 * The catalogue PDF ("Editorial grid", see docs/pdf-picker): a cover, per collection a divider page and 2 x 3 hairline cards (3 x 2 on landscape),
 * and a dark contact page with the store's QR and phone. Without `run.options` the owner's last-used options apply.
 * Pages are built one at a time and only that page's photos are in memory; photos are fetched at the size they are printed.
 * The file is downloaded (on phones too); every photo carries one brand watermark in its pixels unless the owner turned it off.
 */
export async function downloadDesignsPdf(title: string, items: Product[], onProgress?: (done: number, total: number) => void, run: PdfRun = {}) {
  if (items.length === 0) throw new UserError('Pick at least one design first.');
  if (items.length > MAX_PDF_DESIGNS) throw new UserError(`A PDF holds up to ${MAX_PDF_DESIGNS} designs. Pick fewer, or make one PDF per collection.`);
  const o = normaliseOptions({ ...loadPdfOptions(merchant.id), ...run.options });
  const signal = run.signal;
  const stop = () => {
    if (signal?.aborted) throw new DOMException('PDF cancelled', 'AbortError');
  };

  const { jsPDF } = await import('jspdf');
  const g = geometry(o.land);
  const { W, H, u } = g;
  const P = paletteFor(o.theme);
  const gold = P.gold ?? GOLD;
  const dark = { g: P.dp, i: P.dpf };
  const darkM = mixHex(P.dpf, P.dp, 0.62);
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: o.land ? 'landscape' : 'portrait', compress: true });
  const brand = merchant.brand.name;
  const phone = merchant.contact.deskPhone || `+${merchant.contact.whatsapp}`;
  const address = (merchant.contact.address || '').split(',').map((s) => s.trim()).filter(Boolean).slice(-2).join(', ');
  const coverTitle = o.title.trim() || title;
  const groups = groupByCollection(items);
  const pages = planPages(groups.map((x) => x.items.length));
  const fields = merchant.productFields;
  const caps = items.map((p) => caption(p, o, fields));
  const withExtra = caps.some((c) => c.extra !== '');
  const withPrice = caps.some((c) => c.price !== null);
  const box = photoBox(g, withExtra, withPrice);
  const logo = await logoPng();
  const mark = antarixsMarkPng(160, true);
  let done = 0;
  const contactQr = { y: 0 };

  // ---- drawing helpers (sizes in u = 1% of page width; `dry` measures without drawing) ----
  let dry = false;
  const set = (c: RGB | string) => (typeof c === 'string' ? rgb(c) : c);
  interface TxtOpt { size: number; font?: 'times' | 'helvetica'; bold?: boolean; color: RGB | string; track?: number; align?: 'l' | 'c' | 'r'; upper?: boolean }
  /** Draws one line; returns its width. `size` is in u, `track` in em. */
  const txt = (s: string, x: number, y: number, t: TxtOpt) => {
    const str = t.upper ? s.toUpperCase() : s;
    doc.setFont(t.font ?? 'helvetica', t.bold ? 'bold' : 'normal');
    doc.setFontSize((t.size * u) / PT);
    doc.setCharSpace((t.track ?? 0) * t.size * u);
    const w = doc.getTextWidth(str) + str.length * (t.track ?? 0) * t.size * u; // jsPDF leaves the letter-spacing out of its width
    if (!dry) {
      doc.setTextColor(...set(t.color));
      doc.text(str, t.align === 'c' ? x - w / 2 : t.align === 'r' ? x - w : x, y);
    }
    doc.setCharSpace(0);
    return w;
  };
  const measure = (s: string, t: Pick<TxtOpt, 'size' | 'font' | 'bold' | 'track' | 'upper'>) => {
    const was = dry;
    dry = true;
    const w = txt(s, 0, 0, { ...t, color: '#000' });
    dry = was;
    return w;
  };
  /** Wraps to `max` mm in at most `lines` lines, the last one cut with an ellipsis. */
  const wrap = (s: string, max: number, lines: number, t: Pick<TxtOpt, 'size' | 'font' | 'bold' | 'track' | 'upper'>) => {
    const out: string[] = [];
    let line = '';
    for (const word of s.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (measure(next, t) <= max || !line) line = next;
      else (out.push(line), (line = word));
    }
    if (line) out.push(line);
    const shown = out.slice(0, lines);
    if (out.length > lines) shown[lines - 1] = ellipsize(out.slice(lines - 1).join(' '), max, (x) => measure(x, t));
    return shown.map((l) => ellipsize(l, max, (x) => measure(x, t)));
  };
  const fill = (c: RGB | string) => doc.setFillColor(...set(c));
  const hair = (c: RGB | string, w = 0.2) => (doc.setDrawColor(...set(c)), doc.setLineWidth(w));
  const page = (bg: RGB | string) => (fill(bg), doc.rect(0, 0, W, H, 'F'));
  /** Runs `body(y)` once dry to learn its height, then draws it with its top at the place that centres (or bottom-anchors) it. */
  const place = (top: number, bottom: number, body: (y: number) => number, anchor: 'mid' | 'end' = 'mid') => {
    dry = true;
    const h = body(0);
    dry = false;
    body(anchor === 'mid' ? top + (bottom - top - h) / 2 : bottom - h);
  };
  const loadPhoto = async (p: Product | undefined, boxMm: { w: number; h: number }, fillBox: boolean) => {
    if (!p?.image) return null;
    const img = await loadImage(sized(p.image, boxMm.w));
    return img ? photoJpeg(img, boxMm, fillBox, P.tile, o.watermark ? brand : null, o.fit !== 'whole') : null;
  };
  const circleMark = (cx: number, cy: number, r: number, c: RGB | string, letter: string) => {
    if (logo) {
      fill('#ffffff');
      hair(c, 0.25);
      doc.circle(cx, cy, r, 'FD');
      const k = (r * 1.3) / Math.max(logo.w, logo.h);
      doc.addImage(logo.data, 'PNG', cx - (logo.w * k) / 2, cy - (logo.h * k) / 2, logo.w * k, logo.h * k);
    } else {
      hair(c, 0.25);
      doc.circle(cx, cy, r, 'S');
      txt(letter, cx, cy + 1.1 * u, { size: 3.2, font: 'times', color: c, align: 'c' });
    }
  };

  // ---- pages ----
  const cover = async () => {
    const band = !o.land;
    const textW = band ? W : W * 0.54;
    const textH = band ? H * 0.54 : H;
    const px = band ? 0 : W * 0.54;
    const py = band ? H * 0.54 : 0;
    const pw = band ? W : W * 0.46;
    const ph = band ? H * 0.46 : H;
    page(P.g);
    const photo = await loadPhoto(items.find((p) => p.image), { w: pw, h: ph }, true);
    fill(P.tile);
    doc.rect(px, py, pw, ph, 'F');
    if (photo) doc.addImage(photo, 'JPEG', px, py, pw, ph);
    let lx = 8 * u;
    if (logo) {
      const k = (4.2 * u) / Math.max(logo.w, logo.h);
      doc.addImage(logo.data, 'PNG', lx, 4.6 * u, logo.w * k, logo.h * k);
      lx += logo.w * k + 1.6 * u;
    }
    txt(brand, lx, 6 * u + 1 * u * 0.75, { size: 1, track: 0.3, upper: true, color: P.i });
    const tSize = band ? 7.6 : 5;
    const title1 = { size: tSize, font: 'times' as const };
    place(0, textH, (y) => {
      txt('Catalogue', 8 * u, y + 1.15 * u * 0.8, { size: 1.15, track: 0.34, upper: true, color: P.m });
      y += 1.15 * u + 1 * u + 2.2 * u;
      for (const l of wrap(coverTitle, textW - 16 * u, 3, title1)) {
        txt(l, 8 * u, y + tSize * u * 0.72, { ...title1, color: P.i });
        y += tSize * u * 1.0;
      }
      y += 2 * u;
      if (!dry) (hair(P.i, 0.25), doc.line(8 * u, y, 14 * u, y));
      y += 2.1 * u;
      for (const l of o.subtitle.trim() ? wrap(o.subtitle.trim(), textW - 16 * u, 2, { size: 1.3, track: 0.3, upper: true }) : []) {
        txt(l, 8 * u, y + 1.3 * u * 0.8, { size: 1.3, track: 0.3, upper: true, color: P.m });
        y += 1.3 * u * 1.5;
      }
      return y;
    });
  };

  const divider = (gi: number) => {
    const grp = groups[gi];
    const no = String(gi + 1).padStart(2, '0');
    page(P.s);
    const big = o.land ? 30 : 22;
    txt(no, 8 * u, 10 * u + big * u * 0.72, { size: big, font: 'times', color: mixHex(P.i, P.s, 0.14) });
    const tSize = o.land ? 8 : 9.5;
    const t = { size: tSize, font: 'times' as const };
    place(0, H - (o.land ? 6 : 14) * u, (y) => {
      txt(`Collection ${no}`, 9 * u, y + 1.15 * u * 0.8, { size: 1.15, track: 0.34, upper: true, color: P.m });
      y += 1.15 * u + 2 * u;
      for (const l of wrap(grp.name, W - 18 * u, 3, t)) {
        txt(l, 9 * u, y + tSize * u * 0.72, { ...t, color: P.i });
        y += tSize * u;
      }
      y += 2 * u;
      if (!dry) (hair(P.i, 0.25), doc.line(9 * u, y, 15 * u, y));
      y += 2.4 * u;
      txt(`${grp.items.length} ${grp.items.length === 1 ? 'design' : 'designs'}`, 9 * u, y + 1.3 * u * 0.8, { size: 1.3, track: 0.3, upper: true, color: P.m });
      return y + 1.3 * u;
    }, 'end');
  };

  const designs = async (pg: Extract<PdfPage, { kind: 'designs' }>, n: number) => {
    const grp = groups[pg.group];
    const list = grp.items.slice(pg.from, pg.to);
    // this page's photos only, a few at a time
    const photos: Array<string | null> = [];
    for (const p of list) {
      stop();
      photos.push(await loadPhoto(p, box, o.fit === 'fill'));
      onProgress?.(++done, items.length);
    }
    page(P.g);
    const top = 3.6 * u;
    const hdY = top + 1.05 * u * 0.8;
    const half = (W - 12 * u) / 2;
    txt(ellipsize(brand, half, (s) => measure(s, { size: 1.05, track: 0.24, upper: true })), 6 * u, hdY, { size: 1.05, track: 0.24, upper: true, color: P.i });
    txt(ellipsize(grp.name, half, (s) => measure(s, { size: 1.05, track: 0.24, upper: true })), W - 6 * u, hdY, { size: 1.05, track: 0.24, upper: true, color: P.m, align: 'r' });
    hair(P.h, 0.2);
    doc.line(6 * u, top + 2.45 * u, W - 6 * u, top + 2.45 * u);
    const ftY = H - 3 * u;
    doc.line(6 * u, ftY - 2.45 * u, W - 6 * u, ftY - 2.45 * u);
    if (o.weights) txt('Net weight per piece', 6 * u, ftY - 0.2 * u, { size: 1.05, track: 0.24, upper: true, color: P.m });
    txt(`Page ${n} of ${pages.length}`, W - 6 * u, ftY - 0.2 * u, { size: 1.05, track: 0.24, upper: true, color: P.m, align: 'r' });

    list.forEach((p, k) => {
      const c = caps[items.indexOf(p)];
      const x = g.bodyX + (k % g.cols) * (g.cellW + g.gap);
      const y = g.bodyY + Math.floor(k / g.cols) * (g.cellH + g.gap);
      hair(P.h, 0.2);
      doc.rect(x, y, g.cellW, g.cellH, 'S');
      fill(P.tile);
      doc.rect(x + box.x, y + box.y, box.w, box.h, 'F');
      if (photos[k]) doc.addImage(photos[k]!, 'JPEG', x + box.x, y + box.y, box.w, box.h);
      const inner = g.cellW - 2 * g.pad;
      let cy = y + box.y + box.h + g.innerGap;
      const nameT = { size: g.nameU, font: 'times' as const };
      txt(ellipsize(c.name, inner, (s) => measure(s, nameT)), x + g.pad, cy + g.nameU * u * 0.8, { ...nameT, color: P.i });
      cy += g.nameU * u * 1.15 + 0.7 * u;
      // SKU, purity and weight on one line; the type shrinks until they fit
      let ms = g.metaU;
      const sep = ' · ';
      const lineW = (s: number) => c.meta.reduce((a, m) => a + measure(m, { size: s, track: 0.14, upper: true }), 0) + (c.meta.length - 1) * measure(sep, { size: s, track: 0.14 });
      while (ms > g.metaU * 0.55 && lineW(ms) > inner) ms -= g.metaU * 0.05;
      let mx = x + g.pad;
      c.meta.forEach((m, i) => {
        const last = i === c.meta.length - 1 && c.meta.length > 1;
        mx += txt(m, mx, cy + ms * u * 0.8, { size: ms, track: 0.14, upper: true, color: last ? P.i : P.m });
        if (i < c.meta.length - 1) mx += txt(sep, mx, cy + ms * u * 0.8, { size: ms, track: 0.14, color: P.m });
      });
      cy += g.metaU * 1.5 * u;
      if (c.price) {
        cy += 0.6 * u;
        txt(c.price, x + g.pad, cy + g.nameU * 0.8 * u * 0.8, { size: g.nameU * 0.8, font: 'times', color: P.i });
        cy += g.nameU * 0.8 * 1.25 * u;
      }
      if (c.extra) {
        const ex = { size: g.metaU * 0.95, track: 0.02 };
        txt(ellipsize(c.extra, inner, (s) => measure(s, ex)), x + g.pad, cy + 0.5 * u + g.metaU * 0.95 * u * 0.8, { ...ex, color: P.m });
      }
    });
  };

  const contact = async () => {
    page(dark.g);
    const cx = W / 2;
    const pw = 'Scan to open our store, shortlist designs and send your order on WhatsApp.';
    const qrSize = o.land ? 15 : 19;
    const nameSize = o.land ? 4.6 : 6;
    const nameT = { size: nameSize, font: 'times' as const };
    const body = { size: 1.2, track: 0.06 };
    place(0, H - 7 * u, (y) => {
      y += 0;
      if (!dry) circleMark(cx, y + 3.75 * u, 3.75 * u, gold, brand.charAt(0).toUpperCase());
      y += 7.5 * u + (o.land ? 1.6 : 4) * u;
      txt('Thank you', cx, y + 1.15 * u * 0.8, { size: 1.15, track: 0.34, upper: true, color: gold, align: 'c' });
      y += 1.15 * u + 1.6 * u;
      for (const l of wrap(brand, W - 24 * u, 2, nameT)) {
        txt(l, cx, y + nameSize * u * 0.72, { ...nameT, color: dark.i, align: 'c' });
        y += nameSize * u * 1.0;
      }
      y += 2.2 * u;
      if (!dry) (hair(gold, 0.25), doc.line(cx - 3 * u, y, cx + 3 * u, y));
      y += 2.2 * u;
      for (const l of wrap(pw, 34 * u, 4, body)) {
        txt(l, cx, y + 1.2 * u * 0.8, { ...body, color: darkM, align: 'c' });
        y += 1.2 * u * 1.6;
      }
      y += 2.6 * u;
      if (!dry) {
        fill('#ffffff');
        doc.rect(cx - (qrSize / 2 + 2.2) * u, y, (qrSize + 4.4) * u, (qrSize + 4.4) * u, 'F');
      }
      const qy = y;
      y += (qrSize + 4.4) * u + 2 * u;
      txt(phone, cx, y + 2.6 * u * 0.8, { size: 2.6, font: 'times', color: gold, align: 'c' });
      const phoneW = measure(phone, { size: 2.6, font: 'times' });
      if (!dry) doc.link(cx - phoneW / 2, y, phoneW, 2.6 * u, { url: `https://wa.me/${merchant.contact.whatsapp.replace(/[^0-9]/g, '')}` });
      y += 2.6 * u * 1.2;
      if (address) {
        y += 0.8 * u;
        txt(ellipsize(address, W - 16 * u, (s) => measure(s, { size: 1, track: 0.24, upper: true })), cx, y + 1 * u * 0.8, { size: 1, track: 0.24, upper: true, color: darkM, align: 'c' });
        y += 1 * u;
      }
      if (!dry) contactQr.y = qy;
      return y;
    });
    // the QR is a nicety; the phone number above still reaches the store
    try {
      const qr = await QRCode.toDataURL(window.location.origin, { margin: 0, width: 480, color: { dark: '#111111', light: '#ffffff' } });
      doc.addImage(qr, 'PNG', cx - (qrSize / 2) * u, contactQr.y + 2.2 * u, qrSize * u, qrSize * u);
      doc.link(cx - (qrSize / 2 + 2.2) * u, contactQr.y, (qrSize + 4.4) * u, (qrSize + 4.4) * u, { url: window.location.origin });
    } catch {
      // see above
    }
    // "Powered by [mark] Antarixs", linking to antarixs.com
    const pb = { size: 0.95, track: 0.24, upper: true };
    const by = H - 4 * u;
    const pbW = measure('Powered by', pb);
    const axT = { size: 1.7, font: 'times' as const };
    const axW = measure('Antarixs', axT);
    const mk = 2.2 * u;
    const total = pbW + 1.2 * u + (mark ? mk + 0.8 * u : 0) + axW;
    let bx = cx - total / 2;
    txt('Powered by', bx, by, { ...pb, color: darkM });
    bx += pbW + 1.2 * u;
    if (mark) (doc.addImage(mark, 'PNG', bx, by - mk * 0.8, mk, mk), (bx += mk + 0.8 * u));
    txt('Antarixs', bx, by, { ...axT, color: dark.i });
    doc.link(cx - total / 2, by - 2 * u, total, 3 * u, { url: 'https://antarixs.com' });
  };

  // ponytail: built-in Times / Helvetica stand in for Cormorant Garamond / Jost (no font files to embed, so the PDF stays small); names in Hindi or other scripts the built-in fonts lack are not drawn.
  for (let i = 0; i < pages.length; i++) {
    stop();
    const pg = pages[i];
    if (i > 0) doc.addPage();
    if (pg.kind === 'cover') await cover();
    else if (pg.kind === 'divider') divider(pg.group);
    else if (pg.kind === 'designs') await designs(pg, i + 1);
    else await contact();
    await new Promise((r) => setTimeout(r)); // lets the screen repaint (progress, Cancel) between pages
  }

  doc.setProperties({ title: `${brand} - ${coverTitle}` });
  const safe = (s: string) => s.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');
  stop();
  await saveFile(doc.output('blob'), `${safe(brand)}-${safe(title)}.pdf`);
}
