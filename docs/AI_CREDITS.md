# AI credits: usage ledger, prepaid wallet, price controls

1 credit = Rs 1. Whole numbers only (no floats in money). Stores prepay; Antarixs tops the balance up by hand in the console after receiving payment. Code: `server/aiCredits.ts` (all money logic), `server/routes/photos.ts` (render route), `server/routes/aiCreditsOwner.ts` (owner), `server/routes/consoleAi.ts` (console), `src/console/ai.tsx` (console UI), `src/components/AiCredits.tsx` + `RenderStylePicker.tsx` + `PhotoPicker.tsx` (owner UI).

## How a render is charged

`POST /api/admin/photos/render` (owner):

1. Validate ref, style, placement. Read the optional `renderId` (8-64 chars `A-Za-z0-9_-`, else the server makes one).
2. `reserve()` runs ONE `Store.transact`: reads config, wallet and the usage record, then checks in this order: console kill switch (503 `paused`), store AI off (503 `disabled`), monthly cap (402 `cap`), balance (402 `credits`), and charges the price. A repeat of the same `renderId` returns the stored record and charges nothing.
3. The provider is called only after a successful charge.
4. Success: usage `ok`, the charge stands. Provider failure, timeout, unreadable image, or our own storage failure: `finish()` refunds the whole charge in a transaction (ledger `refund`, usage `provider_failed`), and the 502 says the credits were returned.
5. An owner who later discards or cancels still pays: `POST /api/admin/ai-credits/keep {renderId, kept}` only records `kept` for reporting.

The price is read from the server's table (global prices, overridden by the store's `priceOverride`). The client sends no price and the balance shown in the app is only a display. `aiFree` stores (the founder store `bhakti` by default, or any store the console marks) are charged 0 but every attempt is logged with its estimated cost and `listPrice`.

Race safety: Firestore `runTransaction` (retries on contention); `MemoryStore.transact` serialises transactions. Two parallel renders with balance for one: one gets 201, the other 402 (tested).

## Firestore collections (platform level, not inside a store namespace)

| Collection / id | Fields |
|---|---|
| `aiConfig/global` | `prices{style: credits}`, `modelCostUsd{model: usd}`, `usdInr`, `lowBalance`, `killSwitch`, `updatedAt`, `updatedBy`. Missing fields fall back to the defaults in code. |
| `aiWallets/<storeId>` | `balance`, `paidTotal`, `freeTotal`, `spent` (net of refunds), `lastTopupAt`, `lastTopupAmount`, `lastUsedAt`, `aiFree`, `aiEnabled`, `priceOverride{style or 'all': credits}`, `monthlyCap` (null = platform default) |
| `aiLedger/<storeId>:<id>` | `kind` topup / spend / refund / adjustment, signed `amount`, `balanceAfter`, `actor`, `note`, `renderId?`, `free?`. Spend and refund ids are `<storeId>:<renderId>:spend` / `:refund`, so each happens at most once. Never updated or deleted. |
| `aiUsage/<storeId>:<renderId>` | `ts`, `style`, `model`, `outcome` (pending, ok, provider_failed, blocked_cap, blocked_credits, blocked_disabled), `costUsd` (estimated), `price` (credits charged, 0 when free/blocked/refunded), `listPrice`, `balanceAfter`, `refunded?`, `kept?`, `resultRef?` |

Queries use one filter or one range only (no composite indexes): `aiUsage`/`aiLedger` by `storeId ==` or `ts >`. The per-store monthly render counter is unchanged (`stores/<id>/aiRenderMonthly`) and stays the safety ceiling.

## Env and config

- `AI_RENDER_ENABLED=true` is the master switch. The console kill switch can only pause more; it cannot turn rendering on.
- `AI_RENDER_MONTHLY_CAP` (default 100): platform default per store per UTC month; a store's `monthlyCap` overrides it.
- `AI_RENDER_MODEL`, `AI_RENDER_LOCATION`, `AI_RENDER_STYLES`: unchanged. Cost per render is looked up by model id in `aiConfig.modelCostUsd`.
- Console: `CONSOLE_ADMINS`, `IAP_AUDIENCE` unchanged; every `/api/console/ai/*` route sits behind the existing IAP + allowlist check, writes are JSON only and each adds a `consoleAudit` line (`ai-topup`, `ai-adjustment`, `ai-refund`, `ai-settings`, `ai-config`).

### Defaults (placeholders, change in the console Prices tab)

Price per render: Rs 8 for cad, silk, studio-dark, editorial, giftbox, festive, macro; Rs 12 for on-model. Provider cost (USD per image): gemini-nano-banana-2.1 0.034, gemini-3.1-flash-image 0.067, gemini-3-pro-image 0.134. USD to INR 95. Low-balance alert at 24 credits (three renders). Max single top-up or adjustment: 100,000 credits. At the defaults the margin on nano-banana-2.1 is about Rs 4.77 per Rs 8 render and about Rs 8.77 per Rs 12 render.

## Console (AI section, `#/ai`)

Overview (calls today / 7 / 30 days, success rate, credits sold and spent, estimated provider cost vs revenue and margin, daily calls, revenue vs cost, by style, top 10 stores; days are UTC), Stores (balance, renders and spend this month, last used, status; Top up, Adjust, Refund, Price/cap/AI on-off), Usage log (filters: store, style, outcome, dates; CSV export up to 20,000 rows), Prices and models (price table with margin, model cost table, USD to INR, low-balance threshold, kill switch), Alerts (stores at or below the threshold, at zero, or turned away this week). Cost is always labelled estimated and Google billing as "Not connected": Cloud Billing is never called.

## Owner

Store settings has an "AI credits" card (balance, last top-up, recent renders). The style picker and the AI render switch show "Rs 8" per style and the balance; at zero the styles are disabled and the text says "Add credits: contact Antarixs" with the sales email (and WhatsApp when `SALES_WHATSAPP` is set in `shared/sales.ts`). Same markup in Classic and Maison. "Enhance to CAD render" is now "AI Enhance". The style picker is a bottom sheet on phones (ends above the tab bar) and a centred dialog on desktop, rendered at the app root (a fixed sheet inside the animated form was sized to the whole form), with a fixed header and a Cancel / Continue footer.

## Decision points

1. **Manual top-up now, payment gateway later.** No gateway exists. The owner pays Antarixs (UPI or bank), the console admin records the reference in the top-up note. When a gateway arrives it should call the same `change()` function from a webhook (use the gateway payment id as an idempotency key, which `change()` does not yet take: add a `ref` field to the ledger id then).
2. **Refund on failure: automatic and full.** We absorb the provider cost of failed calls (it is still counted as cost in the overview). Credits are charged before the call so a crash can leave a `pending` charge; the console Refund action with the render id covers that. A sweeper that closes old `pending` records is not built yet.
3. **Discarded renders stay charged.** The owner can see and keep or discard; discarding does not refund.
4. **Price defaults** are a flat Rs 8 and Rs 12 placeholders; revisit once real usage and the model choice are known.
5. **Cost is estimated** from a table the admin edits, not read from Google. Cloud Billing export to BigQuery would give actuals later.
6. **The monthly cap is not transactional** (existing behaviour, can overshoot by one under a race). The balance is exact.

## Tests and QA

`tests/aiCredits.test.ts` (provider mocked): charge on success, refund on failure, discard stays charged, 402 on insufficient credits, cap as its own reason, concurrency, idempotent retry, aiFree and founder exemption, price override and global price, kill switch and per-store off, top-up with ledger and audit, amount validation, render-tied refund cap, overview/stores/alerts/usage/CSV numbers, config validation and audit, owner isolation, console admin required.

Browser: `AI_E2E_SEED=1 PW_CHANNEL=msedge PW_WORKERS=1 npx playwright test tests/e2e/ai-credits.e2e.ts` (seed data from `tests/e2e/aiSeed.ts`, used only when that variable is set). Covers the console AI section at 1440 and 390, the owner credits card and picker (funded and zero balance) in Classic and Maison at 390 and 1440, and the render sheets against the bottom bar at 360x640, 390x844 and 1440x900 (Cancel, Continue and the compare buttons must not intersect the tab bar). Screenshots: `docs/qa-maison/ai-credits/`.
