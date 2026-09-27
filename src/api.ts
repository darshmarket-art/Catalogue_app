import { Product, Category, OrderItem, AnalyticsData, AdminOrder, OrderStatus } from './types';
import { merchant } from './merchant';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    /** True when the app has already told the user (e.g. the session expired), so callers should stay quiet. */
    public handled = false
  ) {
    super(message);
  }
}

let onUnauthorized: (() => void) | null = null;

/** Called once when a signed-in user's token is rejected (expired, or the account was removed). */
export const setUnauthorizedHandler = (fn: (() => void) | null) => {
  onUnauthorized = fn;
};

// Kept in sessionStorage: it survives reloads and back/forward navigation, and disappears when the tab or
// browser is closed. (Not localStorage, so it never outlives the visit; tokens also expire on the server.)
const SESSION_KEY = 'catalogue_session';

const readStoredToken = (): string | null => {
  try {
    return sessionStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
};

let authToken: string | null = readStoredToken();

export const setAuthToken = (token: string | null) => {
  authToken = token;
  try {
    if (token) sessionStorage.setItem(SESSION_KEY, token);
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // storage unavailable (private mode): the session then lasts until the page is reloaded
  }
};

export const hasStoredSession = () => authToken !== null;

export type RestoredSession =
  | { type: 'retailer'; user: { storeName: string; phone: string } }
  | { type: 'admin' }
  | null;

async function request<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body) headers.set('Content-Type', 'application/json');
  if (authToken) headers.set('Authorization', `Bearer ${authToken}`);

  const usedToken = authToken;
  const res = await fetch(path, { ...init, headers });
  const json = await res.json().catch(() => ({}));
  const sessionExpired = res.status === 401 && usedToken !== null && authToken === usedToken;
  if (sessionExpired) {
    setAuthToken(null);
    onUnauthorized?.();
  }
  if (!res.ok || json.status === 'error') {
    throw new ApiError(res.status, json.message || `Request failed (${res.status})`, sessionExpired);
  }
  return json as T;
}

const post = (path: string, body?: unknown) =>
  request(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) });

let memorySessionId: string | null = null;

/** Anonymous per-tab visitor id used for presence and unique-view counting. */
export function getSessionId(): string {
  try {
    let sid = sessionStorage.getItem('catalogue_session_id');
    if (!sid) {
      sid = `sess-${crypto.randomUUID()}`;
      sessionStorage.setItem('catalogue_session_id', sid);
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
  /** Re-checks a stored token with the server; quietly forgets it if it is no longer valid. */
  async restoreSession(): Promise<RestoredSession> {
    if (!authToken) return null;
    try {
      const res = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${authToken}` } });
      if (res.status === 401) setAuthToken(null);
      if (!res.ok) return null;
      const json = await res.json();
      return json.type === 'admin' ? { type: 'admin' } : { type: 'retailer', user: json.user };
    } catch {
      return null;
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

  async getAdminOrders(): Promise<AdminOrder[]> {
    return (await request('/api/admin/orders?limit=100')).data;
  },

  async setOrderStatus(poId: string, status: OrderStatus): Promise<void> {
    await request(`/api/admin/orders/${encodeURIComponent(poId)}`, { method: 'PATCH', body: JSON.stringify({ status }) });
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
    link.download = `${merchant.id}_audit_ledger.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }
};
