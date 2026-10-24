import React, { useState } from 'react';
import { About } from '../types';
import { Field, Notice } from './ui';
import { AddressPicker } from './AddressPicker';
import { BrandMark } from './BrandMark';
import { PhotoCropper } from './PhotoCropper';
import type { PhotoSpec } from '../../shared/photoSpecs';

const LOGO_SPEC: PhotoSpec = { label: 'Logo', ratio: 1, w: 512, h: 512, minW: 0, minH: 0, strict: true, tip: 'Drag to move it and use the slider to resize. What is inside the circle is your logo.' };
import { api } from '../api';
import { merchant, setLogo } from '../merchant';
import { errorText } from '../bugReport';

interface AdminAboutScreenProps {
  about: About;
  /** Saves the details; resolves with an error message, or null when saved. */
  onSave: (about: About) => Promise<string | null>;
}

/** About us editor (artboard 3.9). Leave a field empty to hide it from buyers. */
export const AdminAboutScreen: React.FC<AdminAboutScreenProps> = ({ about, onSave }) => {
  const [form, setForm] = useState<About>(about);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const set = (key: keyof About) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [key]: e.target.value });
    setSaved(false);
  };

  // Each English field and its Hindi twin.
  const PAIRS: Array<[keyof About, keyof About]> = [['story', 'storyHi'], ['ownerRole', 'ownerRoleHi'], ['openingHours', 'openingHoursHi'], ['address', 'addressHi']];
  const [translating, setTranslating] = useState(false);
  /** Fills Hindi fields from the English ones: all of them (the button), or only the empty ones (on save). */
  const toHindi = async (f: About, onlyEmpty: boolean): Promise<About> => {
    const todo = PAIRS.filter(([en, hi]) => (f[en] ?? '').trim() && (!onlyEmpty || !(f[hi] ?? '').trim()));
    if (todo.length === 0) return f;
    const out = await api.translateHindi(todo.map(([en]) => String(f[en]).trim()));
    const next = { ...f };
    todo.forEach(([, hi], i) => out[i] && (next[hi] = out[i] as never));
    return next;
  };
  const translateAll = async () => {
    setTranslating(true);
    setError(null);
    try {
      setForm(await toHindi(form, false));
      setSaved(false);
    } catch (err) {
      setError(errorText(err, 'AdminAboutScreen hindi', 'Could not translate to Hindi.'));
    }
    setTranslating(false);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    // Hindi left empty is filled in from the English; if translation is down, the page is saved as it is.
    const filled = await toHindi(form, true).catch(() => form);
    setForm(filled);
    const problem = await onSave(filled);
    setBusy(false);
    setError(problem);
    setSaved(problem === null);
  };

  const [logoBusy, setLogoBusy] = useState(false);
  const [logoMsg, setLogoMsg] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const pickLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) setLogoFile(file); // fitted in the round cropper first
  };
  const uploadLogo = async (file: File) => {
    setLogoFile(null);
    setLogoBusy(true);
    setLogoMsg(null);
    try {
      setLogo(await api.uploadLogo(file));
      setLogoMsg({ tone: 'ok', text: 'Logo saved. It now shows across your store and in PDFs.' });
    } catch (err) {
      setLogoMsg({ tone: 'error', text: errorText(err, 'AdminAboutScreen logo', 'Could not upload the logo.') });
    }
    setLogoBusy(false);
  };

  const h = { minHeight: 46 };
  return (
    <form onSubmit={save} className="scroll no-tabs" style={{ gap: 10 }}>
      <p className="sub">Tell buyers who you are and how to reach you. Leave a field empty to hide it.</p>
      <div className="em-card" style={{ padding: 16, display: 'flex', gap: 16, alignItems: 'center' }}>
        <span style={{ width: 84, height: 84, borderRadius: '50%', border: '2px solid var(--em-gold)', background: '#fff', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
          <BrandMark className="w-full h-full" textClassName="text-[36px]" />
        </span>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <b style={{ fontWeight: 600 }}>Store logo</b>
          <small className="em-mut" style={{ lineHeight: 1.4 }}>Shown in your store and on PDFs.</small>
          <label className="em-btn sec" style={{ minHeight: 42, padding: '8px 16px', fontSize: '0.875rem', cursor: logoBusy ? 'wait' : 'pointer', marginTop: 2 }}>
            {logoBusy ? 'Uploading…' : merchant.brand.logoUrl.startsWith('/') ? 'Change logo' : 'Upload logo'}
            <input id="ab-logo" type="file" accept="image/png,image/jpeg,image/webp" onChange={pickLogo} disabled={logoBusy} style={{ display: 'none' }} />
          </label>
        </div>
      </div>
      {logoFile && <PhotoCropper round file={logoFile} spec={LOGO_SPEC} onDone={(f) => void uploadLogo(f)} onCancel={() => setLogoFile(null)} />}
      {logoMsg && <Notice tone={logoMsg.tone}>{logoMsg.text}</Notice>}
      <Field label="About the business" htmlFor="ab-story">
        <textarea id="ab-story" className="inp" value={form.story ?? ''} onChange={set('story')} maxLength={2000} placeholder="Wholesale gold jewellery since …" />
      </Field>
      <div className="grid2">
        <Field label="Owner name" htmlFor="ab-owner">
          <input id="ab-owner" className="inp" style={h} value={form.ownerName ?? ''} onChange={set('ownerName')} maxLength={100} />
        </Field>
        <Field label="Role" htmlFor="ab-role">
          <input id="ab-role" className="inp" style={h} value={form.ownerRole ?? ''} onChange={set('ownerRole')} placeholder="Founder" maxLength={80} />
        </Field>
      </div>
      <div className="grid2">
        <Field label="Phone" htmlFor="ab-phone">
          <input id="ab-phone" type="tel" className="inp" style={h} value={form.phone ?? ''} onChange={set('phone')} maxLength={40} />
        </Field>
        <Field label="Email" htmlFor="ab-email">
          <input id="ab-email" type="email" className="inp" style={h} value={form.email ?? ''} onChange={set('email')} maxLength={120} />
        </Field>
      </div>
      <Field label="Website" htmlFor="ab-web">
        <input id="ab-web" type="url" className="inp" style={h} value={form.website ?? ''} onChange={set('website')} placeholder="https://" maxLength={200} />
      </Field>
      <Field label="Address" htmlFor="ab-address">
        <AddressPicker pin={form.mapPin} onPick={(address, mapPin) => { setForm((f) => ({ ...f, address: address || f.address, mapPin })); setSaved(false); }} />
        <textarea id="ab-address" className="inp" style={{ minHeight: 72 }} value={form.address ?? ''} onChange={set('address')} maxLength={300} />
      </Field>
      <div className="grid2">
        <Field label="Opening hours" htmlFor="ab-hours">
          <input id="ab-hours" className="inp" style={h} value={form.openingHours ?? ''} onChange={set('openingHours')} placeholder="Mon to Sat, 10 to 7" maxLength={160} />
        </Field>
        <Field label="GST number" htmlFor="ab-gst">
          <input id="ab-gst" className="inp uppercase" style={h} value={form.gstin ?? ''} onChange={set('gstin')} maxLength={15} />
        </Field>
      </div>
      <div className="em-row" style={{ marginTop: 10, gap: 12, alignItems: 'center' }}>
        <p className="sub" style={{ flex: 1, margin: 0 }}>For buyers who use the app in Hindi. Filled in from your English when you save; check and edit if you like.</p>
        <button type="button" className="em-btn sec" style={{ minHeight: 40, padding: '6px 14px', fontSize: '0.8125rem', flex: 'none' }} disabled={translating} onClick={() => void translateAll()}>
          {translating ? 'Translating…' : 'Translate to Hindi'}
        </button>
      </div>
      <Field label="About the business, in Hindi" htmlFor="ab-story-hi">
        <textarea id="ab-story-hi" lang="hi" className="inp" value={form.storyHi ?? ''} onChange={set('storyHi')} maxLength={2000} placeholder="… से होलसेल सोने की ज्वेलरी" />
      </Field>
      <div className="grid2">
        <Field label="Role, in Hindi" htmlFor="ab-role-hi">
          <input id="ab-role-hi" lang="hi" className="inp" style={h} value={form.ownerRoleHi ?? ''} onChange={set('ownerRoleHi')} placeholder="संस्थापक" maxLength={80} />
        </Field>
        <Field label="Opening hours, in Hindi" htmlFor="ab-hours-hi">
          <input id="ab-hours-hi" lang="hi" className="inp" style={h} value={form.openingHoursHi ?? ''} onChange={set('openingHoursHi')} placeholder="सोम से शनि, 10 से 7" maxLength={160} />
        </Field>
      </div>
      <Field label="Address, in Hindi" htmlFor="ab-address-hi">
        <textarea id="ab-address-hi" lang="hi" className="inp" style={{ minHeight: 72 }} value={form.addressHi ?? ''} onChange={set('addressHi')} maxLength={300} />
      </Field>
      {error && <Notice tone="error">{error}</Notice>}
      {saved && <Notice tone="ok">Saved. Buyers can see it now.</Notice>}
      <button type="submit" disabled={busy} className="btn" style={{ marginTop: 6 }}>
        {busy ? 'Saving…' : 'Save'}
      </button>
    </form>
  );
};
