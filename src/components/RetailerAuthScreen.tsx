import React, { useState } from 'react';
import { ActiveScreen } from '../types';
import { api } from '../api';
import { merchant } from '../merchant';

interface RetailerAuthScreenProps {
  onNavigate: (screen: ActiveScreen) => void;
  onLoginSuccess: (user: { storeName: string; phone: string }) => void;
}

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
        onLoginSuccess({
          storeName: res.user.storeName,
          phone: res.user.phone
        });
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
      onLoginSuccess({
        storeName: res.user.storeName,
        phone: res.user.phone
      });
    } catch (err: any) {
      setErrorMessage(err.message || 'Registration failed. Please check your details.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col w-full max-w-md mx-auto px-4 py-4 pb-28">
      {/* Brand Header */}
      <div className="flex flex-col items-center text-center mb-4">
        <div className="w-12 h-12 rounded-xl bg-on-surface border border-primary-container/50 flex items-center justify-center shadow-md mb-2">
          <img
            alt={`${merchant.brand.name} Emblem`}
            className="w-8 h-8 object-contain"
            src={merchant.brand.logoUrl}
          />
        </div>
        <h2 className="font-serif text-[20px] font-bold text-on-surface tracking-wider leading-none">{merchant.brand.name.toUpperCase()}</h2>
        <span className="font-mono text-[11px] text-primary tracking-widest uppercase mt-0.5 font-semibold">
          B2B Retailer Gateway • Pure Gram Basis
        </span>
      </div>

      {/* Error Banner (Wrong password / Access Denied) */}
      {errorMessage && (
        <div className="mb-4 bg-error-container text-error p-3 rounded-xl text-xs font-sans border border-error/30 flex items-start gap-2 shadow-xs animate-shake">
          <span className="material-symbols-outlined text-[19px] flex-shrink-0 text-error mt-0.5">
            gpp_bad
          </span>
          <div className="flex flex-col">
            <span className="font-bold text-[11px] uppercase tracking-wider">Access Denied</span>
            <span className="leading-tight mt-0.5">{errorMessage}</span>
          </div>
        </div>
      )}

      {/* Success Banner */}
      {successMessage && (
        <div className="mb-4 bg-secondary-container text-on-secondary-fixed p-3 rounded-xl text-xs font-sans border border-secondary flex items-center gap-2 shadow-xs animate-fade-in">
          <span className="material-symbols-outlined text-[19px] text-secondary">verified</span>
          <span className="font-medium">{successMessage}</span>
        </div>
      )}

      {/* Mode Switcher */}
      <div className="w-full bg-surface-container-high p-1 rounded-xl flex items-center shadow-inner mb-4">
        <button
          onClick={() => {
            setActiveTab('signin');
            setErrorMessage(null);
          }}
          className={`flex-1 py-2 rounded-lg text-center transition-all flex items-center justify-center space-x-1.5 text-xs font-sans font-semibold ${
            activeTab === 'signin'
              ? 'bg-white shadow-xs text-on-surface'
              : 'text-on-surface-variant hover:text-on-surface'
          }`}
          type="button"
        >
          <span className="material-symbols-outlined text-[17px] text-primary">storefront</span>
          <span>Sign In</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('register');
            setErrorMessage(null);
          }}
          className={`flex-1 py-2 rounded-lg text-center transition-all flex items-center justify-center space-x-1.5 text-xs font-sans font-semibold ${
            activeTab === 'register'
              ? 'bg-white shadow-xs text-on-surface'
              : 'text-on-surface-variant hover:text-on-surface'
          }`}
          type="button"
        >
          <span className="material-symbols-outlined text-[17px] text-primary">person_add</span>
          <span>New Signup</span>
        </button>
      </div>

      {/* Tab 1: Sign In */}
      {activeTab === 'signin' && (
        <form onSubmit={handleSignIn} className="bg-white rounded-xl p-5 shadow-sm border border-outline-variant/40 flex flex-col space-y-4">
          {/* Registered Mobile Input */}
          <div className="flex flex-col space-y-1">
            <label className="text-xs font-sans text-on-surface font-semibold flex items-center justify-between">
              <span>Registered Phone</span>
              <span className="font-mono text-[11px] text-secondary flex items-center">
                <span className="material-symbols-outlined text-[13px] mr-0.5">verified_user</span>
                Verified Trade ID
              </span>
            </label>
            <div className="relative flex items-center bg-surface-container-low rounded-lg border border-outline-variant/40 focus-within:bg-white focus-within:border-primary/60 transition-all">
              <div className="flex items-center px-3 py-2.5 text-on-surface-variant space-x-1 border-r border-outline-variant/50">
                <span className="material-symbols-outlined text-[17px] text-primary">smartphone</span>
                <span className="font-mono text-xs font-semibold text-on-surface">+91</span>
              </div>
              <input
                className="w-full bg-transparent px-3 py-2.5 text-on-surface font-mono text-xs focus:outline-none tracking-wide"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="10-digit mobile number"
                type="tel"
                required
              />
            </div>
          </div>

          {/* Password Mode */}
                      <div className="flex flex-col space-y-1">
              <label className="text-xs font-sans text-on-surface font-semibold flex items-center justify-between">
                <span>Vault Security Password</span>
                <span className="text-[10px] text-outline">Strictly Checked</span>
              </label>
              <div className="relative flex items-center bg-surface-container-low rounded-lg border border-outline-variant/40 focus-within:bg-white focus-within:border-primary/60 transition-all">
                <span className="material-symbols-outlined text-[17px] text-primary pl-3">lock</span>
                <input
                  className="w-full bg-transparent px-3 py-2.5 text-on-surface text-xs font-sans focus:outline-none"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter vault security passkey"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="px-3 py-2.5 text-outline hover:text-on-surface"
                >
                  <span className="material-symbols-outlined text-[17px]">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

          {/* Controls */}
          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center space-x-2 cursor-pointer select-none">
              <input
                defaultChecked
                className="w-3.5 h-3.5 rounded text-primary accent-primary"
                type="checkbox"
              />
              <span className="text-[11px] font-sans text-on-surface-variant">Remember POS terminal</span>
            </label>
            <button
              type="button"
              onClick={() => alert(`Please contact ${merchant.brand.name} on ${merchant.contact.deskPhone} to reset your passkey.`)}
              className="text-[11px] font-sans text-primary hover:underline font-semibold"
            >
              Reset Passkey?
            </button>
          </div>

          {/* Enter Wholesale Portal CTA */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-primary to-primary-container text-white rounded-lg text-xs font-sans font-bold flex items-center justify-center space-x-2 shadow-md hover:opacity-95 active:scale-[0.99] transition-all"
          >
            <span>{loading ? 'Verifying Vault Credentials...' : 'Enter Wholesale Portal'}</span>
            <span className="material-symbols-outlined text-[17px]">arrow_forward</span>
          </button>

          <div className="pt-2 border-t border-surface-container flex flex-col items-center space-y-2">
            <p className="text-[11px] font-sans text-outline">
              Don&apos;t have a wholesale account?
            </p>
            <button
              onClick={() => {
                setActiveTab('register');
                setErrorMessage(null);
              }}
              className="w-full py-2.5 rounded-lg border border-outline-variant bg-surface-container-low hover:bg-surface-container-high text-primary text-xs font-sans font-semibold flex items-center justify-center space-x-1.5 transition-colors"
              type="button"
            >
              <span className="material-symbols-outlined text-[16px]">person_add</span>
              <span>Create New Trade Account</span>
            </button>
          </div>
        </form>
      )}

      {/* Tab 2: Register New Business */}
      {activeTab === 'register' && (
        <form
          onSubmit={handleRegister}
          className="bg-white rounded-xl p-5 shadow-sm border border-outline-variant/40 flex flex-col space-y-3.5"
        >
          <div className="flex items-center justify-between pb-1 border-b border-surface-container">
            <div className="flex flex-col">
              <span className="text-[10px] font-mono text-primary uppercase tracking-wider font-bold">
                B2B Institutional Onboarding
              </span>
              <h3 className="font-serif text-base font-bold text-on-surface">New Retailer Signup</h3>
            </div>
            <div className="w-8 h-8 rounded-full bg-secondary-fixed flex items-center justify-center text-on-secondary-fixed">
              <span className="material-symbols-outlined text-[18px]">app_registration</span>
            </div>
          </div>

          <div className="flex flex-col space-y-1">
            <label className="text-xs font-sans text-on-surface font-semibold">
              Business / Jewellery Firm Name *
            </label>
            <input
              required
              className="bg-surface-container-low px-3 py-2 rounded-lg text-xs font-sans text-on-surface border border-outline-variant/40 focus:outline-none focus:bg-white"
              value={firmName}
              onChange={(e) => setFirmName(e.target.value)}
              placeholder="e.g. Mahalakshmi Jewellers"
            />
          </div>

          <div className="flex flex-col space-y-1">
            <label className="text-xs font-sans text-on-surface font-semibold flex items-center justify-between">
              <span>GSTIN Number (15 Characters) *</span>
              <span className="px-1.5 py-0.5 rounded bg-secondary-container text-on-secondary-fixed font-mono text-[9px] font-bold">
                Verify GST
              </span>
            </label>
            <input
              required
              maxLength={15}
              className="bg-surface-container-low px-3 py-2 rounded-lg text-xs font-mono uppercase text-on-surface border border-outline-variant/40 focus:outline-none focus:bg-white tracking-wider"
              value={signupGstin}
              onChange={(e) => setSignupGstin(e.target.value)}
              placeholder="27AAAAA0000A1Z5"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col space-y-1">
              <label className="text-xs font-sans text-on-surface font-semibold">
                Owner / Signatory Name *
              </label>
              <input
                required
                className="bg-surface-container-low px-3 py-2 rounded-lg text-xs font-sans text-on-surface border border-outline-variant/40 focus:outline-none focus:bg-white"
                value={signupOwner}
                onChange={(e) => setSignupOwner(e.target.value)}
                placeholder="Authorized contact"
              />
            </div>

            <div className="flex flex-col space-y-1">
              <label className="text-xs font-sans text-on-surface font-semibold">
                WhatsApp Phone *
              </label>
              <input
                required
                className="bg-surface-container-low px-3 py-2 rounded-lg text-xs font-mono text-on-surface border border-outline-variant/40 focus:outline-none focus:bg-white"
                value={signupPhone}
                onChange={(e) => setSignupPhone(e.target.value)}
                placeholder="9820055555"
              />
            </div>
          </div>

          <div className="flex flex-col space-y-1">
            <label className="text-xs font-sans text-on-surface font-semibold flex items-center justify-between">
              <span>Create Vault Security Password *</span>
              <span className="text-[10px] text-outline">Min 6 characters</span>
            </label>
            <div className="relative flex items-center bg-surface-container-low rounded-lg border border-outline-variant/40 focus-within:bg-white">
              <input
                required
                type={showSignupPassword ? 'text' : 'password'}
                className="w-full bg-transparent px-3 py-2 text-xs font-sans text-on-surface focus:outline-none"
                value={signupPassword}
                onChange={(e) => setSignupPassword(e.target.value)}
                placeholder="Set alphanumeric passkey"
              />
              <button
                type="button"
                onClick={() => setShowSignupPassword(!showSignupPassword)}
                className="px-3 text-outline hover:text-on-surface"
              >
                <span className="material-symbols-outlined text-[17px]">
                  {showSignupPassword ? 'visibility_off' : 'visibility'}
                </span>
              </button>
            </div>
          </div>

          <div className="flex flex-col space-y-1">
            <label className="text-xs font-sans text-on-surface font-semibold">
              Store City / Market Hub
            </label>
            <input
              required
              className="bg-surface-container-low px-3 py-2 rounded-lg text-xs font-sans text-on-surface border border-outline-variant/40 focus:outline-none focus:bg-white"
              value={signupMarketHub}
              onChange={(e) => setSignupMarketHub(e.target.value)}
              placeholder={merchant.onboarding.marketHubPlaceholder}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-primary hover:bg-primary-container text-white rounded-lg text-xs font-sans font-bold flex items-center justify-center space-x-1.5 shadow-md active:scale-[0.99] transition-all"
          >
            <span>{loading ? 'Creating Trade Account...' : 'Complete Trade Signup & Enter'}</span>
            <span className="material-symbols-outlined text-[17px]">arrow_forward</span>
          </button>
        </form>
      )}

      {/* Trust & Verification Badges */}
      <div className="mt-5 flex flex-col space-y-3">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-surface-container-low p-2 rounded-lg flex flex-col items-center justify-center space-y-1 border border-outline-variant/40">
            <span className="material-symbols-outlined text-[18px] text-primary">verified</span>
            <span className="text-[9px] font-sans font-semibold leading-tight text-on-surface">
              BIS 100% Hallmarked
            </span>
          </div>

          <div className="bg-surface-container-low p-2 rounded-lg flex flex-col items-center justify-center space-y-1 border border-outline-variant/40">
            <span className="material-symbols-outlined text-[18px] text-primary">assignment_turned_in</span>
            <span className="text-[9px] font-sans font-semibold leading-tight text-on-surface">
              GST Registered Entities
            </span>
          </div>

          <div className="bg-surface-container-low p-2 rounded-lg flex flex-col items-center justify-center space-y-1 border border-outline-variant/40">
            <span className="material-symbols-outlined text-[18px] text-primary">enhanced_encryption</span>
            <span className="text-[9px] font-sans font-semibold leading-tight text-on-surface">
              256-Bit Encrypted Vault
            </span>
          </div>
        </div>

        {/* Store Admin Switch */}
        <div className="text-center pt-1">
          <button
            onClick={() => onNavigate('admin-login')}
            className="text-xs font-sans text-primary hover:underline font-bold inline-flex items-center space-x-1"
          >
            <span>Admin Console Login & Provisioning →</span>
          </button>
        </div>
      </div>
    </div>
  );
};
