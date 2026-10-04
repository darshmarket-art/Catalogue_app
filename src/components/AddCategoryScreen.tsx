import React, { useState } from 'react';
import { ActiveScreen, Category, Purity } from '../types';
import { usePlan, upgradeNotice } from '../plan';
import { PhotoPicker, type PhotoItem } from './PhotoPicker';
import { Field, I, Notice } from './ui';

interface AddCategoryScreenProps {
  /** The purities the owner offers. */
  purityOptions: Purity[];
  /** The category being edited, or null when creating a new one. */
  editing: Category | null;
  onNavigate: (screen: ActiveScreen) => void;
  onSave: (category: Partial<Category>, id?: string) => Promise<boolean>;
  onDelete: (category: Category) => Promise<boolean>;
}

/** New collection (artboard 3.4); at the Basic limit it becomes artboard 4.5. */
export const AddCategoryScreen: React.FC<AddCategoryScreenProps> = ({ purityOptions, editing, onNavigate, onSave, onDelete }) => {
  const { limits, usage } = usePlan();
  const [name, setName] = useState(editing?.name ?? '');
  const [subtitle, setSubtitle] = useState(editing?.subtitle ?? '');
  const [photos, setPhotos] = useState<PhotoItem[]>(editing ? [{ ref: editing.image, url: editing.image }] : []);
  const [uploading, setUploading] = useState(false);
  const [minWt, setMinWt] = useState(editing ? String(editing.minTargetWt) : '');
  const [maxWt, setMaxWt] = useState(editing ? String(editing.maxTargetWt) : '');
  const [purities, setPurities] = useState<string[]>(editing?.eligibleKarats ?? []);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const used = usage?.categories ?? 0;
  const atLimit = !editing && limits.categories !== null && used >= limits.categories;
  const min = parseFloat(minWt);
  const max = parseFloat(maxWt);
  const problem = uploading
    ? 'Photo is uploading…'
    : photos.length === 0
      ? 'Add a photo for the collection'
      : !name.trim()
        ? 'Enter a collection name'
        : minWt && maxWt && min > max
          ? 'The lightest piece cannot weigh more than the heaviest'
          : null;

  const togglePurity = (key: string) => setPurities((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  const handleCreate = async () => {
    if (problem) return;
    setSubmitting(true);
    const ok = await onSave(
      {
        name: name.trim(),
        ...(subtitle.trim() ? { subtitle: subtitle.trim() } : {}),
        image: photos[0].ref,
        ...(Number.isFinite(min) ? { minTargetWt: min } : {}),
        ...(Number.isFinite(max) ? { maxTargetWt: max } : {}),
        eligibleKarats: purities
      },
      editing?.id
    );
    if (ok) {
      setSuccess(true);
      setTimeout(() => onNavigate('categories'), 900);
    } else {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!editing) return;
    if (!window.confirm(`Delete the collection "${editing.name}"? This cannot be undone.`)) return;
    setSubmitting(true);
    if (await onDelete(editing)) onNavigate('categories');
    else setSubmitting(false);
  };

  if (atLimit) {
    return (
      <div className="scroll no-tabs" style={{ gap: 14 }}>
        <div className="note warn">
          <b>
            You have {used} of {limits.categories} collections.
          </b>{' '}
          Basic allows {limits.categories}. Your existing collections stay as they are.
        </div>
        <div className="card" style={{ padding: '12px 16px' }}>
          <div className="kv">
            <span>Collections</span>
            <b>
              {used} of {limits.categories}
            </b>
          </div>
          <div className="meter over" style={{ marginTop: 8 }}>
            <i style={{ width: '100%' }} />
          </div>
        </div>
        <div style={{ opacity: 0.5 }}>
          <label className="lab" htmlFor="ac-name-locked">
            Collection name
          </label>
          <input id="ac-name-locked" className="inp" disabled placeholder="e.g. Temple Antique Haar" />
        </div>
        <button type="button" className="btn off" disabled>
          Save collection
        </button>
        <button type="button" className="btn" onClick={() => upgradeNotice('Unlimited collections')}>
          <I n="sparkle" />
          Unlimited collections with Pro
        </button>
      </div>
    );
  }

  return (
    <div className="scroll no-tabs" style={{ gap: 14 }}>
      <p className="sub">Group your designs so buyers can browse them. The number of designs is counted from the products you add.</p>
      {success && <Notice tone="ok">{editing ? 'Changes saved.' : 'Collection created.'}</Notice>}

      <div>
        <span className="lab">Cover photo</span>
        <PhotoPicker photos={photos} onChange={setPhotos} max={1} onBusyChange={setUploading} tile="square" kind="collection" />
      </div>

      <Field label="Collection name" htmlFor="ac-name">
        <input id="ac-name" className="inp" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Temple Antique Haar" />
      </Field>

      <Field label="Short description (optional)" htmlFor="ac-sub">
        <input id="ac-sub" className="inp" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="e.g. Nakshi work, Mayur motifs" />
      </Field>

      <div className="grid2">
        <Field label="Lightest piece (g)" htmlFor="ac-min">
          <input id="ac-min" className="inp" value={minWt} onChange={(e) => setMinWt(e.target.value)} inputMode="decimal" placeholder="0.000" />
        </Field>
        <Field label="Heaviest piece (g)" htmlFor="ac-max">
          <input id="ac-max" className="inp" value={maxWt} onChange={(e) => setMaxWt(e.target.value)} inputMode="decimal" placeholder="0.000" />
        </Field>
      </div>

      <div>
        <span className="lab">Purities sold here</span>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          {purityOptions
            .filter((pu) => pu.enabled || purities.includes(pu.key))
            .map((pu) => (
              <button key={pu.key} type="button" className={`chip${purities.includes(pu.key) ? ' on' : ''}`} aria-pressed={purities.includes(pu.key)} onClick={() => togglePurity(pu.key)}>
                {pu.key.split(' ')[0]}
              </button>
            ))}
        </div>
      </div>

      {!editing && (
        <div className="note ok row">
          <I n="check" size="s" />
          <span>{limits.categories === null ? 'Pro: unlimited collections. Basic allows 5.' : `Basic: ${used} of ${limits.categories} collections used.`}</span>
        </div>
      )}

      <p className="hint" style={{ margin: '4px 0 0', color: problem ? 'var(--mut)' : 'var(--ok)', fontWeight: 700 }}>
        {problem ?? (editing ? 'Ready to save' : 'Ready to create')}
      </p>
      <button type="button" className="btn" disabled={submitting || problem !== null} onClick={handleCreate}>
        {submitting ? 'Saving…' : editing ? 'Save changes' : 'Save collection'}
      </button>
      {editing && (
        <button type="button" onClick={handleDelete} disabled={submitting} className="btn alt danger">
          Delete this collection
        </button>
      )}
    </div>
  );
};
