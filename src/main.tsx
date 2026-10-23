import {StrictMode} from 'react';
import {Capacitor, SystemBars, SystemBarsStyle} from '@capacitor/core';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import {PlanProvider} from './plan';
import {EntryScreen} from './components/EntryScreen';
import {SignupScreen} from './components/SignupScreen';
import {reportBug} from './bugReport';

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

// Anything that escapes the screens goes to console.<domain> (Bug reports), not to the customer.
window.addEventListener('error', (e) => reportBug(e.error ?? e.message, 'uncaught'));
window.addEventListener('unhandledrejection', (e) => reportBug(e.reason, 'unhandled promise'));

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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {window.location.pathname === '/welcome-antarixs' ? <EntryScreen /> : window.location.pathname === '/signup' ? <SignupScreen /> : <PlanProvider><App /></PlanProvider>}
  </StrictMode>,
);
