# Emergent screens against the catalogue app

The 19 Emergent screens (screen atlas) checked one by one against `src/` and `server/`. Verdicts: **exists** (same screen, same job), **different form** (the job is done, shaped differently), **missing** (nothing equivalent).

Rule used: a screen that is layout-specific buyer UI (Welcome, Home, Catalogue, Shortlist, Orders, Product detail, About) already exists in the Gilded kit; the Emergent version is built by the layout agent in `src/layouts/emergent/`. Everything else is shared by all layouts, so the gaps are filled once, layout-agnostic, with the existing theme tokens and `src/components/ui.tsx` classes.

| # | Emergent screen | Catalogue equivalent (evidence) | Verdict | What was done |
|---|---|---|---|---|
| 1 | Welcome | `WelcomeScreen` (brand hero, browse / sign-in) | exists | Emergent version is the layout agent's |
| 2 | Home | `CategoriesScreen` (banners, collections, per-collection PDF in its menu) | exists | layout agent |
| 3 | Catalogue | `CatalogueScreen` (search, chips, sort, heart, owner "Select" mode) | exists | layout agent. The owner's PDF picking no longer depends on this screen (see 17) |
| 4 | Shortlist | `ShortlistScreen` (hearted designs, total, "Add all to order") | exists | layout agent |
| 5 | Orders | `OrdersScreen` (Current / Past tabs, cancel a new order) | exists, different form | layout agent. Emergent adds status chips on past orders; `PastOrder` now carries `note` |
| 6 | Product detail | `ProductDetailSheet` (gallery, zoom, purity chips, `merchant.productFields`, qty, WhatsApp ask) | exists | layout agent |
| 7 | Cart | `OrdersScreen` "Current order" tab: lines, remove, total, **Place order** (`api.confirmOrder`) and **Send order on WhatsApp** (`sector.orderManifest`). Missing next to the mockup: a note to the store and a per-line stepper | exists, partial | **Note added end to end**: `POST /orders/confirm` takes an optional `note` (max 300), stores it on the PO, appends `*Note:*` to the WhatsApp text; `api.confirmOrder(note?)`; `App` passes `onConfirmOrder(note?)` and `onGenerateWhatsAppPO(note?)`. The owner sees it on the Orders desk (`AdminOrdersScreen`, `data-testid="order-note"`). No stepper: the server has no "change quantity" call (remove and re-add stays the model). No second Cart screen was built: it would duplicate the Orders tab |
| 8 | Order sent | `OrdersScreen` booked state (check, PO number, grams, "Send order on WhatsApp", "View past orders") | exists | layout agent mirrors it |
| 9 | About | `AboutScreen` (+ `AdminAboutScreen`) | exists | layout agent |
| 10 | Plans (Basic vs Pro) | `EntryScreen` "Compare Basic and Pro" view, but only on the platform host, with a hard-coded table, and no way to reach it from a store | different form | New `PlansCompare` (trial note, two plan cards, table) built from `LIMITS` and `flagsFor` (moved to `shared/limits.ts`, re-exported by `server/entitlements.ts`, so client and server read one table; a new flag fails the build until it has a label). Used by `EntryScreen` and by a new `plans` screen (`PlansScreen`) opened from `AdminPlanScreen` ("Compare Basic and Pro"), marked with the store's own plan. Deliberately not on the buyer Welcome: buyers do not buy plans |
| 11 | Onboarding 1 Store | `SignupScreen` step `name` (business name, live `.antarixs.com` address, availability and suggestions, brand colour) | exists | none. Owner name is asked in step 2; there is no city field on the server |
| 12 | Onboarding 2 WhatsApp | `SignupScreen` steps `owner` + `code` (WhatsApp OTP, six boxes, resend, 5 minute expiry) | exists | none |
| 13 | Onboarding 3 Ready + QR | `SignupScreen` step `done` (link, copy, real QR via `qrcode`, Save QR, Open admin) | exists, partial | Added **Share on WhatsApp** and **Share link** (share sheet where available, copy otherwise) |
| 14 | Admin dashboard | `AdminHubScreen` (kg booked, trial note, tiles, new design, alerts toggle) | exists | Two tiles: **Storefront layout** (`tile-layout`) and PDF catalogue now opens the picker (`tile-pdf`) |
| 15 | Orders desk | `AdminOrdersScreen` (status chips, confirm, dispatch, cancel, WhatsApp the buyer) | exists | shows the buyer's note |
| 16 | Buyers | `AdminBuyersScreen` (search, usage meter, **Reset** password). The mockup has **Remove**; the server route `DELETE /admin/buyers/:phone` existed but nothing called it | exists, partial | Added **Remove** (two taps, `api.removeBuyer`, owner only on the server) |
| 17 | PDF catalogue picker | Hub tile jumped to `CatalogueScreen`, where the owner had to find "Select". Layout-specific, so an Emergent catalogue would not have it | different form, weaker | New `PdfCatalogueScreen` (`admin-pdf`): preview card, collection chips, selectable grid, Select all / Clear, **Download PDF**, **Share** (phones). `downloadDesignsPdf(..., 'share')` added. Guard: Pro (`flags.pdfCatalogue`), otherwise back to the hub. The Gilded Select mode is untouched |
| 18 | Plan and usage | `AdminPlanScreen` (trial countdown, meters, what changes on Basic, email sales) | exists | Added links to **Storefront layout** and **Compare Basic and Pro** |
| 19 | New design | `NewProductScreen` (photos, `merchant.productFields`, gross / stone / net, stock status, HUID) | exists | none. The mockup hard-codes gross, tare and HUID; the catalogue app stays dynamic |
| + | (not in the atlas) Layout picker | none | missing | New `LayoutPickerScreen` (`admin-layout`), see below |

## Layout picker (`admin-layout`)
Two preview cards from `LAYOUTS` (CSS thumbnail, name, blurb, **Standard** on Gilded, **Pro** on Emergent). The active one is `merchant.layout` (already the effective layout, so a lapsed trial shows Gilded active and Emergent locked). On Basic the Emergent button reads "Upgrade to use", opens `upgradeNotice(...)` and makes no API call. On Pro it calls `api.setLayout`, shows "Saved. Your storefront updates for visitors within a minute.", then reloads. The server answers 402 if the plan changed meanwhile: that also opens the upgrade notice. The chosen id is kept in `sessionStorage` (`layout-chosen`) so a reload that still shows the old layout (store cache) says "Switching to ...". Entry: hub tile and a row on the plan screen.

## Routing (App.tsx)
- `ActiveScreen` gains `admin-layout`, `admin-pdf`, `plans`.
- `admin-layout` and `admin-pdf` need an admin session (login screen otherwise). `plans` is open.
- These three bring their own top bar (`ScreenTop`, same `.topbar` markup as the Header) instead of `K.Header`, so no layout's Header has to know them. No bottom nav. Back: `admin-layout` and `admin-pdf` to the hub; `plans` to the plan screen (owner) or Welcome.
- Fixed on the way: the Basic fallback ("order screens fall back to Home") ran after the active screen was chosen, so it never applied. It now runs before, and also covers `admin-pdf`.

## Known gaps left for others
- `src/cataloguePdf.ts` prints "Net ... Gross ..." per design (existing, core fields) and ignores `merchant.productFields`; a sector hook for the PDF detail line is the clean fix.
- `CatalogueScreen` / `ShortlistScreen` (Gilded) also print `netWt` directly; untouched by instruction.
- A per-line quantity stepper in the Emergent cart needs a new server call.
