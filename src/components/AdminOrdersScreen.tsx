import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { AdminOrder, OrderStatus } from '../types';

const STATUSES: OrderStatus[] = ['new', 'confirmed', 'dispatched', 'cancelled'];

const STATUS_STYLE: Record<OrderStatus, string> = {
  new: 'bg-primary-fixed text-on-tertiary-fixed',
  confirmed: 'bg-secondary-fixed text-on-secondary-fixed',
  dispatched: 'bg-secondary text-white',
  cancelled: 'bg-error-container text-error'
};

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
    <div className="flex flex-col w-full pb-32 max-w-xl mx-auto px-4 pt-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <span className="font-mono text-[10px] text-primary font-bold tracking-wider uppercase">Order Desk</span>
          <h1 className="font-serif text-[22px] font-bold text-on-surface tracking-tight">Orders</h1>
        </div>
        <button
          type="button"
          onClick={load}
          className="px-2.5 py-1 rounded bg-surface-container text-on-surface-variant font-sans text-xs font-semibold flex items-center gap-1 hover:bg-surface-container-high"
        >
          <span className="material-symbols-outlined text-[15px]">refresh</span>
          Refresh
        </button>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {(['all', ...STATUSES] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilter(s)}
            className={`px-3 py-1 rounded-full font-sans text-xs font-semibold whitespace-nowrap border transition-colors ${
              filter === s
                ? 'bg-primary text-white border-primary'
                : 'bg-white text-on-surface-variant border-outline-variant/50 hover:bg-surface-container-low'
            }`}
          >
            {s === 'all' ? `All (${orders?.length ?? 0})` : `${label(s)} (${count(s)})`}
          </button>
        ))}
      </div>

      <p className="font-sans text-[11px] text-outline">
        Refreshes every 15 seconds{updatedAt ? ` • updated ${updatedAt.toLocaleTimeString('en-IN', { hour12: false })}` : ''}
      </p>

      {error && (
        <div className="bg-error-container text-error p-3 rounded-xl text-xs font-sans border border-error/30">{error}</div>
      )}

      {orders === null && !error && <p className="text-xs text-outline font-sans">Loading orders…</p>}

      {orders !== null && visible.length === 0 && (
        <div className="bg-white rounded-xl p-8 text-center border border-outline-variant/40 shadow-xs">
          <span className="material-symbols-outlined text-4xl text-outline mb-2">inbox</span>
          <h3 className="font-serif text-base font-bold text-on-surface">No orders here yet</h3>
          <p className="text-xs text-outline mt-1">
            {filter === 'all' ? 'Orders placed by your buyers will appear here.' : `There are no ${filter} orders.`}
          </p>
        </div>
      )}

      {visible.map((order) => {
        const buyer = order.buyer;
        const isOpen = expanded === order.poId;
        return (
          <div key={order.poId} className="bg-white rounded-xl shadow-xs border border-outline-variant/40 overflow-hidden">
            <div className="p-3.5 flex flex-col gap-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <span className="font-mono text-[11px] font-bold text-primary">{order.poId}</span>
                  <h3 className="font-serif text-[15px] font-bold text-on-surface leading-tight truncate">{order.firmName}</h3>
                  <span className="font-sans text-[11px] text-outline">
                    {new Date(order.timestamp).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                  </span>
                </div>
                <span className={`px-2 py-0.5 rounded-full font-mono text-[10px] font-bold uppercase tracking-wider ${STATUS_STYLE[order.status]}`}>
                  {order.status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="bg-surface-container-low rounded-lg p-2">
                  <span className="text-[9px] uppercase font-bold tracking-wider text-outline block">Net weight</span>
                  <span className="font-mono text-sm font-bold text-primary">{order.totalNetGrams.toFixed(3)} g</span>
                </div>
                <div className="bg-surface-container-low rounded-lg p-2">
                  <span className="text-[9px] uppercase font-bold tracking-wider text-outline block">Items</span>
                  <span className="font-mono text-sm font-bold text-on-surface">{order.itemCount}</span>
                </div>
              </div>

              {buyer && (
                <div className="flex items-center justify-between gap-2 text-xs font-sans text-on-surface-variant">
                  <span className="truncate">
                    {buyer.ownerName}
                    {buyer.marketHub ? ` • ${buyer.marketHub}` : ''}
                  </span>
                  <a
                    href={`tel:${buyer.phone}`}
                    className="flex items-center gap-1 text-secondary font-semibold whitespace-nowrap"
                  >
                    <span className="material-symbols-outlined text-[15px]">call</span>
                    {buyer.phone}
                  </a>
                </div>
              )}

              <div className="flex items-center justify-between gap-2 pt-1 border-t border-surface-container">
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : order.poId)}
                  className="text-xs font-sans font-semibold text-primary flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[16px]">{isOpen ? 'expand_less' : 'expand_more'}</span>
                  {isOpen ? 'Hide items' : 'View items'}
                </button>
                <label className="flex items-center gap-1.5 text-xs font-sans text-outline">
                  Status
                  <select
                    value={order.status}
                    onChange={(e) => changeStatus(order, e.target.value as OrderStatus)}
                    className="bg-surface-container-low border border-outline-variant/50 rounded-lg px-2 py-1 text-xs font-semibold text-on-surface"
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {label(s)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            {isOpen && (
              <div className="bg-surface-container-low border-t border-outline-variant/30 divide-y divide-outline-variant/20">
                {order.items.map((item) => (
                  <div key={item.id} className="px-3.5 py-2 flex items-center justify-between gap-2 text-xs font-sans">
                    <div className="min-w-0">
                      <span className="font-bold text-on-surface block truncate">{item.title}</span>
                      <span className="font-mono text-[10px] text-outline">
                        {item.sku} • {item.purity}
                      </span>
                    </div>
                    <div className="text-right whitespace-nowrap">
                      <span className="font-mono font-bold text-primary block">{item.totalNetGold.toFixed(3)} g</span>
                      <span className="font-mono text-[10px] text-outline">
                        {item.batchQty} {item.qtyUnit}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
