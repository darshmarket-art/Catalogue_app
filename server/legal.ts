import { Router } from 'express';
import type { Request } from 'express';
import type { MerchantConfig } from './merchant';
import type { Config } from './config';
import { antarixsIconSvg } from '../shared/antarixsMark';

/**
 * The pages a site needs before it is public, written per store from its own merchant record: Privacy, Terms, a proper "page not found",
 * robots.txt, sitemap.xml and the favicon address browsers ask for. They are plain server pages (no app script), so they open fast,
 * can be indexed and can be linked from the store's Play Store / App Store listing.
 *
 * The Privacy and Terms wording is a starting draft written for a B2B jewellery catalogue. The store owner's own adviser should read it once.
 */

export const LEGAL_UPDATED = '6 October 2026';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

/** The paths the app itself answers. Any other address is a real 404. */
export const APP_PATHS = new Set(['/', '/welcome-antarixs', '/signup']);
export const isAppPath = (p: string) => APP_PATHS.has(p.length > 1 ? p.replace(/\/+$/, '') : p);

/** https in production (behind the proxy), the request's own scheme elsewhere. */
function origin(req: Request) {
  const host = req.get('host') ?? 'localhost';
  return `${req.protocol}://${host}`;
}

const STYLE = `
:root{--bg:#f7f1e8;--card:#fffcf7;--ink:#1f1418;--mut:#5f4f56;--line:#e4d9d4;--plum:#4a1835;--gold:#c19a55}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.7 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Noto Sans Devanagari",sans-serif}
a{color:var(--plum)}
header{border-bottom:1px solid var(--line);background:var(--card)}
.in{max-width:760px;margin:0 auto;padding:0 20px}
header .in{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:64px}
.brand{font:500 20px/1.2 Georgia,"Times New Roman",serif;color:var(--plum);text-decoration:none}
main{padding:36px 0 56px}
h1{font:500 34px/1.15 Georgia,"Times New Roman",serif;margin:0 0 6px}
h2{font:500 20px/1.3 Georgia,"Times New Roman",serif;margin:30px 0 6px}
.upd{color:var(--mut);font-size:14px;margin:0 0 20px}
.rule{width:44px;height:1px;background:var(--gold);border:0;margin:14px 0 22px}
ul{padding-left:22px}
li{margin:4px 0}
footer{border-top:1px solid var(--line);color:var(--mut);font-size:14px;padding:22px 0}
nav a{margin-left:16px;font-size:14px}
.btn{display:inline-block;background:var(--plum);color:#fbf3e6;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:600}
.btn:hover{filter:brightness(1.1)}
`;

/** What the page frame needs to know about whose site it is. */
interface Site {
  name: string;
  address?: string;
}
const siteOf = (m: MerchantConfig): Site => ({ name: m.brand.name, address: m.contact.address });

function shell(site: Site, title: string, body: string, robots = 'index,follow') {
  const name = esc(site.name);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="${robots}">
<meta name="theme-color" content="#f7f1e8">
<title>${esc(title)} · ${name}</title>
<link rel="icon" type="image/png" href="/pwa/icon-192.png">
<style>${STYLE}</style>
</head>
<body>
<header><div class="in"><a class="brand" href="/">${name}</a><nav aria-label="Legal"><a href="/privacy">Privacy</a><a href="/terms">Terms</a></nav></div></header>
<main><div class="in">${body}</div></main>
<footer><div class="in">${name}${site.address ? ` · ${esc(site.address)}` : ''} · <a href="/privacy">Privacy policy</a> · <a href="/terms">Terms &amp; conditions</a></div></footer>
</body>
</html>`;
}

/** How a person can reach the store about their data or an order. */
function contactLine(m: MerchantConfig) {
  const parts = [`WhatsApp +${esc(m.contact.whatsapp.replace(/[^0-9]/g, ''))}`];
  if (m.contact.deskPhone) parts.push(`phone ${esc(m.contact.deskPhone)}`);
  if (m.contact.address) parts.push(esc(m.contact.address));
  return parts.join(', ');
}

export function privacyPage(m: MerchantConfig) {
  const name = esc(m.brand.name);
  return shell(
    siteOf(m),
    'Privacy policy',
    `<h1>Privacy policy</h1>
<p class="upd">Last updated ${LEGAL_UPDATED}</p>
<hr class="rule">
<p>This policy explains what ${name} (“we”, “us”) collects when you use this catalogue and ordering portal, why, and what you can ask us to do about it. The portal is for registered business buyers: bullion dealers and jewellery retailers.</p>

<h2>What we collect</h2>
<ul>
<li><b>Your sign-in details:</b> your WhatsApp mobile number, your name and, if you give them, your business name, GSTIN and market area.</li>
<li><b>Your activity in the portal:</b> the designs you view, search, shortlist and add to your order, the orders you place with their notes, and when you tap WhatsApp to ask about a design. We use this to run your orders and to show the store which designs buyers care about.</li>
<li><b>Technical details:</b> your IP address and the app version, used to keep the service secure (for example to limit repeated sign-in attempts) and to fix faults.</li>
</ul>

<h2>How we use it</h2>
<ul>
<li>To sign you in with a 6-digit code sent on WhatsApp, and to keep you signed in on your device.</li>
<li>To take, confirm, dispatch and list your orders, and to message you about them on WhatsApp.</li>
<li>To show the store which designs are being viewed and ordered, so it can stock what buyers want.</li>
<li>To protect the service from misuse.</li>
</ul>
<p>We do not sell your data. We do not show advertising and there are no advertising trackers on this site.</p>

<h2>Cookies and device storage</h2>
<p>This site does not set cookies. To keep you signed in and to remember your language and catalogue view, it stores small items in your browser’s local storage on your own device. Signing out removes your sign-in.</p>

<h2>Who else handles your data</h2>
<ul>
<li><b>WhatsApp (Meta):</b> to deliver your sign-in code and order messages.</li>
<li><b>Google Cloud:</b> our hosting, database and photo storage, in India.</li>
<li><b>Google Fonts:</b> the site loads its typefaces from Google, which receives your IP address when it does.</li>
<li><b>Antarixs:</b> the platform this portal runs on, which processes data on our behalf.</li>
</ul>
<p>We share data with others only when the law requires it.</p>

<h2>How long we keep it</h2>
<p>We keep your account and order history while you are a buyer and for as long as business, tax and accounting records must be kept. Sign-in codes expire within minutes and are stored only as a one-way hash.</p>

<h2>Your choices</h2>
<p>You can ask us to show you what we hold about you, correct it, or delete your account, and you can withdraw consent to messages. Orders already booked may need to be kept for our records. To ask, contact us at: ${contactLine(m)}.</p>

<h2>Security</h2>
<p>All traffic uses HTTPS. Access is by one-time code, repeated attempts are limited, and the store’s staff use your details only to serve your orders. No system is perfectly secure, so please keep your phone and WhatsApp safe.</p>

<h2>Children</h2>
<p>The portal is for businesses and is not meant for anyone under 18.</p>

<h2>Changes</h2>
<p>If we change this policy we will update the date above. If a change is significant we will tell you in the portal or on WhatsApp.</p>

<h2>Contact</h2>
<p>${name}, ${contactLine(m)}.</p>`
  );
}

export function termsPage(m: MerchantConfig) {
  const name = esc(m.brand.name);
  return shell(
    siteOf(m),
    'Terms & conditions',
    `<h1>Terms &amp; conditions</h1>
<p class="upd">Last updated ${LEGAL_UPDATED}</p>
<hr class="rule">
<p>These terms apply when you use the ${name} catalogue and ordering portal. By signing in you agree to them. If you do not agree, please do not use the portal.</p>

<h2>Who can use the portal</h2>
<p>The portal is for business buyers (certified bullion dealers and fine jewellery retailers). You must give true details, keep your phone and WhatsApp account secure, and are responsible for orders placed from your account.</p>

<h2>Designs, weights and purity</h2>
<p>We take care that photos, weights, purity and availability are accurate, but photos are for reference and small differences can occur. Weights are shown in grams (net weight is the weight of gold or metal; gross weight includes stones or tare). Purity follows BIS hallmarking where stated. Availability can change before an order is confirmed.</p>

<h2>Orders</h2>
<ul>
<li>An order you place in the portal is a request. It is accepted only when we confirm it, usually on WhatsApp.</li>
<li>Settlement terms (for example fine-gold net weight) are as agreed with us at the time of confirmation.</li>
<li>You can cancel an order that is still marked “New” from the portal. After it is confirmed, please contact us to change or cancel it.</li>
<li>Delivery is insured and handed over with a one-time code. Delivery dates are estimates.</li>
</ul>

<h2>Acceptable use</h2>
<p>Do not misuse the portal: no attempts to break in, to overload it, to copy the catalogue automatically, or to place orders you do not intend to honour. We may suspend an account that does.</p>

<h2>Our content</h2>
<p>The photos, designs, text and brand on this portal belong to ${name} or its suppliers. You may use them to deal with us, but not to copy or resell them without our permission.</p>

<h2>Liability</h2>
<p>The portal is provided “as is”. To the extent the law allows, we are not liable for indirect losses, for interruptions outside our control, or for anything beyond the value of the order concerned.</p>

<h2>Privacy</h2>
<p>How we handle your data is described in our <a href="/privacy">privacy policy</a>.</p>

<h2>Changes and governing law</h2>
<p>We may update these terms; the date above shows the latest version. These terms are governed by the laws of India, and the courts at the place of our business have jurisdiction.</p>

<h2>Contact</h2>
<p>${name}, ${contactLine(m)}.</p>`
  );
}

/** A real 404: the store's name, a way home, and "do not index" for search engines. */
export function notFoundPage(m: MerchantConfig) {
  return shell(
    siteOf(m),
    'Page not found',
    `<h1>Page not found</h1>
<hr class="rule">
<p>The page you were looking for is not here. It may have moved, or the address may have a typo.</p>
<p><a class="btn" href="/">Go to ${esc(m.brand.name)}</a></p>`,
    'noindex'
  );
}

/** robots.txt, sitemap.xml, favicon.ico, /privacy and /terms for one store. */
export function legalRoutes(m: MerchantConfig) {
  const router = Router();

  router.get('/privacy', (_req, res) => {
    res.set('Cache-Control', 'public, max-age=3600').type('html').send(privacyPage(m));
  });
  router.get('/terms', (_req, res) => {
    res.set('Cache-Control', 'public, max-age=3600').type('html').send(termsPage(m));
  });

  // Browsers ask for /favicon.ico whatever the page says: point them at the store's icon.
  router.get('/favicon.ico', (_req, res) => res.redirect(302, '/pwa/icon-192.png'));

  router.get('/robots.txt', (req, res) => {
    // A members-only catalogue has nothing for search engines past the front page and the two legal pages.
    const closed = m.catalogueAccess === 'login';
    const lines = [
      'User-agent: *',
      ...(closed ? ['Allow: /$', 'Allow: /privacy', 'Allow: /terms', 'Disallow: /'] : ['Disallow: /api/', 'Disallow: /media/', 'Disallow: /signup', 'Disallow: /welcome-antarixs']),
      `Sitemap: ${origin(req)}/sitemap.xml`
    ];
    res.set('Cache-Control', 'public, max-age=3600').type('text/plain').send(lines.join('\n') + '\n');
  });

  router.get('/sitemap.xml', (req, res) => {
    const base = origin(req);
    const urls = ['/', '/privacy', '/terms'];
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${esc(base + u)}</loc></url>`).join('\n')}\n</urlset>\n`;
    res.set('Cache-Control', 'public, max-age=3600').type('application/xml').send(xml);
  });

  return router;
}


// ---------------------------------------------------------------------------------------------------------------------
// Antarixs itself (app.<domain>): the entry page and store signup. Same frame, wording for store owners.
// Who the operator is comes from PLATFORM_LEGAL_NAME / PLATFORM_CONTACT_EMAIL / PLATFORM_ADDRESS (shown in square brackets until set).
// ---------------------------------------------------------------------------------------------------------------------

const platformSite = (c: Config): Site => ({ name: 'Antarixs', address: c.platform.address.startsWith('[') ? undefined : c.platform.address });

function platformContact(c: Config) {
  const { email, address } = c.platform;
  return `${esc(email)}${address ? `, ${esc(address)}` : ''}`;
}

export function platformPrivacyPage(c: Config) {
  const who = esc(c.platform.legalName);
  return shell(
    platformSite(c),
    'Privacy policy',
    `<h1>Privacy policy</h1>
<p class="upd">Last updated ${LEGAL_UPDATED}</p>
<hr class="rule">
<p>Antarixs is operated by ${who} (“we”, “us”). Antarixs lets a jewellery business create its own catalogue store. This policy covers the Antarixs website, store sign-up and the owner’s console. How a store handles its own buyers’ data is set out in that store’s own privacy policy.</p>

<h2>What we collect when you create a store</h2>
<ul>
<li>Your name, WhatsApp mobile number and email address, and a password (stored only in a one-way hashed form).</li>
<li>Your brand name, store address (name.antarixs.com), brand colour, logo, and the catalogue content you add: designs, photos, weights, prices and banners.</li>
<li>Your plan, trial and billing status, and the orders, buyers and enquiries your store receives.</li>
<li>Technical details such as your IP address and browser, used to keep the service secure and to limit repeated sign-in or sign-up attempts.</li>
</ul>

<h2>Your buyers’ data</h2>
<p>For the buyers who sign in to your store, you decide why and how their data is used and we process it on your behalf, to run your store. Please tell your buyers what you do with it.</p>

<h2>How we use it</h2>
<ul>
<li>To create and run your store, sign you in with a code sent on WhatsApp, and send order and account messages.</li>
<li>To show you how your store is used (views, enquiries, orders).</li>
<li>To keep the service safe, fix faults and improve it.</li>
</ul>
<p>We do not sell your data and we show no advertising.</p>

<h2>Cookies and device storage</h2>
<p>We do not set cookies. We keep small items in your browser’s local storage to keep you signed in and to remember your choices, such as language.</p>

<h2>Who else handles your data</h2>
<ul>
<li><b>WhatsApp (Meta):</b> delivers sign-in codes and order messages.</li>
<li><b>Google Cloud:</b> hosting, database and photo storage.</li>
<li><b>Google Fonts:</b> typefaces load from Google, which receives your IP address when they do.</li>
</ul>
<p>We share data with others only when the law requires it.</p>

<h2>How long we keep it</h2>
<p>We keep your account and store while it is open. When you ask us to close it we delete your store’s data, except records we must keep for tax, accounting or legal reasons.</p>

<h2>Your choices</h2>
<p>You can ask to see, correct, export or delete the data we hold about you or your store, and to stop messages. Write to ${platformContact(c)}.</p>

<h2>Security</h2>
<p>All traffic uses HTTPS, sign-in uses one-time codes and hashed passwords, and repeated attempts are limited. No system is perfectly secure, so please keep your phone, WhatsApp and password safe.</p>

<h2>Changes</h2>
<p>If we change this policy we will update the date above and, for significant changes, tell you in the console or on WhatsApp.</p>

<h2>Contact</h2>
<p>${who}, ${platformContact(c)}.</p>`
  );
}

export function platformTermsPage(c: Config) {
  const who = esc(c.platform.legalName);
  return shell(
    platformSite(c),
    'Terms & conditions',
    `<h1>Terms &amp; conditions</h1>
<p class="upd">Last updated ${LEGAL_UPDATED}</p>
<hr class="rule">
<p>These terms apply when you create or run a store on Antarixs, operated by ${who} (“we”, “us”). By creating a store you agree to them.</p>

<h2>Your account</h2>
<p>You must give true details, be allowed to run the business you register, and keep your phone, WhatsApp and password secure. You are responsible for what happens in your store and for the staff you let in.</p>

<h2>Trial and plans</h2>
<p>A new store starts with a free trial. After it, the store continues on the plan you choose; features and limits for each plan are shown in the console. We tell you before a change to your plan takes effect.</p>

<h2>Your content</h2>
<p>You keep ownership of your photos, designs and text. You give us permission to store and show them as needed to run your store. You promise that you have the right to use them and that they do not break anyone’s rights or the law.</p>

<h2>Your buyers</h2>
<p>You are responsible for your dealings with your buyers: prices, orders, delivery, and how you use their data. Antarixs provides the tool; we are not a party to your sales.</p>

<h2>Acceptable use</h2>
<p>No illegal goods, no misleading listings, no attempts to break in or overload the service, no bulk or spam messaging. We may suspend a store that does this.</p>

<h2>Availability and changes</h2>
<p>We work to keep the service running but do not promise it will never be interrupted. We may improve or change features.</p>

<h2>Ending your store</h2>
<p>You can ask us to close your store at any time. We may close a store that breaks these terms or stays unpaid after notice. See the <a href="/privacy">privacy policy</a> for what happens to the data.</p>

<h2>Liability</h2>
<p>The service is provided “as is”. To the extent the law allows, we are not liable for indirect losses or for interruptions outside our control, and our total liability is limited to what you paid us in the 3 months before the claim.</p>

<h2>Governing law</h2>
<p>These terms are governed by the laws of India. The courts at ${who}’s place of business have jurisdiction.</p>

<h2>Contact</h2>
<p>${who}, ${platformContact(c)}.</p>`
  );
}

export function platformNotFoundPage(c: Config) {
  return shell(
    platformSite(c),
    'Page not found',
    `<h1>Page not found</h1>
<hr class="rule">
<p>The page you were looking for is not here. It may have moved, or the address may have a typo.</p>
<p><a class="btn" href="/welcome-antarixs">Go to Antarixs</a></p>`,
    'noindex'
  );
}

/** The mark browsers show in the tab: the Antarixs mark on its deep tile (shared/antarixsMark.ts). The PNG icons are square; Android and Apple apply their own mask. */
const PLATFORM_ICON_SVG = antarixsIconSvg(true);
const PLATFORM_ICON_PNG_SVG = antarixsIconSvg(false);
const iconCache = new Map<number, Promise<Buffer>>();
const iconPng = (px: number) => {
  let p = iconCache.get(px);
  if (!p) iconCache.set(px, (p = import('sharp').then((m) => m.default(Buffer.from(PLATFORM_ICON_PNG_SVG)).resize(px, px).png().toBuffer())));
  return p;
};

/** /privacy, /terms, robots.txt, sitemap.xml, the favicon and the icon files for the Antarixs site. Anything else falls through. */
export function platformRoutes(c: Config) {
  const router = Router();
  const html = (page: () => string) => (_req: Request, res: import('express').Response) => void res.set('Cache-Control', 'public, max-age=3600').type('html').send(page());
  router.get('/privacy', html(() => platformPrivacyPage(c)));
  router.get('/terms', html(() => platformTermsPage(c)));
  router.get('/favicon.svg', (_req, res) => void res.set('Cache-Control', 'public, max-age=86400').type('image/svg+xml').send(PLATFORM_ICON_SVG));
  router.get('/favicon.ico', (_req, res) => res.redirect(302, '/pwa/icon-192.png'));
  router.get('/pwa/icon-192.png', (_req, res, next) => void iconPng(192).then((b) => res.set('Cache-Control', 'public, max-age=86400').type('png').send(b)).catch(next));
  router.get('/pwa/apple-touch-icon.png', (_req, res, next) => void iconPng(180).then((b) => res.set('Cache-Control', 'public, max-age=86400').type('png').send(b)).catch(next));
  router.get('/robots.txt', (req, res) => {
    // The entry page and sign-up are the site's shop window: open to search engines, except the API and the owner's console.
    res.set('Cache-Control', 'public, max-age=3600').type('text/plain').send(['User-agent: *', 'Allow: /', 'Disallow: /api/', 'Disallow: /media/', `Sitemap: ${origin(req)}/sitemap.xml`].join('\n') + '\n');
  });
  router.get('/sitemap.xml', (req, res) => {
    const base = origin(req);
    const urls = ['/welcome-antarixs', '/signup', '/privacy', '/terms'];
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${esc(base + u)}</loc></url>`).join('\n')}\n</urlset>\n`;
    res.set('Cache-Control', 'public, max-age=3600').type('application/xml').send(xml);
  });
  return router;
}
