import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { AdminOrder, OrderStatus } from '../types';
import { I, Notice, StatusTag } from './ui';

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
    <div className="scroll" style={{ gap: 12 }}>
      <div className="chips">
        {(['all', ...STATUSES] as const).map((st) => (
          <button key={st} type="button" className={`chip${filter === st ? ' on' : ''}`} aria-pressed={filter === st} onClick={() => setFilter(st)}>
            {st === 'all' ? `All ${orders?.length ?? 0}` : `${label(st)} ${count(st)}`}
          </button>
        ))}
      </div>

      {error && <Notice tone="error">{error}</Notice>}
      {orders === null && !error && <p className="hint">Loading orders…</p>}

      {orders !== null && visible.length === 0 && (
        <div className="col" style={{ alignItems: 'center', textAlign: 'center', paddingTop: 32, gap: 8 }}>
          <span className="tag gold" style={{ width: 56, height: 56, borderRadius: 18, justifyContent: 'center', padding: 0 }}>
            <I n="receipt" />
          </span>
          <h2 style={{ fontSize: 24 }}>No orders here yet</h2>
          <p className="sub">{filter === 'all' ? 'Orders placed by your buyers will appear here.' : `There are no ${filter} orders.`}</p>
        </div>
      )}

      {visible.map((order) => {
        const buyer = order.buyer;
        const wa = buyer?.phone ? `https://wa.me/${buyer.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hello ${order.firmName}, about your order ${order.poId}.`)}` : null;
        return (
          <article key={order.poId} className="card col" style={{ gap: 8, opacity: order.status === 'cancelled' ? 0.7 : 1 }}>
            <div className="row">
              <div className="grow">
                <b>{order.firmName}</b>
                <p className="sub" style={{ fontSize: 13 }}>
                  {buyer?.phone ? `${buyer.phone} · ` : ''}
                  {order.poId} · {ago(order.timestamp)}
                </p>
              </div>
              <StatusTag status={order.status} />
            </div>
            {order.items.map((item) => (
              <div key={item.id} className="kv">
                <span>
                  {item.title} × {item.batchQty}
                </span>
                <b>{item.totalNetGold.toFixed(3)} g</b>
              </div>
            ))}
            {order.items.length > 1 && (
              <>
                <hr className="sep" />
                <div className="kv">
                  <span>Total net weight</span>
                  <b>{order.totalNetGrams.toFixed(3)} g</b>
                </div>
              </>
            )}
            {order.status === 'new' && (
              <div className="row">
                <button type="button" className="btn sm" style={{ flex: 1 }} onClick={() => changeStatus(order, 'confirmed')}>
                  Confirm order
                </button>
                {wa && (
                  <a className="btn sm alt" href={wa} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp the buyer">
                    <I n="whats" />
                  </a>
                )}
              </div>
            )}
            {order.status === 'confirmed' && (
              <div className="row">
                <button type="button" className="btn sm soft" style={{ flex: 1 }} onClick={() => changeStatus(order, 'dispatched')}>
                  Mark dispatched
                </button>
                <button type="button" className="btn sm alt danger" onClick={() => askCancel(order)}>
                  {confirming === order.poId ? 'Tap again' : 'Cancel'}
                </button>
              </div>
            )}
            {(order.status === 'dispatched' || order.status === 'cancelled') && buyer?.phone && (
              <a className="lnk" style={{ minHeight: 32 }} href={`tel:${buyer.phone}`}>
                <I n="phone" size="s" />
                Call {buyer.ownerName || 'buyer'}
              </a>
            )}
          </article>
        );
      })}
    </div>
  );
};
