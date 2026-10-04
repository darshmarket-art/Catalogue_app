import React, { useEffect, useState } from 'react';
import { api } from '../api';
import type { AdminRow } from '../types';
import { Field, Notice } from './ui';
import { Icon } from '../layouts/emergent/ui';

/** The store's admin accounts: list, add one (with a temporary password), remove one (never the last), or set a temporary password for a colleague. */
export const AdminAdminsScreen: React.FC<{ meEmail: string | null }> = ({ meEmail }) => {
  const [admins, setAdmins] = useState<AdminRow[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState({ name: '', email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [resetting, setResetting] = useState<string | null>(null);
  const [tempPw, setTempPw] = useState('');

  const load = () => api.getAdmins().then(setAdmins).catch((e) => setErr(e.message));
  useEffect(() => {
    void load();
  }, []);

  const run = async (fn: () => Promise<string>) => {
    setBusy(true);
    setErr(null);
    setOk(null);
    try {
      setOk(await fn());
      await load();
    } catch (e: any) {
      setErr(e.message || 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    void run(async () => {
      await api.addAdmin({ name: f.name.trim(), email: f.email.trim(), password: f.password });
      setAdding(false);
      setF({ name: '', email: '', password: '' });
      return `${f.email.trim()} added. Share the temporary password with them; they set their own at first sign-in.`;
    });
  };

  const remove = (a: AdminRow) => {
    if (!window.confirm(`Remove ${a.name} (${a.email}) as an admin? They lose access immediately.`)) return;
    void run(async () => {
      await api.removeAdmin(a.email);
      return `${a.email} removed.`;
    });
  };

  const reset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetting) return;
    const email = resetting;
    void run(async () => {
      const msg = await api.resetAdminPassword(email, tempPw);
      setResetting(null);
      setTempPw('');
      return msg;
    });
  };

  return (
    <div className="scroll no-tabs" style={{ gap: 12 }} data-testid="admin-admins-screen">
      <p className="sub">Every admin can do everything in this store. Add a colleague with a temporary password; they choose their own when they first sign in.</p>
      {err && <Notice tone="error">{err}</Notice>}
      {ok && <Notice tone="ok">{ok}</Notice>}

      {admins === null ? (
        <div className="card em-skel" style={{ height: 72 }} />
      ) : (
        admins.map((a) => (
          <div key={a.email} className="card" data-testid="admin-row" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="em-ico">
              <Icon n="user" size={18} />
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <b style={{ display: 'block', fontWeight: 600 }}>
                {a.name}
                {a.email === meEmail && <span className="tag mut" style={{ marginLeft: 8 }}>You</span>}
                {a.mustChangePassword && <span className="tag warn" style={{ marginLeft: 8 }}>Temporary password</span>}
              </b>
              <span className="sub" style={{ display: 'block', fontSize: 13, wordBreak: 'break-all' }}>
                {a.email}
              </span>
            </span>
            {a.email !== meEmail && (
              <span className="row" style={{ gap: 6 }}>
                <button type="button" className="btn alt sm" data-testid="admin-reset" onClick={() => { setResetting(resetting === a.email ? null : a.email); setTempPw(''); }} disabled={busy}>
                  Reset
                </button>
                <button type="button" className="btn alt danger sm" data-testid="admin-remove" onClick={() => remove(a)} disabled={busy || admins.length <= 1} title={admins.length <= 1 ? 'A store keeps at least one admin' : undefined}>
                  Remove
                </button>
              </span>
            )}
          </div>
        ))
      )}

      {resetting && (
        <form onSubmit={reset} className="card col" style={{ gap: 10 }} data-testid="admin-reset-form">
          <b style={{ fontWeight: 600 }}>Temporary password for {resetting}</b>
          <Field label="Temporary password" htmlFor="rp-pw" hint="At least 10 characters. They must change it at their next sign-in.">
            <input id="rp-pw" className="inp" required minLength={10} value={tempPw} onChange={(e) => setTempPw(e.target.value)} autoComplete="off" />
          </Field>
          <div className="row">
            <button type="submit" className="btn sm" disabled={busy || tempPw.length < 10}>
              {busy ? 'Saving…' : 'Set temporary password'}
            </button>
            <button type="button" className="lnk" onClick={() => setResetting(null)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {adding ? (
        <form onSubmit={add} className="card col" style={{ gap: 10 }} data-testid="admin-add-form">
          <b style={{ fontWeight: 600 }}>New admin</b>
          <Field label="Name" htmlFor="na-name">
            <input id="na-name" className="inp" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoComplete="off" />
          </Field>
          <Field label="Email" htmlFor="na-email">
            <input id="na-email" type="email" className="inp" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} autoComplete="off" />
          </Field>
          <Field label="Temporary password" htmlFor="na-pw" hint="At least 10 characters. They set their own at first sign-in.">
            <input id="na-pw" className="inp" required minLength={10} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} autoComplete="new-password" />
          </Field>
          <div className="row">
            <button type="submit" className="btn sm" data-testid="admin-add-submit" disabled={busy || f.password.length < 10 || !f.email}>
              {busy ? 'Adding…' : 'Add admin'}
            </button>
            <button type="button" className="lnk" onClick={() => setAdding(false)}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button type="button" className="btn alt" data-testid="admin-add-button" onClick={() => { setAdding(true); setOk(null); }}>
          <Icon n="plus" size={18} />
          Add an admin
        </button>
      )}
    </div>
  );
};
