# Project state (hand-off for new sessions)

Read this first. It is the short version of the project and of the last few weeks of work, so a new session does not need the old chat history.

## What the project is

A multi-tenant B2B catalogue app for jewellery wholesalers, run as **Antarixs**.

- **Buyers** (dealers) sign in with a WhatsApp code, browse collections, shortlist designs, and place orders (net weight in grams). Orders reach the store on WhatsApp.
- **Store owners/admins** add collections (tagged), designs (up to 3 photos, purity, gross/stone weight, HUID), set hero collections, manage buyers, orders, insights, banners, purities, alerts and the WhatsApp message log.
- **Antarixs platform** (`app.antarixs.com`): the sign-up and marketing pages where new stores are created (`/welcome-antarixs`, `/signup`). Each store lives at `[name].antarixs.com`.
- Plans: Basic and Pro (14-day Pro trial). Limits and flags are in `shared/limits.ts`.

## Stack and where things live

- **Client:** React + TypeScript + Vite. Entry: `src/main.tsx`; the app shell is `src/App.tsx`.
  - Storefront layout: `src/layouts/emergent/` (the only live layout; `.em-*` classes in `emergent.css`).
  - Admin screens: `src/components/Admin*.tsx`, `AddCategoryScreen.tsx`, `NewProductScreen.tsx`.
  - Platform pages: `EntryScreen.tsx` (welcome), `SignupScreen.tsx`, `HowItWorks.tsx`, `Reveal.tsx`, `platform.css` (the cream theme, scoped to `.ax`), `AntarixsBrand.tsx` (logo and wordmark).
  - Buyer tour: `src/components/BuyerTour.tsx`.
  - Static images for the platform pages: `public/platform/`.
- **Server:** Express. Entry: `server.ts`; routes in `server/routes/`; tenancy in `server/tenancy.ts`; platform routes and legal pages in `server/legal.ts`; sector (jewellery) rules in `server/sectors/jewellery.ts`.
- **Shared:** `shared/` (limits, Hindi helpers `shared/hindi.ts`, store-name rules).
- **Merchant config:** `merchants/<id>/merchant.json` (`bhakti` is the demo store).
- **Archived layout:** `app_themes/gilded/` is not built. See its README before touching it.
- **Data:** Firestore in production; file store locally (`data/`).

## Commands

- `npm run dev` runs the server and client on `PORT` (default 3000 in dev; we used `PORT=3111 VITE_ALLOW_ANY_HOST=true`).
- `npx tsc --noEmit` is the typecheck. `npm test` runs vitest (about 308 tests; the known `tests/layout.test.ts` timeout may fail).
- `npx vite build` builds the client; `npm run build` builds client and server.
- Browser checks use Playwright with `/opt/pw-browsers/chromium`. Scratch scripts live in the session scratchpad, not the repo.

## Git and deploy

- Work on `main`, push with `git push -u origin main`. Commit messages carry the Claude attribution lines.
- **Deploy is not done from the session.** Production is Google Cloud Run (`catalogue-app`, region `asia-south1`). See `DEPLOY_TO_CLOUD_RUN.md`. A Cloud Build trigger on `main` (if set up) or the manual `gcloud run deploy` command publishes the change. The session has no working gcloud login, so ask the user to deploy.
- Android app builds via `.github/workflows/android.yml`.

## What was done recently (all pushed to `main`)

1. **Platform welcome page** (`/welcome-antarixs`): cream design from the "Antarixs — Platform Site" design canvas. Peacock earrings photo blends into the header and fades into the cream. Hairline sections, light type. Header "Antarixs" with "Jewellers Solution", larger. Hamburger menu: How it works, Pricing · Basic & Pro, Terms & conditions, Privacy policy. Sign in removed; "What buyers see" and "Choose your experience" removed. "The platform" pillars (Catalogue, ERP system, WhatsApp lighthouse, Lead insights) reveal with drawn lines and icons on scroll.
2. **How it works** (opened from the menu): photo-and-text tour of a store at `[name].antarixs.com`, with moving CSS phone mock-ups.
3. **Sign-up**: store address is read-only; it is made from the business name. Live store preview card on the right (above the form on phones).
4. **Admin**:
   - The three-bar button opens store settings directly (no profile menu). Buyers keep their profile menu.
   - Store settings: "Alerts" is a row with only the alerts on/off switch (`OrderNotificationsToggle` with `row`).
   - **WA Lighthouse** in Reports (WhatsApp numbers, test alert, message log). Pro-gated.
   - Hero collections card starts collapsed, with up/down arrows to reorder.
   - Tags: a drop-down/drop-up card, and the collection tag picker is a drop-down.
   - New product: the Hindi name and description fields are removed. Hindi is generated automatically (`shared/hindi.ts`).
5. **Buyer tour**: works through the real app. It hearts a sample design and adds it to the cart, then removes both. **Known gap:** on a brand-new store with no designs, the tour points at empty areas (see open items).

## Decisions to keep

- Platform pages use the cream theme only inside `.ax` (`platform.css`). Store apps and Emergent screens are unaffected.
- Store address on sign-up cannot be typed; it follows the business name.
- Prices are placeholders `[YOUR PRICE]` until the owner gives them.
- The demo catalogue is seeded only outside production (`SEED_DEMO_CATALOGUE`), so a real new store starts empty.
- Hindi for names is automatic unless the owner writes a Hindi version somewhere else (not on the product form any more).
- Design canvases (not in the repo): Antarixs platform site `https://claude.ai/artifact/FYpuygYPwDgkyMzjK8XrZs`; buyer screens `https://claude.ai/artifact/LXB79TBQAQ3z3LUweKNGL7`.

## Open items

- **Empty new store:** the buyer tour and Home/Catalogue show blank areas when a store has no designs. Options were: skip product steps when empty, start the tour only after the first design, better empty states, an owner checklist, and optional sample designs at signup. Waiting for a decision.
- **Sign-up error link:** the "already used its trial" error links to "Sign in to your store" on the welcome page, which no longer has sign-in. Needs a new target.
- **Pricing:** `[YOUR PRICE]` placeholders on plan cards.
- **Pillar wording:** ERP system and WhatsApp lighthouse descriptions are drafted, not confirmed as product claims.
- **Visual checks not yet done by the user:** admin screens after the latest changes (signed in as an admin), and the platform pages on a real phone with the real fonts.
- **Audit findings** from an earlier security review (not yet fixed; user to choose): a static OTP accepted in production (high), rate limits keyed on the load balancer IP, tokens not revoked on password change, anonymous `/api/entitlements` leaking usage, no CAPTCHA on OTP/signup, GitHub Actions without a `permissions` block, and several low items.
- **Outside the code:** set `PLATFORM_LEGAL_NAME`, `PLATFORM_CONTACT_EMAIL`, `PLATFORM_ADDRESS`; get privacy/terms wording reviewed; open port 80 / HTTP→HTTPS redirect on the load balancer; rebuild the Android app.

## Notes for the next session

- Keep images out of chat where possible; they are the biggest context cost.
- Check `git status` and `git log -5` first; the working tree should be clean.
- Before any change, read the file you are editing. Several files changed on disk during long sessions.
