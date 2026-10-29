# Live Rate app: development plan

Status: plan only, nothing built. Written 2026-10-29 against `main` at `a698878`. Revision 2 (owner decisions) applied the same day: see **§0**, which wins wherever it differs from a later section.

## 0. Decisions made by the owner (revision 2)

| # | Decision | Effect on this plan |
|---|---|---|
| D1 | **Rate source is a licensed feed that gives 24K gold.** Antarixs calculates sub-karats and silver from it. | Phase 5 (feed) moves to the core of the engine; the manual source stays as the fallback and the override. See §5. |
| D2 | **Catalogue can be web (online) or inside the customer's app. Live Rate is a dedicated installed app per customer.** | Catalogue = website *and/or* a tab set inside the app; Live Rate = installed app only (no public web board). A "Both" customer gets **one** app with both. See §6. |
| D3 | **Gold and silver bullion trade system** is in scope. | New §11 and new phases. |
| D4 | **Android first.** | iOS is out of this plan. Removes the Apple 4.2.6 risk from the schedule. |
| D5 | **Live Rate sign-up is phone number + OTP, like Catalogue buyers, and the buyer stays signed in.** | Reuses `server/routes/otp.ts`; native sessions already last 90 days (`NATIVE_TOKEN_TTL`). See §6a. |
| D6 | **Antarixs publishes every customer app on its own Google Play developer account.** | Per-customer signing and Play listings are an Antarixs operation. See §6b. |
| D7 | **Silver comes from the same feed** (not derived from gold). The licence is full-fledged. | Silver 999 is a base rate like gold 24K; silver 925/800 derive from it. Closes §10 Q1 and Q2. |
| D8 | **The Antarixs Play developer account is registered.** | Phase 5 no longer waits on account verification. Closes §10 Q8. |
| D9 | **Production sign-off is the last step.** | The §8 security fixes (static OTP and the rest) are done at the end, before the first paying customer. Until then, test apps must use test numbers only and no real customer data (see "Risk of deferring sign-off" below). |

Open questions that these answers create are in §10.

## 1. What we are building

Antarixs sells two **separate products** on one platform:

| Product | What it is | How buyers get it today |
|---|---|---|
| **Catalogue** | Collections, designs, shortlist, orders (existing code) | Website at `[store].antarixs.com`, optional APK |
| **Live Rate** (new) | The store's live gold/silver buy and sell rates, alerts, later rate bookings | A **dedicated app per customer** (their brand, their app id) |

A customer (store) is one of three types: **Catalogue only**, **Live Rate only**, or **Both**. Every part of the code must work for all three.

The Live Rate screens use the **store design** that `[store].antarixs.com` uses today: the Emergent layout (`src/layouts/emergent/`, `.em-*` classes), with the store's own colours, logo, fonts and Hindi.

## 2. Principles

1. **Two features, one platform.** Shared: tenancy, sign-in (WhatsApp OTP), buyers, branding/theme, WhatsApp and push alerts, operator console, app build. Separate: Catalogue code (as today) and new Live Rate code in its own folders and routes. Neither product imports the other.
2. **Product and plan are separate axes.** *Which products* a store has (Catalogue, Live Rate) is separate from *which plan* it is on (Basic/Pro/trial), and each product carries its own plan.
3. **No invented rates.** The codebase already removed made-up gold rates (`tests/api.test.ts:835`). A rate is shown only if it came from a configured source (feed or the owner). A rate that has stopped updating is shown as stale, never as live.
4. **Existing stores do not change.** Every current store is migrated as "Catalogue only" with its current plan; nothing moves for Bhakti or anyone else.

## 3. Product model (compatibility for the three customer types)

### Data
**Built in phase 1 (differs from the first draft below).** The Catalogue plan stays in the original top-level fields (`plan`, `trialEndsAt`, `ownApp`, `trialNotice`), so no store record, console screen, trial sweep or stat had to change and no migration is needed. The new fields are `products?: ('catalogue'|'liveRate')[]` (absent = Catalogue only) and `liveRate?: { plan; trialEndsAt? }`. Helpers: `shared/products.ts`; per-product entitlements: `makeEntitlements` returns `products` and `liveRate`. Original draft, kept for reference:

`StoreRecord` (`server/tenancy.ts`) gains:

```ts
products: {
  catalogue?: { plan: Plan; trialEndsAt?: string };
  liveRate?:  { plan: Plan; trialEndsAt?: string };
}
```

- At least one product must be set.
- The current top-level `plan` / `trialEndsAt` / `ownApp` become `products.catalogue`. The migration is a one-off script in the style of `scripts/migrate-multistore.ts`, and reads stay backward compatible: a record without `products` = `{ catalogue: <old plan fields> }`.
- `planOf()` and `effectivePlan()` (`server/entitlements.ts`) take a product: `effectivePlan(record, 'liveRate')`.

### Flags and limits
- `shared/limits.ts`: `flagsFor(plan)` becomes `catalogueFlags(plan)` (unchanged content), plus new `liveRateFlags(plan)` and `LIVE_RATE_LIMITS`. Examples: number of rate rows, buyers, rate alerts per buyer, bookings on/off, history days.
- `/api/entitlements` returns `{ products: { catalogue?: {...flags, limits}, liveRate?: {...} } }`. The client's `usePlan()` (`src/plan.ts`) exposes `has('liveRate')` and per-product flags.

### Server gating
- New middleware `requireProduct('liveRate' | 'catalogue')`. It returns **404** when the store does not have that product, so the product looks absent rather than locked. Plan limits inside a product keep the existing **402** "upgrade" answer.
- Mount Catalogue routes (`catalogueRoutes`, shortlist, orders, enquiries, PDF, photos upload) behind `requireProduct('catalogue')`. Mount `/api/rates/*` behind `requireProduct('liveRate')`.
- Shared routes stay ungated: auth/OTP, about, brand logo, buyers, alerts, push, messages, app build.
- Update `tests/api.test.ts:835`: `/api/rates` is 404 for a Catalogue-only store and 200 for a Live Rate store.

### Client gating
- `App.tsx` builds its screen list from products. The `memberScreens` list (`App.tsx:724`) and the screen guards (`App.tsx:730-736`) get a product check alongside the flag checks.
- `BottomNav` (`src/layouts/emergent/BottomNav.tsx`) picks tabs by product:

| Store has | Buyer tabs | Owner tabs |
|---|---|---|
| Catalogue | Home, Catalogue, Shortlist, Orders (today) | Today, Orders, Catalogue, Buyers (today) |
| Live Rate | Rates, Alerts, Updates, Contact | Rates desk, Bookings*, Buyers, Store |
| Both | Rates, Home, Catalogue, Orders (Shortlist moves into Home/profile) | Today, Rates desk, Orders, Catalogue (Buyers under Store) |

\* Bookings only once phase 6 ships.

- The landing screen follows the product: Live Rate stores open on the rate board, Catalogue stores on Home.

### Sign-up and console
- Sign-up (`server/routes/signup.ts`, `SignupScreen.tsx`) adds a step "What do you need? Catalogue / Live Rate / Both". The trial starts per chosen product.
- The operator console can add or remove a product on a store and set each product's plan.
- The platform pages (`/welcome-antarixs`, How it works, pricing) present the two products and the bundle.

### Tests
Add one test matrix, run for each of the three store types: which routes answer 200/402/404, which tabs render, which entitlements come back. Add it next to `tests/entitlements.test.ts` and `tests/multistore.test.ts`, plus a Playwright pass in `tests/e2e/screens.ts`.

## 4. Live Rate features

### MVP (buyer)
- **Rate board.** The owner's rows, for example "Gold 24K 999 (10 g)", "Gold 22K 916 (10 g)", "Silver 999 (1 kg)", "Gold coin 10 g". Each row shows buy and sell, change since open, day high/low, and an up/down flash.
- **Market status pill:** Live / Paused by store / Market closed / Rates not set / Connection lost. Show a "last updated hh:mm:ss" time on every row; after N seconds without updates the board turns **stale** (greyed, labelled).
- **Updates:** owner announcements (text, optional photo) and a market-hours notice.
- **Contact:** WhatsApp/call the desk, bank details for payment (owner-entered), address. This reuses About.
- **Rate alerts:** "tell me when Gold 999 sell ≤ ₹X". Delivered as native push (see §6), with WhatsApp as a fallback where templates allow.
- **Disclaimer line:** indicative rates; the confirmed rate is on the dealer's invoice. The owner can edit the wording; legal review is needed.
- **Access:** store setting `rateAccess: public | login`. Many dealers show rates publicly and gate booking. This mirrors the existing `catalogueAccess`.

### MVP (owner: "Rates desk")
- **Rate rows:** name, metal, purity factor, unit (1 g / 10 g / 1 kg / piece), buy and sell premium or discount (₹ or %), rounding (₹1 / ₹10), display order, on/off.
- **Source per store:** **Manual** (the owner types base rates; MVP) or **Feed** (phase 5).
- **Controls:** quick override of any row, **Pause rates** (one tap; buyers see "Paused"), market hours and holidays, broadcast an update.
- **History:** today's ticks and the daily open/high/low/close, for the owner and for buyer charts later.

### Later
- **Rate booking** (phase 6): a buyer requests "book 100 g at ₹X". The rate is locked for N seconds, and the owner confirms or rejects on the desk with a WhatsApp/push alert. It reuses the order pipeline concepts (`server/routes/orders.ts`, `notify.ts`) but is a separate collection (`rateBookings`).
- Charts (1D/1W/1M), home-screen widget, multiple branches with different premiums.
- **Both-products link:** a design in the catalogue shows an *indicative* price from its net weight × the live rate. This is optional and owner-switchable, and it depends on deciding price modes. The orphaned comment at `shared/jewellery.ts:16` is where price modes were meant to live.

## 5. Rate engine (how rates get to phones)

### Pricing
- Base rate per metal (INR per gram, held as integer **paise per gram** to avoid float errors).
- Row rate = `round(base × purityFactor × unitGrams + premium, rounding)`, computed separately for buy and sell.
- This is pure functions in `shared/rates.ts`, unit-tested heavily (rounding, negative premium, % vs ₹, zero/absent base → "not set").

### Sources (revision 2)
- **Licensed feed (primary).** Antarixs already holds a licence. The feed supplies **24K gold (999)**. The engine derives everything else:
  - **Gold sub-karats:** `rate(purity) = rate24K × fineness`, with a table: 24K 999 (1.000 of the 999 base, quoted as the base itself), 22K 916 (0.916/0.999), 20K 833, 18K 750, 14K 585 and any purity the owner enables. `server/purities.ts` and `shared/jewellery.ts` already hold the owner's purity list, so the rate rows reuse those keys.
  - **Silver:** comes from the same feed (D7). Silver 999 is the base and 925/800 derive from it the same way gold karats derive from 24K.
  - **Licence:** full-fledged (D7), so it covers showing rates in each customer's app with the customer's margin added. Keep a copy of the licence terms in the repo's private docs, not in git.
- **Per-store pricing on top of the base** (the "margin"): each store sets its own buy/sell premium or discount per row (₹ or %), rounding, and an optional **spread lock** so a store can never show sell < buy. The base is shared, the display rate is per store.
- **Manual (fallback and override):** the owner can type a base rate when the feed is down, or override a single row. A manual override is labelled as such on the owner desk and expires on its own at a time the owner sets, so a forgotten override cannot go stale silently.
- The engine keeps one interface (`RateSource { subscribe(onTick) }`) so the vendor can be replaced. Contract tests use a recorded feed file.
- **Integer money:** base held as integer paise per gram; derived rates use integer maths with one documented rounding rule, tested against worked examples the owner supplies (the owner knows what a correct 22K rate on a given day looks like).

### Architecture

```
Vendor feed ──► rate-feed service (Cloud Run, min-instances=1, always on)
                    │ base ticks (throttled, e.g. ≤ 1/s per metal)
                    ▼
              Redis pub/sub (Memorystore)  ◄── manual owner edits also publish here
                    │
                    ▼
   catalogue-app API instances ──► SSE /api/rates/stream ──► buyer apps / web
   (per-store rows computed in memory from base + that store's row settings, cached)
                    │
                    ▼
   Firestore: rateState snapshot (every few seconds, on change), 1-min OHLC history, settings
```

- **SSE (Server-Sent Events) over WebSockets.** It is one-way (exactly what a rate board needs), plain HTTP, works through the existing load balancer and Cloud Run, and auto-reconnects. Set the Cloud Run request timeout to the maximum. The client reconnects with `Last-Event-ID` and on app resume (`@capacitor/app`).
- **Never write each tick per store to Firestore.** Cost and write limits make that unworkable. Ticks live in memory/Redis, and Firestore gets snapshots and minute bars.
- **Manual-only MVP shortcut:** before Redis exists, each API instance can watch the Firestore `rateState` doc (`onSnapshot`) and push to its SSE clients. That is enough for owner-typed rates and lets phases 2-4 ship without new infrastructure.
- **Staleness:** every message carries `asOf`. The client marks the board stale after a store-set threshold. The server raises an operator alert when the feed is silent during market hours.
- **Scale check before launch:** a load test with N concurrent SSE connections per instance, and setting `--concurrency` / max instances from the result.

### New code (separate from Catalogue)
- `server/rates/`: `engine.ts`, `sources/manual.ts`, `sources/<vendor>.ts`, `routes.ts` (`/api/rates/board`, `/api/rates/stream`, `/api/admin/rates/*`, `/api/rates/alerts`).
- `shared/rates.ts`: pricing math and types, shared with the client.
- `src/rates/`: screens and hooks (`useRateStream`).
- A separate deployable `rate-feed/` service in phase 5. Its entry point is in this repo and it gets its own Dockerfile target.

## 6. A dedicated app for every customer (revision 2: read 6a and 6b first)

### 6a. Who can use the app: phone + OTP, stays signed in
- A buyer opens the customer's app, enters their phone number, gets a WhatsApp OTP, enters their firm name on first sign-in, and is in. This is the existing buyer flow (`server/routes/otp.ts`, `needs-name` step), scoped to the store, so the same buyer list serves Catalogue and Live Rate.
- **Stays signed in:** native clients already get a 90-day token (`NATIVE_TOKEN_TTL`, header `x-app-client: native`). To make "stays logged in" real: refresh the token on every app open (sliding window), keep it in `@capacitor/preferences` (add Android secure storage if we hold booking data), and sign out only on explicit logout, owner removal of the buyer, or a store-side "sign out everyone".
- **Does the owner approve new buyers?** Today any phone can register on a login-gated store, up to the plan's buyer limit. For a trade app (rates and bookings) owners will want **approve-before-access**. Plan: a store setting `buyerApproval: off | on` that parks a new buyer as "Waiting for approval", with an owner alert. Default `off` to match today's behaviour. See §10 Q5.
- **Blocking and removal:** owner can block a buyer; blocked buyers' tokens stop working on the next call, and the stream disconnects.
- **OTP provider:** the app needs a real provider before launch. The static production code is the first blocker in §8.

### 6b. Antarixs publishes on its own Google Play account
- **One Antarixs Play developer account, many apps** (`com.antarixs.<store>`). This is allowed, but Play's *repetitive content / spam* and *impersonation* policies target near-identical apps and apps that use a brand the publisher does not own. Mitigations:
  - Each app has a real distinct brand (name, icon, colours, screenshots) generated from the customer's `merchant.json`.
  - Keep **written authorisation** from each customer to publish their brand, and a customer contact in the store listing.
  - Expect Play review for each new app; allow days, not hours. Keep an appeals contact.
  - Account type: an **organisation** account (needs a D-U-N-S number and verification). A new personal account must run a closed test with testers for a minimum period before production; check Google's current rule when you register.
- **Release engineering (one pipeline for all customers):**
  - Upload keys and signing: let **Play App Signing** hold the app signing key; keep the per-app *upload* key as an encrypted secret (a keystore per app, backed up offline).
  - Extend `.github/workflows/android.yml` with `bundleRelease` (AAB), `versionCode` from the run number, upload to the Play Developer API (internal track → closed → production), and a manual approval step before production.
  - Play listing generated from `merchant.json`: title, short and full description, icon (existing adaptive icon code), feature graphic, screenshots (Playwright can capture them from a seeded store), privacy URL (the store's `/privacy` from `server/legal.ts`), data-safety form answers.
  - **Declarations:** Data safety (phone number, name, device ID for push), and the *financial features* declaration if bookings or trading are in the app. Check which category applies before the first submission.
  - Updates: one version bump rolls a new AAB for every customer app, staged rollout, and `minAppVersion` (already in `/api/app-config`) forces upgrades only when needed. Because Antarixs controls Play, the "APKs are sideloaded, users update manually" caveat in `docs/android-addon.md` no longer applies.
- **Per customer on-boarding:** owner presses "Get my app" → authorisation tick-box and brand check → build and submit → status shown in the app (Requested / In review / Live with the Play link). The console shows every customer's app status, version and last release.
- **Cost and capacity:** each Play release for N customer apps is N uploads; the pipeline must run them in parallel with a failure report per customer (one broken customer must not block the others).

### 6c. Catalogue inside the app (D2)
- The same app can show the Catalogue tabs when the store has the Catalogue product (Home, Catalogue, Shortlist, Orders), with the Live Rate tabs added (§3 table). A Catalogue-only customer keeps the website and may optionally have an app too.
- A Live Rate-only app contains no catalogue screens, routes or bundle weight. Build flags `VITE_PRODUCTS=liveRate|catalogue|both` let the same code build a smaller app for Live Rate-only customers. The runtime check from §3 still applies, so a mis-built app cannot reach a product the store does not have.
- Offline behaviour: **Live Rate shows last-known rates with an "offline, last updated hh:mm" stamp and never presents them as live.** The catalogue keeps its existing offline page (`public/offline.html`).

### 6d. What the earlier plan said (kept for the build mechanics)

The catalogue is used mostly on the web. **Live Rate is delivered as each customer's own app.** The per-store build already exists (`.github/workflows/android.yml`, `scripts/build-store-app.ts`, `server/appBuild.ts`, app id `com.antarixs.<store>`), but it only makes **debug APKs**. To make it production-ready:

1. **One app per customer, features by product (recommended).** A "Both" customer gets one app with both products; the app reads `/api/config` + entitlements at start and shows the right tabs. No separate Live Rate codebase.
2. **Release builds:** a signing keystore per customer, stored as an encrypted GitHub Actions secret or in Secret Manager and never in git, plus `bundleRelease` (AAB), `versionCode` from the build number, and ProGuard/R8 checks.
3. **Play Store:** publish under the customer's own developer account (`PRODUCTION_PLAN.md` F8). `plan.md` currently lists Google Play as out of scope, so that has to change. Prepare a per-app store listing generated from `merchant.json` (name, icon, screenshots, privacy URL from `server/legal.ts`). Play's financial-features declaration may apply to rate/booking apps; check it before the first submission.
4. **iOS:** Capacitor iOS, an Apple developer account per customer, and a macOS CI runner. **Risk:** Apple guideline 4.2.6 rejects near-identical template apps. Each app needs a real per-customer difference, and it may be better to plan Android first and iOS case by case.
5. **Native push:** today's push is Web Push for admins only (`server/routes/push.ts`), which does not reach Capacitor apps. Add `@capacitor/push-notifications` with Firebase Cloud Messaging, a `pushTokens` collection per store, and buyer-side registration. This is used for rate alerts, store updates, and booking confirmations.
6. **App behaviour:** reconnect the stream on resume and pause it in the background (battery), show the last rates with an "offline" stamp when there is no network, and enforce a minimum app version (`config.minAppVersion` already exists).
7. **Owner flow:** "Get your app" in store settings, which already dispatches the build. It shows build status and a download link, then a Play-listing checklist.

## 7. Design: matching the store look

- Build every Live Rate screen with the existing Emergent kit: `Header`, `BottomNav`, `ui.tsx` primitives, `em-*` tokens, and merchant theme colours via `THEME_TOKENS`. No new palette.
- **New components:** `RateBoard`, `RateRow`, `MarketStatus`, `RateAlertSheet` (on the existing `sheet.css`), and owner `RatesDesk`.
- **Numbers:** use `font-variant-numeric: tabular-nums` so digits do not jump. Mark buy and sell with labels, not only colours. Flash up/down with `--em-ok` / `--em-bad`, and turn the flash off under reduced motion, as the codebase already does.
- **Keep the responsive rules already in place:** rem text sizes (system font scale), 44 px hit areas, a 12 px text floor, the 640 px tablet tier, `html.native` header height, dark mode, and Hindi labels via `src/i18n.hi.ts` / `shared/hindi.ts`.
- **Design first:** draw the rate screens on the buyer-screens design canvas (linked in `docs/PROJECT_STATE.md`) and get sign-off before coding phase 3.

## 8. Production-ready and customer-ready checklist

### Must fix before any paying Live Rate customer (from the open audit in `PROJECT_STATE.md`)
- Static OTP accepted in production (high). A rate app with buyers' bookings cannot launch with a shared code.
- Rate limits keyed on the load-balancer IP, so they must use the client IP header correctly.
- Tokens not revoked on password change; anonymous `/api/entitlements` leaks usage; no CAPTCHA on OTP/signup; GitHub Actions `permissions` blocks.

### Engineering
- Unit tests for pricing math, the product-gating matrix, SSE (connect, reconnect, stale), and alerts. Playwright screens for the three store types.
- Load test for SSE fan-out, and a soak test for a full market day.
- Monitoring: feed staleness, SSE connection count, stream latency (tick → phone), push delivery, error rate. Alert routes go to the operator.
- Runbooks: feed outage (auto-pause plus a buyer banner), vendor switch, rollback (`docs/golive-runbook.md` style).
- Cost estimate: always-on `rate-feed` instance, Memorystore, SSE instance hours, FCM (free), vendor licence. Get owner sign-off before phase 5.

### Legal and business
- Market-data licence with redistribution rights.
- Disclaimer and terms for indicative rates and bookings, privacy text for alerts/push (`server/legal.ts`), reviewed by a lawyer. Check GST and other compliance points for booking.
- Pricing per product and for the bundle. This replaces the `[YOUR PRICE]` placeholders.
- Fix the existing false claim: `metadata.json:3` and `merchants/bhakti/merchant.json:12` advertise "live spot rates". Remove it now, and add it back when the feature ships for that store.

### Customer onboarding
- Owner setup checklist: rate rows → premiums → market hours → first manual rate → invite buyers → request app.
- Help pages and a short video, and Hindi throughout.
- A support channel, plus a pilot with one dealer before general launch.

## 9. Phases

Each phase lands on `main` behind the product switch, so existing stores never see it until it is enabled for them. Sizes: S ≈ days, M ≈ 1-2 weeks, L ≈ 2-4 weeks for one developer with agents.

| Phase | Deliverable | Size | Exit check |
|---|---|---|---|
| **0. Decisions** (owner) | Answers to §10 | — | Written in this file |
| **1. Product model** | `products` on store record, migration, per-product entitlements, `requireProduct`, client gating, three-type test matrix. No visible change for current stores | M | All existing tests pass; matrix green; Bhakti unchanged in prod |
| **2. Rate engine (manual)** | `shared/rates.ts`, `server/rates/`, Firestore model, board + SSE stream via Firestore `onSnapshot`, owner rate APIs, staleness | M | Owner edit reaches a second browser in < 2 s; stale shows after threshold |
| **3. Rate screens** | Buyer rate board, updates, contact; owner Rates desk; Emergent design; Hindi; sign-up product step; console product switch | L | Design sign-off; Playwright screens for all three types; real-phone check |
| **4. Dedicated app** | Release signing, AAB, FCM push, rate alerts, resume/offline handling, owner "Get your app" status | L | Signed AAB installs on a real device; alert arrives with the app closed |
| **5. Live feed** | Vendor contract, `rate-feed` service, Redis fan-out, monitoring, auto-pause on outage | L | Full market-day soak; tick → phone latency measured; outage drill passed |
| **6. Bookings** (optional) | Rate lock, owner confirm/reject, alerts, history | M | Locked-rate expiry and double-confirm covered by tests |
| **7. Launch** | Security fixes from §8, legal pages, pricing, pilot dealer, Play listing, runbook | M | Pilot dealer live for 2 weeks with no P1 incident |

A Live Rate product with **manual rates in a branded Android app** (phases 1-4) is sellable before the feed contract is signed. Phase 5 can start in parallel once the vendor is chosen.

## 11. Gold and silver bullion trade system (D3)

A trade layer on top of the rate board, for dealers who buy and sell gold and silver in bulk. It is a **separate module** (`server/trade/`, `shared/trade.ts`, `src/trade/`) behind its own flag, `bullionTrade`, inside the Live Rate product. Catalogue and the rate board work without it.

> The trade rules below (settlement, GST/TCS/TDS, e-way bills, KYC) are **assumptions to be confirmed with the owner and a chartered accountant** before they are built. This plan shows where each rule plugs in; it does not decide them.

### Instruments
Gold: fine gold bar 999 (1 kg, 100 g, 10 g), coin, 22K/18K ornament bullion (impure, so fine weight = weight × purity). Silver: bar 999 (kg), coin, 925/800 lots. Each item has: metal, form, purity, gross weight, **fine weight**, count, and a lot/serial or HUID where applicable.

### Trade types (buyer app ↔ owner desk)
1. **Spot buy/sell at the live rate:** buyer taps a row, enters quantity, sees a **locked rate for N seconds** (default 30; countdown), confirms, and the owner desk receives a deal ticket. Owner confirms (or rejects) within a set time. The deal is fixed at the locked rate, not at the rate when the owner confirms.
2. **Rate booking / limit order:** "book 500 g 999 gold at ₹X or better until 5 pm". Triggers when the store's sell/buy rate crosses ₹X, then goes to the owner desk as a deal ticket. Expired or cancelled orders are kept in history.
3. **Pure-metal (unfixed) account:** many dealers settle in *metal*, not money: the buyer's balance is kept in grams of fine gold and silver, and "rate cut" converts metal ↔ cash at a chosen rate. The existing catalogue copy already speaks of "pure gram-basis trading" and "settle in fine gold weight", so this matches how Bhakti trades. Needs the ledger below.
4. **Delivery:** the deal is delivered physically (courier/pickup) or held in the dealer's vault account. Each delivery records packing, weight at dispatch and weight on receipt, with a tolerance and a dispute flag.

### Ledger (the heart of the system)
- Per buyer, three balances: **cash (₹)**, **fine gold (g)**, **fine silver (g)**. Every deal, payment, metal receipt/issue, rate cut and adjustment is an **immutable ledger entry** (never edited; corrections are reversing entries). Balances are derived by summing entries.
- Entries carry: store, buyer, type, metal, fine grams, amount, rate used, reference (deal id / voucher), who did it (owner staff id), and timestamp (IST).
- Daily and monthly statements per buyer (PDF through the existing `jspdf` setup, and a WhatsApp share); owner reports: open positions, net metal exposure (what the dealer owes or is owed in grams), turnover, margin earned.
- **Exposure view for the owner:** "net gold position" is the number a bullion dealer lives by. Planned as a first-class screen, not an export.

### Documents and compliance (to confirm per customer)
- Sales/purchase invoice with GST (bullion and jewellery have different rates), HSN code, invoice numbering series per store, and cancellation/credit notes.
- E-way bill details where required, and the TDS/TCS lines that apply to a transaction above the statutory thresholds. These are configurable per store, not hard-coded.
- **KYC for buyers** (PAN, GSTIN, address proof): stored privately, exposed to the owner only. Trade stays blocked until KYC is complete if the owner enables that.
- Audit log and a data-retention policy (financial records are kept for years, not the 90-day message retention).
- The legal text in `server/legal.ts` needs a trade/terms layer; disputes and the arbitration clause are for the customer's lawyer, not us.

### Roles and approvals
- Owner staff roles (`shared/roles.ts` exists): *trader* (quotes, confirms deals), *accounts* (ledger and invoices), *viewer*. Large deals can need a second approver. Every confirm/reject is audited (`audit` in `server/http.ts`).

### Risk controls
- Rate-lock expiry is enforced **on the server** (client timers are only display). Maximum quantity per deal and per day per buyer; credit limit per buyer (cash and metal); a **kill switch** (Pause trading) that rejects new deals instantly; stale-rate guard (no deal can lock against a rate older than the staleness threshold).
- Idempotency keys on deal confirmation so a double-tap or flaky network never creates two deals.
- Concurrency: balance checks and ledger writes in one transaction (Firestore transactions).

### The first trade release (v1)

The smallest release a real dealer can use to trade, and the one we test with the pilot dealer. It is phases T1 + T2 and **nothing else**.

**One trade, start to finish**
1. The buyer opens the app and sees the board (gold 999, gold 916, silver 999 and so on, buy and sell).
2. They tap *Sell* or *Buy* on a row and enter a quantity in grams (or kg for silver).
3. The app asks the server for a quote. The server answers with the rate *and a lock time* (for example 30 s). The screen shows the amount and a countdown.
4. The buyer taps *Confirm* inside the countdown. The server checks the lock is still valid, that trading is not paused, that the rate is not stale, and that quantity limits are respected, then records a **deal ticket** at the locked rate. A repeated tap returns the same ticket, never a second one.
5. The owner gets an alert (push, plus WhatsApp where set) and sees the ticket on the **Deals desk**: buyer, metal, grams, rate, amount, time. They *Accept* or *Reject* (with a reason). A ticket nobody answers expires after a set time and the buyer is told.
6. On *Accept*, the system posts ledger entries: the buyer owes (or is owed) fine metal and money according to the deal.
7. Payments and metal movements are then entered by the owner as **vouchers** (cash received/paid, metal received/issued), each a ledger entry. A **rate cut** converts a metal balance to cash (or the reverse) at a rate the owner enters, as a pair of entries.
8. The buyer sees their **account**: cash balance, fine gold and fine silver balances, and each deal and voucher, plus a statement they can share on WhatsApp.

**Included in v1:** spot deals with a server-side rate lock; the Deals desk; the three-balance ledger; payment and metal vouchers; rate cut; buyer account view and statement; pause-trading switch; per-buyer and per-day quantity limits; audit trail; owner alerts.

**Left out of v1 (later phases):** limit/booked orders (T3), GST invoices and e-way bills (T4), KYC, credit limits, staff roles and second approvers (T5), delivery tracking (T6), charts.

**Why this cut:** it proves the hard parts (locked rates, never double-booking, an immutable ledger that always balances) with the least surface. Tax documents and KYC are the parts that depend on each customer's accountant, so they follow once the core is trusted.

**v1 is done when**
- a rate lock cannot be used after it expires, even if the phone clock is wrong (tested);
- a stale or paused rate refuses a quote (tested);
- tapping Confirm twice, or on two phones, makes exactly one ticket (tested);
- the sum of every buyer's ledger equals the sum of all vouchers and accepted deals, checked by an automated reconciliation test over thousands of random deals;
- the owner can open a buyer's statement and tie each line to a deal or voucher;
- the pilot dealer trades a full week alongside their existing books with no unexplained difference.

**What it needs first:** the rate engine and feed (phases 2 and 5, so rates are real and stale-checked), the app with login (phase 4), and the production sign-off items that touch money (§8) before real money is involved.

### Risk of deferring sign-off (D9)
Doing the §8 fixes last is workable for building, but until then: the fixed sign-in code accepted in production means *anyone who knows it can sign in as any buyer*, so do **not** put real buyers, real balances or real deals on a production store before sign-off; test stores use test phone numbers only. Do the OTP provider switch and the fixed-code removal **before the pilot dealer** touches the app, not at general launch, because the pilot is the first real-money use.

### Phases for trade (after the Live Rate phases)
| Phase | Deliverable | Size |
|---|---|---|
| T1 | Instruments, trade settings, deal ticket + server-enforced rate lock, owner desk (confirm/reject), alerts | L |
| T2 | Ledger (cash + fine metal), payments/receipts/metal vouchers, rate cut, buyer statement | L |
| T3 | Limit/rate-booking orders and the trigger worker | M |
| T4 | Invoices, GST/HSN, numbering series, credit notes, statements as PDF | L |
| T5 | KYC, credit limits, roles/approvals, exposure and turnover reports | L |
| T6 | Delivery tracking, weight disputes, retention and audit export | M |

T1-T2 are the minimum for a "trade-ready" pilot with one dealer; T4-T5 are what most customers need before they use it as their books.

## 12. Revised phase plan (Android first, with the licensed feed and trade)

Replaces §9 where they differ.

| Phase | Deliverable | Notes |
|---|---|---|
| **1** Product model | As §3, built as described in its "Data" note | **Done** (see §13) |
| **2** Rate engine on the licensed feed | `shared/rates.ts` (24K → sub-karats, silver), `rate-feed/` service, per-store margins, SSE stream, stale/pause handling, manual override with expiry | The feed is the source from the start; manual is the fallback |
| **3** Live Rate screens | Buyer board, updates, contact; owner Rates desk; Emergent design; Hindi | Design sign-off first |
| **4** Android app v1 | Phone+OTP sign-up, 90-day sliding session, buyer approval option, FCM push + rate alerts, offline stamp | Debug builds for testers |
| **5** Play publishing | Release signing, AAB pipeline, Play API upload, per-customer listing generator, Antarixs Play account, console app status | Needs the Play organisation account registered (start early; verification takes time) |
| **6** Trade T1-T2 | Spot deals with server-side lock, owner desk, ledger | Pilot dealer |
| **7** Trade T3-T5 | Booking orders, invoices, KYC, limits, roles, exposure | |
| **8** Launch hardening | §8 security fixes, load/soak tests, runbooks, legal, pricing, pilot sign-off | Fix the production static OTP **before** phase 4 testers use real numbers |
| **Later** | T6, charts, widget, iOS (only if a customer asks) | |

**Critical path items outside the code:** register the Antarixs Play organisation account now (D-U-N-S and verification take time); confirm the feed licence covers per-customer redistribution; choose and contract the OTP provider; accountant sign-off on the invoice/tax rules for T4.

## 10. Questions still open after revision 2

1. ~~Silver~~ answered (D7). Still needed from the vendor docs: feed update frequency, latency, and whether it quotes per gram, 10 g or kg, plus its connection method (push/WebSocket or polling) and outage behaviour.
2. ~~Feed licence~~ answered (D7).
3. **"Both" customers:** one app with both products (this plan) is assumed from D2. Confirm.
4. **Public or login:** D5 says the rate app needs phone sign-up, so there is no public rate board. Confirm that is wanted even for a trial/preview.
5. **Buyer approval:** may any phone sign up (as Catalogue does today), or should the owner approve each new buyer before they see rates? (The plan adds an optional switch; which default?)
6. **Trade scope for the first release:** spot deals + ledger only (T1-T2), or invoices and KYC as well (T4-T5)? Which customer is the pilot dealer?
7. **Trade rules:** settlement in cash, in metal, or both? Rate-lock seconds? Does Bhakti's "pure gram-basis, no rate slippage" model fit the pure-metal account in §11?
8. ~~Play account~~ registered (D8). Still needed: the account's type (organisation or personal) and its testing-track requirements, which decide the first release timeline.
9. **OTP provider** for production (the static code must go first), and its per-message cost at rate-app volumes. Rate alerts are many more messages than catalogue sign-ins.
10. **Plans and prices** for Live Rate, Trade and the bundle; one trial per product or one for both.
11. **"store.antarix.com"** is read as the store design at `[store].antarixs.com` (Emergent). Send a link if another design was meant.

## 13. Build log

### Phase 1: product model (done)
- `shared/products.ts`: products, `productsOf` (absent = Catalogue only), `hasProduct`.
- `shared/limits.ts`: provisional Live Rate limits and flags, kept apart from the Catalogue tables.
- `server/entitlements.ts`: `PlanDoc` gains `products` and `liveRate`; `makeEntitlements` returns `products` and a per-product `liveRate` block; `requireProduct()` answers 404 when the store lacks the product.
- `server/tenancy.ts`: `StoreRecord.products` and `.liveRate`; `planOf` passes them on.
- `server/app.ts`: Catalogue-only routes (`/api/products`, `/categories`, `/banners`, `/tags`, `/purities`, `/hero-collections`, `/shortlist`, `/orders`, `/admin/orders`, `/enquiries`, `/admin/enquiries`, `/admin/visitors`, `/analytics`) sit behind `requireProduct('catalogue')`. Shared routes (config, entitlements, sign-in, about, buyers, summary, audit log, alerts, push, messages, photos, app build) are open to every product.
- `server/routes/console.ts`: staff can switch products per store (`POST /stores/:id/products`), audited; Live Rate starts on a 14-day trial; removing it keeps its plan.
- `server/routes/signup.ts`: optional `products`; omitted = the record is byte-for-byte what it was before.
- Client: `Entitlements` carries `products` and `liveRate`; `useHasProduct()`; console "Add/Remove Live Rate" action.
- `tests/products.test.ts`: 21 tests, the three store types across the API, per-product plans and trials, console, and sign-up. The gating tests were checked to fail with the gate removed. Full suite: 381 pass.

**Deliberately not done in phase 1** (belongs to later phases): Live Rate screens and nav tabs (phase 3); a buyer-facing product choice in the sign-up UI (phase 3); trial reminders and the trial sweep for Live Rate; the Live Rate-only app build flag. **A store switched to Live Rate-only today would show empty Catalogue screens**, so the console action only adds or removes Live Rate next to the Catalogue; the API can set Live Rate-only for testing.
