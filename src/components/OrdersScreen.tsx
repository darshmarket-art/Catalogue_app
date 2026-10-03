import React, { useEffect, useState } from 'react';
import { OrderItem, PastOrder } from '../types';
import { api } from '../api';
import { merchant } from '../merchant';
import { sector } from '../sector';
import { PageTitle, Segmented, StatusTag, Notice, btnPrimary, btnOutline, btnWhatsApp } from './ui';

interface OrdersScreenProps {
  orders: OrderItem[];
  onRemoveItem: (id: string) => void;
  onConfirmOrder: () => Promise<{ poId: string; totalNetGrams: number; whatsappMessage: string } | null>;
  onGenerateWhatsAppPO: () => void;
  onNavigateCatalogue: () => void;
  /** Which tab to open first (the profile menu links straight to past orders). */
  initialTab?: 'current' | 'past';
}

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
  if (orders === null) return <p className="text-center font-sans text-sm text-outline py-10">Loading your orders…</p>;
  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center text-center gap-2 px-8 pt-14">
        <span className="material-symbols-outlined text-[44px] text-primary-fixed-dim">history</span>
        <h3 className="font-serif text-[24px] text-primary">No past orders yet</h3>
        <p className="font-sans text-[15px] text-on-surface-variant">Orders you place will be listed here.</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3 px-5" data-testid="past-orders">
      {problem && <Notice tone="error">{problem}</Notice>}
      {orders.map((order) => (
        <article key={order.poId} className="rounded-3xl bg-white border border-outline-variant p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="font-sans text-sm font-extrabold text-on-surface-variant truncate">{order.poId}</span>
            <StatusTag status={order.status} />
          </div>
          <h3 className="font-serif text-[22px] text-primary mt-2 leading-tight">
            {order.itemCount} {order.itemCount === 1 ? 'item' : 'items'}
          </h3>
          <p className="font-sans text-sm text-on-surface-variant">{new Date(order.timestamp).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</p>
          <div className="flex items-center justify-between mt-3">
            <span className="font-serif text-[26px] text-primary">{order.totalNetGrams.toFixed(3)} g</span>
            <button
              type="button"
              onClick={() => setOpen(open === order.poId ? null : order.poId)}
              aria-expanded={open === order.poId}
              className="min-h-11 px-4 rounded-xl border-[1.5px] border-outline-variant font-sans text-sm font-extrabold text-primary"
            >
              {open === order.poId ? 'Hide items' : 'View items'}
            </button>
          </div>
          {order.status === 'new' && (
            <button
              type="button"
              disabled={busy === order.poId}
              onClick={() => cancel(order.poId)}
              className={`mt-3 w-full min-h-12 rounded-2xl font-sans text-sm font-extrabold border-[1.5px] disabled:opacity-50 ${confirming === order.poId ? 'bg-error text-on-primary border-error' : 'bg-white text-error border-error/40'}`}
            >
              {busy === order.poId ? 'Cancelling…' : confirming === order.poId ? 'Tap again to cancel this order' : 'Cancel order'}
            </button>
          )}
          {open === order.poId && (
            <ul className="mt-3 pt-3 border-t border-outline-variant flex flex-col gap-3">
              {order.items.map((item) => (
                <li key={item.id} className="flex items-center gap-3">
                  <img src={item.image} alt="" className="w-12 h-12 rounded-xl object-cover bg-surface-container flex-shrink-0" referrerPolicy="no-referrer" />
                  <div className="min-w-0 flex-1">
                    <p className="font-sans text-[15px] font-bold text-on-surface truncate">{item.title}</p>
                    <p className="font-sans text-sm text-on-surface-variant">
                      {item.purity} · {item.batchQty} {item.qtyUnit} · {item.totalNetGold.toFixed(3)} g
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </article>
      ))}
    </div>
  );
};

export const OrdersScreen: React.FC<OrdersScreenProps> = ({
  orders,
  onRemoveItem,
  onConfirmOrder,
  onGenerateWhatsAppPO,
  onNavigateCatalogue,
  initialTab = 'current'
}) => {
  const [isBooked, setIsBooked] = useState(false);
  const [confirmedPO, setConfirmedPO] = useState<string | null>(null);
  const [bookedGrams, setBookedGrams] = useState(0);
  const [bookedMessage, setBookedMessage] = useState('');
  const [tab, setTab] = useState<'current' | 'past'>(initialTab);
  const [history, setHistory] = useState<PastOrder[] | null>(null);

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
    const result = await onConfirmOrder();
    if (!result) return;
    setIsBooked(true);
    setBookedGrams(result.totalNetGrams);
    setBookedMessage(result.whatsappMessage);
    setConfirmedPO(result.poId);
  };

  const waLink = `https://wa.me/${merchant.contact.whatsapp}?text=${encodeURIComponent(bookedMessage)}`;

  // Just booked: a calm confirmation instead of a banner
  if (confirmedPO && tab === 'current' && orders.length === 0) {
    return (
      <div className="flex flex-col items-center text-center w-full max-w-md mx-auto px-6 pt-16 pb-36 gap-2">
        <div className="w-20 h-20 rounded-full bg-success-container text-success flex items-center justify-center">
          <span className="material-symbols-outlined text-[40px]">check</span>
        </div>
        <h1 className="font-serif text-[30px] text-primary mt-3">{sector.copy.orders.bookedBanner}</h1>
        <p className="font-sans text-[15px] text-on-surface-variant">
          {confirmedPO}
          <br />
          {bookedGrams.toFixed(3)} g net
        </p>
        <p className="font-sans text-[15px] text-on-surface-variant max-w-[30ch]">{merchant.orders.bookedNote ? `Your order is booked, ${merchant.orders.bookedNote}` : 'We will confirm on WhatsApp shortly.'}</p>
        <a href={waLink} target="_blank" rel="noreferrer" className={`${btnWhatsApp} mt-4 max-w-xs`}>
          Send order on WhatsApp
        </a>
        <button
          type="button"
          onClick={() => {
            setConfirmedPO(null);
            setIsBooked(false);
            setTab('past');
          }}
          className="min-h-11 px-3 font-sans text-sm font-bold text-primary hover:underline"
        >
          View past orders
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full pb-72 max-w-2xl mx-auto">
      <PageTitle title="Orders" />
      <div className="px-5 mb-4">
        <Segmented
          options={[
            { key: 'current', label: 'Current order' },
            { key: 'past', label: 'Past orders' }
          ]}
          value={tab}
          onChange={(key) => setTab(key as 'current' | 'past')}
        />
      </div>

      {tab === 'past' ? (
        <PastOrders orders={history} onCancel={cancelOrder} />
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center text-center gap-2 px-8 pt-14">
          <span className="material-symbols-outlined text-[44px] text-primary-fixed-dim">shopping_bag</span>
          <h3 className="font-serif text-[24px] text-primary">{sector.copy.orders.emptyTitle}</h3>
          <p className="font-sans text-[15px] text-on-surface-variant max-w-xs">{sector.copy.orders.emptyText}</p>
          <button onClick={onNavigateCatalogue} className={`${btnPrimary} mt-3 max-w-xs`}>
            Browse designs
          </button>
        </div>
      ) : (
        <>
          <ul className="flex flex-col bg-white border-y border-outline-variant">
            {orders.map((item) => (
              <li key={item.id} className="grid grid-cols-[64px_1fr_44px] items-center gap-3 px-5 py-3 border-b border-surface-container last:border-b-0">
                <img src={item.image} alt="" className="w-16 h-16 rounded-2xl object-cover bg-surface-container" referrerPolicy="no-referrer" />
                <div className="min-w-0">
                  <p className="font-sans text-[15.5px] font-bold text-on-surface truncate">{item.title}</p>
                  <p className="font-sans text-sm text-on-surface-variant">
                    {item.purity} · {item.unitWt.toFixed(2)} g × {item.batchQty}
                  </p>
                  <p className="font-sans text-sm font-extrabold text-primary">{item.totalNetGold.toFixed(3)} g</p>
                </div>
                <button onClick={() => onRemoveItem(item.id)} aria-label={`Remove ${item.title}`} className="w-11 h-11 flex items-center justify-center text-outline hover:text-error" type="button">
                  <span className="material-symbols-outlined text-[22px]">close</span>
                </button>
              </li>
            ))}
          </ul>
          <p className="font-sans text-sm text-on-surface-variant text-center px-8 mt-4">{merchant.orders.guaranteeLine ?? sector.copy.orders.guaranteeFallback}</p>

          {/* Total and actions sit above the bottom navigation */}
          <div className="fixed inset-x-0 bottom-[calc(4rem+var(--sab))] z-40 px-3 pb-2">
            <div className="max-w-2xl mx-auto bg-white rounded-3xl border border-outline-variant shadow-[0_-6px_24px_rgba(0,0,0,0.1)] p-4 flex flex-col gap-2.5">
              <div className="flex items-baseline justify-between">
                <span className="font-serif text-[26px] text-primary">{totalNetGold.toFixed(3)} g net</span>
                <span className="font-sans text-sm font-bold text-on-surface-variant">
                  {orders.length} {orders.length === 1 ? 'design' : 'designs'} · {totalPieces} pcs
                </span>
              </div>
              <button onClick={handleConfirm} disabled={isBooked} className={btnPrimary} type="button">
                {isBooked ? sector.copy.orders.bookedCta : sector.copy.orders.confirmCta}
              </button>
              <button onClick={onGenerateWhatsAppPO} className={btnOutline} type="button">
                {sector.copy.orders.whatsappCta.title}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
