# Trial lifecycle (Phase 7)

## What happens
- A new store gets 14 days of Pro (`trialEndsAt`). The plan is **worked out on every request** (`effectivePlan`): Pro while now is before `trialEndsAt`, else the stored plan. No job flips anything, so end and restore are instant (a store record is cached up to `STORE_CACHE_MS`, 15 s in production).
- A daily job (`POST /api/v1/internal/trial-sweep`) only sends messages and writes a notice on the store record.

## Exact downgrade behaviour (trial over, plan still `basic`)
- Nothing is deleted or hidden: orders, order history, extra design photos, staff accounts, analytics history, categories and designs beyond Basic limits all stay stored. Visitors still see every existing design, category and photo.
- Locked (HTTP 402): orders and the orders desk, insights, live visitors, buyer engagement, audit log, order alerts, PDF catalogue, staff roles.
- Adding is blocked beyond Basic limits: 5 categories, 200 photos in total, 1 photo per design, 50 buyers (new numbers only; existing buyers always sign in). Over-limit stores can still edit and delete; they just cannot add until under the limit or upgraded.
- Restore: the console sets plan `pro`, or extends the trial: full Pro returns at once with all data. Extending the trial also clears the reminders already sent, so reminders run again.

## Reminders
Whole days left (rounded up) reach 7, 3 or 1: one WhatsApp to `owner.phone` per mark. On expiry: one "trial ended, you are on Basic" message. Sent marks live in the store record (`remindersSent`), so reruns and duplicate scheduler calls never double-send; a missed day sends the next due mark; a failed send is retried on the next run. The same text is saved as `trialNotice` and returned by `/api/v1/entitlements` (only while the store is on Basic). Skipped: Bhakti founder, `ownApp`, paid Pro, suspended stores, stores with no trial.

## Environment
| Variable | Meaning |
|---|---|
| `SWEEP_AUDIENCE` | Exact URL the scheduler calls, used as the OIDC audience |
| `SWEEP_SERVICE_ACCOUNT` | Email of the scheduler service account (only this is accepted) |
| `WHATSAPP_TRIAL_TEMPLATE` | Approved template name; unset = no messages sent (notice still saved) |
| `SWEEP_DEV_OPEN=true` | Dev/test only (ignored in production): allow calls without a token |

Also needs the existing `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_OTP_LANGUAGE`.

## Create the Cloud Scheduler job
```
SA=trial-sweep@PROJECT.iam.gserviceaccount.com
gcloud iam service-accounts create trial-sweep --project PROJECT
URL=https://SERVICE_HOST/api/v1/internal/trial-sweep
gcloud scheduler jobs create http trial-sweep --project PROJECT --location asia-south1 \
  --schedule "30 9 * * *" --time-zone "Asia/Kolkata" --http-method POST --uri "$URL" \
  --oidc-service-account-email "$SA" --oidc-token-audience "$URL"
```
Set `SWEEP_AUDIENCE=$URL` and `SWEEP_SERVICE_ACCOUNT=$SA` on Cloud Run. Use the public service URL (`run.app`, not a store subdomain). The service must accept unauthenticated Cloud Run invocations as it does today: the app itself rejects every call without a valid token from that account. Test: `gcloud scheduler jobs run trial-sweep`.

## WhatsApp template (Meta approval)
Category **Utility**, name e.g. `trial_notice`, language `en`.
Body: `Hi, a note about {{1}} on Antarixs: {{2}}`
Variables: `{{1}}` store name; `{{2}}` message, for example "7 days of your Pro trial left. After that you move to Basic. To upgrade, contact sales at hello@antarixs.com." or "Your Pro trial has ended: you are on Basic. Nothing was deleted. To upgrade and get everything back, contact sales at hello@antarixs.com."
Sample for review: {{1}} = Sharma Jewellers, {{2}} = 3 days of your Pro trial left. After that you move to Basic. To upgrade, contact sales at hello@antarixs.com.
If Meta rejects a long variable, split into one template per message and adjust `server/trialSweep.ts`.
