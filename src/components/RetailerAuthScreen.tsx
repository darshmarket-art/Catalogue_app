import React, { useState } from 'react';
import { ActiveScreen } from '../types';
import { api } from '../api';

interface RetailerAuthScreenProps {
  onNavigate: (screen: ActiveScreen) => void;
  onLoginSuccess: (user: { storeName: string; phone: string }) => void;
}

export const RetailerAuthScreen: React.FC<RetailerAuthScreenProps> = ({
  onNavigate,
  onLoginSuccess
}) => {
  const [activeTab, setActiveTab] = useState<'signin' | 'register'>('signin');
  const [authMethod, setAuthMethod] = useState<'pass' | 'wa'>('pass');
  
  // Login fields
  const [phone, setPhone] = useState('9820012345');
  const [password, setPassword] = useState('Password@123');
  const [showPassword, setShowPassword] = useState(false);

  // Signup fields
  const [firmName, setFirmName] = useState('Mahalaxmi Jewellers');
  const [signupGstin, setSignupGstin] = useState('27AAAAA1234A1Z5');
  const [signupOwner, setSignupOwner] = useState('Rajeshbhai Soni');
  const [signupPhone, setSignupPhone] = useState('9820055555');
  const [signupPassword, setSignupPassword] = useState('TradePass@2026');
  const [signupMarketHub, setSignupMarketHub] = useState('Zaveri Bazaar, Mumbai');
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
        password: password.trim(),
        authMode: authMethod
      });

      if (res.status === 'success') {
        setSuccessMessage(`Authenticated as ${res.user.storeName}. Directing to Wholesale Portal...`);
        onLoginSuccess({
          storeName: res.user.storeName,
          phone: res.user.phone
        });
        setTimeout(() => onNavigate('catalogue'), 800);
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
      setTimeout(() => onNavigate('catalogue'), 1000);
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
        <div className="w-12 h-12 rounded-xl bg-[#1c1c1a] border border-[#8c6d23]/50 flex items-center justify-center shadow-md mb-2">
          <img
            alt="Bhakti Jewels Emblem"
            className="w-8 h-8 object-contain"
            src="https://lh3.googleusercontent.com/aida/AEtjO1VdGKDX2JJLvPQjLLA6lYX5K9TXr2ZztCAHkiZKCnWndAGu34Blgsa_33mjxJ8h2k1hUAJ9zIfaKO_nm0eyAhyQt8a-_HWBmr8RCBRlUp2RkTRqOFMFiEfz9qCZNvco4hciRATYoequNx184gY2_nXvcD1EbZRZ1HOoxRsu6lYEF-59C1beTq3p5SoWHDuhbE-CC-Qa21TeepZZrpI7RHAwwojW1Tb8-2bV-2oWodWSR7Ezmt98JOKYNQ"
          />
        </div>
        <h2 className="font-serif text-[20px] font-bold text-[#1c1c1a] tracking-wider leading-none">
          BHAKTI JEWELS
        </h2>
        <span className="font-mono text-[11px] text-[#715509] tracking-widest uppercase mt-0.5 font-semibold">
          B2B Retailer Gateway • Pure Gram Basis
        </span>
      </div>

      {/* Error Banner (Wrong password / Access Denied) */}
      {errorMessage && (
        <div className="mb-4 bg-[#ffdad6] text-[#ba1a1a] p-3 rounded-xl text-xs font-sans border border-[#ba1a1a]/30 flex items-start gap-2 shadow-xs animate-shake">
          <span className="material-symbols-outlined text-[19px] flex-shrink-0 text-[#ba1a1a] mt-0.5">
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
        <div className="mb-4 bg-[#c7e7d7] text-[#032017] p-3 rounded-xl text-xs font-sans border border-[#486458] flex items-center gap-2 shadow-xs animate-fade-in">
          <span className="material-symbols-outlined text-[19px] text-[#486458]">verified</span>
          <span className="font-medium">{successMessage}</span>
        </div>
      )}

      {/* Quick Test Helper Card */}
      <div className="mb-4 bg-[#f0edea] p-2.5 rounded-lg border border-[#d1c5b3]/40 text-left text-[11px]">
        <div className="flex items-center justify-between text-[#715509] font-bold font-mono text-[10px] uppercase">
          <span>Demo Credentials in Database</span>
          <span className="text-[#486458]">Persistent</span>
        </div>
        <div className="mt-1 flex flex-col gap-0.5 text-[#4d4638] font-mono text-[10px]">
          <div>• Registered Phone: <span className="font-bold text-[#1c1c1a]">9820012345</span></div>
          <div>• Valid Passkey: <span className="font-bold text-[#1c1c1a]">Password@123</span></div>
          <div className="text-[#7f7666] italic font-sans text-[10px] mt-0.5">
            (Enter any other password to test the &quot;Access Denied&quot; rejection response)
          </div>
        </div>
      </div>

      {/* Mode Switcher */}
      <div className="w-full bg-[#ebe8e4] p-1 rounded-xl flex items-center shadow-inner mb-4">
        <button
          onClick={() => {
            setActiveTab('signin');
            setErrorMessage(null);
          }}
          className={`flex-1 py-2 rounded-lg text-center transition-all flex items-center justify-center space-x-1.5 text-xs font-sans font-semibold ${
            activeTab === 'signin'
              ? 'bg-white shadow-xs text-[#1c1c1a]'
              : 'text-[#4d4638] hover:text-[#1c1c1a]'
          }`}
          type="button"
        >
          <span className="material-symbols-outlined text-[17px] text-[#715509]">storefront</span>
          <span>Sign In</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('register');
            setErrorMessage(null);
          }}
          className={`flex-1 py-2 rounded-lg text-center transition-all flex items-center justify-center space-x-1.5 text-xs font-sans font-semibold ${
            activeTab === 'register'
              ? 'bg-white shadow-xs text-[#1c1c1a]'
              : 'text-[#4d4638] hover:text-[#1c1c1a]'
          }`}
          type="button"
        >
          <span className="material-symbols-outlined text-[17px] text-[#715509]">person_add</span>
          <span>New Signup</span>
        </button>
      </div>

      {/* Tab 1: Sign In */}
      {activeTab === 'signin' && (
        <form onSubmit={handleSignIn} className="bg-white rounded-xl p-5 shadow-sm border border-[#d1c5b3]/40 flex flex-col space-y-4">
          {/* Method Selector: WhatsApp OTP vs Password */}
          <div className="flex items-center justify-between pb-1">
            <span className="font-sans text-[11px] uppercase tracking-wider text-[#7f7666] font-semibold">
              Authentication Mode
            </span>
            <div className="flex items-center space-x-1 bg-[#f6f3ef] p-0.5 rounded-lg border border-[#d1c5b3]/30">
              <button
                onClick={() => setAuthMethod('wa')}
                className={`px-2.5 py-1 text-[11px] font-sans rounded transition-colors ${
                  authMethod === 'wa'
                    ? 'bg-white text-[#715509] shadow-xs font-bold'
                    : 'text-[#4d4638]'
                }`}
                type="button"
              >
                WhatsApp OTP
              </button>
              <button
                onClick={() => setAuthMethod('pass')}
                className={`px-2.5 py-1 text-[11px] font-sans rounded transition-colors ${
                  authMethod === 'pass'
                    ? 'bg-white text-[#715509] shadow-xs font-bold'
                    : 'text-[#4d4638]'
                }`}
                type="button"
              >
                Password
              </button>
            </div>
          </div>

          {/* Registered Mobile Input */}
          <div className="flex flex-col space-y-1">
            <label className="text-xs font-sans text-[#1c1c1a] font-semibold flex items-center justify-between">
              <span>Registered Phone</span>
              <span className="font-mono text-[11px] text-[#486458] flex items-center">
                <span className="material-symbols-outlined text-[13px] mr-0.5">verified_user</span>
                Verified Trade ID
              </span>
            </label>
            <div className="relative flex items-center bg-[#f6f3ef] rounded-lg border border-[#d1c5b3]/40 focus-within:bg-white focus-within:border-[#715509]/60 transition-all">
              <div className="flex items-center px-3 py-2.5 text-[#4d4638] space-x-1 border-r border-[#d1c5b3]/50">
                <span className="material-symbols-outlined text-[17px] text-[#715509]">smartphone</span>
                <span className="font-mono text-xs font-semibold text-[#1c1c1a]">+91</span>
              </div>
              <input
                className="w-full bg-transparent px-3 py-2.5 text-[#1c1c1a] font-mono text-xs focus:outline-none tracking-wide"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="9820012345"
                type="tel"
                required
              />
            </div>
          </div>

          {/* Password Mode */}
          {authMethod === 'pass' ? (
            <div className="flex flex-col space-y-1">
              <label className="text-xs font-sans text-[#1c1c1a] font-semibold flex items-center justify-between">
                <span>Vault Security Password</span>
                <span className="text-[10px] text-[#7f7666]">Strictly Checked</span>
              </label>
              <div className="relative flex items-center bg-[#f6f3ef] rounded-lg border border-[#d1c5b3]/40 focus-within:bg-white focus-within:border-[#715509]/60 transition-all">
                <span className="material-symbols-outlined text-[17px] text-[#715509] pl-3">lock</span>
                <input
                  className="w-full bg-transparent px-3 py-2.5 text-[#1c1c1a] text-xs font-sans focus:outline-none"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter vault security passkey"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="px-3 py-2.5 text-[#7f7666] hover:text-[#1c1c1a]"
                >
                  <span className="material-symbols-outlined text-[17px]">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-[#c7e7d7]/40 p-3 rounded-lg flex items-start space-x-2.5 border border-[#486458]/20">
              <span className="material-symbols-outlined text-[19px] text-[#486458] mt-0.5">
                mark_chat_read
              </span>
              <div className="flex flex-col">
                <span className="text-xs font-sans text-[#032017] font-semibold">
                  1-Tap WhatsApp Verification
                </span>
                <p className="text-[11px] font-sans text-[#304c41] leading-tight mt-0.5">
                  Authenticated session code is transmitted directly to your verified trade mobile via WhatsApp Business API.
                </p>
              </div>
            </div>
          )}

          {/* Controls */}
          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center space-x-2 cursor-pointer select-none">
              <input
                defaultChecked
                className="w-3.5 h-3.5 rounded text-[#715509] accent-[#715509]"
                type="checkbox"
              />
              <span className="text-[11px] font-sans text-[#4d4638]">Remember POS terminal</span>
            </label>
            <button
              type="button"
              onClick={() => alert('Password reset PIN sent to registered WhatsApp: 9820012345')}
              className="text-[11px] font-sans text-[#715509] hover:underline font-semibold"
            >
              Reset Passkey?
            </button>
          </div>

          {/* Enter Wholesale Portal CTA */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-[#715509] to-[#8c6d23] text-white rounded-lg text-xs font-sans font-bold flex items-center justify-center space-x-2 shadow-md hover:opacity-95 active:scale-[0.99] transition-all"
          >
            <span>{loading ? 'Verifying Vault Credentials...' : 'Enter Wholesale Portal'}</span>
            <span className="material-symbols-outlined text-[17px]">arrow_forward</span>
          </button>

          {/* Instant WhatsApp Auth Button */}
          <button
            onClick={() => {
              setAuthMethod('wa');
              handleSignIn();
            }}
            type="button"
            className="w-full py-2.5 bg-[#c7e7d7] text-[#032017] hover:bg-[#b0d9c4] rounded-lg text-xs font-sans font-semibold flex items-center justify-center space-x-2 active:scale-[0.99] transition-all border border-[#486458]/30"
          >
            <span className="material-symbols-outlined text-[18px] text-[#486458]">chat</span>
            <span>Instant WhatsApp OTP Verification</span>
          </button>

          <div className="pt-2 border-t border-[#f0edea] flex flex-col items-center space-y-2">
            <p className="text-[11px] font-sans text-[#7f7666]">
              Don&apos;t have a wholesale account?
            </p>
            <button
              onClick={() => {
                setActiveTab('register');
                setErrorMessage(null);
              }}
              className="w-full py-2.5 rounded-lg border border-[#d1c5b3] bg-[#f6f3ef] hover:bg-[#ebe8e4] text-[#715509] text-xs font-sans font-semibold flex items-center justify-center space-x-1.5 transition-colors"
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
          className="bg-white rounded-xl p-5 shadow-sm border border-[#d1c5b3]/40 flex flex-col space-y-3.5"
        >
          <div className="flex items-center justify-between pb-1 border-b border-[#f0edea]">
            <div className="flex flex-col">
              <span className="text-[10px] font-mono text-[#715509] uppercase tracking-wider font-bold">
                B2B Institutional Onboarding
              </span>
              <h3 className="font-serif text-base font-bold text-[#1c1c1a]">New Retailer Signup</h3>
            </div>
            <div className="w-8 h-8 rounded-full bg-[#caeada] flex items-center justify-center text-[#032017]">
              <span className="material-symbols-outlined text-[18px]">app_registration</span>
            </div>
          </div>

          <div className="flex flex-col space-y-1">
            <label className="text-xs font-sans text-[#1c1c1a] font-semibold">
              Business / Jewellery Firm Name *
            </label>
            <input
              required
              className="bg-[#f6f3ef] px-3 py-2 rounded-lg text-xs font-sans text-[#1c1c1a] border border-[#d1c5b3]/40 focus:outline-none focus:bg-white"
              value={firmName}
              onChange={(e) => setFirmName(e.target.value)}
              placeholder="e.g. Mahalakshmi Jewellers"
            />
          </div>

          <div className="flex flex-col space-y-1">
            <label className="text-xs font-sans text-[#1c1c1a] font-semibold flex items-center justify-between">
              <span>GSTIN Number (15 Characters) *</span>
              <span className="px-1.5 py-0.5 rounded bg-[#c7e7d7] text-[#032017] font-mono text-[9px] font-bold">
                Verify GST
              </span>
            </label>
            <input
              required
              maxLength={15}
              className="bg-[#f6f3ef] px-3 py-2 rounded-lg text-xs font-mono uppercase text-[#1c1c1a] border border-[#d1c5b3]/40 focus:outline-none focus:bg-white tracking-wider"
              value={signupGstin}
              onChange={(e) => setSignupGstin(e.target.value)}
              placeholder="27AAAAA0000A1Z5"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col space-y-1">
              <label className="text-xs font-sans text-[#1c1c1a] font-semibold">
                Owner / Signatory Name *
              </label>
              <input
                required
                className="bg-[#f6f3ef] px-3 py-2 rounded-lg text-xs font-sans text-[#1c1c1a] border border-[#d1c5b3]/40 focus:outline-none focus:bg-white"
                value={signupOwner}
                onChange={(e) => setSignupOwner(e.target.value)}
                placeholder="Authorized contact"
              />
            </div>

            <div className="flex flex-col space-y-1">
              <label className="text-xs font-sans text-[#1c1c1a] font-semibold">
                WhatsApp Phone *
              </label>
              <input
                required
                className="bg-[#f6f3ef] px-3 py-2 rounded-lg text-xs font-mono text-[#1c1c1a] border border-[#d1c5b3]/40 focus:outline-none focus:bg-white"
                value={signupPhone}
                onChange={(e) => setSignupPhone(e.target.value)}
                placeholder="9820055555"
              />
            </div>
          </div>

          <div className="flex flex-col space-y-1">
            <label className="text-xs font-sans text-[#1c1c1a] font-semibold flex items-center justify-between">
              <span>Create Vault Security Password *</span>
              <span className="text-[10px] text-[#7f7666]">Min 6 characters</span>
            </label>
            <div className="relative flex items-center bg-[#f6f3ef] rounded-lg border border-[#d1c5b3]/40 focus-within:bg-white">
              <input
                required
                type={showSignupPassword ? 'text' : 'password'}
                className="w-full bg-transparent px-3 py-2 text-xs font-sans text-[#1c1c1a] focus:outline-none"
                value={signupPassword}
                onChange={(e) => setSignupPassword(e.target.value)}
                placeholder="Set alphanumeric passkey"
              />
              <button
                type="button"
                onClick={() => setShowSignupPassword(!showSignupPassword)}
                className="px-3 text-[#7f7666] hover:text-[#1c1c1a]"
              >
                <span className="material-symbols-outlined text-[17px]">
                  {showSignupPassword ? 'visibility_off' : 'visibility'}
                </span>
              </button>
            </div>
          </div>

          <div className="flex flex-col space-y-1">
            <label className="text-xs font-sans text-[#1c1c1a] font-semibold">
              Store City / Market Hub
            </label>
            <input
              required
              className="bg-[#f6f3ef] px-3 py-2 rounded-lg text-xs font-sans text-[#1c1c1a] border border-[#d1c5b3]/40 focus:outline-none focus:bg-white"
              value={signupMarketHub}
              onChange={(e) => setSignupMarketHub(e.target.value)}
              placeholder="e.g. Zaveri Bazaar, Karol Bagh, Manek Chowk"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-[#715509] hover:bg-[#8c6d23] text-white rounded-lg text-xs font-sans font-bold flex items-center justify-center space-x-1.5 shadow-md active:scale-[0.99] transition-all"
          >
            <span>{loading ? 'Creating Trade Account...' : 'Complete Trade Signup & Enter'}</span>
            <span className="material-symbols-outlined text-[17px]">arrow_forward</span>
          </button>
        </form>
      )}

      {/* Trust & Verification Badges */}
      <div className="mt-5 flex flex-col space-y-3">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-[#f6f3ef] p-2 rounded-lg flex flex-col items-center justify-center space-y-1 border border-[#d1c5b3]/40">
            <span className="material-symbols-outlined text-[18px] text-[#715509]">verified</span>
            <span className="text-[9px] font-sans font-semibold leading-tight text-[#1c1c1a]">
              BIS 100% Hallmarked
            </span>
          </div>

          <div className="bg-[#f6f3ef] p-2 rounded-lg flex flex-col items-center justify-center space-y-1 border border-[#d1c5b3]/40">
            <span className="material-symbols-outlined text-[18px] text-[#715509]">assignment_turned_in</span>
            <span className="text-[9px] font-sans font-semibold leading-tight text-[#1c1c1a]">
              GST Registered Entities
            </span>
          </div>

          <div className="bg-[#f6f3ef] p-2 rounded-lg flex flex-col items-center justify-center space-y-1 border border-[#d1c5b3]/40">
            <span className="material-symbols-outlined text-[18px] text-[#715509]">enhanced_encryption</span>
            <span className="text-[9px] font-sans font-semibold leading-tight text-[#1c1c1a]">
              256-Bit Encrypted Vault
            </span>
          </div>
        </div>

        {/* Store Admin Switch */}
        <div className="text-center pt-1">
          <button
            onClick={() => onNavigate('admin-login')}
            className="text-xs font-sans text-[#715509] hover:underline font-bold inline-flex items-center space-x-1"
          >
            <span>Admin Console Login & Provisioning →</span>
          </button>
        </div>
      </div>
    </div>
  );
};
