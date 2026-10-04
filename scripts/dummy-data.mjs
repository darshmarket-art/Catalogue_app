// Local test data: dummy buyers (name + phone + hub), shortlists, order lines and confirmed orders, made through the real API.
// Usage (server running in memory mode with OTP_STATIC_CODE=123456, e.g. on port 3180):
//   node scripts/dummy-data.mjs http://localhost:3180
const base = (process.argv[2] || 'http://localhost:3000').replace(/\/$/, '');
const CODE = process.env.OTP_STATIC_CODE || '123456';
const post = async (path, body, token, method = 'POST') => {
  const res = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${path} -> ${res.status} ${json.message || ''}`);
  return json;
};
const get = async (path, token) => (await fetch(base + path, { headers: { Authorization: `Bearer ${token}` } })).json();

const BUYERS = [
  { name: 'Ramesh Shah', phone: '9820011001', hub: 'Zaveri Bazaar, Mumbai' },
  { name: 'Priya Jewellers', phone: '9820011002', hub: 'Johari Bazaar, Jaipur' },
  { name: 'Mehul Choksi & Sons', phone: '9820011003', hub: 'Opera House, Mumbai' },
  { name: 'Anita Devi', phone: '9820011004', hub: 'Sarafa Bazaar, Indore' },
  { name: 'Kapoor Ornaments', phone: '9820011005', hub: 'Chandni Chowk, Delhi' }
];

const products = (await (await fetch(base + '/api/products')).json().catch(() => ({}))).data;
for (const b of BUYERS) {
  await post('/api/auth/retailer/request-otp', { phone: b.phone });
  const { token } = await post('/api/auth/retailer/verify-otp', { phone: b.phone, code: CODE, firmName: b.name, ownerName: b.name, marketHub: b.hub });
  // products are for signed-in buyers only
  const list = (await get('/api/products', token)).data || products || [];
  const skus = list.slice(0, 4).map((p) => p.sku);
  if (skus.length) {
    await post('/api/shortlist', { skus: skus.slice(0, 3) }, token, 'PUT').catch(() => {});
    await post('/api/orders/items', { sku: skus[0], batchQty: 2 }, token);
    await post('/api/orders/items', { sku: skus[0], batchQty: 1 }, token); // merges into the same line (qty 3)
    if (skus[1]) await post('/api/orders/items', { sku: skus[1], batchQty: 1 }, token);
    if (b.phone.endsWith('2') || b.phone.endsWith('4')) await post('/api/orders/confirm', {}, token).catch((e) => console.log('confirm:', e.message));
  }
  console.log('buyer ready:', b.name, b.phone);
}
console.log('done');
