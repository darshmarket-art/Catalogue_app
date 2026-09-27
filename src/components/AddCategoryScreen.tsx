import React, { useState } from 'react';
import { ActiveScreen, Category } from '../types';
import { sector } from '../sector';

interface AddCategoryScreenProps {
  onNavigate: (screen: ActiveScreen) => void;
  onCategoryCreated: (category: Partial<Category>) => Promise<boolean>;
}

const inputBox =
  'w-full bg-surface-container-low px-3 py-2 rounded-lg text-xs font-sans text-on-surface border border-outline-variant/40 focus:outline-none focus:bg-white';

const isHttpUrl = (v: string) => /^https?:\/\/\S+$/i.test(v);

export const AddCategoryScreen: React.FC<AddCategoryScreenProps> = ({ onNavigate, onCategoryCreated }) => {
  const [name, setName] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [minWt, setMinWt] = useState('');
  const [maxWt, setMaxWt] = useState('');
  const [purities, setPurities] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const min = parseFloat(minWt);
  const max = parseFloat(maxWt);
  const problem = !name.trim()
    ? 'Enter a category name'
    : imageUrl.trim() && !isHttpUrl(imageUrl.trim())
      ? 'The photo link must start with http:// or https://'
      : minWt && maxWt && min > max
        ? 'The minimum weight cannot be more than the maximum'
        : null;

  const togglePurity = (key: string) =>
    setPurities((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  const handleCreate = async () => {
    if (problem) return;
    setSubmitting(true);
    const ok = await onCategoryCreated({
      name: name.trim(),
      ...(subtitle.trim() ? { subtitle: subtitle.trim() } : {}),
      ...(imageUrl.trim() ? { image: imageUrl.trim() } : {}),
      ...(Number.isFinite(min) ? { minTargetWt: min } : {}),
      ...(Number.isFinite(max) ? { maxTargetWt: max } : {}),
      eligibleKarats: purities
    });
    if (ok) {
      setSuccess(true);
      setTimeout(() => onNavigate('categories'), 900);
    } else {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col w-full pb-32 max-w-lg mx-auto px-4 pt-3 space-y-4">
      {success && (
        <div className="bg-secondary-container text-on-secondary-fixed p-3 rounded-lg text-xs font-sans border border-secondary flex items-center gap-1.5 animate-fade-in">
          <span className="material-symbols-outlined text-[18px]">done_all</span>
          <span>Category created.</span>
        </div>
      )}

      <div className="flex flex-col space-y-1">
        <h2 className="font-serif text-[22px] font-bold text-on-surface">Create Category</h2>
        <p className="font-sans text-xs text-outline leading-relaxed">
          Group your designs so buyers can browse them. The number of designs is counted automatically from the products you add.
        </p>
      </div>

      {/* Photo */}
      <section className="bg-white rounded-xl p-4 shadow-xs border border-outline-variant/40 flex flex-col space-y-3">
        <div className="flex items-center gap-1.5 pb-2 border-b border-surface-container">
          <span className="material-symbols-outlined text-primary text-[19px]">photo_library</span>
          <h3 className="text-xs font-sans font-bold text-on-surface uppercase tracking-wider">Banner photo</h3>
        </div>
        <div className="relative w-full h-36 rounded-lg bg-surface-container overflow-hidden border border-outline-variant/40 flex items-center justify-center">
          {isHttpUrl(imageUrl.trim()) ? (
            <img alt="Category banner preview" className="w-full h-full object-cover" src={imageUrl.trim()} referrerPolicy="no-referrer" />
          ) : (
            <span className="text-[11px] font-sans text-outline">No photo yet</span>
          )}
        </div>
        <div className="flex flex-col space-y-1">
          <label className="text-xs font-sans font-semibold text-on-surface">Photo link (optional)</label>
          <input className={inputBox} value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…" inputMode="url" />
          <p className="text-[11px] font-sans text-outline">Uploading from your phone is coming soon; for now paste a link.</p>
        </div>
      </section>

      {/* Details */}
      <section className="bg-white rounded-xl p-4 shadow-xs border border-outline-variant/40 flex flex-col space-y-3">
        <div className="flex items-center gap-1.5 pb-2 border-b border-surface-container">
          <span className="material-symbols-outlined text-primary text-[19px]">account_tree</span>
          <h3 className="text-xs font-sans font-bold text-on-surface uppercase tracking-wider">Category details</h3>
        </div>

        <div className="flex flex-col space-y-1">
          <label className="text-xs font-sans font-semibold text-on-surface">
            Category name <span className="text-primary">*</span>
          </label>
          <input className={inputBox} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Temple Antique Haar" />
        </div>

        <div className="flex flex-col space-y-1">
          <label className="text-xs font-sans font-semibold text-on-surface">Short description (optional)</label>
          <input className={inputBox} value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="e.g. Nakshi work, Mayur motifs" />
        </div>
      </section>

      {/* Weight & purity */}
      <section className="bg-white rounded-xl p-4 shadow-xs border border-outline-variant/40 flex flex-col space-y-3">
        <div className="flex items-center gap-1.5 pb-2 border-b border-surface-container">
          <span className="material-symbols-outlined text-primary text-[19px]">scale</span>
          <h3 className="text-xs font-sans font-bold text-on-surface uppercase tracking-wider">Typical weight & purity (optional)</h3>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col space-y-1">
            <span className="text-[11px] font-sans text-outline">Lightest piece (g)</span>
            <input className={`${inputBox} font-mono`} value={minWt} onChange={(e) => setMinWt(e.target.value)} inputMode="decimal" placeholder="—" />
          </div>
          <div className="flex flex-col space-y-1">
            <span className="text-[11px] font-sans text-outline">Heaviest piece (g)</span>
            <input className={`${inputBox} font-mono`} value={maxWt} onChange={(e) => setMaxWt(e.target.value)} inputMode="decimal" placeholder="—" />
          </div>
        </div>

        <div className="flex flex-col space-y-1.5 pt-1">
          <span className="text-[11px] font-sans text-outline font-semibold">Purities sold in this category</span>
          <div className="grid grid-cols-2 gap-2">
            {sector.purities.map((p) => {
              const checked = purities.includes(p.key);
              return (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => togglePurity(p.key)}
                  className={`p-2 rounded-lg flex items-center gap-1.5 text-left transition-all border ${
                    checked
                      ? 'bg-primary-fixed/30 border-primary-container/50 shadow-2xs'
                      : 'bg-surface-container-low border-outline-variant/40 hover:bg-surface-container-high'
                  }`}
                >
                  <span className="material-symbols-outlined text-[17px] text-primary">
                    {checked ? 'check_circle' : 'radio_button_unchecked'}
                  </span>
                  <span className="font-mono text-[11px] font-bold text-on-surface">{p.title}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Action */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-outline-variant/40 flex flex-col space-y-2.5">
        <div className={`flex items-center gap-1.5 text-xs font-sans font-semibold ${problem ? 'text-outline' : 'text-secondary'}`}>
          <span className={`w-2 h-2 rounded-full ${problem ? 'bg-outline-variant' : 'bg-secondary'}`}></span>
          {problem ?? 'Ready to create'}
        </div>
        <button
          type="button"
          disabled={submitting || problem !== null}
          onClick={handleCreate}
          className="w-full py-3 bg-secondary hover:bg-secondary-dark disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-xs font-sans font-bold flex items-center justify-center gap-1.5 shadow-md active:scale-98 transition-all"
        >
          <span className="material-symbols-outlined text-[18px]">create_new_folder</span>
          <span>{submitting ? 'Creating...' : 'Create Category'}</span>
        </button>
      </div>
    </div>
  );
};
