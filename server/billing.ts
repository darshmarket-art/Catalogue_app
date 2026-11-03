/**
 * Console "Billing": real Google Cloud cost from the Cloud Billing standard-usage-cost export in BigQuery.
 * The BigQuery call sits behind BillingSource so tests inject a fake. Rows are cached in memory for 10 minutes.
 */
export interface BillingRow { day: string; service: string; sku: string; currency: string; cost: number; credits: number }
export type BillingSource = (sinceDay: string) => Promise<BillingRow[]>;

export const DEFAULT_PROJECT = 'gen-lang-client-0273003651';
const TABLE_RE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_]+\.[A-Za-z0-9_]+$/;
export const CACHE_MS = 10 * 60_000;

export const billingProject = () => process.env.BILLING_PROJECT_ID?.trim() || DEFAULT_PROJECT;
export const billingTable = () => process.env.BILLING_EXPORT_TABLE?.trim() || '';

let injected: BillingSource | null | undefined;
let cache: { at: number; since: string; rows: BillingRow[] } | null = null;

/** Tests only: replace the BigQuery reader (null = force "not connected", undefined = back to env). Also clears the cache. */
export function setBillingSource(s: BillingSource | null | undefined) {
  injected = s;
  cache = null;
}

/** The reader to use right now, or null when billing is not connected. */
function source(): BillingSource | null {
  if (injected !== undefined) return injected;
  const table = billingTable();
  if (!table) return null;
  if (!TABLE_RE.test(table)) throw new Error('BILLING_EXPORT_TABLE must look like project.dataset.table');
  return bigquerySource(table, billingProject());
}

export const isConnected = () => {
  try { return source() !== null; } catch { return true; } // a malformed table name is a misconfiguration, not "not connected"
};

function bigquerySource(table: string, project: string): BillingSource {
  return async (since) => {
    const { BigQuery } = await import('@google-cloud/bigquery');
    const bq = new BigQuery({ projectId: project });
    // The table name is checked against TABLE_RE above, so it is safe to put in the identifier; every value is a query parameter.
    const [rows] = await bq.query({
      query: `SELECT FORMAT_DATE('%Y-%m-%d', DATE(usage_start_time, 'UTC')) AS day, service.description AS service, sku.description AS sku, currency,
        SUM(cost) AS cost, SUM(IFNULL((SELECT SUM(c.amount) FROM UNNEST(credits) c), 0)) AS credits
        FROM \`${table}\`
        WHERE project.id = @project AND usage_start_time >= TIMESTAMP(@since)
        GROUP BY day, service, sku, currency`,
      params: { project, since },
      parameterMode: 'named'
    });
    return rows.map((r: any) => ({ day: String(r.day), service: String(r.service ?? 'Other'), sku: String(r.sku ?? 'Other'), currency: String(r.currency ?? ''), cost: Number(r.cost) || 0, credits: Number(r.credits) || 0 }));
  };
}

/** Rows from `since` (YYYY-MM-DD) on, cached 10 minutes. Returns null when not connected. */
export async function loadRows(since: string, now = Date.now()): Promise<{ rows: BillingRow[]; cachedAt: number } | null> {
  const src = source();
  if (!src) return null;
  if (cache && cache.since <= since && now - cache.at < CACHE_MS) return { rows: cache.rows, cachedAt: cache.at };
  const rows = await src(since);
  cache = { at: now, since, rows };
  return { rows, cachedAt: now };
}

export const SETUP_STEPS = [
  'In Google Cloud Console open Billing > Billing export > BigQuery export > Standard usage cost > Edit settings.',
  'Pick a project and a dataset (create the dataset first in the same region you want, for example asia-south1) and save. Data appears only from now on (no backfill) and the first rows can take up to a day.',
  'Give the Cloud Run service account roles/bigquery.jobUser on the project and roles/bigquery.dataViewer on the dataset.',
  'Set BILLING_EXPORT_TABLE on the Cloud Run service to project.dataset.gcp_billing_export_v1_XXXXXX (the table the export creates) and redeploy.',
  'Full commands are in docs/BILLING_CONSOLE.md.'
];
