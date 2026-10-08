import React, { useState, useMemo, useEffect, useRef } from 'react';
import type { Product, Purity, Category } from '../types';
import { Icon } from './ui';

interface CatalogueScreenProps {
  products: Product[];
  isAdmin: boolean;
  categoryFilter: string | null;
  categories: Category[];
  onCategoryChange: (name: string | null) => void;
  onClearCategoryFilter: () => void;
  onEditProduct: (product: Product) => void;
  onAddToOrder: (product: Product, quantity: number, purity?: string) => void;
  purities: Purity[];
  shortlist: string[];
  onToggleShortlist: (product: Product) => void;
  orderCount?: number;
  onNavigate?: (screen: ActiveScreen) => void;
  initialSearch?: string;
  initialSku?: string | null;
  onInitialUsed?: () => void;
}

export const CatalogueScreen: React.FC<CatalogueScreenProps> = ({
  products,
  isAdmin,
  categoryFilter,
  categories,
  onCategoryChange,
  onClearCategoryFilter,
  onAddToOrder,
  shortlist,
  onToggleShortlist,
  onNavigate,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState(categoryFilter);
  const [addedNotice, setAddedNotice] = useState<string | null>(null);

  // Filter products
  const filteredProducts = useMemo(() => {
    let filtered = products;

    // Category filter
    if (activeCategory) {
      filtered = filtered.filter((p) => p.categoryId === categories.find((c) => c.name === activeCategory)?.id);
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      filtered = filtered.filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
    }

    return filtered;
  }, [products, activeCategory, categories, searchQuery]);

  // Show notice when item added
  const handleAdd = (prod: Product) => {
    onAddToOrder(prod, 1);
    setAddedNotice(prod.name);
    setTimeout(() => setAddedNotice(null), 1800);
  };

  return (
    <div className="bt-page">
      {/* Search Bar */}
      <div className="bt-search">
        <Icon name="search" />
        <input
          type="search"
          placeholder="Search name, SKU or collection"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Category Pills */}
      <div className="bt-pad">
        <div className="bt-pills">
          <button
            type="button"
            className={`bt-pill${!activeCategory ? ' on' : ''}`}
            onClick={() => { setActiveCategory(null); onCategoryChange(null); }}
          >
            All Collections
          </button>
          {categories
            .filter((c) => c.designCount > 0)
            .map((cat) => (
              <button
                key={cat.id}
                type="button"
                className={`bt-pill${activeCategory === cat.name ? ' on' : ''}`}
                onClick={() => { setActiveCategory(cat.name); onCategoryChange(cat.name); }}
              >
                {cat.name}
              </button>
            ))}
        </div>
      </div>

      {/* Active Filters */}
      {(activeCategory || searchQuery.trim()) && (
        <div className="bt-pad" style={{ marginTop: 12 }}>
          <div className="bt-ey bt-mb-2">Active Filters:</div>
          <div className="bt-flex bt-gap-2" style={{ flexWrap: 'wrap' }}>
            {activeCategory && (
              <span className="bt-pill on" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {activeCategory}
                <button type="button" onClick={onClearCategoryFilter} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>
                  <Icon name="x" size={10} />
                </button>
              </span>
            )}
            {searchQuery.trim() && (
              <span className="bt-pill on" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                Search: {searchQuery}
                <button type="button" onClick={() => setSearchQuery('')} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>
                  <Icon name="x" size={10} />
                </button>
              </span>
            )}
          </div>
        </div>
      )}

      {/* Result Count */}
      <div className="bt-pad" style={{ marginTop: 16 }}>
        <div className="bt-ey">{filteredProducts.length} design{filteredProducts.length !== 1 ? 's' : ''}</div>
      </div>

      {/* Product Grid */}
      <div className="bt-grid">
        {filteredProducts.map((p) => {
          const isHearted = shortlist.includes(p.sku);
          return (
            <div key={p.id} className="bt-card">
              <div className="bt-card-image">
                <img src={p.imageUrls[0] || 'https://placehold.co/300x400?text=No+Image'} alt={p.name} />
              </div>
              <div className="bt-card-content">
                <h3 className="bt-card-title">{p.name}</h3>
                <p className="bt-card-weight">{p.netWeight}g</p>
                <p className="bt-card-price">{p.pricing?.fixedPrice ? `₹${p.pricing.fixedPrice}` : p.purity || '22K 916'}</p>
              </div>
              <button
                type="button"
                className={`bt-card-fav${isHearted ? ' bt-fav-on' : ''}`}
                onClick={() => onToggleShortlist(p)}
                aria-label={isHearted ? 'Remove from shortlist' : 'Add to shortlist'}
              >
                <Icon name="heart" fill={isHearted} />
              </button>
              {!isAdmin && (
                <button
                  type="button"
                  className="bt-btn"
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    width: '100%',
                    height: 46,
                    borderRadius: 0,
                    background: 'linear-gradient(180deg, color-mix(in srgb, var(--bt-accent) 88%, #000) 0%, var(--bt-accent) 100%)',
                    color: '#fff',
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                  onClick={() => handleAdd(p)}
                >
                  Add to cart
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {filteredProducts.length === 0 && (
        <div className="bt-empty">
          <Icon name="search" />
          <h3>No designs found</h3>
          <p>Try adjusting your search or filters</p>
          {(activeCategory || searchQuery.trim()) && (
            <button type="button" onClick={onClearCategoryFilter} style={{ marginTop: 16, color: 'var(--bt-accent)', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer' }}>
              Clear all filters
            </button>
          )}
        </div>
      )}

      {/* Added Notice */}
      {addedNotice && (
        <div className="bt-flex bt-flex-between bt-pad" style={{ background: '#fff', padding: '12px 20px', marginTop: 20, borderRadius: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
          <span style={{ fontWeight: 600 }}>Added {addedNotice} to your order</span>
          <button type="button" onClick={() => onNavigate?.('orders')} style={{ color: 'var(--bt-accent)', fontWeight: 600 }}>
            Review <Icon name="right" size={16} />
          </button>
        </div>
      )}
    </div>
  );
};
