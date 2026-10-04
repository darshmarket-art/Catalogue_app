# Layouts and console: handoff (2026-10-04)

Branch `saas/layouts` (worktree `catalogue-app/wt-layouts`, cut from `saas/integration` 6d8a6e5). Foundation commit 777b55f. Everything after it is uncommitted work from parallel agents.

## Decisions
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
| QA | `tests/**`, browser check vs the atlas | not started |

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
