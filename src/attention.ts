import { flushActivity, trackDwell } from './api';

// Which products are on screen right now. Each second on screen (while the tab is visible) counts as attention,
// so the owner can see what a buyer actually looked at, not just what scrolled past.
const onScreen = new Set<string>();
let started = false;

function start() {
  if (started) return;
  started = true;
  setInterval(() => {
    if (document.hidden) return;
    for (const sku of onScreen) trackDwell(sku, 1000);
  }, 1000);
  setInterval(flushActivity, 15000);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) flushActivity();
  });
  window.addEventListener('pagehide', flushActivity);
}

export function setOnScreen(sku: string, visible: boolean) {
  start();
  if (visible) onScreen.add(sku);
  else onScreen.delete(sku);
}

export function clearOnScreen() {
  onScreen.clear();
}
