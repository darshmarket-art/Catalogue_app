import React, { useState } from 'react';
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

/** Sheet of render styles. The swatches are abstract CSS art, never the owner's piece. Choosing one starts the render. */
export const RenderStylePicker: React.FC<{
  tag?: string;
  /** Style ids the server allows; null while unknown (all shown). */
  allowed: StyleId[] | null;
  onPick: (style: StyleId, placement?: Placement) => void;
  onCancel: () => void;
}> = ({ tag, allowed, onPick, onCancel }) => {
  const derived = placementForTag(tag);
  const [placement, setPlacement] = useState<Placement | ''>(derived ?? '');
  const last = lastStyle();
  const ids = STYLE_IDS.filter((s) => !allowed || allowed.includes(s));
  const pick = (s: StyleId) => {
    try { localStorage.setItem(KEY, s); } catch { /* storage blocked */ }
    onPick(s, s === 'on-model' ? (placement || undefined) : undefined);
  };
  return (
    <div className="sheet-wrap" role="dialog" aria-modal="true" aria-label="Choose an AI render style" data-testid="style-picker">
      <button type="button" aria-label="Cancel" className="scrim" onClick={onCancel} />
      <div className="sheet stl-sheet">
        <h3 style={{ margin: 0 }}>Choose a render style</h3>
        <p className="hint" style={{ margin: 0 }}>Your piece stays exactly the same; only the setting and light change. Your original is always kept.</p>
        <div className="stl-grid">
          {ids.map((s) => {
            const noBody = s === 'on-model' && !placement;
            return (
              <div key={s} className={`stl-card${s === last ? ' on' : ''}`} data-style={s}>
                <button type="button" className="stl-main" data-testid={`style-${s}`} aria-pressed={s === last} disabled={noBody} onClick={() => pick(s)}>
                  <i className="stl-sw" data-s={s} aria-hidden="true" />
                  <b>{STYLE_INFO[s].name}</b>
                  <span>{STYLE_INFO[s].blurb}</span>
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
        <button type="button" className="btn alt" data-testid="style-cancel" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
};
