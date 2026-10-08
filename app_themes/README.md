# app_themes: archived storefront layouts

Emergent is the only live storefront layout (every store, every plan). This folder keeps retired layouts so they can be restored.
It is NOT built: it is excluded from `tsconfig.json` and `.dockerignore`, nothing imports it, and Vite never reaches it.

## gilded/
Taken from commit `7924bc2` (branch `saas/layouts`), as it was before removal.
- `components/`: Header, BottomNav, WelcomeScreen, CategoriesScreen, CatalogueScreen, ShortlistScreen, OrdersScreen, AboutScreen, ProductDetailSheet
- `layouts/gilded.ts`: the kit (written when `LayoutKit` lived in that file; the prop types now live in `src/layouts/props.ts`)
- `gilded.css`: copy of `src/gilded.css` (still the live base stylesheet, imported by `src/index.css`)

## Restore
1. Copy `gilded/components/*` to `src/components/` and `gilded/layouts/gilded.ts` to `src/layouts/gilded.ts`.
2. In `gilded.ts`, import `LayoutKit` from `./props` and delete its local `LayoutKit`/`CatalogueProps` types (props.ts has them).
3. Add `'gilded'` to `LAYOUT_IDS` and `LAYOUTS` in `shared/layouts.ts`, and a `layout` field (`z.enum(LAYOUT_IDS).default(...)`) back to `merchantSchema` in `server/merchant.ts`.
4. In `src/App.tsx` replace the direct `emergent` import with a kit lookup by `merchant.layout`. Re-add an owner picker or console action as needed (see git history before this change for `LayoutPickerScreen`, `server/routes/layout.ts`, `effectiveLayout`).
5. Diff `gilded/gilded.css` against `src/gilded.css` in case the base styles moved on.
