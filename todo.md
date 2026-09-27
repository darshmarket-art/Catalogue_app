# To do

## You (needs your action)
- [ ] Rotate every password and key that was ever in the repo (old admin/retailer passwords, old master key). They remain in git history on GitHub. Consider making the repo private.
- [ ] Confirm the first admin exists on the live site (role **Owner**); create it with your Master Provisioning Key if not. Read the key back with `gcloud secrets versions access latest --secret=master-provisioning-key`.
- [ ] **Set up photo storage on the live service** (photo upload does not work until this is done): create the bucket and set `STORAGE_BUCKET`, using the "Photo storage" commands in `DEPLOY_TO_CLOUD_RUN.md`. Optionally upload `merchant.json` to the bucket.
- [ ] Add Firestore TTL policies on `expireAt` for `sessions` (2 days), `productViews` and `activityEvents` (90 days).
- [ ] Schedule Firestore backups (or enable point-in-time recovery) and add Cloud Monitoring alerts (5xx rate, latency).
- [ ] Add products and categories on the live site (demo data is off in production).
- [ ] Check the GitHub Actions run for the latest push.

## Next up: Phase 3, provisioning and releases
- [ ] One script that sets up a new merchant end to end: service, Firestore, bucket, secrets, Cloud Run service, first Owner.
- [ ] Deploy-to-all with checks: build once, roll out to every merchant, stop if a health check fails.
- [ ] Versioned API so older installed apps keep working after an update.
- [ ] Clean up unused photos in buckets (files stay when a product is deleted or re-photographed).

## Later phases
- [ ] Phase 4: PWA, then Capacitor apps (camera, push, share, biometric), per-merchant icon/name/bundle id, in-app account deletion, privacy/support URLs.
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
- [ ] Capacitor vs full rewrite for the store apps.
- [ ] One Google Cloud project per merchant vs shared project with a service and database per merchant.
- [ ] Store accounts: merchant-owned developer accounts vs one shared hub app.

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
