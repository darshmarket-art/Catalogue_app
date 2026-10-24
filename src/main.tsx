import {StrictMode} from 'react';
import {Capacitor, SystemBars, SystemBarsStyle} from '@capacitor/core';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import {PlanProvider} from './plan';
import {EntryScreen} from './components/EntryScreen';
import {SignupScreen} from './components/SignupScreen';
import {installBugCapture} from './bugReport';

// The service worker only runs in the real app (it would get in the way of the dev server's live reload).
if ('serviceWorker' in navigator && import.meta.env.PROD && !Capacitor.isNativePlatform()) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}

// A page opened before a deploy asks for code files (the PDF maker) that the new release no longer has: reload once to get the new ones.
// The guard stops a reload loop if the file is missing for another reason.
window.addEventListener('vite:preloadError', () => {
  if (Date.now() - Number(sessionStorage.getItem('chunk-reload') ?? 0) < 60_000) return;
  sessionStorage.setItem('chunk-reload', String(Date.now()));
  window.location.reload();
});

// Everything that goes wrong (errors, rejected promises, console.error, failed files, blocked requests, failed or slow calls,
// a page that died) goes to console.<domain> (Bug reports) with the steps that led to it, not to the customer.
installBugCapture();

if (Capacitor.isNativePlatform()) {
  document.documentElement.classList.add('native');
  // The app is light, so use dark clock/battery/notification icons and dark navigation buttons.
  void SystemBars.setStyle({style: SystemBarsStyle.Light}).catch(() => {});
}

// Scroll edge: the top bars show a soft shadow only once the page has scrolled under them (CSS reads html[data-scrolled]).
// Passive and at most once a frame, so it never slows scrolling.
let scrollFrame = 0;
const markScrolled = () => {
  scrollFrame = 0;
  document.documentElement.toggleAttribute('data-scrolled', window.scrollY > 4);
};
window.addEventListener('scroll', () => { if (!scrollFrame) scrollFrame = requestAnimationFrame(markScrolled); }, {passive: true});
markScrolled();

// The soft keyboard and covered fields. While a text field has focus on a touch screen under 1024 px, html[data-typing] is set and CSS moves the floating
// bars out of the way (the keyboard takes the room). Chrome scrolls only the caret of a focused text field into view and ignores scroll-margin on it; a select it
// scrolls into the whole page, ignoring scroll-padding. So on focus the padding is set to what sits over the page's top and bottom edges right then (measured,
// not guessed: the header, the tab bar, the docks, the cart bar, the save bar) and the field is scrolled in by hand, which honours it. Cleared at the blur.
const TEXT_FIELD = 'textarea, input:not([type=checkbox], [type=radio], [type=range], [type=button], [type=submit], [type=file])';
const touchPhone = window.matchMedia('(max-width: 1023.98px) and (pointer: coarse)');
let release = 0;
const floating = (bar: Element) => ['fixed', 'sticky'].includes(getComputedStyle(bar).position);
document.addEventListener('focusin', (e) => {
  const field = e.target instanceof Element && e.target.matches(`${TEXT_FIELD}, select`) ? e.target : null;
  if (!field) return; // a button taking focus leaves the pending release alone
  window.clearTimeout(release);
  const root = document.documentElement;
  const typing = touchPhone.matches && field.matches(TEXT_FIELD);
  root.toggleAttribute('data-typing', typing);
  let top = 0;
  for (const bar of document.querySelectorAll('.em-top, .topbar')) if (floating(bar)) top = Math.max(top, bar.getBoundingClientRect().bottom);
  let bottom = 0;
  // While typing the bottom bars are gone or resting in the flow, so nothing covers the bottom.
  if (!typing) for (const bar of document.querySelectorAll('.em-tabs, .em-dock, .em-cartbar, .em-savebar')) {
    const r = bar.getBoundingClientRect();
    if (floating(bar) && r.height && r.top < window.innerHeight) bottom = Math.max(bottom, window.innerHeight - r.top);
  }
  root.style.setProperty('--scroll-pad-t', top ? `${top + 8}px` : '0px');
  root.style.setProperty('--scroll-pad-b', bottom ? `${bottom + 12}px` : '0px');
  field.scrollIntoView({ block: 'nearest' }); // the whole field, not just the caret (and a select, which the browser scrolls without the padding)
});
// The bars come back 200 ms after the blur, not at it: a tap on a button blurs the field on the way down and clicks a few ms later, and a bar that has
// moved by then makes the click miss (the save bar going from resting to sticking, for one). Moving to another field cancels it, so nothing flickers.
document.addEventListener('focusout', () => {
  release = window.setTimeout(() => {
    const root = document.documentElement;
    root.removeAttribute('data-typing');
    root.style.removeProperty('--scroll-pad-t');
    root.style.removeProperty('--scroll-pad-b');
  }, 200);
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {window.location.pathname === '/welcome-antarixs' ? <EntryScreen /> : window.location.pathname === '/signup' ? <SignupScreen /> : <PlanProvider><App /></PlanProvider>}
  </StrictMode>,
);
