# Android app add-on (per-store build)

A store's own Android app is a separate paid add-on: contact sales at hello@antarixs.com. Google Play publishing is out of scope for now; we hand over an installable APK built in GitHub Actions.

## Turn it on
In the console, open the store and press "Mark own app". Own-app stores are treated as Pro (`effectivePlan` returns `pro` when `ownApp` is set), whatever their stored plan.

## Build a store's app
GitHub, Actions, "Android APK", Run workflow: `store_id` = the store id (subdomain), `api_base` = the live API origin (default is the Cloud Run URL). The run:
1. `scripts/build-store-app.ts` fetches `GET <api_base>/api/config?store=<id>` (or reads `STORE_JSON=<export-store.ts file>` offline) and writes `merchants/<id>/merchant.json`.
2. Generated values: appId `com.antarixs.<store>` (lowercase letters and digits; a leading digit gets an `s` prefix), appName = brand name, `VITE_STORE=<id>`, `VITE_API_BASE`, theme colours from the store config.
3. `npm run build:native`, `cap add android`, `cap sync`.
4. Launcher icon: the store logo (`brand.logoUrl`, if PNG/JPG/WebP) resized to every density. Fallback: `merchants/<id>/icons/icon-512.png` if present, else the default Capacitor icon. SVG logos are not used.
5. `assembleDebug`; artifact `<store>-<version>.apk` (version from package.json).
`store_id` bhakti always uses the committed `merchants/bhakti/merchant.json` (package `com.bhaktijewels.catalogue`), so the default build is unchanged. No per-merchant manual edits.

Locally: `STORE_ID=acme API_BASE=https://... npx tsx scripts/build-store-app.ts`, then the usual `npm run build:native`, `npx cap sync android`.

## How the app talks to the server
Every call sends `X-Store` (from `VITE_STORE`) and `X-App-Version`. Photo links get `?store=<id>` because `<img>` cannot send headers. CORS allows `https://localhost` and `capacitor://localhost` for any store. Covered by tests/multistore.test.ts and tests/cors.test.ts.

## Signing
Debug builds are signed with the Android debug key: fine for installing and testing, not for distribution. For release, store a per-store (or one shared) keystore as GitHub secrets (`ANDROID_KEYSTORE_B64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`), decode it in the workflow to a temp file, and run `assembleRelease`/`bundleRelease`. Never commit keystores or passwords. Losing a keystore means the app can never be updated in place: back it up offline. Not implemented yet.

## Versioning
`package.json` version is the app version (sent as `X-App-Version`). Bump it for every shipped build. The server's minimum version (Phase 3b, `minAppVersion` in `/api/app-config`) answers 426 to older apps, which then show "Please update": raise it only after the new APK has reached the store's users, since APKs are sideloaded and users update manually.

## Push notifications (not implemented)
Optional later. Per store: create a Firebase project, register the app id `com.antarixs.<store>`, keep that store's `google-services.json` as a GitHub secret, write it to `android/app/google-services.json` in the workflow, and add `@capacitor/push-notifications` plus a server sender. Do not commit the file.
