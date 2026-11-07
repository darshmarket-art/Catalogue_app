import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { errorText } from '../bugReport';
import { drawSheet, sheetFile, type SheetInput } from '../detailSheet';
import { cleanSpec, diamondGrams, groupCt, totalsOf, ctText, countText, type StoneGroup, type StoneSpec } from '../../shared/stoneSpec';
import { inRoot, useSheet } from './sheetKit';

type Facts = Omit<SheetInput, 'photo' | 'spec'>;

interface Props {
  /** Uploaded photo to read (the enhanced one) and the link to draw it from. */
  photoRef: string;
  photoUrl: string;
  facts: Facts;
  /** Called with the finished sheet as a PNG; the form uploads it as a photo of the design. */
  onUse: (file: File) => Promise<void> | void;
  /** Sets the design's stone weight (grams) in the form, which sets its net weight in the catalogue and in orders. Off unless the owner ticks the box. */
  onApplyStoneWt?: (grams: number) => void;
  onClose: () => void;
}

const blank = (): StoneGroup => ({ name: 'Stones', setting: 'Pavé', shape: 'Round', countMin: 1, countMax: 1, mmMin: 1.2, mmMax: 1.2 });

/**
 * "Detail sheet": the AI reads the stones in the photo, the owner corrects the counts and sizes, and the sheet (photo, details, stone table) is made
 * to add as a photo of the design. Everything the AI says is an estimate and is labelled so on the sheet.
 */
export const DetailSheet: React.FC<Props> = ({ photoRef, photoUrl, facts, onUse, onApplyStoneWt, onClose }) => {
  const [apply, setApply] = useState(false);
  const vars = useSheet(onClose);
  const [spec, setSpec] = useState<StoneSpec | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const photo = useRef<ImageBitmap | null>(null);
  const preview = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement | null>(null);

  const read = async () => {
    setError(null);
    setSpec(null);
    try {
      const blob = await (await fetch(photoUrl)).blob();
      photo.current = await createImageBitmap(blob);
      setSpec(await api.analyseStones(photoRef, { title: facts.title, category: facts.collection, grossWt: facts.grossWt }));
    } catch (e) {
      setError(errorText(e, 'DetailSheet read', 'The photo could not be read.'));
    }
  };
  useEffect(() => { void read(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  // Redraw the sheet whenever a number changes (cheap: one canvas).
  useEffect(() => {
    if (!spec || !photo.current) return;
    let live = true;
    const t = setTimeout(async () => {
      const c = await drawSheet({ ...facts, photo: photo.current!, spec });
      if (!live) return;
      canvas.current = c;
      c.style.width = '100%'; c.style.height = 'auto'; c.style.display = 'block'; c.setAttribute('data-testid', 'sheet-preview');
      preview.current?.replaceChildren(c);
    }, 150);
    return () => { live = false; clearTimeout(t); };
  }, [spec, facts]);

  const edit = (i: number, patch: Partial<StoneGroup>) => setSpec((s) => (s ? { ...s, groups: s.groups.map((g, j) => (j === i ? { ...g, ...patch } : g)) } : s));
  const nums = (i: number, k: 'countMin' | 'countMax' | 'mmMin' | 'mmMax', v: string) => edit(i, { [k]: Number(v) || 0 } as Partial<StoneGroup>);
  const use = async () => {
    if (!spec || !canvas.current) return;
    setBusy(true);
    setError(null);
    try {
      const clean = cleanSpec(spec); // bounded, min <= max
      const c = await drawSheet({ ...facts, photo: photo.current!, spec: clean });
      await onUse(await sheetFile(c, 'detail-sheet'));
      if (apply && onApplyStoneWt && clean.groups.length) onApplyStoneWt(Math.round(Math.min(diamondGrams(clean.groups), facts.grossWt - 0.001) * 1000) / 1000);
    } catch (e) {
      setError(errorText(e, 'DetailSheet use', 'The sheet could not be added.'));
      setBusy(false);
    }
  };
  const tot = spec ? totalsOf(spec.groups) : null;

  return inRoot(
    <div className="sheet-wrap rnd-wrap" style={vars} role="dialog" aria-modal="true" aria-label="Detail sheet" data-testid="detail-sheet">
      <button type="button" aria-label="Close" className="scrim" onClick={onClose} />
      <div className="sheet" style={{ maxHeight: '92dvh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h3 style={{ margin: 0 }}>Detail sheet</h3>
        <p className="hint" style={{ margin: 0 }}>The AI reads the stones in the photo. These are estimates: check the counts and sizes, correct them, then add the sheet as a photo of this design.</p>

        {!spec && !error && <p role="status" data-testid="sheet-reading">Reading the stones in your photo…</p>}
        {error && (
          <p role="alert" style={{ color: 'var(--em-bad, #b5472b)', margin: 0 }}>
            {error} <button type="button" className="lnk" onClick={() => void read()}>Try again</button>
          </p>
        )}

        {spec && (
          <>
            {spec.groups.length === 0 && <p className="hint" style={{ margin: 0 }}>No stones were found. You can add them below, or make the sheet without a stone table.</p>}
            {spec.groups.map((g, i) => {
              const ct = groupCt(g);
              return (
                <div key={i} data-testid="stone-row" style={{ display: 'grid', gap: 8, padding: '10px 0', borderTop: '1px solid var(--em-line, #dedbd6)' }}>
                  <div className="grid2">
                    <input className="inp" aria-label="Where the stones are" value={g.name} maxLength={40} onChange={(e) => edit(i, { name: e.target.value })} />
                    <input className="inp" aria-label="Setting" value={g.setting} maxLength={24} onChange={(e) => edit(i, { setting: e.target.value })} />
                  </div>
                  <div className="grid2">
                    <label className="hint">Stones from<input className="inp" type="number" min={0} inputMode="numeric" value={g.countMin} onChange={(e) => nums(i, 'countMin', e.target.value)} /></label>
                    <label className="hint">to<input className="inp" type="number" min={0} inputMode="numeric" value={g.countMax} onChange={(e) => nums(i, 'countMax', e.target.value)} /></label>
                    <label className="hint">Size from (mm)<input className="inp" type="number" min={0.5} step={0.1} inputMode="decimal" value={g.mmMin} onChange={(e) => nums(i, 'mmMin', e.target.value)} /></label>
                    <label className="hint">to (mm)<input className="inp" type="number" min={0.5} step={0.1} inputMode="decimal" value={g.mmMax} onChange={(e) => nums(i, 'mmMax', e.target.value)} /></label>
                  </div>
                  <div className="em-row em-sb">
                    <span className="hint">≈ {ctText(ct.min, ct.max)} ct</span>
                    <button type="button" className="lnk" onClick={() => setSpec({ ...spec, groups: spec.groups.filter((_, j) => j !== i) })}>Remove</button>
                  </div>
                </div>
              );
            })}
            <div className="em-row em-sb">
              <button type="button" className="lnk" disabled={spec.groups.length >= 6} onClick={() => setSpec({ ...spec, groups: [...spec.groups, blank()] })}>+ Add stones</button>
              {tot && tot.countMax > 0 && <b data-testid="sheet-total">{countText(tot.countMin, tot.countMax)} stones · ≈ {ctText(tot.ctMin, tot.ctMax)} ct</b>}
            </div>
            {tot && tot.countMax > 0 && facts.stoneWt <= 0 && (
              <>
                <p className="hint" style={{ margin: 0 }} data-testid="sheet-net">
                  Diamond weight ≈ {diamondGrams(spec.groups).toFixed(3)} g, so net weight on the sheet ≈ {Math.max(0, facts.grossWt - diamondGrams(spec.groups)).toFixed(3)} g (gross {facts.grossWt.toFixed(3)} g).
                </p>
                {onApplyStoneWt && (
                  <label className="hint" style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <input type="checkbox" checked={apply} onChange={(e) => setApply(e.target.checked)} data-testid="sheet-apply-wt" />
                    <span>Also save this diamond weight as the design's stone weight. This changes its net weight in the catalogue and in orders. Leave it off to change only the sheet.</span>
                  </label>
                )}
              </>
            )}
            <div ref={preview} aria-label="Sheet preview" style={{ border: '1px solid var(--em-line, #dedbd6)' }} />
          </>
        )}

        <div className="em-row" style={{ gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" className="em-btn sec" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className="em-btn" data-testid="sheet-use" onClick={() => void use()} disabled={!spec || busy}>{busy ? 'Adding…' : 'Add as photo'}</button>
        </div>
      </div>
    </div>
  );
};
