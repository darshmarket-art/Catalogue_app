import React, { useState } from 'react';
import { api, ApiError } from '../api';

interface ChangePasswordScreenProps {
  /** True when the owner has reset this account: the buyer must choose a new password before carrying on. */
  required: boolean;
  onDone: () => void;
  onCancel: () => void;
}

const inputBox =
  'w-full bg-surface-container-low px-3 py-2.5 rounded-lg text-xs font-sans text-on-surface border border-outline-variant/40 focus:outline-none focus:bg-white';

export const ChangePasswordScreen: React.FC<ChangePasswordScreenProps> = ({ required, onDone, onCancel }) => {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const problem =
    !current ? 'Enter your current password' : next.length < 8 ? 'The new password needs at least 8 characters' : next !== confirm ? 'The two new passwords do not match' : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (problem) return;
    setBusy(true);
    setError(null);
    try {
      await api.changePassword({ currentPassword: current, newPassword: next });
      onDone();
    } catch (err) {
      if (!(err instanceof ApiError && err.handled)) setError(err instanceof Error ? err.message : 'Could not change the password.');
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col w-full pb-32 max-w-lg mx-auto px-4 pt-3 space-y-4">
      <div>
        <h1 className="font-serif text-[22px] font-bold text-on-surface">{required ? 'Choose a new password' : 'Change password'}</h1>
        <p className="font-sans text-xs text-outline leading-relaxed">
          {required
            ? 'Your password was reset by the owner. Enter the temporary password you were given, then choose your own.'
            : 'Enter your current password, then choose a new one.'}
        </p>
      </div>

      <section className="bg-white rounded-xl p-4 shadow-xs border border-outline-variant/40 flex flex-col space-y-3">
        <div className="flex flex-col space-y-1">
          <label className="text-xs font-sans font-semibold text-on-surface" htmlFor="current-password">
            {required ? 'Temporary password' : 'Current password'}
          </label>
          <input id="current-password" className={inputBox} type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
        </div>
        <div className="flex flex-col space-y-1">
          <label className="text-xs font-sans font-semibold text-on-surface" htmlFor="new-password">New password</label>
          <input id="new-password" className={inputBox} type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
        </div>
        <div className="flex flex-col space-y-1">
          <label className="text-xs font-sans font-semibold text-on-surface" htmlFor="confirm-password">Repeat new password</label>
          <input id="confirm-password" className={inputBox} type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </div>
        {error && <p role="alert" className="text-xs font-sans text-error font-semibold">{error}</p>}
        <p className={`text-xs font-sans font-semibold ${problem ? 'text-outline' : 'text-secondary'}`}>{problem ?? 'Ready to save'}</p>
        <button
          type="submit"
          disabled={busy || problem !== null}
          className="w-full py-3 bg-secondary hover:bg-secondary-dark disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-xs font-sans font-bold"
        >
          {busy ? 'Saving...' : 'Save new password'}
        </button>
        {!required && (
          <button type="button" onClick={onCancel} className="w-full py-2 text-xs font-sans font-bold text-outline">
            Cancel
          </button>
        )}
      </section>
    </form>
  );
};
