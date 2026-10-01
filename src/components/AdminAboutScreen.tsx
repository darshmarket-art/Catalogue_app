import React, { useState } from 'react';
import { About } from '../types';
import { PageTitle, Field, Notice, inputClass, btnPrimary } from './ui';

interface AdminAboutScreenProps {
  about: About;
  /** Saves the details; resolves with an error message, or null when saved. */
  onSave: (about: About) => Promise<string | null>;
}

/** The owner's business details, shown to buyers on the About us page. Leave a field empty to hide it. */
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

  return (
    <form onSubmit={save} className="flex flex-col w-full max-w-lg mx-auto pb-40">
      <PageTitle title="About us" sub="Tell buyers who you are and how to reach you. They see this from their profile menu. Leave a field empty to hide it." />

      <div className="px-5 flex flex-col gap-4">
        <Field label="Owner name" htmlFor="ab-owner">
          <input id="ab-owner" className={inputClass} value={form.ownerName ?? ''} onChange={set('ownerName')} placeholder="e.g. Bhakti Shah" maxLength={100} />
        </Field>
        <Field label="Role" htmlFor="ab-role">
          <input id="ab-role" className={inputClass} value={form.ownerRole ?? ''} onChange={set('ownerRole')} placeholder="e.g. Founder and owner" maxLength={80} />
        </Field>
        <Field label="About the business" htmlFor="ab-story" hint="Your story, what you specialise in, how long you have been trading.">
          <textarea id="ab-story" className={`${inputClass} h-40 py-3 resize-y`} value={form.story ?? ''} onChange={set('story')} maxLength={2000} />
        </Field>
        <Field label="Address" htmlFor="ab-address">
          <textarea id="ab-address" className={`${inputClass} h-24 py-3 resize-y`} value={form.address ?? ''} onChange={set('address')} maxLength={300} />
        </Field>
        <Field label="Phone" htmlFor="ab-phone">
          <input id="ab-phone" type="tel" className={inputClass} value={form.phone ?? ''} onChange={set('phone')} placeholder="+91 98995 50175" maxLength={40} />
        </Field>
        <Field label="Email" htmlFor="ab-email">
          <input id="ab-email" type="email" className={inputClass} value={form.email ?? ''} onChange={set('email')} placeholder="name@company.com" maxLength={120} />
        </Field>
        <Field label="Opening hours" htmlFor="ab-hours">
          <input id="ab-hours" className={inputClass} value={form.openingHours ?? ''} onChange={set('openingHours')} placeholder="Mon to Sat, 10 am to 7 pm" maxLength={160} />
        </Field>
        <Field label="GST number" htmlFor="ab-gst">
          <input id="ab-gst" className={`${inputClass} uppercase`} value={form.gstin ?? ''} onChange={set('gstin')} maxLength={15} />
        </Field>
        <Field label="Website" htmlFor="ab-web" hint="Start with https://">
          <input id="ab-web" type="url" className={inputClass} value={form.website ?? ''} onChange={set('website')} placeholder="https://" maxLength={200} />
        </Field>
        {error && <Notice tone="error">{error}</Notice>}
        {saved && <Notice tone="ok">Saved. Buyers can see it now.</Notice>}
      </div>

      <aside className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-outline-variant pb-safe">
        <div className="max-w-lg mx-auto px-5 py-3">
          <button type="submit" disabled={busy} className={btnPrimary}>
            {busy ? 'Saving…' : 'Save About us'}
          </button>
        </div>
      </aside>
    </form>
  );
};
