import React, { useEffect, useState } from 'react';
import type { OrderStatus, PastOrder } from '../../types';
import { api } from '../../api';
import { merchant } from '../../merchant';
import { sector } from '../../sector';
import { Icon, OrderStatusPill, Ph, Pill, Title, fmtG, type KitProps } from './ui';
import { getLang, hn, pur, t, tErr, tl, tn, ts, useLang } from '../../i18n';

const when = (iso: string) => new Date(iso).toLocaleString(getLang() === 'hi' ? 'hi-IN' : 'en-IN', { dateStyle: 'medium', timeStyle: 'short' });

const STATUS_FILTERS: Array<{ key: 'all' | OrderStatus; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'new', label: 'New' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'dispatched', label: 'Dispatched' },
  { key: 'cancelled', label: 'Cancelled' }
];

/** Past orders as the atlas's order cards, with status chips that show how many orders are in each state. */
/** Orders with more designs than this collapse to a preview with a drop-down. */
const BIG_ORDER = 8;
const PREVIEW_ROWS = 3;

const PastOrders: React.FC<{ orders: PastOrder[] | null; onCancel: (poId: string) => Promise<string | null> }> = ({ orders, onCancel }) => {
  useLang();
  const [open, setOpen] = useState<string | null>(null);
  // Big orders whose full item list is showing.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  // Cancelling takes two taps, so a stray tap cannot cancel an order.
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [status, setStatus] = useState<'all' | OrderStatus>('all');

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

  if (orders === null) return <p className="em-hint" style={{ textAlign: 'center', padding: '32px 0' }}>{t('Loading your orders…')}</p>;
  if (orders.length === 0) {
    return (
      <div className="em-empty" style={{ paddingTop: 32 }}>
        <span className="em-badge">
          <Icon n="clock" size={24} />
        </span>
        <h2 className="em-ser" style={{ fontSize: 24 }}>
          {t('No past orders yet')}
        </h2>
        <p className="em-mut" style={{ margin: 0, fontSize: 14 }}>{t('Orders you place will be listed here.')}</p>
      </div>
    );
  }

  const count = (key: 'all' | OrderStatus) => (key === 'all' ? orders.length : orders.filter((o) => o.status === key).length);
  const shown = orders.filter((o) => status === 'all' || o.status === status);

  return (
    <>
      <div className="em-chips" role="group" aria-label={t('Order status')}>
        {STATUS_FILTERS.filter((f) => f.key === 'all' || count(f.key) > 0 || status === f.key).map((f) => (
          <button key={f.key} type="button" className={`em-chip${status === f.key ? ' on' : ''}`} aria-pressed={status === f.key} onClick={() => setStatus(f.key)}>
            {t(f.label)}
            <i>{count(f.key)}</i>
          </button>
        ))}
      </div>
      <div className="em-pad" style={{ display: 'flex', flexDirection: 'column', gap: 14 }} data-testid="past-orders">
        {problem && (
          <div role="alert" className="em-card" style={{ color: 'var(--em-bad)', borderColor: 'var(--em-bad)', fontSize: 14 }}>
            {problem}
          </div>
        )}
        {shown.length === 0 && <p className="em-hint" style={{ textAlign: 'center', padding: '24px 0' }}>{t('No orders in this state.')}</p>}
        {shown.map((order) => {
          // A big order (many designs) shows a short preview and a drop-down for the rest; small ones keep View items / Hide items.
          const big = order.items.length > BIG_ORDER;
          const allShown = expanded.has(order.poId);
          const isOpen = big || open === order.poId || order.status === 'new';
          const rows = big && !allShown ? order.items.slice(0, PREVIEW_ROWS) : order.items;
          return (
            <article key={order.poId} className="em-ord" style={{ opacity: order.status === 'cancelled' ? 0.75 : 1 }}>
              <div className="in">
                <div className="em-row em-sb" style={{ alignItems: 'flex-start', gap: 10 }}>
                  <div className="em-grow">
                    <div className="em-ey">{when(order.timestamp)}</div>
                    <div className="em-ser" style={{ fontSize: 19, marginTop: 2 }}>
                      {t('Order {id}', { id: order.poId })}
                    </div>
                    <div className="em-mut" style={{ fontSize: 12, marginTop: 4 }}>
                      {tn(order.itemCount, '{n} design', '{n} designs')} · {t('{w} net', { w: fmtG(order.totalNetGrams) })}
                    </div>
                  </div>
                  <OrderStatusPill status={order.status} />
                </div>
                {isOpen && (
                  <>
                    <hr className="em-line" />
                    {rows.map((item) => (
                      <div key={item.id} className="li">
                        <span>
                          {hn(item.title, item.titleHi)} <span className="em-mut">× {item.batchQty}</span>
                        </span>
                        <span className="em-mut">{fmtG(item.totalNetGold)}</span>
                      </div>
                    ))}
                    {big && (
                      <button
                        type="button"
                        className="em-link"
                        data-testid="past-order-toggle"
                        style={{ marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                        aria-expanded={allShown}
                        onClick={() => setExpanded((prev) => { const next = new Set(prev); if (next.has(order.poId)) next.delete(order.poId); else next.add(order.poId); return next; })}
                      >
                        {allShown ? t('Show fewer') : t('Show all {n} designs', { n: order.items.length })}
                        <span aria-hidden="true" style={{ display: 'inline-block', transition: 'transform 0.2s', transform: allShown ? 'rotate(180deg)' : 'none' }}>▾</span>
                      </button>
                    )}
                    {order.note && (
                      <p className="em-hint" data-testid="past-order-note" style={{ margin: '8px 0 0' }}>
                        <b style={{ fontWeight: 600 }}>{t('Your note:')}</b> {order.note}
                      </p>
                    )}
                  </>
                )}
                <div className="em-row" style={{ marginTop: 10 }}>
                  {order.status !== 'new' ? (
                    big ? null :
                    <button type="button" className="em-link" onClick={() => setOpen(open === order.poId ? null : order.poId)} aria-expanded={isOpen}>
                      {t(isOpen ? 'Hide items' : 'View items')}
                    </button>
                  ) : (
                    <button type="button" disabled={busy === order.poId} onClick={() => cancel(order.poId)} className="em-btn danger sm" style={{ marginLeft: 'auto' }}>
                      {t(busy === order.poId ? 'Cancelling…' : confirming === order.poId ? 'Tap again to cancel' : 'Cancel order')}
                    </button>
                  )}
                </div>
              </div>
              <div className="ft">
                <span className="em-ey" style={{ color: 'var(--em-deep)' }}>
                  {t('Net total')}
                </span>
                <span className="em-ser" style={{ fontSize: 18, color: 'var(--em-primary)' }}>
                  {fmtG(order.totalNetGrams)}
                </span>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
};

type OrdersProps = Omit<KitProps<'Orders'>, 'onConfirmOrder' | 'onGenerateWhatsAppPO'> & {
  /** Both take the buyer's optional note to the store (App.tsx passes it on to the server and the WhatsApp text). */
  onConfirmOrder: (note?: string) => ReturnType<KitProps<'Orders'>['onConfirmOrder']>;
  onGenerateWhatsAppPO: (note?: string) => void;
};

/** Orders (atlas Orders, with the cart's review bar for the order in progress): the current order, and past orders with their status. */
export const Orders: React.FC<OrdersProps> = ({ orders, onRemoveItem, onChangeQty, onConfirmOrder, onGenerateWhatsAppPO, onNavigateCatalogue, initialTab = 'current' }) => {
  useLang();
  const [isBooked, setIsBooked] = useState(false);
  const [confirmedPO, setConfirmedPO] = useState<string | null>(null);
  const [bookedGrams, setBookedGrams] = useState(0);
  const [bookedMessage, setBookedMessage] = useState('');
  const [tab, setTab] = useState<'current' | 'past'>(initialTab);
  const [history, setHistory] = useState<PastOrder[] | null>(null);
  const [note, setNote] = useState('');

  // Past orders are fetched when the tab is opened, and again after a new order is booked.
  useEffect(() => {
    if (tab === 'past') api.getOrderHistory().then(setHistory);
  }, [tab, confirmedPO]);

  const totalNetGold = orders.reduce((sum, item) => sum + (item.totalNetGold || 0), 0);
  const totalPieces = orders.reduce((sum, item) => sum + (item.batchQty || 1), 0);

  /** Cancels one of the buyer's own new orders; returns a message to show if the server refused. */
  const cancelOrder = async (poId: string): Promise<string | null> => {
    try {
      await api.cancelOrder(poId);
      setHistory((list) => list?.map((o) => (o.poId === poId ? { ...o, status: 'cancelled' } : o)) ?? null);
      return null;
    } catch (err) {
      api.getOrderHistory().then(setHistory);
      return err instanceof Error ? tErr(err.message) : t('Could not cancel the order.');
    }
  };

  const handleConfirm = async () => {
    const result = await onConfirmOrder(note.trim() || undefined);
    if (!result) return;
    setNote('');
    setIsBooked(true);
    setBookedGrams(result.totalNetGrams);
    setBookedMessage(result.whatsappMessage);
    setConfirmedPO(result.poId);
  };

  const waLink = `https://wa.me/${merchant.contact.whatsapp}?text=${encodeURIComponent(bookedMessage)}`;

  // Just booked: a calm confirmation (atlas "Order sent")
  if (confirmedPO && tab === 'current' && orders.length === 0) {
    return (
      <div className="em-page notabs">
        <div className="em-center">
          <span className="em-ok">
            <Icon n="check" size={32} />
          </span>
          <div className="em-ey" style={{ marginTop: 12 }}>
            {confirmedPO}
          </div>
          <h1 className="em-ser" style={{ fontSize: 30, lineHeight: 1.2 }}>
            {t(sector.copy.orders.bookedBanner)}
          </h1>
          <p className="em-mut" style={{ fontSize: 13, lineHeight: 1.55, margin: '0 0 20px', maxWidth: 320 }}>
            {t('{w} net.', { w: fmtG(bookedGrams) })} {tl(merchant.orders.bookedNote) ? `${t('Your order is booked,')} ${tl(merchant.orders.bookedNote)}` : t('We will confirm on WhatsApp shortly.')}
          </p>
          <a href={waLink} target="_blank" rel="noreferrer" className="em-btn wa">
            <Icon n="wa" />
            {t('Send order on WhatsApp')}
          </a>
          <button
            type="button"
            className="em-btn sec"
            onClick={() => {
              setConfirmedPO(null);
              setIsBooked(false);
              setTab('past');
            }}
          >
            {t('View past orders')}
          </button>
        </div>
      </div>
    );
  }

  const hasLines = tab === 'current' && orders.length > 0;

  return (
    <div className={`em-page${hasLines ? ' dock2' : ''}`}>
      <div className="em-pad">
        <Title
          eyebrow={tab === 'past' && history ? `${t('Your activity')} · ${tn(history.length, '{n} order', '{n} orders')}` : t('Your activity')}
          title={t('Orders')}
          right={
            <span style={{ marginBottom: 8 }}>
              <Pill tone="gold">{t('Pro')}</Pill>
            </span>
          }
        />
      </div>
      <div className="em-chips" role="tablist" aria-label={t('Orders')}>
        {(
          [
            { key: 'current', label: t('To order'), n: orders.length },
            { key: 'past', label: t('Past orders'), n: 0 }
          ] as const
        ).map((tb) => (
          <button key={tb.key} type="button" role="tab" data-testid={`orders-tab-${tb.key}`} aria-selected={tab === tb.key} className={`em-chip${tab === tb.key ? ' on' : ''}`} onClick={() => setTab(tb.key)}>
            {tb.label}
            {tb.n > 0 && <i>{tb.n}</i>}
          </button>
        ))}
      </div>

      {tab === 'past' ? (
        <PastOrders orders={history} onCancel={cancelOrder} />
      ) : orders.length === 0 ? (
        <div className="em-empty" style={{ paddingTop: 32 }}>
          <span className="em-badge">
            <Icon n="bag" size={24} />
          </span>
          <h2 className="em-ser" style={{ fontSize: 24 }}>
            {t(sector.copy.orders.emptyTitle)}
          </h2>
          <p className="em-mut" style={{ maxWidth: 300, fontSize: 14, lineHeight: 1.5, margin: 0 }}>
            {t(sector.copy.orders.emptyText)}
          </p>
          <button type="button" className="em-btn" onClick={onNavigateCatalogue}>
            {t('Browse designs')}
          </button>
        </div>
      ) : (
        <>
          <div className="em-pad">
            <div className="em-row em-sb" style={{ marginBottom: 2 }}>
              <span className="em-mut" style={{ fontSize: 13 }}>
                {tn(orders.length, '{n} design', '{n} designs')} · {tn(totalPieces, '{n} piece', '{n} pieces')}
              </span>
              <button type="button" className="em-link" data-testid="cart-clear" onClick={() => orders.forEach((i) => onRemoveItem(i.id))}>
                {t('Clear')}
              </button>
            </div>

            <div style={{ marginTop: 8 }}>
              {orders.map((item, i) => (
                <div key={item.id} className="em-li">
                  <Ph src={item.image} tone={i} className="em-thumb" style={{ width: 76, height: 76 }} />
                  <div className="em-grow">
                    <div className="em-ser" style={{ fontSize: 16 }}>
                      {hn(item.title, item.titleHi)}
                    </div>
                    <div className="em-mut" style={{ fontSize: 11, marginTop: 2 }}>
                      {item.sku} · {pur(item.purity.split(' ')[0])} · {fmtG(item.unitWt)} × {item.batchQty}
                    </div>
                    <div className="em-row em-sb" style={{ marginTop: 6 }}>
                      <span className="em-ser" style={{ color: 'var(--em-primary)', fontSize: 15 }}>
                        {fmtG(item.totalNetGold)}
                      </span>
                      <div className="em-qty sm">
                        <button type="button" aria-label={t('Decrease {name}', { name: hn(item.title, item.titleHi) })} disabled={item.batchQty <= 1} onClick={() => onChangeQty(item.id, item.batchQty - 1)}>
                          <Icon n="minus" size={16} />
                        </button>
                        <em>{item.batchQty}</em>
                        <button type="button" aria-label={t('Increase {name}', { name: hn(item.title, item.titleHi) })} onClick={() => onChangeQty(item.id, item.batchQty + 1)}>
                          <Icon n="plus" size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                  <button type="button" className="em-circ" data-testid="order-line-remove" aria-label={t('Remove {name}', { name: hn(item.title, item.titleHi) })} onClick={() => onRemoveItem(item.id)}>
                    <Icon n="x" size={16} />
                  </button>
                </div>
              ))}
            </div>
            <div className="em-rule" style={{ width: 40, marginTop: 18 }} />
            <label htmlFor="em-order-note" className="em-ey" style={{ display: 'block' }}>
              {t('Note for {name}', { name: ts(merchant.brand.name) })}
            </label>
            <textarea id="em-order-note" data-testid="order-note-input" className="em-note" maxLength={300} placeholder={t('Delivery date, finish, size changes…')} value={note} onChange={(e) => setNote(e.target.value)} />
            <div className="em-row" style={{ gap: 8, marginTop: 14, alignItems: 'flex-start' }}>
              <span style={{ color: 'var(--em-gold-ink)' }}>
                <Icon n="shield" size={14} />
              </span>
              <span className="em-hint">{tl(merchant.orders.guaranteeLine) || t(sector.copy.orders.guaranteeFallback)}</span>
            </div>
          </div>

          <div className="em-dock">
            <div className="em-dock-in col">
              <div className="em-row em-sb" style={{ alignItems: 'flex-end' }}>
                <div>
                  <div className="em-ey">
                    {tn(orders.length, '{n} design', '{n} designs')} · {t('{n} pcs', { n: totalPieces })}
                  </div>
                  <div className="em-ser tot" style={{ fontSize: 28 }}>
                    {t('{w} net', { w: fmtG(totalNetGold) })}
                  </div>
                </div>
              </div>
              <button type="button" className="em-btn" data-testid="place-order" onClick={handleConfirm} disabled={isBooked}>
                {t(isBooked ? sector.copy.orders.bookedCta : sector.copy.orders.confirmCta)}
              </button>
              <button type="button" className="em-link" style={{ alignSelf: 'center', minHeight: 30 }} data-testid="order-via-whatsapp" onClick={() => onGenerateWhatsAppPO(note.trim() || undefined)}>
                {t(sector.copy.orders.whatsappCta.title)}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
