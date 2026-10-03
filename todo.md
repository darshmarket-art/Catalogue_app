# To do

## Handoff: continue on the unrestricted device (updated 2026-10-03)
The office laptop blocks the Android Studio / SDK install, so the native build moves to another machine. Everything up to the Android project is already committed.
- [ ] Clone the repo, `npm install`, `npm run lint`, `npm test` (expect 115 passing).
- [ ] Install Android Studio and let first run download the Android SDK, platform tools and an emulator image. Needs JDK 17+ (Studio bundles one).
- [ ] `gcloud auth login` and `gcloud config set project gen-lang-client-0273003651` if cloud work is needed.

## SaaS roadmap: all work to be done (decided 2026-10-04, see plan.md "SaaS model")
Basic is the free plan; every new store gets all Pro features for 14 days. Buyers sign in by WhatsApp OTP on both plans. Payments are last.

### Sequencing (full table in plan.md "Sequencing")
- **Start now, in parallel:** Phase 0 external setup (owner), Phase 1 plan flags, Phase 2a OTP code with a fake sender, push notifications for Bhakti, load balancer and wildcard certificate setup, Stage 0 hygiene, phone-app device testing.
- **Next, in parallel:** Phase 2b user limit, Phase 3 Basic mode UI, Phase 3b versioned API.
- **Gate, sequential:** Phase 4 multi-store core, only after the above are merged.
- **Fan out, in parallel:** finish Phase 5, then Phases 6, 8 (read-only first), 9 and 10.
- **After signup exists:** Phase 7, the rest of Phase 8, Phase 10 release.
- **Last:** Phase 11 payments.
- Use one branch per parallel track; do not let two tracks edit `App.tsx` at the same time.

### Phase 0: Sign-off and long-lead items (start these first)
- [x] Feature table confirmed 2026-10-04: PDF catalogue and staff roles are Pro; purity options, Home banner editing and the buyer list (view and remove) are Basic.
- [ ] Meta business verification, a WhatsApp Business number for Antarixs (it leaves the normal WhatsApp app once on the Cloud API), and an approved authentication (OTP) template. Takes days: start now.
- [x] Decided 2026-10-04: Google Cloud load balancer (not Cloudflare).
- [ ] Confirm access to `antarixs.com` DNS (needed for the wildcard record).
- [ ] Check the current Google Play policy on template apps published by an operator; choose: one shared Antarixs app, owners' own accounts, or proceed.
- [ ] Set prices and the exact Pro and Android add-on charges (needed before Phase 11, not before).

### Phase 1: Plan flags and limits
- [x] `shared/plans.ts`: Basic and Pro limits (done as server/entitlements.ts; Basic users now 50) (5 categories, 200 photos, 1 photo per design, 50 users vs unlimited, 3,000 photos, 3 per design) and the feature list.
- [x] `effectivePlan(store, now)`: Pro while before `trialEndsAt`, else the stored plan; `founder` plan for Bhakti. No job.
- [x] Server refuses locked features and over-limit actions (Phase 1 limits + Phase 3 flag gating, 402) with a clear message (6th category, 201st photo, 2nd photo per design, orders and Orders desk on Basic, locked analytics).
- [x] The config sent to the app carries (GET /api/entitlements) `plan`, `trialEndsAt`, limits and which features are on.
- [ ] Photo cleanup (orphans removed when a design is deleted or re-photographed) so photo counts are true; keep photos that past orders still show.
- [ ] Tests for every limit and for trial expiry (inject the clock).

### Phase 2: WhatsApp OTP login and the 50-user limit (Basic; Pro unlimited)
- [x] WhatsApp sender interface: Meta Cloud API in production, console log in dev, fake in tests.
- [x] OTP send and verify: 6 digits, 5-minute expiry, hashed, 5 attempts, resend cooldown, rate limits per phone and IP, daily cap per store.
- [x] Replace buyer phone + password sign in and sign up with OTP (client done; old password routes still on the server until migration); keep admin email + password.
- [ ] Migrate Bhakti buyers (same phone number, sign in by OTP); retire buyer password screens, change password and owner password reset.
- [x] 50-user limit on Basic (done in Phase 2b: CATALOGUE_FULL, owner can list/remove buyers) (constant BASIC_BUYER_LIMIT in server/routes/otp.ts, not enforced yet): a new number gets "catalogue full" and no code is sent; existing buyers always get in; owner can remove a buyer to free a slot.
- [ ] Session lifetime for buyers (web and the Android app).
- [ ] Tests: OTP abuse limits done (tests/otp.test.ts); the 51st number test comes with the limit.

### Phase 3: Basic mode in the app
- [x] Hide Orders tab, Add to order and order screens on Basic; show Enquire on WhatsApp instead.
- [x] Locked Pro tiles in the Admin Hub (Orders, buyer engagement, audit log, kg booked, views, live visitors) with the small "Pro" lock marker and an upgrade prompt.
- [x] Locked second and third photo slots on New design.
- [x] Home banner editing available on Basic (banner photos count toward the 200).
- [ ] Trial countdown banner done; plan and usage screen still to build.
- [ ] Check in a real browser and on the phone app.

### Phase 3b: Versioned API (before Phase 4)
- [x] `/api/v1` so installed phone apps keep working across the multi-store cut-over.
- [x] Minimum-app-version check so a breaking change can force an update.

### Phase 4: Multi-store core (largest)
- [ ] `stores` collection (plan, trialEndsAt, owner, subdomain, status, brand and theme).
- [ ] Data kept per store (sub-collections) so a query can never cross stores; the store is picked from the web address.
- [ ] Per-store config from the record instead of `merchants/<id>/merchant.json` (keep the file as the seed and for tests).
- [ ] Photo paths and signed links per store; tokens carry the store; rate limits per store.
- [ ] Move Bhakti in as store 1 on the Pro founder plan with a migration script and no downtime; keep the old service working until cut-over.
- [ ] Cross-store isolation tests; per-store data export (restoring one store from a shared database is harder).

### Phase 5: Subdomains
- [ ] Wildcard DNS and wildcard certificate; Google Cloud load balancer in front of Cloud Run.
- [ ] Reserved names (`www`, `console`, `api`, `app`, `admin`, ...) and the 3 to 30 character rule.
- [ ] `bhakti.antarixs.com` live; the old `run.app` address and installed apps keep working.

### Phase 6: Instant signup and trial start
- [ ] Antarixs entry app: Create your store, Sign in (no store picker).
- [ ] Creating a store starts the 14-day trial, creates the owner admin, logs the owner in and shows the share link.
- [ ] Owner email and phone checks; one trial per phone and email; anti-abuse limits.
- [ ] The Master Provisioning Key stays for Antarixs support only.

### Phase 7: Trial lifecycle
- [ ] Daily scheduled job (Cloud Scheduler) and reminders at days 7, 3 and 1.
- [ ] End-of-trial lock; nothing deleted; restore on upgrade.
- [ ] Clear warning before a store's behaviour changes, and the downgrade rules from plan.md.

### Phase 8: Antarixs console (`console.antarixs.com`)
- [ ] Behind Google Identity-Aware Proxy, only Antarixs Google accounts.
- [ ] Stores list with plan, trial end, owner contact, users, categories, photos, last activity, orders.
- [ ] Set plan, extend trial, suspend and resume; activity feed across all stores; per-store audit log.
- [ ] Cloud health and cost from Cloud Monitoring and billing data.
- [ ] Limit what staff can see of buyers' personal data; mention it in the privacy text.

### Phase 9: Notifications
- [ ] WhatsApp message to the store's admin number for every new order (utility template).
- [ ] Push notifications to admins on new orders (Firebase, per-store `google-services.json`).
- [ ] Per-store admin numbers in config, not in code.

### Phase 10: Android app add-on
- [ ] App request flow in the console; per-store build from the existing pipeline (name, icon, app ID from the store record).
- [ ] Publishing route from Phase 0; signing keys kept out of the repo; privacy and support URLs; in-app account deletion.

### Phase 11: Payments (last)
- [ ] Razorpay subscriptions for Pro and the Android add-on, upgrade and downgrade, invoices, failed-payment handling.

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

## Stage 3: Multi-merchant (superseded 2026-10-04 by the SaaS roadmap above)
Free stores are created instantly on one shared service (SaaS Phases 4 to 6), so the per-merchant provisioning script and deploy-to-all are only needed for a possible dedicated-deployment tier for large Pro customers.
- [ ] (Optional, later) `scripts/provision-merchant.ts` for a dedicated deployment.
- [ ] (Optional, later) Deploy-to-all with health-check gates for dedicated deployments.
- [ ] Per-store native build automation (name, icon, app ID per store): see SaaS Phase 10.

## Stage 4: Google Play release
- [ ] Signing key and Play App Signing, privacy policy, store listing, data-safety form.
- [ ] Internal testing track first, then closed/open testing, then production.
- [ ] Pre-launch pass: full tests, real-device run, rollback plan.
- [ ] iOS later: needs an Apple developer account; Apple restricts template apps, so likely each merchant publishes under their own account.

## Later
- [ ] Buyer OTP, self-service sign-in, merchant onboarding and billing are now SaaS Phases 2, 6 and 11 above.
- [ ] Still open: admin two-factor sign-in (WhatsApp OTP or authenticator), staff permissions, data export and delete, terms and privacy templates.

## Known gaps
- [ ] Admin 2FA was a mock and has been removed; admin sign-in is email + password only. Buyer password reset disappears once buyers use WhatsApp OTP (SaaS Phase 2).
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
- [x] Tenancy: one shared service with data kept per store (decided 2026-10-04); dedicated deployments only later for large Pro customers.
- [x] Plans: Basic and Pro, 14-day Pro trial, WhatsApp OTP login on both, payments last (decided 2026-10-04).
- [ ] Google Play route for per-store apps (policy risk): see SaaS Phase 0.
- [x] Wildcard domain: Google Cloud load balancer (decided 2026-10-04).
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
