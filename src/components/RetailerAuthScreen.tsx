import React, { useEffect, useRef, useState } from 'react';
import { ActiveScreen } from '../types';
import { api, ApiError } from '../api';
import * as haptics from '../haptics';
import { merchant } from '../merchant';
import { LegalLinks } from './LegalLinks';
import { Icon } from '../layouts/emergent/ui';
import { Notice } from './ui';
import { DevOtpHint } from './DevOtpHint';
import { CatalogueFullScreen } from './CatalogueFullScreen';
import { WelcomeGreeting } from './WelcomeGreeting';
import { DeliveryPill, FAILURE_TEXT, useOtpDelivery } from './DeliveryStatus';
import type { ProfileUser } from './ProfileMenu';
import { t, tErr, ts, useLang } from '../i18n';
import { errorText } from '../bugReport';
import { tenDigits } from '../phone';

interface RetailerAuthScreenProps {
  onNavigate: (screen: ActiveScreen) => void;
  /** isNew: the number signed up just now (the buyer gets the app tour). */
  onLoginSuccess: (user: ProfileUser, isNew: boolean) => void;
}

/** The buyer details the profile menu shows. */
const profileOf = (u: any): ProfileUser => ({
  storeName: u.storeName,
  phone: u.phone,
  ownerName: u.ownerName,
  gstin: u.gstin,
  marketHub: u.marketHub
});

/** Six code boxes over one real input (paste and one-time-code autofill work). `shake` plays the refusal once: the boxes jolt and empty for a new try. */
const CodeBoxes: React.FC<{ value: string; onChange: (v: string) => void; shake?: number; busy?: boolean }> = ({ value, onChange, shake = 0, busy }) => {
  const [focused, setFocused] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  // After a refused code the field is emptied; put the cursor back so the next digits can be typed at once.
  useEffect(() => { if (shake) input.current?.focus({ preventScroll: true }); }, [shake]);
  return (
    <div key={shake} className={`relative em-row em-code${shake ? ' no' : ''}${busy ? ' busy' : ''}`} style={{ gap: 8 }}>
      {Array.from({ length: 6 }, (_, i) => {
        const on = focused && i === Math.min(value.length, 5);
        return (
          <div key={i} className={`inp em-code-box${on ? ' on' : ''}${value[i] ? ' set' : ''}`} style={{ flex: 1, justifyContent: 'center', height: 56, fontSize: '1.375rem', fontWeight: 600, padding: 0, borderColor: on ? 'var(--em-primary)' : undefined }}>
            {value[i] ?? ' '}
          </div>
        );
      })}
      <input
        ref={input}
        aria-label={t('6-digit code')}
        data-testid="buyer-code-input"
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

/** Shown as two groups of five, the way a number is read out. */
const grouped = (d: string) => (d.length > 5 ? `${d.slice(0, 5)} ${d.slice(5)}` : d);

/** Buyer showroom sign-in (atlas): the number first, then the 6-digit code sent on WhatsApp. A new number is asked for a name after the code; returning buyers go straight in. */
export const RetailerAuthScreen: React.FC<RetailerAuthScreenProps> = ({ onNavigate, onLoginSuccess }) => {
  useLang();
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
  const [shake, setShake] = useState(0); // counts refused codes: each one jolts the boxes and empties them
  const [messageId, setMessageId] = useState<string | null>(null);
  const [receipts, setReceipts] = useState(false);
  // The 30 s resend wait is lifted as soon as WhatsApp reports the code as undeliverable.
  const delivery = useOtpDelivery(messageId, codeSent && channel === 'whatsapp' && receipts, () => setWait(0));
  // The form shows a fixed +91; the server and WhatsApp need the country code in the number.
  const fullPhone = () => `91${tenDigits(phone)}`;

  // After a good code, hold a 2 s greeting before entering the showroom.
  // The sixth digit signs in on its own; a code that failed is not sent again until it is changed.
  const tried = useRef('');
  useEffect(() => {
    if (codeSent && !needsName && !loading && code.length === 6 && code !== tried.current) void verify();
  }, [code]);

  const [welcome, setWelcome] = useState<{ user: ProfileUser; isNew: boolean } | null>(null);

  useEffect(() => {
    if (wait <= 0) return;
    const timer = setTimeout(() => setWait(wait - 1), 1000);
    return () => clearTimeout(timer);
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
      else setErrorMessage(tErr(errorText(err, 'RetailerAuthScreen', t('Could not send the code.'))));
    } finally {
      setLoading(false);
    }
  };

  const verify = async (e?: React.FormEvent) => {
    e?.preventDefault();
    tried.current = code;
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await api.verifyOtp({ phone: fullPhone(), code: code.trim(), ...(needsName ? { firmName: name.trim(), ownerName: name.trim() } : {}) });
      if (res.status === 'needs-name') setNeedsName(true);
      else {
        setWelcome({ user: profileOf(res.user), isNew: Boolean(res.isNew) });
        haptics.success();
      }
    } catch (err: any) {
      setErrorMessage(tErr(errorText(err, 'RetailerAuthScreen', t('That code did not work.'))));
      // Only the server refusing the code (wrong, expired, too many tries) buzzes; a lost connection does not.
      if (err instanceof ApiError && (err.status === 401 || err.status === 429)) {
        haptics.warning();
        // A refused code is cleared so the right one can be typed straight away (the name step keeps its code: it was already accepted).
        if (!needsName) { setCode(''); tried.current = ''; setShake((n) => n + 1); }
      }
    } finally {
      setLoading(false);
    }
  };

  const step = needsName ? 'name' : codeSent ? 'code' : 'phone';
  const stepNo = codeSent ? 2 : 1;

  if (welcome) {
    return (
      <WelcomeGreeting
        title={t(welcome.isNew ? 'Welcome, {name}' : 'Welcome back, {name}', { name: welcome.user.ownerName || welcome.user.storeName })}
        subtitle={t('Opening your showroom…')}
        onDone={() => onLoginSuccess(welcome.user, welcome.isNew)}
      />
    );
  }

  if (full) {
    return (
      <CatalogueFullScreen
        name={name.trim()}
        phone={tenDigits(phone)}
        onBack={() => {
          setFull(false);
          setPhone('');
        }}
      />
    );
  }

  return (
    <div className="em-page notabs em-signin" style={{ maxWidth: 480 }} data-step={step} data-testid="buyer-signin">
      <div className="em-pad em-signin-card" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div className="em-signin-head">
          <ol className="em-steps" aria-label={t('Step {n} of {m}', { n: stepNo, m: 2 })}>
            <li className={stepNo >= 1 ? 'on' : ''} /><li className={stepNo >= 2 ? 'on' : ''} />
          </ol>
          <div className="em-ey">{ts(merchant.brand.name)}</div>
          <div className="em-rule" style={{ width: 48 }} />
          <h1 className="em-ser" style={{ fontSize: '1.875rem', lineHeight: 1.15 }}>
            {t(needsName ? 'Enter your name' : codeSent ? 'Enter the code' : 'Login')}
          </h1>
          <p className="em-mut" style={{ marginTop: 8, fontSize: '0.875rem', lineHeight: 1.5 }}>
            {needsName ? (
              t('Your number is verified. Tell us your name to finish signing in.')
            ) : codeSent ? (
              <>
                {t('Sent to +91 {phone} on WhatsApp.', { phone: grouped(tenDigits(phone)) })}
                {delivery.status && <> <DeliveryPill status={delivery.status} testId="otp-delivery-status" /></>}
              </>
            ) : (
              t('Sign in with your WhatsApp number to browse the catalogue, shortlist and place orders.')
            )}
          </p>
        </div>

        {errorMessage && <Notice tone="error">{errorMessage}</Notice>}
        {codeSent && delivery.status === 'failed' && (
          <Notice tone="error">
            <span data-testid="otp-delivery-failed">{t(FAILURE_TEXT[delivery.failure ?? 'other'])}</span>
          </Notice>
        )}

        {!codeSent ? (
          <form onSubmit={sendCode} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label className="lab" htmlFor="login-phone">
                {t('WhatsApp number')}
              </label>
              <div className="em-row" style={{ gap: 10 }}>
                <span className="inp em-cc" style={{ width: 64, justifyContent: 'center', fontWeight: 600, padding: 0, background: 'var(--em-tint)' }}>
                  +91
                </span>
                <input id="login-phone" data-testid="buyer-phone-input" className="inp" style={{ flex: 1, minWidth: 0 }} value={grouped(tenDigits(phone))} onChange={(e) => setPhone(tenDigits(e.target.value))} placeholder="98765 43210" type="tel" inputMode="numeric" autoComplete="tel-national" enterKeyHint="send" required autoFocus />
              </div>
            </div>
            <button type="submit" className="btn wa" data-testid="buyer-send-code" disabled={loading || tenDigits(phone).length < 10}>
              <Icon n="wa" />
              {t(loading ? 'Sending…' : 'Send code on WhatsApp')}
            </button>
          </form>
        ) : (
          <form onSubmit={verify} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <DevOtpHint code={devCode} channel={channel} />
            {needsName ? (
              <div>
                <label className="lab" htmlFor="login-name">
                  {t('Welcome! What should we call you?')}
                </label>
                <input id="login-name" data-testid="buyer-name-input" className="inp" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('e.g. Ramesh Shah')} autoComplete="name" required minLength={2} maxLength={100} autoFocus />
              </div>
            ) : (
              <CodeBoxes value={code} onChange={setCode} shake={shake} busy={loading} />
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
                {t('Change number')}
              </button>
              <button type="button" className="em-link" data-testid="buyer-resend-code" onClick={() => sendCode()} disabled={loading || wait > 0}>
                {wait > 0 ? t('Resend in {n}s', { n: wait }) : t('Resend code')}
              </button>
            </div>
            <button type="submit" className="btn" data-testid="buyer-verify" disabled={loading || code.length !== 6 || (needsName && name.trim().length < 2)}>
              {t(loading ? 'Checking…' : needsName ? 'Continue' : 'Verify and enter')}
              <Icon n="right" size={18} />
            </button>
            <p className="em-hint" style={{ textAlign: 'center' }}>
              {t('New number? You are added automatically while the store has room.')}
            </p>
          </form>
        )}

        <LegalLinks lead="By continuing you agree to:" />

        {/* Admin entry: deliberately quiet, so buyers are not shown admin tools */}
        <button type="button" className="em-link" style={{ alignSelf: 'center' }} data-testid="buyer-admin-signin-link" onClick={() => onNavigate('admin-login')}>
          {t('Admin sign-in')}
        </button>
      </div>
    </div>
  );
};
