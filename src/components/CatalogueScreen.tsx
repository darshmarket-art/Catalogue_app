import React, { useState, useMemo } from 'react';
import { Product } from '../types';

interface CatalogueScreenProps {
  products: Product[];
  onAddToOrder: (product: Product, quantity: number) => void;
  onOpenQuotation: (selectedCount: number, netWeight: number, items: Product[]) => void;
  onNavigateCategories: () => void;
}

export const CatalogueScreen: React.FC<CatalogueScreenProps> = ({
  products,
  onAddToOrder,
  onOpenQuotation,
  onNavigateCategories
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(['item-1', 'item-2', 'item-4']));
  const [quantities, setQuantities] = useState<Record<string, number>>({
    'item-1': 1,
    'item-2': 1,
    'item-3': 5,
    'item-4': 1,
    'item-5': 1,
    'item-6': 1
  });
  const [addedNotice, setAddedNotice] = useState<string | null>(null);
  const [selectedPurityFilter, setSelectedPurityFilter] = useState<string>('all');
  const [showFilterDrawer, setShowFilterDrawer] = useState(false);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch =
        p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.category.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesPurity =
        selectedPurityFilter === 'all' || p.purity.includes(selectedPurityFilter);

      return matchesSearch && matchesPurity;
    });
  }, [products, searchQuery, selectedPurityFilter]);

  // Selected Items Calculation
  const { selectedCount, totalNetWeight } = useMemo(() => {
    let count = 0;
    let net = 0;
    products.forEach((p) => {
      if (selectedIds.has(p.id)) {
        const qty = quantities[p.id] || 1;
        count += qty;
        net += p.netWt * qty;
      }
    });
    return { selectedCount: count, totalNetWeight: parseFloat(net.toFixed(2)) };
  }, [products, selectedIds, quantities]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredProducts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredProducts.map((p) => p.id)));
    }
  };

  const updateQuantity = (id: string, delta: number) => {
    setQuantities((prev) => {
      const cur = prev[id] || 1;
      const next = Math.max(1, cur + delta);
      return { ...prev, [id]: next };
    });
  };

  const handleAdd = (prod: Product) => {
    const qty = quantities[prod.id] || 1;
    onAddToOrder(prod, qty);
    setAddedNotice(prod.title);
    setTimeout(() => setAddedNotice(null), 1800);
  };

  const getSelectedProductObjects = () => {
    return products.filter((p) => selectedIds.has(p.id));
  };

  return (
    <div className="flex flex-col w-full pb-32 max-w-4xl mx-auto">
      {/* Toast Notification */}
      {addedNotice && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-[#1c1c1a] text-[#fcf9f5] px-4 py-2 rounded-full shadow-lg flex items-center gap-2 text-xs font-sans animate-fade-in border border-[#8c6d23]/40">
          <span className="material-symbols-outlined text-emerald-400 text-[18px]">check_circle</span>
          <span>Added {addedNotice} to Wholesale Batch Order!</span>
        </div>
      )}

      {/* Filter & Rapid Search Bar */}
      <section className="px-4 pt-3 pb-2 flex flex-col gap-2.5">
        <div className="relative flex items-center">
          <span className="material-symbols-outlined absolute left-3 text-[18px] text-[#7f7666]">search</span>
          <input
            className="w-full bg-white text-[#1c1c1a] font-sans text-xs pl-9 pr-24 py-2.5 rounded-lg shadow-xs border border-[#d1c5b3]/40 focus:outline-none focus:bg-[#f6f3ef] transition-colors"
            placeholder="Search by SKU, design code, or weight range..."
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <div className="absolute right-2 flex items-center gap-1">
            <button
              onClick={() => setShowFilterDrawer(!showFilterDrawer)}
              className="flex items-center gap-1 bg-[#f0edea] px-2.5 py-1 rounded text-[#4d4638] font-sans text-[11px] font-semibold active:scale-95 transition-transform hover:bg-[#ebe8e4]"
              type="button"
            >
              <span className="material-symbols-outlined text-[15px]">tune</span>
              <span>Filter</span>
            </button>
          </div>
        </div>

        {/* Filter Drawer / Badges */}
        {showFilterDrawer && (
          <div className="bg-white p-3 rounded-lg border border-[#d1c5b3]/60 shadow-sm flex flex-col gap-2 animate-fade-in">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-[#715509] uppercase tracking-wider font-mono">
                Purity & Karat Filter
              </span>
              <button
                onClick={() => setSelectedPurityFilter('all')}
                className="text-[10px] text-[#7f7666] hover:underline"
              >
                Reset
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {['all', '22K', '24K', '18K'].map((purity) => (
                <button
                  key={purity}
                  onClick={() => setSelectedPurityFilter(purity)}
                  className={`px-3 py-1 rounded text-xs font-mono font-semibold transition-all ${
                    selectedPurityFilter === purity
                      ? 'bg-[#715509] text-white shadow-xs'
                      : 'bg-[#f0edea] text-[#4d4638] hover:bg-[#ebe8e4]'
                  }`}
                >
                  {purity === 'all' ? 'All Karats' : purity}
                </button>
              ))}
              <button
                onClick={onNavigateCategories}
                className="ml-auto text-xs text-[#486458] font-sans font-semibold flex items-center gap-1 hover:underline"
              >
                <span>Browse by Category</span>
                <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
              </button>
            </div>
          </div>
        )}
      </section>

      {/* B2B Wholesale Bulk Actions Banner */}
      <section className="mx-4 mt-1 mb-3 p-3 rounded-xl bg-[#f6f3ef] border border-[#d1c5b3]/50 shadow-xs flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-5 h-5 rounded bg-[#715509] flex items-center justify-center text-white">
              <span className="material-symbols-outlined text-[15px]">done_all</span>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-sans text-[12px] font-bold text-[#1c1c1a] truncate">
                Wholesale Batch Selection
              </span>
              <span className="font-mono text-[11px] text-[#715509] font-bold">
                {selectedCount} items selected • Net Gold: {totalNetWeight}g
              </span>
            </div>
          </div>
          <button
            onClick={toggleSelectAll}
            className="font-sans text-[11px] text-[#486458] font-bold px-2.5 py-1 rounded bg-[#c7e7d7]/50 hover:bg-[#c7e7d7] transition-colors"
            type="button"
          >
            {selectedIds.size === filteredProducts.length && filteredProducts.length > 0
              ? 'Deselect All'
              : 'Select All'}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            onClick={() => onOpenQuotation(selectedCount, totalNetWeight, getSelectedProductObjects())}
            className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-[#486458] text-white font-sans text-xs font-semibold active:scale-95 transition-all shadow-xs hover:bg-[#3d554a]"
            type="button"
          >
            <span className="material-symbols-outlined text-[16px]">share</span>
            <span>Share with Client</span>
          </button>

          <button
            onClick={() => onOpenQuotation(selectedCount, totalNetWeight, getSelectedProductObjects())}
            className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-[#715509] text-white font-sans text-xs font-semibold active:scale-95 transition-all shadow-xs hover:bg-[#5b4300]"
            type="button"
          >
            <span className="material-symbols-outlined text-[16px]">assignment_turned_in</span>
            <span>RFQ Batch Order</span>
          </button>
        </div>
      </section>

      {/* Product Catalogue 2-Column Grid */}
      <section className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-3 px-4 pb-20">
        {filteredProducts.map((prod) => {
          const isSelected = selectedIds.has(prod.id);
          const qty = quantities[prod.id] || 1;

          return (
            <article
              key={prod.id}
              className="product-card group relative bg-white rounded-xl p-2.5 shadow-sm border border-[#d1c5b3]/40 hover:shadow-md transition-shadow flex flex-col justify-between"
            >
              <div>
                {/* Product Image Container with Overlays */}
                <div className="relative w-full aspect-square bg-[#f0edea] rounded-lg overflow-hidden mb-2">
                  <img
                    alt={prod.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    src={prod.image}
                    referrerPolicy="no-referrer"
                  />
                  <span className="absolute top-1.5 left-1.5 bg-white/90 backdrop-blur-md px-1.5 py-0.5 rounded font-mono text-[9px] font-bold text-[#715509] shadow-xs border border-[#8c6d23]/20">
                    {prod.purity}
                  </span>
                  <label className="cursor-pointer absolute top-1.5 right-1.5">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(prod.id)}
                      className="sr-only"
                    />
                    <div
                      className={`w-5 h-5 rounded flex items-center justify-center transition-colors shadow-xs ${
                        isSelected
                          ? 'bg-[#715509] text-white'
                          : 'bg-[#ebe8e4] text-transparent hover:bg-[#dcdad6]'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[14px]">check</span>
                    </div>
                  </label>
                </div>

                {/* SKU & Title */}
                <div className="mb-1.5">
                  <span className="font-mono text-[9px] text-[#7f7666] font-medium block leading-tight">
                    SKU: {prod.sku}
                  </span>
                  <h2 className="font-serif text-[13px] leading-tight font-bold text-[#1c1c1a] line-clamp-1 mt-0.5">
                    {prod.title}
                  </h2>
                </div>

                {/* Micro Spec Grid */}
                <div className="grid grid-cols-2 gap-1 bg-[#f6f3ef] p-1 rounded-lg text-center mb-2 border border-[#d1c5b3]/40">
                  <div className="flex flex-col py-0.5">
                    <span className="font-sans text-[8px] text-[#7f7666] font-medium uppercase tracking-wider">
                      Gross
                    </span>
                    <span className="font-mono text-[11px] font-bold text-[#1c1c1a]">
                      {prod.grossWt.toFixed(2)}g
                    </span>
                  </div>
                  <div className="flex flex-col bg-white rounded py-0.5 shadow-xs border border-[#715509]/20">
                    <span className="font-sans text-[8px] text-[#715509] font-bold uppercase tracking-wider">
                      {prod.purity.includes('24K') ? 'Purity' : 'Net'}
                    </span>
                    <span className="font-mono text-[11px] font-bold text-[#715509]">
                      {prod.purity.includes('24K') ? '999.9' : `${prod.netWt.toFixed(2)}g`}
                    </span>
                  </div>
                </div>
              </div>

              {/* Stepper & Action */}
              <div className="flex flex-col gap-1.5 pt-1">
                <div className="flex items-center justify-between bg-[#f6f3ef] px-1.5 py-1 rounded">
                  <button
                    onClick={() => updateQuantity(prod.id, -1)}
                    className="w-5 h-5 flex items-center justify-center text-[#4d4638] hover:text-[#1c1c1a] active:scale-90"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[13px]">remove</span>
                  </button>
                  <span className="font-mono text-[11px] font-bold text-[#1c1c1a]">
                    {qty}
                  </span>
                  <button
                    onClick={() => updateQuantity(prod.id, 1)}
                    className="w-5 h-5 flex items-center justify-center text-[#4d4638] hover:text-[#1c1c1a] active:scale-90"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[13px]">add</span>
                  </button>
                </div>

                <button
                  onClick={() => handleAdd(prod)}
                  className="w-full h-7 rounded bg-[#486458] hover:bg-[#3a5247] text-white font-sans text-[10px] font-bold flex items-center justify-center gap-1 active:scale-95 transition-all shadow-xs"
                  type="button"
                >
                  <span className="material-symbols-outlined text-[13px]">
                    {prod.purity.includes('24K') ? 'scale' : 'add_shopping_cart'}
                  </span>
                  <span>{prod.purity.includes('24K') ? 'Add Gram Batch' : 'Add to Order'}</span>
                </button>
              </div>
            </article>
          );
        })}
      </section>

      {/* Floating Quick Action Pill for WhatsApp Wholesale Quotation */}
      {selectedCount > 0 && (
        <aside className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 w-[92%] max-w-md animate-fade-in">
          <div className="bg-[#1c1c1a] text-[#f3f0ec] px-4 py-2.5 rounded-full shadow-2xl flex items-center justify-between gap-2 border border-[#8c6d23]/50">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-full bg-[#486458] flex items-center justify-center text-white flex-shrink-0">
                <span className="material-symbols-outlined text-[18px]">chat</span>
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-mono text-[11px] font-bold text-[#ffdf9e] truncate">
                  {selectedCount} Pcs ({totalNetWeight}g Net) Selected
                </span>
                <span className="font-sans text-[10px] text-[#f3f0ec]/80 truncate">
                  Tap to send Gram Requisition Slip to Retailer
                </span>
              </div>
            </div>
            <button
              onClick={() => onOpenQuotation(selectedCount, totalNetWeight, getSelectedProductObjects())}
              className="flex-shrink-0 bg-[#715509] hover:bg-[#8c6d23] text-white font-sans text-xs font-bold px-3 py-1.5 rounded-full active:scale-95 transition-transform flex items-center gap-1 shadow-md"
              type="button"
            >
              <span>Send</span>
              <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
            </button>
          </div>
        </aside>
      )}
    </div>
  );
};
