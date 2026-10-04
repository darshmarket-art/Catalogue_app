import React, { useMemo, useState } from 'react';
import type { Category, Product } from '../types';
import { merchant } from '../merchant';
import { downloadDesignsPdf } from '../cataloguePdf';
import { Chip, Notice } from './ui';
import { Icon, Ph, Toast } from '../layouts/emergent/ui';

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
  const netTotal = chosen.reduce((sum, p) => sum + p.netWt, 0);
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
        <Toast>{status}</Toast>
      )}

      <section className="em-cover" data-testid="pdf-preview">
        <div className="em-row em-sb" style={{ alignItems: 'flex-start', gap: 12 }}>
          <div className="em-grow">
            <div className="em-ey">Cover page</div>
            <div className="em-ser" style={{ fontSize: 24, lineHeight: 1.25, marginTop: 6 }}>
              {merchant.brand.name}
            </div>
            {merchant.brand.tagline && <div style={{ fontSize: 11, opacity: 0.72, marginTop: 2 }}>{merchant.brand.tagline}</div>}
          </div>
          <span className="em-badge" style={{ width: 42, height: 42, borderRadius: '50%', border: '1px solid var(--em-gold)', background: 'color-mix(in srgb, var(--em-gold) 14%, transparent)', color: 'var(--em-gold-hi)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
            <Icon n="file" size={18} />
          </span>
        </div>
        <div style={{ height: 1, width: 48, background: 'var(--em-gold)', margin: '14px 0' }} />
        <div className="em-row" style={{ gap: 18 }}>
          <div className="m">
            <div className="em-ey" style={{ fontSize: 9 }}>{chosen.length === 1 ? 'Design' : 'Designs'}</div>
            <span data-testid="pdf-count">{chosen.length}</span>
          </div>
          <div className="m">
            <div className="em-ey" style={{ fontSize: 9 }}>Net weight</div>
            <span>{netTotal.toFixed(2)} g</span>
          </div>
          <div className="m">
            <div className="em-ey" style={{ fontSize: 9 }}>WhatsApp</div>
            <span>{merchant.contact.whatsapp ? `+${merchant.contact.whatsapp}` : '-'}</span>
          </div>
        </div>
      </section>

      <div>
        <div className="em-rule" style={{ width: 40, margin: '0 0 8px' }} />
        <h2 style={{ fontSize: 20 }}>Pick designs</h2>
        <p className="hint" style={{ marginTop: 4 }}>
          Includes photo, name, SKU, purity and net weight. No prices.
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
                  className={`em-pickcard${on ? ' on' : ''}`}
                  style={{ opacity: picked.size > 0 && !on ? 0.72 : 1 }}
                >
                  <Ph src={p.image} tone={i} style={{ aspectRatio: '1', width: '100%' }}>
                    <span aria-hidden="true" className="chk">
                      {on && <Icon n="check" size={15} />}
                    </span>
                  </Ph>
                  <span style={{ display: 'block', padding: 12 }}>
                    <span className="em-ser em-clip" style={{ display: 'block', fontSize: 14 }}>
                      {p.title}
                    </span>
                    <span className="em-row em-sb" style={{ marginTop: 6, fontSize: 10 }}>
                      <span className="em-mut">{p.sku}</span>
                      <b style={{ color: 'var(--em-primary)' }}>
                        {p.purity.split(' ')[0]} · {p.netWt.toFixed(3).slice(0, 5)} g
                      </b>
                    </span>
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
                  <Icon n="down" size={18} />
                  Export PDF{picked.size > 0 ? ` · ${picked.size}` : ''}
                </button>
                {canShare && (
                  <button type="button" data-testid="pdf-share" className="btn wa" style={{ flex: 'none', width: 'auto', padding: '0 14px' }} disabled={busy || picked.size === 0} onClick={() => run('share')}>
                    <Icon n="wa" size={18} />
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
