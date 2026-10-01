import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { AdminOrder, OrderStatus } from '../types';
import { PageTitle, Chip, StatusTag, Notice } from './ui';

const STATUSES: OrderStatus[] = ['new', 'confirmed', 'dispatched', 'cancelled'];

const label = (status: string) => status.charAt(0).toUpperCase() + status.slice(1);

export const AdminOrdersScreen: React.FC = () => {
  const [orders, setOrders] = useState<AdminOrder[] | null>(null);
  const [filter, setFilter] = useState<OrderStatus | 'all'>('all');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const load = useCallback(() => {
    if (document.hidden) return;
    api
      .getAdminOrders()
      .then((data) => {
        setOrders(data);
        setError(null);
        setUpdatedAt(new Date());
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
    setOrders((list) => list?.map((o) => (o.poId === order.poId ? { ...o, status } : o)) ?? null);
    try {
      await api.setOrderStatus(order.poId, status);
    } catch (err: any) {
      setOrders((list) => list?.map((o) => (o.poId === order.poId ? { ...o, status: previous } : o)) ?? null);
      if (!err.handled) alert(err.message || 'Could not update the order.');
    }
  };

  const visible = (orders ?? []).filter((o) => filter === 'all' || o.status === filter);
  const count = (s: OrderStatus) => (orders ?? []).filter((o) => o.status === s).length;

  return (
    <div className="flex flex-col w-full pb-32 max-w-2xl mx-auto">
      <PageTitle title="Orders" sub={`Every order from every buyer${updatedAt ? ` · updated ${updatedAt.toLocaleTimeString('en-IN', { hour12: false })}` : ''}`} />

      <div className="flex gap-2 overflow-x-auto px-5 pb-4">
        {(['all', ...STATUSES] as const).map((st) => (
          <Chip key={st} active={filter === st} onClick={() => setFilter(st)}>
            {st === 'all' ? `All ${orders?.length ?? 0}` : `${label(st)} ${count(st)}`}
          </Chip>
        ))}
      </div>

      <div className="px-5 flex flex-col gap-3">
        {error && <Notice tone="error">{error}</Notice>}
        {orders === null && !error && <p className="font-sans text-sm text-outline">Loading orders…</p>}

        {orders !== null && visible.length === 0 && (
          <div className="flex flex-col items-center text-center gap-2 pt-12">
            <span className="material-symbols-outlined text-[44px] text-primary-fixed-dim">inbox</span>
            <h3 className="font-serif text-[24px] text-primary">No orders here yet</h3>
            <p className="font-sans text-[15px] text-on-surface-variant">{filter === 'all' ? 'Orders placed by your buyers will appear here.' : `There are no ${filter} orders.`}</p>
          </div>
        )}

        {visible.map((order) => {
          const buyer = order.buyer;
          const isOpen = expanded === order.poId;
          return (
            <article key={order.poId} className="rounded-3xl bg-white border border-outline-variant p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="font-sans text-sm font-extrabold text-on-surface-variant truncate">{order.poId}</span>
                <StatusTag status={order.status} />
              </div>
              <h2 className="font-serif text-[22px] text-primary leading-tight mt-2 truncate">{order.firmName}</h2>
              <p className="font-sans text-sm text-on-surface-variant">
                {buyer?.marketHub ? `${buyer.marketHub} · ` : ''}
                {new Date(order.timestamp).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
              </p>

              <div className="flex items-end justify-between mt-3 gap-3">
                <div>
                  <span className="font-serif text-[28px] text-primary leading-none">{order.totalNetGrams.toFixed(3)} g</span>
                  <span className="font-sans text-sm text-on-surface-variant ml-2">
                    {order.itemCount} {order.itemCount === 1 ? 'item' : 'items'}
                  </span>
                </div>
                <label className="flex items-center gap-2 font-sans text-sm text-on-surface-variant">
                  <span className="sr-only">Status</span>
                  <select
                    value={order.status}
                    onChange={(e) => changeStatus(order, e.target.value as OrderStatus)}
                    className="h-11 bg-white border-[1.5px] border-outline-variant rounded-xl px-3 font-sans text-sm font-extrabold text-on-surface focus:outline-none focus:border-primary"
                  >
                    {STATUSES.map((st) => (
                      <option key={st} value={st}>
                        {label(st)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-outline-variant">
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : order.poId)}
                  aria-expanded={isOpen}
                  className="min-h-11 px-3 -ml-3 font-sans text-sm font-extrabold text-primary"
                >
                  {isOpen ? 'Hide items' : 'View items'}
                </button>
                {buyer && (
                  <a href={`tel:${buyer.phone}`} className="min-h-11 px-3 -mr-3 flex items-center font-sans text-sm font-extrabold text-primary">
                    Call {buyer.ownerName || 'buyer'} · {buyer.phone}
                  </a>
                )}
              </div>

              {isOpen && (
                <ul className="mt-1 flex flex-col gap-3 pt-3 border-t border-outline-variant">
                  {order.items.map((item) => (
                    <li key={item.id} className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-sans text-[15px] font-bold text-on-surface truncate">{item.title}</p>
                        <p className="font-sans text-sm text-on-surface-variant">
                          {item.sku} · {item.purity}
                        </p>
                      </div>
                      <div className="text-right whitespace-nowrap">
                        <p className="font-sans text-[15px] font-extrabold text-primary">{item.totalNetGold.toFixed(3)} g</p>
                        <p className="font-sans text-sm text-on-surface-variant">
                          {item.batchQty} {item.qtyUnit}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
};
