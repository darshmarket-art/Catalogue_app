import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { usePlan, upgradeNotice } from '../plan';
import type { EnquiryRow } from '../types';
import { Notice } from './ui';
import { Icon } from '../layouts/emergent/ui';

const KINDS: Array<{ key: 'all' | EnquiryRow['kind']; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'design', label: 'Designs' },
  { key: 'shortlist', label: 'Shortlists' },
  { key: 'order', label: 'Orders' }
];

const ago = (iso: string) => {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} hours ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

const about = (e: EnquiryRow) =>
  e.kind === 'design'
    ? `Asked about ${e.title ?? 'a design'}${e.sku ? ` (${e.sku})` : ''}${e.purity ? ` · ${e.purity}` : ''}`
    : e.kind === 'shortlist'
      ? `Sent a shortlist${e.count ? ` of ${e.count} ${e.count === 1 ? 'design' : 'designs'}` : ''}`
      : `Sent an order${e.count ? ` of ${e.count} ${e.count === 1 ? 'item' : 'items'}` : ''}`;

const digits = (phone: string) => phone.replace(/[^0-9]/g, '').replace(/^(\d{10})$/, '91$1');

/** WhatsApp enquiries (Pro): everything buyers sent the store on WhatsApp, newest first, with a one-tap reply. */
export const AdminEnquiriesScreen: React.FC = () => {
  const { flags } = usePlan();
  const [rows, setRows] = useState<EnquiryRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState<'all' | EnquiryRow['kind']>('all');
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!flags.enquiries) return void upgradeNotice('WhatsApp enquiries');
    let active = true;
    const load = () =>
      api
        .getEnquiries()
        .then((data) => active && setRows(data))
        .catch((e) => active && setError(e.message));
    load();
    const timer = setInterval(() => !document.hidden && load(), 15000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [flags.enquiries]);

  const q = query.trim().toLowerCase();
  const shown = (rows ?? []).filter((e) => (kind === 'all' || e.kind === kind) && (!q || `${e.firmName} ${e.ownerName} ${e.buyerPhone} ${e.title ?? ''} ${e.sku ?? ''}`.toLowerCase().includes(q)));

  return (
    <div className="scroll" style={{ gap: 12 }} data-testid="admin-enquiries-screen">
      <p className="sub">Every time a buyer sends you a message on WhatsApp from the catalogue, it is listed here. Tap WhatsApp to reply to them directly.</p>
      {!flags.enquiries && <Notice tone="warn">WhatsApp enquiries are a Pro feature.</Notice>}
      {error && <Notice tone="error">{error}</Notice>}

      <div className="inp-icon">
        <Icon n="search" size={16} />
        <input className="inp" style={{ height: 46 }} type="search" aria-label="Search enquiries" placeholder="Search buyer, phone or design" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      <div className="chips">
        {KINDS.map((k) => (
          <button key={k.key} type="button" className={`chip${kind === k.key ? ' on' : ''}`} aria-pressed={kind === k.key} onClick={() => setKind(k.key)}>
            {k.label}
          </button>
        ))}
      </div>

      {rows === null && !error && flags.enquiries && <p className="hint" style={{ textAlign: 'center' }}>Loading…</p>}
      {rows !== null && shown.length === 0 && (
        <p className="sub" style={{ textAlign: 'center', padding: '24px 0' }}>{rows.length === 0 ? 'No WhatsApp enquiries yet.' : 'No enquiries match.'}</p>
      )}

      <div data-testid="enquiry-list">
        {shown.map((e, i) => (
          <div key={e.id} className="em-row" style={{ gap: 12, padding: '14px 0', borderBottom: i < shown.length - 1 ? '1px solid var(--em-line)' : 0, alignItems: 'flex-start' }}>
            <div className="em-grow" style={{ minWidth: 0 }}>
              <div className="em-ser em-clip" style={{ fontSize: 16 }}>
                {e.firmName}
              </div>
              <div style={{ fontSize: 13.5, marginTop: 3 }}>{about(e)}</div>
              <div className="em-mut" style={{ fontSize: 11, marginTop: 3 }}>
                {e.buyerPhone} · {ago(e.createdAt)}
              </div>
            </div>
            <a
              className="em-btn wa sm"
              data-testid="enquiry-reply"
              href={`https://wa.me/${digits(e.buyerPhone)}?text=${encodeURIComponent(`Hello ${e.ownerName || e.firmName}, thanks for your enquiry${e.title ? ` about ${e.title}` : ''}.`)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Icon n="wa" size={16} />
              Reply
            </a>
          </div>
        ))}
      </div>
    </div>
  );
};
