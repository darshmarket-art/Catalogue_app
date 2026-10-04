import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Icon, Sheet } from '../layouts/emergent/ui';
import { shareStoreQr, storeQrBlob } from '../storeQrCard';
import { saveFile } from '../saveFile';
import { bareUrl } from '../storeLink';

/** Share the store: its QR, its link, copy, download the QR picture, or send it on WhatsApp. Reachable from the profile menu any time. */
export const StoreShareSheet: React.FC<{ name: string; url: string; onClose: () => void }> = ({ name, url, onClose }) => {
  const [qr, setQr] = useState('');
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState<'share' | 'download' | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void QRCode.toDataURL(url, { margin: 1, width: 320 }).then(setQr).catch(() => {});
  }, [url]);

  const copy = () => {
    const done = () => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };
    if (navigator.clipboard?.writeText) void navigator.clipboard.writeText(url).then(done).catch(() => setErr('Could not copy. Long-press the link to copy it.'));
    else setErr('Copying is not available here. Long-press the link to copy it.');
  };

  const run = (what: 'share' | 'download', fn: () => Promise<void>) => async () => {
    setBusy(what);
    setErr(null);
    try {
      await fn();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Sheet label="Share your store" onClose={onClose}>
      <div className="em-row em-sb">
        <span className="em-ser" style={{ fontSize: 22 }}>
          Share your store
        </span>
        <button type="button" className="em-circ" aria-label="Close" onClick={onClose}>
          <Icon n="x" size={16} />
        </button>
      </div>
      <p className="em-mut" style={{ fontSize: 13, marginTop: -4 }}>
        Buyers open this link or scan the QR, sign in with their WhatsApp number, and browse your catalogue.
      </p>
      <div className="em-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: 18 }}>
        {qr ? (
          <img src={qr} alt={`QR code for ${name}`} data-testid="store-qr" style={{ width: 180, height: 180, borderRadius: 12, border: '1px solid var(--em-line)', padding: 8, background: '#fff' }} />
        ) : (
          <div className="em-skel" style={{ width: 180, height: 180, borderRadius: 12 }} />
        )}
        <a href={url} data-testid="store-link" style={{ color: 'var(--em-primary)', fontSize: 13, fontWeight: 600, wordBreak: 'break-all', textAlign: 'center' }}>
          {bareUrl(url)}
        </a>
      </div>
      {err && <p className="em-hint" style={{ color: 'var(--color-error)' }}>{err}</p>}
      <div className="em-row" style={{ gap: 10 }}>
        <button type="button" className="em-btn sec" style={{ flex: 1 }} data-testid="store-copy-link" onClick={copy}>
          <Icon n={copied ? 'check' : 'link'} size={16} />
          {copied ? 'Copied' : 'Copy link'}
        </button>
        <button type="button" className="em-btn sec" style={{ flex: 1 }} data-testid="store-download-qr" disabled={busy !== null} onClick={run('download', async () => saveFile(await storeQrBlob(name, url), `${bareUrl(url).split(/[./?=]/)[0]}-qr.png`))}>
          <Icon n="down" size={16} />
          {busy === 'download' ? 'Preparing…' : 'Download QR'}
        </button>
      </div>
      <button type="button" className="em-btn wa" data-testid="store-share-whatsapp" disabled={busy !== null} onClick={run('share', () => shareStoreQr(name, url))}>
        <Icon n="wa" size={18} />
        {busy === 'share' ? 'Preparing…' : 'Share on WhatsApp'}
      </button>
    </Sheet>
  );
};
