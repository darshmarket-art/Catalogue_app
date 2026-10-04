import React, { useState } from 'react';
import { ActiveScreen } from '../types';
import { api } from '../api';
import { merchant } from '../merchant';
import { BrandMark } from './BrandMark';
import { I, Notice } from './ui';
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

/** Buyer sign-in (artboard 2.1): number first, then the code sent on WhatsApp. New numbers get an account. */
export const RetailerAuthScreen: React.FC<RetailerAuthScreenProps> = ({ onNavigate, onLoginSuccess }) => {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [firmName, setFirmName] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const sendCode = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await api.requestOtp(phone.trim());
      setSuccessMessage(res.message);
      setCodeSent(true);
    } catch (err: any) {
      setErrorMessage(err.message || 'Could not send the code.');
    } finally {
      setLoading(false);
    }
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await api.verifyOtp({ phone: phone.trim(), code: code.trim(), firmName: firmName.trim() || undefined });
      onLoginSuccess(profileOf(res.user), false);
    } catch (err: any) {
      setErrorMessage(err.message || 'That code did not work.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="scroll no-tabs" style={{ gap: 16, maxWidth: 480 }}>
      <div className="col" style={{ alignItems: 'center', gap: 10, textAlign: 'center' }}>
        <div className="mark lg">
          <BrandMark className="w-12 h-12" textClassName="text-[36px]" />
        </div>
        <h1 style={{ fontSize: 28 }}>{merchant.brand.name}</h1>
        <p className="sub">{merchant.brand.tagline}</p>
      </div>

      {errorMessage && <Notice tone="error">{errorMessage}</Notice>}

      <form onSubmit={sendCode} className="card col" style={{ gap: 14, padding: 18 }}>
        <h2 style={{ fontSize: 22 }}>Sign in</h2>
        <p className="sub">We will send a code to your WhatsApp to see the catalogue.</p>
        <div>
          <label className="lab" htmlFor="login-firm">
            Shop name
          </label>
          <input id="login-firm" className="inp" value={firmName} onChange={(e) => setFirmName(e.target.value)} placeholder="e.g. Shree Jewellers" disabled={codeSent} />
          <p className="hint">Only if you are new here.</p>
        </div>
        <div>
          <label className="lab" htmlFor="login-phone">
            Mobile number (WhatsApp)
          </label>
          <input id="login-phone" className="inp" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="10-digit mobile number" type="tel" autoComplete="tel" required disabled={codeSent} />
        </div>
        {codeSent ? (
          <button
            type="button"
            className="lnk"
            style={{ alignSelf: 'flex-start' }}
            onClick={() => {
              setCodeSent(false);
              setCode('');
              setSuccessMessage(null);
            }}
          >
            Change number
          </button>
        ) : (
          <button type="submit" className="btn" disabled={loading}>
            <I n="whats" />
            {loading ? 'Sending…' : 'Send code'}
          </button>
        )}
      </form>

      {codeSent && (
        <form onSubmit={verify} className="card col" style={{ gap: 10, padding: 18 }}>
          {successMessage && <p className="note ok">{successMessage}</p>}
          <label className="lab" htmlFor="login-code" style={{ margin: 0 }}>
            6-digit code
          </label>
          <input id="login-code" className="inp" style={{ letterSpacing: '0.3em' }} value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required autoFocus />
          <button type="submit" className="btn alt" disabled={loading}>
            {loading ? 'Checking…' : 'Sign in'}
          </button>
          <button type="button" className="lnk" style={{ alignSelf: 'center' }} onClick={() => sendCode()} disabled={loading}>
            Send a new code
          </button>
          <p className="hint" style={{ margin: 0 }}>
            New number? You are added automatically while the store has room.
          </p>
        </form>
      )}

      {/* Staff entry: deliberately quiet, so buyers are not shown admin tools */}
      <button type="button" className="lnk" style={{ alignSelf: 'center' }} onClick={() => onNavigate('admin-login')}>
        Staff sign-in
      </button>
    </div>
  );
};
