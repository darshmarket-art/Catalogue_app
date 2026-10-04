# Layouts and console: handoff (2026-10-04)

Branch `saas/layouts` (worktree `catalogue-app/wt-layouts`, cut from `saas/integration` 6d8a6e5). Foundation commit 777b55f. Everything after it is uncommitted work from parallel agents.

## UPDATE: Emergent is default, Gilded archived (agent E1)
The user prefers Emergent. It is now the default and only live layout for every store and plan; this supersedes the Decisions, Foundation gating and picker notes below (Gilded = standard, Emergent = Pro, picker, console Set layout, DEV_FORCE_LAYOUT, premiumLayouts).
- Gilded buyer screens and kit are archived in `app_themes/gilded/` (not built; excluded in tsconfig and .dockerignore). Restore steps and source commit (7924bc2) are in `app_themes/README.md`. `src/gilded.css` stays: it is the base stylesheet.
- Prop interfaces and `LayoutKit` now live in `src/layouts/props.ts`; `App.tsx` uses the Emergent kit directly.
- `shared/layouts.ts` keeps a one-entry registry (`emergent`, plan basic). The `layout` field is gone from `merchantSchema`: zod strips it, so a stored `layout: gilded` (Bhakti) or missing one renders Emergent with no migration.
- Removed: `LayoutPickerScreen`, `admin-layout`, hub tile and plan link, `api.setLayout`, `PUT /admin/layout`, console `POST /stores/:id/layout` and its UI, `effectiveLayout`, `DEV_FORCE_LAYOUT`, flag `premiumLayouts`.

## Decisions (superseded where it mentions layouts)
- Gilded = standard layout for every plan. Emergent = Pro layout. The owner picks; the plan limits the choice.
- A store whose trial lapsed shows Gilded; its saved choice is kept and returns on upgrade (`effectiveLayout` in `server/tenancy.ts`).
- Emergent's missing features (cart/order review, plans compare, PDF picker, onboarding, layout picker) are standard for all layouts.
- Product fields stay dynamic (`merchant.productFields`). No hard-coded gross/tare/net/HUID.
- Console shows real data only; anything not derivable returns `null` and the UI says "Not connected".

## Foundation (committed)
- `shared/layouts.ts`: ids, names, plan per layout.
- `server/merchant.ts`: `layout` field, default `gilded`.
- `server/entitlements.ts` + `src/plan.tsx`: flag `premiumLayouts` (Pro).
- `server/routes/layout.ts`: `PUT /api/v1/admin/layout` (402 for a Pro layout on Basic), audited.
- `server/tenancy.ts`: embeds the effective layout into the page config; `DEV_FORCE_LAYOUT=emergent` forces a layout outside production for local preview.
- `src/layouts/index.ts`, `gilded.ts`, `emergent/index.ts`: kit registry. `App.tsx` renders `<K.Welcome/>`, `<K.Categories/>` (Home), `<K.Catalogue/>`, `<K.Shortlist/>`, `<K.Orders/>`, `<K.About/>`, `<K.Header/>`, `<K.BottomNav/>`; root div has `data-layout`.
- A layout implements the same props as the Gilded component of the same name.

## Agents and file ownership
| Agent | Owns | Status when this was written |
|---|---|---|
| B | `src/layouts/emergent/**` | DONE |
| C | `src/App.tsx`, `types.ts`, `api.ts`, `plan.tsx`, new standard screens, `LayoutPickerScreen` (`admin-layout`), `docs/screen-parity.md` | DONE |
| D | `server/routes/console.ts`, `server/consoleStats.ts`, `src/console/**`, `console.html`, `tests/console*.test.ts` | DONE |
| QA | `tests/**`, browser check vs the atlas | DONE |

## Next steps
1. Read each agent's report and `git status`. Delete stray `dist-b/` / `dist-d/` build dirs.
2. `npx tsc --noEmit` and `npx vitest run` (baseline was 195 passing).
3. QA agent: tests for Basic 402, Pro ok, downgrade-to-Gilded embed, console layout write audited, product fields dynamic in both layouts. Browser check: run the server on a port other than 3000 (the user's own dev server uses it), for example `PORT=3100 DEV_FORCE_LAYOUT=emergent`, compare each screen with the Emergent Screen Atlas (artifact https://claude.ai/artifact/VFnzY2ugfU5ozNXRhX4nNJ; serve the HTML over a local http server, `file://` is blocked in the browser tool).
4. Lead commits on `saas/layouts` (Co-Authored-By trailer). The user reviews, then pushes and deploys (the permission classifier blocks production deploys and pushes).
5. Owner items still open: `CONSOLE_ADMINS` and `IAP_AUDIENCE` for the console; delete the 5 test stores in Firestore (bluestone, claude, mahalaxmi, rajkot, test-1) which the classifier blocked; keep `trialClaims` unless told otherwise.

## Gotchas
- Source files use CRLF. Normalise `\r\n` before string replaces in Node scripts.
- `Catalogue_app/` is the old single-store tree. The live multi-store code is `wt-integ` (and this branch).
- `node_modules` in `wt-layouts` is a junction to `wt-integ`'s.

## Agent C: DONE (report received; tsc clean, 129 targeted tests pass, vite build ok)
- Parity table is in `docs/screen-parity.md`. Cart already exists as the `OrdersScreen` "Current order" tab, so no second Cart was built; the gap filled was the buyer note (optional `note` max 300 on `POST /orders/confirm`, stored on the PO, appended to the WhatsApp text, shown in admin and history).
- New: `PlansCompare` (one table from `LIMITS` + `flagsFor`, used by `EntryScreen` and a new `plans` screen from `AdminPlanScreen`), `PdfCatalogueScreen` (`admin-pdf`, hub tile `tile-pdf`, hidden on Basic), `LayoutPickerScreen` (`admin-layout`, hub tile `tile-layout`), `ScreenTop`, Share buttons on the signup ready step, Remove buyer in `AdminBuyersScreen`.
- `flagsFor` moved to `shared/limits.ts` (`server/entitlements.ts` re-exports it). Bug fixed in App.tsx: the Basic fallback for order screens now runs before the active screen is chosen.
- Picker: Basic sees "Upgrade to use" (no API call); Pro calls `api.setLayout`, then reloads after 1.5 s.

### Open items from C for the lead
- `src/cataloguePdf.ts` and the Gilded Catalogue/Shortlist print Net/Gross directly and ignore `merchant.productFields` (conflicts with "fully dynamic fields"). Fix: a sector hook for the detail line.
- If agent B needs a navigation callback in Catalogue/ProductDetail (the mockup's "Review" cart bar), widen the `LayoutKit` prop types in `src/layouts/gilded.ts`; C then passes `onNavigate` from App.
- Emergent Orders must call `onConfirmOrder(note)` / `onGenerateWhatsAppPO(note)` (optional string) and show `note` on past orders.
- A per-line quantity stepper in an Emergent cart would need a new server call.
- QA tests to write for C's work: note on confirm (stored, appended, >300 gives 400), `PUT /admin/layout` 402 Basic / 200 Pro, `DELETE /admin/buyers/:phone` owner 200 / staff 403, picker flows for Pro and Basic, PDF picker, back button and no bottom nav on the 3 new screens in both layouts. Testids: layout-gilded, layout-emergent, layout-use-*, layout-saved, tile-layout, tile-pdf, plan-card-basic/pro, plans-table, pdf-*, order-note, remove-buyer-<phone>.

## Agent D: DONE (tsc clean, 20 console tests pass, full suite 209 passing, vite build ok; UI NOT checked in a browser)
- New endpoints under `/api/v1/console` (IAP): `GET /summary`, `/activity`, `/owners`, `/buyers` (masked phones), `/orders`, `POST /stores/:id/layout` (any layout, audited). Store view also has `layout`, `effectiveLayout`, `lastActiveAt`, `limits`.
- UI in `src/console/` (`Console.tsx`, `pages.tsx`, `api.ts`, `console.css`), 9 hash-routed sections, Emergent console format, confirm dialogs for every change.
- Returns null, shown "Not connected": storage bytes (Blobs has no list/size call), Firestore reads, certificates, cost (need Cloud Monitoring), revision outside Cloud Run. Region not shown.
- Known limits: "online now" counts only the `visitors` collection; cross-store calls walk every store (ponytail comment: paging or counters past a few hundred stores).
- New tests: `tests/consoleStats.test.ts` (14).
- QA to do: look at the console in a browser at desktop and 390px widths and compare with the atlas "Antarixs Console" section.

## Agent B: DONE (tsc clean, vite build ok; screens rendered headless at 390/1280 px by B; interactions untested)
- Files in `src/layouts/emergent/`: emergent.css (scoped `[data-layout="emergent"]`, `.em-*`), ui.tsx, Header, BottomNav, Welcome, Home (Categories slot), Catalogue, ProductDetail (full page, not a sheet), Shortlist, Orders, About. Props derived from Gilded's prop types.
- Cart = Orders "Current order" tab with a note box (testid `order-note-input`, `past-order-note`).
- Open: Emergent Catalogue has optional `orderCount` and `onNavigate` props that App.tsx does not pass yet (need LayoutKit prop type widened in `src/layouts/gilded.ts`); until then the cart bar counts only this visit and has no Review button.
- Labels like "Gross weight" are still hard-coded (same as Gilded); sector hook for dynamic detail lines still open.
- Deviations: Welcome and About hero use a gradient (no photo); featured piece opens its collection (no product link from Home); no Share on product detail.

## Commit
Checkpoint commit of B + C + D work on saas/layouts (209 tests passing). Next: QA agent (tests + browser check vs atlas), then fix the open items above.

## QA agent: DONE (237 tests pass, tsc clean; browser-checked vs atlas at 390/1280 px, no console errors)
- Added `tests/layout.test.ts` (28). Source fixes: legacy store records without `layout` fall back to Gilded (live Bhakti case); resolver `invalidate(id)` on layout save; LayoutKit.Catalogue takes `orderCount`/`onNavigate` (cart bar Review works); Gilded OrdersScreen got the order note; PDF prints a line of `merchant.productFields`; Emergent card SKU truncation; 390px wraps in PDF/Plans/console KPI.
- Open/design calls for the user: (1) Emergent uses the store's fonts (Bodoni Moda + Manrope), not the atlas's Fraunces + Inter; (2) admin hub, Orders desk, Buyers, Plan, New design keep the old structure, not the atlas dashboard (online chip, trial card, KPI deltas, alerts toggle); (3) staff accounts can change the layout (requireAdmin): owner-only? (4) Capacitor/native builds render merchant.json at build time with no layout, so a Pro own-app store ships Gilded; (5) Gilded cards/Shortlist and the Emergent spec table still print Gross/Net directly, only extras are dynamic; (6) other instances take up to 15 s to show a saved layout.
- Another process (PID 36168, wt-integ server.ts) was already using port 3100; use another port.
- Next: user review; then push/deploy by the user. Foundation commit hash is now 0ff2ca9 (was amended).
