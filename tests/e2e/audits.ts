// The page audits. runAudits() is serialised into the page by page.evaluate, so it must stay self-contained (no imports, no outer helpers).
// Thresholds (CSS px here; the Apple HIG numbers are in points, 1pt = 1 CSS px on a phone):
//   tap targets: pass line 44x44, hard floor 28x28  (apple-design references/hig/accessibility.md, "Mobility: Offer sufficiently sized controls": iOS default 44x44, minimum 28x28)
//   text: 12px minimum from the brief                (apple-design references/hig/accessibility.md, "Vision: Use recommended defaults for custom type sizes": iOS minimum 11pt)
//   200% text: nothing may be clipped at 200%        (accessibility.md, "Vision: Support larger text sizes": enlarge text by at least 200 percent)
//   no horizontal overflow, nothing hidden behind bars (references/hig/layout.md, "Adaptability" and "Guides and safe areas")

export interface Offender { selector: string; text: string; [k: string]: unknown }
export interface AuditResult {
  overflow: { scrollWidth: number; innerWidth: number; /** scrollWidth > width: the page scrolls sideways. */ over: boolean; /** Content sticks out past the screen edge but the page does not scroll (the root hides it): cut off, unreachable. */ cutOff: boolean; offenders: Array<Offender & { overBy: number; left: number; right: number; width: number }> };
  coveredInputs: Array<Offender & { ratio: number; coveredBy: string; centerCovered: boolean; offscreen: boolean }>;
  tapTargets: { checked: number; exempt: number; offenders: Array<Offender & { w: number; h: number; severe: boolean; pseudo: boolean; /** One of the main controls (PRIMARY_CONTROLS): these must pass. */ primary: boolean; count: number }> };
  /** Visible text fields whose computed font-size is under 16px: iOS Safari zooms the page when one is focused. */
  smallInputs: Array<Offender & { fontSize: number }>;
  smallText: Array<Offender & { fontSize: number; count: number }>;
  /** Only filled when `clip` is true (the 200% runs). */
  clippedText: Array<Offender & { axis: 'x' | 'y'; scroll: number; client: number; ellipsis: boolean; lineClamp: boolean; count: number }>;
}

export const MIN_TARGET = 44;
export const HARD_FLOOR = 28;
export const MIN_TEXT_PX = 12;
/** iOS Safari zooms the page into a focused field whose text is under 16px (apple-design text-fields.md: a field must stay readable). */
export const MIN_INPUT_PX = 16;
/** The controls Phase 3a gave a 44px hit box; any of these under 44x44 is a regression. Dots, the language and layout switches and the letter rail are packed edge to edge on purpose and are not in it. */
export const PRIMARY_CONTROLS = '.em-heart, .em-opts, .em-x, .em-qty button, .em-chip, .chip, .em-link, .em-btn, .btn, .em-circ, .ib, .em-brand, .lnk, .em-cartbar button, .em-pd-nav button, .em-find-call, .em-tab, .em-addbar';

export function runAudits(args: { width: number; clip: boolean; minTarget: number; hardFloor: number; minText: number; minInput: number; primary: string }): AuditResult {
  const { width, clip, minTarget, hardFloor, minText, minInput, primary } = args;
  const cs = (e: Element, p?: string) => getComputedStyle(e, p);
  const cls = (e: Element) => (typeof (e as HTMLElement).className === 'string' ? (e as HTMLElement).className : '').trim().split(/\s+/).filter(Boolean);
  const one = (e: Element) => {
    const tid = e.getAttribute('data-testid');
    if (e.id) return `${e.tagName.toLowerCase()}#${e.id}`;
    if (tid) return `${e.tagName.toLowerCase()}[data-testid=${tid}]`;
    return e.tagName.toLowerCase() + cls(e).slice(0, 2).map((c) => '.' + c).join('');
  };
  // Short, stable name: the element and its parent, so the same offender groups across sizes.
  const sel = (e: Element) => (e.parentElement && e.parentElement !== document.body ? one(e.parentElement) + ' > ' : '') + one(e);
  const label = (e: Element) => ((e.getAttribute('aria-label') || (e as HTMLElement).innerText || e.textContent || '').replace(/\s+/g, ' ').trim()).slice(0, 40);
  // The width the test asked for, not innerWidth: a phone-emulating browser widens its layout viewport to fit an overflowing page, which would hide the very bug.
  const W = width;

  const shown = (e: Element) => {
    const s = cs(e);
    if (s.display === 'none' || s.visibility === 'hidden' || s.visibility === 'collapse' || Number(s.opacity) === 0) return false;
    const r = e.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const hiddenByAncestor = (e: Element) => {
    for (let a: Element | null = e; a && a !== document.documentElement; a = a.parentElement) {
      if (a.getAttribute('aria-hidden') === 'true' || a.hasAttribute('inert')) return true;
      const s = cs(a);
      if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return true;
    }
    return false;
  };
  /** Pushed out of view by a clipping ancestor (a carousel slide, a closed drawer): not on screen, so not part of any audit. */
  const clippedAway = (e: Element) => {
    const r = e.getBoundingClientRect();
    for (let a = e.parentElement; a && a !== document.body && a !== document.documentElement; a = a.parentElement) {
      const s = cs(a);
      if (/(hidden|clip|auto|scroll)/.test(s.overflowX + s.overflowY)) {
        const ar = a.getBoundingClientRect();
        if (r.right <= ar.left || r.left >= ar.right || r.bottom <= ar.top || r.top >= ar.bottom) return true;
      }
    }
    return false;
  };
  const floating = (h: Element) => {
    if (h.closest('[role=menu],[role=listbox],[role=dialog],[aria-modal=true]')) return true;
    for (let a: Element | null = h; a; a = a.parentElement) {
      const p = cs(a).position;
      if (p === 'fixed' || p === 'sticky') return false;
      if (p === 'absolute') return true;
    }
    return false;
  };
  const insideFixed = (e: Element) => {
    for (let a: Element | null = e; a; a = a.parentElement) if (cs(a).position === 'fixed') return true;
    return false;
  };
  // A modal layer (the tour, a sheet, the cropper, a design opened over the catalogue) is a fixed element that covers the screen with content on top.
  // While one is open the page beneath is not the screen being looked at, so fields, targets and text outside it are left out (overflow is not: it is real either way).
  const H = window.innerHeight;
  const blockers = Array.from(document.body.querySelectorAll('*')).filter((e) => {
    if (cs(e).position !== 'fixed' || !shown(e) || hiddenByAncestor(e)) return false;
    const r = e.getBoundingClientRect();
    const mid = document.elementFromPoint(W / 2, H / 2);
    return r.width >= W * 0.9 && r.height >= H * 0.9 && Boolean(mid) && e.contains(mid);
  });
  const inScope = (e: Element) => blockers.length === 0 || blockers.some((b) => b.contains(e));
  /** One entry per selector (and size), with how many times it occurs, so a card repeated 20 times is one line. */
  const addGrouped = <T extends Offender>(map: Map<string, T & { count: number }>, key: string, item: T) => {
    const hit = map.get(key);
    if (hit) hit.count++;
    else map.set(key, { ...item, count: 1 });
  };
  const clippers = (e: Element) => {
    for (let a = e.parentElement; a && a !== document.body && a !== document.documentElement; a = a.parentElement) {
      const s = cs(a);
      if (/(hidden|clip|auto|scroll)/.test(s.overflowX)) return true;
    }
    return false;
  };

  // (a) Horizontal overflow. Offenders are the elements that break out of an otherwise fitting parent (the cause, not its ancestors or children).
  const bust = (e: Element) => {
    const r = e.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && (r.right > W + 1 || r.left < -1);
  };
  const overflowOffenders: AuditResult['overflow']['offenders'] = [];
  for (const e of Array.from(document.body.querySelectorAll('*'))) {
    if (!bust(e) || !shown(e) || insideFixed(e) || clippers(e)) continue;
    if (e.parentElement && e.parentElement !== document.body && bust(e.parentElement) && !clippers(e.parentElement) && !insideFixed(e.parentElement)) continue;
    const r = e.getBoundingClientRect();
    overflowOffenders.push({ selector: sel(e), text: label(e), overBy: Math.round(Math.max(r.right - W, -r.left)), left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width) });
  }
  overflowOffenders.sort((a, b) => b.overBy - a.overBy);
  const sw = document.documentElement.scrollWidth;

  // (b) Focus each visible field, then see whether a fixed or sticky element that does not belong to it sits on top.
  const bars = Array.from(document.querySelectorAll('body *')).filter((e) => {
    const p = cs(e).position;
    return (p === 'fixed' || p === 'sticky') && shown(e) && !hiddenByAncestor(e);
  });
  const coveredInputs: AuditResult['coveredInputs'] = [];
  const fields = Array.from(document.querySelectorAll<HTMLElement>('input, textarea, select')).filter((e) => {
    const t = (e as HTMLInputElement).type;
    return !['hidden', 'file', 'checkbox', 'radio'].includes(t) && !(e as HTMLInputElement).disabled && shown(e) && !hiddenByAncestor(e) && !clippedAway(e) && inScope(e);
  });
  for (const f of fields) {
    f.focus({ preventScroll: false });
    const r = f.getBoundingClientRect();
    const vis = { l: Math.max(r.left, 0), t: Math.max(r.top, 0), r: Math.min(r.right, W), b: Math.min(r.bottom, window.innerHeight) };
    const visArea = Math.max(0, vis.r - vis.l) * Math.max(0, vis.b - vis.t);
    const offscreen = visArea < r.width * r.height * 0.5;
    const cx = Math.min(Math.max(r.left + r.width / 2, 0), W - 1);
    const cy = Math.min(Math.max(r.top + r.height / 2, 0), window.innerHeight - 1);
    const hit = document.elementFromPoint(cx, cy);
    // An open menu or dropdown on top is a popover the person chose to open (an absolute-positioned child inside the bar, or a dialog), not a bar that sits over the page.
    const hitBar = hit && !floating(hit) ? bars.find((b) => b.contains(hit) && !b.contains(f) && !f.contains(b)) : undefined;
    // Bars are asked again now, after the focus: one that hides itself while a field has focus (the app does, on touch screens, so the keyboard has the room) is not on top of anything,
    // and neither is one underneath a modal layer that holds the field.
    const standing = bars.filter((b) => shown(b) && inScope(b));
    let covered = 0;
    let by: Element | undefined = hitBar;
    for (const b of standing) {
      if (b.contains(f) || f.contains(b)) continue;
      const br = b.getBoundingClientRect();
      const a = Math.max(0, Math.min(br.right, vis.r) - Math.max(br.left, vis.l)) * Math.max(0, Math.min(br.bottom, vis.b) - Math.max(br.top, vis.t));
      if (a > covered) { covered = a; by = b; }
    }
    const ratio = visArea ? covered / visArea : 0;
    if (hitBar || ratio >= 0.5 || offscreen) {
      coveredInputs.push({ selector: sel(f), text: f.getAttribute('aria-label') || f.getAttribute('placeholder') || f.id || '', ratio: Math.round(ratio * 100) / 100, coveredBy: by ? sel(by) : '', centerCovered: Boolean(hitBar), offscreen });
    }
    f.blur();
  }

  // The app lets its bars back 200 ms after the last blur; the page is audited as it rests, so that happens now (the loop above is synchronous).
  document.documentElement.removeAttribute('data-typing');

  // (c) Tap targets. The effective box is the element's border box (so padding counts) widened to include absolutely positioned ::before/::after boxes.
  const tapOffenders = new Map<string, AuditResult['tapTargets']['offenders'][number]>();
  let checked = 0;
  let exempt = 0;
  for (const e of Array.from(document.querySelectorAll<HTMLElement>('button, a, [role=button]'))) {
    if (!shown(e) || hiddenByAncestor(e) || clippedAway(e) || !inScope(e) || (e as HTMLButtonElement).disabled || cs(e).pointerEvents === 'none') continue;
    const r = e.getBoundingClientRect();
    if (r.right <= 0 || r.left >= W) continue;
    // A link inside a sentence is exempt (WCAG 2.5.8 inline exception; Apple does not size inline links either).
    if (e.tagName === 'A' && cs(e).display === 'inline' && e.parentElement && (e.parentElement.textContent || '').trim().length > (e.textContent || '').trim().length + 3) { exempt++; continue; }
    checked++;
    let L = r.left, T = r.top, R = r.right, B = r.bottom;
    let pseudo = false;
    const host = cs(e);
    for (const which of ['::before', '::after']) {
      const p = cs(e, which);
      if (p.content === 'none' || p.content === 'normal' || p.position !== 'absolute' || p.display === 'none' || host.position === 'static') continue;
      const pl = parseFloat(host.borderLeftWidth) || 0;
      const pt = parseFloat(host.borderTopWidth) || 0;
      const padW = r.width - pl - (parseFloat(host.borderRightWidth) || 0);
      const padH = r.height - pt - (parseFloat(host.borderBottomWidth) || 0);
      const left = parseFloat(p.left), right = parseFloat(p.right), top = parseFloat(p.top), bottom = parseFloat(p.bottom);
      let w = parseFloat(p.width), h = parseFloat(p.height);
      if (Number.isNaN(w)) w = padW - (left || 0) - (right || 0);
      if (Number.isNaN(h)) h = padH - (top || 0) - (bottom || 0);
      // A box centred with translate(-50%, -50%) is moved by its transform: the computed matrix has the offset in px.
      const tf = p.transform && p.transform !== 'none' ? new DOMMatrixReadOnly(p.transform) : null;
      const x0 = r.left + pl + (Number.isNaN(left) ? padW - (right || 0) - w : left) + (tf ? tf.m41 : 0);
      const y0 = r.top + pt + (Number.isNaN(top) ? padH - (bottom || 0) - h : top) + (tf ? tf.m42 : 0);
      if (w > 0 && h > 0) { L = Math.min(L, x0); T = Math.min(T, y0); R = Math.max(R, x0 + w); B = Math.max(B, y0 + h); pseudo = true; }
    }
    const w = R - L, h = B - T;
    if (w < minTarget - 0.5 || h < minTarget - 0.5) {
      addGrouped(tapOffenders, `${sel(e)}|${Math.round(w)}x${Math.round(h)}`, { selector: sel(e), text: label(e), w: Math.round(w), h: Math.round(h), severe: w < hardFloor || h < hardFloor, pseudo, primary: e.matches(primary) });
    }
  }

  // (d) Text under the minimum size, by computed font-size of the element that owns the text.
  const smallText = new Map<string, AuditResult['smallText'][number]>();
  const clippedText = new Map<string, AuditResult['clippedText'][number]>();
  for (const e of Array.from(document.body.querySelectorAll<HTMLElement>('*'))) {
    if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'SVG', 'PATH'].includes(e.tagName.toUpperCase())) continue;
    const own = Array.from(e.childNodes).filter((n) => n.nodeType === 3).map((n) => n.textContent || '').join('').replace(/\s+/g, ' ').trim();
    const s = cs(e);
    const visible = () => shown(e) && !hiddenByAncestor(e) && !clippedAway(e) && inScope(e) && e.getBoundingClientRect().left < W && e.getBoundingClientRect().right > 0;
    if (own && parseFloat(s.fontSize) < minText && visible()) { const fs = Math.round(parseFloat(s.fontSize) * 10) / 10; addGrouped(smallText, `${sel(e)}|${fs}`, { selector: sel(e), text: own.slice(0, 40), fontSize: fs }); }
    // (e) Clipped text: a box that hides its overflow while its content is bigger than it is.
    if (clip && (own || e.children.length) && visible()) {
      const lineClamp = (s as CSSStyleDeclaration & { webkitLineClamp?: string }).webkitLineClamp !== undefined && s.webkitLineClamp !== 'none';
      if (/(hidden|clip)/.test(s.overflowX) && e.scrollWidth > e.clientWidth + 1 && (e.textContent || '').trim()) {
        addGrouped(clippedText, `${sel(e)}|x`, { selector: sel(e), text: label(e), axis: 'x', scroll: e.scrollWidth, client: e.clientWidth, ellipsis: s.textOverflow === 'ellipsis', lineClamp });
      } else if (/(hidden|clip)/.test(s.overflowY) && e.scrollHeight > e.clientHeight + 1 && (e.textContent || '').trim() && e.clientHeight > 0) {
        addGrouped(clippedText, `${sel(e)}|y`, { selector: sel(e), text: label(e), axis: 'y', scroll: e.scrollHeight, client: e.clientHeight, ellipsis: false, lineClamp });
      }
    }
  }

  // (f) Text fields under 16px (checkboxes, radios, range, file and hidden inputs are not typed into).
  const smallInputs: AuditResult['smallInputs'] = [];
  for (const f of Array.from(document.querySelectorAll<HTMLElement>('input, textarea, select'))) {
    const t = (f as HTMLInputElement).type;
    if (['hidden', 'file', 'checkbox', 'radio', 'range', 'button', 'submit', 'color'].includes(t) || !shown(f) || hiddenByAncestor(f) || clippedAway(f) || !inScope(f)) continue;
    const px = parseFloat(cs(f).fontSize);
    if (px < minInput) smallInputs.push({ selector: sel(f), text: f.getAttribute('aria-label') || f.getAttribute('placeholder') || f.id || '', fontSize: Math.round(px * 10) / 10 });
  }

  return {
    overflow: { scrollWidth: sw, innerWidth: window.innerWidth, over: sw > W, cutOff: sw <= W && overflowOffenders.length > 0, offenders: overflowOffenders.slice(0, 30) },
    coveredInputs,
    tapTargets: { checked, exempt, offenders: [...tapOffenders.values()] },
    smallInputs,
    smallText: [...smallText.values()],
    clippedText: [...clippedText.values()]
  };
}
