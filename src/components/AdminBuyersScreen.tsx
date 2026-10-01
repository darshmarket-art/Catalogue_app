import React, { useEffect, useState } from 'react';
import { BuyerRow } from '../types';
import { api } from '../api';

export const AdminBuyersScreen: React.FC = () => {
  const [buyers, setBuyers] = useState<BuyerRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
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
      alert(e instanceof Error ? e.message : 'Could not reset the password.');
    } finally {
      setBusyPhone(null);
    }
  };

  return (
    <div className="flex flex-col w-full pb-32 max-w-xl mx-auto px-4 pt-3 space-y-4">
      <div>
        <span className="font-mono text-xs text-primary font-bold tracking-wider uppercase">Accounts</span>
        <h1 className="font-serif text-[22px] font-bold text-on-surface">Buyers</h1>
        <p className="font-sans text-xs text-outline">
          If a buyer forgets their password, the owner can give them a temporary one. They choose a new password when they sign in.
        </p>
      </div>

      {reset && (
        <div role="status" className="bg-secondary-container border border-secondary rounded-xl p-3.5 text-on-secondary-fixed">
          <p className="font-sans text-xs font-bold">Temporary password for {reset.firmName}</p>
          <p data-testid="temp-password" className="font-mono text-lg font-bold tracking-wider my-1 select-all">
            {reset.temporaryPassword}
          </p>
          <p className="font-sans text-xs">
            Shown once. Give it to the buyer (phone {reset.phone}); it stops working as soon as they choose their own.
          </p>
          <button onClick={() => setReset(null)} className="mt-2 text-xs font-bold underline">
            Done
          </button>
        </div>
      )}

      {error && <p className="text-xs text-error font-semibold">{error}</p>}
      {buyers === null && !error && <p className="text-xs text-outline text-center py-8">Loading…</p>}
      {buyers?.length === 0 && <p className="text-xs text-outline text-center py-8">No buyers have signed up yet.</p>}

      <div className="flex flex-col gap-2" data-testid="buyer-list">
        {buyers?.map((b) => (
          <div key={b.phone} className="bg-white rounded-xl border border-outline-variant/40 p-3 flex items-center justify-between gap-3">
            <div className="flex flex-col min-w-0">
              <span className="font-sans text-sm font-bold text-on-surface truncate">{b.firmName}</span>
              <span className="font-mono text-xs text-outline">{b.phone}</span>
              <span className="font-sans text-xs text-outline">
                Joined {new Date(b.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                {b.mustChangePassword ? ' · waiting to set a new password' : ''}
              </span>
            </div>
            <button
              type="button"
              disabled={busyPhone === b.phone}
              onClick={() => handleReset(b)}
              className="px-3 py-1.5 rounded-lg bg-surface-container-high hover:bg-surface-container-highest border border-outline-variant text-xs font-sans font-semibold whitespace-nowrap disabled:opacity-40"
            >
              Reset password
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
