# Console Billing: real Google Cloud cost

Console section `#/billing` (console.antarixs.com). Read only. Shows month-to-date (net of credits and gross), the last 12 months, cost per service for a chosen month with per-SKU drill-down, the daily chart for this month, an end-of-month forecast (total and per service, with a low/high range), and an AI tab that puts the actual Vertex AI / Gemini cost next to the estimate from the AI ledger (`server/aiCredits.ts`) so the price table in AI > Prices & models can be calibrated.

Project: `gen-lang-client-0273003651` (override with `BILLING_PROJECT_ID`).

## How it works

- Source: the Cloud Billing **standard usage cost** export in BigQuery (the only place per-service costs exist). One parameterised query reads daily rows by service and SKU for the last 12 months (`server/billing.ts`); everything else is computed in `server/routes/consoleBilling.ts`.
- Config by env only. `BILLING_EXPORT_TABLE=project.dataset.gcp_billing_export_v1_XXXXXX` (checked against a strict regex before it goes into the query; every value is a query parameter). Unset = the section shows "Not connected" with the setup steps and nothing is called. `BILLING_PROJECT_ID` (optional) = the project whose cost is shown and which runs the query job.
- Cached in memory for 10 minutes per instance, so page loads and month switches do not spend BigQuery quota.
- Auth: mounted inside the console API, so IAP plus the `CONSOLE_ADMINS` allowlist apply, like the AI section.
- Currency is the billing account currency (shown in the page). The AI estimate-vs-actual comparison needs INR or USD (USD is converted at the USD to INR rate in AI > Prices).
- Days are UTC. Google invoices by Pacific time, so a day edge, and the first or last hours of a month, can differ slightly from the invoice.
- Forecast (`server/billingForecast.ts`, pure, tested in `tests/billingForecast.test.ts`): rate per day = 60% average of the last 7 completed days + 40% average of all completed days this month; today is partial and ignored for the rate. Fewer than 3 completed days (days 1 to 3 of the month): "not enough data". Range: slower and faster of the two averages, minus and plus 15%.
- Tests: `tests/consoleBilling.test.ts` (fake BigQuery via `setBillingSource`; auth, not connected, shape, AI comparison, cache, error). Browser shots: `BILLING_E2E=off|connected PW_CHANNEL=msedge PW_WORKERS=1 npx playwright test tests/e2e/billing.e2e.ts` writes `docs/qa-maison/billing/` (connected uses `tests/e2e/billingSeed.ts`, fake data).

## Owner setup (once)

Data appears only from the day the export is enabled. There is no backfill, and the first rows can take up to a day. The 12-month chart fills in over time.

1. Create a dataset (same region as your other data, e.g. `asia-south1`; a billing export dataset cannot be moved later):

   ```
   bq --project_id=gen-lang-client-0273003651 mk --location=asia-south1 --dataset gen-lang-client-0273003651:billing_export
   ```

2. Enable the export (console only, there is no CLI for it): Cloud Console > Billing > pick the billing account > Billing export > BigQuery export > **Standard usage cost** > Edit settings > choose the project and the `billing_export` dataset > Save. (Detailed usage cost is not needed.) Wait for the table `gcp_billing_export_v1_<BILLING_ACCOUNT_ID>` to appear in the dataset.

3. Give the Cloud Run runtime service account read access. Find it, then grant (project level job permission, dataset level read):

   ```
   SA=$(gcloud run services describe SERVICE --region=asia-south1 --format='value(spec.template.spec.serviceAccountName)')
   gcloud projects add-iam-policy-binding gen-lang-client-0273003651 --member="serviceAccount:$SA" --role=roles/bigquery.jobUser
   bq show --format=prettyjson gen-lang-client-0273003651:billing_export > /tmp/ds.json
   # add {"role":"READER","userByEmail":"<SA>"} to the "access" list in /tmp/ds.json, then:
   bq update --source /tmp/ds.json gen-lang-client-0273003651:billing_export
   ```

   Or grant `roles/bigquery.dataViewer` on the dataset in the console: BigQuery > the dataset > Sharing > Permissions > Add principal. If the Cloud Run service runs as the default compute account, `SA` is `PROJECT_NUMBER-compute@developer.gserviceaccount.com`.

4. Point the app at the table and redeploy (this only sets an env var on the service):

   ```
   gcloud run services update SERVICE --region=asia-south1 --update-env-vars=BILLING_EXPORT_TABLE=gen-lang-client-0273003651.billing_export.gcp_billing_export_v1_XXXXXX_XXXXXX_XXXXXX
   ```

5. Open console > Billing. Until the first rows land it says the export is connected but has no rows yet. In AI, the "Google billing" tile now says Connected.

The BigQuery API is enabled by default on every project; no extra Google API needs enabling. Query cost is tiny (one query per 10 minutes at most, a few MB scanned) and covered by the free tier.

## Not verified here

Nothing in this change called Google. The BigQuery query text and the real export column names (`service.description`, `sku.description`, `credits`, `usage_start_time`, `project.id`, `currency`, `cost`) follow Google's documented standard export schema but were not run against a real table; check the first live load.
