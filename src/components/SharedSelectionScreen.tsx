import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { merchant } from '../merchant';
import { errorText } from '../bugReport';
import { PhotoViewer } from './PhotoViewer';
import type { SharedSelection } from '../../shared/requests';

/**
 * A shared selection, opened from its private link (?share=<token>) with no sign-in: the pieces someone chose, their note, and a way to reach
 * the house. It shows nothing else of the store. Colours and type come from the store's theme variables, with plain fallbacks for Classic.
 */
const ink = 'var(--mx-ink, #1b1b1b)';
const muted = 'var(--mx-muted, #6b6966)';
const hair = 'var(--mx-hair, #dedbd6)';
const serif = 'var(--mx-serif, "Cormorant Garamond", Georgia, serif)';
const sans = 'var(--mx-sans, "Jost", system-ui, sans-serif)';
const eyebrow: React.CSSProperties = { fontFamily: sans, fontSize: '0.6875rem', letterSpacing: '0.24em', textTransform: 'uppercase', color: muted };
const button: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: 50, padding: '0 26px', border: `1px solid ${ink}`, background: ink, color: 'var(--mx-ground, #fff)', fontFamily: sans, fontSize: '0.75rem', fontWeight: 500, letterSpacing: '0.2em', textTransform: 'uppercase', textDecoration: 'none', cursor: 'pointer' };

export const SharedSelectionScreen: React.FC<{ token: string; onOpenStore: () => void }> = ({ token, onOpenStore }) => {
  const [data, setData] = useState<SharedSelection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState<{ images: string[]; title: string } | null>(null);
  useEffect(() => {
    api.getShare(token).then(setData).catch((e) => setError(errorText(e, 'SharedSelectionScreen', 'This link could not be opened.')));
  }, [token]);

  const ask = data ? `Hello ${data.brand}, I was sent a selection of ${data.pieces.length === 1 ? data.pieces[0].title : `${data.pieces.length} pieces`} and would like to know more.\n${data.pieces.map((p) => `• ${p.title} (${p.sku})`).join('\n')}` : '';
  return (
    <div data-testid="shared-selection" style={{ minHeight: '100dvh', background: 'var(--mx-ground, #fff)', color: ink, fontFamily: sans, display: 'flex', flexDirection: 'column' }}>
      {zoom && <PhotoViewer images={zoom.images} start={0} title={zoom.title} onClose={() => setZoom(null)} />}
      <header style={{ padding: 'calc(22px + var(--sat, 0px)) 20px 18px', textAlign: 'center', borderBottom: `1px solid ${hair}` }}>
        <span style={{ fontFamily: serif, fontSize: '1.375rem', letterSpacing: '0.24em', textTransform: 'uppercase' }}>{merchant.brand.name}</span>
      </header>

      <main style={{ flex: 1, width: '100%', maxWidth: 1100, margin: '0 auto', padding: '36px 20px 48px' }}>
        {error && (
          <div role="alert" style={{ textAlign: 'center', padding: '48px 0', display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center' }}>
            <h1 style={{ fontFamily: serif, fontWeight: 500, fontSize: '2rem', margin: 0 }}>This link has closed</h1>
            <p style={{ color: muted, margin: 0 }}>{error}</p>
            <button type="button" style={button} onClick={onOpenStore}>Visit the store</button>
          </div>
        )}
        {!data && !error && <p role="status" style={{ textAlign: 'center', color: muted, padding: '48px 0' }}>Opening the selection…</p>}
        {data && (
          <>
            <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center', marginBottom: 36 }}>
              <span style={eyebrow}>{data.pieces.length === 1 ? 'A piece chosen for you' : 'A selection for you'}</span>
              <h1 style={{ fontFamily: serif, fontWeight: 500, fontSize: 'clamp(2rem, 7vw, 3.25rem)', lineHeight: 1.08, margin: 0 }}>{data.by ? `From ${data.by}` : 'A private selection'}</h1>
              {data.note && <p data-testid="shared-note" style={{ fontFamily: serif, fontStyle: 'italic', fontSize: '1.375rem', lineHeight: 1.3, margin: '4px 0 0', maxWidth: 560 }}>“{data.note}”</p>}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${data.pieces.length === 1 ? 280 : 160}px, 1fr))`, gap: '28px 16px', maxWidth: data.pieces.length === 1 ? 520 : undefined, margin: '0 auto' }}>
              {data.pieces.map((p) => (
                <article key={p.sku} data-testid="shared-piece" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <button type="button" onClick={() => setZoom({ images: p.images.length ? p.images : [p.image], title: p.title })} aria-label={`Zoom ${p.title}`} style={{ padding: 0, border: 0, background: 'var(--mx-tile, #e7e4df)', aspectRatio: '4 / 5', overflow: 'hidden', cursor: 'zoom-in' }}>
                    <img src={p.image} alt={p.title} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  </button>
                  <h2 style={{ fontFamily: serif, fontWeight: 600, fontSize: '1.25rem', lineHeight: 1.15, margin: 0 }}>{p.title}</h2>
                  <span style={eyebrow}>{p.category}</span>
                  {data.showWeights && typeof p.netWt === 'number' && <span style={{ fontSize: '0.875rem' }}>{p.purity} · {p.netWt.toFixed(3)} g net</span>}
                </article>
              ))}
            </div>
            {data.pieces.length === 0 && <p style={{ textAlign: 'center', color: muted }}>These pieces are no longer in the catalogue.</p>}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center', marginTop: 44 }}>
              <a style={button} href={`https://wa.me/${merchant.contact.whatsapp}?text=${encodeURIComponent(ask)}`} target="_blank" rel="noopener noreferrer">Ask the house on WhatsApp</a>
              <button type="button" style={{ ...button, background: 'none', color: ink }} onClick={onOpenStore}>Visit the store</button>
            </div>
            <p style={{ ...eyebrow, textAlign: 'center', marginTop: 28 }}>Private link · open until {new Date(data.expiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })}</p>
          </>
        )}
      </main>
    </div>
  );
};
