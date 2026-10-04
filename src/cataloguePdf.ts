import QRCode from 'qrcode';
import type { Category, Product } from './types';
import { merchant } from './merchant';
import { antarixsMarkPng } from './antarixsLogo';
import { saveFile } from './saveFile';
import { CARD_PAD, CELL, COLS, FIRST_TOP, GAP, H, MARGIN, NEXT_TOP, PHOTO_H, PHOTO_W, W, cardHeight, pdfPages } from './pdfLayout';

const PHOTO_PX = 560;
const PHOTO_PY = Math.round(PHOTO_PX * (PHOTO_H / PHOTO_W));
const GOLD: [number, number, number] = [201, 169, 97];

/** The theme's main colour as RGB, so the PDF carries the merchant's own colour. */
function themeColour(): [number, number, number] {
  const hex = getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim();
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  return m ? [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16)] : [92, 31, 58];
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = new URL(src, window.location.origin).href;
  });
}

/** One brand mark across the middle of the photo, in the pixels themselves, so it cannot be peeled off the PDF as a separate layer and does not blur the design. */
function stamp(ctx: CanvasRenderingContext2D, text: string) {
  const label = text.toUpperCase();
  ctx.save();
  ctx.translate(PHOTO_PX / 2, PHOTO_PY / 2);
  ctx.rotate(-Math.PI / 6);
  // the largest size that keeps the name within 70% of the photo width
  let size = 40;
  do ctx.font = `700 ${size--}px Helvetica, Arial, sans-serif`;
  while (ctx.measureText(label).width > PHOTO_PX * 0.7 && size > 14);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(0,0,0,0.28)';
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.strokeText(label, 0, 0);
  ctx.fillText(label, 0, 0);
  ctx.restore();
}

/** The photo centre-cropped to the card's photo shape, with the watermark; null if the browser will not let us read it. */
function cardJpeg(img: HTMLImageElement, watermark: string): string | null {
  try {
    const want = PHOTO_PX / PHOTO_PY;
    let sw = img.naturalWidth;
    let sh = sw / want;
    if (sh > img.naturalHeight) {
      sh = img.naturalHeight;
      sw = sh * want;
    }
    const canvas = document.createElement('canvas');
    canvas.width = PHOTO_PX;
    canvas.height = PHOTO_PY;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, 0, 0, PHOTO_PX, PHOTO_PY);
    stamp(ctx, watermark);
    return canvas.toDataURL('image/jpeg', 0.82);
  } catch {
    return null;
  }
}

/** The atlas's store mark: a gold-ringed circle with a hexagon in it. */
function hexMark(doc: any, cx: number, cy: number, r: number, fill: [number, number, number], hexR = r * 0.46) {
  doc.setFillColor(...fill);
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.25);
  doc.circle(cx, cy, r, 'FD');
  const hr = hexR;
  const pts = Array.from({ length: 6 }, (_, i) => [cx + hr * Math.cos(Math.PI / 6 + (i * Math.PI) / 3), cy + hr * Math.sin(Math.PI / 6 + (i * Math.PI) / 3)]);
  const d = pts.map((p, i) => [pts[(i + 1) % 6][0] - p[0], pts[(i + 1) % 6][1] - p[1]]);
  doc.lines(d.slice(0, 5), pts[0][0], pts[0][1], [1, 1], 'S', true);
}

/**
 * Builds a PDF of one collection and downloads it. The PDF library is loaded only when this is used.
 */
export async function downloadCataloguePdf(category: Category, products: Product[], onProgress?: (done: number, total: number) => void) {
  const items = products.filter((p) => p.category === category.name);
  if (items.length === 0) throw new Error('This collection has no designs yet.');
  return downloadDesignsPdf(category.name, items, onProgress);
}

/**
 * The same PDF for designs the owner picked by hand (Emergent atlas "PDF layout"): store header, gold-bordered design cards in
 * two columns, a "Net weight per piece" footer, and a dark "Thank you" page with the store's QR and phone number.
 * The file is downloaded (on phones too); every photo carries one brand watermark in its pixels.
 */
export async function downloadDesignsPdf(title: string, items: Product[], onProgress?: (done: number, total: number) => void, _mode: 'save' | 'share' = 'save') {
  if (items.length === 0) throw new Error('Pick at least one design first.');

  const { jsPDF } = await import('jspdf');
  const [r, g, b] = themeColour();
  const deep: [number, number, number] = [Math.round(r * 0.68), Math.round(g * 0.68), Math.round(b * 0.68)];
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  // The store's own product fields (merchant.productFields) get a line under the weights, when it records any.
  const detail = (p: Product) => merchant.productFields.filter((f) => p.extra?.[f.key] !== undefined).map((f) => `${f.label} ${p.extra![f.key]}${f.unit ? ` ${f.unit}` : ''}`).join(' · ');
  const withDetail = items.some((p) => detail(p) !== '');
  const phone = merchant.contact.deskPhone || `+${merchant.contact.whatsapp}`;
  const brand = merchant.brand.name;

  // Photos are fetched a few at a time so a big collection does not flood the connection.
  const photos: Array<string | null> = [];
  for (let i = 0; i < items.length; i += 4) {
    const batch = await Promise.all(items.slice(i, i + 4).map(async (p) => (p.image ? await loadImage(p.image).then((img) => (img ? cardJpeg(img, brand) : null)) : null)));
    photos.push(...batch);
    onProgress?.(Math.min(i + 4, items.length), items.length);
  }

  const pages = pdfPages(items.length, withDetail);
  const totalPages = pages.length + 1;
  const cardH = cardHeight(withDetail);

  const header = () => {
    hexMark(doc, MARGIN + 10.7, 23, 10.7, [247, 240, 228], 5);
    doc.setTextColor(26, 26, 26);
    doc.setFont('times', 'normal');
    doc.setFontSize(30);
    doc.text(doc.splitTextToSize(brand, 100).slice(0, 1), MARGIN + 25, 22);
    if (merchant.brand.tagline) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(112, 104, 99);
      doc.text(doc.splitTextToSize(merchant.brand.tagline.toUpperCase(), 100).slice(0, 1), MARGIN + 25, 30.5, { charSpace: 0.5 });
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(r, g, b);
    doc.text(phone, W - MARGIN, 19, { align: 'right' });
    const place = (merchant.contact.address || '').split(',').map((s) => s.trim()).filter(Boolean).slice(-2).join(', ');
    if (place) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(12.5);
      doc.setTextColor(112, 104, 99);
      doc.text(doc.splitTextToSize(place, 70).slice(0, 1), W - MARGIN, 26, { align: 'right' });
    }
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, 40, W - MARGIN, 40);
  };

  const footer = (page: number) => {
    const y = H - 9;
    doc.setDrawColor(230, 221, 208);
    doc.setLineWidth(0.25);
    doc.line(MARGIN, y - 6, W - MARGIN, y - 6);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(13);
    doc.setTextColor(112, 104, 99);
    doc.text('Net weight per piece', MARGIN, y);
    doc.text(`Page ${page + 1} of ${totalPages}`, W - MARGIN, y, { align: 'right' });
  };

  let index = 0;
  pages.forEach((count, page) => {
    if (page > 0) doc.addPage();
    doc.setFillColor(250, 246, 241);
    doc.rect(0, 0, W, H, 'F');
    if (page === 0) header();
    const top = page === 0 ? FIRST_TOP : NEXT_TOP;
    for (let n = 0; n < count; n++, index++) {
      const p = items[index];
      const x = MARGIN + (n % COLS) * (CELL + GAP);
      const y = top + Math.floor(n / COLS) * (cardH + GAP);
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(...GOLD);
      doc.setLineWidth(0.5);
      doc.roundedRect(x, y, CELL, cardH, 5, 5, 'FD');
      const photo = photos[index];
      if (photo) doc.addImage(photo, 'JPEG', x + CARD_PAD, y + CARD_PAD, PHOTO_W, PHOTO_H);
      else {
        doc.setFillColor(240, 230, 216);
        doc.roundedRect(x + CARD_PAD, y + CARD_PAD, PHOTO_W, PHOTO_H, 3, 3, 'F');
      }
      const ty = y + CARD_PAD + PHOTO_H;
      const tx = x + CARD_PAD + 1.5;
      doc.setTextColor(26, 26, 26);
      doc.setFont('times', 'normal');
      doc.setFontSize(20);
      doc.text(doc.splitTextToSize(p.title, CELL - 10).slice(0, 1), tx, ty + 11);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(15);
      doc.setTextColor(112, 104, 99);
      doc.text(`${p.sku} · `, tx, ty + 19.5);
      const skuW = doc.getTextWidth(`${p.sku} · `);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(r, g, b);
      doc.text(p.purity, tx + skuW, ty + 19.5);
      doc.text(`${p.netWt.toFixed(3)} g`, x + CELL - CARD_PAD - 1.5, ty + 19.5, { align: 'right' });
      const extra = detail(p);
      if (extra) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(11);
        doc.setTextColor(112, 104, 99);
        doc.text(doc.splitTextToSize(extra, CELL - 10).slice(0, 1), tx, ty + 25.5);
      }
    }
    footer(page);
  });

  // Last page, drawn to the atlas "Page 2 / Last page" at its proportions: the atlas page is 334 px wide, so 1 px = 0.6287 mm and 1 px of type = 1.78 pt.
  // Top to bottom: mark circle, THANK YOU, store name, gold rule, one line of copy, QR, phone, "Powered by Antarixs" at the foot.
  const mm = 0.6287;
  const pt = 1.782;
  const mix = (c: number[], d: number[], k: number): [number, number, number] => [0, 1, 2].map((i) => Math.round(d[i] + (c[i] - d[i]) * k)) as [number, number, number];
  const cream = [250, 246, 241];
  doc.addPage();
  doc.setFillColor(...deep);
  doc.rect(0, 0, W, H, 'F');
  hexMark(doc, W / 2, 85 * mm, 23 * mm, mix(GOLD, deep, 0.16), 21 * 0.46 * mm);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5 * pt);
  doc.setTextColor(...GOLD);
  doc.text('THANK YOU', W / 2, 136.5 * mm, { align: 'center', charSpace: 0.2 * 7.5 * mm });
  doc.setFont('times', 'normal');
  doc.setFontSize(25 * pt);
  doc.setTextColor(...(cream as [number, number, number]));
  const nameLines = doc.splitTextToSize(brand, 286 * mm).slice(0, 2);
  doc.text(nameLines, W / 2, 168 * mm, { align: 'center', lineHeightFactor: 1.2 });
  const afterName = (168 + (nameLines.length - 1) * 30) * mm + 23 * mm;
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.3);
  doc.line(W / 2 - 22 * mm, afterName, W / 2 + 22 * mm, afterName);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11.2 * pt);
  doc.setTextColor(...mix(cream, deep, 0.75));
  doc.text(doc.splitTextToSize('Scan to open our store, shortlist designs and send your order on WhatsApp.', 262 * mm), W / 2, afterName + 26 * mm, { align: 'center', lineHeightFactor: 1.55 });
  const qrTop = afterName + 66 * mm;
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(W / 2 - 48 * mm, qrTop, 96 * mm, 96 * mm, 6 * mm, 6 * mm, 'F');
  try {
    const qr = await QRCode.toDataURL(window.location.origin, { margin: 0, width: 480, color: { dark: `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`, light: '#ffffff' } });
    doc.addImage(qr, 'PNG', W / 2 - 40 * mm, qrTop + 8 * mm, 80 * mm, 80 * mm);
    doc.link(W / 2 - 48 * mm, qrTop, 96 * mm, 96 * mm, { url: window.location.origin }); // tapping the QR opens the owner's store
  } catch {
    // the QR is a nicety; the phone number below still reaches the store
  }
  doc.setFont('times', 'normal');
  doc.setFontSize(15 * pt);
  doc.setTextColor(...GOLD);
  doc.text(phone, W / 2, qrTop + 96 * mm + 30 * mm, { align: 'center' });
  const phoneW = doc.getTextWidth(phone);
  doc.link(W / 2 - phoneW / 2, qrTop + 96 * mm + 21 * mm, phoneW, 12, { url: `https://wa.me/${merchant.contact.whatsapp.replace(/[^0-9]/g, '')}` });
  // "Powered by [logo] Antarixs": the same pill as the store pages (rounded, hairline border, soft fill), linking to antarixs.com.
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const pbText = 'Powered by';
  const pbW = doc.getTextWidth(pbText);
  doc.setFont('times', 'normal');
  doc.setFontSize(12);
  const axW = doc.getTextWidth('Antarixs');
  const markSize = 5.5;
  const pillW = 5 + pbW + 2.2 + markSize + 2.2 + axW + 5;
  const pillH = 9.5;
  const pillX = (W - pillW) / 2;
  const pillY = H - 12 - pillH;
  doc.setFillColor(...mix(cream, deep, 0.08));
  doc.setDrawColor(...mix(cream, deep, 0.28));
  doc.setLineWidth(0.25);
  doc.roundedRect(pillX, pillY, pillW, pillH, pillH / 2, pillH / 2, 'FD');
  const baseY = pillY + pillH / 2 + 1.3;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...mix(cream, deep, 0.7));
  doc.text(pbText, pillX + 5, baseY - 0.2);
  const markDark = antarixsMarkPng(160, true);
  if (markDark) doc.addImage(markDark, 'PNG', pillX + 5 + pbW + 2.2, pillY + (pillH - markSize) / 2, markSize, markSize);
  doc.setFont('times', 'normal');
  doc.setFontSize(12);
  doc.setTextColor(...(cream as [number, number, number]));
  doc.text('Antarixs', pillX + 5 + pbW + 2.2 + markSize + 2.2, baseY);
  doc.link(pillX, pillY, pillW, pillH, { url: 'https://antarixs.com' });

  const safe = (s: string) => s.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');
  saveFile(doc.output('blob'), `${safe(brand)}-${safe(title)}.pdf`);
}
