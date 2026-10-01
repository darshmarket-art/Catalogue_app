import React, { useState } from 'react';
import { ActiveScreen } from '../types';
import { api } from '../api';
import { merchant } from '../merchant';
import { ADMIN_ROLES, roleLabel } from '../../shared/roles';
import { PageTitle, Field, Notice, Segmented, inputClass, btnPrimary, btnLink } from './ui';

interface AdminLoginScreenProps {
  onNavigate: (screen: ActiveScreen) => void;
  onAdminLoginSuccess: () => void;
}

export const AdminLoginScreen: React.FC<AdminLoginScreenProps> = ({ onNavigate, onAdminLoginSuccess }) => {
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
    <button type="button" onClick={toggle} aria-label={shown ? 'Hide password' : 'Show password'} className="absolute right-1 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center text-outline">
      <span className="material-symbols-outlined text-[22px]">{shown ? 'visibility_off' : 'visibility'}</span>
    </button>
  );

  return (
    <div className="flex flex-col w-full max-w-md mx-auto pb-28">
      <PageTitle title="Admin console" sub={`For the owner and staff of ${merchant.brand.name}.`} />

      <div className="px-5 flex flex-col gap-4">
        <Segmented
          options={[
            { key: 'login', label: 'Sign in' },
            { key: 'register', label: 'Create admin' }
          ]}
          value={mode}
          onChange={(key) => {
            setMode(key as 'login' | 'register');
            setErrorMsg(null);
          }}
        />

        {errorMsg && <Notice tone="error">{errorMsg}</Notice>}
        {successMsg && <Notice tone="ok">{successMsg}</Notice>}

        {mode === 'login' ? (
          <form onSubmit={handleLoginSubmit} className="flex flex-col gap-4">
            <Field label="Admin email" htmlFor="admin-id">
              <input id="admin-id" type="email" autoComplete="username" className={inputClass} value={adminId} onChange={(e) => setAdminId(e.target.value)} placeholder="name@company.com" required />
            </Field>
            <Field label="Password" htmlFor="admin-password">
              <div className="relative">
                <input
                  id="admin-password"
                  autoComplete="current-password"
                  className={`${inputClass} pr-12`}
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                />
                {eye(showPass, () => setShowPass(!showPass))}
              </div>
            </Field>
            <button type="submit" disabled={isSubmitting} className={btnPrimary}>
              {isSubmitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegisterAdminSubmit} className="flex flex-col gap-4">
            <p className="font-sans text-[15px] leading-relaxed text-on-surface-variant">
              You need the <strong>master provisioning key</strong>, which only the business owner holds. Failed attempts are logged.
            </p>
            <Field label="Full name" htmlFor="new-admin-name">
              <input id="new-admin-name" required className={inputClass} value={newAdminName} onChange={(e) => setNewAdminName(e.target.value)} placeholder="e.g. Devendra Varma" />
            </Field>
            <Field label="Email" htmlFor="new-admin-email">
              <input id="new-admin-email" required type="email" className={inputClass} value={newAdminEmail} onChange={(e) => setNewAdminEmail(e.target.value)} placeholder="name@company.com" />
            </Field>
            <Field label="Role" htmlFor="new-admin-role">
              <select id="new-admin-role" value={newAdminRole} onChange={(e) => setNewAdminRole(e.target.value as (typeof ADMIN_ROLES)[number])} className={inputClass}>
                {ADMIN_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {roleLabel(r)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Password" htmlFor="new-admin-password" hint="At least 10 characters">
              <div className="relative">
                <input
                  id="new-admin-password"
                  required
                  minLength={10}
                  autoComplete="new-password"
                  type={showNewAdminPass ? 'text' : 'password'}
                  className={`${inputClass} pr-12`}
                  value={newAdminPass}
                  onChange={(e) => setNewAdminPass(e.target.value)}
                  placeholder="Choose a password"
                />
                {eye(showNewAdminPass, () => setShowNewAdminPass(!showNewAdminPass))}
              </div>
            </Field>
            <Field label="Master provisioning key" htmlFor="new-admin-key">
              <input id="new-admin-key" required type="password" autoComplete="off" className={inputClass} value={provisioningToken} onChange={(e) => setProvisioningToken(e.target.value)} placeholder="Enter the provisioning key" />
            </Field>
            <button type="submit" disabled={isSubmitting} className={btnPrimary}>
              {isSubmitting ? 'Creating…' : 'Create admin account'}
            </button>
          </form>
        )}

        <p className="font-sans text-sm text-outline text-center leading-relaxed">Authorised personnel only. Sign-in attempts and admin activity are recorded in the audit log.</p>

        <div className="text-center">
          <button onClick={() => onNavigate('retailer-auth')} className={btnLink} type="button">
            Back to buyer sign in
          </button>
        </div>
      </div>
    </div>
  );
};
