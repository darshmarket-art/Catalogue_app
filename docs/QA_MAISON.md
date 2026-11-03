# QA: Maison storefront layout

Status: re-test of commit 39ecbfc done. VERDICT: PASS with minor defects (sections 7 and 8). The first run (73f0953) was FAIL (sections 5 and 6, kept for history).

## 0. Blocking finding: there is no layout switch to test yet

In this tree (`feat/responsive-adaptive`) `shared/layouts.ts` has `LAYOUT_IDS = ['emergent']` only, and `docs/LAYOUTS_HANDOFF.md` says the `layout` field was removed from `merchantSchema` (zod strips it), `LayoutPickerScreen`, `api.setLayout`, `PUT /admin/layout` and the console "Set layout" were deleted, and Gilded is archived in `app_themes/gilded/`. `App.tsx` imports `emergent as K` directly. So:
- "Classic" does not exist as a name. For Phase 2 I will treat **Classic = Emergent** (the only live layout) unless told otherwise. Confirm. (If Classic should be Gilded, it has to be restored from `app_themes/README.md` first.)
- "chosen via merchant.layout in store settings" needs the builder to re-add the field to `merchantSchema`, a way to set it (owner screen or console), and the embed in `server/tenancy.ts`. Phase 2 will test that Classic/Emergent stays the default when the field is missing or unknown (old stores, Bhakti `layout: gilded`).

## 1. Feature-parity checklist (from the Emergent kit)

Kit contract: `src/layouts/props.ts` `LayoutKit` = Header, BottomNav, Welcome, Categories (Home), Catalogue, Shortlist, Orders, About. Product detail, cart sheet and collections browser are internal to Catalogue. Everything else (auth, admin screens, ProfileMenu, LangToggle, StoreShareSheet, PDF picker, plans) is shared and must keep working inside Maison chrome.

### Buyer screens and actions (every item needs a Maison equivalent, desktop and mobile)
W = Welcome, A = Auth, H = Home, C = Catalogue, P = Product detail, S = Shortlist, K = Cart/Order, O = Orders, B = About, G = global

- W1 Welcome: brand hero, "Enter the portal", browse as guest, sign in (testids none; text "For registered buyers. Sign in with your WhatsApp number.")
- A1 Retailer auth (shared `RetailerAuthScreen`): WhatsApp number, OTP boxes, resend, wrong code, then lands on Home (or on `?category=` collection); header Back goes to Welcome. Maison must restyle or at least frame it.
- A2 Sign out; signed-in redirect away from Welcome.
- H1 Home: greeting with buyer name (desktop), `home-search` + `home-search-designs` (opens Catalogue with query typed), banner carousel with prev/next/dots ("Banner n", "Next banner"), `home-collections` / `home-collection` tiles, `browse-collections` (opens `collections-browser`: `collection-search`, `collection-row`, `collection-all`), `recently-viewed` / "Jump back in" strip (`jump-back`), `social-links` (Instagram/Facebook from About, `social-soon-*` when unset), loading placeholders (`loading` prop).
- H2 Owner-only on Home: edit collection, collection menu (Share link, Share as PDF), `Share catalogue link` chip.
- C1 Catalogue: `catalogue-search`, `catalogue-count`/`result-count`, `catalogue-sort` (SORT_KEYS from `shared/jewellery`, includes newest), `catalogue-filter-button` -> `filter-panel` (`filter-min-weight`, `filter-max-weight`, `apply-filters`, `clear-filters`), `active-filters` with per-filter remove, collection picker (`collection-picker`, `collection-current`, `collection-all`), `tag-group`/`tag-chips`, `view-<v>` view toggle, `product-card`, `card-add-to-cart`, heart (shortlist toggle), `load-more` / "Show more n left", `catalogue-empty` and "Clear search and filters", error "Could not load the catalogue." + Try again.
- C2 Owner on Catalogue: edit product, PDF select flow (now in shared `PdfCatalogueScreen`).
- P1 Product detail (`product-row` opens it): `product-gallery` with swipe, zoom viewer (PhotoViewer, "Zoom photo n of name"), `design-prev`/`design-next`/`design-position`, purity chips, `cart-purity-rows` quantity steppers (Increase/Decrease), `merchant.productFields` dynamic (no hard-coded gross/tare/net), `product-description`, specs (Gross, Stone/tare, Net weight), "Enquire on WhatsApp", heart, Add to cart, `report-problem`, Esc/back closes, deep link by SKU (`initialSku`, Recently viewed).
- S1 Shortlist: list with remove, `shortlist-open`, `shortlist-clear`, `shortlist-order-all` ("Order the whole list"), "Send shortlist on WhatsApp", empty state, header count tag.
- K1 Cart (`CartSheet`): `cart-clear`, `cart-confirm`, `cart-sheet-close`, "Review" bar from Catalogue (needs `orderCount`, `onNavigate`).
- K2 Orders Current tab (`orders-tab-current`): lines, `order-line-remove`, qty stepper (`onChangeQty`), totals (Pieces, Net total, GST), `order-note-input` (max 300), `place-order` -> booked state (PO id, grams, "Send order on WhatsApp" `order-via-whatsapp`, "View past orders"), `onGenerateWhatsAppPO(note)`.
- O1 Orders Past tab (`orders-tab-past`, `past-orders`, `past-order-toggle`, `past-order-note`): status chips, cancel new order ("Could not cancel"), empty states, `initialTab` from profile menu.
- B1 About: hero under the bar, About the house, Our promises, Find us (Address, Hours, Phone, Email, Website, Map), Call / WhatsApp us, registration, social, Back to Home.
- G1 Profile menu (shared `ProfileMenu`): Orders, Past orders, About, Report a problem, Log out; owner: Store settings, Share store link / QR (`menu-share-store`, `StoreShareSheet`).
- G2 Language toggle (`LangToggle`, English / Hindi via `i18n.hi.ts`, `toHindi`): every Maison string through `t()`/`ts()`, nothing hard-coded English; toggling re-renders (`useLang()`).
- G3 Install / share: `src/install.ts` install prompt, share catalogue link (`navigator.share` with clipboard fallback and "Link copied to clipboard" toast), collection link `/?category=`, store QR card, PDF share/download ("PDF downloaded").
- G4 Bottom nav on mobile (Home, Catalogue, Shortlist, Orders; badges for orderCount and shortlistCount; hides on scroll/keyboard via `useHideOnScroll`), desktop replacement nav; owner tabs (Admin, Orders, Catalogue, Buyers, Store; badges `adminBadges`).
- G5 Back behaviour: browser back / Android back, "Press back again to exit" toast, scroll restoration (`useScrollAnchor`), `?category=` deep link.
- G6 Dark mode / prefers-contrast / reduced-transparency styles exist in Emergent; Maison should state its own position (not a blocker).

### Owner-facing parts that depend on the layout
- Owner chrome: `Header` (brand + admin menu button, back + title + eyebrow + aside, Pro/Basic tag), `BottomNav` owner tabs and badges, Trial banner offset (`--header-h`, `--sat`).
- Owner screens render inside the chosen kit's Header/BottomNav: admin-hub, orders desk, buyers, store, about/plan/alerts/messages/insights/password, new-product, add-category, `admin-pdf`, `plans`. Shared screens use `ScreenTop` (own bar) for admin-pdf and plans.
- Owner views of buyer screens: Home (edit collection, share), Catalogue (edit product).
- Layout selection: owner/console setting to choose Maison (to be re-added, see section 0), plan gating (was Pro/Basic), persistence across reload, console audit entry.
- Root div `data-layout` and `data-role` attributes drive CSS; Maison CSS must scope to `[data-layout="maison"]` and not leak into the Classic CSS (`emergent.css`, `gilded.css`, `index.css`).

## 2. Bulgari reference (source of truth; screenshots in `docs/qa-maison/ref/`)

Captured from bulgari.com/en-int in my own Chrome tab. Caveat: the extension window would not shrink below ~1536 CSS px, so "1440" shots are at 1536x791 (DPR 1.25); 390px shots are a same-origin 390px-wide iframe of the live site (real mobile breakpoint, not a device-emulated UA). The user's own Bulgari tab was not in my tab group, so I did not use it. Not captured: desktop listing screenshot was viewed inline but not saved; scroll and page-transition motion judged from behaviour, not video.

Files: `d1440-home-masthead-hero.jpg`, `d1440-megamenu-jewellery.jpg`, `d1440-condensed-header-scrolled.jpg`, `d1440-product-page.jpg`, `d1440-404-footer.jpg`, `m390-home.jpg`, `m390-menu.jpg`, `m390-listing.jpg`, `m390-product.jpg`.

### Desktop
- Masthead (175px tall, white, 3 tiers): thin beige promo bar (~40px, close X); utility row (left: Find a Store, Services, Contact Us, underlined SEARCH field; right: Newsletter, My Account, My Wishlist (0)); huge widely tracked serif-roman wordmark centred (about 350px wide, letter-spacing very wide); a single row of 13 UPPERCASE nav items, 12-13px, letter-spacing about 0.6px, evenly spread edge to edge (about 22px gaps); 1px hairline under. Active/hover item gets a 2px underline.
- Mega menu: opens on hover as a full-width white panel directly below the nav, about 510px tall, no shadow, hairline top; closes with an X at top right. Three zones: left (about 680px) "BY CATEGORY | View All" as outlined square-corner pill buttons (1px dark border, 0 radius), then "BY COLLECTION | View All" as a 6-column grid of square beige (#f4f2f0-like) thumbnails with centred small caption beneath; middle column "PICKS" text links on beige panel; right a portrait promo carousel (image, title, two solid black full-width buttons, dots, chevron). Page scroll is locked while open.
- Scrolled header: logo shrinks and jumps to the left, utility row collapses to icons only (search, store, support, account, wishlist) on the right, nav row stays; header becomes a compact ~90px sticky bar.
- Hero: edge-to-edge full-bleed photograph, about 610px tall at 1536x790, directly under the nav hairline, no side margins. Text lives in a translucent dark box (about 55% black) pinned bottom-left with 60px inset: white uppercase title about 28px, two lines of sentence-case subcopy, white rectangular button with dark tracked uppercase label. Next section: centred narrow text block (about 625px) with a small widely tracked uppercase heading (about 16px, letter-spacing about 3px), justified body copy 16px/26px light weight, then a solid black rectangular CTA; then another full-bleed photo. Rhythm: image, narrow text, image.
- Typography: custom geometric sans ("Bulgari Type", fallback Futura), regular 400 weight almost everywhere. Body 16/24px, colour #1f1f1f on white. Nav 12px uppercase with 0.6px tracking. Buttons 12px uppercase 1.8px tracking, 43px tall, 0 radius, fill #1f1f1f, white text (secondary: white fill, 1px dark border). Section/card titles h3 18px/22px uppercase, 400. Product H1 27px, 500, uppercase, no tracking. Product name on cards 16px caps. Price 16px regular. No italics, no serif outside the logo. Small tags ("New") in warm taupe/grey.
- Colours: near-black #1f1f1f, white #fff, warm off-white panel/tile #f4f2f0 (approx), promo bar beige, taupe accent for "New". No gold or gradient UI; colour comes only from photography.
- Shape language: sharp rectangles everywhere (0 radius on buttons, pills, tiles, inputs), 1px hairlines, no shadows, no cards borders. Thin line icons (heart, mail, share, pin, headset, user).
- Listing grid: content column about 1250px centred (x 130 to 1378 at 1536), 4-column grid, tiles about 298px square with 19px gap; tile fill off-white, product image centred with generous padding, heart top-left, "New" tag bottom centre; an editorial tile can span 2 columns x 2 rows inline in the grid. Sub-nav of collection names centred above (small tracked text), then a filter bar: icon + "Filter by:" and 7 dropdowns (Collection, Color, Material, Gemstone, Diamond Pave, Price, Collection) separated from the grid by a full-width hairline. Name/price are under the tile (caps name, price, material) on mobile.
- Product page: centred breadcrumb "HOME | FINE JEWELLERY ONLINE | RINGS" (small caps, tracked). Three zones in a 1250px column: left vertical thumbnail rail (about 157px squares, active one has a 3px black bar underneath, scroll chevron), centre large square image on off-white (about 512px), right info column (about 405px): H1, "New" taupe tag, one-line description, native-looking select (Size) with 1px border, underlined "Find your size", price 22-24px semibold with "Including Taxes" small, solid black full-width CTA, outlined secondary CTA (full width, same height), then heart / mail / share line icons stacked at the far right. Accordion details follow below.
- Footer: beige newsletter band with inline email field, social icons, then 4-column link lists (small uppercase bold column titles, sentence-case links) on white.
- Motion and transitions: page navigations are full page loads (header, promo bar and mega menu are static chrome; `startViewTransition` exists in the browser but no cross-page transitions observed); mega menu opens as a quick fade/drop without 3D; header condenses on scroll; carousels slide horizontally. No tab/section 3D observed on the reference, so the 3D requirement (rubric 5) is an explicit addition by the user, not Bulgari fidelity. Measure with a screen recording in Phase 2 if exact durations matter.

### Mobile (390px)
- Header: promo bar (2 lines) then single 44px bar: hamburger + search icons left, wordmark centred (about 90px wide), store pin + wishlist right. No visible nav row.
- Hamburger menu: full-height white panel replacing the page, close X in the place of the hamburger, list of 12 uppercase items 12px/tracked, 48px rows, chevron on items with children (Jewellery, Engagement, Watches, Bags, Fragrances, Gifts, The Maison) opening a drill-down level; no dividers, generous left padding 12px.
- Home: full-bleed portrait hero image with no overlay, then below it centred uppercase title (about 24px), centred subcopy and CTA (text moved out of the image, unlike desktop).
- Listing: sub-nav of collection names as a horizontally scrolling text row, then two buttons side by side: "Filter By" (icon, 1px border) and a "Recommended" sort select; 2-column grid (each about 100% of half width, 12px gap); name caps 12-13px / price / material text below each tile, a short black progress bar above the name.
- Product: title centred above image (27px to 20px, wraps), "New" tag, full-width off-white image carousel with heart/mail/share stacked right and chevron, thin black progress bar for image index, then select, price centred, full-width solid black CTA.

### Differences desktop vs mobile to enforce (rubric 4)
Desktop: 3-tier masthead with centred huge logo and permanent mega menu, overlay hero box, 4-col grid + filter dropdown bar, three-column product page. Mobile: compact bar and drill-down menu, hero text under the image, 2-col grid with Filter/Sort buttons, stacked product page.

## 3. Rubric (pass/fail; every line needs evidence: screenshot, file or test)

1. **Differs from Classic (Emergent)** - FAIL if any one of these is shared:
   - Layout structure: Maison has its own masthead + mega-menu/drawer, its own Home composition, grid, product page, cart. Not the Emergent card/bottom-sheet structure.
   - Typography: different family and scale; Maison uses the Bulgari-like uppercase tracked sans (an open-licence stand-in, no Bulgari font files), not Emergent's serif display + `em-ey` eyebrows.
   - Colour: neutral white / near-black / warm off-white, no Emergent gold or tinted surfaces; check tokens in CSS.
   - Shape language: 0 radius, hairlines, no shadows (Emergent uses circles `em-circ`, rounded chips and sheets).
   - Motion: distinct motion language (see 5). Check `emergent.css` classes (`em-*`) are not reused in Maison markup.
   - Test: side by side screenshot of each screen; a reviewer should not mistake one for the other with logos covered.
2. **Bulgari fidelity (layout, rhythm, transitions)** - PASS needs: 3-tier masthead with centred wordmark and uppercase nav row; condensing sticky header on scroll; full-width mega-menu panel with category buttons, collection thumbnails and a promo; full-bleed hero with overlaid translucent box (desktop) / text below (mobile); image-text-image rhythm with narrow centred copy; 4-col square-tile grid with hairline filter bar (desktop), 2-col with Filter/Sort buttons (mobile); product page with thumbnail rail + large image + info column; button style 12px caps / tracked / 0 radius; shows no Bulgari logo, font files, photos or copy.
3. **Feature parity** - every checklist item in section 1 works in Maison, on both viewports, signed in as buyer and as owner, in English and Hindi. Any missing or broken item = FAIL for the line (list which).
4. **Separate desktop and mobile designs** - distinct component trees or layouts at 1440 and 390 (not one design scaled): the differences listed under "Differences desktop vs mobile" hold; no horizontal overflow at 390; touch targets at least 44px on mobile; no hover-only affordances on mobile.
5. **3D transitions between tabs, with reduced-motion fallback** - tab changes (Home, Catalogue, Shortlist, Orders; and owner tabs) animate with a real 3D transform (perspective + rotate/translateZ, check computed `transform` is a matrix3d during the transition and that `perspective` is set); runs at 60fps without layout jank (animate transform/opacity only); interruptible (rapid taps do not stack or leave a stuck screen); back/forward direction reversed; under `prefers-reduced-motion: reduce` (emulate in DevTools) there is no 3D, only a short fade or instant swap; focus and scroll position are handled after the transition; no blank flash.
6. **Classic unchanged** - `git diff` of the worktree vs base shows zero change in `src/layouts/emergent/**` and `src/gilded.css`; `emergent.css` selectors untouched; screenshots of Classic screens identical before vs after (pixel compare at 390 and 1440); default layout for stores with no setting is still Classic; changes to shared files (`App.tsx`, `index.css`, `types.ts`, `props.ts`, `ProfileMenu`) are additive and listed.

Also required (not rubric lines): `npx tsc --noEmit` clean; `npx vitest run` green (baseline 195 per handoff, recount at start); no console errors; layout persists across reload; unknown/missing `layout` falls back to Classic; Maison CSS lazy-loaded or scoped so Classic stores do not pay for it.

## 4. Phase 2 plan
1. Wait for worktree path and branch; `git diff <base>...` for scope (rubric 6).
2. Run `npx tsc --noEmit`, `npx vitest run` in that worktree.
3. Start the server/dev on a port other than 3000 (for example 3100) with a test store set to Maison, plus the same store set to Classic.
4. Screenshot every screen of both at 390 and 1440 into `docs/qa-maison/<classic|maison>/`.
5. Walk the checklist in the browser; record PASS/FAIL/N-A per item; check reduced motion and Hindi.
6. Score rubric, list defects (file, screenshot, suggested fix), final PASS/FAIL.

## 5. Results (Phase 2)

Build under test: worktree `.claude/worktrees/agent-a6f16d3c1c09df536`, branch `worktree-agent-a6f16d3c1c09df536`, commit 73f0953 (base 2ed2a17). "Classic" = Emergent, now named Classic in `shared/layouts.ts`, so the section 0 blocker is resolved by the build (`layout` field, `PUT /api/admin/layout`, picker in Store settings).

Method: real app on an empty file store (tests/e2e/server.ts) on ports 3917 (worktree) and 3918 (base tree, as the Classic baseline), driven by Playwright with Edge at 1440x900 and 390x844 (mobile = isMobile + touch). Scripts are in `catalogue-app/qa-scratch/` (outside the repo). Buyer and owner sessions were injected as tokens, so the real OTP login was not walked in Maison (the sign-in screen was captured; the OTP step was not). Screenshots: `docs/qa-maison/classic/`, `docs/qa-maison/maison/` (names `d1440-*`, `m390-*`), baseline from the base tree in `docs/qa-maison/base/`, Bulgari in `ref/`. A few first-run files in those folders are stale (a script flow I later fixed); the names cited below are the good ones.

### Tooling
- `npx tsc --noEmit`: clean.
- `npx vitest run`: 45 files, 361 tests, all pass.
- Browser console: only the Vite HMR websocket error caused by my two dev servers sharing port 24678 (environmental). One page error, "Transition was aborted because of invalid state", appears on Classic, base and Maison alike (existing view-transition behaviour, not Maison). No horizontal overflow on any captured screen at 390 or 1440.

### The coordinator's list
1. **Shortlist, About, desktop mega-menu, 3D transitions (never viewed by the builder):**
   - Shortlist: works, but the "Send shortlist on WhatsApp" button is invisible on desktop (an empty white bordered box, `maison/d1440-40-shortlist.png`); on mobile it is an icon only. D2.
   - About: renders well, own markup (`d1440-61-about-full.png`). Rows WHATSAPP US / CALL / MAP are real links (hrefs verified) but show only a label. Minor.
   - Desktop mega-menu: BROKEN, D1 (`d1440-11-megamenu-settled.png`, rects measured at 1440 and 1920). The white panel is 389px tall but the two feature images (about 490x435, the second running off the right edge) and their captions overflow it, so photos and "Bridal Chokers & Haar" land on the hero and its headline. The two-column list is squeezed into about 275px and wraps every name. The mobile drawer is fine (`m390-11-collections-mobilemenu.png`).
   - 3D transitions: verified by sampling `getComputedStyle(main)` every frame. Home to Catalogue runs `mx-push` with `matrix3d` and opacity 0 to 1 over about 0.6s; the reverse runs `mx-pull`; a mid-transition frame of the Shortlist page turn is in `d1440-80-3d-mid-transition.png`. Rapid taps at 1440 (Home, Shortlist, Orders, Catalogue within 400ms) left one `main`, transform `none`, opacity 1 and the right tab active: interruptible. With `prefers-reduced-motion: reduce` the same navigations use a pure opacity fade with no transform at both sizes: the fallback works. Caveats: only the incoming page animates (the old page just disappears); Home and Catalogue get the straight z-push rather than the rotateY page turn because App.tsx treats them as a drill pair; the rapid-tap test was desktop only.
2. **Reused Emergent screens (Catalogue, product detail, Shortlist, Orders):** same markup restyled. Side by side with Classic they have the same structure at both sizes. Catalogue = title, search plus "All collections" button, left Filter and sort sidebar (desktop) or bottom sheet (mobile), 4-up or 2-up grid, view toggle, add to cart under each card. Product detail = photo left, info right, Previous/Next, same field order, same buttons (full-bleed instead of a modal). Shortlist = list card plus "Order the whole list" side card. Orders = tabs, line card, side summary. What changed is colour (white, black, hairline), type (Cormorant plus Jost, caps, tracking) and radius (0). So they are a re-skin, not a new design. **Rubric 1 and rubric 2 fail for these four.** They need real Maison markup:
   - Catalogue: Bulgari-style hairline filter bar of dropdowns above a full-width grid of off-white square tiles with heart top-left and name and price below (no sidebar), an editorial tile every few rows; mobile 2-up with Filter By and Sort buttons side by side.
   - Product detail: its own page (not a sheet) with breadcrumb, thumbnail rail, large square image on off-white, narrow info column, outlined secondary button, accordion details.
   - Shortlist: wishlist as the same tile grid, not a list card with a side summary.
   - Orders and cart: a bag page in the Bulgari style (line list with thin rules, summary beneath, full-width black button); the cart sheet is also Classic's.
   Only Header, Welcome, Home and About have real Maison markup (4 of 8 kit slots, plus the shared sign-in, a boxed card).
3. **Classic pixel-unchanged:** PASS. The worktree with `layout=emergent` against the base tree on identical data gave 0 differing pixels for Welcome, sign-in, Home, Catalogue, filter sheet, collections browser, product detail (settled), Shortlist, Orders, About, profile menu and Hindi, at 390 and 1440. Earlier small diffs (0.02 to 0.15 percent) were animation timing or PO-id text and disappeared when I waited for the product page to settle. The `:is([data-layout="emergent"],[data-layout="maison"])` rewrite touches 883 lines in `emergent.css` plus `sheet.css` and `index.css`: same specificity, no visible change, but a large diff to review, and any future Emergent rule must use the `:is()` form or Maison silently loses it. The Maison CSS and JS ship to Classic stores too (static imports; `maison.css` was requested while the store was Classic): consider lazy loading.
4. **Known issues:**
   - WhatsApp button on sign-in stays green: CONFIRMED (computed rgb(29,106,66), radius 0), and it is also full green when disabled. The only coloured control in a black and white layout. D5, low.
   - Wordmark cut off at 390: NOT reproduced. It fits at 390 and 360, and clips at 320 (text 161px in a 137px box, ellipsis). D6, low. The gold "B" and the coloured part of the name come from the store theme, not black.
   - Owners always see Classic, even via "View as a buyer": CONFIRMED by code (`!isAdminLoggedIn && merchant.layout in KITS` in App.tsx) and the owner root had `data-layout="emergent"` after switching to Maison. The owner cannot preview Maison without signing out. D4, medium.
5. **Picker and fallback:** PASS. Store settings shows a "Store layout" radiogroup with two previews (`d1440-91-owner-layout-picker.png`, `d1440-92-owner-picker-saved.png`). Clicking Maison sends `PUT /api/v1/admin/layout` (200), shows "Buyers now see the Maison layout.", moves `aria-checked`, and the page-config embed then carries `"layout":"maison"`. Auth: 401 without a token, 403 with a buyer token; invalid values (`gilded`, `bogus`, empty) get 400. `merchantSchema` parse: missing, `gilded`, `bogus`, `null` and `7` all become `emergent`. Minor: the Maison preview truncates the name ("BHAKTI JEW") and both previews are very tall.

### Other observations
- Sign-in on mobile has no language toggle (Classic shows EN / Hindi there; Maison keeps it in the menu only, which is absent on the sign-in page). D3, medium. Desktop sign-in keeps it.
- Hindi on the Maison wordmark: letter-spacing 0.16em on Devanagari splits the conjuncts (`d1440-70-hindi-home.png`). D7, medium.
- Mobile sign-in card touches the screen edges with no margin (`m390-02-signin.png`).
- Orders: the note box is narrow (half width); "Place order", the booked state and Past orders work (`d1440-51-order-booked.png`).
- Welcome is near-black, not white like Bulgari, but clearly different from Classic and consistent with the Home hero.
- Home: genuinely different from Classic (full-bleed hero with overlay box, asymmetric editorial collection tiles, DISCOVER links, black footer); mobile puts the text under the hero like Bulgari. Full-page screenshots show blank gaps only because sections reveal on scroll (0 hidden reveals after scrolling). The desktop hero title wraps "Pre- / Booking" in its box.
- Masthead vs Bulgari: utility row left, wordmark centred, one nav row, hairlines: close in structure. The wordmark is smaller than Bulgari's and the nav is compact and centred rather than spread edge to edge; no scroll-condensing header (it stays a fixed 109px bar).

### Checklist run (Maison, buyer, 1440 and 390)
Walked and working: Welcome and "Enter the portal"; sign-in screen (OTP step not walked); Home (hero, collection tiles, footer, socials); Collections (mega-menu broken on desktop, drawer ok on mobile); Catalogue grid and count; filter and sort (sidebar on desktop, sheet on mobile); product detail (specs, add to cart, shortlist, WhatsApp ask, Prev/Next); cart sheet and the "Review" bar; Shortlist add and list; Orders current, place order, booked, past; About; profile menu (desktop); language toggle (desktop, Hindi labels translate); header counts. Not individually tested: OTP verify, load more, view toggle, collection filter via the mega-menu, report a problem, install prompt, PDF/share, search from Home, owner screens (owners never see Maison).

### Rubric score
1. Differs from Classic: **FAIL**. Header, Welcome, Home, About and sign-in chrome differ; Catalogue, product, Shortlist, Orders and the cart sheet share Classic's structure.
2. Bulgari fidelity: **FAIL**. Masthead and home are close; the mega-menu is broken; no filter dropdown bar, tile grid, product-page rail or breadcrumb, or condensing header.
3. Feature parity: **FAIL (minor)**. Everything walked works except the invisible shortlist WhatsApp button (D2) and the missing mobile language toggle on sign-in (D3); some items untested (above).
4. Separate desktop and mobile designs: **PASS with reservation**. Header, menu, hero, filters and product layouts differ by size, but the reused screens differ only as Classic already did.
5. 3D transitions plus reduced-motion fallback: **PASS** (caveats above).
6. Classic unchanged: **PASS** (pixel-identical, tsc and 361 tests green; review the 883-line selector rewrite).

### Defects
| # | Sev | Where | Evidence | Suggested fix |
|---|---|---|---|---|
| D1 | High | `src/layouts/maison/maison.css` lines 124-137 (`.mx-mega`, `.mx-mega-in`, `.mx-mega-feat`, `.em-ph`) | `maison/d1440-11-megamenu-settled.png` | Size grid rows from content (`align-items:start`, `min-width:0` on children), wrap each image in `overflow:hidden; width:100%; aspect-ratio:4/3`, make the list one column of short rows, and keep the panel's height equal to its content. |
| D2 | High | `src/layouts/emergent/Shortlist.tsx` line 137 (`em-circ em-wabtn` with `.em-dk` label), restyled in maison.css | `maison/d1440-40-shortlist.png` | Add a Maison rule for `.em-wabtn` (ink border, ink text, label visible) like `.em-btn.wa`; better, give Maison its own Shortlist. |
| D3 | Med | `src/layouts/maison/Header.tsx` (`LangToggle` only in the `desk` branch and the menu) | `maison/m390-02-signin.png` | Show `LangToggle` in the mobile bar on sign-in and for signed-out visitors. |
| D4 | Med | `src/App.tsx` (`!isAdminLoggedIn &&` in `layout`) | owner root stayed `data-layout="emergent"` | Let "View as a buyer" use the picked layout, or add a preview link in the picker. |
| D5 | Low | `RetailerAuthScreen` WhatsApp button (shared) | `maison/d1440-02-signin.png` | Maison-scoped rule: ink fill, white text, no green. |
| D6 | Low | `maison.css` lines 113-114 (`.mx-word`, `max-width: calc(100vw - 150px)`) | `maison/m320-13-header.png` | Reduce tracking under 360px or show the mark only. |
| D7 | Med | `maison.css` lines 114, 266 (letter-spacing on `.mx-word > span`, nav, eyebrows) | `maison/d1440-70-hindi-home.png` | `:lang(hi)` or Hindi-mode rule: `letter-spacing:0; text-transform:none`. |
| D8 | High (scope) | `src/layouts/maison/index.ts` reuses Emergent Catalogue, ProductDetail (via Catalogue), Shortlist, Orders, CartSheet | side-by-side `classic/` vs `maison/` shots | Build real Maison markup for those screens, as listed under item 2. |
| D9 | Low | `src/layouts/emergent/emergent.css` 883-line selector rewrite, eager Maison import | git diff, network log | Review; lazy-load Maison. |

## 6. VERDICT: FAIL
The plumbing (picker, API, fallback, Classic unchanged, tsc, tests, 3D with reduced-motion fallback) is sound. Rubric lines 1 and 2 fail because four of the eight screens are Classic with a coat of paint, and two visible defects (broken desktop mega-menu D1, invisible Shortlist WhatsApp button D2) block release. Re-test after D1, D2, D3, D7 and real Maison Catalogue, product page, Shortlist and Orders.


---

## 7. Re-test of the fixed build (commit 39ecbfc on top of 73f0953)

Same method as section 5: real app on empty file stores (worktree on 3917, base tree 2ed2a17 on 3918 as the Classic baseline), Playwright with Edge at 1440x900 and 390x844. Both stores were seeded with the same 26 extra designs (QA-1000 to QA-1025; every fourth has 3 photos) so Load more (page size 24) and the thumbnail rail could be tested. Screenshots: `docs/qa-maison/r2/{maison,classic,base,maison-smoke}/` (and `ref/` for Bulgari). Scripts: `catalogue-app/qa-scratch/`.

### Tooling
- `npx tsc --noEmit`: clean.
- `npx vitest run`: 45 files, 361 tests, all pass.
- No page errors in Maison runs (other than the Vite HMR port clash from my two dev servers). No horizontal overflow on any captured screen at 390 or 1440.

### Classic pixel-unchanged after the hook refactor: PASS
Worktree with `layout=emergent` against the untouched base tree, 47 screenshots (Welcome, sign-in, Home, collections browser, Catalogue, filter sheet, product detail with one and three photos, cart sheet, Shortlist, Orders current/booked/past, About, profile menu, Hindi) at 390 and 1440. After settling, every screen is pixel-identical (threshold 24 per channel). The only differences found were noise, each checked: PO number and date text on the booked and past order screens (differs per run), the Home hero carousel caught mid-slide in the profile-menu shot, and 90 to 270 anti-aliased shadow pixels on Welcome and sign-in at first capture, which came out as zero at 390 and as the same dither at 1440 on a re-run with longer settling (visually identical). No layout change from `useCatalogue.ts` or `useProductDetail.ts` is visible.

### Lazy chunk: PASS
- A Classic store never requests Maison: the network log of the full Classic run (both sizes) contains only Classic's own fonts (Fraunces, Material Symbols). No `maison`, no Cormorant or Jost.
- A Maison store loads `maison/index.ts` and its screens, `maison.css`, then Cormorant and Jost, behind the boot splash; it works at both sizes.
- Production build (to a temp folder, not the repo): Maison is its own `maison-*.js` (178 kB, 55 kB gzip) and `maison-*.css` (51 kB, 8 kB gzip); the built `index.html` does not reference it.

### Claimed fixes
- D1 mega-menu: FIXED. The panel now holds a one-column list plus two contained feature tiles on a white hairline panel (`r2/maison/d1440-12-megamenu.png`), no overlap with the hero.
- D2 Shortlist WhatsApp: FIXED. "Send shortlist on WhatsApp" is a visible outlined button in the bottom bar next to "Order all" (`d1440-40-shortlist.png`). On mobile its label touches the right edge of the screen (D12).
- D3 mobile language toggle on sign-in: FIXED (`m390-02-signin.png` shows EN / Hindi in the bar).
- D7 Hindi letter-spacing: FIXED. Wordmark, nav and eyebrows render joined (`d1440-70-hindi-home.png`).
- Also fixed: D5 (the sign-in button is now neutral grey when disabled, not green) and the picker preview shows the full name. D6 (wordmark clipped at 320px) was not re-measured; it fits at 390 and 360.

### Rubric 1 and 2: the five screens are now new Maison markup
Compared with Classic and with the Bulgari reference:
- **Catalogue** (`r2/maison/d1440-20-catalogue.png`, `m390-20-catalogue.png`): breadcrumb, large serif title, a full-width hairline bar (search | collection dropdown | Filter and sort), 4-up (desktop) or 2-up (mobile) tile grid with a square-cornered heart badge and underlined "Add to cart" links, and a view toggle (3 buttons; card widths verified 297/197/1244 px on desktop, 170/111/350 on mobile). Classic has a sidebar, rounded cards and filled purple buttons. This matches the Bulgari pattern (filter bar above, tile grid, no sidebar).
- **Product detail** (`maison-smoke/d1440-30-product-3photos.png`, `m390-30-product-3photos.png`): its own page with breadcrumb (Catalogue / category / name), a vertical thumbnail rail (3 thumbs, active one outlined; the rail is small, about 32px) beside a large image, a narrow info column with specs, and a pinned action bar (Add to cart, outlined Shortlist, outlined Enquire). Mobile: full-width swipe carousel with dash indicators and a sticky bottom bar. Close to the Bulgari product page (rail, large image, info column, black plus outlined buttons); no accordion sections. Classic is a modal sheet.
- **Shortlist** (`d1440-40-shortlist.png`, `m390-40-shortlist.png`, `m390-05-shortlist-empty.png`): tile grid with an action bar at the foot (Designs, Pieces, Net total, Order all, WhatsApp). The mobile empty state is a centred message plus "Browse designs". Different from Classic's list card with a side summary.
- **Orders** (`d1440-50-orders.png`, `m390-50-orders.png`, `m390-06-orders-empty.png`): underlined tabs, a line list with thin rules, quantity stepper, full-width note box, a "Your order" summary card with a black "Place order"; mobile uses a bottom summary bar. The empty state, booked state and Past tab work.
- **Cart sheet** (`d1440-32-cart-sheet.png`): now a right-hand drawer with square steppers and a black button, not Classic's modal.
- **Welcome, Home, About, sign-in at 390 and 1440** (`m390-01-welcome.png`, `maison-smoke/d1440-00-home.png`, `d1440-61-about.png`, `m390-61-about.png`): checked, fine. Welcome is near-black (a deliberate variation); Home is the full-bleed hero with overlay box (desktop) and text under the image (mobile) followed by editorial collection tiles.

Rubric 1: PASS (no screen shares Classic's structure; the shared pieces are only the profile menu, the sign-in form body, the language toggle and Emergent's CollectionsBrowser sheet, all re-skinned). Rubric 2: PASS with gaps: the masthead has no scroll-condensing state (it stays a 109px bar), the wordmark and nav are smaller and tighter than Bulgari's, product pages lack accordion sections, and the hero keeps a translucent overlay box.

### 3D transitions on the new pages: PASS
Sampled `getComputedStyle(main)` per frame while moving Home, Catalogue, Shortlist, Orders, About, Home. Every tab change now runs `mx-turn-fwd` or `mx-turn-back` (rotateY page turn with `matrix3d`), and drilling in or out runs `mx-push` or `mx-pull`; this holds at 1440 and 390. Rapid taps at 1440 (Catalogue, Shortlist, Orders, Catalogue 110 ms apart) ended with one `main`, transform `none`, opacity 1. With `prefers-reduced-motion: reduce` the only animation seen is the plain fade-in with no 3D transform, at both sizes. Mid-transition frame: `r2/maison-smoke/d1440-80-3d-mid-catalogue.png`. Caveat unchanged: only the incoming page animates.

### Smoke tests (Maison, real flows)
- **Real OTP login:** PASS at 1440 and 390. Welcome, "Enter the portal", phone, "Send code on WhatsApp", six code boxes (dev hint shown), the sixth digit signs in, name step for a new number (`r2/maison-smoke/d1440-01-otp-step.png`), greeting, then Home with `data-layout="maison"`.
- **Home search:** PASS. Typing "QA-1000" plus Enter opens the Catalogue with the query filled and 1 result.
- **Load more:** PASS. 24 cards, then 32 after the sentinel scrolls into view (both sizes).
- **View toggle:** PASS (3 modes change card width).
- **Thumbnail rail:** PASS on desktop (3 thumbs, gallery has 3 images); on mobile the carousel shows 3 dash indicators.
- **Empty Shortlist and Orders on mobile:** PASS (screenshots above).
- **Install / share:** not applicable. `src/install.ts` is not imported by any screen in either layout, and the only share actions in Classic (Share catalogue link, share collection) are owner-only; owners always see Classic.

### Remaining defects
| # | Sev | Where | Evidence | Suggested fix |
|---|---|---|---|---|
| D10 | Med | `src/layouts/maison/maison.css` (Cormorant Garamond oldstyle figures) | `r2/maison/d1440-32-cart-sheet.png` (stepper shows "o" for 0), `d1440-50-orders.png` ("1" reads as a small capital I in Designs, Pieces, "QA Design 01", weights) | `font-variant-numeric: lining-nums tabular-nums` on the serif numbers, or set quantities, counts and weights in Jost. |
| D11 | Low-Med | `src/layouts/maison/About.tsx` (no `report-problem` link; Classic has it at `emergent/About.tsx` line 119) | grep, About screens | Add the same "Report a problem" link and handler. |
| D12 | Low | `src/layouts/maison/Shortlist.tsx` + `maison.css`, mobile action bar | `r2/maison/m390-40-shortlist.png` | The WhatsApp button touches the right screen edge and its label fills it; add the page gutter or shorten the label. |
| D13 | Low | `maison.css` (product thumbnail rail) | `maison-smoke/d1440-30-product-3photos.png` | Thumbs are about 32px; enlarge to 56-64px as on Bulgari. |
| D14 | Low | `src/layouts/maison/Header.tsx` | home and catalogue shots | No scroll-condensing header; wordmark smaller than Bulgari's (fidelity gap, not a bug). |
| D4 | Med (unchanged) | `src/App.tsx` (`!isAdminLoggedIn &&`) | owner sees Classic | By design, but "View as a buyer" should preview the chosen layout, or add a preview link in the picker. |
| D9 | Low (unchanged) | `src/layouts/emergent/emergent.css` `:is()` rewrite | git diff | Large diff to review; lazy loading is now done. |
| D15 | Info | `maison/Catalogue.tsx`, `maison/Home.tsx` | code | The collections browser sheet is still Emergent's `CollectionsBrowser`, restyled. Acceptable. |

### Updated rubric score
1. Differs from Classic: **PASS**.
2. Bulgari fidelity: **PASS with noted gaps** (D13, D14).
3. Feature parity: **PASS with one gap** (D11 Report a problem). Checked and working: real OTP login, home search, collections via mega-menu and drawer, catalogue, filter sheet, load more, view toggle, product with several photos, cart, shortlist, orders (place, booked, past), About, profile menu, language toggle (Hindi), empty states. Not tested: collection filter from the mega-menu, Next/Previous swipe on touch, owner screens (Classic only).
4. Separate desktop and mobile designs: **PASS** (masthead and mega-menu vs drawer, filter bar vs bottom sheet, thumbnail rail vs carousel, action bars).
5. 3D with reduced-motion fallback: **PASS**.
6. Classic unchanged: **PASS** (pixel-identical, Maison never requested, tsc and 361 tests green).

## 8. VERDICT: PASS (re-test of 39ecbfc)
All six rubric lines hold and there are no release blockers. Fix D10 (numerals) and D11 (Report a problem) before shipping; D12 to D14 are polish.


---

## 9. Owner-side QA (Maison owner shell, charts, content screens)

Tested 2026-11-03. Started at HEAD a9aa774; HEAD moved during the run to 4b9e084 (merged "buyer flush tiles / 3D" work and "AI render: Enhance to CAD render for existing photos", 9a33cac). Owner screens were re-checked after the move; the dev server was restarted and re-seeded for the AI checks. Real app on empty file stores (tests/e2e/server.ts), ports 3961 (this tree; layout toggled maison/emergent through `PUT /api/admin/layout`), 3952 (base commit 2ed2a17 in a separate git worktree `qa-scratch/base-2ed`, node_modules junction kept in place), 3963 (empty store for empty states). Port 3951 was already taken by another process, so it was not used. Playwright + Edge at 1440x900 and 390x844 (mobile = touch). Same seed on both servers (5 buyers, 7 orders in 4 statuses, enquiries, views). Screenshots: `docs/qa-maison/owner-qa/` (`maison-*`, `classic-*` = this tree with layout emergent, `base-*` = 2ed2a17; names `d1440-<screen>` / `m390-<screen>`). Scripts: `catalogue-app/qa-scratch/o-*.mjs`.

### Tooling
- `npx tsc --noEmit`: clean (re-run at 4b9e084).
- `npx vitest run`: all green. At a9aa774 the bare command ran 541 files, 4363 tests (it also scans `.claude/worktrees/**`, see O10), all passed. Result at 4b9e084 is in the last line of this section.

### Rubric
1. **Admin not similar to Classic: PASS.** Left sidebar of four light-serif words (1024px and up), minimal top bar and four-word bottom bar on mobile, Cormorant light headings plus Jost tracked uppercase labels, ink/white/bronze only, 0 radius, hairline rows instead of cards, underlined fields instead of boxed inputs, black square CTA. Classic is plum, pills, rounded cards, shadows, filled inputs (`classic-*` vs `maison-*`). No Maison owner screen reads as Classic. Residual off-system bits: PDF screen title in a theme red/brown (O4) and the picker preview tiles.
2. **Bulgari fidelity: PASS with gaps.** Hairlines, tracked 11-12px caps, square corners, generous rhythm all present. Gaps: active tab labels have no horizontal padding (O2), some headings are giant wide-tracked grey caps off the type scale and text columns do not align to the page rule (O5).
3. **Feature parity: PASS (see the AI note).** Verified in Maison at both sizes: Today (needs-you, quick actions, share sheet with QR, copy link, download QR, WhatsApp), Orders (filters ALL/NEW/CONFIRMED/DISPATCHED/CANCELLED; Confirm order moved the list from 4 to 3 new; Mark dispatched, Cancel, call, WhatsApp), Catalogue Designs (search, collection picker, PDF, row menu with edit/delete), Collections (edit/hero/PDF on all 8 rows, tag chips, search, hero list, tags manager), Banners (adding a photo opens the cropper for a non-2:1 image), Purities (toggle changes state), Buyers (tel: and wa links on all 5, buyer sheet, two-step "Tap again to remove", Enquiries and Activity segments), Store (About, Share, View as a buyer, layout picker, Alerts, Insights, WA Lighthouse to message log, Audit log, Plan and usage to Compare Basic and Pro, Change password, Log out), PDF catalogue (pick, select these, export), Add design and Add collection (save works; at 390 both new items appear in the lists, at 1440 see O1), admin sign-in and Forgot password, View as a buyer (Maison buyer home inside the owner sidebar with a "Viewing as a buyer" bar). Owners have no separate Profile menu in either layout: the "Store" link (Classic: hamburger) opens Store settings.
4. **Charts: PASS.** Real data on Today (views, orders over 8 weeks, buyers funnel, top designs), Insights (views, orders, visitors, bars, collections, WhatsApp), Orders (14-day spark, net weight split by status), Activity/Visitors (designs-seen bars); numbers match the seed (24 views, 7 orders, 5 active buyers). Empty store (port 3963): sparks show a dashed baseline and "NO DATA YET", bars show "NO DATA YET", nothing invented (`maison-d1440-today-empty.png`, `-orders-empty.png`, `-visitors-empty.png`). Tooltips work: pointer over a spark shows a black tag with label and value ("This week 24", "3 Nov 7"). Draw-in: `.mxo-line` runs `mxo-draw`, bars run `mxo-grow`; under `prefers-reduced-motion: reduce` both report `animation: none` and the finished chart shows. Text is minimal. Gaps: Visitors has bars only (no time series); Today first paints "0.000 kg / 0 views" for about a second before the summary arrives (O7).
5. **Separate desktop and mobile designs: PASS.** 1440: sidebar, page rule, two-column layouts (needs-you beside this-week, 4-up design tiles, 3-up Insights sparks, form photos left and fields right). 390: top bar plus four-word bottom bar, single column, stacked actions. No horizontal overflow on any screen at either size.
6. **3D tab transitions: PASS.** `getComputedStyle(main)` sampled per frame: each owner tab change runs `mx-turn-fwd` / `mx-turn-back` with `matrix3d` on about 52 of 76 frames at 1440 and 390; direction reverses going back; Designs to Collections sub-tab runs `mx-push`. Five taps 90 ms apart ended with one `main`, transform none, opacity 1, correct active tab. With reduced motion: 0 matrix3d frames, only `fade-in`, same rapid-tap result.
7. **Classic owner pixel-unchanged vs 2ed2a17: PASS, with intended additions.** Same data, 44 screens at two sizes. 0 differing pixels on Today, Catalogue (4 tabs), Buyers (3), About, Plan, Compare plans, Insights, Password, PDF, View as a buyer, admin sign-in and Forgot password, at both sizes. Remaining differences, all explained: Orders and New orders (PO id digits wrap differently, 18-36 px taller; data), Alerts, Messages, Share sheet (clock text, port in the QR link), Store settings (+760 px: the new "Store layout" picker), Add design and Add collection (+50 px desktop, +92 px mobile: the new AI render switch and, at HEAD, the Enhance link). No regression from Maison work in Classic.
8. **tsc: PASS. vitest: PASS** (see the last line).

### AI render on Add design and Add collection
- **Wired and working: yes**, in Maison and Classic, at both sizes, on Add design and Add collection (banners too at HEAD). The "AI render" checkbox is present and ticked by default with the "original kept" text. A new upload shows the "Rendering your design - about a minute" overlay with timer and "Use original"; the Save bar says "Photo is uploading or rendering...". With the provider mocked to succeed (2.5 s delay) the photo is replaced, tagged "AI RENDER", and "REVERT TO ORIGINAL" appears; clicking flips to "USE AI RENDER" and back. Mocked 502: overlay clears, "AI render did not work for this photo ... Your original photo is used." shows, original stays, one call only. Real server with the provider off (no `AI_RENDER_ENABLED`): 503, "AI render is switched off on this server.", the checkbox unticks itself, the photo is kept. No call to Vertex AI was made anywhere (mock or disabled only). Screens: `maison-*-ai-{design,collection}-{off,mock,fail}-*.png`.
- **Keep**: the new-upload flow has Revert / Use AI render (swap). The explicit Keep choice is in the Enhance compare sheet ("Use AI render", "Keep original", "Discard"; `maison-*-enhance-mock-3-compare.png`).
- **Does it offer to alter an existing image? At a9aa774 no. At HEAD 4b9e084 yes, by design.** Commit 9a33cac adds an owner-initiated link "Enhance photo N to CAD render" / "Enhance to CAD render" under every photo already in the form, including the photos of a design being edited and existing collection and banner photos (`PhotoPicker enhance`). It never runs on its own: the render waits in a compare sheet, the original is kept, and nothing changes until the owner taps Use AI render and saves. That contradicts "must NOT offer to alter any existing image", so confirm that 9a33cac is wanted. With the provider off the link is replaced by "Enhance to CAD render is not available: AI render is switched off on this server." (verified after restarting the dev server; before the restart a stale server returned 404 for `GET /photos/render`, so restart long-running dev servers after this merge).
- Minor: the checkbox stays ticked when the server has the feature off; it only unticks after a failed first upload. Use the status endpoint to hide it.

### Defects
| # | Sev | File | Screenshot | Suggested fix |
|---|---|---|---|---|
| O1 | High | `src/layouts/maison/owner/content.css` line 109 (`grid-row: 1 / span 40` on the sticky photo column of `.scroll.no-tabs`) | `maison-d1440-add-design.png`, `maison-d1440-add-collection.png` (page 1987 px for about 1000 px of content; Classic 1251) | 40 implicit rows times the row gap inflate the page by about 1000 px of blank space, and the sticky Save bar scrolls up under the top bar at the bottom (Playwright could not click Save at 1440 because `.mxo-bar` covers it). Use `grid-row: 1 / -1` with `align-self: start`, or a two-column flex. |
| O2 | Med | `maison-owner.css` / `content.css` segmented bars (`catalogue-seg-*`) | `maison-d1440-catalogue-designs.png`, `maison-d1440-catalogue-banners.png`, `maison-m390-catalogue-collections.png` | Active tab is a black block with text touching its edges; add `padding-inline: 12px`, or use the underline style the Buyers tabs already use (those look right). |
| O3 | Med | `src/components/AdminStoreScreen.tsx` line 37 plus owner shell | `maison-d1440-plan.png` (Store page) | After choosing a layout the owner shell does not change until reload (module `merchant.layout` is mutated, nothing re-renders); the toast only says "Buyers now see...". Re-render from App state or say "Reload to preview". The active picker tile also shows a clipped black outline. |
| O4 | Low | `PdfCatalogueScreen` via `ScreenTop` | `maison-d1440-pdf.png` | Title in the store theme colour (dark red); back button box sits off-grid (x 478 on desktop). Force ink and align to the page column. |
| O5 | Low | `content.css` Activity section headings and intro text | `maison-d1440-buyers-activity.png` | "TIME IN APP" / "DESIGNS SEEN" are about 28px grey wide-tracked caps, off the 11-12px label scale; content stops at 880px while the page rule is 1048px; intro text is serif where body is Jost. Use `.mx-ey` labels and the page width. |
| O6 | Low | Maison owner Buyers row (mobile) | `maison-m390-buyers.png` | CALL / WHATSAPP / REMOVE stack with uneven gaps and sit above the name; align to one row. |
| O7 | Low | Today summary | first Today shot before load | "0.000 kg / 0 views" flash; show dashes until the summary loads. |
| O8 | Low | Collections tab (mobile) | `maison-m390-catalogue-collections.png` | Tiles are half width in one column with empty space on the right; make them full width 1-up or 2-up. |
| O9 | Info | AI render (`PhotoPicker enhance`) | `maison-*-enhance-mock-3-compare.png` | Decide on Enhance-existing-photo versus the no-alter-existing rule; hide the AI switch when the server reports it off. |
| O10 | Info | vitest config | | Bare `vitest run` also runs every `.claude/worktrees/*` copy (541 files); exclude `.claude/**`. |

### VERDICT: PASS (owner side), with O1 to fix before release
Rubric lines 1-8 hold. O1 is a visible layout bug on the two main create forms at desktop (blank tail, Save bar scrolls away) though both forms save correctly and work at 390. The AI render is wired and fails gracefully; O9 is an open product decision.

Vitest at 4b9e084 (`vitest run tests`, which still matched the worktree copies): Test Files  634 passed (634); Tests  5108 passed (5108), exit 0.


## 10. Round 3: buyer (HEAD c9b611c, branch feat/responsive-adaptive)

Scope: the user's last feedback (flush in-tile cards, type scale, 3D, no-hamburger header with tag index, banners, parity, Classic unchanged). Maison buyer, Classic and Bulgari reference at 390 and 1440. Screenshots: `docs/qa-maison/r3-qa/` (the builder's own proof in `docs/qa-maison/r3/` was not reused). Read-only on source. Tooling: `tests/e2e/server.ts` dev server (ports 3931/3932/3933), Playwright on Edge, seeded Bhakti demo plus 24 extra designs, a 120-character name, a broken-photo design, 4 banners. Frame times: rAF deltas, also with CPU throttled 4x (desktop) and 6x (phone).

### VERDICT: PASS (no blocker), 10 minor defects

| # | Item | Result | Evidence |
|---|---|---|---|
| 1 | Flush grid, text inside card | PASS. Large grid 1px gap (tiles 309px wide at 1440, 2 columns at 390), compact grid 3px gap. Name/weight/SKU sit on a white fade at the bottom of each photo. Same pattern on Home collection tiles (name and "12 designs . avg 42.5g - 110g" inside), Shortlist and Catalogue. Dark photo (Swiss coin) and light photos are both legible (dark ink on the white fade). 32 designs load, "Show more . 8 left" appears. Compact toggle works (6 columns at 1440, 3 at 390). Defects D2, D3, D5. | maison-d1440-catalogue.png, -catalogue-s1.png, -catalogue-grid3.png, m390-catalogue.png, m390-catalogue-grid3.png, d1440-shortlist.png, m390-home-s2.png |
| 2 | Type scale | PASS. Computed styles: display 63/78px (390: 36/40px) Cormorant 600, section 28/22px, card names 18/15px, body and meta Jost 12-14px 400/500, labels Jost uppercase 11-13px. Bold serif vs light sans separates clearly on Home, Catalogue, Product, Orders, Shortlist. Small-text floor broken: D4. | maison-d1440-product.png, m390-orders.png |
| 3 | 3D | PASS with one gap. First load: hero media `mx-hero-in` matrix3d fades 0 to 1 over about 1.1s, hero text `mx-layer-in` matrix3d, first design tiles `mx-tile-in` matrix3d. Tab changes: `mx-turn-fwd/back` matrix3d on main, opacity 0.2 to 1 over 800ms. Sub-tab (Orders To order/Past): `.mx-flip` matrix3d. Hover tilt follows the pointer (matrix3d, about 3deg rotateX/Y plus translateZ). Reduced motion: every change is `fade-in`, no matrix3d. Frame times: median 16.7ms, p95 16.9ms on all 12 transitions (tab, sub-tab, view toggle, 3000px scroll); throttled 4x/6x one hitch of 50-83ms on the first frame of a new page, otherwise at most 1 frame over 33ms. Gap: Home collection tiles reveal with 2D translateY(28px) plus fade, not 3D (D7). | maison-d1440-hover-tilt.png |
| 3b | Guided tour | PASS. 23 steps on desktop, 21 on phone (language and profile steps are optional and the phone header has no such control). Every spotlight sits on a real element (elementFromPoint at the hole centre returned lang-en, home-search, browse-collections, Catalogue tab, collection-picker, card-add-to-cart, shortlist-order-all, order-note-input, place-order, orders-tab-past, Profile menu). Not laggy: 0 frames over 33ms, max 17-18ms in every step. Minor: D8. | maison-*-tour-*.png |
| 4 | Header | PASS. No hamburger icon: desktop = search, language, wordmark, profile, heart, bag, row Home / Collections / Catalogue / About us; phone = "Collections" text button, wordmark, heart, bag. Collections opens the tag index (tag + count, collections with counts, "All designs") as a mega-menu on desktop and a full-height drawer on phone. Clicking "Bangles & Kadas" filtered the catalogue to 6 designs on both (chip "BANGLES & KADAS . 6"). Shortlist and Orders are header icons with count badges; Home, About us are in the desktop row and the drawer foot; profile menu (My order, Past orders, About, Take the app tour, Log out) is at the right on desktop and in the drawer foot on phone. D6. | maison-d1440-megamenu.png, m390-drawer.png, m390x844-drawer-bottom.png, *-collection-filter.png, d1440-profile.png |
| 5 | Banners | PASS with D1. Hero is built only from the store's Banners: with none, one plain slide (store name over the first collection photo) and no "Akshaya Tritiya" (that string lives only in `merchants/bhakti/merchant.json`, used by Classic; grep of `src/` and `shared/` is empty). With 4 banners: 5 children (4 plus a clone of slide 1), autoplay every 6s with an eased glide, at the clone it resets to 0 with no visible step (40s capture: one reset, from the clone), dots follow, touch drag left and right both snap, hover/touch pauses. | maison-d1440-home.png (fallback), maison-m390-banner-slide2.png |
| 6 | Parity | PASS. Welcome, sign in, OTP (dev code accepted, new number reaches "Enter your name"), search (QA-1005 gives 1 card), filter panel plus min weight (8 designs, chip, clear all), view toggle, product detail (breadcrumb, previous/next "Design 4 of 8", Gross/Stone/Net, WhatsApp, shortlist, add), purity sheet from a card, Orders line, qty stepper, note, Place order (PO-BHAKTI-..., "Send order on WhatsApp", "View past orders"), Past orders tab, Shortlist (hearts, Order all, WhatsApp, clear), About plus Report a problem (textarea, send, "Thank you, we have it."), language toggle (Hindi in header, drawer, collections, About; back to English). All at 390 and 1440. A page error shows on tab changes: D10. | maison-*-orders.png, -order-placed.png, -hindi.png, -report.png |
| 7 | Classic unchanged | PASS. Worktree `qa-scratch/base-2ed` at 2ed2a17 (node_modules junction kept) vs HEAD with layout=emergent, same seeded data, animations off: 18 screenshots (Home, Home scrolled, Catalogue x2, product, Orders, profile menu, guest Home, sign in; 390 and 1440) show 0 differing pixels (threshold 8/255). | qa-scratch/r3-cmp (outside repo) |
| 8 | Checks | `npx tsc --noEmit` exit 0. `npx vitest run`: 47 files, 374 tests passed. | |

### Defects (all minor; nothing blocks release)

| ID | Sev | File | Screenshot | Problem and fix |
|---|---|---|---|---|
| D1 | Med | `src/layouts/maison/Home.tsx` (hero slide img) | maison-m390-banner-slide2.png | Slides 2+ have `loading="lazy"`: still pending 4s after load, slide 2 loads only 1.6s after its dot is tapped, slide 3 never until visited. Autoplay and swipes land on an empty slide that pops in. Fix: `loading="eager"` (or preload the next slide) for every hero slide. |
| D2 | Low | `src/layouts/maison/ui.tsx` / `Catalogue.tsx` tile image | maison-d1440-catalogue.png (first tile) | A photo that fails to load shows the broken-image icon and alt text over a blank white tile (Classic shows a gold placeholder). Fix: `onError` swap to the tone placeholder. |
| D3 | Low | `src/layouts/maison/maison.css` `.mx-pt` | maison-m390-catalogue.png | A 120-character name takes 4 lines on desktop and 6 on phone and covers the jewellery. Fix: `-webkit-line-clamp: 2` (3 in list view). |
| D4 | Low | `maison.css` (tile `.mx-cta`, stock chip) | maison-d1440-catalogue.png | "ADD TO CART" 9px, stock chip 10px, phone "Collections" button 10px; the rest of the scale starts at 11-12px. Fix: 11px minimum. |
| D5 | Low | `maison.css` `.mx-pgrid.list` | maison-d1440-catalogue-list.png | List view on desktop is one 1244x363px tile per design, not compact (phone 350x153). Fix: cap near 160px or 2 columns. |
| D6 | Low | `src/layouts/maison/Header.tsx` MobileMenu, `.mx-menu-f` | m390x844-drawer-bottom.png | With 7 tags the drawer foot (Home, About us, Shortlist, Orders, profile/Log out) starts at y=870, below an 844px screen; reachable only by scrolling the drawer. Fix: sticky foot. |
| D7 | Low | `Home.tsx` Reveal, `maison.css` | m390-home-s2.png | Home collection tiles reveal 2D (translateY 28px) not 3D. Collections with 0 designs (Men's Chains, Mangalsutras, Jadau) are listed in Home tiles, mega-menu and drawer; consider hiding empty ones for buyers. |
| D8 | Low | `src/components/BuyerTour.tsx` steps featured, filter, picker | maison-d1440-tour-6.png | Featured hole is 844x1050 at y=-101 (cropped); desktop "filter" hole ends at x=1448 (8px past 1440); phone "picker" starts at x=-8. Fix: clamp the hole to the viewport or target the first tile only. |
| D9 | Info | `Home.tsx` hero | | Swiping right on slide 1 does nothing (no backwards wrap); forward loop is seamless. |
| D10 | Low | view-transition code in `src/App.tsx` | console | Uncaught "Transition was aborted because of invalid state. Animation start failed" after tab changes. Fix: catch the `startViewTransition` `ready/finished` promises. |

Not defects: desktop mega-menu "All designs" button sits alone in a grid cell with a stray underline (cosmetic); OTP card top padding is tight on phone.

Notes: dev servers stopped. `qa-scratch/` (outside the repo) holds the scripts (`r3-*.mjs`) and the Classic comparison pairs. No worktree removed; the node_modules junction in `qa-scratch/base-2ed` is intact.
