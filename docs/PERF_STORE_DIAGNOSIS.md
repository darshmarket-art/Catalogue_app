# Bhakti Jewels storefront: why "load all products" is slow

Date: 2026-11-03. Branch feat/responsive-adaptive (= main). Read-only investigation: GET requests, Cloud Logging / Cloud Monitoring reads, one Firestore count aggregation (no document bodies), a local build into a temp folder and a local seeded server (ports 4411/4412).

## 1. Verdict

The slowness is a **server data-access problem, not a front-end or image problem**.

Bhakti has **20,568 products** in Firestore (count aggregation on `stores/bhakti/products`). The server has **no cache and no query pushdown**: every product request does `store.list('products')`, which reads all 20,568 documents from Firestore, then filters, sorts and slices 24 of them in Node memory.

- `server/routes/catalogue.ts:245` (`GET /products`) and `:229` (`GET /products/by-sku`) call `store.list('products')`.
- `server/store.ts:171-183` (`FirestoreStore.list`) has no limit and no caching.
- `server/entitlements.ts:27` (`photosInUse`) reads all products on every call. `GET /api/entitlements` (`server/app.ts:238-240`) calls it for every visitor, and `ent.assertPhotos` calls it on every product save.
- `GET /categories` (`catalogue.ts:59`) reads all products only to count designs per category.

Measured on production (Cloud Logging, `bhakti.antarixs.com`, last ~7 h, 4000 requests):

| Endpoint | n | p50 | p90 | max |
|---|---|---|---|---|
| `GET /api/v1/products?...limit=24` (one page of 24) | 67 | **2.57 s** | ~8 s | 19 s |
| `GET /api/v1/products?` (boot, default limit 200) | 42 | **4.85 s** | ~11 s | 19 s |
| `GET /api/v1/entitlements` | 34 | **5.13 s** | 11.7 s | 19 s |
| `GET /api/v1/analytics/insights` | 31 | 2.90 s | 7.7 s | 18.5 s |
| `GET /api/v1/products/by-sku` (1 SKU) | ~9 | **6.8 to 14 s** | | |
| for comparison: `/media/*`, `/api/v1/about`, `/tags`, `/purities`, `/health` | | 0.00 to 0.17 s | | |
| for comparison: `app.antarixs.com` small store, same endpoints | 1 | 0.07 s (page), 0.18 s (200 items) | | |

Firestore read volume (Cloud Monitoring `document/read_count`, last 24 h): **5,533,099 reads** (the "~101,933/day" seen earlier is now 54x higher). Peak hour was 1.41 M reads, about 68 full-collection scans of 20,568 docs. Every extra page the buyer scrolls costs another 20,568 reads.

Cloud Run shows the consequence. At 07:16:27 UTC, `products`, `categories`, `entitlements` and `insights` returned **503 after 14 to 19 s**, with "malformed response or connection error" and `Container terminated on signal 6` (the container aborted; most likely out of memory or an event-loop stall while 512 Mi held many 20k-doc lists at once). That restart then costs a cold start (below).

## 2. What the buyer sees: request waterfall

Boot of a signed-in buyer (local run, Chrome, 4x CPU slowdown, 1.6 Mbps / 150 ms RTT; local server so API time ~0.2 s; prod adds the latencies in section 1):

```
   0  -  170 ms  GET /                      (HTML, 3.5 KB gz, no-cache)
 220  -  460 ms  3 x fonts.googleapis.com CSS   (render-blocking <link>s in index.html:22-23, + merchant font CSS)
 228  - 1606 ms  /assets/main-*.js  127 KB gz   (+ react/lucide chunk 67 KB gz, modulepreloaded)
 233  - 1010 ms  /assets/main-*.css  38 KB gz
1846 -  2027 ms  GET /api/v1/auth/me                       } all fired together once JS runs
1849 -  ...      POST /analytics/heartbeat                  }
1851 -  2053 ms  GET /categories                            }  (App.tsx:334, Promise.all)
1852 -  2085 ms  GET /products?   (no limit => 200 items)   }   Home waits for the SLOWEST
1855 -  2038 ms  GET /banners, /about                       }
1861 -  2196 ms  GET /entitlements                          }
2110 -  2284 ms  GET /orders (402)
2340 -  2657 ms  GET /purities, /tags, /shortlist  (second wave)
```

- Calls are mostly parallel (good), but the **Home screen is gated on `Promise.all([getCategories, getProducts, getBanners, getAbout])`** (`src/App.tsx:334`, `catalogueReady` at `:316-348`, `loading={!catalogueReady}` at `:972`). In production the slowest member is `/products?` (p50 4.85 s, p90 ~11 s), so Home shows placeholders for that long. Locally the same gate costs ~250 ms.
- That boot `getProducts()` (`src/api.ts:467`, no params, so the server default `limit=200`, `server/schemas.ts:104`) downloads 200 products (23.6 KB gz in prod) only to serve the "recently viewed" strip on Home (`src/layouts/maison/Home.tsx:108`, at most 8 SKUs) and the shortlist (which already has its own `by-sku` fallback, `App.tsx:374-395`). It is pure waste.
- Opening the catalogue tab: one request, `GET /products?sort=newest&limit=24&offset=0` (3.5 KB). Locally 190 to 290 ms; **in prod p50 2.6 s** (from logs). The catalogue is **paginated**: PAGE = 24 (`src/layouts/emergent/useCatalogue.ts:17`), IntersectionObserver sentinel with `rootMargin: 480px` (`:179-181`), cursor paging. So the client does not download all products when browsing. Each further page is another full 20k scan (~2.5 s in prod), so fast scrolling stalls on the server.
- Scrolling all 200 local products took 9 product calls; 2,365 DOM nodes at 200 cards (~11 per card); TBT about 190 to 320 ms at 4x CPU; JS heap 9 MB. Not a bottleneck.
- Reads per buyer session on prod (scans of the 20,568-doc collection): boot `/products` (1) + `/categories` (1) + `/entitlements` (1) + first page (1) + one per extra page + `by-sku` (1) = roughly 5 plus the pages scrolled, so **~100k to 200k+ Firestore reads per buyer visit**.

## 3. Root causes, ranked by impact

| # | Cause | Evidence | Impact |
|---|---|---|---|
| 1 | Full-collection scan of 20,568 products on every list request, filter/sort/page in Node | `catalogue.ts:245`; prod p50 2.6 s per 24-item page; 5.5 M reads/24 h | Dominant. Every page and every scroll step pays ~2.5 s (more under load) |
| 2 | Same scan hidden in other boot calls: `/entitlements` (usage -> photosInUse), `/categories` (designCount), `/products/by-sku` | `entitlements.ts:27,53`, `catalogue.ts:59,229`; p50 5.1 s, 2.7 s, 6.8 to 14 s | Boot is 3 to 4 scans before the buyer sees anything |
| 3 | Boot fetches 200 products it does not display (`getProducts()` with no limit) and gates Home on it | `App.tsx:334`; `/products?` p50 4.85 s | Home blank/skeleton for ~5 s (p90 ~11 s) |
| 4 | CPU-bound request handling blocks the single Node event loop; search is the worst | Local, 20,568 docs, no network: plain page 0.3 s; **search `necklace` 1.05 s** (the server runs `toHindi()` on title/category for every product on every query, `server/sectors/jewellery.ts:81-86`). 20 concurrent searches finish at 1.3, 2.1, 2.8 ... **14 s**, serially | Reproduces the 8 to 19 s tail latencies. Concurrency 80 on 1 vCPU makes every user wait for everyone |
| 5 | Memory pressure / crashes: each request materialises 20k docs on a 512 Mi container | 503 burst + `signal 6` at 07:16 UTC | Dropped requests, restart, cold start |
| 6 | Cloud Run has no warm instance: min instances unset (0) | `gcloud run services describe`: only `maxScale=3`, `startup-cpu-boost=true`, cpu 1, 512Mi, concurrency 80, timeout 300 | Cold start measured at 2.0 to 3.9 s on first request of 24 instances in 7 h (7 of them from deploy rollouts today), see section 5 |
| 7 | Fonts: Material Symbols font 1.14 MB (for ~10 icons) plus Noto Sans Devanagari 120 KB loaded on the login/Welcome screen; 3 render-blocking Google Fonts CSS links; Maison fonts added late from JS | Local trace: font bytes 230 KB to 1.38 MB per load; CSS links at 220 to 460 ms before first paint; `index.html:22-23`, `App.tsx:150-154`, `Welcome.tsx:33,67` | On a 1.6 Mbps link the 1.14 MB font alone is ~5.7 s of shared bandwidth; delays FCP by ~0.3 s |
| 8 | Boot splash gating: Maison chunk (58 KB js, 87 KB css, 13 KB gz css) only requested after main.js executes; `booting` waits for `/auth/me` | `App.tsx:146,245-258,833` | ~0.3 to 0.6 s extra before any UI on a slow link |
| 9 | Image caching: `Cache-Control: private, max-age=21600` and signed URLs that rotate every 6 to 12 h | `server/routes/photos.ts` mediaRoute, `server/media.ts:14,45-48`; no CDN; SW excludes `/media/` | Every photo is re-downloaded twice a day per device; each miss costs 3 GCS calls (`blobs.ts:77-83`: exists + download + getMetadata) |

## 4. Images (not the main cause, but worth fixing)

What is already good:
- Grid cards use `srcset` + `sizes` (`src/photoSrcSet.ts`, `src/components/ui.tsx:25`), widths 240/480/960/1440 (`shared/photoSpecs.ts:78`), `loading="lazy"`, `decoding="async"`.
- Server resizes on first request with sharp to WebP q78 and stores the result in the bucket under `thumbs/` (`photos.ts` thumbnail()), so later hits are just a GCS read.
- Uploads are shrunk to max 2400 px at q85 (`photos.ts` optimisePhoto), 25 MB upload cap.

Production `/media` numbers (1,520 requests, 7 h): `w=960` p50 0.17 s / avg 17 KB (1,328 hits), `w=1440` avg 24 KB, `w=480` avg 8 KB but **p90 2.0 s** (first-hit thumbnail generation in the request: GCS get + original download + sharp + put), and `orig` (no `w`) **avg 561 KB, max 1.33 MB** (34 hits, probably zoom/detail viewer). Photos are therefore well sized; the 6 to 12 hour link rotation and the missing CDN are the only delivery issues. There is no per-request watermarking.

Local note: 24 first-screen cards at 4x CPU / 1.6 Mbps painted all visible images in ~3.6 s, dominated by my deliberately noisy test photos (118 KB each at 480 w; real photos average 8 KB), so treat the local image timing as pessimistic. Local first card appeared at 390 to 530 ms after the tab tap.

## 5. Cloud Run, network, PWA

- Region asia-south1 (Mumbai): good for India. HTTP/2 negotiated (ALPN h2). Brotli on (`content-encoding: br`; main.js 460 KB raw -> 126 KB br / 131 KB gzip). Hashed assets `public, max-age=31536000, immutable`; HTML `no-cache`; HTML TTFB 95 to 220 ms warm.
- Service: 1 vCPU, 512 Mi, concurrency 80, maxScale 3, `startup-cpu-boost` on, no min instances, request-based CPU (no `cpu-throttling` annotation, so the default), STORE_CACHE_MS=15000 (tenancy record cached 15 s, so the per-request tenancy lookup is cheap, `tenancy.ts` resolve()).
- Cold start: first request on a fresh instance took 2.0 to 3.9 s (24 instances seen in 7 h). `GET /` p50 20 ms and `/health` ~0 ms once warm, so the app itself boots quickly; the cost is container start.
- Per-request auth adds one Firestore `get` (`server/auth.ts` resolveUser): small.
- Service worker (`public/sw.js`): caches only `/assets/*` and `/pwa/*`, never API or `/media`, navigations are network-first. It does not help repeat visits for data or photos, and does not hurt.
- No CDN or load-balancer cache in front of API or media.

## 6. Client bundle (production build into a temp folder)

Critical path JS: `main` 460 KB raw / 132 KB gz, `createLucideIcon` (react vendor) 213 KB / 67 KB, `dist` + `jsx-runtime` + `rolldown-runtime` ~6 KB gz; CSS `main` 224 KB / 37 KB gz. Maison chunk 58 KB / 15 KB gz + CSS 87 KB / 13 KB gz. Lazy, off the critical path: jspdf 399 KB / 130 KB gz, html2canvas 199 KB / 47 KB gz, console, purify, index.es. About 250 KB gz of code before first render for a Maison store. This is acceptable; it is not why catalogue loading is slow.

Local run (4x CPU, 1.6 Mbps/150 ms; local API so the server cost is excluded): FCP ~1.1 s, LCP 3.2 to 3.6 s (splash/home, bandwidth-bound by main.js + fonts), TBT ~150 to 290 ms. In production add the API gate from section 2 (about +2.5 to 5 s median to reach a populated Home, +2.6 s for the first catalogue page).

## 7. Prioritised fix list

| Pri | Fix | Expected gain | Effort |
|---|---|---|---|
| P0 | **Stop scanning on every request.** Either (a) Firestore queries with `where(category)`, `orderBy(createdAt desc)`, `limit`, `startAfter(cursor)` (add composite indexes; `store.list` already supports `where/orderBy/limit/startAfter`) and a count via aggregation or a stored counter; or (b) a per-store in-memory slim index (id, sku, title, category, purity, netWt, stockStatus, createdAt, searchText precomputed once, ~4 MB for 20k) loaded once, invalidated on product writes (and TTL 60 s for multi-instance), then fetch only the 24 full docs by id (`getAll`). Precompute `searchText` including Hindi at write time. | Page request 2.6 s -> ~20 to 80 ms. Firestore reads 5.5 M/day -> ~tens of thousands. Removes the 503/OOM bursts | M |
| P0 | Fix the other scanners: `by-sku` -> `where('sku','in',chunk)` or doc-id `getAll`; `/categories` designCount from a stored counter or the same index; `/entitlements` usage (photosInUse) only for the admin, or cached 5 to 10 min, never in the public boot call; `ent.assertPhotos` -> counter | `/entitlements` 5 s -> <100 ms, `/categories` 2.7 s -> <100 ms, `by-sku` 7 to 14 s -> <100 ms | S to M |
| P1 | Remove `api.getProducts()` from boot (`App.tsx:334`). Fetch the <=8 recent SKUs through `getProductsBySku` after Home paints; do not gate `catalogueReady` on products | Home ready in ~max(categories, banners, about) instead of the slowest product call: -2.5 to -10 s on prod today (still -0.2 s after P0) | S |
| P1 | Cloud Run: set `--min-instances=1` now (keeps one instance warm), raise memory to 1 Gi and use `--cpu-boost`; lower `--concurrency` (e.g. 20) until P0 ships. Revisit after P0 | Removes the 2 to 4 s cold starts and the OOM restarts; stopgap only | S |
| P1 | Fonts: replace the 1.14 MB Material Symbols font with inline SVG icons (or `icon_names=` subsetting in the Google Fonts URL); load only the font families the current layout uses; add `font-display: swap`/`preload` for the two used faces; move the Maison fonts into `index.html` for Maison stores | -0.3 s FCP, -1.1 to -1.3 MB on the Welcome/login screen | S |
| P2 | Images: use stable, long-lived links (or a `/media` cache key independent of the 6 to 12 h signature window) with `Cache-Control: private, max-age=31536000, immutable`; pre-generate 480/960 thumbnails at upload; put Cloud CDN / the load balancer in front of `/media`; GCS `get` -> one `download()` with metadata instead of 3 calls | Repeat visits: ~0 KB image traffic; first-hit thumbnails p90 2 s -> 0.2 s | M |
| P2 | Preload the Maison chunk from `index.html` (modulepreload when the merchant layout is maison) and start `/auth/me` plus the catalogue calls from an inline script before main.js finishes | -0.3 to -0.6 s | S |
| P3 | Virtualise or `content-visibility: auto` the product grid (2,365 nodes at 200 cards); cap `limit` to 24 for boot calls; cache `/media` in the service worker | Smoother long scroll, minor | S to M |
| P3 | Cursor paging: `list.findIndex(createdAt===cursor && id===cursorAfter)` is O(n); with P0 use Firestore `startAfter` | Minor once P0 is done | S |

Suggested order: P0 data access (biggest win by far, also cuts cost and crashes), then the P1 boot change and min-instances, then fonts and image caching.

## 8. Method and caveats

- Prod numbers come from Cloud Logging `httpRequest.latency` on service `catalogue-app` (asia-south1), the newest 4000 requests (01:10 to 07:57 UTC on 2026-11-03), and Cloud Monitoring `firestore.googleapis.com/document/read_count`. Today had several deploy rollouts, which add cold starts. The prod catalogue is login-gated (`catalogueAccess: login`, `/api/v1/products` answers 401 anonymously), so no buyer credentials were used; browser timings are from a local seeded server (example store, 200 then 20,568 synthetic products, memory store) running the production client build.
- Local 20,568-doc test uses the in-memory store, so it understates real Firestore latency (network + protobuf decode); the 2.6 s per page in prod is the authoritative number.
- Not measured: Lighthouse score (not installed; Chrome + CDP throttling used instead), real-device Wi-Fi/4G, Firestore document byte size.
- Stray leftover: the temp run folder under `%TEMP%\perf` may remain if a local server process still holds it open; it is outside the repo and safe to delete.
