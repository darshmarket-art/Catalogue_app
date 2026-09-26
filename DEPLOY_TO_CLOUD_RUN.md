# Google Cloud Run Deployment Guide

This project is an AI Studio full-stack TypeScript application (Vite + React frontend with an Express.js backend).

---

## What We Prepared
1. **`Dockerfile`**: A Node 20 LTS container definition that installs dependencies, compiles the Vite frontend into `dist/`, and starts the Express server.
2. **`.dockerignore`**: Excludes local files (`node_modules`, `.env`, build artifacts) from being copied into the container context.
3. **`package.json`**: Configured with production dependencies for `tsx` and TypeScript.

---

## Method 1: Deploy via Google Cloud Console UI (Recommended)
Since your code is already hosted on GitHub (`darshmarket-art/Catalogue_app`), this is the easiest method and enables automatic continuous deployment on git push.

### Step 1: Push the Dockerfile to GitHub
Run in your local terminal:
```bash
git add .
git commit -m "Add Dockerfile and Cloud Run configuration"
git push origin main
```

### Step 2: Create Cloud Run Service
1. Open the [Google Cloud Console](https://console.cloud.google.com/run).
2. Select your Google Cloud Project (or create a new one).
3. Click **Create Service** (or **Deploy Container**).
4. Choose **Continuously deploy from a repository** and click **Set up with Cloud Build**.
5. Connect your GitHub account and select repository: `darshmarket-art/Catalogue_app`.
6. Select Branch: `^main$`.
7. Under **Build Type**, select **Dockerfile** and keep Source location as `/Dockerfile`.
8. Click **Save**.

### Step 3: Configure Service Settings
- **Service Name**: `catalogue-app` (or your choice).
- **Region**: Choose a region close to your users (e.g., `asia-south1` for Mumbai, or `us-central1`).
- **Authentication**: Select **Allow unauthenticated invocations** (so your web app is publicly accessible).
- **Container, Networking, Security**:
  - Expand **Container**.
  - **Container Port**: `8080`.
  - Under **Environment variables**, click **Add Variable**:
    - Name: `GEMINI_API_KEY`
    - Value: Paste your Google AI Studio API key.
    - Name: `NODE_ENV`
    - Value: `production`
9. Click **Create**.

Cloud Build will build the Docker container and deploy it. Once finished, you will receive a public HTTPS URL (e.g., `https://catalogue-app-xxxxx.a.run.app`).

---

## Method 2: Deploy via Google Cloud Shell (No local setup required)
If you prefer the command line without installing `gcloud` on your computer:
1. Open [Google Cloud Console](https://console.cloud.google.com/) and click the **Activate Cloud Shell** icon (top-right terminal icon).
2. In Cloud Shell, run:
```bash
git clone https://github.com/darshmarket-art/Catalogue_app.git
cd Catalogue_app
gcloud run deploy catalogue-app \
  --source . \
  --region asia-south1 \
  --allow-unauthenticated \
  --set-env-vars="NODE_ENV=production,GEMINI_API_KEY=YOUR_GEMINI_KEY"
```

---

## Method 3: Deploy via Local gcloud CLI
If you want to deploy from your Windows PC using the CLI:
1. Download and install [Google Cloud SDK](https://cloud.google.com/sdk/docs/install).
2. Open PowerShell and run:
```powershell
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
gcloud services enable run.googleapis.com cloudbuild.googleapis.com
gcloud run deploy catalogue-app `
  --source . `
  --region asia-south1 `
  --allow-unauthenticated `
  --set-env-vars="NODE_ENV=production,GEMINI_API_KEY=YOUR_GEMINI_KEY"
```

---

## Important Architectural Notes
- **Local JSON Database (`data/database.json`)**: Cloud Run instances have an ephemeral file system. Any changes written to `data/database.json` are retained while the container is warm, but will reset when the instance scales to zero or restarts. For long-term production state, migrate data to a cloud database (Firestore, Cloud SQL, or Cloud Storage).
- **Port**: Cloud Run automatically injects `PORT=8080`, and the Express server in `server.ts` is configured to listen on `0.0.0.0:${PORT}`.
