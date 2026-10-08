import React, { useState } from 'react';
import { About } from '../types';
import { Field, Notice } from './ui';

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

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const problem = await onSave(form);
    setBusy(false);
    setError(problem);
    setSaved(problem === null);
  };

  const h = { height: 46 };
  return (
    <form onSubmit={save} className="scroll no-tabs" style={{ gap: 10 }}>
      <p className="sub">Tell buyers who you are and how to reach you. Leave a field empty to hide it.</p>
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
        <textarea id="ab-address" className="inp" style={{ minHeight: 72 }} value={form.address ?? ''} onChange={set('address')} maxLength={300} />
      </Field>
      <div className="grid2">
        <Field label="Opening hours" htmlFor="ab-hours">
          <input id="ab-hours" className="inp" style={{ ...h, fontSize: 14 }} value={form.openingHours ?? ''} onChange={set('openingHours')} placeholder="Mon to Sat, 10 to 7" maxLength={160} />
        </Field>
        <Field label="GST number" htmlFor="ab-gst">
          <input id="ab-gst" className="inp uppercase" style={h} value={form.gstin ?? ''} onChange={set('gstin')} maxLength={15} />
        </Field>
      </div>
      <p className="sub" style={{ marginTop: 10 }}>For buyers who use the app in Hindi (optional). Left empty, the story is not shown in Hindi and the rest is written in Hindi automatically.</p>
      <Field label="About the business, in Hindi" htmlFor="ab-story-hi">
        <textarea id="ab-story-hi" lang="hi" className="inp" value={form.storyHi ?? ''} onChange={set('storyHi')} maxLength={2000} placeholder="… से होलसेल सोने की ज्वेलरी" />
      </Field>
      <div className="grid2">
        <Field label="Role, in Hindi" htmlFor="ab-role-hi">
          <input id="ab-role-hi" lang="hi" className="inp" style={h} value={form.ownerRoleHi ?? ''} onChange={set('ownerRoleHi')} placeholder="संस्थापक" maxLength={80} />
        </Field>
        <Field label="Opening hours, in Hindi" htmlFor="ab-hours-hi">
          <input id="ab-hours-hi" lang="hi" className="inp" style={{ ...h, fontSize: 14 }} value={form.openingHoursHi ?? ''} onChange={set('openingHoursHi')} placeholder="सोम से शनि, 10 से 7" maxLength={160} />
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
