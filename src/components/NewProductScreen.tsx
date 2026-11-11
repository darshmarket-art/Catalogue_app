import React, { useState } from 'react';
import { ActiveScreen, Category, Product, Purity } from '../types';
import { sector } from '../sector';
import { merchant } from '../merchant';
import { usePlan, upgradeNotice } from '../plan';
import { PhotoPicker, type PhotoItem } from './PhotoPicker';
import { Field, Notice } from './ui';
import { confirmDelete } from '../notify';
import { api } from '../api';
import { errorText } from '../bugReport';
import { DetailSheet } from './DetailSheet';

interface NewProductScreenProps {
  categories: Category[];
  /** The purities the owner offers. */
  purities: Purity[];
  /** The product being edited, or null when adding a new one. */
  editing: Product | null;
  onNavigate: (screen: ActiveScreen) => void;
  onSave: (product: Partial<Product>, id?: string) => Promise<boolean>;
  onDelete: (product: Product) => Promise<boolean>;
}

/** New design (artboard 3.3 on Pro, 4.2 on Basic: one photo, the other two slots locked). */
export const NewProductScreen: React.FC<NewProductScreenProps> = ({ categories, purities, editing, onNavigate, onSave, onDelete }) => {
  const ent = usePlan();
  const { limits } = ent;
  const [title, setTitle] = useState(editing?.title ?? '');
  const [sku, setSku] = useState(editing?.sku ?? '');
  const [category, setCategory] = useState(editing?.category ?? '');
  const [grossWt, setGrossWt] = useState(editing ? String(editing.grossWt) : '');
  const [stoneWt, setStoneWt] = useState(editing?.stoneWt ? String(editing.stoneWt) : '');
  const [purity, setPurity] = useState(editing?.purity ?? '');
  const [huid, setHuid] = useState(editing?.huid ?? '');
  const [stockStatus, setStockStatus] = useState(editing?.stockStatus ?? sector.stockStatuses[0].key);
  const [description, setDescription] = useState(editing?.description ?? '');
  const [story, setStory] = useState(editing?.story ?? '');
  const [pairs, setPairs] = useState<string[]>(editing?.pairs ?? []);
  const [pairDraft, setPairDraft] = useState('');
  const [pairMsg, setPairMsg] = useState<string | null>(null);
  const [certificate, setCertificate] = useState<string | null>(editing?.certificate ?? null);
  const [certBusy, setCertBusy] = useState(false);
  const [photos, setPhotos] = useState<PhotoItem[]>(editing ? editing.images.map((url) => ({ ref: url, url })) : []);
  const [extra, setExtra] = useState<Record<string, string>>(Object.fromEntries(Object.entries(editing?.extra ?? {}).map(([k, v]) => [k, String(v)])));
  const [uploading, setUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  /** The detail sheet already added to this design, so making it again replaces it instead of using another photo slot. */
  const [sheetRef, setSheetRef] = useState<string | null>(null);
  const [sheetMsg, setSheetMsg] = useState<string | null>(null);

  const gross = parseFloat(grossWt);
  const stone = parseFloat(stoneWt) || 0;
  const net = Number.isFinite(gross) ? Math.max(0, gross - stone) : null;
  const missingExtra = merchant.productFields.find((f) => f.required && !(extra[f.key] ?? '').trim());
  const maxPhotos = Math.max(limits.photosPerDesign, editing?.images.length ?? 0);

  const problem = uploading
    ? 'Photo is uploading or rendering…'
    : photos.length === 0
      ? 'Add at least one photo'
      : !title.trim()
        ? 'Enter a design name'
        : !category
          ? 'Choose a collection'
          : !purity
            ? 'Choose the purity'
            : !(gross > 0)
              ? 'Enter the gross weight'
              : stone >= gross
                ? 'Stone weight must be less than gross weight'
                : missingExtra
                  ? `Enter ${missingExtra.label}`
                  : null;

  const handleSave = async () => {
    if (problem) return;
    setIsSaving(true);
    const extraOut = Object.fromEntries(Object.entries(extra).filter(([, v]) => v.trim() !== ''));
    const ok = await onSave(
      {
        title: title.trim(),
        ...(sku.trim() ? { sku: sku.trim() } : {}),
        category,
        purity,
        grossWt: gross,
        stoneWt: stone,
        ...(huid.trim() ? { huid: huid.trim() } : {}),
        ...(description.trim() ? { description: description.trim() } : {}),
        ...(story.trim() ? { story: story.trim() } : {}),
        ...(pairs.length ? { pairs } : {}),
        ...(certificate ? { certificate } : {}),
        stockStatus,
        images: photos.map((p) => p.ref),
        extra: extraOut
      } as Partial<Product>,
      editing?.id
    );
    if (ok) {
      setSaved(true);
      setTimeout(() => onNavigate('catalogue'), 900);
    } else {
      setIsSaving(false);
    }
  };

  const addPair = async () => {
    const s = pairDraft.trim();
    if (!s || pairs.includes(s)) return void setPairDraft('');
    if (s === (sku.trim() || editing?.sku)) return void setPairMsg('A piece cannot pair with itself.');
    try {
      const found = await api.getProductsBySku([s]);
      if (!found.some((p) => p.sku === s)) return void setPairMsg(`No piece has the SKU "${s}".`);
      setPairs([...pairs, s]);
      setPairDraft('');
    } catch (e) {
      setPairMsg(errorText(e, 'NewProductScreen pair', 'Could not check that SKU.'));
    }
  };
  const uploadCert = async (file: File) => {
    setCertBusy(true);
    try {
      setCertificate((await api.uploadPhoto(file)).url);
    } catch (e) {
      setPairMsg(errorText(e, 'NewProductScreen certificate', 'The certificate could not be uploaded.'));
    }
    setCertBusy(false);
  };

  const handleDelete = async () => {
    if (!editing) return;
    if (!(await confirmDelete(`Delete "${editing.title}" from the catalogue? This cannot be undone.`, 'Delete design'))) return;
    setIsSaving(true);
    if (await onDelete(editing)) onNavigate('catalogue');
    else setIsSaving(false);
  };

  return (
    <div className="scroll no-tabs" style={{ gap: 11 }}>
      {saved && <Notice tone="ok">{editing ? 'Changes saved.' : 'Published to the live catalogue.'}</Notice>}

      <div>
        <span className="lab">
          Photos {limits.photosPerDesign > 1 && <span className="pro" style={{ marginLeft: 4 }}>Up to {limits.photosPerDesign}</span>}
        </span>
        <PhotoPicker photos={photos} onChange={setPhotos} max={maxPhotos} kind="design" onBusyChange={setUploading} locked={Math.max(0, 3 - maxPhotos)} onLocked={() => upgradeNotice('Extra photos per design')} aiRender enhance tag={categories.find((c) => c.name === category)?.tag} />
        {photos.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <button type="button" className="em-btn sec" data-testid="detail-sheet-open" style={{ minHeight: 42, padding: '8px 16px', fontSize: '0.875rem' }} disabled={!title.trim() || !(gross > 0) || !purity}
              onClick={() => { setSheetMsg(null); setSheetOpen(true); }}>
              Make detail sheet
            </button>
            <p className="hint" style={{ margin: '4px 0 0' }}>{!title.trim() || !(gross > 0) || !purity ? 'Enter the design name, purity and gross weight first.' : 'A second photo with the design details and an approximate stone table, in your store\'s look.'}</p>
            {sheetMsg && <p role="alert" className="hint" style={{ color: 'var(--em-bad, #b5472b)' }}>{sheetMsg}</p>}
          </div>
        )}
        {limits.photosPerDesign < 3 && <p className="hint">Basic allows {limits.photosPerDesign} photo per design. Pro allows 3.</p>}
      </div>

      <Field label="Design name" htmlFor="np-title">
        <input id="np-title" className="inp" style={{ minHeight: 48 }} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Antique Temple Necklace" />
      </Field>


      <div className="grid2">
        <Field label="Collection" htmlFor="np-category">
          <select id="np-category" value={category} onChange={(e) => setCategory(e.target.value)} className="inp" style={{ minHeight: 48 }}>
            <option value="">Choose</option>
            {categories.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Purity" htmlFor="np-purity">
          <select id="np-purity" className="inp" style={{ minHeight: 48 }} value={purity} onChange={(e) => setPurity(e.target.value)}>
            <option value="">Choose</option>
            {purities
              .filter((pu) => pu.enabled || pu.key === editing?.purity)
              .map((pu) => (
                <option key={pu.key} value={pu.key}>
                  {pu.title}
                </option>
              ))}
          </select>
        </Field>
      </div>
      <button type="button" className="lnk" style={{ minHeight: 28, marginTop: -4, alignSelf: 'flex-start', fontSize: '0.8438rem' }} onClick={() => onNavigate('add-category')}>
        + Add a new collection
      </button>

      <div className="grid2">
        <Field label="Gross weight (g)" htmlFor="np-gross">
          <input id="np-gross" className="inp" style={{ minHeight: 48 }} value={grossWt} onChange={(e) => setGrossWt(e.target.value)} inputMode="decimal" placeholder="0.000" />
        </Field>
        <Field label="Stone or tare (g)" htmlFor="np-stone">
          <input id="np-stone" className="inp" style={{ minHeight: 48 }} value={stoneWt} onChange={(e) => setStoneWt(e.target.value)} inputMode="decimal" placeholder="0.000" />
        </Field>
      </div>
      <div className="em-netbanner" data-testid="np-net">
        <div>
          <div className="em-ey g">Net weight</div>
          <div style={{ fontSize: '0.75rem', opacity: 0.7, marginTop: 2 }}>Auto-calculated</div>
        </div>
        <div className="em-ser">{net === null ? '—' : `${net.toFixed(3)} g`}</div>
      </div>

      <div>
        <span className="lab">Availability</span>
        <div className="em-seg">
          {sector.stockStatuses.map((st) => (
            <button key={st.key} type="button" className={`chip${stockStatus === st.key ? ' on' : ''}`} aria-pressed={stockStatus === st.key} onClick={() => setStockStatus(st.key)}>
              {st.key}
            </button>
          ))}
        </div>
      </div>

      <Field label="HUID or hallmark number (optional)" htmlFor="np-huid">
        <input id="np-huid" className="inp" style={{ minHeight: 48 }} value={huid} onChange={(e) => setHuid(e.target.value)} placeholder="Only if this piece carries one" />
      </Field>

      <Field label="Description (optional)" htmlFor="np-desc" hint="Searchable: a few words on the motif, finish or occasion help buyers find it.">
        <textarea id="np-desc" data-testid="np-description" className="inp" style={{ minHeight: 84, padding: '12px 15px', alignItems: 'flex-start', resize: 'vertical' }} maxLength={600} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Antique temple work with a matte finish, bridal set" />
      </Field>

      <Field label="The story of the piece (optional)" htmlFor="np-story" hint="Shown on the piece's page under its details: where the idea came from, how it is made.">
        <textarea id="np-story" data-testid="np-story" className="inp" style={{ minHeight: 84, padding: '12px 15px', resize: 'vertical' }} maxLength={1200} value={story} onChange={(e) => setStory(e.target.value)} />
      </Field>

      <div>
        <span className="lab">Pairs well with (optional)</span>
        <div className="em-row" style={{ gap: 8 }}>
          <input className="inp" style={{ minHeight: 48, flex: 1 }} aria-label="SKU of a piece that pairs well" data-testid="np-pair-input" value={pairDraft} onChange={(e) => { setPairDraft(e.target.value); setPairMsg(null); }} placeholder="SKU of the matching earrings, ring…" />
          <button type="button" className="em-btn sec" data-testid="np-pair-add" style={{ minHeight: 48 }} disabled={!pairDraft.trim() || pairs.length >= 6} onClick={() => void addPair()}>Add</button>
        </div>
        {pairMsg && <p className="hint" role="alert" style={{ margin: '6px 0 0', color: 'var(--em-bad, #b5472b)' }}>{pairMsg}</p>}
        {pairs.length > 0 && (
          <div className="em-row" style={{ gap: 8, flexWrap: 'wrap', marginTop: 8 }} data-testid="np-pairs">
            {pairs.map((s) => (
              <span key={s} className="tag" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>{s}<button type="button" className="lnk" style={{ minHeight: 32 }} aria-label={`Remove ${s}`} onClick={() => setPairs(pairs.filter((x) => x !== s))}>×</button></span>
            ))}
          </div>
        )}
        <p className="hint" style={{ margin: '6px 0 0' }}>Up to six pieces that belong with this one. Buyers see them as "Complete the set".</p>
      </div>

      <div>
        <span className="lab">Certificate (optional)</span>
        <div className="em-row" style={{ gap: 12, alignItems: 'center' }}>
          {certificate && <img src={certificate} alt="Certificate" style={{ width: 56, height: 72, objectFit: 'cover', border: '1px solid var(--em-line, #dedbd6)' }} data-testid="np-cert-thumb" />}
          <label className="em-btn sec" style={{ minHeight: 44, padding: '8px 16px', fontSize: '0.875rem', cursor: certBusy ? 'wait' : 'pointer' }}>
            {certBusy ? 'Uploading…' : certificate ? 'Replace' : 'Upload a photo of the certificate'}
            <input type="file" accept="image/png,image/jpeg,image/webp" data-testid="np-cert-input" disabled={certBusy} style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void uploadCert(f); }} />
          </label>
          {certificate && <button type="button" className="lnk" onClick={() => setCertificate(null)}>Remove</button>}
        </div>
        <p className="hint" style={{ margin: '6px 0 0' }}>Hallmark card or stone report. Buyers open it from the piece.</p>
      </div>


      <Field label={editing ? 'SKU' : 'SKU (optional)'} htmlFor="np-sku">
        <input id="np-sku" className="inp" style={{ minHeight: 48 }} value={sku} onChange={(e) => setSku(e.target.value)} placeholder="Leave blank to generate one" />
      </Field>

      {merchant.productFields.map((field) => (
        <Field key={field.key} label={`${field.label}${field.unit ? ` (${field.unit})` : ''}${field.required ? ' *' : ''}`} htmlFor={`np-${field.key}`}>
          {field.type === 'select' ? (
            <select id={`np-${field.key}`} className="inp" style={{ minHeight: 48 }} value={extra[field.key] ?? ''} onChange={(e) => setExtra({ ...extra, [field.key]: e.target.value })}>
              <option value="">Select</option>
              {field.options?.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          ) : (
            <input id={`np-${field.key}`} className="inp" style={{ minHeight: 48 }} value={extra[field.key] ?? ''} inputMode={field.type === 'number' ? 'decimal' : 'text'} onChange={(e) => setExtra({ ...extra, [field.key]: e.target.value })} />
          )}
        </Field>
      ))}

      {limits.photos !== null && ent.effectivePlan === 'basic' && ent.usage && (
        <div className="note warn row">
          <i aria-hidden="true" className="i s i-sparkle" />
          <span>
            Photos used: {ent.usage.photos} of {limits.photos} on Basic.
          </span>
        </div>
      )}

      <div className="em-savebar">
      <p className="hint" style={{ margin: 0, textAlign: 'center', color: problem ? 'var(--mut)' : 'var(--ok)', fontWeight: 700 }}>
        {problem ?? (editing ? 'Ready to save' : 'Ready to publish')}
      </p>
      <button type="button" className="btn" data-testid="np-save" onClick={handleSave} disabled={isSaving || problem !== null}>
        {isSaving ? 'Saving…' : editing ? 'Save changes' : 'Save design'}
      </button>
      {editing && (
        <button type="button" onClick={handleDelete} disabled={isSaving} className="btn alt danger">
          Delete this design
        </button>
      )}
      </div>
      {sheetOpen && photos[0] && (
        <DetailSheet
          photoRef={photos[0].ref}
          photoUrl={photos[0].url}
          facts={{ brand: merchant.brand.name, title: title.trim(), collection: category, sku: sku.trim() || editing?.sku, purity, grossWt: gross, stoneWt: stone, netWt: net ?? gross, huid: huid.trim() || undefined }}
          onClose={() => setSheetOpen(false)}
          onApplyStoneWt={(g) => setStoneWt(String(g))}
          onUse={async (file) => {
            const base = sheetRef ? photos.filter((p) => p.ref !== sheetRef) : photos;
            if (base.length >= maxPhotos) { setSheetOpen(false); setSheetMsg(`A design holds up to ${maxPhotos} photos. Remove one first, then make the sheet.`); return; }
            try {
              const up = await api.uploadPhoto(file);
              setPhotos([base[0], { ref: up.ref, url: up.url }, ...base.slice(1)].filter(Boolean) as PhotoItem[]);
              setSheetRef(up.ref);
              setSheetOpen(false);
            } catch (e) {
              setSheetOpen(false);
              setSheetMsg(errorText(e, 'NewProductScreen sheet', 'The sheet could not be uploaded.'));
            }
          }}
        />
      )}
    </div>
  );
};
