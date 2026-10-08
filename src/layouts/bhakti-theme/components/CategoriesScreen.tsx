import React, { useState } from 'react';
import type { Category, Product, Banner, ActiveScreen } from '../types';
import { Icon } from './ui';

interface CategoriesScreenProps {
  categories: Category[];
  products: Product[];
  banners: Banner[];
  isAdmin: boolean;
  buyerName?: string;
  onEditCategory: (category: Category) => void;
  onNavigate: (screen: ActiveScreen) => void;
  onFilterCategoryInCatalogue: (categoryName: string) => void;
  onSearchDesigns?: (query: string) => void;
  onOpenDesign?: (sku: string) => void;
}

export const CategoriesScreen: React.FC<CategoriesScreenProps> = ({
  categories,
  products,
  banners,
  onNavigate,
  onFilterCategoryInCatalogue,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const categoryProducts = (catId: string) => products.filter((p) => p.categoryId === catId).length;

  // Handle search
  const handleSearch = () => {
    const trimmed = searchQuery.trim();
    if (trimmed.length >= 2) {
      onFilterCategoryInCatalogue(trimmed);
      onNavigate('catalogue');
    }
  };

  return (
    <div className="bt-page">
      {/* Search Bar */}
      <div className="bt-search">
        <Icon n="search" />
        <input
          type="search"
          placeholder="Search name, SKU or collection"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
        />
      </div>

      {/* Banners */}
      {banners.length > 0 && (
        <div className="bt-pad" style={{ marginTop: 18 }}>
          <div className="bt-hero" style={{ borderRadius: 20, marginBottom: 20 }}>
            <div className="bt-hero-content">
              <div className="bt-ey bt-mb-2">Collection</div>
              <h2 className="bt-h2">{banners[0].category || 'Special Offer'}</h2>
            </div>
          </div>
        </div>
      )}

      {/* Collections */}
      <div className="bt-section-header">
        <h2 className="bt-h2">Collections</h2>
        <a href="#" className="bt-link" onClick={(e) => { e.preventDefault(); onNavigate('catalogue'); }}>
          All designs <Icon n="right" />
        </a>
      </div>

      <div className="bt-grid bt-mb-4">
        {categories.map((cat, i) => (
          <div key={cat.id} className="bt-card" onClick={() => onFilterCategoryInCatalogue(cat.name)}>
            <div className="bt-card-image">
              <Icon n={cat.tag || 'grid'} />
            </div>
            <div className="bt-card-content">
              <h3 className="bt-card-title">{cat.name}</h3>
              <p className="bt-card-weight">
                {categoryProducts(cat.id)} designs <span className="bt-mut">· avg {cat.avgNetWt?.toFixed(2) || '0'}g</span>
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Recently Viewed */}
      {products.length > 0 && (
        <>
          <div className="bt-section-header">
            <h2 className="bt-h2">Recently Viewed</h2>
          </div>
          <div className="bt-grid">
            {products.slice(0, 8).map((p, i) => (
              <div key={p.id} className="bt-card" onClick={() => onNavigate('catalogue')}>
                <div className="bt-card-image">
                  <img src={p.imageUrls[0] || 'https://placehold.co/300x400?text=No+Image'} alt={p.name} />
                </div>
                <div className="bt-card-content">
                  <h3 className="bt-card-title">{p.name}</h3>
                  <p className="bt-card-weight">{p.netWeight}g</p>
                  <p className="bt-card-price">{p.pricing?.fixedPrice ? `₹${p.pricing.fixedPrice}` : `${p.purity || '22K'}`}</p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
