import React, { useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../api';
import { fitCheck, PHOTO_SPECS, type PhotoKind } from '../../shared/photoSpecs';
import { I, Photo } from './ui';
import { PhotoCropper } from './PhotoCropper';
import { errorText } from '../bugReport';
import { RenderStylePicker } from './RenderStylePicker';
import { ON_MODEL_NOTE } from './RenderStylePicker';
import { SHOT_LABEL, STYLE_IDS, STYLE_INFO, type ModelShot, type Placement, type StyleId } from '../../shared/aiStyles';
import { acceptRender, cannotAfford, enhanceBlocked, rs, swapRender, type ModelShotResult, type ModelShots, type PhotoItem, type RenderCredits, type RenderResult } from '../aiRender';
import { AddCredits } from './AiCredits';
import { inRoot, useSheet } from './sheetKit';
export type { PhotoItem };

interface PhotoPickerProps {
  photos: PhotoItem[];
  onChange: (photos: PhotoItem[]) => void;
  max: number;
  /** Reports whether any photo is still uploading, so the form can hold back its save button. */
  onBusyChange?: (busy: boolean) => void;
  /** Shape of the preview tiles. */
  tile?: 'square' | 'banner';
  /** What the photo is for: shows the shape rule, and fits (banner, collection) or advises (design) before upload. */
  kind?: PhotoKind;
  /** Extra slots shown locked (Basic: photos 2 and 3), tapping one calls onLocked. */
  locked?: number;
  onLocked?: () => void;
  /** Offers the "AI render" switch (on by default); new uploads are then re-drawn as a CAD-style studio render, original kept. */
  aiRender?: boolean;
  /** Offers "AI Enhance" on each existing photo. The owner compares and chooses; nothing changes unless they accept and Save. */
  enhance?: boolean;
  /** Tag of the collection being edited: decides where "Worn on model" places the piece. */
  tag?: string;
}

/** Shimmer, message, elapsed seconds and a way out, laid over a photo while its render is made (40 to 105 s). */
const RenderProgress: React.FC<{ since: number; onCancel: () => void }> = ({ since, onCancel }) => {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setSecs(Math.floor((Date.now() - since) / 1000)), 1000);
    return () => clearInterval(t);
  }, [since]);
  return (
    <div data-testid="photo-rendering" className="over rnd" role="status">
      <b>Rendering your design - about a minute</b>
      <span className="rnd-time">{Math.floor(secs / 60)}:{String(secs % 60).padStart(2, '0')}</span>
      <i className="rnd-bar"><i style={{ width: `${Math.min(95, (secs / 90) * 100)}%` }} /></i>
      <button type="button" className="lnk" style={{ color: 'inherit', minHeight: 28 }} onClick={onCancel}>
        Use original
      </button>
    </div>
  );
};

/** Before and after, side by side on a desktop and one at a time (toggle) on a phone. Only "Use AI render" changes anything. */
const CompareSheet: React.FC<{ before: string; after: string; style?: string; onUse: () => void; onKeep: () => void }> = ({ before, after, style, onUse, onKeep }) => {
  const [view, setView] = useState<'a' | 'b'>('b');
  const vars = useSheet(onKeep);
  return inRoot(
    <div className="sheet-wrap rnd-wrap" style={vars} role="dialog" aria-modal="true" aria-label="Compare AI render" data-testid="render-compare">
      <button type="button" aria-label="Keep original" className="scrim" onClick={onKeep} />
      <div className="sheet rnd-cmp">
        <h3 style={{ margin: 0 }}>Your photo and the AI render</h3>
        {style && STYLE_IDS.includes(style as StyleId) && <span className="tag gold rnd-style" data-testid="render-style-tag">{STYLE_INFO[style as StyleId].name}</span>}
        {style === 'on-model' && <p className="hint" style={{ margin: 0 }}>{ON_MODEL_NOTE}.</p>}
        <div className="rnd-tabs" role="group" aria-label="Show">
          <button type="button" aria-pressed={view === 'a'} className={view === 'a' ? 'on' : ''} onClick={() => setView('a')}>Original</button>
          <button type="button" aria-pressed={view === 'b'} className={view === 'b' ? 'on' : ''} onClick={() => setView('b')}>AI render</button>
        </div>
        <div className="rnd-pair" data-view={view}>
          <figure className="rnd-a"><img src={before} alt="Original photo" /><figcaption>Original</figcaption></figure>
          <figure className="rnd-b"><img src={after} alt="AI render" /><figcaption>AI render</figcaption></figure>
        </div>
        <p className="hint" style={{ margin: 0 }}>Check that every stone and detail matches. Your original is always kept and nothing changes until you save.</p>
        <div className="col rnd-foot" style={{ gap: 8 }}>
          <button type="button" className="btn" data-testid="render-use" onClick={onUse}>Use AI render</button>
          <button type="button" className="btn alt" data-testid="render-keep" onClick={onKeep}>Keep original</button>
          <button type="button" className="lnk" style={{ alignSelf: 'center' }} data-testid="render-discard" onClick={onKeep}>Discard</button>
        </div>
      </div>
    </div>
  );
};

/** One-time model shot: progress while AI draws it, then the owner approves it, draws another, or leaves. Nothing is saved until "Use this model". */
const ModelShotSheet: React.FC<{ shot: ModelShot; since: number | null; out: ModelShotResult | null; onUse: () => void; onAgain: () => void; onCancel: () => void }> = ({ shot, since, out, onUse, onAgain, onCancel }) => {
  const vars = useSheet(onCancel);
  return inRoot(
    <div className="sheet-wrap rnd-wrap" style={vars} role="dialog" aria-modal="true" aria-label="Model shot" data-testid="model-shot-sheet">
      <button type="button" aria-label="Cancel" className="scrim" onClick={onCancel} />
      <div className="sheet rnd-cmp">
        <h3 style={{ margin: 0 }}>Model shot: {SHOT_LABEL[shot]}</h3>
        {since !== null || !out ? (
          <>
            <RenderProgress since={since ?? Date.now()} onCancel={onCancel} />
            <p className="hint" style={{ margin: 0 }}>AI is drawing a plain model with no jewellery on black. This is made once and then reused for every piece.</p>
          </>
        ) : (
          <>
            <img src={out.url} alt="Generated model shot" style={{ width: '100%', maxHeight: '55dvh', objectFit: 'contain', background: '#000', borderRadius: 12 }} data-testid="model-shot-image" />
            <p className="hint" style={{ margin: 0 }}>Every render keeps this exact person and background; only the jewellery changes. Drawing another is charged again.</p>
            <div className="col rnd-foot" style={{ gap: 8 }}>
              <button type="button" className="btn" data-testid="model-shot-use" onClick={onUse}>Use this model</button>
              <button type="button" className="btn alt" data-testid="model-shot-again" onClick={onAgain}>Draw another</button>
              <button type="button" className="lnk" style={{ alignSelf: 'center' }} onClick={onCancel}>Cancel</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 25 * 1024 * 1024;

/** Photos on a form, as the canvas draws them: a row of tiles with dashed "Add" slots (artboards 3.3, 4.2, 3.7). */
export const PhotoPicker: React.FC<PhotoPickerProps> = ({ photos, onChange, max, onBusyChange, tile = 'square', kind, locked = 0, onLocked, aiRender = false, enhance = false, tag }) => {
  const [crop, setCrop] = useState<File[]>([]);
  const spec = kind ? PHOTO_SPECS[kind] : null;
  const [uploading, setUploading] = useState<Array<{ id: number; name: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const photosRef = useRef(photos);
  photosRef.current = photos;
  const nextId = useRef(0);
  const input = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const [aiOn, setAiOn] = useState(true);
  // One job per photo ref, so several photos can render at once; each has its own abort controller and start time.
  const [rendering, setRendering] = useState<Record<string, number>>({});
  const jobs = useRef<Record<string, AbortController>>({});
  const [ready, setReady] = useState<Record<string, RenderResult>>({});
  const [aiNote, setAiNote] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<string | null>(null);
  // Photos waiting for the owner to choose a style (first one is shown), and the styles the server allows.
  const [picking, setPicking] = useState<Array<{ ref: string; mode: 'auto' | 'enhance' }>>([]);
  const [allowed, setAllowed] = useState<StyleId[] | null>(null);
  const [credits, setCredits] = useState<RenderCredits | null>(null);
  const [shots, setShots] = useState<ModelShots | null>(null);
  // The one-time model shot being made (since = still drawing) or waiting for approval.
  const [shotJob, setShotJob] = useState<{ shot: ModelShot; since: number | null; out: ModelShotResult | null } | null>(null);
  const busy = Object.keys(rendering).length;

  useEffect(() => {
    onBusyChange?.(uploading.length > 0 || busy > 0);
  }, [uploading.length, busy]);

  useEffect(() => {
    if (enhance || aiRender) refreshStatus(true);
    return () => Object.values(jobs.current).forEach((c) => c.abort()); // leaving the screen stops waiting; nothing is applied
  }, []);

  /** Balance and prices are the server's; ask again after anything that may have changed them. */
  const refreshStatus = (first = false) =>
    api.renderStatus().then((s) => {
      setCredits(s.credits ?? null);
      if (s.modelShots) setShots(s.modelShots);
      if (enhance) { const b = enhanceBlocked(s); if (b) setBlocked(b); } // never clears a reason the last attempt just showed
      if (first && s.styles) setAllowed(s.styles as StyleId[]);
      if (s.credits && cannotAfford(s.credits, s.styles)) setAiOn(false);
    }).catch(() => {});

  const stop = (ref: string) => {
    jobs.current[ref]?.abort();
    delete jobs.current[ref];
    setRendering((r) => { const { [ref]: _gone, ...rest } = r; return rest; });
  };

  /**
   * Renders one photo. 'auto' (just uploaded): the render replaces it when it arrives. 'enhance' (existing photo): the render waits in the
   * compare sheet for the owner's choice. Any failure, or "Use original", leaves the photo as it is and says why.
   */
  const render = async (ref: string, mode: 'auto' | 'enhance' = 'auto', style: StyleId = 'cad', placement?: Placement) => {
    if (jobs.current[ref]) return;
    const ctl = new AbortController();
    jobs.current[ref] = ctl;
    setRendering((r) => ({ ...r, [ref]: Date.now() }));
    setAiNote(null);
    try {
      const out = await api.renderPhoto(ref, ctl.signal, style, placement, crypto.randomUUID());
      if (out.credits) setCredits((c) => (c ? { ...c, balance: out.credits!.balance, low: !c.free && out.credits!.balance <= 24 } : c));
      if (ctl.signal.aborted || !photosRef.current.some((p) => p.ref === ref)) return;
      if (mode === 'auto') {
        if (out.renderId) void api.keepRender(out.renderId, true).catch(() => {});
        photosRef.current = photosRef.current.map((p) => (p.ref === ref ? out : p));
        onChange(photosRef.current);
      } else setReady((r) => ({ ...r, [ref]: out }));
    } catch (err) {
      if (ctl.signal.aborted) return;
      if (!(err instanceof ApiError && err.handled)) {
        setAiNote(err instanceof ApiError ? err.message : 'AI render did not work for this photo. Your original photo is used.');
      }
      // Switched off, out of credits, or this month's renders used up: stop trying for the rest of this form.
      if (err instanceof ApiError && (err.status === 503 || err.status === 402)) {
        setAiOn(false);
        setBlocked(err.code === 'credits' ? 'You do not have enough AI credits.' : err.status === 503 ? err.message.replace(/ Your original photo is used\.$/, '') : 'This store has used its AI renders for this month.');
      }
      void refreshStatus(); // a failed render was refunded; show the true balance
    } finally {
      if (jobs.current[ref] === ctl) stop(ref);
    }
  };

  const makeShot = async (shot: ModelShot) => {
    const key = `shot:${shot}`;
    if (jobs.current[key]) return;
    const ctl = new AbortController();
    jobs.current[key] = ctl;
    setShotJob({ shot, since: Date.now(), out: null });
    setAiNote(null);
    try {
      const out = await api.renderModelShot(shot, ctl.signal, crypto.randomUUID());
      if (ctl.signal.aborted) return;
      if (out.credits) setCredits((c) => (c ? { ...c, balance: out.credits!.balance } : c));
      setShotJob({ shot, since: null, out });
    } catch (err) {
      if (ctl.signal.aborted) return;
      if (!(err instanceof ApiError && err.handled)) setAiNote(err instanceof ApiError ? err.message : 'The model shot did not work. Please try again.');
      setShotJob(null);
      void refreshStatus();
    } finally {
      if (jobs.current[key] === ctl) delete jobs.current[key];
    }
  };
  const cancelShot = () => { if (shotJob) { jobs.current[`shot:${shotJob.shot}`]?.abort(); delete jobs.current[`shot:${shotJob.shot}`]; } setShotJob(null); void refreshStatus(); };
  const useShot = async () => {
    if (!shotJob?.out) return;
    const { shot, out } = shotJob;
    try {
      await api.approveModelShot(shot, out.ref);
      setShots((m) => ({ ...(m ?? {}), [shot]: { ref: out.ref, url: out.url } }));
      setShotJob(null);
    } catch (err) {
      setShotJob(null);
      setAiNote(err instanceof ApiError ? err.message : 'The model shot could not be saved.');
    }
  };

  const ask = (ref: string, mode: 'auto' | 'enhance') => setPicking((q) => (q.some((x) => x.ref === ref) ? q : [...q, { ref, mode }]));
  const closeReady = (ref: string) => setReady((r) => { const { [ref]: _gone, ...rest } = r; return rest; });
  // The owner's later choice is only recorded for reporting; either way the render stays charged.
  const decide = (ref: string, kept: boolean) => { const id = ready[ref]?.renderId; if (id) void api.keepRender(id, kept).catch(() => {}); };
  const useReady = (ref: string) => {
    const out = ready[ref];
    decide(ref, true);
    closeReady(ref);
    if (!out) return;
    photosRef.current = acceptRender(photosRef.current, ref, out);
    onChange(photosRef.current);
  };
  const reviewing = Object.keys(ready).find((ref) => photos.some((p) => p.ref === ref));

  const room = max - photos.length - uploading.length;

  const upload = async (file: File) => {
    const id = nextId.current++;
    setUploading((prev) => [...prev, { id, name: file.name }]);
    try {
      const { ref, url } = await api.uploadPhoto(file);
      // Uploads of a multi-select finish independently, so build on the latest list rather than the last render's.
      photosRef.current = [...photosRef.current, { ref, url }];
      onChange(photosRef.current);
      if (aiRender && aiOn) ask(ref, 'auto');
    } catch (err) {
      if (!(err instanceof ApiError && err.handled)) {
        setError(errorText(err, 'PhotoPicker', 'The photo could not be uploaded.'));
      }
    } finally {
      setUploading((prev) => prev.filter((u) => u.id !== id));
    }
  };

  /** Checks the photo against the rule; right-shaped ones upload as they are, wrong-shaped ones go to the crop step. */
  const prepare = async (file: File) => {
    if (!spec) return upload(file);
    const size = await createImageBitmap(file).then((b) => { const s = { w: b.width, h: b.height }; b.close(); return s; }).catch(() => null);
    const fit = size ? fitCheck(size.w, size.h, spec) : 'ok';
    if (fit === 'ok') return upload(file);
    if (fit === 'small' && spec.strict) {
      setError(`"${file.name}" is too small (${size!.w} x ${size!.h} px). ${spec.label} photos need at least ${spec.minW} x ${spec.minH} px.`);
      return;
    }
    if (fit === 'small') return upload(file); // designs: advice only
    setCrop((q) => [...q, file]);
  };

  const handleFiles = (list: FileList | null) => {
    setError(null);
    if (!list || list.length === 0) return;
    const files = [...list];
    const bad = files.find((f) => !ACCEPTED.includes(f.type));
    if (bad) {
      setError(`"${bad.name}" is not a JPEG, PNG or WebP photo. On iPhone, choose "Most Compatible" or share the photo as JPEG.`);
      return;
    }
    const big = files.find((f) => f.size > MAX_BYTES);
    if (big) {
      setError(`"${big.name}" is larger than 25 MB.`);
      return;
    }
    const accepted = files.slice(0, Math.max(room, 0));
    if (accepted.length < files.length) {
      setError(max === 1 ? 'Only one photo is allowed here. Remove the current one to replace it.' : `You can add up to ${max} photos. Extra photos were skipped.`);
    }
    accepted.forEach((f) => void prepare(f));
  };

  const remove = (index: number) => {
    stop(photos[index].ref);
    setPicking((q) => q.filter((x) => x.ref !== photos[index].ref));
    closeReady(photos[index].ref);
    onChange(photos.filter((_, i) => i !== index));
  };
  const banner = tile === 'banner';
  const h = banner ? 110 : 92;
  const tileStyle: React.CSSProperties = banner ? { aspectRatio: '2 / 1' } : { height: h };

  return (
    <div className="col" style={{ gap: 8 }}>
      {spec && <p className="hint" style={{ margin: 0 }}>{spec.tip}</p>}
      {aiRender && (
        <label className="row" style={{ gap: 8, alignItems: 'flex-start', fontSize: '0.875rem', cursor: 'pointer' }}>
          <input type="checkbox" data-testid="ai-render-toggle" checked={aiOn} onChange={(e) => { setAiOn(e.target.checked); setAiNote(null); }} style={{ marginTop: 3 }} />
          <span>
            <b>AI render</b>: turn new photos into a precise, CAD-style studio render. The piece stays the same; your original photo is kept and you can switch back.
            {credits && (
              <span className="hint" style={{ display: 'block' }} data-testid="ai-render-price">
                {credits.free ? 'Free for your store.' : <>From {rs(Math.min(...Object.values(credits.prices)))} per render · balance <b>{rs(credits.balance)}</b>. </>}
                {cannotAfford(credits, allowed) && <AddCredits />}
              </span>
            )}
          </span>
        </label>
      )}
      {crop[0] && spec && (
        <PhotoCropper
          file={crop[0]}
          spec={spec}
          onDone={(f) => {
            setCrop((q) => q.slice(1));
            void upload(f);
          }}
          onCancel={() => setCrop((q) => q.slice(1))}
          onSkip={spec.strict ? undefined : () => {
            const f = crop[0];
            setCrop((q) => q.slice(1));
            void upload(f);
          }}
        />
      )}
      <div className="grid2" style={banner ? { gridTemplateColumns: '1fr', gap: 10 } : { gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 10 }}>
        {photos.map((photo, i) => (
          <Photo key={photo.ref} src={photo.url} style={tileStyle}>
            {max > 1 && i === 0 && (
              <span className="tag over" style={{ left: 6, bottom: 6, background: 'var(--card)' }}>
                Cover
              </span>
            )}
            <button type="button" aria-label={`Remove photo ${i + 1}`} onClick={() => remove(i)} className="ib over" style={{ top: 6, right: 6, width: 30, height: 30, borderRadius: 10 }}>
              <I n="x" size="s" />
            </button>
            {photo.original && (
              <span className="tag gold over" style={{ left: 6, top: 6 }}>
                AI render
              </span>
            )}
            {rendering[photo.ref] && <RenderProgress since={rendering[photo.ref]} onCancel={() => stop(photo.ref)} />}
            {(photo.original || photo.render) && (
              <button
                type="button"
                data-testid="photo-swap-render"
                className="tag over"
                style={{ right: 6, bottom: 6, background: 'var(--card)', border: 0, cursor: 'pointer' }}
                onClick={() => onChange(photos.map((p, j) => (j === i ? swapRender(p) : p)))}
              >
                {photo.original ? 'Revert to original' : 'Use AI render'}
              </button>
            )}
          </Photo>
        ))}
        {uploading.map((u) => (
          <div key={u.id} data-testid="photo-uploading" className="dashtile on animate-pulse" style={tileStyle}>
            <I n="upload" />
            Uploading…
          </div>
        ))}
        {Array.from({ length: Math.max(room, 0) }, (_, i) => (
          <button key={`add-${i}`} type="button" className={`dashtile${i === 0 ? ' on' : ''}`} style={tileStyle} onClick={() => input.current?.click()}>
            <I n="camera" />
            {banner ? 'Add a banner photo' : 'Add'}
          </button>
        ))}
        {Array.from({ length: locked }, (_, i) => (
          <button key={`lock-${i}`} type="button" className="dashtile" style={tileStyle} onClick={onLocked}>
            <I n="lock" />
            <span className="pro">Pro</span>
          </button>
        ))}
      </div>
      {enhance && photos.map((photo, i) =>
        photo.original || photo.render || !photo.ref ? null : blocked ? (
          i === 0 && <p key={photo.ref} className="hint" style={{ margin: 0 }} data-testid="enhance-blocked">AI Enhance is not available: {blocked} {cannotAfford(credits, allowed) && <AddCredits />}</p>
        ) : (
          <button key={photo.ref} type="button" className="lnk" data-testid="photo-enhance" style={{ minHeight: 32, alignSelf: 'flex-start' }} disabled={!!rendering[photo.ref]} onClick={() => ask(photo.ref, 'enhance')}>
            {max > 1 ? `AI Enhance photo ${i + 1}` : 'AI Enhance'}{credits && !credits.free ? ` (from ${rs(Math.min(...Object.values(credits.prices)))})` : ''}
          </button>
        )
      )}
      {room > 0 && (
        <button type="button" className="lnk" style={{ minHeight: 32, alignSelf: 'flex-start' }} onClick={() => camera.current?.click()}>
          <I n="camera" size="s" />
          Take a photo
        </button>
      )}
      <input
        ref={camera}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        data-testid="photo-camera-input"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = '';
        }}
      />
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple={max > 1}
        className="hidden"
        data-testid="photo-gallery-input"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = '';
        }}
      />
      {shotJob && <ModelShotSheet shot={shotJob.shot} since={shotJob.since} out={shotJob.out} onUse={() => void useShot()} onAgain={() => void makeShot(shotJob.shot)} onCancel={cancelShot} />}
      {!shotJob && picking[0] && photos.some((p) => p.ref === picking[0].ref) && (
        <RenderStylePicker
          tag={tag}
          modelShots={shots}
          recipes={picking[0].mode === 'auto'}
          onMakeShot={(s) => void makeShot(s)}
          allowed={allowed}
          credits={credits}
          onCancel={() => setPicking((q) => q.slice(1))}
          onPick={(style, placement) => {
            const { ref, mode } = picking[0];
            setPicking((q) => q.slice(1));
            void render(ref, mode, style, placement);
          }}
        />
      )}
      {reviewing && (
        <CompareSheet before={photos.find((p) => p.ref === reviewing)!.url} after={ready[reviewing].url} style={ready[reviewing].style} onUse={() => useReady(reviewing)} onKeep={() => { decide(reviewing, false); closeReady(reviewing); }} />
      )}
      {aiNote && (
        <p role="status" className="hint" style={{ margin: 0 }}>
          {aiNote}
        </p>
      )}
      {error && (
        <p role="alert" className="err">
          {error}
        </p>
      )}
    </div>
  );
};
