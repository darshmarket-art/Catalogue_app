import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { merchant } from '../merchant';
import { rs, type AiCreditsInfo } from '../aiRender';
import { STYLE_IDS, STYLE_INFO, type StyleId } from '../../shared/aiStyles';
import { SALES_EMAIL, SALES_WHATSAPP } from '../../shared/sales';

const ask = `Hello Antarixs, please add AI credits to my store "${merchant.brand.name}" (${merchant.id}).`;

/** No payment gateway yet: the owner pays Antarixs, and Antarixs tops the balance up from the console. */
export const AddCredits: React.FC = () => (
  <span data-testid="add-credits">
    Add credits: contact Antarixs{' '}
    <a href={`mailto:${SALES_EMAIL}?subject=${encodeURIComponent(`AI credits for ${merchant.id}`)}&body=${encodeURIComponent(ask)}`}>{SALES_EMAIL}</a>
    {SALES_WHATSAPP && <> or <a href={`https://wa.me/${SALES_WHATSAPP}?text=${encodeURIComponent(ask)}`} target="_blank" rel="noopener noreferrer">WhatsApp</a></>}.
  </span>
);

const when = (ms: number) => new Date(ms).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
const OUTCOME: Record<string, string> = { ok: 'Done', provider_failed: 'Failed, credits returned', pending: 'In progress', blocked_credits: 'Not enough credits', blocked_cap: 'Monthly limit', blocked_disabled: 'Switched off' };

/** "AI credits" card for Store settings: balance, last top-up and the last few renders. Read-only; same markup for Classic and Maison (both use the em- styles). */
export const AiCreditsCard: React.FC = () => {
  const [info, setInfo] = useState<AiCreditsInfo | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => { api.aiCredits().then(setInfo, () => setFailed(true)); }, []);
  if (failed) return <div className="em-card" style={{ padding: 16 }}><span className="em-mut">AI credits could not be loaded.</span></div>;
  if (!info) return <div className="em-card" style={{ padding: 16 }} role="status"><span className="em-mut">Loading AI credits…</span></div>;
  const low = info.low || (!info.free && info.balance <= 0);
  const prices = [...new Set(STYLE_IDS.map((s) => info.prices[s]))];
  return (
    <div className="em-card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }} data-testid="ai-credits-card">
      <div className="em-row em-sb" style={{ alignItems: 'baseline' }}>
        <span className="em-ser" style={{ fontSize: '1.75rem' }} data-testid="ai-balance">{info.free ? 'Free' : rs(info.balance)}</span>
        <span className="em-mut" style={{ fontSize: '0.75rem' }}>{info.free ? 'AI renders are free for your store' : 'balance'}</span>
      </div>
      {!info.enabled && <p style={{ margin: 0 }} role="status">AI render is switched off for your store right now.</p>}
      {low && !info.free && <p style={{ margin: 0, color: 'var(--em-bad)' }} role="status">{info.balance <= 0 ? 'You have no AI credits.' : 'Your AI credits are running low.'} <AddCredits /></p>}
      {!info.free && <span className="em-mut" style={{ fontSize: '0.8125rem' }}>Each render costs {prices.length > 1 ? `${rs(Math.min(...prices))} to ${rs(Math.max(...prices))}` : rs(prices[0])}, taken when it starts and returned if it fails. Last top-up: {info.lastTopup ? `${rs(info.lastTopup.amount)} on ${when(info.lastTopup.at)}` : 'none yet'}.</span>}
      <div className="em-ey">Recent renders</div>
      {info.recent.length === 0 ? <span className="em-mut" style={{ fontSize: '0.8125rem' }}>No renders yet.</span> : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }} data-testid="ai-recent">
          {info.recent.map((u) => (
            <li key={u.id} className="em-row em-sb" style={{ fontSize: '0.8125rem', gap: 8 }}>
              <span>{STYLE_INFO[u.style as StyleId]?.name ?? u.style} <span className="em-mut">· {when(u.ts)} · {OUTCOME[u.outcome] ?? u.outcome}</span></span>
              <b style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{u.price ? `-${rs(u.price)}` : u.refunded ? `${rs(u.refunded)} back` : '—'}</b>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
