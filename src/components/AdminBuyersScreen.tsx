import React, { useEffect, useState } from 'react';
import { BuyerRow } from '../types';
import { api } from '../api';
import { usePlan, upgradeNotice } from '../plan';
import { I, Notice } from './ui';

/** Buyers (artboard 3.5 on Pro; 4.3 on Basic, with the 50-buyer meter). */
export const AdminBuyersScreen: React.FC = () => {
  const { limits } = usePlan();
  const [buyers, setBuyers] = useState<BuyerRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [reset, setReset] = useState<{ firmName: string; phone: string; temporaryPassword: string } | null>(null);
  const [busyPhone, setBusyPhone] = useState<string | null>(null);

  const load = () =>
    api
      .getBuyers()
      .then(setBuyers)
      .catch((e) => setError(e.message));

  useEffect(() => {
    load();
  }, []);

  const handleReset = async (buyer: BuyerRow) => {
    if (!window.confirm(`Reset the password for ${buyer.firmName}? Their current password will stop working.`)) return;
    setBusyPhone(buyer.phone);
    try {
      const result = await api.resetBuyerPassword(buyer.phone);
      setReset({ firmName: result.firmName, phone: buyer.phone, temporaryPassword: result.temporaryPassword });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not reset the password.');
    } finally {
      setBusyPhone(null);
    }
  };

  const q = query.trim().toLowerCase();
  const shown = (buyers ?? []).filter((b) => !q || b.firmName.toLowerCase().includes(q) || b.phone.includes(q));
  const count = buyers?.length ?? 0;
  const cap = limits.users;
  const left = cap === null ? null : cap - count;
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

      <div className="inp-icon">
        <I n="search" />
        <input className="inp" style={{ height: 46 }} type="search" aria-label="Search shop or phone" placeholder="Search shop or phone" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      {reset && (
        <div role="status" className="note">
          <p>
            Temporary password for <b>{reset.firmName}</b>
          </p>
          <p data-testid="temp-password" className="serif select-all" style={{ fontSize: 24, margin: '4px 0' }}>
            {reset.temporaryPassword}
          </p>
          <p style={{ fontSize: 13.5 }}>Shown once. Give it to the buyer (phone {reset.phone}); it stops working as soon as they choose their own.</p>
          <button type="button" className="lnk" onClick={() => setReset(null)}>
            Done
          </button>
        </div>
      )}

      {error && <Notice tone="error">{error}</Notice>}
      {buyers === null && !error && <p className="hint" style={{ textAlign: 'center' }}>Loading…</p>}
      {buyers?.length === 0 && <p className="sub" style={{ textAlign: 'center', padding: '24px 0' }}>No buyers have signed up yet.</p>}

      <div className="col" style={{ gap: 10 }} data-testid="buyer-list">
        {shown.map((b) => (
          <div key={b.phone} className="card row" style={{ padding: '12px 14px' }}>
            <div className="grow">
              <b>{b.firmName}</b>
              <p className="sub" style={{ fontSize: 13 }}>
                {b.phone} · joined {joined(b.createdAt)}
                {b.mustChangePassword ? ' · setting a new password' : ''}
              </p>
            </div>
            <button type="button" className="btn sm alt" style={{ height: 40 }} disabled={busyPhone === b.phone} onClick={() => handleReset(b)}>
              Reset
            </button>
          </div>
        ))}
      </div>

      {cap === null ? (
        <div className="note ok row">
          <I n="check" size="s" />
          <span>Pro: unlimited buyers.</span>
        </div>
      ) : (
        <button type="button" className="btn alt" onClick={() => upgradeNotice('Unlimited buyers')}>
          <I n="sparkle" />
          Unlimited buyers with Pro
        </button>
      )}
    </div>
  );
};
