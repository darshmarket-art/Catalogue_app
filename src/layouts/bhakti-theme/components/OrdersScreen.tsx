import React, { useState } from 'react';
import type { OrderItem } from '../types';
import { Icon } from './ui';

interface OrdersScreenProps {
  orders: OrderItem[];
  onRemoveItem: (id: string) => void;
  onChangeQty: (id: string, batchQty: number) => void;
  onConfirmOrder: (note?: string) => Promise<{ poId: string; totalNetGrams: number; whatsappMessage: string } | null>;
  onGenerateWhatsAppPO: (note?: string) => void;
  onNavigateCatalogue: () => void;
  initialTab?: 'current' | 'past';
}

export const OrdersScreen: React.FC<OrdersScreenProps> = ({ orders }) => {
  const currentOrders = orders.filter((o) => !o.past);
  const pastOrders = orders.filter((o) => o.past);

  return (
    <div className="bt-page">
      <h2 className="bt-h2" style={{ padding: '0 20px', marginBottom: 20 }}>Orders</h2>

      {/* Current Orders */}
      <div className="bt-pad">
        <div className="bt-ey bt-mb-3">{currentOrders.length} active order{currentOrders.length !== 1 ? 's' : ''}</div>
        {currentOrders.length === 0 ? (
          <div className="bt-empty">
            <Icon n="package" />
            <h3>No active orders</h3>
            <p>Your cart is empty. Browse the catalogue to add designs.</p>
          </div>
        ) : (
          currentOrders.map((order) => (
            <div key={order.id} className="bt-card bt-mb-3">
              <div className="bt-flex bt-flex-between bt-mb-2">
                <span className="bt-ey bt-mb-2">Order #{order.poId || order.id.substring(0, 8)}</span>
                <span className="bt-pill" style={{ background: 'var(--bt-accent)', color: '#fff', fontSize: 10 }}>
                  {order.status || 'New'}
                </span>
              </div>
              {order.items?.map((item) => (
                <div key={item.id} className="bt-flex bt-flex-between bt-mb-2">
                  <span>{item.name}</span>
                  <span>{item.qty} x {(item.netWt ?? 0).toFixed(3)}g = {(item.netWt ? item.netWt * item.qty : 0).toFixed(3)}g</span>
                </div>
              ))}
              <div className="bt-flex bt-flex-between" style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--bt-line)' }}>
                <span className="bt-ey">Total net weight:</span>
                <span className="bt-ey" style={{ fontWeight: 600, color: 'var(--bt-accent)' }}>
                  {order.totalNetGrams?.toFixed(3) || '0'}g
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Past Orders */}
      {pastOrders.length > 0 && (
        <>
          <div className="bt-pad" style={{ marginTop: 24 }}>
            <div className="bt-ey bt-mb-3">Past Orders</div>
          </div>

          <div className="bt-pad">
            {pastOrders.map((order) => (
              <div key={order.id} className="bt-card bt-mb-3">
                <div className="bt-flex bt-flex-between">
                  <span className="bt-ey">Order #{order.poId?.substring(0, 8) || order.id.substring(0, 8)}</span>
                  <span className="bt-ey bt-mb-2">{order.status || 'Completed'}</span>
                </div>
                <div className="bt-flex bt-flex-between" style={{ marginTop: 8 }}>
                  <span className="bt-mut">{new Date(order.createdAt || '').toLocaleDateString()}</span>
                  <span className="bt-ey" style={{ fontWeight: 600 }}>
                    {order.totalNetGrams?.toFixed(3) || '0'}g
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
