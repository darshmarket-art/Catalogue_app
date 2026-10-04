import React, { useState } from 'react';
import { api } from '../api';
import { Field, Notice } from './ui';

/** Admin forgot password: a 6-digit code on the store's WhatsApp number, then a new password. */
export const AdminForgotPassword: React.FC<{ email: string; onBack: () => void; onDone: (message: string) => void }> = ({ email: initial, onBack, onDone }) => {
  const [email, setEmail] = useState(initial);
  const [sent, setSent] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const run = (fn: () => Promise<void>) => async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await fn();
    } catch (x: any) {
      setErr(x.message || 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={run(async () => {
        if (!sent) setSent(await api.adminForgotRequest(email.trim()));
        else {
          await api.adminForgotReset({ email: email.trim(), code, newPassword: pw });
          onDone('Password updated. Sign in with the new password.');
        }
      })}
      className="col"
      style={{ gap: 16 }}
    >
      <div>
        <h1 style={{ fontSize: 32, lineHeight: 1.05 }}>Reset password</h1>
        <p className="sub" style={{ marginTop: 6 }}>We send a 6-digit code to the store's WhatsApp number.</p>
      </div>
      {err && <Notice tone="error">{err}</Notice>}
      {sent && <Notice tone="ok">{sent}</Notice>}
      <Field label="Admin email" htmlFor="fp-email">
        <input id="fp-email" type="email" className="inp" required value={email} onChange={(e) => setEmail(e.target.value)} disabled={Boolean(sent)} />
      </Field>
      {sent && (
        <>
          <Field label="6-digit code" htmlFor="fp-code">
            <input id="fp-code" className="inp" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} autoFocus />
          </Field>
          <Field label="New password" htmlFor="fp-pw" hint="At least 10 characters.">
            <input id="fp-pw" type="password" className="inp" required minLength={10} autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
          </Field>
        </>
      )}
      <button type="submit" className="btn" disabled={busy || (Boolean(sent) && code.length !== 6)}>
        {busy ? 'Please wait…' : sent ? 'Set new password' : 'Send code on WhatsApp'}
      </button>
      <button type="button" className="lnk" style={{ alignSelf: 'center' }} onClick={onBack}>
        Back to sign in
      </button>
    </form>
  );
};
