import React, { useMemo, useState } from 'react';
import type { Category, Product } from '../types';
import { merchant } from '../merchant';
import { downloadDesignsPdf } from '../cataloguePdf';
import { Chip, I, Notice, Photo, Toast } from './ui';

// The share sheet is offered where the browser has one (phones); everywhere else the PDF downloads.
const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

/**
 * PDF catalogue (admin): pick designs from every collection, then download or share one PDF.
 * A screen of its own, so it works the same in every layout (the buyer Catalogue screen is layout-specific).
 */
export const PdfCatalogueScreen: React.FC<{ products: Product[]; categories: Category[] }> = ({ products, categories }) => {
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [collection, setCollection] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const visible = useMemo(() => products.filter((p) => !collection || p.category === collection), [products, collection]);
  const chips = categories.map((c) => c.name).filter((name) => products.some((p) => p.category === name));
  const chosen = products.filter((p) => picked.has(p.id));
  const collections = new Set(chosen.map((p) => p.category)).size;
  // One collection picked: its name is the title and file name; a mix is called a selection.
  const title = collections === 1 ? chosen[0].category : 'Selection';
  const allVisiblePicked = visible.length > 0 && visible.every((p) => picked.has(p.id));

  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleVisible = () =>
    setPicked((prev) => {
      const next = new Set(prev);
      for (const p of visible) {
        if (allVisiblePicked) next.delete(p.id);
        else next.add(p.id);
      }
      return next;
    });

  const run = async (mode: 'save' | 'share') => {
    setBusy(true);
    setError(null);
    setStatus('Preparing the PDF…');
    try {
      await downloadDesignsPdf(title, chosen, (done, total) => setStatus(`Preparing the PDF… ${done} of ${total} photos`), mode);
      setStatus(mode === 'share' ? 'PDF ready' : 'PDF downloaded');
      setTimeout(() => setStatus(null), 3000);
    } catch (err) {
      setStatus(null);
      setError(err instanceof Error ? err.message : 'Could not create the PDF.');
    }
    setBusy(false);
  };

  return (
    <div className="scroll no-tabs" style={{ gap: 12, paddingBottom: 'calc(150px + var(--sab))' }}>
      {status && (
        <Toast>
          <I n="check" size="s" />
          {status}
        </Toast>
      )}

      <section className="hero col" style={{ gap: 6, padding: '18px 18px 16px' }} data-testid="pdf-preview">
        <span className="eyebrow">Your PDF</span>
        <h2 style={{ fontSize: 26, lineHeight: 1.1, color: '#fff7ea' }}>{merchant.brand.name}</h2>
        {merchant.brand.tagline && <p className="sub" style={{ fontSize: 13 }}>{merchant.brand.tagline}</p>}
        <div className="row" style={{ gap: 0, borderTop: '1px solid rgb(226 195 137 / 0.3)', paddingTop: 12, marginTop: 8 }}>
          <div className="grow">
            <span className="stat" style={{ fontSize: 24, color: '#fff7ea' }} data-testid="pdf-count">
              {chosen.length}
            </span>
            <span className="sub" style={{ display: 'block', fontSize: 12.5 }}>
              {chosen.length === 1 ? 'Design' : 'Designs'}
            </span>
          </div>
          <div className="grow" style={{ borderLeft: '1px solid rgb(226 195 137 / 0.3)', paddingLeft: 14 }}>
            <span className="stat" style={{ fontSize: 24, color: '#fff7ea' }}>
              {collections}
            </span>
            <span className="sub" style={{ display: 'block', fontSize: 12.5 }}>
              {collections === 1 ? 'Collection' : 'Collections'}
            </span>
          </div>
        </div>
      </section>

      <div>
        <h2 style={{ fontSize: 22 }}>Pick designs</h2>
        <p className="hint" style={{ marginTop: 4 }}>
          Each design gets its photo, name and details from your catalogue, with {merchant.brand.name} as a watermark. No prices.
        </p>
      </div>

      {error && <Notice tone="error">{error}</Notice>}

      {products.length === 0 ? (
        <p className="sub" style={{ textAlign: 'center', padding: '32px 0' }}>
          No designs have been added yet. Add designs, then come back to share them.
        </p>
      ) : (
        <>
          <div className="chips">
            <Chip active={!collection} onClick={() => setCollection(null)}>
              All
            </Chip>
            {chips.map((name) => (
              <Chip key={name} active={collection === name} onClick={() => setCollection(collection === name ? null : name)}>
                {name}
              </Chip>
            ))}
          </div>

          <div className="grid2 md:!grid-cols-3" data-testid="pdf-grid">
            {visible.map((p, i) => {
              const on = picked.has(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  data-testid={`pdf-pick-${p.sku}`}
                  aria-pressed={on}
                  aria-label={`${on ? 'Remove' : 'Add'} ${p.title}`}
                  onClick={() => toggle(p.id)}
                  className="card col"
                  style={{ gap: 6, padding: 10, outline: on ? '2.5px solid var(--plum)' : undefined, opacity: picked.size > 0 && !on ? 0.78 : 1 }}
                >
                  <Photo src={p.image} tone={i} style={{ height: 112, width: '100%' }}>
                    <span
                      aria-hidden="true"
                      className={on ? 'mark' : ''}
                      style={{ position: 'absolute', right: 8, top: 8, width: 26, height: 26, borderRadius: '50%', zIndex: 2, ...(on ? {} : { background: 'var(--card)', border: '2px solid var(--dash)' }) }}
                    >
                      {on && <I n="check" size="s" />}
                    </span>
                  </Photo>
                  <b style={{ fontSize: 14.5, lineHeight: 1.3 }} className="line-clamp-2">
                    {p.title}
                  </b>
                  <span className="sub" style={{ fontSize: 13 }}>
                    {p.sku} · {p.purity.split(' ')[0]}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="dock low">
            <div className="card col" style={{ gap: 10, padding: '12px 16px', boxShadow: 'var(--sh-2)' }}>
              <div className="row">
                <b className="grow" data-testid="pdf-selected">
                  {picked.size} selected
                </b>
                <button type="button" className="lnk" style={{ minHeight: 30, fontSize: 13.5 }} onClick={toggleVisible} disabled={visible.length === 0}>
                  {allVisiblePicked ? 'Clear' : `Select all ${visible.length}`}
                </button>
                {picked.size > 0 && (
                  <button type="button" className="lnk" style={{ minHeight: 30, fontSize: 13.5 }} onClick={() => setPicked(new Set())}>
                    None
                  </button>
                )}
              </div>
              <div className="row" style={{ gap: 10 }}>
                <button type="button" data-testid="pdf-export" className="btn" style={{ flex: 1, whiteSpace: 'nowrap', padding: '0 12px' }} disabled={busy || picked.size === 0} onClick={() => run('save')}>
                  <I n="download" />
                  Download PDF{picked.size > 0 ? ` · ${picked.size}` : ''}
                </button>
                {canShare && (
                  <button type="button" data-testid="pdf-share" className="btn wa" style={{ flex: 'none', width: 'auto', padding: '0 14px' }} disabled={busy || picked.size === 0} onClick={() => run('share')}>
                    <I n="whats" />
                    Share
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
