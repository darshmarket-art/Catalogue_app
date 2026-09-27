import React, { useState } from 'react';
import { OrderItem } from '../types';
import { merchant } from '../merchant';

interface OrdersScreenProps {
  orders: OrderItem[];
  onRemoveItem: (id: string) => void;
  onConfirmOrder: () => Promise<{ poId: string } | null>;
  onGenerateWhatsAppPO: () => void;
  onNavigateCatalogue: () => void;
}

export const OrdersScreen: React.FC<OrdersScreenProps> = ({
  orders,
  onRemoveItem,
  onConfirmOrder,
  onGenerateWhatsAppPO,
  onNavigateCatalogue
}) => {
  const [isBooked, setIsBooked] = useState(false);
  const [confirmedPO, setConfirmedPO] = useState<string | null>(null);

  const totalNetGold = orders.reduce((sum, item) => sum + (item.totalNetGold || 0), 0);
  const totalPieces = orders.reduce((sum, item) => sum + (item.batchQty || 1), 0);

  const handleConfirm = async () => {
    const result = await onConfirmOrder();
    if (!result) return;
    setIsBooked(true);
    setConfirmedPO(result.poId);
  };

  return (
    <div className="flex flex-col w-full pb-36 max-w-lg mx-auto px-4 pt-3">
      {/* Pure Gram Settlement Standard Banner (Replaces Bullion Rate Lock!) */}
      <div className="bg-surface-container rounded-xl p-3 border border-outline-variant/50 shadow-xs flex items-center justify-between mb-3 text-left">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-secondary text-white flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined text-[19px]">scale</span>
          </div>
          <div className="flex flex-col">
            <span className="font-mono text-[10px] uppercase font-bold text-primary tracking-wider">
              Pure Gram-Basis Settlement
            </span>
            <span className="text-[12px] font-sans font-semibold text-on-surface">
              Settlement via Fine Gold Weight (Physical / GML)
            </span>
          </div>
        </div>
        <div className="text-right">
          <span className="font-mono text-[11px] font-bold text-secondary bg-secondary-fixed px-2 py-0.5 rounded">
            NET WT BASIS
          </span>
          <span className="text-[9px] block text-outline mt-0.5">Zero Price Slippage</span>
        </div>
      </div>

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
              <span className="font-sans text-[11px] text-outline truncate">
                Wholesale Gram Allocation & Dispatch Verification
              </span>
            </div>
          </div>
          <span className="bg-primary/10 text-primary font-mono text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider flex-shrink-0">
            {orders.length} Items
          </span>
        </div>
      </div>

      {/* Confirmation Success Banner */}
      {confirmedPO && (
        <div className="bg-secondary-container border border-secondary rounded-xl p-3.5 text-on-secondary-fixed mb-3 animate-fade-in shadow-sm">
          <div className="flex items-center gap-2 font-bold text-sm">
            <span className="material-symbols-outlined text-[20px] text-secondary">verified</span>
            <span>Gram Allocation Booked: {confirmedPO}</span>
          </div>
          <p className="text-xs mt-1 text-on-secondary-fixed-variant">
            Batch verified on pure gram settlement terms: {totalNetGold.toFixed(3)}g fine gold allocation {merchant.orders.bookedNote ?? 'booked.'}
          </p>
        </div>
      )}

      {/* Items List */}
      {orders.length === 0 ? (
        <div className="bg-white rounded-xl p-8 text-center border border-outline-variant/40 shadow-xs my-4">
          <span className="material-symbols-outlined text-4xl text-outline mb-2">shopping_bag</span>
          <h3 className="font-serif text-base font-bold text-on-surface">Wholesale Batch is Empty</h3>
          <p className="text-xs text-outline mt-1 max-w-xs mx-auto">
            Browse our hallmarked 22K and 24K collections to add designs to your wholesale batch.
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
                    <span className="bg-primary-fixed/40 text-tertiary-dark font-mono text-[9px] px-1.5 py-0.5 rounded font-bold whitespace-nowrap flex-shrink-0">
                      {item.purity}
                    </span>
                  </div>
                  <span className="font-mono text-[10px] text-outline mb-1">
                    SKU: {item.sku}
                  </span>
                  <div className="flex items-center justify-between mt-auto pt-1">
                    <div className="flex flex-col">
                      <span className="text-[9px] uppercase font-bold tracking-wider text-outline">
                        Total Net Gold
                      </span>
                      <span className="font-mono text-[14px] font-bold text-primary tracking-tight">
                        {item.totalNetGold.toFixed(3)}{' '}
                        <span className="text-[11px] font-normal text-on-surface">g</span>
                      </span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-[9px] uppercase font-bold tracking-wider text-outline">
                        Batch Qty
                      </span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded bg-surface-container font-mono text-[11px] font-bold text-on-surface">
                        {item.batchQty} {item.qtyUnit}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Unit Wt Strip */}
              <div className="bg-surface-container-low px-3 py-1 flex items-center justify-between text-xs border-t border-outline-variant/30">
                <span className="text-outline text-[11px] font-sans">Unit Net Weight:</span>
                <span className="font-mono text-[11px] font-semibold text-on-surface">
                  {item.unitDescription || `${item.unitWt.toFixed(3)} g / pc`}
                </span>
              </div>

              {/* Note / Hallmark Detail and Delete */}
              <div className="px-3 py-1.5 bg-surface-container flex items-center justify-between">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="material-symbols-outlined text-[15px] text-primary-container">verified</span>
                  <span className="text-[11px] font-sans text-on-surface-variant truncate">
                    {item.note || 'BIS Hallmarked • 916 HUID Laser Inscribed'}
                  </span>
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
                <span className="text-[9px] uppercase font-bold tracking-wider text-outline">
                  Total Net Gold Weight
                </span>
                <span className="font-mono text-base font-bold text-primary tracking-tight">
                  {totalNetGold.toFixed(3)}{' '}
                  <span className="text-xs font-normal text-on-surface">g Net</span>
                </span>
              </div>
              <div className="bg-surface-container-low p-2.5 rounded-lg flex flex-col">
                <span className="text-[9px] uppercase font-bold tracking-wider text-outline">
                  Dispatch Batch
                </span>
                <span className="font-mono text-base font-bold text-on-surface tracking-tight">
                  {orders.length} Items{' '}
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
                  Generate WhatsApp Gram Purchase Order & PDF
                </span>
                <span className="font-sans text-[10px] text-white/80 leading-tight">
                  Pure gram-basis invoice sheet for bullion settlement
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
                  {isBooked ? 'Gram Allocation Booked' : 'Confirm Batch & Book Gram Allocation'}
                </span>
              </div>
            </button>
          </div>

          {/* Verification Footnote */}
          <div className="flex items-center justify-center gap-1.5 pt-2 pb-6 text-center text-outline">
            <span className="material-symbols-outlined text-[15px] text-secondary">encrypted</span>
            <span className="font-sans text-[11px]">
              {merchant.orders.guaranteeLine ?? 'Pure Gram Weight Guarantee'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
