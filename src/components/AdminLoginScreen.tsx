import React, { useState } from 'react';
import { ActiveScreen } from '../types';
import { api } from '../api';
import { merchant } from '../merchant';
import { ADMIN_ROLES, roleLabel } from '../../shared/roles';
import { usePlan } from '../plan';
import { Field, I, Notice } from './ui';

interface AdminLoginScreenProps {
  onNavigate: (screen: ActiveScreen) => void;
  onAdminLoginSuccess: () => void;
}

/** Owner and staff sign-in (artboard 1.7). Creating an admin with the provisioning key stays one quiet link away. */
export const AdminLoginScreen: React.FC<AdminLoginScreenProps> = ({ onNavigate, onAdminLoginSuccess }) => {
  const staffRoles = usePlan().flags.staffRoles;
  const [mode, setMode] = useState<'login' | 'register'>('login');

  // Sign in
  const [adminId, setAdminId] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);

  // Create an admin account
  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminPass, setNewAdminPass] = useState('');
  const [newAdminRole, setNewAdminRole] = useState<(typeof ADMIN_ROLES)[number]>('staff');
  const [provisioningToken, setProvisioningToken] = useState('');
  const [showNewAdminPass, setShowNewAdminPass] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await api.loginAdmin({ adminId: adminId.trim(), password: password.trim() });
      if (res.status === 'success') {
        setSuccessMsg(`Signed in as ${res.admin.name} (${roleLabel(res.admin.role)}).`);
        onAdminLoginSuccess();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Sign-in failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegisterAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await api.registerAdmin({
        name: newAdminName.trim(),
        email: newAdminEmail.trim(),
        password: newAdminPass.trim(),
        role: newAdminRole,
        masterProvisioningKey: provisioningToken.trim()
      });
      setAdminId(newAdminEmail.trim());
      setPassword('');
      setNewAdminPass('');
      setProvisioningToken('');
      setMode('login');
      setSuccessMsg(res.message || 'Admin account created. You can now sign in.');
    } catch (err: any) {
      setErrorMsg(err.message || 'Could not create the admin account.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const eye = (shown: boolean, toggle: () => void) => (
    <button type="button" onClick={toggle} aria-label={shown ? 'Hide password' : 'Show password'} className="absolute right-1 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center" style={{ color: 'var(--mut)', background: 'none', border: 0 }}>
      <I n={shown ? 'eyeoff' : 'eye'} size="s" />
    </button>
  );

  return (
    <div className="scroll no-tabs" style={{ gap: 16, maxWidth: 480 }}>
      {mode === 'login' ? (
        <form onSubmit={handleLoginSubmit} className="col" style={{ gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 32, lineHeight: 1.05 }}>Sign in to your store</h1>
            <p className="sub" style={{ marginTop: 6 }}>
              Owners and staff of {merchant.brand.name} sign in with email and password.
            </p>
          </div>
          {errorMsg && <Notice tone="error">{errorMsg}</Notice>}
          {successMsg && <Notice tone="ok">{successMsg}</Notice>}
          <Field label="Admin email" htmlFor="admin-id">
            <input id="admin-id" type="email" autoComplete="username" className="inp" value={adminId} onChange={(e) => setAdminId(e.target.value)} placeholder="name@company.com" required />
          </Field>
          <Field label="Password" htmlFor="admin-password">
            <div className="relative">
              <input id="admin-password" autoComplete="current-password" className="inp" style={{ paddingRight: 48 }} type={showPass ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" required />
              {eye(showPass, () => setShowPass(!showPass))}
            </div>
          </Field>
          <button type="submit" disabled={isSubmitting} className="btn">
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </button>
          <div className="note">
            <b>Staff accounts</b> <span className="pro" style={{ marginLeft: 4 }}>Pro</span>
            <br />
            {staffRoles ? 'Owners can add staff who help run the catalogue.' : 'Owners can add staff who help run the catalogue. On Basic, only the owner signs in.'}
          </div>
          <p className="hint" style={{ textAlign: 'center' }}>
            Buyers do not use this page. They sign in with a WhatsApp code.
          </p>
        </form>
      ) : (
        <form onSubmit={handleRegisterAdminSubmit} className="col" style={{ gap: 14 }}>
          <div>
            <h1 style={{ fontSize: 32, lineHeight: 1.05 }}>Create an admin</h1>
            <p className="sub" style={{ marginTop: 6 }}>
              You need the <b>master provisioning key</b>, which only the business owner holds. Failed attempts are logged.
            </p>
          </div>
          {errorMsg && <Notice tone="error">{errorMsg}</Notice>}
          <Field label="Full name" htmlFor="new-admin-name">
            <input id="new-admin-name" required className="inp" value={newAdminName} onChange={(e) => setNewAdminName(e.target.value)} placeholder="e.g. Devendra Varma" />
          </Field>
          <Field label="Email" htmlFor="new-admin-email">
            <input id="new-admin-email" required type="email" className="inp" value={newAdminEmail} onChange={(e) => setNewAdminEmail(e.target.value)} placeholder="name@company.com" />
          </Field>
          <Field label="Role" htmlFor="new-admin-role">
            <select id="new-admin-role" value={newAdminRole} onChange={(e) => setNewAdminRole(e.target.value as (typeof ADMIN_ROLES)[number])} className="inp">
              {ADMIN_ROLES.map((r) => (
                <option key={r} value={r}>
                  {roleLabel(r)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Password" htmlFor="new-admin-password" hint="At least 10 characters.">
            <div className="relative">
              <input id="new-admin-password" required minLength={10} autoComplete="new-password" type={showNewAdminPass ? 'text' : 'password'} className="inp" style={{ paddingRight: 48 }} value={newAdminPass} onChange={(e) => setNewAdminPass(e.target.value)} placeholder="Choose a password" />
              {eye(showNewAdminPass, () => setShowNewAdminPass(!showNewAdminPass))}
            </div>
          </Field>
          <Field label="Master provisioning key" htmlFor="new-admin-key">
            <input id="new-admin-key" required type="password" autoComplete="off" className="inp" value={provisioningToken} onChange={(e) => setProvisioningToken(e.target.value)} placeholder="Enter the provisioning key" />
          </Field>
          <button type="submit" disabled={isSubmitting} className="btn">
            {isSubmitting ? 'Creating…' : 'Create admin account'}
          </button>
        </form>
      )}

      <div className="col" style={{ alignItems: 'center', gap: 0 }}>
        <button
          type="button"
          className="lnk"
          onClick={() => {
            setMode(mode === 'login' ? 'register' : 'login');
            setErrorMsg(null);
          }}
        >
          {mode === 'login' ? 'Create an admin account' : 'Back to sign in'}
        </button>
        <button type="button" className="lnk" onClick={() => onNavigate('retailer-auth')}>
          Buyer sign in
        </button>
      </div>
    </div>
  );
};
