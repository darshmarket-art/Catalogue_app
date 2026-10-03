# Plan

## Goal
A configurable catalogue app that can be sold to many merchants. **Bhakti Jewels is our first merchant (the live pilot); its look and wording live in `merchants/bhakti/merchant.json` so every later merchant gets the same product with their own brand.**
**Since 2026-10-04 this is a SaaS product (Antarixs):** any business creates a store in minutes, gets its own link (`[store].antarixs.com`), runs on the Basic plan, and gets all Pro features free for the first 14 days. See "SaaS model" below. Web link first; store apps are a paid add-on.

## Decisions (made)
- **~~One deployment per merchant.~~ Superseded 2026-10-04** by the SaaS model below: instant free signup needs one shared service with data kept per store. Dedicated deployments stay possible later for large Pro customers.
- **Sector packs.** The core catalogue is generic; sector rules (fields, validation, wording, message templates) live in a pack. Jewellery is the only pack so far.
- **Catalogue access:** buyers sign in with a **WhatsApp OTP** on both plans (decided 2026-10-04, replaces phone + password for buyers). The old `public` / `login` setting is kept only for the existing Bhakti store until the migration. **Ordering always needs an account.** No guest checkout.
- **Order flow is per merchant/sector.** Jewellery = direct order (no payment). A payment-gateway flow (e.g. clothing) is reserved, not built.
- **Merchant onboarding/billing, second sector, mobile tech, Google Cloud layout and store accounts are deferred** to a later brainstorm. Store-account ownership depends on each client (Apple restricts template apps: likely each merchant publishes under their own developer account).
- **Nothing is invented for the merchant:** HUID, prices, photos, rates, counts and security features are real or absent.

## Decisions for the native app (made 2026-10-03)
- **Capacitor** wrapping the existing React app (no UI rewrite). PWA files stay in the repo.
- **One app per merchant**: name, icon and app ID come from `merchants/<id>/merchant.json` (`android.packageName`, `brand.name`).
- **Android first** via Google Play; iOS waits for an Apple developer account.
- Native builds set `VITE_API_BASE` to the merchant's Cloud Run URL; the server allows the webview origins (`https://localhost`, `capacitor://localhost`). Native login token is kept in Capacitor Preferences; web keeps `sessionStorage`.

## SaaS model (decided 2026-10-04)
- **Product.** The Bhakti Jewels app is the core product. A store's online link is that same app with features switched on or off by plan, never a separate simplified app.
- **Plans.** Basic (free, stays forever) and Pro. **Every new store gets all Pro features free for 14 days**, then Pro features lock and Basic continues. Locked features keep their icon with a small "Pro" lock marker; tapping one explains what Pro adds.
- **Trial and downgrade rules.** Nothing is deleted and nothing is hidden from visitors: content added during the trial (an 8th category, a 3rd photo) stays; the owner just cannot add more beyond Basic limits until under them or upgraded. The plan is worked out on request (Pro while now is before `trialEndsAt`, else the stored plan), so no job flips it. One trial per phone number and email. Bhakti Jewels becomes store 1 on a permanent Pro "founder" plan. Reminders at days 7, 3 and 1 need a daily scheduled job (later phase).
- **Access: WhatsApp OTP on both plans.** Buyers sign in with a code sent on WhatsApp. Admins keep email + password (admin 2FA is still a gap). A **user is a verified phone number** per store. **Basic allows 10**: a new number asked for a code when 10 already exist sees "this catalogue is full" and no code is sent; existing buyers always get in; the owner can remove a buyer to free a slot. Pro is unlimited.
- **OTP rules.** 6 digits, expires in 5 minutes, stored hashed, 5 attempts, resend cooldown, rate limits per phone and per IP, a daily cap per store (OTPs cost money, so abuse control matters). One Antarixs WhatsApp sender for all stores, using a Meta "authentication" template. In development the code is logged; tests inject a fake sender. Existing Bhakti buyers keep their accounts and sign in by OTP to the same phone number; password screens and owner-reset for buyers are retired.
- **Limits.** Basic: 5 categories (a "catalogue" means a category), 200 photos in total, 1 photo per design, 10 users. Pro: unlimited categories and users, 3,000 photos, up to 3 photos per design. Photos are counted as photos attached to designs, categories and banners, so orphaned files must be cleaned up first.
- **Feature split** (all of Pro is free during the trial):

| Area | Basic | Pro |
|---|---|---|
| Core app | Home with Collections, Catalogue (search, sort, grid), design details and photo viewer, shortlist, About us, store name, logo, colour | same |
| Access | WhatsApp OTP login, 10 users | WhatsApp OTP login, unlimited users |
| Contacting the owner | Enquire on WhatsApp on each design | Place order, Orders tab, order history, cancel order, order confirmation message |
| Admin tools | Categories, designs, **Home banner editing**, **purity options**, buyer list (view and remove), Share link and QR | Orders desk, **owner and staff roles**, **PDF catalogue** |
| Numbers | locked | Kg booked, views and enquiries, live visitors, buyer engagement, audit log |
| Alerts | locked | WhatsApp and push order alerts |
| Photos | 200 total, 1 per design | 3,000 total, up to 3 per design |
| Separate add-ons | | Own Android app (paid separately), custom domain (later) |

  Confirmed 2026-10-04: PDF catalogue and staff roles are Pro; purity options are Basic.
- **Tenancy and links.** One shared Cloud Run service with data kept per store; the store is picked from the web address. Links are `[store].antarixs.com` using wildcard DNS, a wildcard certificate and the **Google Cloud load balancer** (**decided 2026-10-04**, chosen over Cloudflare: one vendor, no Host-header worker; about $18 a month before traffic). Subdomains are 3 to 30 letters, numbers or hyphens, unique, with names like `www`, `console`, `api`, `app`, `admin` reserved.
- **Antarixs console** at `console.antarixs.com` behind Google Identity-Aware Proxy: stores, plan and trial controls, usage, activity, suspend, and cloud health.
- **Android app** is a separate paid add-on, not part of Pro. The Google Play account is Antarixs's own. **Risk:** Play policy, as remembered, may not allow template apps published by an operator on others' behalf. Verify before Phase 10; alternatives are one shared Antarixs app or each owner publishing from their own account.
- **Payments come last** (Razorpay suggested). Until then Antarixs upgrades stores by hand from the console.
- **Prototype** (an approximation, not the real UI): https://claude.ai/artifact/CSboJcYbSNw19dzZosVraC

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
5. Plan limits and locked features are enforced on the server first; the app only mirrors them.

## Architecture
- `merchants/<id>/merchant.json` (brand, colours, contact, promotions, welcome cards, access mode, order prefix) + optional `seed.json` (demo data, dev only). `MERCHANT` env / Docker build arg selects it. `merchants/example/` is the starter.
- Server (`server/`, entry `server.ts`): Express, zod validation, JWT (HS256, per-merchant issuer), bcrypt, helmet, rate limits, structured logs.
  - `store.ts`: Firestore in production; file/memory in dev/tests.
  - `sectors/jewellery.ts`: product schema, derived weights, order line, confirmation text. `shared/` holds constants used by both sides.
  - `stats.ts`: daily totals (IST) for the Admin Hub. Live visitors = heartbeat in last 45 s.
- App (`src/`): React + Tailwind theme tokens overridden per merchant. `src/sectors/jewellery.ts` = wording + WhatsApp templates. Merchant config is embedded in `index.html` by the server.
- Auth (today): retailers (phone + password) and admins (email + password, roles `owner`/`staff`). **Target (SaaS Phase 2): buyers sign in by WhatsApp OTP; admins keep email + password.** Session token kept in `sessionStorage` (survives reload/back, ends when the tab closes); `GET /api/auth/me` restores it. Screens are in browser history, so Back never returns to login.
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
| 3b. Versioned API and releases | versioned API `/api/v1`, minimum app version (the per-merchant provisioning script and deploy-to-all are only needed for a dedicated-deployment tier now) | Next, folded into the SaaS roadmap |
| SaaS roadmap | Phases 0 to 11 below | **Planned** |
| Sellability extras | admin 2FA, staff permissions, data export/delete, legal templates | Planned (inside the SaaS phases and todo) |

## SaaS roadmap (all work to be done)
Order is chosen so the plan flags and Basic mode can be built and tested on the existing app before the large multi-store rewrite, and so the long-lead Meta (WhatsApp) setup starts first.

| Phase | Work | Size |
|---|---|---|
| **0. Sign-off and long-lead items** | Agree the feature table, limits, trial and downgrade rules. Start Meta business verification, a WhatsApp Business number and the OTP template. Confirm the `antarixs.com` DNS access. Decide the Play-policy route. | Small, but waits on Meta |
| **1. Plan flags and limits** | Shared plans table; `effectivePlan` with the 14-day trial; server refuses locked features and over-limit actions (6th category, 201st photo, 2nd photo per design, orders on Basic); the config sent to the app carries what the plan allows; photo cleanup so counts are true. Tests, including trial expiry. | Medium |
| **2. WhatsApp OTP login and the user limit** | WhatsApp sender with a fake for tests; OTP send and verify with all abuse rules; replace buyer phone + password; migrate Bhakti buyers; the 10-user limit on Basic; owner can remove a buyer; retire buyer password screens. | Medium to large |
| **3. Basic mode in the app** | Home, Catalogue, Shortlist and About only; Enquire replaces Add and Orders; locked Pro tiles with the lock marker and upgrade prompts; locked numbers block; trial countdown banner; Home banner editing stays on. Checked in a real browser. | Medium |
| **3b. Versioned API and minimum app version** | `/api/v1` and a minimum-app-version check, so installed phone apps keep working through the multi-store cut-over. Must land before Phase 4. | Small |
| **4. Multi-store core** | Stores collection; data kept per store; store picked from the web address; per-store config instead of `merchant.json`; photo paths per store; tokens carry the store; Bhakti moved in as store 1 (Pro founder); cross-store isolation tests; per-store export. | **Largest** |
| **5. Subdomains** | Wildcard DNS and certificate, Google Cloud load balancer, reserved names; Bhakti on `bhakti.antarixs.com` with the old `run.app` address kept alive. | Medium |
| **6. Instant signup and trial start** | Antarixs entry app (Create your store, Sign in); creating a store starts the trial, logs the owner in and shows the share link; owner email and phone checks; anti-abuse; one trial per phone and email. | Medium |
| **7. Trial lifecycle** | Daily scheduled job; reminders at days 7, 3 and 1; end-of-trial lock; warning before a login store changes behaviour; data kept and restored on upgrade. | Medium |
| **8. Antarixs console** | Behind Google Identity-Aware Proxy: stores and usage, plan and trial controls (set Pro, extend trial), activity feed, suspend, cloud health from Monitoring and billing. | Medium |
| **9. Notifications** | WhatsApp order alerts to the store's admin number and push alerts to admins (Pro). | Medium |
| **10. Android app add-on** | Per-store builds from the existing pipeline; Play route decided in Phase 0; push and native features; app request flow in the console. | Medium |
| **11. Payments** | Last: Razorpay subscriptions, upgrade and downgrade, invoices, failed-payment handling. | Medium |

## Sequencing: what must go in order and what can run in parallel
**Why Phase 4 is the gate.** Multi-store core rewrites how every route reads and writes data. Phases 1, 2 and 3 touch the same routes and screens, so doing them first avoids painful merge conflicts. After Phase 4, most remaining work fans out.

| Phase | Needs first | Can run alongside | Notes |
|---|---|---|---|
| **0** External setup | nothing | everything | Owner work: Meta WhatsApp, DNS access, Play policy check, prices. Meta gates only the *live* OTP in Phase 2; code can be built with a fake sender. |
| **1** Plan flags | nothing | 0, 2a, push alerts, infra | Plans table, trial, server enforcement, photo cleanup. |
| **2a** OTP login (code) | nothing | 1, 3 | Auth files only. Uses the fake sender until Meta is ready. |
| **2b** 10-user limit | 1 (limits) and 2a | 3 | Small. |
| **3** Basic mode UI | 1 (flags in config) | 2a, 2b | Screens only (Catalogue, Orders, Admin Hub). Does not touch auth files. |
| **3b** Versioned API | nothing | 1, 2, 3 | Must be merged before 4. |
| **4** Multi-store core | 1, 2, 3, 3b merged | infra (5), push alerts, console design | **Sequential gate.** The schema and isolation design can be drafted in parallel before it starts. |
| **5** Subdomains | DNS access (0) | 1 to 4 (infra part) | The load balancer and wildcard certificate can be built at any time and pointed at the current service. The host-to-store hookup finishes after 4. |
| **6** Instant signup | 4 and 5 | 8, 9, 10 | Needs stores to exist and links to resolve. |
| **7** Trial lifecycle | 1 and 6; WhatsApp sender from 2 | 8, 9, 10 | The scheduled job can be written once 4 is done; reminders need the WhatsApp sender. |
| **8** Console | 4 (data); plan controls need 1 | 5, 6, 7, 9, 10 | A read-only version can start right after 4; suspend and plan controls follow. Can use the `run.app` address until 5 is done. |
| **9** Alerts | WhatsApp sender (2); per-store admin numbers (4) | 6, 7, 8, 10 | **Push (Firebase) has no dependency and can be built now** for Bhakti. WhatsApp alerts need an approved utility template. |
| **10** Android add-on | 4, 5; request flow needs 8 | 6, 7, 9 | The build pipeline already exists; device testing of the current app can continue any time. |
| **11** Payments | everything above, especially 7 and 8 | nothing | **Strictly last.** |

**Waves**
1. *Start now, all in parallel:* Phase 0 external setup (owner), Phase 1 plan flags, Phase 2a OTP code, push notifications for Bhakti, load balancer and certificate setup, Stage 0 hygiene, phone-app device testing.
2. *Next, in parallel:* Phase 2b user limit, Phase 3 Basic mode UI, Phase 3b versioned API.
3. *Gate, sequential:* Phase 4 multi-store core, after waves 1 and 2 are merged.
4. *Fan out, in parallel:* finish Phase 5 hookup, then Phases 6, 8 (read-only), 9 and 10.
5. *After signup exists:* Phase 7 trial lifecycle, rest of Phase 8, Phase 10 release.
6. *Last:* Phase 11 payments.

**Working in parallel without collisions.** Give each parallel track its own branch. Tracks that touch different files (for example Phase 1 server code and Phase 2a auth code) run safely together; Phase 3 screens and Phase 2a auth screens must not both edit `App.tsx` at the same time.

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
