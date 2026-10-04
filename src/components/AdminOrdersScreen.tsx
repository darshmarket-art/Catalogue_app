import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { AdminOrder, OrderStatus } from '../types';
import { Notice } from './ui';
import { Icon, OrderStatusPill } from '../layouts/emergent/ui';

const STATUSES: OrderStatus[] = ['new', 'confirmed', 'dispatched', 'cancelled'];
const label = (status: string) => status.charAt(0).toUpperCase() + status.slice(1);
const ago = (iso: string) => {
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  return days < 1 ? 'today' : days === 1 ? 'yesterday' : days < 7 ? `${days} days ago` : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

/** Orders desk (artboard 3.2): every buyer's orders, moved along with one tap. */
export const AdminOrdersScreen: React.FC = () => {
  const [orders, setOrders] = useState<AdminOrder[] | null>(null);
  const [filter, setFilter] = useState<OrderStatus | 'all'>('all');
  const [error, setError] = useState<string | null>(null);
  // Cancelling takes two taps, so a stray tap cannot cancel an order.
  const [confirming, setConfirming] = useState<string | null>(null);

  const load = useCallback(() => {
    if (document.hidden) return;
    api
      .getAdminOrders()
      .then((data) => {
        setOrders(data);
        setError(null);
      })
      .catch((err) => {
        if (!err.handled) setError(err.message || 'Could not load orders.');
      });
  }, []);

  // Same rhythm as the Admin Hub: load on open, then refresh every 15 seconds while the tab is visible.
  useEffect(() => {
    load();
    const interval = setInterval(load, 15000);
    document.addEventListener('visibilitychange', load);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', load);
    };
  }, [load]);

  const changeStatus = async (order: AdminOrder, status: OrderStatus) => {
    const previous = order.status;
    setConfirming(null);
    setOrders((list) => list?.map((o) => (o.poId === order.poId ? { ...o, status } : o)) ?? null);
    try {
      await api.setOrderStatus(order.poId, status);
    } catch (err: any) {
      setOrders((list) => list?.map((o) => (o.poId === order.poId ? { ...o, status: previous } : o)) ?? null);
      if (!err.handled) setError(err.message || 'Could not update the order.');
    }
  };

  const askCancel = (order: AdminOrder) => {
    if (confirming === order.poId) return void changeStatus(order, 'cancelled');
    setConfirming(order.poId);
    setTimeout(() => setConfirming((c) => (c === order.poId ? null : c)), 4000);
  };

  const visible = (orders ?? []).filter((o) => filter === 'all' || o.status === filter);
  const count = (s: OrderStatus) => (orders ?? []).filter((o) => o.status === s).length;

  return (
    <div className="scroll" style={{ gap: 14 }}>
      <div className="em-ser" data-testid="orders-count" style={{ fontSize: 22 }}>
        {orders?.length ?? 0} {orders?.length === 1 ? 'order' : 'orders'}
      </div>
      <div className="chips">
        {(['all', ...STATUSES] as const).map((st) => (
          <button key={st} type="button" className={`chip${filter === st ? ' on' : ''}`} aria-pressed={filter === st} onClick={() => setFilter(st)}>
            {st === 'all' ? 'All' : label(st)} <i>{st === 'all' ? (orders?.length ?? 0) : count(st)}</i>
          </button>
        ))}
      </div>

      {error && <Notice tone="error">{error}</Notice>}
      {orders === null && !error && <p className="hint">Loading orders…</p>}

      {orders !== null && visible.length === 0 && (
        <div className="em-empty" style={{ paddingTop: 24 }}>
          <span className="em-badge">
            <Icon n="package" size={24} />
          </span>
          <h2 className="em-ser" style={{ fontSize: 24 }}>
            No orders here yet
          </h2>
          <p className="sub">{filter === 'all' ? 'Orders placed by your buyers will appear here.' : `There are no ${filter} orders.`}</p>
        </div>
      )}

      {visible.map((order) => {
        const buyer = order.buyer;
        const wa = buyer?.phone ? `https://wa.me/${buyer.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hello ${order.firmName}, about your order ${order.poId}.`)}` : null;
        const waCircle = wa && (
          <a className="em-wacirc" href={wa} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp the buyer">
            <Icon n="wa" size={18} />
          </a>
        );
        return (
          <article key={order.poId} className="em-ordcard" style={{ opacity: order.status === 'cancelled' ? 0.7 : 1 }}>
            <div className="in">
              <div className="em-row em-sb" style={{ alignItems: 'flex-start', gap: 10 }}>
                <div className="em-grow">
                  <div className="em-ser" style={{ fontSize: 19 }}>
                    {order.firmName}
                  </div>
                  <div className="em-mut" style={{ fontSize: 12, marginTop: 4 }}>
                    {buyer?.phone ? `${buyer.phone} · ` : ''}
                    {order.poId} · {ago(order.timestamp)}
                  </div>
                </div>
                <OrderStatusPill status={order.status} />
              </div>
              <hr className="em-line" />
              {order.items.map((item) => (
                <div key={item.id} className="li">
                  <span>
                    {item.title} <span className="em-mut">× {item.batchQty}</span>
                  </span>
                  <span className="em-mut">{item.totalNetGold.toFixed(3)} g</span>
                </div>
              ))}
              {order.note && (
                <p className="note" data-testid="order-note" style={{ marginTop: 8 }}>
                  <b>Note:</b> {order.note}
                </p>
              )}
              <div className="em-row em-sb" style={{ marginTop: 12 }}>
                <span className="em-ey">Net total</span>
                <span className="em-ser" style={{ fontSize: 19, color: 'var(--em-primary)' }}>
                  {order.totalNetGrams.toFixed(3)} g
                </span>
              </div>
            </div>
            {order.status === 'new' && (
              <div className="ft">
                <button type="button" className="em-btn" onClick={() => changeStatus(order, 'confirmed')}>
                  <Icon n="check" size={18} />
                  Confirm order
                </button>
                {waCircle}
              </div>
            )}
            {order.status === 'confirmed' && (
              <div className="ft">
                <button type="button" className="em-btn" onClick={() => changeStatus(order, 'dispatched')}>
                  <Icon n="truck" size={18} />
                  Mark dispatched
                </button>
                {waCircle}
                <button type="button" className="em-rm" onClick={() => askCancel(order)}>
                  {confirming === order.poId ? 'Tap again' : 'Cancel'}
                </button>
              </div>
            )}
            {(order.status === 'dispatched' || order.status === 'cancelled') && buyer?.phone && (
              <div className="ft">
                <a className="em-link" href={`tel:${buyer.phone}`}>
                  <Icon n="phone" size={16} />
                  Call {buyer.ownerName || 'buyer'}
                </a>
                <span className="em-grow" />
                {waCircle}
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
};
