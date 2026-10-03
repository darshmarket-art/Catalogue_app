import React, { useState } from 'react';
import { ActiveScreen } from '../types';
import { api } from '../api';
import { PageTitle, Field, Notice, inputClass, btnPrimary, btnLink } from './ui';
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

/** Buyer sign-in by a code sent on WhatsApp: number first, then the code. New numbers get an account. */
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
    <div className="flex flex-col w-full max-w-md mx-auto pb-28">
      <PageTitle title="Sign in" sub="We will send a code to your WhatsApp to see the catalogue." />
      <div className="px-5 flex flex-col gap-4">
        {errorMessage && <Notice tone="error">{errorMessage}</Notice>}
        {successMessage && codeSent && <Notice tone="ok">{successMessage}</Notice>}

        {!codeSent ? (
          <form onSubmit={sendCode} className="flex flex-col gap-4">
            <Field label="Mobile number (WhatsApp)" htmlFor="login-phone">
              <input id="login-phone" className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="10-digit mobile number" type="tel" autoComplete="tel" required />
            </Field>
            <button type="submit" disabled={loading} className={btnPrimary}>
              {loading ? 'Sending…' : 'Send code on WhatsApp'}
            </button>
          </form>
        ) : (
          <form onSubmit={verify} className="flex flex-col gap-4">
            <Field label="6-digit code" htmlFor="login-code">
              <input id="login-code" className={inputClass} value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required />
            </Field>
            <Field label="Shop name" htmlFor="login-firm" hint="Only if you are new here">
              <input id="login-firm" className={inputClass} value={firmName} onChange={(e) => setFirmName(e.target.value)} placeholder="e.g. Mahalakshmi Jewellers" />
            </Field>
            <button type="submit" disabled={loading} className={btnPrimary}>
              {loading ? 'Checking…' : 'Sign in'}
            </button>
            <button type="button" onClick={() => sendCode()} disabled={loading} className={btnLink}>
              Send a new code
            </button>
            <button type="button" onClick={() => { setCodeSent(false); setCode(''); setSuccessMessage(null); }} className={btnLink}>
              Change number
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
