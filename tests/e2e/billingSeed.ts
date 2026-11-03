// Fake billing export for the e2e server (BILLING_E2E=connected). The real BigQuery reader is never used.
import type { BillingRow } from '../../server/billing';

export function fakeBilling(): BillingRow[] {
  const now = new Date();
  const rows: BillingRow[] = [];
  const lines: Array<[string, string, number]> = [
    ['Cloud Run', 'Cloud Run CPU Allocation Time asia-south1', 22], ['Cloud Run', 'Cloud Run Memory Allocation Time asia-south1', 9],
    ['Cloud Firestore', 'Document reads asia-south1', 6], ['Cloud Storage', 'Standard Storage Mumbai', 4],
    ['Networking', 'Load Balancing Forwarding Rule Minimum Service Charge', 18], ['Vertex AI', 'Gemini 3 Pro Image output', 14], ['Generative Language API', 'Gemini Flash Image', 5]
  ];
  for (let back = 0; back < 400; back++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - back));
    if (back > 0 && back > 300) continue;
    const day = d.toISOString().slice(0, 10);
    const wobble = 0.7 + ((d.getUTCDate() * 7) % 10) / 15;
    for (const [service, sku, base] of lines) rows.push({ day, service, sku, currency: 'INR', cost: Math.round(base * wobble * 100) / 100, credits: service === 'Cloud Run' ? -1.5 : 0 });
  }
  return rows;
}
