// Times the buyer's catalogue calls against a running bench server (scripts/bench-serve.ts). Prints a markdown table.
//   BASE=http://127.0.0.1:4511 node scripts/bench-http.mjs
const BASE = process.env.BASE ?? 'http://127.0.0.1:4511';
const H = (extra = {}) => ({ 'content-type': 'application/json', ...extra });
const j = async (path, init = {}) => {
  const res = await fetch(BASE + path, init);
  return { res, body: await res.json().catch(() => ({})) };
};

await j('/api/auth/retailer/request-otp', { method: 'POST', headers: H(), body: JSON.stringify({ phone: '9820000001' }) });
const v = await j('/api/auth/retailer/verify-otp', { method: 'POST', headers: H(), body: JSON.stringify({ phone: '9820000001', firmName: 'Bench', code: '123456' }) });
const auth = H({ authorization: `Bearer ${v.body.token}` });

const time = async (path) => {
  const t = performance.now();
  const { res, body } = await j(path, { headers: auth });
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return { ms: performance.now() - t, body };
};
const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
const rows = [];
const bench = async (label, path, runs = 5) => {
  const first = await time(path);
  const ms = [];
  for (let i = 0; i < runs; i++) ms.push((await time(path)).ms);
  rows.push([label, first.ms, median(ms), first.body.count ?? first.body.data?.length ?? '']);
};

const first = await time('/api/products?sort=newest&limit=24&offset=0'); // very first catalogue request: includes the one-off index/counter build
rows.push(['first request after start (cold build)', first.ms, first.ms, first.body.count]);
await bench('catalogue page 1 (newest, 24)', '/api/products?sort=newest&limit=24&offset=0');
await bench('catalogue next page (offset 24)', '/api/products?sort=newest&limit=24&offset=24');
await bench('search "necklace" (24)', '/api/products?search=necklace&limit=24');
await bench('search Hindi "हार" (24)', '/api/products?search=%E0%A4%B9%E0%A4%BE%E0%A4%B0&limit=24');
await bench('filter category + purity + weight, sort name', '/api/products?category=Rings&purity=22K%20916&minWt=5&sort=name&limit=24');
await bench('by-sku (1 SKU)', '/api/products/by-sku?skus=SKU-12000');
await bench('/categories', '/api/categories');
await bench('/entitlements', '/api/entitlements');
await bench('old boot: /products? (default limit 200)', '/api/products');

// A buyer's boot, the way the app fires it: categories + entitlements in parallel (+ the 200 products the old client also fetched).
const boot = async (withProducts) => {
  const t = performance.now();
  await Promise.all([time('/api/categories'), time('/api/entitlements'), time('/api/tags'), time('/api/banners'), ...(withProducts ? [time('/api/products')] : [])]);
  return performance.now() - t;
};
rows.push(['boot, old client (incl. 200 products)', await boot(true), median([await boot(true), await boot(true), await boot(true)]), '']);
rows.push(['boot, new client (no product fetch)', await boot(false), median([await boot(false), await boot(false), await boot(false)]), '']);

// 20 searches at once: with a CPU-bound handler they finish one after another.
const t0 = performance.now();
const each = await Promise.all(Array.from({ length: 20 }, (_, i) => time(`/api/products?search=${['necklace', 'lakshmi', 'temple', 'floral'][i % 4]}&limit=24&offset=${(i % 3) * 24}`).then((r) => r.ms)));
rows.push([`20 concurrent searches: wall ${Math.round(performance.now() - t0)} ms`, Math.max(...each), median(each), '']);

console.log('| call | first / worst (ms) | median (ms) | count |\n|---|---:|---:|---:|');
for (const [a, b, c, d] of rows) console.log(`| ${a} | ${Math.round(b)} | ${Math.round(c)} | ${d} |`);
