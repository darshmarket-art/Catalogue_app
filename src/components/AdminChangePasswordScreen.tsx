import React, { useState } from 'react';
import { api } from '../api';
import { Field, Notice } from './ui';

/** An admin sets their own password. `forced` after signing in with a temporary password: nothing else opens until it is done. */
export const AdminChangePasswordScreen: React.FC<{ forced: boolean; onDone: () => void }> = ({ forced, onDone }) => {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const mismatch = again.length > 0 && next !== again;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mismatch) return;
    setBusy(true);
    setErr(null);
    try {
      await api.adminChangePassword({ currentPassword: current, newPassword: next });
      onDone();
    } catch (x: any) {
      setErr(x.message || 'Could not change the password.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="scroll no-tabs" style={{ gap: 16, maxWidth: 480 }} data-testid="change-password-screen">
      <form onSubmit={submit} className="col" style={{ gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 30, lineHeight: 1.05 }}>{forced ? 'Choose your password' : 'Change password'}</h1>
          <p className="sub" style={{ marginTop: 6 }}>
            {forced ? 'You signed in with a temporary password. Set your own to continue.' : 'Enter your current password, then the new one.'}
          </p>
        </div>
        {err && <Notice tone="error">{err}</Notice>}
        <Field label={forced ? 'Temporary password' : 'Current password'} htmlFor="cp-cur">
          <input id="cp-cur" data-testid="cp-current" type="password" className="inp" required autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
        </Field>
        <Field label="New password" htmlFor="cp-new" hint="At least 10 characters.">
          <input id="cp-new" data-testid="cp-new" type="password" className="inp" required minLength={10} autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
        </Field>
        <Field label="New password again" htmlFor="cp-again" hint={mismatch ? 'The two passwords differ.' : undefined}>
          <input id="cp-again" data-testid="cp-again" type="password" className="inp" required minLength={10} autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} />
        </Field>
        <button type="submit" className="btn" data-testid="cp-submit" disabled={busy || mismatch || next.length < 10 || !current}>
          {busy ? 'Saving…' : 'Set password'}
        </button>
      </form>
    </div>
  );
};
