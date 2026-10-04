# Emergent workspace changes, brought into the Catalogue app

Source: the Emergent VS Code workspace `/app` (repo `darshmarket-art/app`, branch `main`, HEAD `a480800`) plus 30 uncommitted files from its working copy (bundle `emergent_changes.tgz`, 2026-10-05).
That repo was seeded from this one (it contains our latest commits) and then extended by the Emergent agent in four commits ("Phase 1", "Phase 2", a checkpoint, a phase map) and the uncommitted work. The two histories are unrelated in git, so the changes were brought over file by file: every file the Emergent side changed or added was taken from it; everything else stays as on `main` (`96f599e`). Emergent scaffolding (`.emergent/`, `backend/`, `frontend/`, its README, `memory/`, `plan/`, `test_reports/`, `test_result.md`) was left out. Its roadmap is kept as `docs/EMERGENT_TODO.md`.

## What is new

**WhatsApp**
- Live WhatsApp OTP delivery (env-driven; the static code still works while Meta is not set up): `server/whatsapp.ts`, `scripts/whatsapp-check.ts` (checks the Meta number and quality rating).
- Delivery receipts: Meta status webhook `GET/POST /api/webhooks/whatsapp` (verify handshake, `X-Hub-Signature-256` over the raw body, timing-safe compare; 404 until `WHATSAPP_APP_SECRET` and `WHATSAPP_WEBHOOK_VERIFY_TOKEN` exist). Message log `server/messages.ts` (sent / delivered / read / failed, 90-day retention).
- Buyer code screen shows live delivery status (`DeliveryStatus.tsx`, `GET /api/auth/otp-status/:id`).
- Admin "Messages" screen (`AdminMessagesScreen.tsx`, `/api/admin/messages`): status pills, failed filter, masked phones, error details.
- Admin "WhatsApp alerts" screen (`AdminAlertsScreen.tsx`, `/api/admin/alerts`): up to 3 alert numbers, test alert, wording preview.

**Catalogue full, and insights**
- Catalogue-full buyer screen (`CatalogueFullScreen.tsx`) when a Basic store is at its buyer limit; a daily turned-away counter and a once-a-day owner nudge (`server/storeFull.ts`), with a nudge on the Plan screen.
- Insights dashboard for Pro (`AdminInsightsScreen.tsx`, `GET /api/analytics/insights`, `server/insights.ts`): top designs and collections, 8-week trend, shortlist totals, buyer activity, delivery rate, plain-English weekly summary.

**Admin accounts and sessions**
- Admin management (`AdminAdminsScreen.tsx`, `/api/admin/admins`): list, add (temporary password, forced change), remove (never the last one), reset a colleague's password.
- Admin "Change password" screen and `POST /api/auth/admin/change-password`.
- "Keep me signed in" for admins and sliding web sessions (`ADMIN_REMEMBER_TTL` 30 days; buyer web token 30 days, renewed on each visit).

**Store setup and sharing**
- Trial banner (`TrialBanner.tsx`), store share sheet (`StoreShareSheet.tsx`, `src/storeLink.ts`), a dev OTP hint (`DevOtpHint.tsx`), jewellery sector and sales tweaks (`shared/sales.ts`, `shared/jewellery.ts`, `server/sectors/jewellery.ts`).
- Seed scripts for local demos: `scripts/seed-demo-store.ts`, `scripts/seed-full-store.ts`.
- PWA install prompts removed on purpose (`src/install.ts` is no longer imported; the service worker stays for push and offline).
- Tests: `tests/phase1.test.ts`, `tests/phase4.test.ts`, `tests/whatsappOtp.test.ts`, updated `tests/phase2.test.ts`.

## Where this disagrees with decisions made on the Catalogue side (needs a call)
1. **One admin per store.** The decision here was one admin account on every plan. The Emergent work lets a store add and remove admins (`/api/admin/admins`). `POST /api/auth/admin/register` still refuses a second admin; the new routes do not.
2. **Buyer sessions.** The decision here was 7 days. Emergent set 30 days (`RETAILER_TOKEN_TTL`).
3. **Buyer name at sign-in.** Emergent rewrote `RetailerAuthScreen.tsx`; check that the "Your name" field added on this side is still there and still records the buyer's name.
4. **Install app.** The "Install app" item in the profile menu no longer exists (Emergent's rule: PWA install prompts are forbidden).
5. **Failing tests.** `failedtest.md` lists 4 tests Emergent left failing on purpose (stale assertions); decide whether to update them.

## Not done / still to verify
- Build, type check and tests were not run on the merged tree when this note was written.
- Nothing here has been deployed. Pushing `main` deploys to production.
