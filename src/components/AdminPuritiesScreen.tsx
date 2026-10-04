import React, { useState } from 'react';
import { Purity } from '../types';
import { Notice, Switch } from './ui';

interface AdminPuritiesScreenProps {
  purities: Purity[];
  /** Saves the list; resolves true when the server accepted it. */
  onSave: (purities: Array<{ key: string; enabled: boolean }>) => Promise<boolean>;
}

/** Purity options (artboard 3.8): the karat list offered on every design and to buyers. */
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
    <div className="scroll" style={{ gap: 12 }}>
      <p className="sub">The karat list offered when you add a design and when a buyer orders. Switch one off to stop offering it; designs that use it keep it.</p>

      {list.map((p) => {
        const [k, f] = p.key.split(' ');
        return (
          <div key={p.key} className="card row" style={{ opacity: p.enabled ? 1 : 0.6 }}>
            <b className="grow">{k}</b>
            <span className="tag mut">{f}</span>
            <Switch on={p.enabled} onChange={() => toggle(p.key)} label={`${p.key} in use`} />
          </div>
        );
      })}

      <h2 style={{ fontSize: 20, marginTop: 6 }}>Add a purity</h2>
      <div className="grid2">
        <div>
          <label className="lab" htmlFor="new-karat">
            Karat
          </label>
          <input id="new-karat" className="inp" value={karat} onChange={(e) => setKarat(e.target.value)} placeholder="e.g. 24K" />
        </div>
        <div>
          <label className="lab" htmlFor="new-fineness">
            Fineness
          </label>
          <input id="new-fineness" className="inp" value={fineness} onChange={(e) => setFineness(e.target.value)} placeholder="e.g. 999" inputMode="decimal" />
        </div>
      </div>
      <button type="button" className="btn alt" onClick={add}>
        Add purity
      </button>

      {error && <Notice tone="error">{error}</Notice>}
      <button type="button" className="btn" onClick={save} disabled={saving}>
        {saving ? 'Saving…' : saved ? 'Saved' : 'Save purity options'}
      </button>
    </div>
  );
};
