import React, { useEffect, useState } from 'react';
import { ActiveScreen } from '../types';
import { api } from '../api';
import { merchant } from '../merchant';
import { Icon } from '../layouts/emergent/ui';
import { Notice } from './ui';
import type { ProfileUser } from './ProfileMenu';

interface RetailerAuthScreenProps {
  onNavigate: (screen: ActiveScreen) => void;
  onLoginSuccess: (user: ProfileUser) => void;
}

/** The buyer details the profile menu shows. */
const profileOf = (u: any): ProfileUser => ({
  storeName: u.storeName,
  phone: u.phone,
  ownerName: u.ownerName,
  gstin: u.gstin,
  marketHub: u.marketHub
});

/** Six code boxes over one real input (paste and one-time-code autofill work). */
const CodeBoxes: React.FC<{ value: string; onChange: (v: string) => void }> = ({ value, onChange }) => {
  const [focused, setFocused] = useState(false);
  return (
    <div className="relative em-row" style={{ gap: 8 }}>
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="inp" style={{ flex: 1, justifyContent: 'center', height: 56, fontSize: 22, fontWeight: 600, padding: 0, borderColor: focused && i === Math.min(value.length, 5) ? 'var(--em-primary)' : undefined }}>
          {value[i] ?? ' '}
        </div>
      ))}
      <input
        aria-label="6-digit code"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        required
        value={value}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
        className="absolute inset-0 w-full h-full opacity-0"
        autoFocus
      />
    </div>
  );
};

/** Buyer showroom sign-in (atlas): the number first, then the 6-digit code sent on WhatsApp. New numbers get an account; no shop name is asked. */
export const RetailerAuthScreen: React.FC<RetailerAuthScreenProps> = ({ onNavigate, onLoginSuccess }) => {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [wait, setWait] = useState(0);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait(wait - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const sendCode = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setLoading(true);
    setErrorMessage(null);
    try {
      await api.requestOtp(phone.trim());
      setCodeSent(true);
      setCode('');
      setWait(30);
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
      const res = await api.verifyOtp({ phone: phone.trim(), code: code.trim() });
      onLoginSuccess(profileOf(res.user));
    } catch (err: any) {
      setErrorMessage(err.message || 'That code did not work.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="em-page notabs" style={{ maxWidth: 480 }}>
      <div className="em-pad" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div>
          <div className="em-ey">{merchant.brand.name}</div>
          <div className="em-rule" style={{ width: 48 }} />
          <h1 className="em-ser" style={{ fontSize: 30, lineHeight: 1.15 }}>
            {codeSent ? 'Enter the code' : 'Buyer showroom'}
          </h1>
          <p className="em-mut" style={{ marginTop: 8, fontSize: 14, lineHeight: 1.5 }}>
            {codeSent ? `Sent to +91 ${phone.trim()} on WhatsApp.` : 'Sign in with your WhatsApp number to browse the catalogue, shortlist and place orders.'}
          </p>
        </div>

        {errorMessage && <Notice tone="error">{errorMessage}</Notice>}

        {!codeSent ? (
          <form onSubmit={sendCode} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label className="lab" htmlFor="login-phone">
                WhatsApp number
              </label>
              <div className="em-row" style={{ gap: 10 }}>
                <span className="inp" style={{ width: 64, justifyContent: 'center', fontWeight: 600, padding: 0, background: 'var(--em-tint)' }}>
                  +91
                </span>
                <input id="login-phone" className="inp" style={{ flex: 1, minWidth: 0 }} value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^\d ]/g, '').slice(0, 11))} placeholder="98765 43210" type="tel" inputMode="numeric" autoComplete="tel-national" required autoFocus />
              </div>
            </div>
            <button type="submit" className="btn wa" disabled={loading || phone.replace(/\D/g, '').length < 10}>
              <Icon n="wa" />
              {loading ? 'Sending…' : 'Send code on WhatsApp'}
            </button>
          </form>
        ) : (
          <form onSubmit={verify} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <CodeBoxes value={code} onChange={setCode} />
            <div className="em-row em-sb">
              <button
                type="button"
                className="em-link"
                onClick={() => {
                  setCodeSent(false);
                  setCode('');
                }}
              >
                Change number
              </button>
              <button type="button" className="em-link" onClick={() => sendCode()} disabled={loading || wait > 0}>
                {wait > 0 ? `Resend in ${wait}s` : 'Resend code'}
              </button>
            </div>
            <button type="submit" className="btn" disabled={loading || code.length !== 6}>
              {loading ? 'Checking…' : 'Verify and enter'}
              <Icon n="right" size={18} />
            </button>
            <p className="em-hint" style={{ textAlign: 'center' }}>
              New number? You are added automatically while the store has room.
            </p>
          </form>
        )}

        {/* Admin entry: deliberately quiet, so buyers are not shown admin tools */}
        <button type="button" className="em-link" style={{ alignSelf: 'center' }} onClick={() => onNavigate('admin-login')}>
          Admin sign-in
        </button>
      </div>
    </div>
  );
};
