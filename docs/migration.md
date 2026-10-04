# Migrating Antarixs to another Google Cloud project

Plan for moving the whole running setup (written 2026-10-04) from the current project to a new one, possibly under a different account. Not yet rehearsed: run the steps once against a throwaway project before the real cutover.

Effort: about 1 to 2 days of hands-on work for someone who knows the stack, plus waiting for the certificate (up to 1 hour) and DNS. Cutover can be near-zero downtime.

## 0. Current setup (source of truth to copy)

| Item | Value |
|---|---|
| Project | `gen-lang-client-0273003651` (number `456376852191`), inside organization `399484626158` |
| Region | `asia-south1` |
| Cloud Run service | `catalogue-app` (revisions route to latest) |
| Image repo | Artifact Registry `cloud-run-source-deploy`, built by a Cloud Build trigger on GitHub `darshmarket-art/Catalogue_app` (`main`) |
| Media bucket | `gen-lang-client-0273003651-bhakti-media` (photos under `stores/<id>/photos/`) |
| Firestore | default database; per-store data under `stores/<id>/*`, store records in `stores`. Confirm mode (Native) and location before creating the new one |
| Secrets (Secret Manager) | `jwt-secret`, `master-provisioning-key`, `otp-static-code`; later the WhatsApp permanent token |
| Env on the service | `NODE_ENV=production`, `STORAGE_BUCKET`, `BASE_DOMAIN=antarixs.com`, `DEFAULT_STORE=bhakti`, `STORE_CACHE_MS=15000`, `CONSOLE_ADMINS`, `IAP_AUDIENCE`; secrets `JWT_SECRET`, `MASTER_PROVISIONING_KEY`, `OTP_STATIC_CODE`. Add later: `PLATFORM_MODE`, `SWEEP_AUDIENCE`, `SWEEP_SERVICE_ACCOUNT`, WhatsApp variables |
| Load balancer | global external ALB: IP `antarixs-lb-ip`, serverless NEG `antarixs-neg`, backends `antarixs-backend` and `antarixs-console-backend` (IAP on), URL map `antarixs-urlmap` (host rule `console.antarixs.com`), proxy `antarixs-https-proxy`, forwarding rule `antarixs-https-fr` |
| Certificate | Certificate Manager: DNS authorization `antarixs-dns-auth`, cert `antarixs-wildcard-cert` (`antarixs.com`, `*.antarixs.com`), map `antarixs-cert-map` with entries `antarixs-wild`, `antarixs-apex` |
| DNS | Hostinger: `*` A to the LB IP, `_acme-challenge` CNAME to Google. `@`, `www`, mail records stay as they are |
| Not yet created | HTTP redirect, Cloud Scheduler trial sweep, console admin list on a custom OAuth client |

Also inventory (not listed above, check in the console): Cloud Monitoring alerts, Firestore backup schedule and TTL policies, IAM members, Cloud Build trigger settings.

## 1. Do this first: stop depending on the run.app address

The Android app and the PWA must call a domain you own (for example `https://app.antarixs.com` or each store's own address), not the `run.app` URL. A `run.app` address changes with the project, so every installed app would break and need a rebuild. Fix this before shipping the app to more stores. The `run.app` URL also appears in `scripts/` and docs; grep for `run.app` and replace.

## 2. Prepare the new project

```
NEW=new-project-id; R=asia-south1
gcloud projects create $NEW   # or use an existing one; link billing
gcloud config set project $NEW
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com \
  firestore.googleapis.com secretmanager.googleapis.com compute.googleapis.com \
  certificatemanager.googleapis.com iap.googleapis.com cloudscheduler.googleapis.com monitoring.googleapis.com
gcloud firestore databases create --location=$R       # match the old database's mode and location
gcloud storage buckets create gs://$NEW-bhakti-media --location=$R
gcloud artifacts repositories create cloud-run-source-deploy --repository-format=docker --location=$R
```

Note the new bucket name and set `STORAGE_BUCKET` to it. A bucket name is global; it cannot be reused.

## 3. Secrets

Values cannot be exported. Re-create each from your records.

```
printf '%s' "<value>" | gcloud secrets create jwt-secret --data-file=-
printf '%s' "<value>" | gcloud secrets create master-provisioning-key --data-file=-
printf '%s' "<value>" | gcloud secrets create otp-static-code --data-file=-   # temporary; drop once WhatsApp works
```

Use a NEW `jwt-secret` only if you accept signing every user out. Keep the same value to keep sessions alive. Grant the Cloud Run runtime service account `roles/secretmanager.secretAccessor` on each secret.

## 4. Copy the data

Firestore (needs both projects' service accounts to read and write the staging bucket):

```
# old project
gcloud firestore export gs://STAGING_BUCKET/fs-export --project=gen-lang-client-0273003651
# new project
gcloud firestore import gs://STAGING_BUCKET/fs-export --project=$NEW
```

Grant the new project's Firestore service agent read access on `STAGING_BUCKET`, and the old one write access. After the final cutover, run one more export/import (catch-up) with the old service stopped for writes.

Photos:

```
gcloud storage cp -r --no-clobber "gs://gen-lang-client-0273003651-bhakti-media/*" "gs://$NEW-bhakti-media/"
```

Do not use the Node copy in `scripts/migrate-multistore.ts` for photos: it hung before. Use `gcloud storage cp`.

## 5. Deploy the app

1. Connect the GitHub repo to Cloud Build in the new project and recreate the trigger on `main`, or deploy directly:
   ```
   gcloud run deploy catalogue-app --source . --region=$R --allow-unauthenticated \
     --set-env-vars="NODE_ENV=production,BASE_DOMAIN=antarixs.com,DEFAULT_STORE=bhakti,STORE_CACHE_MS=15000,STORAGE_BUCKET=$NEW-bhakti-media" \
     --set-secrets="JWT_SECRET=jwt-secret:latest,MASTER_PROVISIONING_KEY=master-provisioning-key:latest,OTP_STATIC_CODE=otp-static-code:latest"
   ```
2. Check the service responds on its `run.app` address for a test (`/api/v1/config`).
3. Re-check public access: in the old project the service has no explicit `allUsers` invoker binding, so look at how public access was granted (invoker IAM check setting) and match it.

## 6. Load balancer, certificate, DNS (new IP)

Recreate with the same names, in this order:

```
gcloud compute addresses create antarixs-lb-ip --global --ip-version=IPV4
gcloud certificate-manager dns-authorizations create antarixs-dns-auth --domain=antarixs.com
gcloud certificate-manager dns-authorizations describe antarixs-dns-auth      # note the _acme-challenge CNAME
gcloud certificate-manager certificates create antarixs-wildcard-cert --domains="antarixs.com,*.antarixs.com" --dns-authorizations=antarixs-dns-auth
gcloud certificate-manager maps create antarixs-cert-map
gcloud certificate-manager maps entries create antarixs-wild --map=antarixs-cert-map --certificates=antarixs-wildcard-cert --hostname="*.antarixs.com"
gcloud certificate-manager maps entries create antarixs-apex --map=antarixs-cert-map --certificates=antarixs-wildcard-cert --hostname="antarixs.com"
gcloud compute network-endpoint-groups create antarixs-neg --region=$R --network-endpoint-type=serverless --cloud-run-service=catalogue-app
gcloud compute backend-services create antarixs-backend --global --load-balancing-scheme=EXTERNAL_MANAGED
gcloud compute backend-services add-backend antarixs-backend --global --network-endpoint-group=antarixs-neg --network-endpoint-group-region=$R
gcloud compute url-maps create antarixs-urlmap --default-service=antarixs-backend
gcloud compute target-https-proxies create antarixs-https-proxy --url-map=antarixs-urlmap --certificate-map=antarixs-cert-map
gcloud compute forwarding-rules create antarixs-https-fr --global --load-balancing-scheme=EXTERNAL_MANAGED --address=antarixs-lb-ip --target-https-proxy=antarixs-https-proxy --ports=443
```

DNS (Hostinger), in this order:
1. Replace the `_acme-challenge` CNAME with the NEW value from the `describe` step. The cert turns ACTIVE only after this.
2. Wait for the certificate to be ACTIVE (up to 1 hour). Test with `curl --resolve bhakti.antarixs.com:443:<NEW_IP> https://bhakti.antarixs.com/api/v1/config`.
3. Change the `*` A record to the new IP. TTL 300. Lower it a day earlier for a faster switch.

Optional: the HTTP to HTTPS redirect (URL map with `defaultUrlRedirect: httpsRedirect: true`, an HTTP proxy, and a port-80 forwarding rule on the same IP).

## 7. Console behind IAP

Same as `console-setup.sh` in the repo parent folder, with the new project number in `IAP_AUDIENCE`. Two catches learned in the old project:
- In a Google Cloud organization, IAP's default sign-in only admits accounts inside that organization. To let outside accounts (for example Gmail) in, set up a custom OAuth client with an External consent screen. Otherwise use an in-org account.
- IAP needs its service identity: `gcloud beta services identity create --service=iap.googleapis.com`, then grant `service-<PROJECT_NUMBER>@gcp-sa-iap.iam.gserviceaccount.com` the `roles/run.invoker` role on `catalogue-app`.

## 8. Scheduler, monitoring, backups

- Cloud Scheduler: one daily job POSTing to `/api/internal/trial-sweep` with an OIDC token from a dedicated service account. Set `SWEEP_AUDIENCE` and `SWEEP_SERVICE_ACCOUNT` on the service.
- Recreate Monitoring alert policies and the Firestore backup schedule and TTL policies from your records.

## 9. Cutover order (little to no downtime)

1. Build and test everything above in the new project; data copied once.
2. Lower the DNS TTL to 300 a day ahead.
3. Freeze changes on the old service (stop store edits for a short window) and do the final Firestore and photo catch-up.
4. Switch the `*` A record to the new IP. Watch the new service's logs.
5. Verify: `bhakti.antarixs.com` loads with photos, buyer sign-in, an owner sign-in, an order on Pro, `app.antarixs.com`, and the console.
6. Keep the old project running for several days as a fallback (rollback = point the `*` A record back). Then export a final backup and shut it down.

## 10. Checklist of things easy to forget

- Secret values re-entered; `OTP_STATIC_CODE` removed once WhatsApp templates are approved.
- WhatsApp (Meta) webhook and token do not live in Google Cloud, but any callback URL you registered with Meta must be updated if it pointed to the old host.
- Hostinger DNS changed; mail records untouched.
- Android: confirm the app points at your own domain (section 1); if it points at `run.app`, rebuild and redistribute.
- IAM: the owners, the Cloud Build and runtime service accounts, and the admin list for the console.
- Billing alerts and budgets on the new project.
