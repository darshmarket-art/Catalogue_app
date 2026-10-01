import type { Category, Product } from './types';
import { merchant } from './merchant';

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

/** A square, centre-cropped JPEG of the photo; null if the browser will not let us read it. */
function squareJpeg(img: HTMLImageElement): string | null {
  try {
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = PHOTO_PX;
    canvas.getContext('2d')!.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, PHOTO_PX, PHOTO_PX);
    return canvas.toDataURL('image/jpeg', 0.82);
  } catch {
    return null;
  }
}

/**
 * Builds a PDF of one collection (photos, names, weights, with the brand as a watermark on every page)
 * and downloads it. The PDF library is loaded only when this is used.
 */
export async function downloadCataloguePdf(category: Category, products: Product[], onProgress?: (done: number, total: number) => void) {
  const items = products.filter((p) => p.category === category.name);
  if (items.length === 0) throw new Error('This collection has no designs yet.');

  const { jsPDF } = await import('jspdf');
  const [r, g, b] = themeColour();
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210;
  const H = 297;
  const margin = 14;
  const cols = 3;
  const gap = 7;
  const cell = (W - 2 * margin - gap * (cols - 1)) / cols;
  const textH = 15;
  const top = 30;
  const rows = Math.floor((H - top - margin) / (cell + textH + 4));
  const perPage = cols * rows;

  // Photos are fetched a few at a time so a big collection does not flood the connection.
  const photos: Array<string | null> = [];
  for (let i = 0; i < items.length; i += 4) {
    const batch = await Promise.all(items.slice(i, i + 4).map(async (p) => (p.image ? await loadImage(p.image).then((img) => (img ? squareJpeg(img) : null)) : null)));
    photos.push(...batch);
    onProgress?.(Math.min(i + 4, items.length), items.length);
  }

  const brand = merchant.brand.name;
  const pageCount = Math.ceil(items.length / perPage);
  for (let page = 0; page < pageCount; page++) {
    if (page > 0) doc.addPage();

    doc.setTextColor(r, g, b);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(17);
    doc.text(brand.toUpperCase(), margin, 17);
    doc.setFontSize(11);
    doc.text(`${category.name} · ${items.length} ${items.length === 1 ? 'design' : 'designs'}`, W - margin, 17, { align: 'right' });
    doc.setDrawColor(r, g, b);
    doc.setLineWidth(0.4);
    doc.line(margin, 21, W - margin, 21);

    items.slice(page * perPage, (page + 1) * perPage).forEach((p, n) => {
      const x = margin + (n % cols) * (cell + gap);
      const y = top + Math.floor(n / cols) * (cell + textH + 4);
      const photo = photos[page * perPage + n];
      if (photo) {
        doc.addImage(photo, 'JPEG', x, y, cell, cell);
      } else {
        doc.setFillColor(240, 236, 232);
        doc.rect(x, y, cell, cell, 'F');
      }
      doc.setTextColor(30, 20, 28);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.text(doc.splitTextToSize(p.title, cell).slice(0, 1), x, y + cell + 5);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(95, 80, 90);
      doc.text(`${p.sku} · ${p.purity}`, x, y + cell + 9.5);
      doc.text(`Net ${p.netWt.toFixed(2)} g · Gross ${p.grossWt.toFixed(2)} g`, x, y + cell + 13.5);
    });

    // The watermark goes on last, translucent, across the middle of the page.
    doc.saveGraphicsState();
    doc.setGState(new (doc as any).GState({ opacity: 0.11 }));
    doc.setTextColor(r, g, b);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(54);
    doc.text(brand.toUpperCase(), W / 2, H / 2, { align: 'center', angle: 35 });
    doc.restoreGraphicsState();

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(140, 130, 138);
    doc.text(`${brand} · page ${page + 1} of ${pageCount}`, W / 2, H - 7, { align: 'center' });
  }

  const safe = (s: string) => s.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');
  doc.save(`${safe(brand)}-${safe(category.name)}.pdf`);
}
