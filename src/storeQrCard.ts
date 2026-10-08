import QRCode from 'qrcode';
import { AX, MARK_PATHS } from './components/AntarixsBrand';

/** The picture a new owner shares: the store's QR with its name and address, and "Powered by Antarixs" with the logo. A 1080x1350 PNG. */
export async function storeQrBlob(name: string, url: string): Promise<Blob> {
  const W = 1080;
  const H = 1350;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  const bg = g.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#4b1fc0');
  bg.addColorStop(1, AX.deep);
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);

  g.textAlign = 'center';
  g.fillStyle = AX.spark;
  g.font = '600 30px Inter, system-ui, sans-serif';
  g.fillText('SCAN TO OPEN OUR CATALOGUE', W / 2, 130);

  // Name, shrunk until it fits.
  let size = 78;
  g.fillStyle = '#fff';
  do g.font = `500 ${size--}px Fraunces, Georgia, serif`;
  while (g.measureText(name).width > W - 140 && size > 34);
  g.fillText(name, W / 2, 250);

  // QR on a white card.
  const card = { x: 190, y: 330, s: 700 };
  g.fillStyle = '#fff';
  g.beginPath();
  g.roundRect(card.x, card.y, card.s, card.s, 40);
  g.fill();
  const qr = new Image();
  qr.src = await QRCode.toDataURL(url, { margin: 0, width: 600, color: { dark: AX.deep, light: '#ffffff' } });
  await qr.decode();
  g.drawImage(qr, card.x + 50, card.y + 50, 600, 600);

  g.fillStyle = '#fff';
  g.font = '600 44px Inter, system-ui, sans-serif';
  g.fillText(url.replace(/^https?:\/\//, ''), W / 2, 1140);

  // Powered by, with the mark drawn from the same paths as the on-screen logo.
  g.fillStyle = 'rgba(255,255,255,0.75)';
  g.font = '500 28px Inter, system-ui, sans-serif';
  g.textAlign = 'left';
  const label = 'Powered by';
  const lw = g.measureText(label).width;
  const word = 'Antarixs';
  g.font = '500 40px Fraunces, Georgia, serif';
  const ww = g.measureText(word).width;
  const mark = 64;
  const x0 = (W - (lw + 16 + mark + 12 + ww)) / 2;
  const y = 1260;
  g.fillStyle = 'rgba(255,255,255,0.75)';
  g.font = '500 28px Inter, system-ui, sans-serif';
  g.fillText(label, x0, y);
  g.save();
  g.translate(x0 + lw + 16, y - 48);
  g.scale(mark / 100, mark / 100);
  const lam = g.createLinearGradient(10, 0, 95, 100);
  lam.addColorStop(0, AX.blue);
  lam.addColorStop(0.55, '#8a4dff');
  lam.addColorStop(1, '#c9b2ff');
  g.fillStyle = lam;
  g.fill(new Path2D(MARK_PATHS.lambda));
  g.fillStyle = AX.spark;
  g.fill(new Path2D(MARK_PATHS.swoosh));
  g.fill(new Path2D(MARK_PATHS.spark));
  g.restore();
  g.fillStyle = '#fff';
  g.font = '500 40px Fraunces, Georgia, serif';
  g.fillText(word, x0 + lw + 16 + mark + 12, y);

  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Could not draw the QR picture.'))), 'image/png'));
}

/** Opens the phone's share sheet with the QR picture (WhatsApp is in it). Where files cannot be shared, the picture downloads and WhatsApp opens with the link. */
export async function shareStoreQr(name: string, url: string): Promise<void> {
  const blob = await storeQrBlob(name, url);
  const file = new File([blob], `${url.replace(/^https?:\/\//, '').split('.')[0]}-qr.png`, { type: 'image/png' });
  const text = `${name}: browse our catalogue at ${url}`;
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text });
      return;
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = file.name;
  a.click();
  URL.revokeObjectURL(a.href);
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
}
