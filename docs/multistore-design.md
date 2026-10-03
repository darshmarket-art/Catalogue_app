# Multi-store core (Phase 4) design

One shared Cloud Run service serves many stores. Isolation is enforced by the data layer, not by each route.

## Store resolution (`server/tenancy.ts`, `storeIdOf`)
1. Host `[store].<BASE_DOMAIN>` (default `antarixs.com`): the subdomain is the store id and cannot be overridden by a header.
   A reserved or invalid label (`www`, `console`, `api`, `app`, `admin`, ...) resolves to no store, so 404.
2. Otherwise the `X-Store` header or `?store=` (localhost, installed apps, tests).
3. Otherwise `DEFAULT_STORE` (defaults to the `MERCHANT` env, i.e. `bhakti`): the existing run.app URL keeps serving Bhakti.
Names: 3 to 30 characters, `a-z 0-9` and inner hyphens; reserved list in `shared/storeName.ts` (shared with signup in Phase 6).
Unknown store: 404. `status != active`: 403. `/health` and `/api/app-config` need no store.

## Store record
`stores/<id>` (the only top-level data): `{ id, subdomain, status, plan, trialEndsAt, ownApp, owner, merchant, createdAt }`.
`merchant` is the full validated merchant config (brand, theme, WhatsApp number, orders, fields...). `merchants/<id>/merchant.json`
stays as the seed: the default store's record is created from it on first use, and tests/dev use it. Records are cached
`STORE_CACHE_MS` (15 s; 0 under test); a changed `merchant` rebuilds that store's app, a changed plan applies immediately.
Entitlements (`plan`, `trialEndsAt`, `ownApp`) are read from the record; Bhakti is `founder` (permanent Pro).

## Data layout
Every collection is namespaced: `stores/<id>/<collection>/<doc>` (Firestore sub-collections). `scopeStore(root, id)` is the only
Store the routes ever receive; it prefixes every call and rejects collection names that are not `[A-Za-z0-9_]+`. There is no way
to name another store's collection from a route. Firestore TTL policies are per collection group, so existing TTLs (otps, sessions)
still apply. No new composite indexes (queries are unchanged).

## Photos and signed links
`scopeBlobs(rootBlobs, id)` prefixes every object: `stores/<id>/photos/<file>`. Signed `/media` links are HMAC-signed with a
per-store secret, so a link from store A fails (403) on store B, and B's namespace does not hold A's bytes anyway.

## Auth
Per-store signing secret `HMAC(JWT_SECRET, "store:"+id)`; tokens also carry `storeId` (and `iss` = store id), checked on every request.
A token from store A is refused (401) on store B. The default store keeps the root secret and accepts tokens issued before
multi-store (no `storeId`), so signed-in Bhakti users and installed apps are not logged out at cut-over.

## Rate limits, OTP, caps
Each store has its own Express app instance, so express-rate-limit counters (API, auth, OTP-by-IP, analytics) are per store.
OTP documents, resend cooldowns, per-phone limits and the daily cap (`otpDaily`) live in the store's namespace, so are per store.

## Request flow
`createApp(config, rootStore, rootBlobs, sender)` = global layer (helmet, CORS incl. `X-Store`, `/api/v1` alias, min app version,
logging, JSON, health) + resolver middleware that hands the request to the cached per-store app (`createStoreApp`).
Anything the store app does not handle (the SPA, static files) falls through; `server.ts` renders `index.html` with
`res.locals.merchant`, so title, colours and embedded config are per store.

## Migration (Bhakti = store 1) and export
`scripts/migrate-multistore.ts` (core in `server/multistoreMigration.ts`): copies every legacy top-level collection to
`stores/bhakti/<col>`, `photos/*` to `stores/bhakti/photos/*`, creates the `stores/bhakti` founder record (from the bucket's
`merchant.json` if present, else the repo file). Dry run by default; `--apply` needs `--confirm-project <id>`; reads legacy data only, never deletes.
Idempotent; `--overwrite` re-syncs for the final pass. `scripts/export-store.ts` dumps one store (all its collections + record) to JSON.

## Out of scope here
Wildcard DNS/LB (Phase 5), signup (Phase 6), console (Phase 8), per-store icons/PWA assets for non-seeded stores, per-store native app config.
