import React, { useEffect, useState } from 'react';
import { BuyerRow } from '../types';
import { api } from '../api';
import { PageTitle, Notice } from './ui';

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
    <div className="flex flex-col w-full pb-32 max-w-xl mx-auto">
      <PageTitle title="Buyers" sub="If a buyer forgets their password, give them a temporary one. They choose a new password when they sign in." />

      <div className="px-5 flex flex-col gap-3">
        {reset && (
          <div role="status" className="rounded-2xl bg-secondary-container text-on-secondary-container p-4">
            <p className="font-sans text-[15px]">
              Temporary password for <strong>{reset.firmName}</strong>
            </p>
            <p data-testid="temp-password" className="font-sans text-[22px] font-extrabold tracking-wider my-1 select-all">
              {reset.temporaryPassword}
            </p>
            <p className="font-sans text-sm">Shown once. Give it to the buyer (phone {reset.phone}); it stops working as soon as they choose their own.</p>
            <button onClick={() => setReset(null)} className="mt-2 min-h-11 font-sans text-sm font-extrabold underline">
              Done
            </button>
          </div>
        )}

        {error && <Notice tone="error">{error}</Notice>}
        {buyers === null && !error && <p className="font-sans text-sm text-outline text-center py-8">Loading…</p>}
        {buyers?.length === 0 && <p className="font-sans text-[15px] text-on-surface-variant text-center py-8">No buyers have signed up yet.</p>}
      </div>

      <ul className="flex flex-col mt-1" data-testid="buyer-list">
        {buyers?.map((b) => (
          <li key={b.phone} className="grid grid-cols-[48px_1fr_auto] items-center gap-3 px-5 py-3 border-b border-surface-container">
            <span className="w-12 h-12 rounded-full bg-primary-fixed text-primary flex items-center justify-center font-sans text-lg font-extrabold">
              {b.firmName.charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="font-sans text-[15.5px] font-bold text-on-surface truncate">{b.firmName}</p>
              <p className="font-sans text-sm text-on-surface-variant">{b.phone}</p>
              <p className="font-sans text-sm text-outline">
                Joined {new Date(b.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                {b.mustChangePassword ? ' · waiting to set a new password' : ''}
              </p>
            </div>
            <button
              type="button"
              disabled={busyPhone === b.phone}
              onClick={() => handleReset(b)}
              className="min-h-11 px-3 rounded-xl border-[1.5px] border-outline-variant font-sans text-sm font-extrabold text-primary whitespace-nowrap disabled:opacity-40"
            >
              Reset
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};
