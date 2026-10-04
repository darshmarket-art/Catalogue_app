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

## Decisions applied on top (2026-10-05)
1. **One admin per store, every plan.** Emergent's add / remove / reset-another-admin routes, screen, hub tile and menu entry were removed (`/api/admin/admins` is 404). An admin can still change their own password, sign in with "keep me signed in", and reset a forgotten password with a WhatsApp code.
2. **Buyer sessions are 7 days, fixed.** Not renewed on use, so the code is asked again after a week (admins with "keep me signed in" keep their sliding month; the phone app keeps 90 days).
3. **Buyer sign-in: code first, name only for a new number.** `verify-otp` answers `needs-name` for an unknown number without creating anything (the code stays valid); the screen then asks "What should we call you?" and submits the same code with the name. A returning buyer goes straight in. The name becomes the buyer's name for the admin.
4. **No install prompts or manifest** (Emergent's rule, kept): the profile menu has no "Install app"; home-screen apps come from the native builds.
5. **The four tests Emergent left failing were checked against the code and updated to the new behaviour** (`failedtest.md` removed):
   - `no random HUID...` and `keeps a HUID...`: a design now has a price mode (`by-weight` default, `fixed` with a `price`, or `on-request`); `price` is kept only in fixed mode, a fixed design without a price is a 400, making charges are dropped.
   - `products carry no price` (phase2): same rule.
   - `7 days on the web`: passes again because buyer sessions are back to 7 days.
   - A fifth failing test (`test alert...`) was stale: the alert result now also carries the WhatsApp `messageId` used for delivery receipts.

## Also new from Emergent that was not on the first list
- **Price modes and server-side catalogue search**: a design can be "by weight", "fixed price" or "price on request"; the Catalogue screen has search, filters (purity, weight, price mode, availability) and sorting, done on the server (`GET /api/products?search=&purity=&minWt=...`).
- **Photo thumbnails**: the server can serve resized WebP thumbnails (`sharp`, `/media/:file?w=`). The planned "make cover" and move-left/right buttons on photo tiles are not built yet (see `docs/EMERGENT_TODO.md`).

## Checked
- `npx tsc --noEmit` clean; `npx vitest run`: 28 files, 271 tests pass; `npm run build` (client and server) succeeds.
- Not yet checked in a browser, and not deployed. Pushing `main` deploys to production.
