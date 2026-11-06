#!/usr/bin/env node
/**
 * Batch "AI render" (enhance) of the first N designs of every collection in one store, using the store admin's own login.
 * It calls the same endpoints as the admin app (POST /api/v1/admin/photos/render, then PUT /api/v1/products/:id), so the monthly cap,
 * AI credits, prices and the audit log all apply exactly as for a single render. Nothing is deployed or changed outside the store.
 *
 * Safe by default: with nothing but the login it only PRINTS THE PLAN (what would be rendered, cap and credits left). Then:
 *   RUN=render   renders the photos and saves them, but changes no design. Links to before and after go in the report.
 *   RUN=apply    renders, then makes the render the design's FIRST photo; the original stays as its second photo (or, when the
 *                design already has 3 photos, is dropped from the design but kept in storage, listed in the report).
 *   REVERT=<report.json>   puts every design in that report back exactly as it was (its photo list from before).
 *
 * Required:  BASE_URL (e.g. https://bhakti.antarixs.com)  ADMIN_EMAIL  ADMIN_PASSWORD
 * Optional:  PER_COLLECTION=24    designs per collection (in the catalogue's own order, SORT=newest by default)
 *            COLLECTIONS="A,B"    only these collections (default: all)
 *            LIMIT_TOTAL=5        stop after this many renders in total (use 5 for a pilot first)
 *            STYLE=cad            AI style id
 *            CONCURRENCY=3        renders at once (each takes 40 to 100 s)
 *            RUN_TAG=b1           part of each render id; use a new tag to render the same designs again (same tag = never charged twice)
 *            STORE=<id>           only against localhost or a run.app address (sends X-Store)
 *            REPORT=batch-enhance-report.json   progress file; a re-run skips designs already done and carries on after a stop
 *
 * Example pilot:  BASE_URL=https://bhakti.antarixs.com ADMIN_EMAIL=... ADMIN_PASSWORD=... LIMIT_TOTAL=5 RUN=apply node scripts/batch-enhance.mjs
 */
import fs from 'node:fs';

const env = (k, d) => (process.env[k] ?? d ?? '').trim();
const BASE_URL = env('BASE_URL').replace(/\/+$/, '');
const EMAIL = env('ADMIN_EMAIL');
const PASSWORD = process.env.ADMIN_PASSWORD ?? '';
const PER = Math.max(1, Number(env('PER_COLLECTION', '24')) || 24);
const ONLY = env('COLLECTIONS').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
const LIMIT_TOTAL = Number(env('LIMIT_TOTAL', '0')) || Infinity;
const STYLE = env('STYLE', 'cad');
const CONCURRENCY = Math.min(8, Math.max(1, Number(env('CONCURRENCY', '3')) || 3));
const TAG = env('RUN_TAG', 'b1').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 12) || 'b1';
const SORT = env('SORT', 'newest');
const STORE = env('STORE'); // only for localhost or a run.app address; on [store].antarixs.com the host already says
const REPORT = env('REPORT', 'batch-enhance-report.json');
const RUN = env('RUN', 'plan'); // plan | render | apply
const REVERT = env('REVERT');

if (!BASE_URL || !EMAIL || !PASSWORD) {
  console.error('Set BASE_URL, ADMIN_EMAIL and ADMIN_PASSWORD. See the top of scripts/batch-enhance.mjs.');
  process.exit(1);
}
if (!['plan', 'render', 'apply'].includes(RUN)) {
  console.error('RUN must be plan, render or apply.');
  process.exit(1);
}

let token = '';
async function call(method, path, body, { timeoutMs = 170_000 } = {}) {
  const res = await fetch(BASE_URL + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(STORE ? { 'X-Store': STORE } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs)
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(json?.message ?? `HTTP ${res.status}`);
    err.status = res.status;
    err.code = json?.code ?? json?.reason ?? json?.data?.reason;
    throw err;
  }
  return json;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** Retries a call on a network error, 429 or 5xx other than the render's own refusals. */
async function retry(fn, tries = 3) {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (e) {
      const transient = !e.status || e.status === 429 || (e.status >= 500 && e.status !== 502 && e.status !== 503);
      if (!transient || i >= tries) throw e;
      await sleep(2000 * i * i);
    }
  }
}

const refOf = (v) => /\/media\/([a-f0-9]{32}\.(?:jpg|png|webp))/.exec(String(v))?.[1] ?? null;
const loadReport = () => (fs.existsSync(REPORT) ? JSON.parse(fs.readFileSync(REPORT, 'utf8')) : { store: BASE_URL, items: {} });
const saveReport = (r) => fs.writeFileSync(REPORT, JSON.stringify(r, null, 1));

/** A design's editable fields as the product form sends them, with the given photo list. */
const bodyFor = (p, images) => ({
  title: p.title, sku: p.sku, category: p.category, purity: p.purity, grossWt: p.grossWt, stoneWt: p.stoneWt ?? 0,
  huid: p.huid, description: p.description, titleHi: p.titleHi, descriptionHi: p.descriptionHi, stockStatus: p.stockStatus,
  ...(p.extra ? { extra: p.extra } : {}), images
});

async function login() {
  const r = await call('POST', '/api/v1/auth/admin/login', { adminId: EMAIL, password: PASSWORD, remember: false });
  token = r.sessionToken;
  console.log(`Signed in to ${BASE_URL} as ${r.admin?.email}.`);
}

async function revert() {
  const rep = JSON.parse(fs.readFileSync(REVERT, 'utf8'));
  const items = Object.values(rep.items).filter((i) => i.status === 'applied' && i.before);
  console.log(`Reverting ${items.length} designs from ${REVERT}.`);
  for (const i of items) {
    try {
      const { data: cur } = await call('GET', `/api/v1/products/by-sku?skus=${encodeURIComponent(i.sku)}`);
      const p = cur[0];
      if (!p) throw new Error('design not found');
      await call('PUT', `/api/v1/products/${i.id}`, bodyFor(p, i.before));
      i.status = 'reverted';
      console.log(`  reverted ${i.sku}`);
    } catch (e) {
      console.log(`  FAILED ${i.sku}: ${e.message}`);
    }
  }
  fs.writeFileSync(REVERT, JSON.stringify(rep, null, 1));
}

async function main() {
  await login();
  if (REVERT) return revert();

  const status = (await call('GET', '/api/v1/admin/photos/render')).data;
  console.log(`AI render: ${status.enabled ? 'on' : `OFF (${status.offReason})`}; renders left this month ${status.left} of ${status.cap}; ` +
    `credits ${status.credits?.free ? 'free for this store' : status.credits?.balance}; price per ${STYLE} render ${status.credits?.prices?.[STYLE] ?? '?'}.`);

  const cats = (await call('GET', '/api/v1/categories')).data.filter((c) => !ONLY.length || ONLY.includes(String(c.name).toLowerCase()));
  const report = loadReport();
  const plan = [];
  for (const c of cats) {
    const { data } = await call('GET', `/api/v1/products?category=${encodeURIComponent(c.name)}&sort=${encodeURIComponent(SORT)}&limit=${PER}`);
    for (const p of data.slice(0, PER)) {
      const mine = report.items[p.id];
      const first = refOf(p.images?.[0]);
      if (mine && ['rendered', 'applied'].includes(mine.status) && mine.tag === TAG) continue; // done in an earlier run
      if (!first) { plan.push({ p, skip: 'its photo is an external link, not an uploaded one' }); continue; }
      plan.push({ p, first });
    }
    console.log(`  ${c.name}: ${Math.min(PER, c.designCount ?? data.length)} designs in scope`);
  }
  const todo = plan.filter((x) => !x.skip);
  const skipped = plan.filter((x) => x.skip);
  const batch = todo.slice(0, LIMIT_TOTAL);
  console.log(`\nPlan: ${batch.length} renders (${todo.length} not yet done${Number.isFinite(LIMIT_TOTAL) ? `, limited to ${LIMIT_TOTAL}` : ''}), ${skipped.length} skipped.`);
  if (skipped.length) console.log(`  skipped, e.g. ${skipped.slice(0, 3).map((x) => x.p.sku).join(', ')}: ${skipped[0].skip}`);
  if (batch.length > status.left) console.log(`  WARNING: only ${status.left} renders are left this month; the run stops when the cap is reached. Raise this store's monthly cap in the console first.`);
  const price = status.credits?.free ? 0 : (status.credits?.prices?.[STYLE] ?? 0);
  if (price) console.log(`  Credits needed: ${batch.length * price} (balance ${status.credits.balance}).`);
  if (RUN === 'plan') return void console.log('\nThis was only the plan. Run again with RUN=render or RUN=apply (try LIMIT_TOTAL=5 first).');
  if (!status.enabled) throw new Error('AI render is off for this store.');

  let stop = false;
  let done = 0;
  let failed = 0;
  const queue = [...batch];
  const worker = async () => {
    while (queue.length && !stop) {
      const { p, first } = queue.shift();
      const before = (p.images ?? []).map(refOf).map((f) => (f ? `media:${f}` : null));
      const item = report.items[p.id] = { id: p.id, sku: p.sku, title: p.title, category: p.category, tag: TAG, status: 'rendering', before: before.every(Boolean) ? before : null };
      try {
        const r = (await retry(() => call('POST', '/api/v1/admin/photos/render', { ref: `media:${first}`, style: STYLE, renderId: `bt${TAG}-${p.id}`.slice(0, 64) }))).data;
        item.render = r.ref;
        item.renderUrl = r.url;
        item.credits = r.credits;
        item.status = 'rendered';
        if (RUN === 'apply' && item.before) {
          // Render first, the original next, then the rest, at most 3 photos.
          const images = [r.ref, ...item.before].filter((v, i, a) => a.indexOf(v) === i).slice(0, 3);
          await retry(() => call('PUT', `/api/v1/products/${p.id}`, bodyFor(p, images)));
          item.status = 'applied';
          item.dropped = item.before.filter((b) => !images.includes(b));
        } else if (RUN === 'apply') {
          item.note = 'rendered but not applied: the design has an external photo link';
        }
        done++;
        console.log(`  [${done}/${batch.length}] ${p.category} / ${p.sku}: ${item.status}`);
      } catch (e) {
        failed++;
        item.status = 'failed';
        item.error = e.message;
        console.log(`  FAILED ${p.sku}: ${e.message}`);
        if (e.status === 402 || e.code === 'credits' || e.code === 'cap' || e.status === 429 || e.status === 503) {
          stop = true; // no credits, monthly cap reached, or AI paused: nothing more can succeed
          console.log('  Stopping: ' + e.message);
        }
      }
      saveReport(report);
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  saveReport(report);
  console.log(`\nDone: ${done} rendered, ${failed} failed. Report: ${REPORT}. Re-run the same command to carry on; a re-run never charges a finished design twice.`);
  if (RUN === 'apply') console.log(`To undo: REVERT=${REPORT} BASE_URL=... ADMIN_EMAIL=... ADMIN_PASSWORD=... node scripts/batch-enhance.mjs`);
}

main().catch((e) => {
  console.error('Stopped: ' + e.message);
  process.exit(1);
});
