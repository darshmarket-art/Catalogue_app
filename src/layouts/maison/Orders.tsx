import React, { useEffect, useState } from 'react';
import type { OrderStatus, PastOrder } from '../../types';
import { api } from '../../api';
import { merchant } from '../../merchant';
import { sector } from '../../sector';
import { Icon, Ph, fmtG, type KitProps } from '../emergent/ui';
import { getLang, hn, pur, t, tErr, tl, tn, ts, useLang } from '../../i18n';
import { errorText } from '../../bugReport';
import { SIZES_THUMB } from '../../photoSrcSet';
import { Placed, PlacedBody } from './Placed';

const when = (iso: string) => new Date(iso).toLocaleString(getLang() === 'hi' ? 'hi-IN' : 'en-IN', { dateStyle: 'medium', timeStyle: 'short' });
const STATUS_FILTERS: Array<{ key: 'all' | OrderStatus; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'new', label: 'New' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'dispatched', label: 'Dispatched' },
  { key: 'cancelled', label: 'Cancelled' }
];
/** Orders with more designs than this collapse to a preview with a drop-down. */
const BIG_ORDER = 8;
const PREVIEW_ROWS = 3;

const PastOrders: React.FC<{ orders: PastOrder[] | null; onCancel: (poId: string) => Promise<string | null> }> = ({ orders, onCancel }) => {
  useLang();
  const [open, setOpen] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState<string | null>(null); // cancelling takes two taps
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [status, setStatus] = useState<'all' | OrderStatus>('all');
  const [again, setAgain] = useState<{ poId: string; state: 'busy' | 'done' | 'part' } | null>(null);

  // Order again: every line of a past order goes into the current order (designs no longer in the catalogue are skipped).
  const orderAgain = async (order: PastOrder) => {
    setAgain({ poId: order.poId, state: 'busy' });
    let missed = 0;
    for (const line of order.items) {
      try {
        await api.addOrderItem({ sku: line.sku, batchQty: line.batchQty, purity: line.purity });
      } catch {
        missed++;
      }
    }
    window.dispatchEvent(new Event('ax-orders-changed'));
    setAgain({ poId: order.poId, state: missed ? 'part' : 'done' });
  };

  const cancel = async (poId: string) => {
    if (confirming !== poId) {
      setConfirming(poId);
      setProblem(null);
      setTimeout(() => setConfirming((c) => (c === poId ? null : c)), 4000);
      return;
    }
    setBusy(poId);
    setConfirming(null);
    setProblem(await onCancel(poId));
    setBusy(null);
  };

  if (orders === null) return <p className="mx-note mx-center-note">{t('Loading your orders…')}</p>;
  if (orders.length === 0) {
    return (
      <div className="mx-empty">
        <p className="mx-lede">{t('No past orders yet')}</p>
        <p className="mx-note">{t('Orders you place will be listed here.')}</p>
      </div>
    );
  }
  const count = (key: 'all' | OrderStatus) => (key === 'all' ? orders.length : orders.filter((o) => o.status === key).length);
  const shown = orders.filter((o) => status === 'all' || o.status === status);

  return (
    <>
      <div className="mx-chips" role="group" aria-label={t('Order status')}>
        {STATUS_FILTERS.filter((f) => f.key === 'all' || count(f.key) > 0 || status === f.key).map((f) => (
          <button key={f.key} type="button" className={`mx-chip${status === f.key ? ' on' : ''}`} aria-pressed={status === f.key} onClick={() => setStatus(f.key)}>
            {t(f.label)} · {count(f.key)}
          </button>
        ))}
      </div>
      <div className="mx-past" data-testid="past-orders">
        {problem && <div role="alert" className="mx-alert">{problem}</div>}
        {shown.length === 0 && <p className="mx-note mx-center-note">{t('No orders in this state.')}</p>}
        {shown.map((order) => {
          const big = order.items.length > BIG_ORDER;
          const allShown = expanded.has(order.poId);
          const isOpen = big || open === order.poId || order.status === 'new';
          const rows = big && !allShown ? order.items.slice(0, PREVIEW_ROWS) : order.items;
          return (
            <article key={order.poId} className={`mx-po${order.status === 'cancelled' ? ' off' : ''}`}>
              <div className="mx-po-h">
                <div>
                  <span className="mx-ey">{when(order.timestamp)}</span>
                  <h2 className="mx-h2 sm">{t('Order {id}', { id: order.poId })}</h2>
                  <p className="mx-note">{tn(order.itemCount, '{n} design', '{n} designs')} · {t('{w} net', { w: fmtG(order.totalNetGrams) })}</p>
                </div>
                <span className={`mx-status s-${order.status}`}>{t(STATUS_FILTERS.find((f) => f.key === order.status)?.label ?? order.status)}</span>
              </div>
              {isOpen && (
                <div className="mx-po-b">
                  {rows.map((item) => (
                    <div key={item.id} className="mx-po-l">
                      <span>{hn(item.title, item.titleHi)} <em>× {item.batchQty}</em></span>
                      <span>{fmtG(item.totalNetGold)}</span>
                    </div>
                  ))}
                  {big && (
                    <button type="button" className="mx-cta" data-testid="past-order-toggle" aria-expanded={allShown} onClick={() => setExpanded((prev) => { const next = new Set(prev); if (next.has(order.poId)) next.delete(order.poId); else next.add(order.poId); return next; })}>
                      {allShown ? t('Show fewer') : t('Show all {n} designs', { n: order.items.length })}
                    </button>
                  )}
                  {order.note && <p className="mx-note" data-testid="past-order-note"><b>{t('Your note:')}</b> {order.note}</p>}
                </div>
              )}
              <div className="mx-po-f">
                {order.status !== 'new' ? (
                  big ? null : <button type="button" className="mx-cta" onClick={() => setOpen(open === order.poId ? null : order.poId)} aria-expanded={isOpen}>{t(isOpen ? 'Hide items' : 'View items')}</button>
                ) : (
                  <button type="button" className="mx-btn sec sm" disabled={busy === order.poId} onClick={() => cancel(order.poId)}>
                    {t(busy === order.poId ? 'Cancelling…' : confirming === order.poId ? 'Tap again to cancel' : 'Cancel order')}
                  </button>
                )}
                {order.status !== 'new' && (
                  <button type="button" className="mx-cta" data-testid="order-again" disabled={again?.poId === order.poId && again.state === 'busy'} onClick={() => void orderAgain(order)}>
                    {again?.poId === order.poId ? t(again.state === 'busy' ? 'Adding…' : again.state === 'done' ? 'Added to your order' : 'Added what is still available') : t('Order again')}
                  </button>
                )}
                <span className="mx-po-t"><span className="mx-ey">{t('Net total')}</span> {fmtG(order.totalNetGrams)}</span>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
};

type OrdersProps = Omit<KitProps<'Orders'>, 'onConfirmOrder' | 'onGenerateWhatsAppPO'> & {
  onConfirmOrder: (note?: string) => ReturnType<KitProps<'Orders'>['onConfirmOrder']>;
  onGenerateWhatsAppPO: (note?: string) => void;
};

/**
 * Maison's Orders: the bag. Lines on thin rules with a square photo, a quantity stepper and a remove link; the summary (totals, the note to the
 * store, Place order) sits beside the lines on desktop and is anchored at the bottom on phones. Past orders are listed on hairlines.
 */
export const Orders: React.FC<OrdersProps> = ({ orders, onRemoveItem, onChangeQty, onConfirmOrder, onGenerateWhatsAppPO, onNavigateCatalogue, initialTab = 'current' }) => {
  useLang();
  const [isBooked, setIsBooked] = useState(false);
  const [confirmedPO, setConfirmedPO] = useState<string | null>(null);
  const [bookedGrams, setBookedGrams] = useState(0);
  const [bookedMessage, setBookedMessage] = useState('');
  const [tab, setTab] = useState<'current' | 'past'>(initialTab);
  const [history, setHistory] = useState<PastOrder[] | null>(null);
  const [note, setNote] = useState('');
  const [moment, setMoment] = useState(false); // the order-placed moment while it plays
  const [bookedPhotos, setBookedPhotos] = useState<Array<string | undefined>>([]); // the designs just ordered (the bag is empty by then)

  useEffect(() => {
    if (tab === 'past') api.getOrderHistory().then(setHistory);
  }, [tab, confirmedPO]);

  const totalNetGold = orders.reduce((sum, item) => sum + (item.totalNetGold || 0), 0);
  const totalPieces = orders.reduce((sum, item) => sum + (item.batchQty || 1), 0);

  const cancelOrder = async (poId: string): Promise<string | null> => {
    try {
      await api.cancelOrder(poId);
      setHistory((list) => list?.map((o) => (o.poId === poId ? { ...o, status: 'cancelled' } : o)) ?? null);
      return null;
    } catch (err) {
      api.getOrderHistory().then(setHistory);
      return tErr(errorText(err, 'Orders', t('Could not cancel the order.')));
    }
  };

  const handleConfirm = async () => {
    const photos = orders.map((o) => o.image);
    const result = await onConfirmOrder(note.trim() || undefined);
    if (!result) return;
    setBookedPhotos(photos);
    setMoment(true);
    setNote('');
    setIsBooked(true);
    setBookedGrams(result.totalNetGrams);
    setBookedMessage(result.whatsappMessage);
    setConfirmedPO(result.poId);
  };

  const waLink = `https://wa.me/${merchant.contact.whatsapp}?text=${encodeURIComponent(bookedMessage)}`;

  if (confirmedPO && tab === 'current' && orders.length === 0) {
    const line = tl(merchant.orders.bookedNote) ? `${t('Your order is booked,')} ${tl(merchant.orders.bookedNote)}` : undefined;
    const actions = (
      <div className="mx-bag-act">
        <a href={waLink} target="_blank" rel="noreferrer" className="mx-btn lt">
          <Icon n="wa" size={16} />
          <span>{t('Send order on WhatsApp')}</span>
        </a>
        <button type="button" className="mx-btn lt sec" onClick={() => { setConfirmedPO(null); setIsBooked(false); setTab('past'); }}>{t('View past orders')}</button>
        <button type="button" className="mx-cta lt" data-testid="booked-continue" onClick={onNavigateCatalogue}>{t('Continue browsing')}</button>
      </div>
    );
    return (
      <div className={`mx-page mx-booked${moment ? ' playing' : ''}`} data-testid="order-booked">
        {moment && <Placed poId={confirmedPO} grams={bookedGrams} images={bookedPhotos} line={line} onDone={() => setMoment(false)}>{actions}</Placed>}
        <PlacedBody poId={confirmedPO} grams={bookedGrams} images={bookedPhotos} line={line} />
        {actions}
      </div>
    );
  }

  const hasLines = tab === 'current' && orders.length > 0;

  return (
    <div className={`mx-page mx-bag${hasLines ? ' has-lines' : ''}`}>
      <header className="mx-cat-head">
        <h1 className="mx-h2">{t('Orders')}</h1>
        <span className="mx-ey">{tab === 'past' && history ? `${t('Your activity')} · ${tn(history.length, '{n} order', '{n} orders')}` : t('Your activity')}</span>
      </header>
      <div className="mx-tabs" role="tablist" aria-label={t('Orders')}>
        {([{ key: 'current', label: t('To order'), n: orders.length }, { key: 'past', label: t('Past orders'), n: 0 }] as const).map((tb) => (
          <button key={tb.key} type="button" role="tab" data-testid={`orders-tab-${tb.key}`} aria-selected={tab === tb.key} className={tab === tb.key ? 'on' : ''} onClick={() => setTab(tb.key)}>
            {tb.label}{tb.n > 0 && <i> · {tb.n}</i>}
          </button>
        ))}
      </div>

      <div key={tab} className="mx-flip">
      {tab === 'past' ? (
        <PastOrders orders={history} onCancel={cancelOrder} />
      ) : orders.length === 0 ? (
        <div className="mx-empty">
          <p className="mx-lede">{t(sector.copy.orders.emptyTitle)}</p>
          <p className="mx-note">{t(sector.copy.orders.emptyText)}</p>
          <button type="button" className="mx-btn" onClick={onNavigateCatalogue}>{t('Browse designs')}</button>
        </div>
      ) : (
        <div className="mx-bag-grid">
          <section className="mx-lines" aria-label={t('Orders')}>
            <div className="mx-lines-h">
              <span className="mx-ey">{tn(orders.length, '{n} design', '{n} designs')} · {tn(totalPieces, '{n} piece', '{n} pieces')}</span>
              <button type="button" className="mx-cta" data-testid="cart-clear" onClick={() => orders.forEach((i) => onRemoveItem(i.id))}>{t('Clear')}</button>
            </div>
            {orders.map((item, i) => (
              <div key={item.id} className="mx-line">
                <span className="mx-line-ph"><Ph src={item.image} tone={i} className="mx-fill" sizes={SIZES_THUMB} /></span>
                <div className="mx-line-b">
                  <h2 className="mx-tt">{hn(item.title, item.titleHi)}</h2>
                  <p className="mx-note">{item.sku} · {pur(item.purity.split(' ')[0])} · {fmtG(item.unitWt)} × {item.batchQty}</p>
                  <div className="mx-line-r">
                    <b>{fmtG(item.totalNetGold)}</b>
                    <div className="mx-qty">
                      <button type="button" aria-label={t('Decrease {name}', { name: hn(item.title, item.titleHi) })} disabled={item.batchQty <= 1} onClick={() => onChangeQty(item.id, item.batchQty - 1)}><Icon n="minus" size={14} /></button>
                      <em>{item.batchQty}</em>
                      <button type="button" aria-label={t('Increase {name}', { name: hn(item.title, item.titleHi) })} onClick={() => onChangeQty(item.id, item.batchQty + 1)}><Icon n="plus" size={14} /></button>
                    </div>
                  </div>
                </div>
                <button type="button" className="mx-x" data-testid="order-line-remove" aria-label={t('Remove {name}', { name: hn(item.title, item.titleHi) })} onClick={() => onRemoveItem(item.id)}>
                  <Icon n="x" size={16} />
                </button>
              </div>
            ))}
            <div className="mx-note-box">
              <label htmlFor="mx-order-note" className="mx-ey">{t('Note for {name}', { name: ts(merchant.brand.name) })}</label>
              <textarea id="mx-order-note" data-testid="order-note-input" maxLength={300} rows={3} placeholder={t('Delivery date, finish, size changes…')} value={note} onChange={(e) => setNote(e.target.value)} />
              <p className="mx-note mx-guar"><Icon n="shield" size={14} />{tl(merchant.orders.guaranteeLine) || t(sector.copy.orders.guaranteeFallback)}</p>
            </div>
          </section>

          <aside className="mx-bagbar" aria-label={t('Your order')}>
            <h2 className="mx-h2 sm mx-bag-title">{t('Your order')}</h2>
            <dl className="mx-bag-sum">
              <div><dt className="mx-ey">{t('Designs')}</dt><dd>{orders.length}</dd></div>
              <div><dt className="mx-ey">{t('Pieces')}</dt><dd>{totalPieces}</dd></div>
              <div><dt className="mx-ey">{t('Net total')}</dt><dd>{t('{w} net', { w: fmtG(totalNetGold) })}</dd></div>
            </dl>
            <div className="mx-bag-act">
              <button type="button" className="mx-btn" data-testid="place-order" onClick={handleConfirm} disabled={isBooked}>
                {t(isBooked ? sector.copy.orders.bookedCta : sector.copy.orders.confirmCta)}
              </button>
              <button type="button" className="mx-cta" data-testid="order-via-whatsapp" onClick={() => onGenerateWhatsAppPO(note.trim() || undefined)}>
                {t(sector.copy.orders.whatsappCta.title)}
              </button>
            </div>
            <p className="mx-note mx-bag-conf">{t('We will confirm on WhatsApp shortly.')}</p>
          </aside>
        </div>
      )}
      </div>
    </div>
  );
};
