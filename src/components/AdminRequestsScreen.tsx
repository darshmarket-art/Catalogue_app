import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { merchant } from '../merchant';
import { errorText } from '../bugReport';
import { Notice, Segmented } from './ui';
import type { ClientRequest, RequestStatus } from '../../shared/requests';

const KIND: Record<ClientRequest['kind'], string> = { viewing: 'Private viewing', bespoke: 'Bespoke', reserve: 'Reserve' };
const when = (iso: string) => new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const waNumber = (phone: string) => { const d = phone.replace(/\D/g, ''); return d.length === 10 ? `91${d}` : d; };

/** What the request asks, in one or two plain lines. */
function summary(r: ClientRequest): string[] {
  if (r.kind === 'viewing') return [`${r.date} at ${r.time}, ${r.where === 'video' ? 'on a video call' : 'in the boutique'}`, ...(r.occasion ? [`Occasion: ${r.occasion}`] : [])];
  if (r.kind === 'bespoke') return [[r.piece, r.metal, r.stones?.join(', ')].filter(Boolean).join(' · '), ...[r.occasion && `Occasion: ${r.occasion}`, r.neededBy && `Needed by: ${r.neededBy}`, r.budget && `Budget: ${r.budget}`].filter((x): x is string => Boolean(x))];
  const left = r.expiresAt ? Math.round((Date.parse(r.expiresAt) - Date.now()) / 3600_000) : 0;
  return [left > 0 ? `Hold until ${when(r.expiresAt!)} (${left} h left)` : 'The 48 hours have passed'];
}

const reply = (r: ClientRequest) => {
  const about = r.kind === 'viewing' ? `your private viewing on ${r.date} at ${r.time}` : r.kind === 'bespoke' ? `your bespoke ${String(r.piece ?? 'piece').toLowerCase()}` : `your request to reserve ${r.pieces[0]?.title ?? 'a piece'}`;
  return `https://wa.me/${waNumber(r.clientPhone)}?text=${encodeURIComponent(`Hello ${r.clientName}, this is ${merchant.brand.name} about ${about}.`)}`;
};

/**
 * Client requests: private viewings, bespoke pieces and 48-hour reserves, from first message to done. The owner replies on WhatsApp and moves
 * each one along; "Waiting" is what nobody has answered yet (the count on Today).
 */
export const AdminRequestsScreen: React.FC<{ onChanged?: () => void }> = ({ onChanged }) => {
  const [rows, setRows] = useState<ClientRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'new' | 'confirmed' | 'closed'>('new');
  const [busy, setBusy] = useState<string | null>(null);
  const load = () => api.adminRequests().then(setRows).catch((e) => setError(errorText(e, 'AdminRequestsScreen')));
  useEffect(() => { void load(); }, []);

  const move = async (r: ClientRequest, status: RequestStatus) => {
    setBusy(r.id);
    setError(null);
    try {
      const next = await api.setRequestStatus(r.id, status);
      setRows((list) => (list ?? []).map((x) => (x.id === r.id ? { ...x, ...next } : x)));
      onChanged?.();
    } catch (e) {
      setError(errorText(e, 'AdminRequestsScreen status', 'Could not update the request.'));
    }
    setBusy(null);
  };

  if (!rows && !error) return <div className="scroll no-tabs" style={{ gap: 12 }}><div className="card em-skel" style={{ height: 120 }} /><div className="card em-skel" style={{ height: 120 }} /></div>;
  const all = rows ?? [];
  const count = { new: all.filter((r) => r.status === 'new').length, confirmed: all.filter((r) => r.status === 'confirmed').length, closed: all.filter((r) => r.status === 'done' || r.status === 'declined').length };
  const shown = all.filter((r) => (tab === 'closed' ? r.status === 'done' || r.status === 'declined' : r.status === tab));

  return (
    <div className="scroll no-tabs" style={{ gap: 12 }} data-testid="admin-requests">
      <p className="sub">Private viewings, bespoke requests and 48-hour reserves from your clients. Reply on WhatsApp, then move each one along.</p>
      <Segmented options={[{ key: 'new', label: `Waiting (${count.new})` }, { key: 'confirmed', label: `Confirmed (${count.confirmed})` }, { key: 'closed', label: `Closed (${count.closed})` }]} value={tab} onChange={(k) => setTab(k as typeof tab)} />
      {error && <Notice tone="error">{error}</Notice>}
      {shown.length === 0 && <div className="card" data-testid="requests-empty"><b style={{ fontWeight: 600 }}>{tab === 'new' ? 'Nothing is waiting.' : 'Nothing here yet.'}</b> <span className="em-mut">{tab === 'new' ? 'New requests from the store appear here and on Today.' : ''}</span></div>}
      {shown.map((r) => (
        <article key={r.id} className="card col" style={{ gap: 8 }} data-testid="request-card">
          <div className="em-row em-sb" style={{ gap: 10 }}>
            <span className="tag gold">{KIND[r.kind]}</span>
            <span className="em-mut" style={{ fontSize: '0.75rem' }}>{when(r.createdAt)}</span>
          </div>
          <div>
            <b style={{ fontWeight: 600, fontSize: '1.0625rem' }}>{r.clientName}</b>
            <span className="em-mut"> · {r.firmName ? r.firmName : 'Visitor'} · {r.clientPhone}</span>
          </div>
          {summary(r).map((line) => <div key={line}>{line}</div>)}
          {r.note && <div className="em-mut">“{r.note}”</div>}
          {r.pieces.length > 0 && <div className="em-mut" style={{ fontSize: '0.875rem' }}>{r.kind === 'viewing' ? 'To lay out: ' : 'Pieces: '}{r.pieces.map((p) => `${p.title} (${p.sku})`).join(', ')}</div>}
          <div className="em-row" style={{ gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
            <a className="em-btn sec" style={{ minHeight: 42, padding: '8px 16px', fontSize: '0.8125rem' }} href={reply(r)} target="_blank" rel="noopener noreferrer" data-testid="request-reply">Reply on WhatsApp</a>
            {r.status === 'new' && <button type="button" className="em-btn" style={{ minHeight: 42, padding: '8px 16px', fontSize: '0.8125rem' }} disabled={busy === r.id} data-testid="request-confirm" onClick={() => void move(r, 'confirmed')}>Confirm</button>}
            {r.status === 'confirmed' && <button type="button" className="em-btn" style={{ minHeight: 42, padding: '8px 16px', fontSize: '0.8125rem' }} disabled={busy === r.id} data-testid="request-done" onClick={() => void move(r, 'done')}>Mark done</button>}
            {(r.status === 'new' || r.status === 'confirmed') && <button type="button" className="lnk" disabled={busy === r.id} data-testid="request-decline" onClick={() => void move(r, 'declined')}>Decline</button>}
            {(r.status === 'done' || r.status === 'declined') && <span className="tag mut">{r.status === 'done' ? 'Done' : 'Declined'}</span>}
          </div>
        </article>
      ))}
    </div>
  );
};
