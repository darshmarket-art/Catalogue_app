import React, { useState } from 'react';
import { api, ApiError } from '../api';
import { Field, Notice, PageTitle } from './ui';

interface ChangePasswordScreenProps {
  /** True when the owner has reset this account: the buyer must choose a new password before carrying on. */
  required: boolean;
  onDone: () => void;
  onCancel: () => void;
}

export const ChangePasswordScreen: React.FC<ChangePasswordScreenProps> = ({ required, onDone, onCancel }) => {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const problem = !current ? 'Enter your current password' : next.length < 8 ? 'The new password needs at least 8 characters' : next !== confirm ? 'The two new passwords do not match' : null;

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
    <form onSubmit={submit} className="scroll no-tabs" style={{ gap: 14, maxWidth: 480 }}>
      <PageTitle
        title={required ? 'Choose a new password' : 'Change password'}
        sub={required ? 'The owner reset your password. Enter the temporary password you were given, then choose one only you know.' : 'Enter your current password, then choose a new one.'}
      />
      <Field label={required ? 'Temporary password' : 'Current password'} htmlFor="current-password">
        <input id="current-password" className="inp" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
      </Field>
      <Field label="New password" htmlFor="new-password" hint="At least 8 characters.">
        <input id="new-password" className="inp" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
      </Field>
      <Field label="Repeat new password" htmlFor="confirm-password">
        <input id="confirm-password" className="inp" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </Field>
      {error && <Notice tone="error">{error}</Notice>}
      <p className="hint" style={{ margin: 0, color: problem ? 'var(--mut)' : 'var(--ok)', fontWeight: 700 }}>
        {problem ?? 'Ready to save'}
      </p>
      <button type="submit" disabled={busy || problem !== null} className="btn">
        {busy ? 'Saving…' : 'Save new password'}
      </button>
      {!required && (
        <button type="button" onClick={onCancel} className="lnk" style={{ alignSelf: 'center' }}>
          Cancel
        </button>
      )}
    </form>
  );
};
