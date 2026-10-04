import type { Category, Product } from './types';
import { merchant } from './merchant';
import { antarixsMarkPng } from './antarixsLogo';
import { saveFile } from './saveFile';
import { CARD_H, CELL, COLS, FIRST_TOP, GAP, H, MARGIN, NEXT_TOP, W, pdfPages } from './pdfLayout';

const PHOTO_PX = 520;

/** The theme's main colour as RGB, so the PDF carries the merchant's own colour. */
function themeColour(): [number, number, number] {
  const hex = getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim();
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  return m ? [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16)] : [91, 33, 66];
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
  ctx.translate(PHOTO_PX / 2, PHOTO_PX / 2);
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

/** A square, centre-cropped, watermarked JPEG of the photo; null if the browser will not let us read it. */
function squareJpeg(img: HTMLImageElement, watermark: string): string | null {
  try {
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = PHOTO_PX;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, PHOTO_PX, PHOTO_PX);
    stamp(ctx, watermark);
    return canvas.toDataURL('image/jpeg', 0.82);
  } catch {
    return null;
  }
}

/**
 * Builds a PDF of one collection (cover, then photos, names and weights)
 * and downloads it. The PDF library is loaded only when this is used.
 */
export async function downloadCataloguePdf(category: Category, products: Product[], onProgress?: (done: number, total: number) => void) {
  const items = products.filter((p) => p.category === category.name);
  if (items.length === 0) throw new Error('This collection has no designs yet.');
  return downloadDesignsPdf(category.name, items, onProgress);
}

/** The same PDF for designs the owner picked by hand. `title` appears in the file name and on the cover. The file is downloaded (on phones too), and every photo carries one brand watermark in its pixels, and the last page thanks the buyer with the store's quick links. */
export async function downloadDesignsPdf(title: string, items: Product[], onProgress?: (done: number, total: number) => void, _mode: 'save' | 'share' = 'save') {
  if (items.length === 0) throw new Error('Pick at least one design first.');

  const { jsPDF } = await import('jspdf');
  const [r, g, b] = themeColour();
  const deep: [number, number, number] = [Math.round(r * 0.62), Math.round(g * 0.62), Math.round(b * 0.62)];
  const GOLD: [number, number, number] = [193, 154, 85];
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  // The store's own product fields (merchant.productFields) get a line under the weights, when it records any.
  const detail = (p: Product) => merchant.productFields.filter((f) => p.extra?.[f.key] !== undefined).map((f) => `${f.label} ${p.extra![f.key]}${f.unit ? ` ${f.unit}` : ''}`).join(' · ');
  const phone = merchant.contact.deskPhone || `+${merchant.contact.whatsapp}`;

  // Photos are fetched a few at a time so a big collection does not flood the connection.
  const photos: Array<string | null> = [];
  for (let i = 0; i < items.length; i += 4) {
    const batch = await Promise.all(items.slice(i, i + 4).map(async (p) => (p.image ? await loadImage(p.image).then((img) => (img ? squareJpeg(img, merchant.brand.name) : null)) : null)));
    photos.push(...batch);
    onProgress?.(Math.min(i + 4, items.length), items.length);
  }

  const brand = merchant.brand.name;
  const mark = antarixsMarkPng();
  const date = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  const pages = pdfPages(items.length);

  const cover = () => {
    const x = MARGIN;
    const y = 14;
    const w = W - 2 * MARGIN;
    doc.setFillColor(...deep);
    doc.roundedRect(x, y, w, 70, 4, 4, 'F');
    doc.setTextColor(...GOLD);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text(`WHOLESALE CATALOGUE  ·  ${date.toUpperCase()}`, x + 10, y + 14);
    doc.setTextColor(250, 246, 241);
    doc.setFont('times', 'normal');
    doc.setFontSize(28);
    doc.text(doc.splitTextToSize(brand, w - 20).slice(0, 1), x + 10, y + 29);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(222, 214, 218);
    if (merchant.brand.tagline) doc.text(doc.splitTextToSize(merchant.brand.tagline, w - 20).slice(0, 1), x + 10, y + 36);
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(0.3);
    doc.line(x + 10, y + 42, x + 10 + 18, y + 42);
    const meta: Array<[string, string]> = [
      ['WHATSAPP', phone],
      ['SHOWROOM', merchant.contact.address || brand],
      ['ONLINE', window.location.hostname]
    ];
    meta.forEach(([label, value], i) => {
      const mx = x + 10 + i * ((w - 20) / 3);
      doc.setTextColor(...GOLD);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.text(label, mx, y + 52);
      doc.setTextColor(240, 234, 238);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(doc.splitTextToSize(value, (w - 20) / 3 - 4).slice(0, 2), mx, y + 57);
    });
    doc.setTextColor(30, 20, 28);
    doc.setFont('times', 'normal');
    doc.setFontSize(15);
    doc.text(`${items.length} selected design${items.length === 1 ? '' : 's'}${title && title !== 'Selection' ? `  ·  ${title}` : ''}`, MARGIN, y + 70 + 12);
  };

  const footer = (page: number) => {
    const y = H - 12;
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, y - 5, W - MARGIN, y - 5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(112, 104, 99);
    doc.text(`Weights are net of stones and tare. Enquire on WhatsApp ${phone}`, MARGIN, y);
    doc.text(`Page ${page + 1} of ${pages.length + 1}`, MARGIN, y + 4.5);
    // "Powered by [mark] Antarixs", right-aligned
    doc.setFont('times', 'normal');
    doc.setFontSize(10);
    const word = 'Antarixs';
    const ww = doc.getTextWidth(word);
    doc.setTextColor(26, 26, 26);
    doc.text(word, W - MARGIN - ww, y + 1);
    if (mark) doc.addImage(mark, 'PNG', W - MARGIN - ww - 6, y - 3.2, 5, 5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(112, 104, 99);
    const pb = 'Powered by';
    doc.text(pb, W - MARGIN - ww - 7 - doc.getTextWidth(pb), y + 1);
  };

  let index = 0;
  pages.forEach((count, page) => {
    if (page > 0) doc.addPage();
    if (page === 0) cover();
    const top = page === 0 ? FIRST_TOP : NEXT_TOP;
    for (let n = 0; n < count; n++, index++) {
      const p = items[index];
      const x = MARGIN + (n % COLS) * (CELL + GAP);
      const y = top + Math.floor(n / COLS) * (CARD_H + GAP);
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(230, 221, 208);
      doc.setLineWidth(0.25);
      doc.roundedRect(x, y, CELL, CARD_H, 3, 3, 'FD');
      const photo = photos[index];
      if (photo) doc.addImage(photo, 'JPEG', x + 0.3, y + 0.3, CELL - 0.6, CELL - 0.6);
      else {
        doc.setFillColor(240, 230, 216);
        doc.rect(x + 0.3, y + 0.3, CELL - 0.6, CELL - 0.6, 'F');
      }
      doc.setTextColor(26, 26, 26);
      doc.setFont('times', 'normal');
      doc.setFontSize(11);
      doc.text(doc.splitTextToSize(p.title, CELL - 8).slice(0, 1), x + 4, y + CELL + 6);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(112, 104, 99);
      doc.text(`${p.sku}  ·  ${p.category}`, x + 4, y + CELL + 10);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(r, g, b);
      doc.text(p.purity, x + 4, y + CELL + 15);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(26, 26, 26);
      doc.text(`${p.netWt.toFixed(3)} g net`, x + CELL - 4, y + CELL + 15, { align: 'right' });
      const extra = detail(p);
      if (extra) {
        doc.setFontSize(6.5);
        doc.setTextColor(112, 104, 99);
        doc.text(doc.splitTextToSize(extra, CELL - 8).slice(0, 1), x + 4, y + CELL + 18.3);
      }
    }
    footer(page);
  });

  // Last page: thank you, with the store's quick links (each is tappable in the PDF).
  doc.addPage();
  {
    const x = MARGIN;
    const y = 30;
    const w = W - 2 * MARGIN;
    doc.setFillColor(...deep);
    doc.roundedRect(x, y, w, 160, 4, 4, 'F');
    doc.setTextColor(...GOLD);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text('THANK YOU FOR BROWSING', x + 12, y + 18);
    doc.setTextColor(250, 246, 241);
    doc.setFont('times', 'normal');
    doc.setFontSize(30);
    doc.text('Thank you', x + 12, y + 36);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(222, 214, 218);
    doc.text(doc.splitTextToSize(`We would love to make these pieces yours. Message us on WhatsApp for rates, availability and orders.`, w - 24), x + 12, y + 45);
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(0.3);
    doc.line(x + 12, y + 58, x + 12 + 18, y + 58);
    const c = merchant.contact;
    const digits = c.whatsapp.replace(/[^0-9]/g, '');
    const links: Array<[string, string, string]> = [
      ['WHATSAPP', phone, `https://wa.me/${digits}`],
      ['CALL', phone, `tel:+${digits}`],
      ...(c.address ? ([['SHOWROOM', c.address, `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.address)}`]] as Array<[string, string, string]>) : []),
      ['ONLINE CATALOGUE', window.location.host, window.location.origin],
      ...(c.instagramUrl ? ([['INSTAGRAM', c.instagramUrl.replace(/^https?:\/\/(www\.)?/, ''), c.instagramUrl]] as Array<[string, string, string]>) : []),
      ...(c.facebookUrl ? ([['FACEBOOK', c.facebookUrl.replace(/^https?:\/\/(www\.)?/, ''), c.facebookUrl]] as Array<[string, string, string]>) : []),
      ...(c.youtubeUrl ? ([['YOUTUBE', c.youtubeUrl.replace(/^https?:\/\/(www\.)?/, ''), c.youtubeUrl]] as Array<[string, string, string]>) : [])
    ];
    let ly = y + 70;
    for (const [label, text, url] of links.slice(0, 6)) {
      doc.setTextColor(...GOLD);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.text(label, x + 12, ly);
      doc.setTextColor(250, 246, 241);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      const line = doc.splitTextToSize(text, w - 24)[0] as string;
      doc.textWithLink(line, x + 12, ly + 5, { url });
      ly += 14;
    }
    doc.setTextColor(112, 104, 99);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`Prices and availability are confirmed on WhatsApp. ${brand}`, x, y + 172);
  }
  footer(pages.length);

  const safe = (s: string) => s.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');
  saveFile(doc.output('blob'), `${safe(brand)}-${safe(title)}.pdf`);
}
