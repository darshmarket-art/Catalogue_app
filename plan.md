# Plan

## Goal
A configurable catalogue app that can be sold to many merchants. **Bhakti Jewels is our first merchant (the live pilot); its look and wording live in `merchants/bhakti/merchant.json` so every later merchant gets the same product with their own brand.**
Each merchant gets its own deployment, branding, sector rules and data. Web link first; store apps later.

## Decisions (made)
- **One deployment per merchant.** Data is separated by deployment (own Cloud Run service, Firestore, secrets), not by a tenant id inside shared data.
- **Sector packs.** The core catalogue is generic; sector rules (fields, validation, wording, message templates) live in a pack. Jewellery is the only pack so far.
- **Catalogue access is a per-merchant setting:** `public` (anyone can browse) or `login` (account required). **Ordering always needs an account.** No guest checkout.
- **Order flow is per merchant/sector.** Jewellery = direct order (no payment). A payment-gateway flow (e.g. clothing) is reserved, not built.
- **Merchant onboarding/billing, second sector, mobile tech, Google Cloud layout and store accounts are deferred** to a later brainstorm. Store-account ownership depends on each client (Apple restricts template apps: likely each merchant publishes under their own developer account).
- **Nothing is invented for the merchant:** HUID, prices, photos, rates, counts and security features are real or absent.

## Decisions for the native app (made 2026-10-03)
- **Capacitor** wrapping the existing React app (no UI rewrite). PWA files stay in the repo.
- **One app per merchant**: name, icon and app ID come from `merchants/<id>/merchant.json` (`android.packageName`, `brand.name`).
- **Android first** via Google Play; iOS waits for an Apple developer account.
- Native builds set `VITE_API_BASE` to the merchant's Cloud Run URL; the server allows the webview origins (`https://localhost`, `capacitor://localhost`). Native login token is kept in Capacitor Preferences; web keeps `sessionStorage`.

## Decisions for Phase 2 (made)
- **Per-merchant Cloud Storage bucket** (`asia-south1`, private, versioned). Photos picked from the gallery or camera upload automatically. Merchant config (`merchant.json`) is also read from the bucket at startup, with the repo copy as fallback. Secrets stay in Secret Manager.
- **Photos are private.** The catalogue is login-only, so the app is given short-lived signed links (6 to 12 hours, stable within a window so browsers can cache), not public URLs. The app signs the links itself, so no extra Google permissions are needed.
- **No resizing or compression.** Originals are stored as uploaded (JPEG/PNG/WebP up to 25 MB, checked by content, not just by name). The photo goes through the app to the bucket (Cloud Run allows 32 MB requests), not directly from the phone; direct upload is possible later if files get bigger. Old files are kept when a product is deleted or re-photographed, because past orders show them.
- **Photo counts:** a category has exactly 1 photo; a product has 1 to 3.
- **Buyer approval: not needed** (owner decision). Buyers sign up and get in straight away.
- **Password help:** the Owner resets a buyer's password from the Admin Hub (temporary password shown once; the buyer must choose a new one). Buyers can change their own password from the header. Self-service reset (SMS/WhatsApp/email) is Phase 5.
- **Order flow:** confirming an order now empties the batch (it used to keep the same items, so a second order repeated them); buyers see their past orders.

## Admin Hub: visitor engagement (built)
- Clickable blocks: **Total tracked**, **Verified merchants**, and **Guests** (shown only when the merchant's catalogue access is `public`).
- Opening a block lists the buyers (last 30 days). Opening a buyer shows time in the app, time looking at designs, designs seen, what they searched for, what they selected or added to the order.
- How it works: the app records, for signed-in buyers (and guests only in public mode), the seconds each design was on screen, search terms (after a pause in typing), selections and add-to-order. Admin browsing is never recorded. Data: `visitors` (running totals per buyer) and `activityEvents` (90-day TTL). Buyers should be told about this in the merchant's privacy text.

## Rules for all new work
1. No merchant-specific text, colours, numbers or roles in code. They belong in `merchants/<id>/merchant.json`.
2. Sector-specific behaviour goes in a sector pack, not in shared screens.
3. Propose the plan before large changes; mention how a change affects the template goal.
4. Every change gets tests; UI changes are checked in a real browser.

## Architecture
- `merchants/<id>/merchant.json` (brand, colours, contact, promotions, welcome cards, access mode, order prefix) + optional `seed.json` (demo data, dev only). `MERCHANT` env / Docker build arg selects it. `merchants/example/` is the starter.
- Server (`server/`, entry `server.ts`): Express, zod validation, JWT (HS256, per-merchant issuer), bcrypt, helmet, rate limits, structured logs.
  - `store.ts`: Firestore in production; file/memory in dev/tests.
  - `sectors/jewellery.ts`: product schema, derived weights, order line, confirmation text. `shared/` holds constants used by both sides.
  - `stats.ts`: daily totals (IST) for the Admin Hub. Live visitors = heartbeat in last 45 s.
- App (`src/`): React + Tailwind theme tokens overridden per merchant. `src/sectors/jewellery.ts` = wording + WhatsApp templates. Merchant config is embedded in `index.html` by the server.
- Auth: retailers (phone + password) and admins (email + password, roles `owner`/`staff`). Session token kept in `sessionStorage` (survives reload/back, ends when the tab closes); `GET /api/auth/me` restores it. Screens are in browser history, so Back never returns to login.
- Firestore collections: `buyers`, `admins`, `categories`, `products`, `cartItems`, `purchaseOrders` (with status), `inquiries`, `auditLogs`, `dailyStats`, `sessions`, `productViews`, `visitors`, `activityEvents`.
- Photos: `server/blobs.ts` (Cloud Storage in production, disk in dev, memory in tests), `server/media.ts` (signed links), `server/routes/photos.ts` (upload and serving). Products store `images` (1-3 refs like `media:<id>.jpg`); the API returns links.
- Merchant-defined product fields: `productFields` in `merchant.json`, checked in `server/productFields.ts`, stored as `extra` on the product.

## Phases
| Phase | Scope | Status |
|---|---|---|
| Security and production readiness | secrets required, auth on every route, Firestore, hardening, CI, Cloud Run deploy | Done |
| Admin Hub analytics | real views/inquiries/bookings/visitors, 15 s polling | Done |
| 1. Template foundation | (a) config + theming, (b) access modes + Orders desk, (c) jewellery pack + no invented data, (d) roles/buyers cleanup | **Done** |
| 2. Catalogue core and photos | (a) bucket per merchant, config from bucket, signed photo links; (b) camera/gallery upload, originals kept, 1 photo per category, 1-3 per product; (c) merchant-defined product fields, price modes, edit/delete; (d) buyer order history, owner password reset, change password; (e) per-buyer engagement analytics | **Done** (the bucket still has to be set up on the live service: see todo) |
| 3. Native Android app | Capacitor shell, per-merchant app, native features, then Play release (see todo Stages 1 and 4) | **In progress** (config committed; Android project/build pending on an unrestricted device) |
| 3b. Provisioning and releases | scripted new-merchant setup, deploy-to-all with checks, versioned API `/api/v1`, min app version | Next |
| 5. Sellability | password reset, real OTP/2FA, buyer approval, staff permissions, data export/delete, legal templates, merchant onboarding | Planned |

## Reference
- Run locally: `npm install`, then `npm run dev` (data in `data/local-db.json`; set `MERCHANT=<id>` for another merchant).
- Check: `npm run lint`, `npm test`, `npm run build`.
- Deploy: push to `main` (Cloud Build to Cloud Run). Setup steps are in `DEPLOY_TO_CLOUD_RUN.md`.
- Live service: https://catalogue-app-456376852191.asia-south1.run.app (health at `/health`, not `/healthz`).

## Handoff to the unrestricted device (2026-10-03)
- Office laptop blocks the Android SDK install; continue the native build elsewhere from the todo.md "Handoff" and "Stage 1" lists.
- State: Stage 0 hygiene done except password-rotation confirmation, alert test email, and the uuid audit fix. Capacitor config, API base, native token storage and CORS are committed and tested (lint clean, 115 tests).
- GCP project `gen-lang-client-0273003651`, region `asia-south1`, service `catalogue-app`. Monitoring alerts email hello@antarixs.com.
- Do not commit keystores, `.env` files or the Master Provisioning Key.
