# To do

## Handoff: continue on the unrestricted device (updated 2026-10-03)
The office laptop blocks the Android Studio / SDK install, so the native build moves to another machine. Everything up to the Android project is already committed.
- [ ] Clone the repo, `npm install`, `npm run lint`, `npm test` (expect 115 passing).
- [ ] Install Android Studio and let first run download the Android SDK, platform tools and an emulator image. Needs JDK 17+ (Studio bundles one).
- [ ] `gcloud auth login` and `gcloud config set project gen-lang-client-0273003651` if cloud work is needed.

## Stage 0: Production hygiene
- [x] Photo bucket, Firestore TTL policies, backups, Master Key in Secret Manager (verified 2026-10-03).
- [x] First Owner admin and seed products/categories verified by the owner.
- [x] Repo is private.
- [x] Cloud Monitoring: API enabled, email channel hello@antarixs.com, uptime check on /health (5 min), alerts for health failing, 5xx > 5 per 5 min, p95 latency > 3 s. Created over the REST API.
- [ ] Confirm the old passwords/keys that were in git history are rotated (they remain in history).
- [ ] Send a test notification from the alert channel and confirm hello@antarixs.com gets it (and the channel's verification email).
- [ ] npm audit: 6 moderate, all `uuid <11.1.1` pulled in by the Firestore/Google libraries (the repo never uses the uuid package; it uses `crypto.randomUUID()`). Fix is a breaking Firestore 9.x upgrade: do it on its own branch with the full test run and a staging deploy.
- [ ] Check the GitHub Actions run for the latest push.

## Stage 1: Native Android shell (Capacitor, one app per merchant)
Decided: Capacitor, one app per merchant, Android first (Google Play account ready; no Apple developer account yet). PWA files stay (owner decision).
- [x] Capacitor packages, `capacitor.config.ts` (appId and name from `merchants/<id>/merchant.json`), `VITE_API_BASE`, native token storage via Preferences, CORS for `https://localhost` and `capacitor://localhost` (commit a218cfe).
- [ ] `npm run build`, then from the repo root `npx cap add android` and `npx cap sync`. Run `cap` from the repo root (the config path is relative to the cwd).
- [ ] Set `VITE_API_BASE=https://catalogue-app-456376852191.asia-south1.run.app` for the native build.
- [ ] Run on an emulator and a real phone: login (buyer and admin), browse, photos, order, cancel order, PDF download, session survives an app restart.
- [ ] Add the new `android/` project to git (check its .gitignore); keep keystores and secrets out of the repo.
- [ ] Per-merchant icon, splash and app name from `merchants/<id>/`; fill `android.sha256CertFingerprints` once the signing key exists.
- [ ] Native features: camera for photo upload, push for order status, biometric login, share sheet for PDFs.
- [ ] In-app account deletion, privacy and support URLs (Play requirement).

## Stage 2: Safe releases
- [ ] Versioned API under `/api/v1` so installed apps keep working across deploys.
- [ ] Minimum-app-version check so a breaking change can force an update.
- [ ] Clean up unused photos in buckets (files stay when a product is deleted or re-photographed).

## Stage 3: Multi-merchant
- [ ] `scripts/provision-merchant.ts`: service, Firestore, bucket, secrets, Cloud Run service, first Owner (via the Master Provisioning Key).
- [ ] Deploy-to-all with checks: build once, roll out to every merchant, stop if a health check fails.
- [ ] Per-merchant native build automation (name, icon, app ID per merchant).

## Stage 4: Google Play release
- [ ] Signing key and Play App Signing, privacy policy, store listing, data-safety form.
- [ ] Internal testing track first, then closed/open testing, then production.
- [ ] Pre-launch pass: full tests, real-device run, rollback plan.
- [ ] iOS later: needs an Apple developer account; Apple restricts template apps, so likely each merchant publishes under their own account.

## Later
- [ ] Phase 5: self-service password reset and real OTP/2FA (SMS/WhatsApp/authenticator), staff permissions, data export and delete, terms/privacy templates, merchant onboarding and billing.

## Known gaps
- [ ] No real 2FA and no self-service password reset. A retailer who forgets a password asks the Owner, who resets it in the Admin Hub; admin 2FA was a mock and has been removed.
- [ ] Extra jewellery wording still lives in shared screens (Catalogue filters, Quotation labels); move into the pack when a second sector arrives.
- [ ] `payment-gateway` order flow is only reserved in config; not built.
- [ ] The hot `dailyStats` counter document could hit Firestore write limits at high traffic (shard it if needed).
- [ ] Session token is JS-readable (`sessionStorage`). A secure cookie is the stricter option.
- [ ] Buyer signup is auto-verified; no approval step (owner decision: not needed).
- [ ] A reset password does not sign out sessions already open for that buyer (tokens last up to 24 h).
- [ ] A visitor who browses as a guest and then signs in is counted once as a guest and once as a buyer (public catalogues only).
- [ ] Engagement data is per person: add a line to the merchant's privacy text before going live with real buyers.
- [ ] Product photos in the grid are the full-size originals; add a lighter preview if the grid feels slow on mobile data.

## Decisions to make (brainstorm later)
- [ ] Second sector to design against (avoids over-fitting to jewellery).
- [x] Capacitor vs full rewrite: Capacitor (decided 2026-10-03).
- [ ] One Google Cloud project per merchant vs shared project with a service and database per merchant.
- [x] One app per merchant (decided 2026-10-03). Store account ownership per client still open.

## Done
- [x] Phase 2: private per-merchant photo storage with automatic camera/gallery upload (originals kept, category 1 photo, product 1-3), signed short-lived photo links, config loadable from the bucket.
- [x] Phase 2: merchant-defined product fields, price modes (by weight / fixed / on request), edit and delete for products and categories, product detail sheet with photo gallery, category filter from the Categories screen.
- [x] Phase 2: buyer order history, owner-assisted password reset with forced change, change password; confirming an order now empties the batch.
- [x] Phase 2: Admin Hub engagement: clickable Total / Verified / Guest blocks with per-buyer designs viewed, time, searches, selections.
- [x] Removed the fake "AI Karat & Edge Detect" and "Bulk Batch Upload" labels from the Admin Hub.
- [x] Security: required secrets, auth on every route, hashing, rate limits, helmet, validation.
- [x] Firestore storage, multi-stage non-root Docker build, CI, Cloud Run deploy, `/health`.
- [x] Real Admin Hub numbers with 15 s polling; Production Guide removed.
- [x] Landing page changes; portal gated behind sign-in.
- [x] Phase 1a: merchant config, theming, per-merchant page title/preview.
- [x] Phase 1b: public/login access modes enforced in server and app; Admin Orders desk with status; Hub shows new orders.
- [x] Back-button and reload fix: history-aware navigation, per-tab session, `/api/auth/me`.
- [x] Phase 1c: jewellery pack, no invented data, honest forms, per-merchant seed, live category counts.
- [x] Phase 1d: owner/staff roles, `buyers` collection with automatic migration.
