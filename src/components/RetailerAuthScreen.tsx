import React, { useState } from 'react';
import { ActiveScreen } from '../types';
import { api } from '../api';
import { merchant } from '../merchant';
import { PageTitle, Field, Notice, Segmented, inputClass, btnPrimary, btnLink } from './ui';
import type { ProfileUser } from './ProfileMenu';

interface RetailerAuthScreenProps {
  onNavigate: (screen: ActiveScreen) => void;
  onLoginSuccess: (user: ProfileUser, mustChangePassword: boolean) => void;
}

/** The buyer details the profile menu shows. */
const profileOf = (u: any): ProfileUser => ({
  storeName: u.storeName,
  phone: u.phone,
  ownerName: u.ownerName,
  gstin: u.gstin,
  marketHub: u.marketHub
});

export const RetailerAuthScreen: React.FC<RetailerAuthScreenProps> = ({
  onNavigate,
  onLoginSuccess
}) => {
  const [activeTab, setActiveTab] = useState<'signin' | 'register'>('signin');
  
  // Login fields
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Signup fields
  const [firmName, setFirmName] = useState('');
  const [signupGstin, setSignupGstin] = useState('');
  const [signupOwner, setSignupOwner] = useState('');
  const [signupPhone, setSignupPhone] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupMarketHub, setSignupMarketHub] = useState(merchant.onboarding.defaultMarketHub);
  const [showSignupPassword, setShowSignupPassword] = useState(false);

  // Feedback states
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSignIn = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await api.loginRetailer({
        phone: phone.trim(),
        password: password.trim()
      });

      if (res.status === 'success') {
        setSuccessMessage(`Authenticated as ${res.user.storeName}. Directing to Wholesale Portal...`);
        onLoginSuccess(
          profileOf(res.user),
          Boolean(res.user.mustChangePassword)
        );
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Access Denied: Incorrect credentials');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await api.signupRetailer({
        firmName: firmName.trim(),
        gstin: signupGstin.trim(),
        ownerName: signupOwner.trim(),
        phone: signupPhone.trim(),
        password: signupPassword.trim(),
        marketHub: signupMarketHub.trim()
      });

      setSuccessMessage('Trade account created successfully! Automatically signing you in...');
      onLoginSuccess(profileOf(res.user), false);
    } catch (err: any) {
      setErrorMessage(err.message || 'Registration failed. Please check your details.');
    } finally {
      setLoading(false);
    }
  };

  const switchTab = (key: string) => {
    setActiveTab(key as 'signin' | 'register');
    setErrorMessage(null);
  };

  const eye = (shown: boolean, toggle: () => void) => (
    <button
      type="button"
      onClick={toggle}
      aria-label={shown ? 'Hide password' : 'Show password'}
      className="absolute right-1 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center text-outline"
    >
      <span className="material-symbols-outlined text-[22px]">{shown ? 'visibility_off' : 'visibility'}</span>
    </button>
  );

  return (
    <div className="flex flex-col w-full max-w-md mx-auto pb-28">
      <PageTitle
        title={activeTab === 'signin' ? 'Welcome back' : 'Create your account'}
        sub={activeTab === 'signin' ? 'Sign in with your mobile number to see the catalogue.' : `${merchant.brand.name} reviews new accounts before you can order.`}
      />

      <div className="px-5 flex flex-col gap-4">
        <Segmented
          options={[
            { key: 'signin', label: 'Sign in' },
            { key: 'register', label: 'Register' }
          ]}
          value={activeTab}
          onChange={switchTab}
        />

        {errorMessage && <Notice tone="error">{errorMessage}</Notice>}
        {successMessage && <Notice tone="ok">{successMessage}</Notice>}

        {activeTab === 'signin' && (
          <form onSubmit={handleSignIn} className="flex flex-col gap-4">
            <Field label="Mobile number" htmlFor="login-phone">
              <input id="login-phone" className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="10-digit mobile number" type="tel" autoComplete="tel" required />
            </Field>
            <Field label="Password" htmlFor="login-password">
              <div className="relative">
                <input
                  id="login-password"
                  className={`${inputClass} pr-12`}
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                />
                {eye(showPassword, () => setShowPassword(!showPassword))}
              </div>
            </Field>
            <button type="submit" disabled={loading} className={btnPrimary}>
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
            <div className="flex flex-col items-center">
              <button
                type="button"
                onClick={() => alert(`Please contact ${merchant.brand.name} on ${merchant.contact.deskPhone} to reset your password.`)}
                className={btnLink}
              >
                Forgot your password?
              </button>
              <button type="button" onClick={() => switchTab('register')} className={btnLink}>
                New here? Register your store
              </button>
            </div>
          </form>
        )}

        {activeTab === 'register' && (
          <form onSubmit={handleRegister} className="flex flex-col gap-4">
            <Field label="Firm name" htmlFor="reg-firm">
              <input id="reg-firm" required className={inputClass} value={firmName} onChange={(e) => setFirmName(e.target.value)} placeholder="e.g. Mahalakshmi Jewellers" />
            </Field>
            <Field label="GST number" htmlFor="reg-gst" hint="15 characters">
              <input id="reg-gst" required maxLength={15} className={`${inputClass} uppercase tracking-wider`} value={signupGstin} onChange={(e) => setSignupGstin(e.target.value)} placeholder="27AAAAA0000A1Z5" />
            </Field>
            <Field label="Owner name" htmlFor="reg-owner">
              <input id="reg-owner" required className={inputClass} value={signupOwner} onChange={(e) => setSignupOwner(e.target.value)} placeholder="Your name" />
            </Field>
            <Field label="Mobile number (WhatsApp)" htmlFor="reg-phone">
              <input id="reg-phone" required type="tel" className={inputClass} value={signupPhone} onChange={(e) => setSignupPhone(e.target.value)} placeholder="9820055555" />
            </Field>
            <Field label="Create a password" htmlFor="reg-password" hint="At least 6 characters">
              <div className="relative">
                <input
                  id="reg-password"
                  required
                  type={showSignupPassword ? 'text' : 'password'}
                  className={`${inputClass} pr-12`}
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                  placeholder="Choose a password"
                  autoComplete="new-password"
                />
                {eye(showSignupPassword, () => setShowSignupPassword(!showSignupPassword))}
              </div>
            </Field>
            <Field label="City or market" htmlFor="reg-hub">
              <input id="reg-hub" required className={inputClass} value={signupMarketHub} onChange={(e) => setSignupMarketHub(e.target.value)} placeholder={merchant.onboarding.marketHubPlaceholder} />
            </Field>
            <button type="submit" disabled={loading} className={btnPrimary}>
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>
        )}

        {/* Staff entry: deliberately quiet, so buyers are not shown admin tools */}
        <div className="text-center pt-2">
          <button onClick={() => onNavigate('admin-login')} className={btnLink} type="button">
            Staff sign-in
          </button>
        </div>
      </div>
    </div>
  );
};
