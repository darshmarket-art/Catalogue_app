import React, { useEffect, useState } from 'react';
import { ActiveScreen } from '../types';
import { api } from '../api';
import { merchant } from '../merchant';
import { Icon } from '../layouts/emergent/ui';
import { Notice } from './ui';
import { DevOtpHint } from './DevOtpHint';
import { CatalogueFullScreen } from './CatalogueFullScreen';
import { DeliveryPill, FAILURE_TEXT, useOtpDelivery } from './DeliveryStatus';
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

/** Buyer showroom sign-in (atlas): the number first, then the 6-digit code sent on WhatsApp. A new number is asked for a name after the code; returning buyers go straight in. */
export const RetailerAuthScreen: React.FC<RetailerAuthScreenProps> = ({ onNavigate, onLoginSuccess }) => {
  const [name, setName] = useState('');
  const [needsName, setNeedsName] = useState(false); // a new number: asked for a name after the code checks out
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [wait, setWait] = useState(0);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [channel, setChannel] = useState<string | null>(null);
  const [full, setFull] = useState(false);
  const [messageId, setMessageId] = useState<string | null>(null);
  const [receipts, setReceipts] = useState(false);
  // The 30 s resend wait is lifted as soon as WhatsApp reports the code as undeliverable.
  const delivery = useOtpDelivery(messageId, codeSent && channel === 'whatsapp' && receipts, () => setWait(0));
  // The form shows a fixed +91; the server and WhatsApp need the country code in the number.
  const fullPhone = () => `91${phone.replace(/\D/g, '')}`;

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
      const r = await api.requestOtp(fullPhone());
      setDevCode(r.devCode ?? null);
      setChannel(r.channel ?? null);
      setMessageId(r.messageId ?? null);
      setReceipts(Boolean(r.receipts));
      setCodeSent(true);
      setCode('');
      setWait(30);
    } catch (err: any) {
      if (err.code === 'CATALOGUE_FULL') setFull(true);
      else setErrorMessage(err.message || 'Could not send the code.');
    } finally {
      setLoading(false);
    }
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await api.verifyOtp({ phone: fullPhone(), code: code.trim(), ...(needsName ? { firmName: name.trim(), ownerName: name.trim() } : {}) });
      if (res.status === 'needs-name') setNeedsName(true);
      else onLoginSuccess(profileOf(res.user));
    } catch (err: any) {
      setErrorMessage(err.message || 'That code did not work.');
    } finally {
      setLoading(false);
    }
  };

  if (full) {
    return (
      <CatalogueFullScreen
        name={name.trim()}
        phone={phone.trim()}
        onBack={() => {
          setFull(false);
          setPhone('');
        }}
      />
    );
  }

  return (
    <div className="em-page notabs" style={{ maxWidth: 480 }}>
      <div className="em-pad" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div>
          <div className="em-ey">{merchant.brand.name}</div>
          <div className="em-rule" style={{ width: 48 }} />
          <h1 className="em-ser" style={{ fontSize: 30, lineHeight: 1.15 }}>
            {needsName ? 'Enter your name' : codeSent ? 'Enter the code' : 'Buyer showroom'}
          </h1>
          <p className="em-mut" style={{ marginTop: 8, fontSize: 14, lineHeight: 1.5 }}>
            {needsName ? (
              'Your number is verified. Tell us your name to finish signing in.'
            ) : codeSent ? (
              <>
                Sent to +91 {phone.trim()} on WhatsApp.
                {delivery.status && <> <DeliveryPill status={delivery.status} testId="otp-delivery-status" /></>}
              </>
            ) : (
              'Sign in with your WhatsApp number to browse the catalogue, shortlist and place orders.'
            )}
          </p>
        </div>

        {errorMessage && <Notice tone="error">{errorMessage}</Notice>}
        {codeSent && delivery.status === 'failed' && (
          <Notice tone="error">
            <span data-testid="otp-delivery-failed">{FAILURE_TEXT[delivery.failure ?? 'other']}</span>
          </Notice>
        )}

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
                <input id="login-phone" data-testid="buyer-phone-input" className="inp" style={{ flex: 1, minWidth: 0 }} value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^\d ]/g, '').slice(0, 11))} placeholder="98765 43210" type="tel" inputMode="numeric" autoComplete="tel-national" required />
              </div>
            </div>
            <button type="submit" className="btn wa" data-testid="buyer-send-code" disabled={loading || phone.replace(/\D/g, '').length < 10}>
              <Icon n="wa" />
              {loading ? 'Sending…' : 'Send code on WhatsApp'}
            </button>
          </form>
        ) : (
          <form onSubmit={verify} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <DevOtpHint code={devCode} channel={channel} />
            {needsName ? (
              <div>
                <label className="lab" htmlFor="login-name">
                  Welcome! What should we call you?
                </label>
                <input id="login-name" data-testid="buyer-name-input" className="inp" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ramesh Shah" autoComplete="name" required minLength={2} maxLength={100} autoFocus />
              </div>
            ) : (
              <CodeBoxes value={code} onChange={setCode} />
            )}
            <div className="em-row em-sb">
              <button
                type="button"
                className="em-link"
                data-testid="buyer-change-number"
                onClick={() => {
                  setCodeSent(false);
                  setCode('');
                  setNeedsName(false);
                }}
              >
                Change number
              </button>
              <button type="button" className="em-link" data-testid="buyer-resend-code" onClick={() => sendCode()} disabled={loading || wait > 0}>
                {wait > 0 ? `Resend in ${wait}s` : 'Resend code'}
              </button>
            </div>
            <button type="submit" className="btn" data-testid="buyer-verify" disabled={loading || code.length !== 6 || (needsName && name.trim().length < 2)}>
              {loading ? 'Checking…' : needsName ? 'Continue' : 'Verify and enter'}
              <Icon n="right" size={18} />
            </button>
            <p className="em-hint" style={{ textAlign: 'center' }}>
              New number? You are added automatically while the store has room.
            </p>
          </form>
        )}

        {/* Admin entry: deliberately quiet, so buyers are not shown admin tools */}
        <button type="button" className="em-link" style={{ alignSelf: 'center' }} data-testid="buyer-admin-signin-link" onClick={() => onNavigate('admin-login')}>
          Admin sign-in
        </button>
      </div>
    </div>
  );
};
