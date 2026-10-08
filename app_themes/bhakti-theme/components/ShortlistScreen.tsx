import React, { useState } from 'react';
import type { Product, Purity, Category } from '../types';
import { Icon } from './ui';

interface ShortlistScreenProps {
  products: Product[];
  shortlist: string[];
  storeName: string;
  purities: Purity[];
  categories: Category[];
  onAddToOrder: (product: Product, quantity: number, purity?: string) => void;
  onRemove: (product: Product) => void;
  onAddAllToOrder: (items: Product[]) => Promise<void>;
  onBrowse: () => void;
}

export const ShortlistScreen: React.FC<ShortlistScreenProps> = ({
  products,
  shortlist,
  onAddToOrder,
  onRemove,
}) => {
  const heartedProducts = products.filter((p) => shortlist.includes(p.sku));

  const handleAdd = (prod: Product) => {
    onAddToOrder(prod, 1);
  };

  return (
    <div className="bt-page">
      <h2 className="bt-h2" style={{ padding: '0 20px', marginBottom: 20 }}>Shortlist</h2>

      {heartedProducts.length === 0 ? (
        <div className="bt-empty">
          <Icon name="heart" />
          <h3>Your shortlist is empty</h3>
          <p>Browse the catalogue and save designs you like</p>
          <button type="button" onClick={() => onBrowse()} style={{ marginTop: 20, color: 'var(--bt-accent)', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer' }}>
            Browse Catalogue
          </button>
        </div>
      ) : (
        <>
          <div className="bt-pad" style={{ marginBottom: 16 }}>
            <div className="bt-ey">{heartedProducts.length} design{heartedProducts.length !== 1 ? 's' : ''} saved</div>
          </div>

          <div className="bt-grid">
            {heartedProducts.map((p) => (
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
                  className="bt-card-fav bt-fav-on"
                  onClick={() => onRemove(p)}
                  aria-label="Remove from shortlist"
                >
                  <Icon name="heart" fill />
                </button>
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
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
