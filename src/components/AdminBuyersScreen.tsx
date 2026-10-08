import React, { useEffect, useState } from 'react';
import { BuyerRow } from '../types';
import { api } from '../api';
import { usePlan, upgradeNotice } from '../plan';
import { Notice } from './ui';
import { Icon, OrderStatusPill, Sheet } from '../layouts/emergent/ui';
import type { AdminOrder, EnquiryRow } from '../types';

/** Buyers (artboard 3.5 on Pro; 4.3 on Basic, with the 50-buyer meter). */
/** One buyer's card: who they are, their orders and enquiries (when the plan has them), and the ways to reach or remove them. */
const BuyerSheet: React.FC<{ buyer: BuyerRow; removing: boolean; busy: boolean; onRemove: () => void; onClose: () => void }> = ({ buyer, removing, busy, onRemove, onClose }) => {
  const { flags } = usePlan();
  const [orders, setOrders] = useState<AdminOrder[] | null>(null);
  const [enquiries, setEnquiries] = useState<EnquiryRow[] | null>(null);
  const digits = buyer.phone.replace(/[^0-9]/g, '').replace(/^(\d{10})$/, '91$1');
  useEffect(() => {
    if (flags.orders) api.getAdminOrders().then((all) => setOrders(all.filter((o) => o.buyer?.phone === buyer.phone))).catch(() => setOrders([]));
    if (flags.enquiries) api.getEnquiries().then((all) => setEnquiries(all.filter((e) => e.buyerPhone === buyer.phone))).catch(() => setEnquiries([]));
  }, [buyer.phone, flags.orders, flags.enquiries]);
  return (
    <Sheet label={buyer.firmName} onClose={onClose}>
      <div className="em-row" style={{ gap: 14 }}>
        <div className="em-av" style={{ width: 52, height: 52 }}>{buyer.firmName.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?'}</div>
        <div className="em-grow">
          <div className="em-ser" style={{ fontSize: 21 }}>{buyer.firmName}</div>
          <div className="em-mut" style={{ fontSize: 12.5 }}>{[buyer.ownerName && buyer.ownerName !== buyer.firmName ? buyer.ownerName : '', buyer.marketHub].filter(Boolean).join(' · ') || buyer.phone}</div>
        </div>
      </div>
      {orders && orders.length > 0 && (
        <div className="em-card" data-testid="buyer-orders">
          <b style={{ fontWeight: 600 }}>Orders</b>
          {orders.slice(0, 5).map((o) => (
            <div key={o.poId} className="em-row em-sb" style={{ marginTop: 6, fontSize: 13 }}>
              <span>{o.poId} · {o.items.length} {o.items.length === 1 ? 'design' : 'designs'}</span>
              <OrderStatusPill status={o.status} />
            </div>
          ))}
        </div>
      )}
      {enquiries && enquiries.length > 0 && (
        <div className="em-card" data-testid="buyer-enquiries">
          <b style={{ fontWeight: 600 }}>WhatsApp enquiries</b>
          {enquiries.slice(0, 5).map((e) => (
            <div key={e.id} style={{ marginTop: 6, fontSize: 13 }}>{e.kind === 'design' ? `Asked about ${e.title ?? 'a design'}` : e.kind === 'shortlist' ? `Sent a shortlist${e.count ? ` of ${e.count}` : ''}` : `Sent an order${e.count ? ` of ${e.count} items` : ''}`}</div>
          ))}
        </div>
      )}
      <div className="em-row" style={{ gap: 10 }}>
        <a className="em-btn sec fl" href={`tel:+${digits}`}><Icon n="phone" size={18} />Call</a>
        <a className="em-btn wa fl" href={`https://wa.me/${digits}`} target="_blank" rel="noopener noreferrer"><Icon n="wa" size={18} />WhatsApp</a>
      </div>
      <button type="button" className="em-btn danger" data-testid="buyer-sheet-remove" disabled={busy} onClick={onRemove}>
        {removing ? `Tap again to remove ${buyer.firmName}` : 'Remove buyer'}
      </button>
    </Sheet>
  );
};

export const AdminBuyersScreen: React.FC = () => {
  const [sheetFor, setSheetFor] = useState<BuyerRow | null>(null);
  const { limits } = usePlan();
  const [buyers, setBuyers] = useState<BuyerRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [busyPhone, setBusyPhone] = useState<string | null>(null);
  // Removing takes two taps, so a stray tap cannot remove a buyer.
  const [removing, setRemoving] = useState<string | null>(null);

  const load = () =>
    api
      .getBuyers()
      .then(setBuyers)
      .catch((e) => setError(e.message));

  useEffect(() => {
    load();
  }, []);

  const handleRemove = async (buyer: BuyerRow) => {
    if (removing !== buyer.phone) {
      setRemoving(buyer.phone);
      setTimeout(() => setRemoving((p) => (p === buyer.phone ? null : p)), 4000);
      return;
    }
    setRemoving(null);
    setBusyPhone(buyer.phone);
    setError(null);
    try {
      await api.removeBuyer(buyer.phone);
      setSheetFor(null);
      setBuyers((list) => list?.filter((b) => b.phone !== buyer.phone) ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not remove the buyer.');
    } finally {
      setBusyPhone(null);
    }
  };

  const q = query.trim().toLowerCase();
  const shown = (buyers ?? []).filter((b) => !q || b.firmName.toLowerCase().includes(q) || b.phone.includes(q));
  const count = buyers?.length ?? 0;
  const cap = limits.users;
  const left = cap === null ? null : cap - count;
  const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
  const online = (iso: string | null) => !!iso && Date.now() - new Date(iso).getTime() < 120000;
  const seen = (iso: string | null) => (!iso ? '' : online(iso) ? ' · online now' : new Date(iso).toDateString() === new Date().toDateString() ? ' · Seen today' : ' · seen ' + new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }));
  const joined = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="scroll" style={{ gap: 10 }}>
      {cap !== null ? (
        <>
          <div className="card" style={{ padding: '12px 16px' }}>
            <div className="kv">
              <span>Buyers</span>
              <b>
                {count} of {cap}
              </b>
            </div>
            <div className={`meter${count >= cap ? ' over' : ''}`} style={{ marginTop: 8 }}>
              <i style={{ width: `${Math.min(100, Math.round((count / cap) * 100))}%` }} />
            </div>
          </div>
          {left !== null && left <= 10 && (
            <div className="note warn">
              <b>{left > 0 ? `${left} ${left === 1 ? 'place' : 'places'} left.` : 'The catalogue is full.'}</b> At {cap}, a new number sees "catalogue full" and no code is sent. Buyers already signed up always get in. Upgrade to Pro for unlimited buyers.
            </div>
          )}
        </>
      ) : (
        <p className="sub">Buyers sign in with a WhatsApp code. If a buyer used a password before and forgot it, give them a temporary one.</p>
      )}

      <div className="inp-icon" style={{ marginTop: 4 }}>
        <Icon n="search" size={16} />
        <input className="inp" style={{ height: 46 }} type="search" aria-label="Search shop or phone" placeholder="Search shop or phone" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      {error && <Notice tone="error">{error}</Notice>}
      {buyers === null && !error && <p className="hint" style={{ textAlign: 'center' }}>Loading…</p>}
      {buyers?.length === 0 && <p className="sub" style={{ textAlign: 'center', padding: '24px 0' }}>No buyers have signed up yet.</p>}

      <div data-testid="buyer-list">
        {shown.map((b, i) => (
          <div key={b.phone} className="em-row em-buyer" style={{ gap: 14, padding: '16px 0', borderBottom: i < shown.length - 1 ? '1px solid var(--em-line)' : 0 }}>
            <button type="button" className="em-row" data-testid="buyer-open" onClick={() => setSheetFor(b)} aria-label={`Open ${b.firmName}`} style={{ gap: 14, flex: 1, minWidth: 0, padding: 0, border: 0, background: 'none', font: 'inherit', color: 'inherit', textAlign: 'left', cursor: 'pointer' }}>
            <div className="em-av" style={{ position: "relative" }}>
              {initials(b.firmName)}
              {online(b.lastSeen) && <span data-testid="buyer-online" aria-label="online" style={{ position: "absolute", right: -1, bottom: -1, width: 10, height: 10, borderRadius: 5, background: "var(--em-ok, #2f8f5b)", border: "2px solid var(--em-card, #fff)" }} />}
            </div>
            <div className="em-grow">
              <div className="em-ser em-clip" style={{ fontSize: 16 }}>
                {b.firmName}
              </div>
              <div className="em-mut" style={{ fontSize: 11, marginTop: 2 }}>
                {b.phone} · joined {joined(b.createdAt)}
                {seen(b.lastSeen)}
              </div>
              <div className="em-mut" style={{ fontSize: 11, marginTop: 2 }} data-testid="buyer-contact">
                {[b.ownerName && b.ownerName !== b.firmName ? `Contact: ${b.ownerName}` : '', b.marketHub ? `Hub: ${b.marketHub}` : '', b.gstin && b.gstin !== 'PENDING-VERIFY' ? `GSTIN ${b.gstin}` : ''].filter(Boolean).join(' · ')}
              </div>
            </div>
            </button>
            <div className="em-row" style={{ gap: 6, flexDirection: 'column', alignItems: 'stretch' }}>
              <a className="em-rm n" href={`tel:+${b.phone.replace(/[^0-9]/g, '').replace(/^([0-9]{10})$/, '91$1')}`} style={{ textAlign: 'center', textDecoration: 'none' }}>
                Call
              </a>
              <a className="em-rm n" href={`https://wa.me/${b.phone.replace(/[^0-9]/g, '').replace(/^(\d{10})$/, '91$1')}`} target="_blank" rel="noopener noreferrer" style={{ textAlign: 'center', textDecoration: 'none' }}>
                WhatsApp
              </a>
              <button type="button" data-testid={`remove-buyer-${b.phone}`} className="em-rm" disabled={busyPhone === b.phone} onClick={() => handleRemove(b)}>
                {removing === b.phone ? 'Tap again' : 'Remove'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {sheetFor && <BuyerSheet buyer={sheetFor} removing={removing === sheetFor.phone} busy={busyPhone === sheetFor.phone} onRemove={() => handleRemove(sheetFor)} onClose={() => setSheetFor(null)} />}

      {cap === null ? (
        <div className="note ok row">
          <Icon n="okc" size={16} />
          <span>Pro: unlimited buyers.</span>
        </div>
      ) : (
        <button type="button" className="btn alt" onClick={() => upgradeNotice('Unlimited buyers')}>
          <Icon n="award" size={18} />
          Unlimited buyers with Pro
        </button>
      )}
    </div>
  );
};
