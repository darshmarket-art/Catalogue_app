import React, { useEffect, useState } from 'react';
import { OrderItem, PastOrder } from '../types';
import { api } from '../api';
import { merchant } from '../merchant';
import { sector } from '../sector';

interface OrdersScreenProps {
  orders: OrderItem[];
  onRemoveItem: (id: string) => void;
  onConfirmOrder: () => Promise<{ poId: string; totalNetGrams: number; whatsappMessage: string } | null>;
  onGenerateWhatsAppPO: () => void;
  onNavigateCatalogue: () => void;
  /** Which tab to open first (the profile menu links straight to past orders). */
  initialTab?: 'current' | 'past';
}

const STATUS_LOOKS: Record<string, string> = {
  new: 'bg-primary-fixed text-on-tertiary-fixed',
  confirmed: 'bg-secondary-fixed text-on-secondary-fixed',
  dispatched: 'bg-secondary text-white',
  cancelled: 'bg-surface-container-high text-outline'
};

const PastOrders: React.FC<{ orders: PastOrder[] | null }> = ({ orders }) => {
  if (orders === null) return <p className="text-center text-xs text-outline py-8">Loading your orders…</p>;
  if (orders.length === 0) {
    return (
      <div className="bg-white rounded-xl p-8 text-center border border-outline-variant/40 shadow-xs my-4">
        <span className="material-symbols-outlined text-4xl text-outline mb-2">history</span>
        <h3 className="font-serif text-base font-bold text-on-surface">No past orders yet</h3>
        <p className="text-xs text-outline mt-1">Orders you confirm will be listed here.</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3" data-testid="past-orders">
      {orders.map((order) => (
        <div key={order.poId} className="bg-white rounded-xl shadow-xs border border-outline-variant/40 p-3 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex flex-col min-w-0">
              <span className="font-mono text-xs font-bold text-on-surface truncate">{order.poId}</span>
              <span className="font-sans text-xs text-outline">
                {new Date(order.timestamp).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
              </span>
            </div>
            <span className={`px-2 py-0.5 rounded-full font-mono text-xs font-bold uppercase ${STATUS_LOOKS[order.status] ?? STATUS_LOOKS.new}`}>
              {order.status}
            </span>
          </div>
          <div className="flex flex-col gap-1.5">
            {order.items.map((item) => (
              <div key={item.id} className="flex items-center gap-2">
                <img src={item.image} alt="" className="w-9 h-9 rounded object-cover bg-surface-container flex-shrink-0" referrerPolicy="no-referrer" />
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="font-sans text-xs font-semibold text-on-surface truncate">{item.title}</span>
                  <span className="font-mono text-xs text-outline">{item.sku}</span>
                </div>
                <span className="font-mono text-xs text-on-surface whitespace-nowrap">
                  {item.batchQty} {item.qtyUnit} · {item.totalNetGold.toFixed(3)} g
                </span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between pt-1.5 border-t border-surface-container text-xs font-sans text-outline">
            <span>{order.itemCount} items</span>
            <span className="font-mono font-bold text-primary">{order.totalNetGrams.toFixed(3)} g net</span>
          </div>
        </div>
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

  const handleConfirm = async () => {
    const result = await onConfirmOrder();
    if (!result) return;
    setIsBooked(true);
    setBookedGrams(result.totalNetGrams);
    setBookedMessage(result.whatsappMessage);
    setConfirmedPO(result.poId);
  };

  return (
    <div className="flex flex-col w-full pb-36 max-w-lg md:max-w-3xl mx-auto px-4 pt-3">
      {/* Verified B2B Buyer Credentials Card */}
      <div className="bg-white rounded-xl shadow-xs p-3.5 flex flex-col gap-2 border border-outline-variant/40 mb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-[20px]">receipt_long</span>
            </div>
            <div className="flex flex-col min-w-0">
              <h1 className="font-serif text-[16px] font-bold text-on-surface leading-tight truncate">
                Order Summary
              </h1>
              <span className="font-sans text-xs text-outline truncate">
                {sector.copy.orders.summarySubtitle}
              </span>
            </div>
          </div>
          <span className="bg-primary/10 text-primary font-mono text-xs px-2 py-0.5 rounded font-bold uppercase tracking-wider flex-shrink-0">
            {orders.length} {orders.length === 1 ? 'item' : 'items'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1 p-1 mb-3 bg-surface-container rounded-lg">
        {(['current', 'past'] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`py-1.5 rounded-md font-sans text-xs font-bold transition-all ${
              tab === key ? 'bg-white text-primary shadow-xs' : 'text-outline'
            }`}
          >
            {key === 'current' ? 'Current order' : 'Past orders'}
          </button>
        ))}
      </div>

      {/* Confirmation Success Banner */}
      {confirmedPO && (
        <div className="bg-secondary-container border border-secondary rounded-xl p-3.5 text-on-secondary-fixed mb-3 animate-fade-in shadow-sm">
          <div className="flex items-center gap-2 font-bold text-sm">
            <span className="material-symbols-outlined text-[20px] text-secondary">verified</span>
            <span>{sector.copy.orders.bookedBanner}: {confirmedPO}</span>
          </div>
          <p className="text-xs mt-1 text-on-secondary-fixed-variant">
            {sector.copy.orders.bookedText(bookedGrams.toFixed(3))} {merchant.orders.bookedNote ?? 'booked.'}
          </p>
          <a
            href={`https://wa.me/${merchant.contact.whatsapp}?text=${encodeURIComponent(bookedMessage)}`}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-white text-xs font-sans font-bold"
          >
            <span className="material-symbols-outlined text-[16px]">send</span>
            Send confirmation on WhatsApp
          </a>
        </div>
      )}

      {tab === 'past' ? (
        <PastOrders orders={history} />
      ) : orders.length === 0 ? (
        <div className="bg-white rounded-xl p-8 text-center border border-outline-variant/40 shadow-xs my-4">
          <span className="material-symbols-outlined text-4xl text-outline mb-2">shopping_bag</span>
          <h3 className="font-serif text-base font-bold text-on-surface">{sector.copy.orders.emptyTitle}</h3>
          <p className="text-xs text-outline mt-1 max-w-xs mx-auto">
            {sector.copy.orders.emptyText}
          </p>
          <button
            onClick={onNavigateCatalogue}
            className="mt-4 px-4 py-2 bg-primary text-white text-xs font-semibold rounded-lg shadow-sm"
          >
            Explore Catalogue
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {orders.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-xl shadow-xs border border-outline-variant/40 overflow-hidden flex flex-col"
            >
              <div className="p-3 flex gap-3">
                <img
                  className="w-20 h-20 rounded-lg object-cover flex-shrink-0 bg-surface-container"
                  src={item.image}
                  alt={item.title}
                  referrerPolicy="no-referrer"
                />
                <div className="flex flex-col flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-1">
                    <span className="font-sans text-xs text-on-surface font-bold truncate min-w-0 flex-1">
                      {item.title}
                    </span>
                    <span className="bg-primary-fixed/40 text-tertiary-dark font-mono text-xs px-1.5 py-0.5 rounded font-bold whitespace-nowrap flex-shrink-0">
                      {item.purity}
                    </span>
                  </div>
                  <span className="font-mono text-xs text-outline mb-1">
                    SKU: {item.sku}
                  </span>
                  <div className="flex items-center justify-between mt-auto pt-1">
                    <div className="flex flex-col">
                      <span className="text-xs uppercase font-bold tracking-wider text-outline">
                        {sector.copy.orders.lineWeightLabel}
                      </span>
                      <span className="font-mono text-[14px] font-bold text-primary tracking-tight">
                        {item.totalNetGold.toFixed(3)}{' '}
                        <span className="text-xs font-normal text-on-surface">g</span>
                      </span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-xs uppercase font-bold tracking-wider text-outline">
                        Batch Qty
                      </span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded bg-surface-container font-mono text-xs font-bold text-on-surface">
                        {item.batchQty} {item.qtyUnit}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Unit Wt Strip */}
              <div className="bg-surface-container-low px-3 py-1 flex items-center justify-between text-xs border-t border-outline-variant/30">
                <span className="text-outline text-xs font-sans">{sector.copy.orders.unitWeightLabel}</span>
                <span className="font-mono text-xs font-semibold text-on-surface">
                  {item.unitDescription || `${item.unitWt.toFixed(3)} g / pc`}
                </span>
              </div>

              {/* Note / Hallmark Detail and Delete */}
              <div className="px-3 py-1.5 bg-surface-container flex items-center justify-between">
                <div className="flex items-center gap-1.5 min-w-0">
                  {item.note && (
                    <>
                      <span className="material-symbols-outlined text-[15px] text-primary-container">verified</span>
                      <span className="text-xs font-sans text-on-surface-variant truncate">{item.note}</span>
                    </>
                  )}
                </div>
                <button
                  onClick={() => onRemoveItem(item.id)}
                  aria-label="Remove item"
                  className="text-outline hover:text-error transition-colors p-1"
                  type="button"
                >
                  <span className="material-symbols-outlined text-[17px]">delete</span>
                </button>
              </div>
            </div>
          ))}

          {/* Aggregate Order Weight Summary */}
          <div className="bg-white rounded-xl shadow-xs p-3 flex flex-col gap-1 border border-outline-variant/40 mt-1">
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-surface-container-low p-2.5 rounded-lg flex flex-col">
                <span className="text-xs uppercase font-bold tracking-wider text-outline">
                  {sector.copy.orders.totalWeightLabel}
                </span>
                <span className="font-mono text-base font-bold text-primary tracking-tight">
                  {totalNetGold.toFixed(3)}{' '}
                  <span className="text-xs font-normal text-on-surface">g Net</span>
                </span>
              </div>
              <div className="bg-surface-container-low p-2.5 rounded-lg flex flex-col">
                <span className="text-xs uppercase font-bold tracking-wider text-outline">
                  {sector.copy.orders.dispatchLabel}
                </span>
                <span className="font-mono text-base font-bold text-on-surface tracking-tight">
                  {orders.length} {orders.length === 1 ? 'item' : 'items'}{' '}
                  <span className="text-xs font-normal text-outline">({totalPieces} pcs)</span>
                </span>
              </div>
            </div>
          </div>

          {/* Dual Action Direct Wholesaler Buttons */}
          <div className="flex flex-col gap-2 mt-2">
            {/* WhatsApp Purchase Order & PDF CTA */}
            <button
              onClick={onGenerateWhatsAppPO}
              className="w-full bg-secondary hover:bg-secondary-dark text-white rounded-xl py-3 px-3 flex items-center justify-center gap-2.5 shadow-md transition-all active:scale-[0.98]"
              type="button"
            >
              <span className="material-symbols-outlined text-[22px]">send</span>
              <div className="flex flex-col items-start text-left min-w-0">
                <span className="font-sans text-xs font-bold tracking-tight text-white leading-tight">
                  {sector.copy.orders.whatsappCta.title}
                </span>
                <span className="font-sans text-xs text-white/80 leading-tight">
                  {sector.copy.orders.whatsappCta.subtitle}
                </span>
              </div>
            </button>

            {/* Primary Lock & Confirm Order CTA */}
            <button
              onClick={handleConfirm}
              disabled={isBooked}
              className={`w-full rounded-xl py-3 px-3 flex items-center justify-center shadow-md transition-all active:scale-[0.98] ${
                isBooked
                  ? 'bg-secondary text-white cursor-default'
                  : 'bg-primary-container hover:bg-primary text-white'
              }`}
              type="button"
            >
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[20px]">
                  {isBooked ? 'check_circle' : 'verified'}
                </span>
                <span className="font-sans text-xs font-bold uppercase tracking-wider">
                  {isBooked ? sector.copy.orders.bookedCta : sector.copy.orders.confirmCta}
                </span>
              </div>
            </button>
          </div>

          {/* Verification Footnote */}
          <div className="flex items-center justify-center gap-1.5 pt-2 pb-6 text-center text-outline">
            <span className="material-symbols-outlined text-[15px] text-secondary">encrypted</span>
            <span className="font-sans text-xs">
              {merchant.orders.guaranteeLine ?? sector.copy.orders.guaranteeFallback}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
