import React, { useState } from 'react';
import { Purity } from '../types';

interface AdminPuritiesScreenProps {
  purities: Purity[];
  /** Saves the list; resolves true when the server accepted it. */
  onSave: (purities: Array<{ key: string; enabled: boolean }>) => Promise<boolean>;
}

const inputBox =
  'w-full bg-white px-3 py-3 rounded-xl text-sm font-sans text-on-surface border border-outline-variant focus:outline-none focus:border-primary';

/** The owner's list of purities: it fills the Purity dropdown on every product and for buyers. */
export const AdminPuritiesScreen: React.FC<AdminPuritiesScreenProps> = ({ purities, onSave }) => {
  const [list, setList] = useState(purities.map(({ key, enabled }) => ({ key, enabled })));
  const [karat, setKarat] = useState('');
  const [fineness, setFineness] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const toggle = (key: string) => {
    setSaved(false);
    setList((prev) => prev.map((p) => (p.key === key ? { ...p, enabled: !p.enabled } : p)));
  };

  const add = () => {
    const key = `${karat.trim().toUpperCase().replace(/\s+/g, '')} ${fineness.trim()}`;
    if (!/^[0-9]{1,2}K [0-9]{3}(\.[0-9])?$/.test(key)) return setError('Enter the karat (for example 24K) and a 3-digit fineness (for example 999).');
    if (list.some((p) => p.key === key)) return setError(`${key} is already in the list.`);
    setError(null);
    setSaved(false);
    setList((prev) => [...prev, { key, enabled: true }]);
    setKarat('');
    setFineness('');
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    const ok = await onSave(list);
    setSaving(false);
    setSaved(ok);
    if (!ok) setError('Could not save. Keep at least one purity switched on and try again.');
  };

  return (
    <div className="flex flex-col w-full pb-32 max-w-xl mx-auto px-4 pt-3 gap-4">
      <div>
        <h2 className="font-serif text-[26px] text-primary leading-tight">Purity options</h2>
        <p className="font-sans text-sm text-on-surface-variant mt-1">
          These fill the Purity dropdown on every product and when a buyer orders. Switch one off to stop offering it. Designs that already use it keep it.
        </p>
      </div>

      <ul className="bg-white rounded-2xl border border-outline-variant overflow-hidden">
        {list.map((p) => (
          <li key={p.key} className="flex items-center justify-between px-4 py-3 border-b border-surface-container last:border-b-0">
            <span className="font-serif text-[19px] text-primary">{p.key.replace(' ', ' · ')}</span>
            <button
              type="button"
              role="switch"
              aria-checked={p.enabled}
              aria-label={`${p.key} in use`}
              onClick={() => toggle(p.key)}
              className={`relative w-12 h-7 rounded-full transition-colors ${p.enabled ? 'bg-primary' : 'bg-outline-variant'}`}
            >
              <span className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white transition-transform ${p.enabled ? 'translate-x-5' : ''}`} />
            </button>
          </li>
        ))}
      </ul>

      <section className="bg-white rounded-2xl border border-outline-variant p-4 flex flex-col gap-3">
        <h3 className="font-serif text-[18px] text-primary">Add a purity</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="new-karat" className="text-xs font-bold">
              Karat
            </label>
            <input id="new-karat" className={inputBox} value={karat} onChange={(e) => setKarat(e.target.value)} placeholder="e.g. 24K" />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="new-fineness" className="text-xs font-bold">
              Fineness
            </label>
            <input id="new-fineness" className={inputBox} value={fineness} onChange={(e) => setFineness(e.target.value)} placeholder="e.g. 999" inputMode="decimal" />
          </div>
        </div>
        <button type="button" onClick={add} className="h-11 rounded-xl border-2 border-primary text-primary font-sans text-sm font-extrabold">
          Add to list
        </button>
      </section>

      {error && (
        <p role="alert" className="font-sans text-sm text-error">
          {error}
        </p>
      )}
      <button type="button" onClick={save} disabled={saving} className="h-12 rounded-2xl bg-secondary text-white font-sans text-sm font-extrabold disabled:opacity-60">
        {saving ? 'Saving…' : saved ? 'Saved' : 'Save purity options'}
      </button>
    </div>
  );
};
