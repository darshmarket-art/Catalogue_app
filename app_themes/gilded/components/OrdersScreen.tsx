import React, { useEffect, useState } from 'react';
import { OrderItem, PastOrder } from '../types';
import { api } from '../api';
import { merchant } from '../merchant';
import { sector } from '../sector';
import { I, Notice, Photo, Segmented, StatusTag } from './ui';

interface OrdersScreenProps {
  orders: OrderItem[];
  onRemoveItem: (id: string) => void;
  /** Both take the buyer's optional note to the store. */
  onConfirmOrder: (note?: string) => Promise<{ poId: string; totalNetGrams: number; whatsappMessage: string } | null>;
  onGenerateWhatsAppPO: (note?: string) => void;
  onNavigateCatalogue: () => void;
  /** Which tab to open first (the profile menu links straight to past orders). */
  initialTab?: 'current' | 'past';
}

const when = (iso: string) => new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

/** Past orders as the canvas's order cards (artboard 2.7). */
const PastOrders: React.FC<{ orders: PastOrder[] | null; onCancel: (poId: string) => Promise<string | null> }> = ({ orders, onCancel }) => {
  const [open, setOpen] = useState<string | null>(null);
  // Cancelling takes two taps, so a stray tap cannot cancel an order.
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

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

  if (orders === null) return <p className="hint" style={{ textAlign: 'center', padding: '32px 0' }}>Loading your orders…</p>;
  if (orders.length === 0) {
    return (
      <div className="col" style={{ alignItems: 'center', textAlign: 'center', paddingTop: 32, gap: 8 }}>
        <span className="tag gold" style={{ width: 56, height: 56, borderRadius: 18, justifyContent: 'center', padding: 0 }}>
          <I n="clock" />
        </span>
        <h2 style={{ fontSize: 24 }}>No past orders yet</h2>
        <p className="sub">Orders you place will be listed here.</p>
      </div>
    );
  }
  return (
    <div className="col" style={{ gap: 12 }} data-testid="past-orders">
      {problem && <Notice tone="error">{problem}</Notice>}
      {orders.map((order) => {
        const isOpen = open === order.poId || order.status === 'new';
        return (
          <article key={order.poId} className="card col" style={{ gap: 8, opacity: order.status === 'cancelled' ? 0.7 : 1 }}>
            <div className="row">
              <b className="grow">Order {order.poId}</b>
              <StatusTag status={order.status} />
            </div>
            <p className="sub">
              {order.itemCount} {order.itemCount === 1 ? 'design' : 'designs'} · {order.totalNetGrams.toFixed(3)} g net · {when(order.timestamp)}
            </p>
            {order.note && (
              <p className="hint" data-testid="past-order-note">
                <b>Your note:</b> {order.note}
              </p>
            )}
            {isOpen && (
              <>
                <hr className="sep" />
                {order.items.map((item) => (
                  <div key={item.id} className="kv">
                    <span>
                      {item.title} × {item.batchQty}
                    </span>
                    <b>{item.totalNetGold.toFixed(3)} g</b>
                  </div>
                ))}
              </>
            )}
            <div className="row" style={{ marginTop: 2 }}>
              {order.status !== 'new' && (
                <button type="button" className="lnk grow" style={{ minHeight: 36, justifyContent: 'flex-start' }} onClick={() => setOpen(open === order.poId ? null : order.poId)} aria-expanded={isOpen}>
                  {isOpen ? 'Hide items' : 'View items'}
                </button>
              )}
              {order.status === 'new' && (
                <button type="button" disabled={busy === order.poId} onClick={() => cancel(order.poId)} className="btn sm alt danger" style={{ marginLeft: 'auto' }}>
                  {busy === order.poId ? 'Cancelling…' : confirming === order.poId ? 'Tap again to cancel' : 'Cancel order'}
                </button>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
};

export const OrdersScreen: React.FC<OrdersScreenProps> = ({ orders, onRemoveItem, onConfirmOrder, onGenerateWhatsAppPO, onNavigateCatalogue, initialTab = 'current' }) => {
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
      return err instanceof Error ? err.message : 'Could not cancel the order.';
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

  // Just booked: a calm confirmation
  if (confirmedPO && tab === 'current' && orders.length === 0) {
    return (
      <div className="scroll" style={{ gap: 14, paddingTop: 16 }}>
        <section className="hero col" style={{ gap: 10, padding: '24px 20px 28px' }}>
          <div style={{ width: 52, height: 52, borderRadius: 16, background: 'var(--gold-grad)', color: '#2a1a05', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <I n="check" />
          </div>
          <span className="eyebrow" style={{ marginTop: 6 }}>
            {confirmedPO}
          </span>
          <h1 style={{ fontSize: 34, lineHeight: 1.04 }}>{sector.copy.orders.bookedBanner}</h1>
          <p className="sub" style={{ maxWidth: 280 }}>
            {bookedGrams.toFixed(3)} g net. {merchant.orders.bookedNote ? `Your order is booked, ${merchant.orders.bookedNote}` : 'We will confirm on WhatsApp shortly.'}
          </p>
        </section>
        <a href={waLink} target="_blank" rel="noreferrer" className="btn wa">
          <I n="whats" />
          Send order on WhatsApp
        </a>
        <button
          type="button"
          className="btn alt"
          onClick={() => {
            setConfirmedPO(null);
            setIsBooked(false);
            setTab('past');
          }}
        >
          View past orders
        </button>
      </div>
    );
  }

  return (
    <div className="scroll" style={{ gap: 12, paddingBottom: tab === 'current' && orders.length > 0 ? 'calc(300px + var(--sab))' : undefined }}>
      <Segmented
        options={[
          { key: 'current', label: `Current order${orders.length ? ` ${orders.length}` : ''}` },
          { key: 'past', label: 'Past orders' }
        ]}
        value={tab}
        onChange={(key) => setTab(key as 'current' | 'past')}
      />

      {tab === 'past' ? (
        <PastOrders orders={history} onCancel={cancelOrder} />
      ) : orders.length === 0 ? (
        <div className="col" style={{ alignItems: 'center', textAlign: 'center', paddingTop: 32, gap: 8 }}>
          <span className="tag gold" style={{ width: 56, height: 56, borderRadius: 18, justifyContent: 'center', padding: 0 }}>
            <I n="receipt" />
          </span>
          <h2 style={{ fontSize: 24 }}>{sector.copy.orders.emptyTitle}</h2>
          <p className="sub" style={{ maxWidth: 300 }}>
            {sector.copy.orders.emptyText}
          </p>
          <button type="button" className="btn" style={{ maxWidth: 260, marginTop: 6 }} onClick={onNavigateCatalogue}>
            Browse designs
          </button>
        </div>
      ) : (
        <>
          {orders.map((item, i) => (
            <div key={item.id} className="card row" style={{ padding: 10 }}>
              <Photo src={item.image} tone={i} style={{ width: 76, height: 76, flex: 'none' }} />
              <div className="grow">
                <b>{item.title}</b>
                <p className="sub" style={{ fontSize: 13 }}>
                  {item.purity.split(' ')[0]} · {item.unitWt.toFixed(3)} g × {item.batchQty}
                </p>
                <b style={{ color: 'var(--plum)', fontSize: 14 }}>{item.totalNetGold.toFixed(3)} g</b>
              </div>
              <button type="button" className="ib" aria-label={`Remove ${item.title}`} onClick={() => onRemoveItem(item.id)} style={{ width: 40, height: 40 }}>
                <I n="x" size="s" />
              </button>
            </div>
          ))}
          <label className="col" style={{ gap: 6 }}>
            <span className="eyebrow">Note for {merchant.brand.name}</span>
            <textarea data-testid="order-note-input" className="inp" style={{ height: 84, padding: 12, resize: 'none' }} maxLength={300} placeholder="Delivery date, finish, size changes…" value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          <p className="hint" style={{ textAlign: 'center' }}>
            {merchant.orders.guaranteeLine ?? sector.copy.orders.guaranteeFallback}
          </p>

          <div className="dock">
            <div className="card col" style={{ gap: 10, padding: 14, boxShadow: 'var(--sh-2)' }}>
              <div className="row" style={{ alignItems: 'baseline' }}>
                <span className="stat grow" style={{ fontSize: 24 }}>
                  {totalNetGold.toFixed(3)} g net
                </span>
                <span className="sub" style={{ fontWeight: 700 }}>
                  {orders.length} {orders.length === 1 ? 'design' : 'designs'} · {totalPieces} pcs
                </span>
              </div>
              <button type="button" className="btn" onClick={handleConfirm} disabled={isBooked}>
                {isBooked ? sector.copy.orders.bookedCta : sector.copy.orders.confirmCta}
              </button>
              <button type="button" className="btn alt" onClick={() => onGenerateWhatsAppPO(note.trim() || undefined)}>
                <I n="whats" />
                {sector.copy.orders.whatsappCta.title}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
