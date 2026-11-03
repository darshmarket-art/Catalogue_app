import React, { useState } from 'react';
import { AddCredits } from './AiCredits';
import { inRoot, useSheet } from './sheetKit';
import { rs, type RenderCredits } from '../aiRender';
import { PLACEMENTS, PLACEMENT_LABEL, STYLE_IDS, STYLE_INFO, placementForTag, type Placement, type StyleId } from '../../shared/aiStyles';

const KEY = 'ai_render_style';
export const ON_MODEL_NOTE = 'AI draws the model around your piece; check every detail';
export const lastStyle = (): StyleId => {
  try {
    const s = localStorage.getItem(KEY) as StyleId | null;
    if (s && STYLE_IDS.includes(s)) return s;
  } catch { /* storage blocked */ }
  return 'cad';
};

/**
 * Sheet of render styles: a bottom sheet on a phone (it ends above the tab bar) and a centred dialog on a desktop. The header and the footer
 * (Cancel / Continue) stay put and only the style list scrolls. The swatches are abstract CSS art, never the owner's piece.
 * Tapping a style selects it; Continue starts the render.
 */
export const RenderStylePicker: React.FC<{
  tag?: string;
  /** Style ids the server allows; null while unknown (all shown). */
  allowed: StyleId[] | null;
  /** Balance and per-style prices from the server (null while unknown). A style the store cannot afford is disabled, with the way to add credits shown. */
  credits?: RenderCredits | null;
  onPick: (style: StyleId, placement?: Placement) => void;
  onCancel: () => void;
}> = ({ tag, allowed, credits, onPick, onCancel }) => {
  const vars = useSheet(onCancel);
  const derived = placementForTag(tag);
  const [placement, setPlacement] = useState<Placement | ''>(derived ?? '');
  const ids = STYLE_IDS.filter((s) => !allowed || allowed.includes(s));
  const price = (s: StyleId) => (credits ? credits.prices[s] ?? 0 : null);
  const poor = (s: StyleId) => !!credits && !credits.free && credits.balance < (price(s) ?? 0);
  const allPoor = ids.length > 0 && ids.every(poor);
  const last = lastStyle();
  const [sel, setSel] = useState<StyleId | null>(() => (ids.includes(last) && !poor(last) ? last : ids.find((s) => !poor(s) && s !== 'on-model') ?? null));
  const needsBody = sel === 'on-model' && !placement;
  const go = () => {
    if (!sel || needsBody || poor(sel)) return;
    try { localStorage.setItem(KEY, sel); } catch { /* storage blocked */ }
    onPick(sel, sel === 'on-model' ? (placement || undefined) : undefined);
  };
  return inRoot(
    <div className="sheet-wrap stl-wrap" style={vars} role="dialog" aria-modal="true" aria-label="Choose an AI render style" data-testid="style-picker">
      <button type="button" aria-label="Cancel" className="scrim" onClick={onCancel} />
      <div className="sheet stl-sheet">
        <div className="stl-head">
          <h3 style={{ margin: 0 }}>Choose a render style</h3>
          <p className="hint" style={{ margin: 0 }}>Your piece stays exactly the same; only the setting and light change. Your original is always kept.</p>
          {credits && (
            <p className="hint" style={{ margin: 0 }} data-testid="style-balance">
              {credits.free ? 'AI renders are free for your store.' : <>Your balance: <b>{rs(credits.balance)}</b>. A failed render is returned to your balance.</>}
              {allPoor && <> <AddCredits /></>}
            </p>
          )}
        </div>
        <div className="stl-body" data-testid="style-list">
          <div className="stl-grid">
            {ids.map((s) => {
              const noBody = s === 'on-model' && !placement;
              const cost = price(s);
              return (
                <div key={s} className={`stl-card${s === sel ? ' on' : ''}`} data-style={s}>
                  <button type="button" className="stl-main" data-testid={`style-${s}`} aria-pressed={s === sel} disabled={noBody || poor(s)} onClick={() => setSel(s)}>
                    <i className="stl-sw" data-s={s} aria-hidden="true" />
                    <b>{STYLE_INFO[s].name}{cost !== null && <span className="stl-price" data-testid={`price-${s}`}> · {credits?.free ? 'Free' : rs(cost)}</span>}</b>
                    <span>{STYLE_INFO[s].blurb}</span>
                    {poor(s) && <em>Not enough credits for this style.</em>}
                    {s === 'on-model' && <em>{noBody ? 'Not available: this collection type has no body part to place it on.' : ON_MODEL_NOTE}</em>}
                  </button>
                  {s === 'on-model' && (
                    <label className="stl-place">
                      Worn on
                      <select data-testid="style-placement" value={placement} onChange={(e) => setPlacement(e.target.value as Placement | '')}>
                        {!derived && <option value="">Choose</option>}
                        {PLACEMENTS.map((p) => <option key={p} value={p}>{PLACEMENT_LABEL[p]}</option>)}
                      </select>
                    </label>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        <div className="stl-foot">
          <button type="button" className="btn alt" data-testid="style-cancel" onClick={onCancel}>Cancel</button>
          <button type="button" className="btn" data-testid="style-continue" disabled={!sel || needsBody || poor(sel)} onClick={go}>
            {sel ? `Continue with ${STYLE_INFO[sel].name}${credits && !credits.free ? ` · ${rs(price(sel) ?? 0)}` : ''}` : 'Choose a style'}
          </button>
        </div>
      </div>
    </div>
  );
};
