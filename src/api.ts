import { Product, Category, OrderItem, BullionRates, AnalyticsData } from './types';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

// Held in memory only (not localStorage) so an XSS bug cannot lift a long-lived token.
let authToken: string | null = null;

export const setAuthToken = (token: string | null) => {
  authToken = token;
};

async function request<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body) headers.set('Content-Type', 'application/json');
  if (authToken) headers.set('Authorization', `Bearer ${authToken}`);

  const res = await fetch(path, { ...init, headers });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.status === 'error') {
    throw new ApiError(res.status, json.message || `Request failed (${res.status})`);
  }
  return json as T;
}

const post = (path: string, body?: unknown) =>
  request(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) });

let memorySessionId: string | null = null;

/** Anonymous per-tab visitor id used for presence and unique-view counting. */
export function getSessionId(): string {
  try {
    let sid = sessionStorage.getItem('bhakti_session_id');
    if (!sid) {
      sid = `sess-${crypto.randomUUID()}`;
      sessionStorage.setItem('bhakti_session_id', sid);
    }
    return sid;
  } catch {
    memorySessionId ??= `sess-${crypto.randomUUID()}`;
    return memorySessionId;
  }
}

const seenSkus = new Set<string>();
const pendingSkus = new Set<string>();
let flushTimer: number | undefined;

async function flushProductViews() {
  flushTimer = undefined;
  const skus = [...pendingSkus];
  pendingSkus.clear();
  for (let i = 0; i < skus.length; i += 50) {
    try {
      await post('/api/analytics/product-views', { sessionId: getSessionId(), skus: skus.slice(i, i + 50) });
    } catch {
      // telemetry must never break the UI
    }
  }
}

/** Records that a product card was seen; batched, and sent at most once per SKU per page load. */
export function trackProductView(sku: string) {
  if (seenSkus.has(sku)) return;
  seenSkus.add(sku);
  pendingSkus.add(sku);
  flushTimer ??= window.setTimeout(flushProductViews, 2000);
}

export const api = {
  async getRates(): Promise<BullionRates> {
    try {
      return (await request('/api/rates')).data;
    } catch {
      return {
        mcx24k: 72480,
        changePercent: '+0.42%',
        gold916: 66420,
        gold750: 54360,
        silver999: 84600,
        lastSync: '14:05:22 IST',
        guildDeskPhone: '+91 22 2340 8899',
        activeSessionLocks: 28
      };
    }
  },

  async getCategories(): Promise<Category[]> {
    try {
      return (await request('/api/categories')).data;
    } catch {
      return [];
    }
  },

  async createCategory(cat: Partial<Category>): Promise<Category> {
    return (await post('/api/categories', cat)).data;
  },

  async getProducts(params?: { search?: string; category?: string; purity?: string }): Promise<Product[]> {
    try {
      const query = new URLSearchParams(params as Record<string, string>).toString();
      return (await request(`/api/products?${query}`)).data;
    } catch {
      return [];
    }
  },

  async createProduct(prod: Partial<Product>): Promise<Product> {
    return (await post('/api/products', prod)).data;
  },

  async getOrders(): Promise<{ items: OrderItem[]; totalWeight: number; totalPieces: number }> {
    try {
      const json = await request('/api/orders');
      return { items: json.data, totalWeight: json.totalWeightNetGrams, totalPieces: json.totalPieces };
    } catch {
      return { items: [], totalWeight: 0, totalPieces: 0 };
    }
  },

  async addOrderItem(item: { sku: string; batchQty: number; qtyUnit?: string; note?: string }): Promise<OrderItem> {
    return (await post('/api/orders/items', item)).data;
  },

  async removeOrderItem(id: string): Promise<void> {
    await request(`/api/orders/items/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  async confirmOrder(): Promise<{ poId: string; totalNetGrams: number; whatsappMessage: string }> {
    return post('/api/orders/confirm');
  },

  async getAnalytics(): Promise<AnalyticsData> {
    return (await request('/api/analytics')).data;
  },

  async recordInquiry(payload?: { clientFirm?: string; itemsCount?: number; totalNetWeight?: number }): Promise<void> {
    try {
      await post('/api/analytics/track-inquiry', payload || {});
    } catch {
      // telemetry must never break the UI
    }
  },

  async sendHeartbeat(): Promise<void> {
    try {
      await post('/api/analytics/heartbeat', { sessionId: getSessionId() });
    } catch {
      // telemetry must never break the UI
    }
  },

  async signupRetailer(payload: {
    firmName: string;
    gstin: string;
    ownerName: string;
    phone: string;
    password: string;
    marketHub: string;
  }) {
    const json = await post('/api/auth/retailer/signup', payload);
    setAuthToken(json.token);
    return json;
  },

  async loginRetailer(payload: { phone: string; password: string }) {
    const json = await post('/api/auth/retailer/login', payload);
    setAuthToken(json.token);
    return json;
  },

  async loginAdmin(payload: { adminId: string; password: string }) {
    const json = await post('/api/auth/admin/login', payload);
    setAuthToken(json.sessionToken);
    return json;
  },

  async registerAdmin(payload: {
    name: string;
    email: string;
    password: string;
    role: string;
    masterProvisioningKey: string;
  }) {
    // Provisioning does not sign the new admin in; they authenticate on the login form.
    return post('/api/auth/admin/register', payload);
  },

  async getAuditLogs() {
    try {
      return (await request('/api/admin/audit-logs')).data || [];
    } catch {
      return [];
    }
  },

  async downloadAuditExport(): Promise<void> {
    const res = await fetch('/api/analytics/export', { headers: authToken ? { Authorization: `Bearer ${authToken}` } : {} });
    if (!res.ok) throw new ApiError(res.status, 'Export failed. Please sign in again.');
    const url = URL.createObjectURL(await res.blob());
    const link = document.createElement('a');
    link.href = url;
    link.download = 'bhakti_audit_ledger.csv';
    link.click();
    URL.revokeObjectURL(url);
  }
};
