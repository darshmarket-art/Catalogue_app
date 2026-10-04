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
