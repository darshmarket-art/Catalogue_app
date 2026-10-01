import React, { useState } from 'react';
import { ActiveScreen } from '../types';
import { api } from '../api';
import { merchant } from '../merchant';
import { sector } from '../sector';
import { BrandMark } from './BrandMark';
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

  return (
    <div className="flex flex-col w-full max-w-md mx-auto px-4 py-4 pb-28">
      {/* Brand Header */}
      <div className="flex flex-col items-center text-center mb-4">
        <div className="w-12 h-12 rounded-xl bg-on-surface border border-primary-container/50 flex items-center justify-center shadow-md mb-2">
          <BrandMark className="w-8 h-8" textClassName="text-[22px]" />
        </div>
        <h2 className="font-serif text-[20px] font-bold text-on-surface tracking-wider leading-none">{merchant.brand.name.toUpperCase()}</h2>
        <span className="font-mono text-xs text-primary tracking-widest uppercase mt-0.5 font-semibold">
          Wholesale for retailers • {sector.copy.tradingModel}
        </span>
      </div>

      {/* Error Banner (Wrong password / Access Denied) */}
      {errorMessage && (
        <div className="mb-4 bg-error-container text-error p-3 rounded-xl text-xs font-sans border border-error/30 flex items-start gap-2 shadow-xs animate-shake">
          <span className="material-symbols-outlined text-[19px] flex-shrink-0 text-error mt-0.5">
            gpp_bad
          </span>
          <div className="flex flex-col">
            <span className="font-bold text-xs uppercase tracking-wider">Access Denied</span>
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
              <span>Mobile number</span>
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
                <span>Password</span>
              </label>
              <div className="relative flex items-center bg-surface-container-low rounded-lg border border-outline-variant/40 focus-within:bg-white focus-within:border-primary/60 transition-all">
                <span className="material-symbols-outlined text-[17px] text-primary pl-3">lock</span>
                <input
                  className="w-full bg-transparent px-3 py-2.5 text-on-surface text-xs font-sans focus:outline-none"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
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
          <div className="flex items-center justify-end pt-1">
            <button
              type="button"
              onClick={() => alert(`Please contact ${merchant.brand.name} on ${merchant.contact.deskPhone} to reset your password.`)}
              className="text-xs font-sans text-primary hover:underline font-semibold"
            >
              Forgot password?
            </button>
          </div>

          {/* Enter Wholesale Portal CTA */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-primary to-primary-container text-white rounded-lg text-xs font-sans font-bold flex items-center justify-center space-x-2 shadow-md hover:opacity-95 active:scale-[0.99] transition-all"
          >
            <span>{loading ? 'Signing in...' : 'Sign in'}</span>
            <span className="material-symbols-outlined text-[17px]">arrow_forward</span>
          </button>

          <div className="pt-2 border-t border-surface-container flex flex-col items-center space-y-2">
            <p className="text-xs font-sans text-outline">
              New to {merchant.brand.name}?
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
              <span>Create an account</span>
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
              <span className="text-xs font-mono text-primary uppercase tracking-wider font-bold">
                Wholesale account
              </span>
              <h3 className="font-serif text-base font-bold text-on-surface">Create your account</h3>
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
              <span>GST number (15 characters) *</span>
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
                Owner name *
              </label>
              <input
                required
                className="bg-surface-container-low px-3 py-2 rounded-lg text-xs font-sans text-on-surface border border-outline-variant/40 focus:outline-none focus:bg-white"
                value={signupOwner}
                onChange={(e) => setSignupOwner(e.target.value)}
                placeholder="Your name"
              />
            </div>

            <div className="flex flex-col space-y-1">
              <label className="text-xs font-sans text-on-surface font-semibold">
                WhatsApp number *
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
              <span>Create a password *</span>
              <span className="text-xs text-outline">At least 6 characters</span>
            </label>
            <div className="relative flex items-center bg-surface-container-low rounded-lg border border-outline-variant/40 focus-within:bg-white">
              <input
                required
                type={showSignupPassword ? 'text' : 'password'}
                className="w-full bg-transparent px-3 py-2 text-xs font-sans text-on-surface focus:outline-none"
                value={signupPassword}
                onChange={(e) => setSignupPassword(e.target.value)}
                placeholder="Choose a password"
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
              City / market
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
            <span>{loading ? 'Creating account...' : 'Create account'}</span>
            <span className="material-symbols-outlined text-[17px]">arrow_forward</span>
          </button>
        </form>
      )}

      {/* Trust & Verification Badges */}
      <div className="mt-5 flex flex-col space-y-3">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-surface-container-low p-2 rounded-lg flex flex-col items-center justify-center space-y-1 border border-outline-variant/40">
            <span className="material-symbols-outlined text-[18px] text-primary">verified</span>
            <span className="text-xs font-sans font-semibold leading-tight text-on-surface">
              BIS 100% Hallmarked
            </span>
          </div>

          <div className="bg-surface-container-low p-2 rounded-lg flex flex-col items-center justify-center space-y-1 border border-outline-variant/40">
            <span className="material-symbols-outlined text-[18px] text-primary">assignment_turned_in</span>
            <span className="text-xs font-sans font-semibold leading-tight text-on-surface">
              GST Registered Entities
            </span>
          </div>

          <div className="bg-surface-container-low p-2 rounded-lg flex flex-col items-center justify-center space-y-1 border border-outline-variant/40">
            <span className="material-symbols-outlined text-[18px] text-primary">enhanced_encryption</span>
            <span className="text-xs font-sans font-semibold leading-tight text-on-surface">
              Secure sign-in
            </span>
          </div>
        </div>

        {/* Staff entry: deliberately quiet, so buyers are not shown admin tools */}
        <div className="text-center pt-1">
          <button
            onClick={() => onNavigate('admin-login')}
            className="text-xs font-sans text-on-surface-variant hover:text-primary hover:underline"
          >
            Staff sign-in
          </button>
        </div>
      </div>
    </div>
  );
};
