import React, { useState } from 'react';
import { OrderItem } from '../types';

interface OrdersScreenProps {
  orders: OrderItem[];
  onRemoveItem: (id: string) => void;
  onConfirmOrder: () => void;
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

  const handleConfirm = () => {
    setIsBooked(true);
    const poNum = `PO-BHAKTI-${Math.floor(100000 + Math.random() * 900000)}`;
    setConfirmedPO(poNum);
    onConfirmOrder();
  };

  return (
    <div className="flex flex-col w-full pb-36 max-w-lg mx-auto px-4 pt-3">
      {/* Pure Gram Settlement Standard Banner (Replaces Bullion Rate Lock!) */}
      <div className="bg-[#f0edea] rounded-xl p-3 border border-[#d1c5b3]/50 shadow-xs flex items-center justify-between mb-3 text-left">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#486458] text-white flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined text-[19px]">scale</span>
          </div>
          <div className="flex flex-col">
            <span className="font-mono text-[10px] uppercase font-bold text-[#715509] tracking-wider">
              Pure Gram-Basis Settlement
            </span>
            <span className="text-[12px] font-sans font-semibold text-[#1c1c1a]">
              Settlement via Fine Gold Weight (Physical / GML)
            </span>
          </div>
        </div>
        <div className="text-right">
          <span className="font-mono text-[11px] font-bold text-[#486458] bg-[#caeada] px-2 py-0.5 rounded">
            NET WT BASIS
          </span>
          <span className="text-[9px] block text-[#7f7666] mt-0.5">Zero Price Slippage</span>
        </div>
      </div>

      {/* Verified B2B Buyer Credentials Card */}
      <div className="bg-white rounded-xl shadow-xs p-3.5 flex flex-col gap-2 border border-[#d1c5b3]/40 mb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-[#715509]/10 text-[#715509] flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-[20px]">receipt_long</span>
            </div>
            <div className="flex flex-col min-w-0">
              <h1 className="font-serif text-[16px] font-bold text-[#1c1c1a] leading-tight truncate">
                Order Summary
              </h1>
              <span className="font-sans text-[11px] text-[#7f7666] truncate">
                Wholesale Gram Allocation & Dispatch Verification
              </span>
            </div>
          </div>
          <span className="bg-[#715509]/10 text-[#715509] font-mono text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider flex-shrink-0">
            {orders.length} Items
          </span>
        </div>
      </div>

      {/* Confirmation Success Banner */}
      {confirmedPO && (
        <div className="bg-[#c7e7d7] border border-[#486458] rounded-xl p-3.5 text-[#032017] mb-3 animate-fade-in shadow-sm">
          <div className="flex items-center gap-2 font-bold text-sm">
            <span className="material-symbols-outlined text-[20px] text-[#486458]">verified</span>
            <span>Gram Allocation Booked: {confirmedPO}</span>
          </div>
          <p className="text-xs mt-1 text-[#304c41]">
            Batch verified on pure gram settlement terms: {totalNetGold.toFixed(3)}g fine gold allocation registered with Gujarat Bullion Guild Escrow.
          </p>
        </div>
      )}

      {/* Items List */}
      {orders.length === 0 ? (
        <div className="bg-white rounded-xl p-8 text-center border border-[#d1c5b3]/40 shadow-xs my-4">
          <span className="material-symbols-outlined text-4xl text-[#7f7666] mb-2">shopping_bag</span>
          <h3 className="font-serif text-base font-bold text-[#1c1c1a]">Wholesale Batch is Empty</h3>
          <p className="text-xs text-[#7f7666] mt-1 max-w-xs mx-auto">
            Browse our hallmarked 22K and 24K collections to add designs to your wholesale batch.
          </p>
          <button
            onClick={onNavigateCatalogue}
            className="mt-4 px-4 py-2 bg-[#715509] text-white text-xs font-semibold rounded-lg shadow-sm"
          >
            Explore Catalogue
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {orders.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-xl shadow-xs border border-[#d1c5b3]/40 overflow-hidden flex flex-col"
            >
              <div className="p-3 flex gap-3">
                <img
                  className="w-20 h-20 rounded-lg object-cover flex-shrink-0 bg-[#f0edea]"
                  src={item.image}
                  alt={item.title}
                  referrerPolicy="no-referrer"
                />
                <div className="flex flex-col flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-1">
                    <span className="font-sans text-xs text-[#1c1c1a] font-bold truncate min-w-0 flex-1">
                      {item.title}
                    </span>
                    <span className="bg-[#ffdf9e]/40 text-[#5b4300] font-mono text-[9px] px-1.5 py-0.5 rounded font-bold whitespace-nowrap flex-shrink-0">
                      {item.purity}
                    </span>
                  </div>
                  <span className="font-mono text-[10px] text-[#7f7666] mb-1">
                    SKU: {item.sku}
                  </span>
                  <div className="flex items-center justify-between mt-auto pt-1">
                    <div className="flex flex-col">
                      <span className="text-[9px] uppercase font-bold tracking-wider text-[#7f7666]">
                        Total Net Gold
                      </span>
                      <span className="font-mono text-[14px] font-bold text-[#715509] tracking-tight">
                        {item.totalNetGold.toFixed(3)}{' '}
                        <span className="text-[11px] font-normal text-[#1c1c1a]">g</span>
                      </span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-[9px] uppercase font-bold tracking-wider text-[#7f7666]">
                        Batch Qty
                      </span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded bg-[#f0edea] font-mono text-[11px] font-bold text-[#1c1c1a]">
                        {item.batchQty} {item.qtyUnit}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Unit Wt Strip */}
              <div className="bg-[#f6f3ef] px-3 py-1 flex items-center justify-between text-xs border-t border-[#d1c5b3]/30">
                <span className="text-[#7f7666] text-[11px] font-sans">Unit Net Weight:</span>
                <span className="font-mono text-[11px] font-semibold text-[#1c1c1a]">
                  {item.unitDescription || `${item.unitWt.toFixed(3)} g / pc`}
                </span>
              </div>

              {/* Note / Hallmark Detail and Delete */}
              <div className="px-3 py-1.5 bg-[#f0edea] flex items-center justify-between">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="material-symbols-outlined text-[15px] text-[#8c6d23]">verified</span>
                  <span className="text-[11px] font-sans text-[#4d4638] truncate">
                    {item.note || 'BIS Hallmarked • 916 HUID Laser Inscribed'}
                  </span>
                </div>
                <button
                  onClick={() => onRemoveItem(item.id)}
                  aria-label="Remove item"
                  className="text-[#7f7666] hover:text-[#ba1a1a] transition-colors p-1"
                  type="button"
                >
                  <span className="material-symbols-outlined text-[17px]">delete</span>
                </button>
              </div>
            </div>
          ))}

          {/* Aggregate Order Weight Summary */}
          <div className="bg-white rounded-xl shadow-xs p-3 flex flex-col gap-1 border border-[#d1c5b3]/40 mt-1">
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-[#f6f3ef] p-2.5 rounded-lg flex flex-col">
                <span className="text-[9px] uppercase font-bold tracking-wider text-[#7f7666]">
                  Total Net Gold Weight
                </span>
                <span className="font-mono text-base font-bold text-[#715509] tracking-tight">
                  {totalNetGold.toFixed(3)}{' '}
                  <span className="text-xs font-normal text-[#1c1c1a]">g Net</span>
                </span>
              </div>
              <div className="bg-[#f6f3ef] p-2.5 rounded-lg flex flex-col">
                <span className="text-[9px] uppercase font-bold tracking-wider text-[#7f7666]">
                  Dispatch Batch
                </span>
                <span className="font-mono text-base font-bold text-[#1c1c1a] tracking-tight">
                  {orders.length} Items{' '}
                  <span className="text-xs font-normal text-[#7f7666]">({totalPieces} pcs)</span>
                </span>
              </div>
            </div>
          </div>

          {/* Dual Action Direct Wholesaler Buttons */}
          <div className="flex flex-col gap-2 mt-2">
            {/* WhatsApp Purchase Order & PDF CTA */}
            <button
              onClick={onGenerateWhatsAppPO}
              className="w-full bg-[#486458] hover:bg-[#3a5247] text-white rounded-xl py-3 px-3 flex items-center justify-center gap-2.5 shadow-md transition-all active:scale-[0.98]"
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
                  ? 'bg-[#486458] text-white cursor-default'
                  : 'bg-[#8c6d23] hover:bg-[#715509] text-white'
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
          <div className="flex items-center justify-center gap-1.5 pt-2 pb-6 text-center text-[#7f7666]">
            <span className="material-symbols-outlined text-[15px] text-[#486458]">encrypted</span>
            <span className="font-sans text-[11px]">
              Pure Gram Weight Guarantee • Protected by Bhakti Wholesale Bullion Escrow
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
