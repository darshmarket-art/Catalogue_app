import React, { useState } from 'react';
import { ActiveScreen } from '../types';
import { api } from '../api';
import { merchant } from '../merchant';
import { ADMIN_ROLES, roleLabel } from '../../shared/roles';

interface AdminLoginScreenProps {
  onNavigate: (screen: ActiveScreen) => void;
  onAdminLoginSuccess: () => void;
}

const field =
  'w-full bg-surface-container-low px-3 py-2 rounded-lg text-xs font-sans border border-outline-variant/40 focus:outline-none focus:bg-white';

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

  const tab = (active: boolean) =>
    `flex-1 py-1.5 rounded-lg text-center transition-all flex items-center justify-center space-x-1 text-xs font-sans font-semibold ${
      active ? 'bg-white shadow-xs text-on-surface' : 'text-on-surface-variant hover:text-on-surface'
    }`;

  return (
    <div className="flex flex-col w-full max-w-md mx-auto px-4 py-4 pb-28 space-y-3.5">
      {/* Title Header */}
      <div className="flex flex-col items-center text-center space-y-1">
        <div className="w-10 h-10 rounded-xl bg-on-surface border border-primary-container/50 flex items-center justify-center text-primary-fixed shadow-md mb-1">
          <span className="material-symbols-outlined text-[22px]">admin_panel_settings</span>
        </div>
        <h2 className="font-serif text-[22px] font-bold text-on-surface">Admin Console</h2>
        <p className="font-sans text-xs text-outline max-w-xs leading-relaxed">
          Restricted portal for {merchant.brand.name} management and staff.
        </p>
      </div>

      {/* Mode Switcher */}
      <div className="w-full bg-surface-container-high p-1 rounded-xl flex items-center shadow-inner">
        <button
          type="button"
          onClick={() => {
            setMode('login');
            setErrorMsg(null);
          }}
          className={tab(mode === 'login')}
        >
          <span className="material-symbols-outlined text-[16px] text-primary">lock</span>
          <span>Sign In</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setMode('register');
            setErrorMsg(null);
          }}
          className={tab(mode === 'register')}
        >
          <span className="material-symbols-outlined text-[16px] text-primary">person_add</span>
          <span>Create Admin</span>
        </button>
      </div>

      {errorMsg && (
        <div className="bg-error-container text-error p-3 rounded-xl text-xs font-sans border border-error/30 flex items-start gap-2 shadow-xs animate-shake">
          <span className="material-symbols-outlined text-[19px] flex-shrink-0 text-error mt-0.5">gpp_bad</span>
          <div className="flex flex-col">
            <span className="font-bold text-[11px] uppercase tracking-wider">Access Denied</span>
            <span className="leading-tight mt-0.5">{errorMsg}</span>
          </div>
        </div>
      )}

      {successMsg && (
        <div className="bg-secondary-container text-on-secondary-fixed p-3 rounded-xl text-xs font-sans border border-secondary flex items-center gap-2 shadow-xs animate-fade-in">
          <span className="material-symbols-outlined text-[19px] text-secondary">verified</span>
          <span className="font-medium">{successMsg}</span>
        </div>
      )}

      {mode === 'login' ? (
        <form onSubmit={handleLoginSubmit} className="space-y-3 bg-white p-4 rounded-xl border border-outline-variant/40 shadow-xs">
          <div className="space-y-1">
            <label className="text-xs font-sans font-semibold text-on-surface" htmlFor="admin-id">
              Admin email
            </label>
            <div className="relative flex items-center bg-surface-container-low rounded-lg border border-outline-variant/40 focus-within:bg-white transition-colors">
              <span className="material-symbols-outlined text-[18px] text-outline pl-3">verified_user</span>
              <input
                id="admin-id"
                type="email"
                autoComplete="username"
                className="w-full bg-transparent px-3 py-2 text-xs font-mono text-on-surface focus:outline-none"
                value={adminId}
                onChange={(e) => setAdminId(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-sans font-semibold text-on-surface" htmlFor="admin-password">
              Password
            </label>
            <div className="relative flex items-center bg-surface-container-low rounded-lg border border-outline-variant/40 focus-within:bg-white transition-colors">
              <span className="material-symbols-outlined text-[18px] text-outline pl-3">key</span>
              <input
                id="admin-password"
                autoComplete="current-password"
                className="w-full bg-transparent px-3 py-2 text-xs font-mono text-on-surface focus:outline-none tracking-wider"
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button type="button" onClick={() => setShowPass(!showPass)} className="px-3 py-2 text-outline hover:text-on-surface">
                <span className="material-symbols-outlined text-[18px]">{showPass ? 'visibility_off' : 'visibility'}</span>
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 px-4 rounded-xl bg-on-surface hover:bg-black active:scale-[0.99] text-white flex items-center justify-between shadow-md transition-all mt-2"
          >
            <span className="flex items-center space-x-2">
              <span className="material-symbols-outlined text-[18px] text-primary-fixed">shield</span>
              <span className="font-sans text-xs font-bold tracking-wide uppercase">{isSubmitting ? 'Signing in...' : 'Sign In'}</span>
            </span>
            <span className="material-symbols-outlined text-primary-fixed text-[18px]">arrow_forward</span>
          </button>
        </form>
      ) : (
        <form onSubmit={handleRegisterAdminSubmit} className="space-y-3 bg-white p-4 rounded-xl border border-outline-variant/40 shadow-xs">
          <div className="bg-surface-container-low p-3 rounded-lg border border-outline-variant/40 space-y-1">
            <span className="font-mono text-[10px] uppercase font-bold text-primary block">Creating an admin account</span>
            <p className="text-[11px] text-on-surface-variant leading-tight">
              You need the <strong>Master Provisioning Key</strong>, which only the business owner holds. Failed attempts are logged.
            </p>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-sans font-semibold text-on-surface">Full name *</label>
            <input required className={field} value={newAdminName} onChange={(e) => setNewAdminName(e.target.value)} placeholder="e.g. Devendra Varma" />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-sans font-semibold text-on-surface">Email *</label>
            <input
              required
              type="email"
              className={`${field} font-mono`}
              value={newAdminEmail}
              onChange={(e) => setNewAdminEmail(e.target.value)}
              placeholder="name@company.com"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-sans font-semibold text-on-surface">Role *</label>
            <select value={newAdminRole} onChange={(e) => setNewAdminRole(e.target.value as (typeof ADMIN_ROLES)[number])} className={field}>
              {ADMIN_ROLES.map((r) => (
                <option key={r} value={r}>
                  {roleLabel(r)}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-sans font-semibold text-on-surface">Password *</label>
            <div className="relative flex items-center bg-surface-container-low rounded-lg border border-outline-variant/40 focus-within:bg-white">
              <input
                required
                minLength={10}
                autoComplete="new-password"
                type={showNewAdminPass ? 'text' : 'password'}
                className="w-full bg-transparent px-3 py-2 text-xs font-mono focus:outline-none"
                value={newAdminPass}
                onChange={(e) => setNewAdminPass(e.target.value)}
                placeholder="At least 10 characters"
              />
              <button type="button" onClick={() => setShowNewAdminPass(!showNewAdminPass)} className="px-3 text-outline hover:text-on-surface">
                <span className="material-symbols-outlined text-[17px]">{showNewAdminPass ? 'visibility_off' : 'visibility'}</span>
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-sans font-semibold text-on-surface">Master Provisioning Key *</label>
            <input
              required
              type="password"
              autoComplete="off"
              className={`${field} font-mono tracking-wider`}
              value={provisioningToken}
              onChange={(e) => setProvisioningToken(e.target.value)}
              placeholder="Enter the provisioning key"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 bg-primary hover:bg-primary-container text-white rounded-lg text-xs font-sans font-bold flex items-center justify-center space-x-1.5 shadow-md active:scale-[0.99] transition-all"
          >
            <span className="material-symbols-outlined text-[18px]">verified_user</span>
            <span>{isSubmitting ? 'Creating...' : 'Create Admin Account'}</span>
          </button>
        </form>
      )}

      {/* Audit notice */}
      <div className="bg-surface-container rounded-xl p-3 border border-outline-variant/40 shadow-xs text-left">
        <div className="flex items-start space-x-2">
          <span className="material-symbols-outlined text-outline text-[16px] mt-0.5">policy</span>
          <p className="font-sans text-[11px] leading-tight text-on-surface-variant">
            Authorized personnel only. Sign-in attempts and admin activity are recorded in the audit log.
          </p>
        </div>
      </div>

      <div className="text-center pt-1">
        <button
          onClick={() => onNavigate('retailer-auth')}
          className="inline-flex items-center space-x-1.5 font-sans text-xs text-primary hover:underline font-semibold"
        >
          <span className="material-symbols-outlined text-[14px]">arrow_back</span>
          <span>Return to Retailer Login</span>
        </button>
      </div>
    </div>
  );
};
