import React, { useState } from 'react';
import { ActiveScreen } from '../types';
import { api } from '../api';
import { merchant } from '../merchant';
import { ADMIN_ROLES } from '../../shared/roles';
import { usePlan } from '../plan';
import { Field, I, Notice } from './ui';
import { AdminForgotPassword } from './AdminForgotPassword';
import { WelcomeGreeting } from './WelcomeGreeting';

interface AdminLoginScreenProps {
  onNavigate: (screen: ActiveScreen) => void;
  /** mustChangePassword: the admin signed in with a temporary password and must set their own before anything else. */
  onAdminLoginSuccess: (mustChangePassword: boolean, email: string) => void;
}

/** Administrator sign-in (artboard 1.7). Creating an admin with the provisioning key stays one quiet link away. */
export const AdminLoginScreen: React.FC<AdminLoginScreenProps> = ({ onNavigate, onAdminLoginSuccess }) => {
  const [mode, setMode] = useState<'login' | 'forgot'>('login');
  // After a good sign-in, a 2 s greeting runs before the admin hub opens.
  const [welcome, setWelcome] = useState<{ name: string; mustChange: boolean; email: string } | null>(null);

  // Sign in
  const [adminId, setAdminId] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [remember, setRemember] = useState(true);

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
      const res = await api.loginAdmin({ adminId: adminId.trim(), password: password.trim(), remember });
      if (res.status === 'success') {
        setWelcome({ name: res.admin.name, mustChange: Boolean(res.admin.mustChangePassword), email: res.admin.email });
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

  if (welcome) {
    return <WelcomeGreeting title={`Welcome, ${welcome.name}`} subtitle="Opening your store…" onDone={() => onAdminLoginSuccess(welcome.mustChange, welcome.email)} />;
  }

  return (
    <div className="scroll no-tabs" style={{ gap: 16, maxWidth: 480 }}>
      {mode === 'login' ? (
        <form onSubmit={handleLoginSubmit} className="col" style={{ gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 32, lineHeight: 1.05 }}>Sign in to your store</h1>
            <p className="sub" style={{ marginTop: 6 }}>
              The administrator of {merchant.brand.name} signs in with email and password.
            </p>
          </div>
          {errorMsg && <Notice tone="error">{errorMsg}</Notice>}
          {successMsg && <Notice tone="ok">{successMsg}</Notice>}
          <Field label="Admin email" htmlFor="admin-id">
            <input id="admin-id" data-testid="admin-email-input" type="email" autoComplete="username" className="inp" value={adminId} onChange={(e) => setAdminId(e.target.value)} placeholder="name@company.com" required />
          </Field>
          <Field label="Password" htmlFor="admin-password">
            <div className="relative">
              <input id="admin-password" data-testid="admin-password-input" autoComplete="current-password" className="inp" style={{ paddingRight: 48 }} type={showPass ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" required />
              {eye(showPass, () => setShowPass(!showPass))}
            </div>
          </Field>
          <label className="row" style={{ gap: 10, cursor: 'pointer', fontSize: 14.5 }}>
            <input type="checkbox" data-testid="admin-remember" checked={remember} onChange={(e) => setRemember(e.target.checked)} style={{ width: 20, height: 20, accentColor: 'var(--plum)' }} />
            <span>
              Keep me signed in <span className="sub" style={{ fontSize: 13 }}>· a month on this device, otherwise 8 hours</span>
            </span>
          </label>
          <button type="submit" disabled={isSubmitting} className="btn" data-testid="admin-login-submit">
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </button>
          <button type="button" className="lnk" style={{ alignSelf: 'center' }} onClick={() => { setErrorMsg(null); setSuccessMsg(null); setMode('forgot'); }}>
            Forgot password?
          </button>
          <p className="hint" style={{ textAlign: 'center' }}>
            Buyers do not use this page. They sign in with a WhatsApp code.
          </p>
        </form>
      ) : (
        <AdminForgotPassword email={adminId} onBack={() => setMode('login')} onDone={(msg) => { setSuccessMsg(msg); setMode('login'); }} />
      )}

      <div className="col" style={{ alignItems: 'center', gap: 0 }}>
        <button type="button" className="lnk" onClick={() => onNavigate('retailer-auth')}>
          Buyer sign in
        </button>
      </div>
    </div>
  );
};
