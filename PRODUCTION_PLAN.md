# Production plan: ready to sell

Goal: a merchant who is not us can buy, get set up in a day, use it safely, and get support, without a developer touching their data by hand.
Built on `plan.md` (architecture and decisions) and `todo.md` (open items). This file only orders the work into gates.

**Rule:** do not start selling to a phase's customers until the gate at its end passes.

---

## Phase A: Make the first merchant (Bhakti) truly live (1 week)
Nothing else matters if the pilot isn't solid. This clears the "You" list in `todo.md`.

| # | Step | Done when |
|---|---|---|
| A1 | **Rotate every secret** that was ever in git history (admin/retailer passwords, master key, JWT secret). Make the GitHub repo **private**. | Old values no longer work |
| A2 | Create photo bucket, set `STORAGE_BUCKET`, upload `merchant.json` | Upload a photo on the live site and see it after reload |
| A3 | Confirm the first **Owner** exists; add real categories and products (`scripts/bulk-import-products.mjs` helps) | Owner can log in on a phone |
| A4 | ~~Firestore TTL policies~~ (already active, checked 2026-09-30) | Done |
| A5 | Daily Firestore backups exist (7-day retention). Raise retention to 14-30 days and **test a restore** | Restored copy opened successfully once |
| A6 | Monitoring: uptime check on `/health`, alerts for 5xx and latency, error-log alert, billing budget alert | Alert email received from a test |
| A8 | **Delete the `catalogue-app-v2` Cloud Run service.** It holds a Gemini API key in plain-text env vars: rotate/revoke that key | Service gone, old key revoked |
| A9 | Turn on **bucket versioning** (the deploy doc says it is on; it is not) with a rule that deletes old versions after ~30 days | `gcloud storage buckets describe` shows versioning enabled |
| A10 | Disable unused APIs (Pub/Sub, Generative Language, appoptimize, etc.); add an Artifact Registry cleanup policy for old images | API list is only what the app uses |
| A11 | Cloud Run: raise max instances 3 to ~10; decide on min instances = 1 (about INR 700/month) to avoid slow first loads | Settings applied |
| A12 | Move production to a **dedicated Google Cloud project and billing account** (today it is a `gen-lang-client-...` project under a work account) | Production runs in its own project |
| A7 | Commit the pending `package.json` / `scripts/` work; check the GitHub Actions run is green | CI green on `main` |

**Gate A:** Bhakti runs a full week with real buyers, orders arrive, no manual fixes.

---

## Phase B: Product must-haves before charging money (2-3 weeks)
Things a paying merchant will hit in week one.

1. **Self-service password reset** (WhatsApp/SMS OTP or email link). Today the Owner resets by hand. Also sign out open sessions on reset (known gap).
2. **Admin login hardening**: real 2FA for Owner/staff (authenticator app is cheapest; no SMS cost), lockout after repeated failures.
3. **Staff permissions**: what staff can/cannot do (prices, deletes, buyer reset). Roles exist; permissions do not.
4. **Data rights**: export a buyer's data, delete a buyer's data, delete-account button (also an app-store requirement).
5. **Legal pages per merchant** from templates: terms, privacy (must mention engagement tracking), refund/contact. Link from the app and signup.
6. **Photo optimisation (top cost item, see the Cost model)**: reverses the "no resizing" decision in `plan.md`.
   - Phone shrinks each photo before upload (long side ~2000 px, JPEG quality ~85, ~400-800 KB).
   - Server (`sharp`, already installed) makes a ~400 px thumbnail for grids and a ~1200 px version for the detail view; the uploaded file is kept in the bucket.
   - App only receives the small versions through the same signed links; browser caching stays.
   - Test on 4G. Update `plan.md` and the deploy doc when done.
7. **Order safety**: order confirmation email/WhatsApp to the merchant so nothing is missed; order status changes visible to buyer.
8. **Session token in a secure httpOnly cookie** instead of `sessionStorage`.
9. **Shard the `dailyStats` counter** only if load tests show a problem.

**Gate B:** security review passes (see Phase D checklist), Bhakti signs off on the flows above.

---

## Phase C: Repeatable delivery (2-3 weeks): this is "Phase 3" in `plan.md`
Selling means setting up merchant #2, #3, #10 without heroics.

1. **One provisioning script**: `provision-merchant <id>` creates project/service, Firestore, bucket, secrets, Cloud Run service, first Owner, and prints the login. Idempotent, dry-run mode.
2. **Deploy-to-all with checks**: build once, roll out merchant by merchant, run `/health` and a smoke test, stop on first failure, one command to roll back.
3. **Staging environment** (a "demo" merchant) that every release hits first.
4. **Versioned API** (`/api/v1`) so installed mobile apps survive updates.
5. **Decide and document**: one Google Cloud project per merchant vs shared project. With ~100 buyers per merchant, **recommend a project per merchant on the merchant's own billing account, with us kept as admin**: each gets its own free allowance, our cost stays near zero and a busy merchant cannot put us at a loss. Shared project is the fallback if we host and pay.
6. **Merchant onboarding checklist**: brand config, colours, logo, sector pack, domain, first products, training.
7. **Clean up orphaned photos** in buckets (lifecycle rule or script).
8. Rename the package (`bhakti-jewels-catalogue`) and remove any leftover merchant-specific wording in shared code (already a rule in `plan.md`).

**Gate C:** a person who did not write the code onboards a fresh test merchant from the checklist, using only the docs, in under a day.

---

## Phase D: Quality and security proof (runs alongside B and C)
- **Tests**: keep `npm test` + `lint` as CI blockers. Add end-to-end browser tests for the 5 critical flows: signup, login, browse, place order, admin sees order. Add a restore/permissions test per role.
- **Security review**: run `/security-review`; check OWASP basics: authorisation on every route (buyers can only see their own orders/photos), upload checks, rate limits, dependency audit (`npm audit`) in CI, secrets only in Secret Manager, no secrets in logs.
- **Load test** one merchant (e.g. 100 concurrent buyers) to confirm Cloud Run min/max instances and Firestore limits.
- **Error tracking** (Sentry or Cloud Error Reporting) with a merchant tag.
- **Cost model**: measure Cloud Run + Firestore + storage per merchant so pricing has a margin.

---

## Phase E: Sellable business layer (3-4 weeks)
1. **Pricing and billing**: setup INR 50-70k (aim ~60k) + yearly AMC 30%, **AMC floor INR 20k/year** (30% of 50k = 15k leaves too little after ~6k cloud cost). Fair-use limits in the agreement: up to ~150 buyers, 3 photos per product, ~5,000 products, ~20 GB photos; above that a surcharge or the merchant's own cloud billing. Store-app publishing, new features, extra merchants and custom sector packs are billed separately. Manual invoices are fine for the first 5-10 merchants; add Razorpay/Stripe subscriptions after.
2. **Merchant agreement + SLA**: uptime promise, support hours, data ownership, what happens when they leave (export + delete).
3. **Support process**: a support email/WhatsApp, a shared issue list, response times, an owner-facing help/FAQ page.
4. **Landing page / demo**: a public demo merchant (fake data) and a one-page pitch with screenshots.
5. **Merchant self-serve admin** (only if onboarding volume demands it): sign-up form that triggers the provisioning script.

**Gate E:** 2-3 pilot merchants onboarded through the process, paying or committed.

---

## Phase F: Store apps (Android + iOS) with Capacitor (no PWA step)
Decision: real store apps built with **Capacitor** around the existing React front end. The Cloud Run backend stays as it is; the apps call the same API. A full rewrite (React Native/Flutter) is not planned.

Phone app (Play Store / App Store) -> HTTPS -> Cloud Run -> Firestore + Cloud Storage

| # | Step | Done when |
|---|---|---|
| F1 | **API base URL config**: the app calls the full Cloud Run/custom-domain URL instead of `/api` (one setting in `src/api.ts`); allow the app origins in server CORS | Same build works in browser and in the app |
| F2 | **Versioned API (`/api/v1`) + minimum-app-version check** so old installed apps keep working or get a "please update" screen | Old build still works after a server release |
| F3 | Add Capacitor (Android + iOS projects), bundle the built front end into the app, splash screen, icon | App runs on a real phone and emulator |
| F4 | **Secure token storage** (Keychain/Keystore) instead of `sessionStorage`; biometric unlock | Login survives app restart; biometric works |
| F5 | **Native features**: camera/gallery for product photos, share to WhatsApp, **push notifications** for new orders (Firebase Cloud Messaging, free), deep links | Owner gets a push when an order arrives |
| F6 | **Per-merchant build script**: reads `merchants/<id>/merchant.json` to set app name, icon, colours, bundle id, API URL; outputs a signed `.aab` and `.ipa` | One command builds merchant X |
| F7 | **Store readiness**: in-app account deletion, privacy and support URLs, data-safety forms, screenshots, test login for reviewers | Passes the store checklists |
| F8 | **Store accounts**: each merchant publishes under their own developer account (Google Play USD 25 one-time, Apple USD 99/year); we do the publishing as a paid extra. Do not plan on one shared "hub" app (Apple rejects near-identical template apps) | First merchant live on both stores |
| F9 | Release process: staged rollout, crash reporting (Firebase Crashlytics), update policy for app-shell changes | A release can be rolled back or halted |

**Notes**
- Apple can reject a thin website wrapper ("minimum functionality"). F4 and F5 (native features) are what avoid that; do not skip them.
- Server changes reach installed apps immediately; a store release is only needed when the app shell changes.
- Building the iOS app needs a Mac (or a cloud Mac build service such as Codemagic or Xcode Cloud).
- F1, F2 and F4 are also good hardening for the web version, so start them in Phase B/C.
- Store fees and publishing help go into the merchant agreement (Phase E) as separate items.

---

## Cloud audit and cost model (checked 2026-09-30)

**Current services** (project `gen-lang-client-0273003651`, asia-south1): Cloud Run `catalogue-app` (1 vCPU, 512 MB, max 3 instances, no min), Firestore Native (daily backups, TTL active, point-in-time recovery off), one private bucket (7-day soft delete, versioning off), Secret Manager (2 secrets), Cloud Build trigger on `main`, Artifact Registry. No alert policies.

**Verdict:** the stack (Cloud Run + Firestore + Cloud Storage + Secret Manager) is right for this scale; do not move to Cloud SQL or Kubernetes. Fix the items A8-A12 and the photo optimisation.

**Cost per merchant, ~100 buyers, half active daily, 50 photos viewed each** (estimates at INR 87 per USD; confirm in the Google pricing calculator):

| Setup | Photo traffic / month | Cloud cost / month |
|---|---|---|
| Today, full-size originals (~3 MB) | ~225 GB | ~INR 2,300 (about INR 28k/year, more than the whole AMC) |
| Thumbnails (~40 KB) + resized photos (~250 KB) | ~8-15 GB | ~INR 0 (inside free allowance) |
| Everything else (Cloud Run, Firestore, bucket, secrets, logs, registry) | | ~INR 300-600, plus ~INR 700 if a min instance is kept |

At 1,000 buyers a day per merchant the photo fix plus a CDN keeps cost around INR 2-4k/month, which the AMC does not cover: charge by usage or use the merchant's own billing account.

**Rules:** the AMC pays for support, fixes and updates, not for cloud usage; always have a billing budget alert; re-run this check after any change to photo handling.

## How we execute (small team + Claude agents)

**What an agent is:** a helper Claude session started for one task (build a feature, review a diff, run checks). It works in this project's files, reports back and ends. It does **not** stay alive when your computer is off, and it does not wake up on its own. Anything that must run 24/7 is ordinary automation, not an agent.

| Layer | What it is | Runs when |
|---|---|---|
| **You** | Decides, approves, holds the accounts (Google Cloud billing, GitHub, store accounts) | - |
| **Coordinator** (the main Claude session) | Breaks a phase into tasks, starts helper agents, merges results, updates this plan | While a session is open |
| **Builder agents** | One per task (e.g. photo thumbnails, `/api/v1`, provisioning script), each in its own git worktree so they don't clash | Started by the coordinator, end when done |
| **Reviewer/tester agents** | Code review, security review, test writing, browser checks on every builder's work before merge | Same |
| **Always-on automation (no agent needed)** | GitHub Actions (lint, tests, audit on every push), Cloud Build (deploy on `main`), Cloud Scheduler (backups), Cloud Monitoring (uptime, 5xx, latency, budget alerts by email/WhatsApp) | 24/7, even with every computer off |
| **Scheduled agent (optional)** | A weekly "health and progress" routine using the `/schedule` feature: reads this plan and repo, checks CI and (with a read-only Google role) the cloud services, and sends a short status report | On its schedule, in the cloud, computer can be off |

**Cloud communications / on-track owner:** one scheduled "release manager" routine plus the alerts above.
- Alerts (Monitoring) tell you immediately when something breaks. Deterministic checks are more reliable than an agent for this.
- The weekly routine reports: plan items done/blocked, CI status, cost vs budget, backup age, open security findings, and stale items.
- Give it a **read-only** Google role only. It never deploys, changes IAM or touches secrets; deploys stay behind Cloud Build on `main`.

**Rules**
1. Agents write code and docs; **you approve anything outward-facing**: pushes to `main`, secret rotation, IAM/billing changes, store submissions, messages to merchants.
2. Every task ends with tests passing and a reviewer pass; UI changes are checked in a real browser.
3. Only the coordinator edits this plan; status lives in the tables above and in `todo.md`.
4. Some steps cannot be delegated because they need your identity: A1 (rotate secrets, make repo private), A12 (billing account), store developer accounts (F8), signing keys, legal sign-off.

**Suggested first run (parallel, low risk):** photo optimisation (B6), `/api/v1` + API base URL (F1, F2), Cloud Run/bucket fixes (A9-A11, scripted for you to approve), monitoring and budget alerts (A6), provisioning script draft (C1). Then reviewer agents on each.

## Second sector
Build the second sector pack (e.g. clothing with payment gateway) before merchant #4, to prove the "template" claim. Move jewellery wording still in shared screens (catalogue filters, quotation labels) into the pack at that point.

---

## Suggested order and rough timeline
```
Week 1        A  (pilot live, secrets, backups, alerts)
Weeks 2-4     B  (reset, 2FA, permissions, legal, thumbnails)   + D starts
Weeks 4-6     C  (provisioning, deploy-to-all, staging)         + D continues
Weeks 6-9     E  (pricing, agreement, support, demo)
Week 9+       first paying merchants
Weeks 9-14    F  (Capacitor store apps; F1/F2/F4 can start earlier)
Later         second sector
```

## Decisions needed from you
1. Pricing model: one-time setup fee + monthly, or monthly only?
2. Who owns support (you, or a person you hire)?
3. Target first customers: more jewellers only, or a second sector soon?
4. Shared Google Cloud project vs one per merchant (recommendation in C5).
5. Which 2FA/OTP channel: authenticator app (free), WhatsApp/SMS (per-message cost)?
