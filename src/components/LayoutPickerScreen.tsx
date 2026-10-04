import React, { useState } from 'react';
import { LAYOUTS, layoutPlan, type LayoutId } from '../../shared/layouts';
import { api, ApiError } from '../api';
import { merchant } from '../merchant';
import { usePlan, upgradeNotice } from '../plan';
import type { ActiveScreen } from '../types';
import { I, Notice } from './ui';

const CHOSEN_KEY = 'layout-chosen';

/** A layout's look in miniature, drawn in CSS with that layout's own colours (not the store's theme). */
const Thumb: React.FC<{ id: LayoutId }> = ({ id }) => {
  const frame: React.CSSProperties = { width: 92, flex: 'none', alignSelf: 'stretch', minHeight: 156, borderRadius: 16, border: '1px solid var(--line)', position: 'relative', overflow: 'hidden' };
  if (id === 'emergent')
    return (
      <div aria-hidden="true" data-testid="layout-thumb-emergent" style={{ ...frame, background: '#FAF6F1' }}>
        <i style={{ position: 'absolute', left: 8, top: 10, width: 14, height: 14, borderRadius: 4, background: '#5C1F3A' }} />
        <i style={{ position: 'absolute', left: 27, top: 14, width: 30, height: 5, borderRadius: 3, background: '#1A1A1A', opacity: 0.7 }} />
        <i style={{ position: 'absolute', left: 8, right: 8, top: 32, height: 12, borderRadius: 99, background: '#F0E6D8' }} />
        <i style={{ position: 'absolute', left: 8, right: 8, top: 52, height: 44, borderRadius: 8, background: 'linear-gradient(150deg,#e6c98a,#b98a45 60%,#8e5a55)' }} />
        <i style={{ position: 'absolute', left: 8, top: 102, width: 34, height: 28, borderRadius: 7, background: 'linear-gradient(150deg,#f0d9d3,#cf9f96)' }} />
        <i style={{ position: 'absolute', right: 8, top: 102, width: 34, height: 28, borderRadius: 7, background: 'linear-gradient(150deg,#d9e6dc,#8fb09c)' }} />
        <i style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 18, background: '#5C1F3A' }} />
        {[24, 44, 64].map((x) => (
          <i key={x} style={{ position: 'absolute', left: x, bottom: 7, width: 4, height: 4, borderRadius: '50%', background: '#C9A961' }} />
        ))}
      </div>
    );
  return (
    <div aria-hidden="true" data-testid="layout-thumb-gilded" style={{ ...frame, background: '#fbf6ee' }}>
      <i style={{ position: 'absolute', left: 8, right: 8, top: 10, height: 52, borderRadius: 11, background: 'linear-gradient(160deg,#7a3a5a,#4a1835)' }} />
      <i style={{ position: 'absolute', left: 16, top: 20, width: 34, height: 4, borderRadius: 3, background: '#e2c389' }} />
      <i style={{ position: 'absolute', left: 16, top: 30, width: 50, height: 7, borderRadius: 3, background: '#fff7ea', opacity: 0.9 }} />
      <i style={{ position: 'absolute', left: 8, top: 70, width: 34, height: 34, borderRadius: 9, background: '#fff', border: '1px solid rgb(74 24 53 / 0.1)' }} />
      <i style={{ position: 'absolute', right: 8, top: 70, width: 34, height: 34, borderRadius: 9, background: '#fff', border: '1px solid rgb(74 24 53 / 0.1)' }} />
      <i style={{ position: 'absolute', left: 8, right: 8, top: 112, height: 14, borderRadius: 7, background: '#fff', border: '1px solid rgb(74 24 53 / 0.1)' }} />
      <i style={{ position: 'absolute', left: 10, right: 10, bottom: 8, height: 16, borderRadius: 9, background: '#fffcf7', boxShadow: '0 2px 8px rgb(43 14 31 / 0.25)' }} />
      {[28, 44, 60].map((x) => (
        <i key={x} style={{ position: 'absolute', left: x, bottom: 14, width: 4, height: 4, borderRadius: '50%', background: x === 44 ? '#a8813f' : '#c9bdb0' }} />
      ))}
    </div>
  );
};

/** The layout the owner just picked, kept for this tab: the server's store cache can take a moment, so the page may reload before it shows the change. */
const chosenBefore = (): string | null => {
  try {
    return sessionStorage.getItem(CHOSEN_KEY);
  } catch {
    return null;
  }
};

/** Storefront layout (admin): two preview cards. Gilded is for every plan; Emergent is Pro, so Basic gets the upgrade notice instead of the API call. */
export const LayoutPickerScreen: React.FC<{ onNavigate: (screen: ActiveScreen) => void }> = ({ onNavigate }) => {
  const { flags, effectivePlan } = usePlan();
  const active = merchant.layout;
  const [busy, setBusy] = useState<LayoutId | null>(null);
  const [saved, setSaved] = useState<LayoutId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const chosen = chosenBefore();

  const choose = async (id: LayoutId) => {
    const name = LAYOUTS.find((l) => l.id === id)?.name ?? id;
    if (layoutPlan(id) === 'pro' && !flags.premiumLayouts) return upgradeNotice(`The ${name} layout`);
    setBusy(id);
    setError(null);
    try {
      await api.setLayout(id);
      try {
        sessionStorage.setItem(CHOSEN_KEY, id);
      } catch {
        // storage unavailable: the page still reloads, it just cannot remind the owner
      }
      setSaved(id);
      // The server embeds the layout in the page, so a reload is what applies it for this owner.
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      setBusy(null);
      if (err instanceof ApiError && err.status === 402) upgradeNotice(`The ${name} layout`);
      else if (!(err instanceof ApiError && err.handled)) setError(err instanceof Error ? err.message : 'Could not change the layout.');
    }
  };

  return (
    <div className="scroll no-tabs" style={{ gap: 12 }}>
      <p className="sub">Choose how your store looks to buyers. The admin screens stay the same in every layout.</p>

      {saved && (
        <div data-testid="layout-saved">
          <Notice tone="ok">Saved. Your storefront updates for visitors within a minute.</Notice>
        </div>
      )}
      {error && <Notice tone="error">{error}</Notice>}

      <div className="col" style={{ gap: 12 }} role="list" aria-label="Storefront layouts">
        {LAYOUTS.map((l) => {
          const isPro = l.plan === 'pro';
          const isActive = l.id === active;
          const locked = isPro && !flags.premiumLayouts;
          const applying = !isActive && !saved && chosen === l.id;
          return (
            <article key={l.id} role="listitem" data-testid={`layout-${l.id}`} aria-current={isActive ? 'true' : undefined} className="card row" style={{ alignItems: 'stretch', gap: 14, outline: isActive ? '2px solid var(--plum)' : undefined }}>
              <Thumb id={l.id} />
              <div className="col grow" style={{ gap: 6 }}>
                <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                  <h2 style={{ fontSize: 22 }}>{l.name}</h2>
                  {isPro ? <span className="pro">Pro</span> : <span className="tag mut">Standard</span>}
                </div>
                <p className="sub" style={{ fontSize: 13.5 }}>
                  {l.blurb}
                </p>
                <span className="grow" />
                {isActive ? (
                  <span className="tag ok" data-testid="layout-active" style={{ alignSelf: 'flex-start' }}>
                    <I n="check" size="s" />
                    &nbsp;Active
                  </span>
                ) : (
                  <>
                    {applying && <span className="hint">Switching to {l.name}. This can take up to a minute to show.</span>}
                    <button type="button" data-testid={`layout-use-${l.id}`} className={`btn sm${locked ? ' alt' : ''}`} disabled={busy !== null || saved !== null} onClick={() => choose(l.id)}>
                      {locked ? (
                        <>
                          <I n="lock" size="s" />
                          Upgrade to use
                        </>
                      ) : busy === l.id ? (
                        'Saving…'
                      ) : (
                        `Use ${l.name}`
                      )}
                    </button>
                  </>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {effectivePlan !== 'pro' && (
        <div className="note">
          <b>Emergent is part of Pro.</b> Your store keeps the Gilded layout on Basic.{' '}
          <button type="button" className="lnk" style={{ minHeight: 0, fontSize: 'inherit' }} onClick={() => onNavigate('plans')}>
            Compare Basic and Pro
          </button>
        </div>
      )}
    </div>
  );
};
