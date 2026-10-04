# Bug and change list

Status: OPEN, PLANNED, DONE. Each item is verified against the code (2026-10-04). Work them in order; tick when merged.

## B1. Bhakti plan: founder -> pro (PLANNED)
- **Verified:** `server/tenancy.ts:29` and `server/multistoreMigration.ts:49` hard-code bhakti as `plan: 'founder'`. `entitlements.ts:15` treats founder as Pro, so features are the same today; only the label and the Console lock differ (`console.ts:133` refuses plan changes for founder).
- **Plan:** (1) one-time Firestore write `stores/bhakti.plan = 'pro'` (owner runs it; the classifier blocks prod writes by agents). (2) Change the two code defaults to `'pro'`. (3) Keep `founder` in the enum so old records still load. (4) Console: with Pro, bhakti gets plan buttons; decide if that is wanted (it can then be downgraded by mistake).
- **Decide:** keep a "permanent, never expires" guarantee? Pro has no trial end, so yes unless a Console action downgrades it.

## B2. Admin logins only, no staff (PLANNED)
- **Verified:** roles `owner|staff` in `shared/roles.ts`; staff creation in `AdminLoginScreen.tsx` (role picker, "Staff accounts" Pro note also in `EntryScreen.tsx`, `PlansCompare.tsx`, `shared/trial.ts`, `ProfileMenu.tsx`), gate `ent.requireFlag('staffRoles', ...)` in `server/app.ts:194`. Console lists "Staff accounts".
- **Missing for admins:** no "forgot password" or reset for an admin (only owner resets BUYER passwords, `adminBuyers.ts`). Only change-password exists.
- **Plan:** (1) every admin = full admin: drop the role picker, create admins with role `owner` (keep `staff` readable in old records, treated as admin). (2) Remove the `staffRoles` flag and all "Staff" copy; rename to "Admin accounts". (3) Admin management screen: list admins, add admin, remove admin (not the last), reset another admin's password (owner sets a temporary password, forced change at next login, same pattern as buyers). (4) Self-service forgot password for the admin: email link or WhatsApp code (needs mail or WhatsApp working; until then, another admin resets it). (5) Tests for each. (6) Basic plan: decide how many admin accounts it allows (suggest 1 on Basic, more on Pro).

## B3. WhatsApp login once, remembered for a period (PLANNED)
- **Verified cause:** web token is kept in `sessionStorage` (`src/api.ts:74-95`, gone when the tab closes) and buyer tokens last 24h (`server/auth.ts:8`); admin 8h. Native app already gets 90 days (`NATIVE_TOKEN_TTL`). So on the web every new visit asks for a new code.
- **Approach (recommended):** keep the OTP step, but after a good code issue a long session: buyer token **30 days**, stored in `localStorage` (web) so it survives closing the browser; sliding renewal on each use via the existing `/auth/me` (it already renews for native; extend to web). Revoke: owner "Remove buyer" and a buyer "Sign out" clear it; the server rejects tokens for removed buyers. Admin: keep 8h but add "Keep me signed in" (30 days) at admin login.
- **Check before building:** token expiry vs `JWT_SECRET` rotation (do not rotate), `analytics` visits count per session (2-day TTL at `analytics.ts:16`), shared devices (a buyer on a shared phone stays signed in: add Sign out in the profile menu, already present).
- **Decide:** 30 days (suggested) or 90 days like the app?

## B4. One opening page for every store (PLANNED)
- **Verified cause:** `server/routes/signup.ts:48` creates new stores with `catalogueAccess: 'public'`; bhakti is `'login'`. `layouts/emergent/Welcome.tsx:9` renders "Enter the portal" for login stores, and "Browse the catalogue" + "Sign in with WhatsApp" for public ones.
- **Plan:** Welcome shows the bhakti version for every store: one primary card "Enter the portal" that goes to the WhatsApp sign-in. Remove the public-browse branch from Welcome. Decide what `catalogueAccess: 'public'` then means: (a) keep the setting, but only affect whether the catalogue API needs login (`server/app.ts:149`, `App.tsx:182`), or (b) remove it and make every store login-only (simplest, matches "make all template same"). Recommend (b): new signups also get `'login'`; existing public stores (none besides test stores) get migrated.
- **Risk:** a store owner shares a link expecting buyers to browse; with (b) every buyer must verify a number (Basic limit: 50 buyers). Confirm with the user.

## Order of work
B4 (small) -> B3 (security-sensitive, test well) -> B2 (largest) -> B1 (data change last). Each: code, tests, QA in browser, commit on saas/layouts, user reviews, then push.

## Status (2026-10-04, later)
- B2 DONE in code: one admin per store, all plans (register returns 409 for a second); staff UI/copy removed; admin forgot password by WhatsApp code to the store's registered number (`/api/auth/admin/forgot/request-otp` and `/reset`, uses OTP_STATIC_CODE until Meta is set up; `src/components/AdminForgotPassword.tsx`).
- B3 DONE: buyer token 7 days, kept in localStorage.
- B4 DONE: Welcome = "Enter the portal" for every store; new signups login-only.
- B1 PLANNED: data change only. Run `scripts/bhakti-to-pro.ps1` (sets stores/bhakti.plan = pro). Code defaults left as is, `founder` still supported for old records.
- Not merged or pushed; 235 tests pass.

## B5. Back button trail (PLANNED)
- **Verified cause:** `App.tsx:84-97` pushes a history entry for every screen change and `popstate` just replays it, so Back walks the whole trail. After signup, `SignupScreen` opens the store with `window.location.href` (a normal navigation, so the signup/entry pages stay behind the store in history). The app also never handles "leave" on the web (only the native Android handler, `App.tsx:101`).
- **Plan:**
  1. Signup to store: use `location.replace(storeUrl)` (not `href`) on the "Open my store" link, and on `/signup` done screen, so the app/signup pages drop out of history. Same for `EntryScreen` go-to-store.
  2. Store history = a shallow stack of three levels, not a trail. Home tabs (Home, Catalogue, Shortlist, Orders) are *roots*: switching tabs uses `replaceState`, never `pushState`. Only drill-in screens push one entry: product detail, admin sub-screens, About, Plans, PDF, New design (its "trail" collapses to Home: Back from any drill-in returns to its parent tab, then Back again = Home).
  3. Back rules (one function used by `popstate` and the Android button): drill-in -> its parent tab; Catalogue/Shortlist/Orders -> Home; Home -> toast "Press back again to exit", and a second Back within 2 seconds leaves (web: `history.back()` past a sentinel entry so the tab closes or goes to the previous site; native: `App.exitApp()`). A sentinel entry is pushed under Home on load so the browser stays on the page for the first press.
  4. Browsers cannot always close a tab with script. After the second press we step back past the sentinel; if the tab has no earlier history it leaves to the browser's start page. State clearly: "close the browser" is only exact in the installed PWA / native app.
  5. Tests: a small pure `backTarget(screen, isHome)` function in `src/nav.ts` with a unit test table; browser QA of the signup -> store -> Back path.
- **Decide:** after the second Back on the web, is "leave the site" acceptable instead of closing the tab? (Browsers do not allow closing a tab the script did not open.)

## B6. Photo shape rules: catalogue, banner, collection (PLANNED)
- **Verified:** nothing guides or checks photo shape. `PhotoPicker.tsx` accepts any JPEG/PNG/WebP (server limit 25 MB, `server/routes/photos.ts`) with no size, ratio or crop check. Display crops with `object-fit: cover`, so the result depends on the owner's photo and the phone width: banner slide is `width: 100%; height: 210px` (`emergent.css:165`, ratio changes with screen width), collection and catalogue grid cards are both `aspect-ratio: 1` (`.em-sq`), small thumbs are a fixed 88x88, product gallery is a fixed 360px tall (`.em-gal`). A wrong-shaped banner is cut at the sides or top, and different phones crop it differently.
- **Rules (one source of truth, `shared/photoSpecs.ts`):**
  | Photo | Ratio | Upload size | Min |
  |---|---|---|---|
  | Banner | 2:1 | 1600 x 800 | 1200 x 600 |
  | Collection | 1:1 | 1200 x 1200 | 800 x 800 |
  | Catalogue design | 4:5 portrait | 1200 x 1500 | 800 x 1000 |
- **Plan:**
  1. Display: make the slide `aspect-ratio: 2 / 1` (not a fixed height), the gallery `aspect-ratio: 4 / 5`, collection stays 1:1, catalogue thumbs 4:5, so what the owner sees in the picker is exactly what buyers see on every phone.
  2. Picker: show the rule above each picker ("Banner: 2:1, 1600 x 800 px. Keep the subject in the centre"), and render the preview tile at the same ratio.
  3. Strict check on pick (client, before upload): read the image size; below the minimum = refused with the reason; ratio off by more than 5% = a crop step (fixed-ratio crop box, drag to position, output canvas JPEG at the upload size) so the saved file always has the right shape. No free-form upload for banners and collections.
  4. Catalogue designs: same crop step but "Skip, I know it fits" allowed (strict = banner and collection only, as asked); the suggestion text shows for designs.
  5. Server backstop (optional, later): reject banner/collection files whose decoded ratio is off, needs an image library; skip unless clients bypass the app.
  6. Tests: unit tests for `fitCheck(width, height, spec)` (pass, too small, off-ratio) and the crop math; browser QA with a portrait, a landscape and a tiny image.
- **Decide:** catalogue designs 4:5 or square? (4:5 shows more of a necklace or set; square matches collections.)

## B7. PDF catalogue layout like the atlas, and PDFs must download (PLANNED)
- **Verified, layout:** the atlas PDF (`emergent/frontend/app/admin/pdf-catalogue.tsx`, `buildCatalogueHtml`) is a document with: a deep cover block (eyebrow "Wholesale Catalogue · date", store name in serif, tagline, gold rule, three contact blocks WhatsApp / Showroom / Online), a line "N selected designs", a 2-column grid of cards (square photo, name, "SKU · collection", purity + net weight on one row), and a footer (weights note, WhatsApp number, "Powered by" Antarixs mark). Our real PDF (`src/cataloguePdf.ts`, jsPDF) has no cover, a 3-column grid, a brand watermark and a page footer; only the on-screen preview (`PdfCatalogueScreen`, `.em-cover`) shows a cover that the file does not have. Photos are already cropped square (`squareJpeg`).
- **Verified, download:** `doc.save()` (jsPDF) ends in a blob link; on phones and in the installed app the browser opens a `application/pdf` blob in its viewer tab instead of saving it. `mode: 'share'` exists but only the Pro owner screen can choose it; the buyer Catalogue and Home "collection PDF" use `save`.
- **Plan (layout):** rewrite `downloadDesignsPdf` to the atlas: page 1 = cover (deep primary block, gold rule, store details from `merchant`, date, design count) with the first row of cards under it; following pages = 2-column cards, same card text as the atlas plus the store's `productFields` line (kept from today); footer on every page = weights note, WhatsApp number, page n of N, and "Powered by Antarixs" with the logo drawn to PNG from the shared mark paths (`AntarixsBrand.tsx` `MARK_PATHS`, same canvas trick as `storeQrCard.ts`). Keep the faint brand watermark? (atlas has none; recommend drop it for a cleaner page, confirm.)
- **Plan (download):** one `saveFile(blob, name)` helper: (1) phones with file sharing -> share sheet (Save to Files / WhatsApp), (2) otherwise an `<a download>` on a blob typed `application/octet-stream` so browsers save it instead of previewing, (3) last resort open in a tab with a "long-press to save" note. Used by every PDF button (owner screen, buyer Catalogue, Home collections). The QR image share (`storeQrCard.ts`) uses the same helper.
- **Tests:** unit test of the layout math (rows per page, cover page capacity) and `saveFile` branch choice with stubs; browser check on desktop Chrome (file lands in Downloads) and a phone-width emulation.
- **Decide:** keep the diagonal watermark (current) or drop it (atlas)?

## B8. No passwords for buyers (DONE in code, 2026-10-04)
Removed: buyer password sign-up and sign-in endpoints too (`retailer/signup`, `retailer/login`; buyers are code-only, tests use `tests/buyerAuth.ts`). Earlier: buyer "Change password" (menu, screen, forced-change flow), owner "Reset buyer password" (button, `reset-password` and `retailer/change-password` endpoints, tests). Kept: admin password reset by WhatsApp code (B2). Open: the old password endpoints `retailer/signup` and `retailer/login` still exist on the server (no screen uses them); remove later with their tests if you want buyers strictly OTP-only. Admin menu has no "Change password" item (decide).

## B9. Screen animations like the Emergent app (PLANNED)
- **Found in `emergent/frontend` (react-native-reanimated + expo-router):**
  1. Between screens: Stack `animation: "fade"` (plain cross-fade); bottom tabs have no slide.
  2. Product detail (`app/product/[id].tsx`): "grow from card" shared-element: the tapped card's photo (measured with `measureInWindow`, `catalogue.tsx:37`) flies to the full-width hero (open 440 ms ease-out cubic, close 340 ms ease-in cubic); the backdrop fades in, the details panel fades in after 45% and rises 28 px; Back reverses it.
  3. Onboarding steps: `FadeInRight` 320 ms in, `FadeOutLeft` 200 ms out; the OTP block `FadeInRight` 280 ms.
  4. Cart (`app/cart.tsx`): lines `FadeIn` 220 ms and list `Layout` 220 ms (rows slide up when one is removed); order-placed panel `FadeInDown` 400 ms.
  5. Live ticker (`live-ticker.tsx`): rows `FadeInUp` 420 / `FadeOutUp` 260, plus a pulsing green ring (1100 ms). Image pinch-zoom (`zoomable-image.tsx`) is gesture-driven.
- **Ours today (`App.tsx:522`, `index.css:109-150`):** every screen change, including tab switches, slides 28 px sideways (forward/back, 0.32 s); toasts fade 0.25 s; reduced-motion is respected. No product grow-from-card, no onboarding step transition, no cart row animation, no live pulse.
- **Plan (CSS only, no new library):**
  1. Tab switches (Home/Catalogue/Shortlist/Orders) = 0.22 s fade (`page-in`), like Emergent; slide only for drill-in and Back.
  2. Product detail grow-from-card: use the browser View Transitions API (`document.startViewTransition`, `view-transition-name` on the card photo and the gallery hero), 440 ms open and 340 ms close with the Emergent easings; falls back to the fade where unsupported (Safari < 18, older Android WebView).
  3. Onboarding/OTP steps: slide in from the right 0.32 s, out to the left 0.2 s (keyframes `step-in`, `step-out`).
  4. Orders/Shortlist rows: fade in 0.22 s; removal collapses height (CSS grid-rows trick).
  5. Live visitors pulse ring and ticker fade for the engagement screen.
  6. All inside `prefers-reduced-motion`; QA at phone width on real devices (animation cost on low-end Android).
- **Decide:** include the grow-from-card transition (the signature one, biggest effort, needs the View Transitions API) or only fades and slides?
