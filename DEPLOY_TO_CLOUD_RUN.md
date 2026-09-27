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

1. Open the site, go to the Admin Console and create the first administrator with the Master Provisioning Key.
2. Add categories and products from the Admin Hub. The demo catalogue is **not** loaded in production; set `SEED_DEMO_CATALOGUE=true` only for a staging environment.
3. Retailers sign up themselves from the Retailer Gateway.

## 4. Operations

- **Health check:** `GET /healthz`. Structured JSON logs go to Cloud Logging (filter on `severity`).
- **Alerts:** in Cloud Monitoring, create alerting policies for Cloud Run 5xx rate and request latency.
- **Backups:** schedule Firestore exports, e.g. `gcloud firestore export gs://YOUR_BUCKET/backups` from Cloud Scheduler, or enable point-in-time recovery on the database.
- **Admin Hub statistics:** the hub polls `GET /api/analytics` every 15 seconds while it is open. Totals live in `dailyStats` (one small document per day, kept indefinitely); the hub shows the last 7 days against the 7 before. Nothing runs in the background, so Cloud Run can still scale to zero when nobody has the app open.
- **Analytics housekeeping:** add Firestore TTL policies on the `expireAt` field of the `sessions` collection (kept 2 days) and the `productViews` collection (kept 90 days) so they purge themselves.
- **Rotating secrets:** add a new version in Secret Manager and redeploy. Changing `JWT_SECRET` signs everyone out.

## 5. Local development

```powershell
copy .env.example .env   # optional; `npm run dev` loads it. JWT_SECRET is auto-generated per run when unset
npm install
npm run dev              # http://localhost:3000, data stored in ./data/local-db.json (git-ignored)
npm test
```

Admin provisioning is disabled locally unless `MASTER_PROVISIONING_KEY` is set in `.env`.
