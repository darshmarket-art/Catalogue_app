# Deploying to Google Cloud Run

Express + React app, built by the multi-stage `Dockerfile` (Node 22) and run as a non-root user.
Data lives in **Firestore**; secrets live in **Secret Manager**.

## 1. One-time Google Cloud setup

```powershell
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
gcloud services enable run.googleapis.com cloudbuild.googleapis.com firestore.googleapis.com secretmanager.googleapis.com artifactregistry.googleapis.com

# Firestore database (Native mode), same region as Cloud Run
gcloud firestore databases create --location=asia-south1
```

### Secrets

Generate two strong values and store them in Secret Manager. **Do not reuse any value that was ever committed to this repository.**

```powershell
$jwt = node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
$jwt | gcloud secrets create jwt-secret --data-file=-

# Chosen by the Managing Director, 16+ characters. Needed to create admin accounts.
"CHOOSE-A-LONG-RANDOM-KEY" | gcloud secrets create master-provisioning-key --data-file=-
```

### Service account

The Cloud Run service account needs Firestore and secret access:

```powershell
$sa = "$(gcloud projects describe YOUR_PROJECT_ID --format='value(projectNumber)')-compute@developer.gserviceaccount.com"
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID --member="serviceAccount:$sa" --role="roles/datastore.user"
gcloud secrets add-iam-policy-binding jwt-secret --member="serviceAccount:$sa" --role="roles/secretmanager.secretAccessor"
gcloud secrets add-iam-policy-binding master-provisioning-key --member="serviceAccount:$sa" --role="roles/secretmanager.secretAccessor"
```

### Photo storage (one bucket per merchant)

Photos that the owner picks from the camera or gallery are saved, untouched, in this merchant's own Cloud Storage bucket. The bucket is private: the app hands buyers short-lived signed links (valid 6 to 12 hours), so a photo link cannot be passed around for long.

```powershell
gcloud services enable storage.googleapis.com
$bucket = "YOUR_PROJECT_ID-bhakti-media"        # any unique name; one bucket per merchant
gcloud storage buckets create gs://$bucket --location=asia-south1 --uniform-bucket-level-access --public-access-prevention
gcloud storage buckets update gs://$bucket --versioning
gcloud storage buckets add-iam-policy-binding gs://$bucket --member="serviceAccount:$sa" --role="roles/storage.objectAdmin"

# tell the service which bucket to use (do this for an existing service; for a new one add it to --set-env-vars)
gcloud run services update catalogue-app --region asia-south1 --update-env-vars="STORAGE_BUCKET=$bucket"
```

Without `STORAGE_BUCKET` the app still starts, but photo upload answers "Photo storage is not set up" and the product and category forms cannot be saved (every product needs 1 to 3 photos, every category 1).

Photos are limited to JPEG, PNG or WebP up to 25 MB each and are never resized. Deleting a product or replacing its photo leaves the old file in the bucket, because past orders still show it.

## 2. Deploy

```powershell
gcloud run deploy catalogue-app `
  --source . `
  --region asia-south1 `
  --allow-unauthenticated `
  --set-env-vars="NODE_ENV=production" `
  --set-secrets="JWT_SECRET=jwt-secret:latest,MASTER_PROVISIONING_KEY=master-provisioning-key:latest"
```

`--allow-unauthenticated` only means the site is public; sign-in is enforced by the app itself.

The container **refuses to start** if `JWT_SECRET` (32+ chars) or `MASTER_PROVISIONING_KEY` (16+ chars) are missing, or if `STORE` is anything other than `firestore`. Check the Cloud Run logs if a revision fails its health check.

Continuous deployment from GitHub (Cloud Build trigger on `main`) works with the same `Dockerfile`; add the same environment variable and secret bindings under **Container > Variables & Secrets** in the console. The GitHub Actions workflow in `.github/workflows/ci.yml` runs lint, tests and the build on every push and pull request.

## 3. First run

1. Open the site, go to the Admin Console and create the first administrator with the Master Provisioning Key. Choose the **Owner** role for the business owner; anyone they add can be **Staff**.
2. Add categories and products from the Admin Hub (each category needs 1 photo, each product 1 to 3). The demo catalogue is **not** loaded in production; set `SEED_DEMO_CATALOGUE=true` only for a staging environment.
3. Retailers sign up themselves from the Retailer Gateway.

## 4. Operations

- **Health check:** `GET /health` (not `/healthz`: Cloud Run reserves that path on run.app URLs). Structured JSON logs go to Cloud Logging (filter on `severity`).
- **Alerts:** in Cloud Monitoring, create alerting policies for Cloud Run 5xx rate and request latency.
- **Backups:** schedule Firestore exports, e.g. `gcloud firestore export gs://YOUR_BUCKET/backups` from Cloud Scheduler, or enable point-in-time recovery on the database.
- **Admin Hub statistics:** the hub polls `GET /api/analytics` every 15 seconds while it is open. Totals live in `dailyStats` (one small document per day, kept indefinitely); the hub shows the last 7 days against the 7 before. Nothing runs in the background, so Cloud Run can still scale to zero when nobody has the app open.
- **Analytics housekeeping:** add Firestore TTL policies on the `expireAt` field of the `sessions` collection (kept 2 days) and the `productViews` and `activityEvents` collections (kept 90 days) so they purge themselves.
- **Rotating secrets:** add a new version in Secret Manager and redeploy. Changing `JWT_SECRET` signs everyone out.

## 5. Merchants (one deployment per merchant)

Everything that is specific to a business lives in `merchants/<id>/merchant.json`: brand name and logo, colours, contact numbers, welcome-page cards, banner promotions, order-number prefix, and whether the catalogue is `public` or `login`. The server validates it at startup and refuses to start if it is invalid.

To add a merchant:
1. Copy `merchants/example/` to `merchants/<new-id>/` and set `"id"` to the same `<new-id>` (lower-case letters, digits and dashes).
2. Edit the file. Any colour in `theme.colors` overrides the default palette (the allowed names are listed in `server/merchant.ts`).
3. Run locally with `MERCHANT=<new-id> npm run dev`, or deploy with `--build-arg MERCHANT=<new-id>` (the Dockerfile default is `bhakti`).

Each merchant gets its own Cloud Run service, Firestore database, bucket and secrets, so their data is never shared.

**Changing the config without a rebuild.** If the merchant's bucket contains `merchant.json`, the server reads it at startup instead of the copy baked into the image. Upload it, then start a new revision (for example `gcloud run services update catalogue-app --region asia-south1 --update-env-vars="CONFIG_REV=2"`). An invalid file stops the new revision from starting, so the previous one keeps serving. Bucket versioning keeps every earlier copy.

```powershell
gcloud storage cp merchants/bhakti/merchant.json gs://$bucket/merchant.json
```

**Extra product details.** `productFields` in `merchant.json` (up to 10) adds merchant-specific fields to the product form, card and detail sheet, for example `{ "key": "finish", "label": "Finish", "type": "select", "options": ["Matte", "Polished"], "required": true }`. Types are `text`, `number` and `select`. See `merchants/example/merchant.json`.

Two more things live in the merchant folder or are chosen by it:
- `merchants/<id>/seed.json` (optional) holds demo categories and products. It is loaded only in development, or in a deployment with `SEED_DEMO_CATALOGUE=true`. A merchant without one simply starts with an empty catalogue.
- `sector` selects the sector pack (currently `jewellery`): the product fields and validation live in `server/sectors/` and the on-screen wording and WhatsApp message templates in `src/sectors/`. Nothing about a product (HUID, price, photo) is ever invented; it is stored only if the merchant enters it.

Pricing on a product is one of three modes: by weight (gram basis, optional making charge per gram), fixed price, or on request.

Buyers who forget their password: the Owner opens **Buyers** in the Admin Hub and taps **Reset password**. A temporary password is shown once; the buyer signs in with it and is asked to choose their own.

Buyer accounts are kept in the `buyers` collection. Accounts created before the rename (in `merchants`) are copied across automatically on start, and the old documents are left untouched.

## 6. Local development

```powershell
copy .env.example .env   # optional; `npm run dev` loads it. JWT_SECRET is auto-generated per run when unset
npm install
npm run dev              # http://localhost:3000, data stored in ./data/local-db.json (git-ignored)
npm test
```

Photos uploaded locally are kept in `./data/uploads` (git-ignored) when `STORE=file`, or in memory otherwise.

Admin provisioning is disabled locally unless `MASTER_PROVISIONING_KEY` is set in `.env`.
