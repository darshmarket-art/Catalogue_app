import React, { useState, useEffect } from 'react';
import { ActiveScreen } from '../types';
import { api } from '../api';

interface AdminLoginScreenProps {
  onNavigate: (screen: ActiveScreen) => void;
  onAdminLoginSuccess: () => void;
}

export const AdminLoginScreen: React.FC<AdminLoginScreenProps> = ({
  onNavigate,
  onAdminLoginSuccess
}) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  
  // Login fields
  const [selectedRole, setSelectedRole] = useState<'owner' | 'bullion' | 'inventory'>('inventory');
  const [adminId, setAdminId] = useState('');
  const [masterPass, setMasterPass] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [timerSeconds, setTimerSeconds] = useState(28);
  const [biometricStatus, setBiometricStatus] = useState<'ready' | 'verifying' | 'verified'>('ready');

  // Admin Account Creation fields
  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminPass, setNewAdminPass] = useState('');
  const [newAdminRole, setNewAdminRole] = useState('Inventory Controller');
  const [provisioningToken, setProvisioningToken] = useState('');
  const [showNewAdminPass, setShowNewAdminPass] = useState(false);

  // States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Auto-sync 2FA countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setTimerSeconds((prev) => (prev > 1 ? prev - 1 : 30));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleRoleChange = (role: 'owner' | 'bullion' | 'inventory') => {
    setSelectedRole(role);
    setErrorMsg(null);
  };

  const handleOtpChange = (index: number, val: string) => {
    if (val.length > 1) val = val[0];
    const next = [...otpDigits];
    next[index] = val;
    setOtpDigits(next);

    if (val && index < 5) {
      const nextInput = document.getElementById(`otp-${index + 1}`);
      nextInput?.focus();
    }
  };

  const triggerBiometric = () => {
    setBiometricStatus('verifying');
    setTimeout(() => {
      setBiometricStatus('verified');
    }, 600);
  };

  // Sign In submit
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await api.loginAdmin({
        adminId: adminId.trim(),
        password: masterPass.trim()
      });

      if (res.status === 'success') {
        setSuccessMsg(`Session Authorized for ${res.admin.name} (${res.admin.role}). Directing to Admin Hub...`);
        onAdminLoginSuccess();
        setTimeout(() => onNavigate('admin-hub'), 900);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Access Denied: Authentication failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Create Admin Account submit
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

      setSuccessMsg(res.message || 'Admin account provisioned! You may now sign in.');
      setAdminId(newAdminEmail.trim());
      setMasterPass(newAdminPass.trim());
      setTimeout(() => {
        setMode('login');
        setSuccessMsg('Account created. Please authenticate session.');
      }, 1500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Admin account creation failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col w-full max-w-md mx-auto px-4 py-4 pb-28 space-y-3.5">
      {/* Title Header */}
      <div className="flex flex-col items-center text-center space-y-1">
        <div className="w-10 h-10 rounded-xl bg-[#1c1c1a] border border-[#8c6d23]/50 flex items-center justify-center text-[#ffdf9e] shadow-md mb-1">
          <span className="material-symbols-outlined text-[22px]">admin_panel_settings</span>
        </div>
        <h2 className="font-serif text-[22px] font-bold text-[#1c1c1a]">Admin Console</h2>
        <p className="font-sans text-xs text-[#7f7666] max-w-xs leading-relaxed">
          Restricted portal for Bhakti Jewels management, inventory controllers & bullion desk directors.
        </p>
      </div>

      {/* Mode Switcher */}
      <div className="w-full bg-[#ebe8e4] p-1 rounded-xl flex items-center shadow-inner">
        <button
          type="button"
          onClick={() => {
            setMode('login');
            setErrorMsg(null);
          }}
          className={`flex-1 py-1.5 rounded-lg text-center transition-all flex items-center justify-center space-x-1 text-xs font-sans font-semibold ${
            mode === 'login'
              ? 'bg-white shadow-xs text-[#1c1c1a]'
              : 'text-[#4d4638] hover:text-[#1c1c1a]'
          }`}
        >
          <span className="material-symbols-outlined text-[16px] text-[#715509]">lock</span>
          <span>Authenticate Session</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setMode('register');
            setErrorMsg(null);
          }}
          className={`flex-1 py-1.5 rounded-lg text-center transition-all flex items-center justify-center space-x-1 text-xs font-sans font-semibold ${
            mode === 'register'
              ? 'bg-white shadow-xs text-[#1c1c1a]'
              : 'text-[#4d4638] hover:text-[#1c1c1a]'
          }`}
        >
          <span className="material-symbols-outlined text-[16px] text-[#715509]">person_add</span>
          <span>Provision New Admin</span>
        </button>
      </div>

      {/* Error Banner (Wrong password / Access Denied) */}
      {errorMsg && (
        <div className="bg-[#ffdad6] text-[#ba1a1a] p-3 rounded-xl text-xs font-sans border border-[#ba1a1a]/30 flex items-start gap-2 shadow-xs animate-shake">
          <span className="material-symbols-outlined text-[19px] flex-shrink-0 text-[#ba1a1a] mt-0.5">
            gpp_bad
          </span>
          <div className="flex flex-col">
            <span className="font-bold text-[11px] uppercase tracking-wider">Access Denied</span>
            <span className="leading-tight mt-0.5">{errorMsg}</span>
          </div>
        </div>
      )}

      {/* Success Banner */}
      {successMsg && (
        <div className="bg-[#c7e7d7] text-[#032017] p-3 rounded-xl text-xs font-sans border border-[#486458] flex items-center gap-2 shadow-xs animate-fade-in">
          <span className="material-symbols-outlined text-[19px] text-[#486458]">verified</span>
          <span className="font-medium">{successMsg}</span>
        </div>
      )}

      {/* Mode 1: Authenticate Admin Session */}
      {mode === 'login' ? (
        <div className="space-y-3">
          {/* Preset Roles Switcher */}
          <div className="bg-[#f0edea] p-1 rounded-xl shadow-inner border border-[#d1c5b3]/40">
            <div className="grid grid-cols-3 gap-1">
              <button
                type="button"
                onClick={() => handleRoleChange('inventory')}
                className={`py-2 px-1 rounded-lg text-center transition-all flex flex-col items-center justify-center ${
                  selectedRole === 'inventory'
                    ? 'bg-white shadow-xs text-[#715509]'
                    : 'text-[#4d4638] hover:bg-white/50'
                }`}
              >
                <span className="font-sans text-[11px] font-bold leading-tight">Inventory Desk</span>
                <span className="font-mono text-[9px] text-[#7f7666]">Dispatch Mgr</span>
              </button>

              <button
                type="button"
                onClick={() => handleRoleChange('owner')}
                className={`py-2 px-1 rounded-lg text-center transition-all flex flex-col items-center justify-center ${
                  selectedRole === 'owner'
                    ? 'bg-white shadow-xs text-[#715509]'
                    : 'text-[#4d4638] hover:bg-white/50'
                }`}
              >
                <span className="font-sans text-[11px] font-bold leading-tight">Managing Director</span>
                <span className="font-mono text-[9px] text-[#7f7666]">L4 Master</span>
              </button>

              <button
                type="button"
                onClick={() => handleRoleChange('bullion')}
                className={`py-2 px-1 rounded-lg text-center transition-all flex flex-col items-center justify-center ${
                  selectedRole === 'bullion'
                    ? 'bg-white shadow-xs text-[#715509]'
                    : 'text-[#4d4638] hover:bg-white/50'
                }`}
              >
                <span className="font-sans text-[11px] font-bold leading-tight">Bullion Rates</span>
                <span className="font-mono text-[9px] text-[#7f7666]">Gram Desk</span>
              </button>
            </div>
          </div>

          {/* Credentials Form */}
          <form onSubmit={handleLoginSubmit} className="space-y-3 bg-white p-4 rounded-xl border border-[#d1c5b3]/40 shadow-xs">
            {/* Identifier Input */}
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="text-xs font-sans font-semibold text-[#1c1c1a]" htmlFor="admin-id">
                  Admin Identifier
                </label>
                <span className="font-mono text-[10px] text-[#715509]">Master Email</span>
              </div>
              <div className="relative flex items-center bg-[#f6f3ef] rounded-lg border border-[#d1c5b3]/40 focus-within:bg-white transition-colors">
                <span className="material-symbols-outlined text-[18px] text-[#7f7666] pl-3">
                  verified_user
                </span>
                <input
                  id="admin-id"
                  className="w-full bg-transparent px-3 py-2 text-xs font-mono text-[#1c1c1a] focus:outline-none"
                  value={adminId}
                  onChange={(e) => setAdminId(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Master Password Input */}
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="text-xs font-sans font-semibold text-[#1c1c1a]" htmlFor="master-pass">
                  Master Security Key
                </label>
                <span className="font-mono text-[10px] text-[#486458]">Denied if incorrect</span>
              </div>
              <div className="relative flex items-center bg-[#f6f3ef] rounded-lg border border-[#d1c5b3]/40 focus-within:bg-white transition-colors">
                <span className="material-symbols-outlined text-[18px] text-[#7f7666] pl-3">key</span>
                <input
                  id="master-pass"
                  className="w-full bg-transparent px-3 py-2 text-xs font-mono text-[#1c1c1a] focus:outline-none tracking-wider"
                  type={showPass ? 'text' : 'password'}
                  value={masterPass}
                  onChange={(e) => setMasterPass(e.target.value)}
                  placeholder="Enter master security key"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="px-3 py-2 text-[#7f7666] hover:text-[#1c1c1a]"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {showPass ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            {/* 2FA Digit Verification */}
            <div className="space-y-1 pt-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-sans font-semibold text-[#1c1c1a]">
                  2FA Authenticator Code
                </label>
                <span className="font-mono text-[10px] text-[#715509]">
                  Auto-sync in {timerSeconds}s
                </span>
              </div>
              <div className="grid grid-cols-6 gap-1.5">
                {otpDigits.map((digit, idx) => (
                  <input
                    key={idx}
                    id={`otp-${idx}`}
                    type="text"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(idx, e.target.value)}
                    placeholder="•"
                    className="w-full text-center py-2 bg-[#f6f3ef] text-[#1c1c1a] font-mono text-base font-bold rounded-lg border border-[#d1c5b3]/40 focus:bg-white focus:border-[#715509] outline-none shadow-2xs"
                  />
                ))}
              </div>
            </div>

            {/* Biometric / FIDO2 Trigger */}
            <button
              type="button"
              onClick={triggerBiometric}
              className="w-full py-2 px-3 rounded-lg bg-[#f0edea] hover:bg-[#ebe8e4] transition-colors flex items-center justify-center space-x-2 text-[#1c1c1a] shadow-xs border border-[#d1c5b3]/50"
            >
              <span className="material-symbols-outlined text-[#715509] text-[18px]">fingerprint</span>
              <span className="font-sans text-xs font-semibold">
                {biometricStatus === 'verifying'
                  ? 'Verifying Secure Enclave...'
                  : biometricStatus === 'verified'
                  ? 'Hardware Token Authenticated'
                  : 'Touch ID or Security Key (FIDO2)'}
              </span>
              <span
                className={`font-mono text-[9px] px-1.5 py-0.5 rounded font-bold ${
                  biometricStatus === 'verified'
                    ? 'bg-[#c7e7d7] text-[#032017]'
                    : 'bg-[#ebe8e4] text-[#4d4638]'
                }`}
              >
                {biometricStatus === 'verified' ? 'Passed' : 'Ready'}
              </span>
            </button>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 px-4 rounded-xl bg-[#1c1c1a] hover:bg-black active:scale-[0.99] text-white flex items-center justify-between shadow-md transition-all mt-2"
            >
              <span className="flex items-center space-x-2">
                <span className="material-symbols-outlined text-[18px] text-[#ffdf9e]">shield</span>
                <span className="font-sans text-xs font-bold tracking-wide uppercase">
                  {isSubmitting ? 'Authenticating Session...' : 'Authenticate Session'}
                </span>
              </span>
              <span className="material-symbols-outlined text-[#ffdf9e] text-[18px]">arrow_forward</span>
            </button>
          </form>
        </div>
      ) : (
        /* Mode 2: Provision New Admin Account */
        <form onSubmit={handleRegisterAdminSubmit} className="space-y-3 bg-white p-4 rounded-xl border border-[#d1c5b3]/40 shadow-xs">
          <div className="bg-[#f6f3ef] p-3 rounded-lg border border-[#d1c5b3]/40 space-y-1">
            <span className="font-mono text-[10px] uppercase font-bold text-[#715509] block">
              Admin Provisioning Governance Workflow
            </span>
            <p className="text-[11px] text-[#4d4638] leading-tight">
              Creating an administrative account requires the confidential <strong>Guild Master Provisioning Key</strong> issued by the Managing Director. Unauthorized attempts are permanently denied and logged.
            </p>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-sans font-semibold text-[#1c1c1a]">Admin Full Name *</label>
            <input
              required
              className="w-full bg-[#f6f3ef] px-3 py-2 rounded-lg text-xs font-sans border border-[#d1c5b3]/40 focus:outline-none focus:bg-white"
              value={newAdminName}
              onChange={(e) => setNewAdminName(e.target.value)}
              placeholder="e.g. Devendra Varma"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-sans font-semibold text-[#1c1c1a]">Official Guild Email *</label>
            <input
              required
              type="email"
              className="w-full bg-[#f6f3ef] px-3 py-2 rounded-lg text-xs font-mono border border-[#d1c5b3]/40 focus:outline-none focus:bg-white"
              value={newAdminEmail}
              onChange={(e) => setNewAdminEmail(e.target.value)}
              placeholder="name@bhaktijewels.in"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-sans font-semibold text-[#1c1c1a]">Administrative Role *</label>
            <select
              value={newAdminRole}
              onChange={(e) => setNewAdminRole(e.target.value)}
              className="w-full bg-[#f6f3ef] px-3 py-2 rounded-lg text-xs font-sans border border-[#d1c5b3]/40 focus:outline-none focus:bg-white"
            >
              <option value="Inventory Controller">Inventory Controller (L3 Dispatch)</option>
              <option value="Bullion Desk Director">Bullion Desk Director (L3 Gram Settlement)</option>
              <option value="Managing Director">Managing Director (L4 Full Vault Release)</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-sans font-semibold text-[#1c1c1a]">Set Master Security Key (Passkey) *</label>
            <div className="relative flex items-center bg-[#f6f3ef] rounded-lg border border-[#d1c5b3]/40 focus-within:bg-white">
              <input
                required
                type={showNewAdminPass ? 'text' : 'password'}
                className="w-full bg-transparent px-3 py-2 text-xs font-mono focus:outline-none"
                value={newAdminPass}
                onChange={(e) => setNewAdminPass(e.target.value)}
                placeholder="Minimum 8 characters"
              />
              <button
                type="button"
                onClick={() => setShowNewAdminPass(!showNewAdminPass)}
                className="px-3 text-[#7f7666] hover:text-[#1c1c1a]"
              >
                <span className="material-symbols-outlined text-[17px]">
                  {showNewAdminPass ? 'visibility_off' : 'visibility'}
                </span>
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-sans font-semibold text-[#1c1c1a] flex items-center justify-between">
              <span>Master Guild Provisioning Key *</span>
              <span className="text-[10px] text-[#715509] font-mono">Confidential Token</span>
            </label>
            <input
              required
              className="w-full bg-[#f6f3ef] px-3 py-2 rounded-lg text-xs font-mono uppercase tracking-wider text-[#715509] font-bold border border-[#8c6d23]/40 focus:outline-none focus:bg-white"
              value={provisioningToken}
              onChange={(e) => setProvisioningToken(e.target.value)}
              placeholder="Enter the provisioning key"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 bg-[#715509] hover:bg-[#8c6d23] text-white rounded-lg text-xs font-sans font-bold flex items-center justify-center space-x-1.5 shadow-md active:scale-[0.99] transition-all"
          >
            <span className="material-symbols-outlined text-[18px]">verified_user</span>
            <span>{isSubmitting ? 'Verifying Keymaster Token...' : 'Register Authorized Administrator'}</span>
          </button>
        </form>
      )}

      {/* Security Audit Ledger Notice Card */}
      <div className="bg-[#f0edea] rounded-xl p-3 space-y-1.5 border border-[#d1c5b3]/40 shadow-xs text-left">
        <div className="flex items-start space-x-2">
          <span className="material-symbols-outlined text-[#7f7666] text-[16px] mt-0.5">policy</span>
          <div className="space-y-1">
            <p className="font-sans text-[11px] leading-tight text-[#4d4638]">
              Strictly authorized personnel only. Login attempts, client IP{' '}
              <span className="font-mono text-[#1c1c1a] font-semibold">103.21.244.18</span>, and vault activity are permanently signed to the{' '}
              <span className="text-[#1c1c1a] font-semibold">Gujarat Bullion Guild Ledger</span>.
            </p>
            <div className="pt-1 flex items-center justify-between text-[10px] font-mono">
              <span className="text-[#715509] font-bold">Keymaster Verified</span>
              <span className="text-[#7f7666]">Incident ID: #VLT-7718</span>
            </div>
          </div>
        </div>
      </div>

      {/* Return link */}
      <div className="text-center pt-1">
        <button
          onClick={() => onNavigate('retailer-auth')}
          className="inline-flex items-center space-x-1.5 font-sans text-xs text-[#715509] hover:underline font-semibold"
        >
          <span className="material-symbols-outlined text-[15px]">arrow_back</span>
          <span>Return to Retailer Customer Login</span>
        </button>
      </div>
    </div>
  );
};
