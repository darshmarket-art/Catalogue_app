import { useEffect, useRef } from 'react';

/**
 * Lets the phone's Back button (and the iOS back swipe) close what is on top: a design, a sheet, a photo, a picker.
 * Opening one adds a history entry; Back removes it and closes the layer instead of leaving the app. Layers stack, so Back closes them one at a time.
 */
const stack: Array<{ close: () => void }> = [];
let wired = false;
/** True while the app itself is removing a closed layer's history entry; that step must not change the screen. */
let tidying = false;
export const isTidying = () => tidying;
let tidyTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Removes history entries left by layers the app closed itself (a button, a tap outside, an add that closes two sheets at once).
 * One step at a time: a second request while one is pending or travelling would otherwise go back too far and leave the app.
 */
const scheduleTidy = () => {
  if (tidyTimer || tidying) return;
  tidyTimer = setTimeout(() => {
    tidyTimer = null;
    const extra = (window.history.state?.ld ?? 0) - stack.length;
    if (extra > 0) {
      tidying = true;
      window.history.go(-extra);
    }
  }, 0);
};

const wire = () => {
  if (wired) return;
  wired = true;
  window.addEventListener('popstate', (e) => {
    const depth = e.state && typeof e.state.ld === 'number' ? e.state.ld : 0;
    while (stack.length > depth) stack.pop()!.close();
    const wasTidying = tidying;
    tidying = false;
    // A layer closed while the last tidy was travelling: tidy again now that history has settled.
    if (wasTidying && (window.history.state?.ld ?? 0) > stack.length) scheduleTidy();
  });
};

export function useBackLayer(open: boolean, close: () => void) {
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    if (!open) return;
    wire();
    const layer = { close: () => closeRef.current() };
    stack.push(layer);
    try {
      // An entry left by a layer that has just closed (and not yet tidied away) is reused, so a layer that re-opens at once stays in step.
      if ((window.history.state?.ld ?? 0) < stack.length) window.history.pushState({ ...(window.history.state ?? {}), ld: stack.length }, '');
    } catch {
      // history blocked: Back simply works as before
    }
    // The app's own Back (the Android button in the native app, or Escape handling) asks the top layer first.
    const onApp = (e: Event) => {
      if (stack[stack.length - 1] !== layer) return;
      e.preventDefault();
      closeRef.current();
    };
    window.addEventListener('app-back', onApp);
    return () => {
      window.removeEventListener('app-back', onApp);
      const at = stack.indexOf(layer);
      if (at < 0) return; // already closed by Back: its history entry is gone
      // Closed by the app (a button, a tap outside): drop the history entry it added.
      stack.splice(at, 1);
      scheduleTidy();
    };
  }, [open]);
}
