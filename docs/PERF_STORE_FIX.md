# Store speed fix: what changed (2026-11-03)

Spec: `docs/PERF_STORE_DIAGNOSIS.md` (in the main checkout). Cause: every product request read the whole `products` collection (20,568 docs for Bhakti) and filtered, sorted and sliced in Node.

## What changed

Server
- `server/catalogueIndex.ts` (new).
  - **Control doc** `stores/<id>/settings/catalogueStats`: exact `total`, `byCat` (designs per collection name) and `rev` (+1 on every product write). Each product write and the doc change commit in ONE `Store.transact`.
  - **In-memory slim index** per store, built lazily from one scan and updated by this instance's own writes. Another instance's write shows up as a `rev` change in the control doc (1 document read per request) and triggers a rebuild. Memory budget `CATALOGUE_INDEX_MAX_ENTRIES` (default 300,000 entries across stores, LRU eviction). A store too big to index falls back to the old scan.
  - A missing, `stale` or old-`v` control doc is rebuilt by one scan (single-flight, `rev`-guarded so a racing write forces a re-scan, never a wrong count).
- `GET /products` filters/sorts/counts on the index, then fetches only the page's documents by id. Offset and cursor paging unchanged.
- `GET /products/by-sku` uses the index (ids by SKU), then `getMany`.
- `GET /categories` designCount, `/entitlements` usage and photo counts read the control doc / index instead of scanning.
- All product writes (create, edit, delete, collection rename and delete, bulk import) go through `CatalogueStore`. New `POST /products/bulk` (1 to 50 designs, one transaction).
- Console: "Recount store" per store (rewrites the control doc only, audited).

Client
- Boot no longer calls `getProducts()` (the 200-product fetch) and Home is no longer gated on it. After Home is ready it fetches the recent SKUs (`by-sku`) and one page of 24 in the background. The per-collection PDF on the Classic Home now fetches that collection from the server.
- `src/components/MIcon.tsx`: inline SVG icons replace the 1.14 MB Material Symbols font (and its Google Fonts link). Same glyph names: `close, chevron_left, chevron_right, add, remove, verified, local_shipping, scale`; any other name falls back to the stroke icon of the same name (`Icon`), blank if none. A store whose `welcome.features[].icon` uses another Material name needs that path added to `MIcon.tsx`. (`app_themes/` is archived and not built; untouched.)
- Maison chunk preload: the chunk is now named `maison-<hash>`; `renderIndexHtml` adds `modulepreload` (js) and `preload as=style` (css) to `<head>` for `layout: "maison"` stores (reads `dist/assets` once per process; nothing in dev/tests).

## Migration (existing stores, including Bhakti)

No migration is strictly required: a store with no control doc builds it on its first product request (one scan, single-flight). Bhakti's first request after deploy would pay that scan (about 20k reads, once). To pre-build it instead, with nothing at risk:

1. Dry run (read-only: scans products, reads the control doc, prints drift; writes nothing):
   `GOOGLE_CLOUD_PROJECT=<project> npx tsx scripts/recount-stats.mjs --store bhakti` (or `--all`)
2. Apply (rewrites ONLY `settings/catalogueStats`, never a product; idempotent, re-running is harmless; refuses unless the project id is confirmed):
   `GOOGLE_CLOUD_PROJECT=<project> npx tsx scripts/recount-stats.mjs --store bhakti --apply --confirm-project <project>`
3. Or use the console "Recount store" button for one store.

Run it right after deploying (writes made by the OLD revision between recount and rollout are not counted; the doc's `rev` does not move for them, so run it after the new revision takes 100% traffic, or just re-run). Rollback: old code ignores the doc; deleting `settings/catalogueStats` is safe (rebuilt on demand). Not run against production by this change.

## Firestore indexes

None new. The index serves filters, sorts and search; Firestore only sees `get` by id, `getAll` by ids, and the single-field `category ==` equality used by collection rename/delete (automatic index). The old scan path (fallback for oversized stores) needs none either.

## Tests

`tests/catalogueIndex.test.ts` (counter correctness over every write path, concurrency, lazy rebuild, race during scan, isolation, memory cap, index vs old `applyQuery` including ties and after writes), `tests/catalogueApi.test.ts` (HTTP: pages, cursor and counts identical to the old path for filters, sorts and search; read counts O(page); second instance sees writes; recount). Support: `tests/countingStore.ts`, `tests/catalogueData.ts`.

## How to re-measure

Local, nothing touches GCP: `PORT=4511 N=20568 npx tsx scripts/bench-serve.ts`, then `BASE=http://127.0.0.1:4511 node scripts/bench-http.mjs`. Local (in-memory store) results with 20,568 products after the fix: cold first request 661 ms (one-time build), page 4 ms, next page 2 ms, search "necklace" 5 ms, Hindi search 6 ms, by-sku 1 ms, /categories 1 ms, /entitlements 1 ms, 20 concurrent searches 96 ms wall. Before (diagnosis, same data): page 0.3 s, search 1.05 s, 20 concurrent searches 14 s.

In production compare Cloud Logging `httpRequest.latency` for `/api/v1/products` (before p50 2.57 s, entitlements 5.13 s, by-sku 6.8 to 14 s) and Cloud Monitoring `firestore.googleapis.com/document/read_count` (before 5.5 M per 24 h). Expect reads to drop to the product pages fetched plus about one control-doc read per request.

## Not done here

Cloud Run settings (min-instances 1, 1 Gi, lower concurrency), image caching/CDN, and self-hosted web fonts (Google Fonts links remain) are separate items in the diagnosis.
