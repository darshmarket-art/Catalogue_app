# Go-live runbook: Bhakti single-store -> Antarixs multi-store

Cut-over from today's live service (`catalogue-app`, asia-south1, Bhakti only, legacy top-level collections) to the multi-store build. The owner runs every step; nothing is automated. Assumed shell setup:
```sh
export P=gen-lang-client-0273003651 R=asia-south1 SVC=catalogue-app
gcloud config set project $P
```
Principles: legacy data is never modified or deleted; the old revision stays pinned for instant rollback; the new build is safe without DNS because the `run.app` URL keeps serving Bhakti (`DEFAULT_STORE=bhakti`), which is what the installed Android app and signed-in buyers use.

## Order relative to the load balancer runbook
1. Sections 0-5 below (build, env, secrets, Firestore checks, migration, canary), all on the `run.app` URL.
2. `docs/load-balancer-runbook.md` steps 0-8 and its DNS rows. Wildcard only: `antarixs.com` and `www` stay at Hostinger WordPress. Needs the new build at 100% first, because only it can resolve store subdomains.
3. Section 6 smoke tests again, on the real subdomain.
4. Load balancer step 9 (lock ingress) is OPTIONAL and LAST. It breaks the `run.app` URL used by the installed Android app (`VITE_API_BASE`), the Cloud Scheduler trial sweep (`SWEEP_AUDIENCE`) and any webhook. Skip it until the Android app ships with a subdomain base URL and the scheduler targets the LB host.

## 0. Pre-flight (no changes)
- On the release commit: `npm ci && npm run lint && npm test && npm run build` all clean.
- Record the live revision, call it `OLD_REV`: `gcloud run revisions list --service=$SVC --region=$R` and `gcloud run services describe $SVC --region=$R --format="value(status.traffic)"`.
- Confirm a recent Firestore backup: `gcloud firestore backups list --location=$R`. Photos are copied, never moved, so no bucket backup is needed.
- Confirm the Bhakti admin password rotation (open item in the GCP verification notes).

## 1. Environment variables and secrets
| Var | Value | Notes |
|---|---|---|
| `NODE_ENV` | `production` | set by the Dockerfile |
| `STORE` | `firestore` | production default; `memory` and `file` are refused at boot |
| `BASE_DOMAIN` | `antarixs.com` | stores live at `[id].antarixs.com`; bare domain and `www` get 404 JSON from the app |
| `DEFAULT_STORE` | `bhakti` | store served on the `run.app` URL and to old installed apps |
| `STORE_CACHE_MS` | `15000` | store-record cache; plan or suspend changes show within this time |
| `STORAGE_BUCKET`, `MIN_APP_VERSION`, `LATEST_APP_VERSION` | existing | unchanged |
| `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_OTP_TEMPLATE` | see `docs/whatsapp-setup.md` | optional `WHATSAPP_OTP_LANGUAGE`, `WHATSAPP_API_VERSION`, `OTP_DAILY_CAP` |
| `WHATSAPP_ORDER_TEMPLATE`, `WHATSAPP_TRIAL_TEMPLATE`, `ALERT_DAILY_CAP` | optional | owner order alerts and trial reminders; unset = off |
| `OTP_STATIC_CODE` | 6 digits, TEMPORARY | Only while the Meta template is not approved. Every OTP then equals this code and nothing is sent, so anyone who knows it can sign in as any phone number. Closed testing only; remove before real buyers |
| `CONSOLE_ADMINS` | comma list of Google emails | who may use `console.antarixs.com` |
| `IAP_AUDIENCE` | `/projects/<number>/global/backendServices/<id>` | known once IAP is enabled on the console backend (LB runbook, console note) |
| `SWEEP_AUDIENCE` | the public `run.app` URL | exact scheduler target; see `docs/trial-lifecycle.md` |
| `SWEEP_SERVICE_ACCOUNT` | scheduler service account email | only this account is accepted |
| `VAPID_PUBLIC_KEY`, `VAPID_SUBJECT` | public key, `mailto:` address | web push; the private key is a secret |

Secrets (Secret Manager, mounted with `--update-secrets`, never in the repo or plain env): `JWT_SECRET` (existing; DO NOT CHANGE, it is the Bhakti signing key and changing it logs everyone out and breaks photo links), `MASTER_PROVISIONING_KEY` (existing), `WHATSAPP_TOKEN`, `VAPID_PRIVATE_KEY`. Grant the Cloud Run service account `roles/secretmanager.secretAccessor` on each.

Deploy the new revision with no traffic and a private test tag:
```sh
gcloud run deploy $SVC --region=$R --source=. --no-traffic --tag=next \
  --update-env-vars=BASE_DOMAIN=antarixs.com,DEFAULT_STORE=bhakti,STORE_CACHE_MS=15000,CONSOLE_ADMINS=<emails>,SWEEP_AUDIENCE=<run.app url>,SWEEP_SERVICE_ACCOUNT=<sa> \
  --update-secrets=WHATSAPP_TOKEN=whatsapp-token:latest,VAPID_PRIVATE_KEY=vapid-private:latest
```
Alternatively push to `main` and let the Cloud Build trigger build the `Dockerfile`, then set the vars and secrets in the console. There is no `cloudbuild.yaml`; the trigger builds the `Dockerfile`, which runs `npm run build` (client including `console.html`, plus `dist-server`). `OLD_REV` keeps 100% traffic until section 5. Check `https://next---catalogue-app-456376852191.asia-south1.run.app/health`.

## 2. Firestore TTL and index checks for `stores/<id>/<collection>`
TTL policies are per collection group, so existing policies cover the nested documents.
```sh
gcloud firestore fields ttls list --database='(default)'
```
Expect an `expireAt` TTL on the collection groups `sessions`, `productViews`, `activityEvents` and `otps`. Add any missing one deliberately: `gcloud firestore fields ttls update expireAt --collection-group=<name> --enable-ttl`. No new composite indexes are needed (queries are unchanged); `gcloud firestore indexes composite list` should show nothing new required. The only top-level collection is `stores` (store records).

## 3. Migration: dry run, apply, overwrite pass
Run from a machine with application-default credentials. It reads legacy collections and writes only `stores/bhakti/*`, photo copies under `stores/bhakti/photos/*` and the `stores/bhakti` record.
```sh
npx tsx scripts/migrate-multistore.ts --store bhakti                                  # dry run, read the report
npx tsx scripts/migrate-multistore.ts --store bhakti --apply --confirm-project $P     # copy (can be days before cut-over)
npx tsx scripts/migrate-multistore.ts --store bhakti --apply --confirm-project $P --overwrite   # final re-sync, immediately before the canary
```
Compare the per-collection counts in the report with the Firestore console (buyers, admins, products, purchaseOrders and the rest). The old revision keeps writing to the legacy collections until it stops serving, so the `--overwrite` pass goes right before the 5% step. Do NOT run `--overwrite` after traffic has moved (it would replace newer data in `stores/bhakti` with legacy copies). `scripts/export-store.ts` dumps one store to JSON for a spot check or an emergency copy.

## 4. Verify on the tagged URL (0% traffic)
`BASE_URL=https://next---catalogue-app-456376852191.asia-south1.run.app STORE=bhakti npx tsx scripts/smoke.ts`, then the manual list in section 6 against the same URL.

## 5. Canary and rollback
Run the final `--overwrite` pass (section 3), then:
```sh
NEW=<name of the new revision>
gcloud run services update-traffic $SVC --region=$R --to-revisions=$OLD_REV=95,$NEW=5     # canary 5%, watch ~30 min
gcloud run services update-traffic $SVC --region=$R --to-revisions=$OLD_REV=50,$NEW=50
gcloud run services update-traffic $SVC --region=$R --to-revisions=$NEW=100
```
Watch the error rate and logs at each step (Monitoring alerts email hello@antarixs.com). Both revisions serve Bhakti during the split: the old one writes the legacy collections, the new one writes `stores/bhakti`. Keep the split short and in a quiet hour. After 100%, run the migration once more WITHOUT `--overwrite` (`--apply --confirm-project $P`); it only creates documents missing from `stores/bhakti`, so orders placed on the old revision during the split are brought across without touching newer data.

Rollback, at any point: `gcloud run services update-traffic $SVC --region=$R --to-revisions=$OLD_REV=100`. It takes seconds and needs no data change, because legacy data is intact. Anything written only to `stores/bhakti` after the switch is not in legacy: before rolling back after real traffic, export it with `scripts/export-store.ts` and re-enter or re-import those orders. Keep `OLD_REV` for at least 14 days and never delete the legacy collections without the owner's sign-off.

## 6. Smoke-test checklist
Automated, no credentials: `BASE_URL=<url> STORE=bhakti npx tsx scripts/smoke.ts` checks health, app-config, config, entitlements, a bad photo link (403) and an unknown store (404), then prints a pass/fail table and exits 1 on any failure. Manual:
- [ ] Bhakti admin signs in (email and password) on the `run.app` URL and on `https://bhakti.antarixs.com`; the admin hub shows the existing buyers, products and orders.
- [ ] An existing Bhakti buyer is still signed in (old token with no `storeId`); a new OTP login works (WhatsApp, or the temporary static code in a closed test).
- [ ] The installed Android app opens, lists products and keeps its session (it uses the `run.app` URL).
- [ ] Product photos load on both addresses; the admin can upload a new photo.
- [ ] A buyer places an order; it appears in admin; the owner alert arrives if configured.
- [ ] Fresh signup: create a test store, confirm the 14-day trial plan, open `https://<test>.antarixs.com`, sign in as its owner, add a product. Suspend or delete the test store from the console afterwards.
- [ ] `https://console.antarixs.com` asks for Google sign-in (IAP); an allowed email sees the stores list, another account gets 403; suspend and resume work.
- [ ] `https://antarixs.com` and `https://www.antarixs.com` still show the WordPress site (they are not on the LB). `https://nosuchstore.antarixs.com` returns "Store not found".
- [ ] Trial sweep: `gcloud scheduler jobs run trial-sweep`; logs show 200.
- [ ] No leftover `OTP_STATIC_CODE`: `gcloud run services describe $SVC --region=$R --format="value(spec.template.spec.containers[0].env)"`.
