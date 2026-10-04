import React, { useEffect, useState } from 'react';
import { api, type MessageKind, type MessageRow, type MessagesPage } from '../api';
import { Notice } from './ui';
import { DeliveryPill } from './DeliveryStatus';

const KIND_LABEL: Record<MessageKind, string> = { otp: 'Sign-in code', 'signup-otp': 'Signup code', 'admin-reset': 'Password reset code', order: 'Order alert', 'store-full': 'Catalogue-full nudge', test: 'Test alert', trial: 'Trial notice' };

const when = (iso: string) => {
  const d = new Date(iso);
  const today = new Date().toDateString() === d.toDateString();
  return today ? d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};

/** The store's WhatsApp messages (90 days): every code and alert with its delivery stage; failures first when filtered. */
export const AdminMessagesScreen: React.FC = () => {
  const [page, setPage] = useState<MessagesPage | null>(null);
  const [filter, setFilter] = useState<'all' | 'failed'>('all');
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    setErr(null);
    api.getMessages(filter === 'failed' ? 'failed' : undefined).then(setPage).catch((e) => setErr(e.message));
  }, [filter]);

  return (
    <div className="scroll no-tabs" style={{ gap: 12 }} data-testid="admin-messages-screen">
      <p className="sub">Every WhatsApp message this store sent in the last 90 days: sign-in codes and your alerts, with what happened to each.</p>
      {err && <Notice tone="error">{err}</Notice>}

      {page && (
        <>
          <div className="card em-row em-sb" style={{ gap: 10 }} data-testid="messages-receipts">
            <span style={{ fontSize: 13.5 }}>Delivery receipts</span>
            <span className={`tag ${page.receipts.connected ? 'ok' : 'mut'}`} data-testid="messages-receipts-status">
              {page.receipts.connected ? `Connected${page.receipts.lastAt ? ` · last ${when(page.receipts.lastAt)}` : ''}` : 'Not connected'}
            </span>
          </div>
          {!page.receipts.connected && (
            <Notice tone="warn">
              <span data-testid="messages-receipts-note">Until receipts are connected, messages stop at "Sending…": WhatsApp accepted them, but delivery is not confirmed here.</span>
            </Notice>
          )}

          <div className="grid2" style={{ gap: 10 }} data-testid="messages-counts">
            <Stat label="Sent today" value={String(page.counts.today)} testId="messages-count-today" />
            <Stat label="Delivered (7 days)" value={page.counts.week.deliveredRate === null ? '—' : `${page.counts.week.deliveredRate}%`} testId="messages-count-rate" />
            <Stat label="Messages (7 days)" value={String(page.counts.week.total)} testId="messages-count-week" />
            <Stat label="Need attention" value={String(page.counts.failed)} testId="messages-count-failed" tone={page.counts.failed > 0 ? 'bad' : undefined} />
          </div>

          <div className="em-row" style={{ gap: 8 }}>
            <button type="button" className={`btn sm ${filter === 'all' ? '' : 'alt'}`} data-testid="messages-filter-all" onClick={() => setFilter('all')}>
              All
            </button>
            <button type="button" className={`btn sm ${filter === 'failed' ? '' : 'alt'}`} data-testid="messages-filter-failed" onClick={() => setFilter('failed')}>
              Needs attention
            </button>
          </div>

          {page.data.length === 0 ? (
            <p className="sub" data-testid="messages-empty">{filter === 'failed' ? 'Nothing needs attention.' : 'No WhatsApp messages have been sent yet.'}</p>
          ) : (
            <div className="col" style={{ gap: 8 }} data-testid="messages-list">
              {page.data.map((m) => (
                <Row key={m.id} m={m} open={open === m.id} onToggle={() => setOpen(open === m.id ? null : m.id)} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

const Stat: React.FC<{ label: string; value: string; testId: string; tone?: string }> = ({ label, value, testId, tone }) => (
  <div className="card col" style={{ gap: 2 }} data-testid={testId}>
    <span className="em-mut" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6 }}>{label}</span>
    <b className="em-ser" style={{ fontSize: 22, color: tone === 'bad' ? 'var(--em-bad)' : undefined }}>{value}</b>
  </div>
);

const Row: React.FC<{ m: MessageRow; open: boolean; onToggle: () => void }> = ({ m, open, onToggle }) => (
  <button type="button" className="card col" style={{ gap: 6, width: '100%', textAlign: 'left' }} data-testid="message-row" onClick={onToggle}>
    <span className="em-row em-sb" style={{ gap: 10 }}>
      <span style={{ fontWeight: 500 }}>
        {KIND_LABEL[m.kind]} · {m.buyer ?? m.to}
      </span>
      <DeliveryPill status={m.status} testId="message-status" />
    </span>
    <span className="sub" style={{ fontSize: 12.5 }}>
      {m.buyer ? `${m.to} · ` : ''}
      {when(m.createdAt)}
      {m.receiptAt ? ` · receipt ${when(m.receiptAt)}` : ''}
    </span>
    {open && (
      <span className="sub" style={{ fontSize: 12.5 }} data-testid="message-details">
        {m.status === 'failed' ? `Meta error ${m.errorCode ?? '—'}: ${m.errorTitle ?? 'not delivered'}` : `Message id ${m.id}`}
      </span>
    )}
  </button>
);
