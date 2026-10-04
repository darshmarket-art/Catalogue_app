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
function hexMark(doc: any, cx: number, cy: number, r: number, fill: [number, number, number]) {
  doc.setFillColor(...fill);
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.25);
  doc.circle(cx, cy, r, 'FD');
  const hr = r * 0.46;
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

  const mark = antarixsMarkPng();
  const pages = pdfPages(items.length, withDetail);
  const totalPages = pages.length + 1;
  const cardH = cardHeight(withDetail);

  const header = () => {
    hexMark(doc, MARGIN + 6, 22, 6, [247, 240, 228]);
    doc.setTextColor(26, 26, 26);
    doc.setFont('times', 'normal');
    doc.setFontSize(17);
    doc.text(doc.splitTextToSize(brand, 100).slice(0, 1), MARGIN + 16, 21);
    if (merchant.brand.tagline) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.5);
      doc.setTextColor(112, 104, 99);
      doc.text(doc.splitTextToSize(merchant.brand.tagline.toUpperCase(), 100).slice(0, 1), MARGIN + 16, 25.5, { charSpace: 0.35 });
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(r, g, b);
    doc.text(phone, W - MARGIN, 20, { align: 'right' });
    const place = (merchant.contact.address || '').split(',').map((s) => s.trim()).filter(Boolean).slice(-2).join(', ');
    if (place) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(112, 104, 99);
      doc.text(doc.splitTextToSize(place, 60).slice(0, 1), W - MARGIN, 24, { align: 'right' });
    }
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, 32, W - MARGIN, 32);
  };

  const footer = (page: number) => {
    const y = H - 9;
    doc.setDrawColor(230, 221, 208);
    doc.setLineWidth(0.25);
    doc.line(MARGIN, y - 4.5, W - MARGIN, y - 4.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
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
      doc.setLineWidth(0.45);
      doc.roundedRect(x, y, CELL, cardH, 3, 3, 'FD');
      const photo = photos[index];
      if (photo) doc.addImage(photo, 'JPEG', x + CARD_PAD, y + CARD_PAD, PHOTO_W, PHOTO_H);
      else {
        doc.setFillColor(240, 230, 216);
        doc.roundedRect(x + CARD_PAD, y + CARD_PAD, PHOTO_W, PHOTO_H, 2, 2, 'F');
      }
      const ty = y + CARD_PAD + PHOTO_H;
      doc.setTextColor(26, 26, 26);
      doc.setFont('times', 'normal');
      doc.setFontSize(11);
      doc.text(doc.splitTextToSize(p.title, CELL - 8).slice(0, 1), x + 3.5, ty + 6);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(112, 104, 99);
      doc.text(`${p.sku} · `, x + 3.5, ty + 11);
      const skuW = doc.getTextWidth(`${p.sku} · `);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(r, g, b);
      doc.text(p.purity, x + 3.5 + skuW, ty + 11);
      doc.text(`${p.netWt.toFixed(3)} g`, x + CELL - 3.5, ty + 11, { align: 'right' });
      const extra = detail(p);
      if (extra) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(112, 104, 99);
        doc.text(doc.splitTextToSize(extra, CELL - 7).slice(0, 1), x + 3.5, ty + 14.5);
      }
    }
    footer(page);
  });

  // Last page (atlas): dark, centred. Thank you, the store name, a QR to open the store, the phone number, Powered by Antarixs.
  doc.addPage();
  doc.setFillColor(...deep);
  doc.rect(0, 0, W, H, 'F');
  hexMark(doc, W / 2, 62, 11, [84, 45, 62]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...GOLD);
  doc.text('THANK YOU', W / 2, 90, { align: 'center', charSpace: 1.2 });
  doc.setFont('times', 'normal');
  doc.setFontSize(26);
  doc.setTextColor(250, 246, 241);
  doc.text(doc.splitTextToSize(brand, W - 50).slice(0, 2), W / 2, 102, { align: 'center' });
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.3);
  doc.line(W / 2 - 11, 118, W / 2 + 11, 118);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(214, 204, 210);
  doc.text(doc.splitTextToSize('Scan to open our store, shortlist designs and send your order on WhatsApp.', 110), W / 2, 130, { align: 'center' });
  try {
    const qr = await QRCode.toDataURL(window.location.origin, { margin: 1, width: 480, color: { dark: `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`, light: '#ffffff' } });
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(W / 2 - 25, 146, 50, 50, 3, 3, 'F');
    doc.addImage(qr, 'PNG', W / 2 - 22, 149, 44, 44);
  } catch {
    // the QR is a nicety; the phone number below still reaches the store
  }
  doc.setFont('times', 'normal');
  doc.setFontSize(15);
  doc.setTextColor(...GOLD);
  doc.text(phone, W / 2, 210, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(170, 150, 160);
  doc.text(`Page ${totalPages} of ${totalPages}`, W / 2, H - 9, { align: 'center' });
  // Powered by [mark] Antarixs
  doc.setFont('times', 'normal');
  doc.setFontSize(10);
  const word = 'Antarixs';
  const ww = doc.getTextWidth(word);
  doc.setFontSize(7);
  const pb = 'Powered by';
  const pw = doc.getTextWidth(pb);
  const total = pw + 2 + 5 + 1.5 + ww * 1;
  const px = (W - total) / 2;
  doc.setTextColor(200, 188, 196);
  doc.text(pb, px, H - 17);
  if (mark) doc.addImage(mark, 'PNG', px + pw + 2, H - 20.7, 5, 5);
  doc.setFont('times', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(250, 246, 241);
  doc.text(word, px + pw + 2 + 5 + 1.5, H - 17);

  const safe = (s: string) => s.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');
  saveFile(doc.output('blob'), `${safe(brand)}-${safe(title)}.pdf`);
}
