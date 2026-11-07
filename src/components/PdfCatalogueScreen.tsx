import React, { useEffect, useRef, useState } from 'react';
import type { Category, Product } from '../types';
import { merchant } from '../merchant';
import { downloadDesignsPdf } from '../cataloguePdf';
import { api } from '../api';
import { Chip, Field, Notice, Segmented, Switch } from './ui';
import { DEFAULT_PDF_OPTIONS, MAX_PDF_DESIGNS, caption, paletteFor, loadPdfOptions, priceOf, savePdfOptions, type PdfOptions, type PdfTheme } from '../pdfLayout';
import { Icon, Ph, Toast } from '../layouts/emergent/ui';
import { errorText } from '../bugReport';
import { SIZES_GRID } from '../photoSrcSet';

/**
 * PDF catalogue (admin): pick designs from every collection, then download or share one PDF.
 * A screen of its own, so it works the same in every layout (the buyer Catalogue screen is layout-specific).
 */
const PAGE = 120;

const THEME_LABELS: Record<PdfTheme, string> = { store: 'Store theme', ivory: 'Ivory / ink', midnight: 'Midnight', garnet: 'Garnet' };

/** The first design page as it will print: the same grid (2 x 3, or 3 x 2 on landscape), theme and caption lines, at thumbnail size. */
const PagePreview: React.FC<{ items: Product[]; o: PdfOptions }> = ({ items, o }) => {
  const P = paletteFor(o.theme);
  const cols = o.land ? 3 : 2;
  const rows = o.land ? 2 : 3;
  return (
    <div data-testid="pdf-page-preview" aria-label="Preview of the first design page" role="img" style={{ boxSizing: 'border-box', width: o.land ? 220 : 150, height: o.land ? 155 : 212, background: P.g, color: P.i, border: `1px solid ${P.h}`, padding: o.land ? '14px 13px 12px' : '19px 9px 17px', display: 'grid', alignContent: 'stretch', justifyContent: 'stretch', gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`, gap: 4, flex: 'none', fontSize: 3.5, lineHeight: 1.15, overflow: 'hidden' }}>
      {Array.from({ length: cols * rows }, (_, i) => {
        const p = items[i];
        const c = p ? caption(p, o, merchant.productFields) : null;
        return (
          <div key={i} style={{ border: `1px solid ${P.h}`, padding: 2, display: 'flex', flexDirection: 'column', gap: 1, minHeight: 0 }}>
            <div style={{ flex: 1, minHeight: 0, background: P.tile, overflow: 'hidden' }}>
              {p?.image && <img src={p.image} alt="" onError={(e) => (e.currentTarget.style.display = 'none')} style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />}
            </div>
            {c && (
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: 'Georgia, serif', fontSize: 5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
                <div style={{ color: P.m, letterSpacing: '0.1em', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.meta.join(' · ')}</div>
                {c.price && <div>{c.price}</div>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export const PdfCatalogueScreen: React.FC<{ products: Product[]; categories: Category[] }> = ({ products: firstPage, categories }) => {
  // The picked designs themselves, not just ids: a pick made in one collection stays when another collection is opened.
  const [picked, setPicked] = useState<Map<string, Product>>(new Map());
  const [collection, setCollection] = useState<string | null>(null);
  // The app only holds the newest designs, so the grid asks the server for the open collection, a page at a time.
  const [visible, setVisible] = useState<Product[]>(firstPage);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const request = useRef(0);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [opts, setOpts] = useState<PdfOptions>(() => loadPdfOptions(merchant.id));
  const cancel = useRef<AbortController | null>(null);
  const setOpt = <K extends keyof PdfOptions>(k: K, v: PdfOptions[K]) =>
    setOpts((prev) => {
      const next = { ...prev, [k]: v };
      savePdfOptions(merchant.id, next);
      return next;
    });

  const load = async (offset: number) => {
    const mine = ++request.current;
    setLoading(true);
    try {
      const page = await api.queryProducts({ ...(collection ? { category: collection } : {}), limit: PAGE, offset });
      if (mine !== request.current) return; // another collection was opened meanwhile
      setVisible((prev) => (offset === 0 ? page.items : [...prev, ...page.items]));
      setHasMore(page.hasMore);
    } catch (err) {
      if (mine === request.current) setError(errorText(err, 'admin PDF catalogue', 'Could not load the designs.'));
    } finally {
      if (mine === request.current) setLoading(false);
    }
  };
  useEffect(() => {
    void load(0);
  }, [collection]);

  const chips = categories.filter((c) => c.designCount > 0).map((c) => c.name);
  const chosen = [...picked.values()];
  const collections = new Set(chosen.map((p) => p.category)).size;
  const netTotal = chosen.reduce((sum, p) => sum + p.netWt, 0);
  // One collection picked: its name is the title and file name; a mix is called a selection.
  const title = collections === 1 ? chosen[0].category : 'Selection';
  const allVisiblePicked = visible.length > 0 && visible.every((p) => picked.has(p.id));
  const none = !loading && visible.length === 0;
  // The price switch only exists for a store whose designs carry prices.
  const hasPrices = chosen.some((p) => priceOf(p) !== null);
  const previewOpts = { ...opts, price: opts.price && hasPrices };

  const toggle = (p: Product) =>
    setPicked((prev) => {
      const next = new Map(prev);
      if (next.has(p.id)) next.delete(p.id);
      else next.set(p.id, p);
      return next;
    });

  const toggleVisible = () =>
    setPicked((prev) => {
      const next = new Map(prev);
      for (const p of visible) {
        if (allVisiblePicked) next.delete(p.id);
        else next.set(p.id, p);
      }
      return next;
    });

  const run = async () => {
    setBusy(true);
    setError(null);
    setStatus('Preparing the PDF…');
    const ctl = (cancel.current = new AbortController());
    try {
      await downloadDesignsPdf(title, chosen, (done, total) => setStatus(`Preparing the PDF… ${done} of ${total} photos`), { options: previewOpts, signal: ctl.signal });
      setStatus('PDF downloaded');
      setTimeout(() => setStatus(null), 3000);
    } catch (err) {
      if ((err as { name?: string })?.name === 'AbortError') {
        setStatus('Cancelled');
        setTimeout(() => setStatus(null), 2000);
      } else {
        setStatus(null);
        setError(errorText(err, 'admin PDF catalogue', 'Could not create the PDF.'));
      }
    }
    cancel.current = null;
    setBusy(false);
  };

  return (
    <div className="scroll no-tabs" style={{ gap: 12, paddingBottom: 'calc(150px + max(var(--sab), 48px))' }}>
      {status && (
        <Toast>{status}</Toast>
      )}

      <section className="em-cover" data-testid="pdf-preview">
        <div className="em-row em-sb" style={{ alignItems: 'flex-start', gap: 12 }}>
          <div className="em-grow">
            <div className="em-ey">Cover page</div>
            <div className="em-ser" style={{ fontSize: '1.5rem', lineHeight: 1.25, marginTop: 6 }}>
              {merchant.brand.name}
            </div>
            {merchant.brand.tagline && <div style={{ fontSize: '0.75rem', opacity: 0.72, marginTop: 2 }}>{merchant.brand.tagline}</div>}
          </div>
          <span className="em-badge" style={{ width: 42, height: 42, borderRadius: '50%', border: '1px solid var(--em-gold)', background: 'color-mix(in srgb, var(--em-gold) 14%, transparent)', color: 'var(--em-gold-hi)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
            <Icon n="file" size={18} />
          </span>
        </div>
        <div style={{ height: 1, width: 48, background: 'var(--em-gold)', margin: '14px 0' }} />
        <div className="em-row" style={{ gap: 18 }}>
          <div className="m">
            <div className="em-ey" style={{ fontSize: '0.75rem' }}>{chosen.length === 1 ? 'Design' : 'Designs'}</div>
            <span data-testid="pdf-count">{chosen.length}</span>
          </div>
          <div className="m">
            <div className="em-ey" style={{ fontSize: '0.75rem' }}>Net weight</div>
            <span>{netTotal.toFixed(2)} g</span>
          </div>
          <div className="m">
            <div className="em-ey" style={{ fontSize: '0.75rem' }}>WhatsApp</div>
            <span>{merchant.contact.whatsapp ? `+${merchant.contact.whatsapp}` : '-'}</span>
          </div>
        </div>
      </section>

      <div>
        <div className="em-rule" style={{ width: 40, margin: '0 0 8px' }} />
        <h2 style={{ fontSize: '1.25rem' }}>Pick designs</h2>
        <p className="hint" style={{ marginTop: 4 }}>
          Includes photo, name and purity, and SKU, weights and price as you choose below.
        </p>
      </div>

      <section className="card col" data-testid="pdf-options" style={{ gap: 14, padding: 16 }}>
        <div className="row" style={{ alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          <div className="col grow" style={{ gap: 14, minWidth: 220 }}>
            <Field label="Page" htmlFor="pdf-orient">
              <Segmented options={[{ key: 'p', label: 'A4 portrait' }, { key: 'l', label: 'A4 landscape' }]} value={opts.land ? 'l' : 'p'} onChange={(k) => setOpt('land', k === 'l')} />
            </Field>
            <Field label="Colour theme" htmlFor="pdf-theme">
              <Segmented options={(Object.keys(THEME_LABELS) as PdfTheme[]).map((k) => ({ key: k, label: THEME_LABELS[k] }))} value={opts.theme} onChange={(k) => setOpt('theme', k as PdfTheme)} />
            </Field>
            {([['weights', 'Weights'], ['sku', 'SKU'], ['watermark', 'Watermark on photos'], ...(hasPrices ? [['price', 'Price']] : [])] as Array<['weights' | 'sku' | 'watermark' | 'price', string]>).map(([k, label]) => (
              <div key={k} className="row" data-testid={`pdf-opt-${k}`}>
                <span className="grow">{label}</span>
                <Switch on={opts[k]} onChange={() => setOpt(k, !opts[k])} label={label} />
              </div>
            ))}
            <Field label="Cover title" htmlFor="pdf-title">
              <input id="pdf-title" data-testid="pdf-title" className="inp" maxLength={60} value={opts.title} placeholder={title} onChange={(e) => setOpt('title', e.target.value)} />
            </Field>
            <Field label="Cover subtitle" htmlFor="pdf-sub">
              <input id="pdf-sub" data-testid="pdf-subtitle" className="inp" maxLength={70} value={opts.subtitle} placeholder="Autumn / Winter 2026" onChange={(e) => setOpt('subtitle', e.target.value)} />
            </Field>
          </div>
          <PagePreview items={chosen.length ? chosen : visible} o={previewOpts} />
        </div>
        {picked.size > MAX_PDF_DESIGNS && <Notice tone="warn">A PDF holds up to {MAX_PDF_DESIGNS} designs. Pick fewer, or make one PDF per collection.</Notice>}
      </section>

      {error && <Notice tone="error">{error}</Notice>}

      {categories.length === 0 || (none && !collection) ? (
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
          {collection && (
            <p className="hint" style={{ margin: 0 }}>
              Your picks stay when you open another collection. Open one, tap designs, then open the next.
            </p>
          )}

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
                  onClick={() => toggle(p)}
                  className={`em-pickcard${on ? ' on' : ''}`}
                  style={{ opacity: picked.size > 0 && !on ? 0.72 : 1 }}
                >
                  <Ph src={p.image} tone={i} sizes={SIZES_GRID} style={{ aspectRatio: '1', width: '100%' }}>
                    <span aria-hidden="true" className="chk">
                      {on && <Icon n="check" size={15} />}
                    </span>
                  </Ph>
                  <span style={{ display: 'block', padding: 12 }}>
                    <span className="em-ser em-clip" style={{ display: 'block', fontSize: '0.875rem' }}>
                      {p.title}
                    </span>
                    <span className="em-row em-sb" style={{ marginTop: 6, fontSize: '0.75rem' }}>
                      <span className="em-mut">{p.sku}</span>
                      <b style={{ color: 'var(--em-accent)' }}>
                        {p.purity.split(' ')[0]} · {p.netWt.toFixed(3).slice(0, 5)} g
                      </b>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          {hasMore && (
            <button type="button" className="btn alt" data-testid="pdf-more" disabled={loading} onClick={() => load(visible.length)} style={{ alignSelf: 'center' }}>
              {loading ? 'Loading…' : 'Show more designs'}
            </button>
          )}
          {loading && visible.length === 0 && <p className="hint" style={{ textAlign: 'center' }}>Loading designs…</p>}

          <div className="dock low">
            <div className="card col" style={{ gap: 10, padding: '12px 16px', boxShadow: 'var(--sh-2)' }}>
              <div className="row">
                <b className="grow" data-testid="pdf-selected">
                  {picked.size} selected
                </b>
                <button type="button" className="lnk" style={{ minHeight: 30, fontSize: '0.8438rem' }} onClick={toggleVisible} disabled={visible.length === 0}>
                  {allVisiblePicked ? 'Clear' : `Select these ${visible.length}`}
                </button>
                {picked.size > 0 && (
                  <button type="button" className="lnk" style={{ minHeight: 30, fontSize: '0.8438rem' }} onClick={() => setPicked(new Map())}>
                    None
                  </button>
                )}
              </div>
              <div className="row" style={{ gap: 10 }}>
                <button type="button" data-testid="pdf-export" className="btn" style={{ flex: 1, whiteSpace: 'nowrap', padding: '0 12px' }} disabled={busy || picked.size === 0 || picked.size > MAX_PDF_DESIGNS} onClick={() => run()}>
                  <Icon n="down" size={18} />
                  Export PDF{picked.size > 0 ? ` · ${picked.size}` : ''}
                </button>
                {busy && (
                  <button type="button" data-testid="pdf-cancel" className="btn alt" style={{ padding: '0 16px' }} onClick={() => cancel.current?.abort()}>
                    Cancel
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
