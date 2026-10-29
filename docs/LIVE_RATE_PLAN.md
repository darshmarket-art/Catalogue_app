# Live Rate app: development plan

Status: plan only, nothing built. Written 2026-10-29 against `main` at `a698878`.

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

### Sources
- **Manual:** the owner saves base rates. Write to `stores/<id>/rateState/current`, then fan out to connected buyers.
- **Feed (phase 5):** a licensed market-data vendor for spot gold/silver and USD/INR, or an MCX-based feed. **Redistributing exchange data in an app needs a licence from the vendor.** This is a business decision and a contract, not code. The engine supports several sources behind one interface (`RateSource { subscribe(onTick) }`), so the vendor can change.

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

## 6. A dedicated app for every customer

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

## 10. Decisions needed from the owner

1. **Rate source:** manual-only at launch, or wait for a feed? Which vendor (licence cost, redistribution rights, latency)?
2. **"Both" customers:** one app with both products (recommended), or two separate apps?
3. **Bookings:** in v1, or later? They bring legal and operational weight (rate lock, disputes).
4. **iOS:** at launch, or Android first?
5. **Rate access:** public rate board by default, or login only?
6. **Plans and prices** for Live Rate Basic/Pro and the bundle, plus whether one trial or a trial per product.
7. **Play publishing:** customer's own account (per `PRODUCTION_PLAN.md` F8), or Antarixs publishes as a paid service?
8. **"store.antarix.com":** this plan reads it as the store design at `[store].antarixs.com` (Emergent). If a separate site or design canvas was meant, share the link.
