import React, { useState } from 'react';
import { ActiveScreen, Category } from '../types';

interface AddCategoryScreenProps {
  onNavigate: (screen: ActiveScreen) => void;
  onCategoryCreated: (category: Partial<Category>) => void;
}

export const AddCategoryScreen: React.FC<AddCategoryScreenProps> = ({
  onNavigate,
  onCategoryCreated
}) => {
  const [name, setName] = useState('Polki & Jadau Chokers');
  const [slug, setSlug] = useState('CAT-POLKI-CHK');
  const [isSlugLocked, setIsSlugLocked] = useState(true);
  const [tags, setTags] = useState('Syndicate Polki, Jadau Kundan, Royal Antique');
  const [minWt, setMinWt] = useState('25.000');
  const [maxWt, setMaxWt] = useState('120.000');
  const [selectedKarats, setSelectedKarats] = useState<string[]>(['22K (916)', '18K (750)']);
  const [bannerImage] = useState('https://lh3.googleusercontent.com/aida-public/AB6AXuD8fUMUeyDOcI81c_MNREo4WjrnTgcmPQeMubgZU3xgavihWC3LQzcmB4noqTfyKe3KWUQv2aByK_jUOPPHMKHDakRas_y_XkveX0l8jZmnksZcAzDdNIQEQpKdLHSdKyi4Bg-AIL7JXTURdktHiuh2ga4gL-RLkt-0CxZYx1XdLzkC00eBR-vu9v4rjNmuVn2mTR1zQQu3NgR23MqNlzQ7CF4d6twD9H5_1bMWDMJS3YGfU6C5HOMj');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleNameChange = (val: string) => {
    setName(val);
    if (isSlugLocked) {
      const code = val.replace(/[^A-Z0-9]/gi, '-').replace(/-+/g, '-').toUpperCase();
      setSlug(`CAT-${code.substring(0, 14)}`);
    }
  };

  const toggleKarat = (k: string) => {
    setSelectedKarats((prev) =>
      prev.includes(k) ? prev.filter((item) => item !== k) : [...prev, k]
    );
  };

  const handleCreate = (asDraft: boolean) => {
    setSubmitting(true);
    const newCat: Partial<Category> = {
      name,
      slug,
      subtitle: tags || 'Curated wholesale collection',
      image: bannerImage,
      designCount: asDraft ? 0 : 12,
      avgNetWt: `${minWt}g – ${maxWt}g`,
      eligibleKarats: selectedKarats,
      minTargetWt: parseFloat(minWt) || 20,
      maxTargetWt: parseFloat(maxWt) || 100
    };

    onCategoryCreated(newCat);
    setSuccess(true);
    setTimeout(() => {
      setSubmitting(false);
      onNavigate('categories');
    }, 1200);
  };

  return (
    <div className="flex flex-col w-full pb-32 max-w-lg mx-auto px-4 pt-3 space-y-4">
      {success && (
        <div className="bg-[#c7e7d7] text-[#032017] p-3 rounded-lg text-xs font-sans border border-[#486458] flex items-center gap-1.5 animate-fade-in">
          <span className="material-symbols-outlined text-[18px]">done_all</span>
          <span>Category created and synchronized with wholesale catalogue!</span>
        </div>
      )}

      {/* Intro Header */}
      <div className="flex flex-col space-y-1">
        <h2 className="font-serif text-[22px] font-bold text-[#1c1c1a]">Create Category</h2>
        <p className="font-sans text-xs text-[#7f7666] leading-relaxed">
          Configure wholesale classification, gold purity constraints, and automated labour rules for retail partners.
        </p>
      </div>

      {/* Visual Hero & Silhouette Section */}
      <section className="bg-white rounded-xl p-4 shadow-xs border border-[#d1c5b3]/40 flex flex-col space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-[#f0edea]">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[#715509] text-[19px]">photo_library</span>
            <h3 className="text-xs font-sans font-bold text-[#1c1c1a] uppercase tracking-wider">
              Visual Hero & Silhouette
            </h3>
          </div>
          <span className="font-mono text-[10px] text-[#715509] font-bold bg-[#ffdf9e]/40 px-2 py-0.5 rounded">
            16:9 Banner
          </span>
        </div>

        <div className="flex flex-col space-y-2">
          <div className="relative w-full h-36 rounded-lg bg-[#f0edea] overflow-hidden border border-[#d1c5b3]/40 shadow-xs group">
            <img
              alt="Polki Choker Banner"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              src={bannerImage}
            />
            <span className="absolute bottom-1.5 right-1.5 bg-white/90 text-[#715509] text-[9px] font-mono px-1.5 py-0.5 rounded font-bold shadow-xs">
              16:9 JPG/WEBP
            </span>
          </div>

          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-[11px] font-sans text-[#7f7666]">
              16:9 hero preview for retail line-sheets & PDF exports.
            </p>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                className="bg-[#f0edea] hover:bg-[#ebe8e4] text-[#1c1c1a] text-xs font-sans font-semibold px-2.5 py-1.5 rounded-lg flex items-center gap-1 border border-[#d1c5b3]/40"
              >
                <span className="material-symbols-outlined text-[15px]">upload_file</span>
                <span>Upload / Replace</span>
              </button>
              <button
                type="button"
                className="text-[#715509] hover:bg-[#ffdf9e]/20 text-xs font-sans font-semibold px-2.5 py-1.5 rounded-lg border border-[#715509]/30 flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[15px]">palette</span>
                <span>Choose Icon</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Category Details Section */}
      <section className="bg-white rounded-xl p-4 shadow-xs border border-[#d1c5b3]/40 flex flex-col space-y-3">
        <div className="flex items-center gap-1.5 pb-2 border-b border-[#f0edea]">
          <span className="material-symbols-outlined text-[#715509] text-[19px]">account_tree</span>
          <h3 className="text-xs font-sans font-bold text-[#1c1c1a] uppercase tracking-wider">
            Category Details
          </h3>
        </div>

        <div className="flex flex-col space-y-1">
          <label className="text-xs font-sans font-semibold text-[#1c1c1a]">
            Category Name <span className="text-[#715509]">*</span>
          </label>
          <div className="bg-[#f6f3ef] rounded-lg px-3 py-2 flex items-center gap-2 border border-[#d1c5b3]/40 focus-within:bg-white transition-colors">
            <span className="material-symbols-outlined text-[#7f7666] text-[17px]">
              drive_file_rename_outline
            </span>
            <input
              className="bg-transparent w-full text-xs font-sans text-[#1c1c1a] focus:outline-none"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="e.g. Temple Antique Haar"
            />
          </div>
        </div>

        <div className="flex flex-col space-y-1">
          <label className="text-xs font-sans font-semibold text-[#1c1c1a]">Category Slug</label>
          <div className="bg-[#f6f3ef] rounded-lg px-3 py-2 flex items-center gap-1.5 border border-[#d1c5b3]/40">
            <span className="font-mono text-xs font-bold text-[#715509]">#</span>
            <input
              className="bg-transparent w-full font-mono text-xs text-[#1c1c1a] focus:outline-none tracking-wider uppercase"
              value={slug}
              readOnly={isSlugLocked}
              onChange={(e) => setSlug(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setIsSlugLocked(!isSlugLocked)}
              className="text-[#7f7666] hover:text-[#1c1c1a]"
            >
              <span className="material-symbols-outlined text-[16px]">
                {isSlugLocked ? 'lock' : 'lock_open'}
              </span>
            </button>
          </div>
        </div>

        <div className="flex flex-col space-y-1">
          <label className="text-xs font-sans font-semibold text-[#1c1c1a]">
            Description & Catalog Tags
          </label>
          <div className="bg-[#f6f3ef] rounded-lg px-3 py-2 flex items-center gap-2 border border-[#d1c5b3]/40 focus-within:bg-white transition-colors">
            <span className="material-symbols-outlined text-[#7f7666] text-[17px]">label</span>
            <input
              className="bg-transparent w-full text-xs font-sans text-[#1c1c1a] focus:outline-none"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="e.g. Syndicate Uncut Polki, Meenakari, Bridal High-Ticket"
            />
          </div>
        </div>
      </section>

      {/* Weight & Purity Constraints */}
      <section className="bg-white rounded-xl p-4 shadow-xs border border-[#d1c5b3]/40 flex flex-col space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-[#f0edea]">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[#715509] text-[19px]">scale</span>
            <h3 className="text-xs font-sans font-bold text-[#1c1c1a] uppercase tracking-wider">
              Weight & Purity Constraints
            </h3>
          </div>
          <span className="font-mono text-[10px] text-[#486458] font-bold bg-[#caeada]/60 px-2 py-0.5 rounded flex items-center gap-1">
            <span className="material-symbols-outlined text-[13px]">verified</span>
            BIS Hallmarked
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col space-y-1">
            <span className="text-[11px] font-sans text-[#7f7666]">Min Target Wt.</span>
            <div className="bg-[#f6f3ef] rounded-lg p-2 flex items-center justify-between border border-[#d1c5b3]/40">
              <input
                className="bg-transparent w-full font-mono text-xs font-bold text-[#1c1c1a] focus:outline-none"
                value={minWt}
                onChange={(e) => setMinWt(e.target.value)}
              />
              <span className="font-mono text-[11px] text-[#7f7666]">gm</span>
            </div>
          </div>

          <div className="flex flex-col space-y-1">
            <span className="text-[11px] font-sans text-[#7f7666]">Max Target Wt.</span>
            <div className="bg-[#f6f3ef] rounded-lg p-2 flex items-center justify-between border border-[#d1c5b3]/40">
              <input
                className="bg-transparent w-full font-mono text-xs font-bold text-[#1c1c1a] focus:outline-none"
                value={maxWt}
                onChange={(e) => setMaxWt(e.target.value)}
              />
              <span className="font-mono text-[11px] text-[#7f7666]">gm</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col space-y-1.5 pt-1">
          <span className="text-[11px] font-sans text-[#7f7666] font-semibold">
            Eligible Karat Standards (Multi-Select)
          </span>
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: '22K (916)', title: '22K (916)', sub: 'Standard Primary' },
              { id: '24K (999)', title: '24K (999)', sub: 'Bullion Grade' },
              { id: '18K (750)', title: '18K (750)', sub: 'Diamond Jadau' },
              { id: '14K (585)', title: '14K (585)', sub: 'Export Grade' }
            ].map((k) => {
              const checked = selectedKarats.includes(k.id);
              return (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => toggleKarat(k.id)}
                  className={`p-2 rounded-lg flex items-center justify-between text-left transition-all border ${
                    checked
                      ? 'bg-[#ffdf9e]/30 border-[#8c6d23]/50 shadow-2xs'
                      : 'bg-[#f6f3ef] border-[#d1c5b3]/40 hover:bg-[#ebe8e4]'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[17px] text-[#715509]">
                      {checked ? 'check_circle' : 'radio_button_unchecked'}
                    </span>
                    <div className="flex flex-col">
                      <span className="font-mono text-[11px] font-bold text-[#1c1c1a]">{k.title}</span>
                      <span className="text-[9px] font-sans text-[#7f7666]">{k.sub}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Action Tray */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-[#d1c5b3]/40 flex flex-col space-y-2.5">
        <div className="flex items-center justify-between text-xs font-sans text-[#486458] font-semibold">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#486458]"></span>
            Ready to Register • Auto-sync to B2B Catalog
          </span>
        </div>

        <div className="flex flex-col space-y-2 pt-1">
          <button
            type="button"
            disabled={submitting}
            onClick={() => handleCreate(false)}
            className="w-full py-3 bg-[#486458] hover:bg-[#3a5247] text-white rounded-lg text-xs font-sans font-bold flex items-center justify-center gap-1.5 shadow-md active:scale-98 transition-all"
          >
            <span className="material-symbols-outlined text-[18px]">create_new_folder</span>
            <span>{submitting ? 'Registering...' : 'Create Category & Publish'}</span>
          </button>

          <button
            type="button"
            onClick={() => handleCreate(true)}
            className="w-full py-2 bg-[#f0edea] hover:bg-[#ebe8e4] text-[#1c1c1a] rounded-lg text-xs font-sans font-semibold flex items-center justify-center gap-1 transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">save</span>
            <span>Save as Internal Draft</span>
          </button>
        </div>
      </div>
    </div>
  );
};
