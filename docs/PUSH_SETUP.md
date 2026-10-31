# Order alerts on phones: browser and Android app

Owner order alerts go three ways: WhatsApp, browser push, and app push. WhatsApp works once the WhatsApp account is configured. This page covers the other two.

## Browser (Web Push)
Needs the VAPID keys on Cloud Run (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`). `scripts/enable-push.ps1` does it in one go. Until they are set, the Alerts switch says "Not set up on this service yet".

## Android apps (Firebase Cloud Messaging)
1. Firebase console: create a project, add an Android app for each package you ship (`com.antarixs.app` for the Antarixs app, plus each store app's package). Download `google-services.json` (one file can hold several apps).
2. GitHub: Settings, Secrets and variables, Actions, new secret `GOOGLE_SERVICES_JSON` with the file's full content. Both app workflows (`antarixs-app.yml`, `android.yml`) copy it into the build.
3. Firebase console: Project settings, Service accounts, Generate new private key. On Cloud Run set `FCM_SERVICE_ACCOUNT_JSON` to that file's JSON (keep it in Secret Manager, as `vapid-private` is).
4. Run the "Antarixs onboarding app" workflow and install the new APK. Older installs have no push plugin and keep showing the switch as unsupported.

Without step 2 the app builds and runs, only phone notifications stay off. Without step 3 the app's switch says "Phone notifications are not set up for this app yet".
