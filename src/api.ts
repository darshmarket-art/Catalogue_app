import {
  Product,
  Category,
  Banner,
  Purity,
  About,
  OrderItem,
  AnalyticsData,
  AdminOrder,
  OrderStatus,
  PastOrder,
  VisitorSummary,
  VisitorDetail,
  VisitorKind,
  BuyerRow
} from './types';
import { merchant } from './merchant';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

// Build-time API origin for native builds (e.g. https://app.example.com); empty on web = same origin.
const API_BASE: string = import.meta.env.VITE_API_BASE ?? '';
const native = Capacitor.isNativePlatform();

// The server returns photo links as /media/...; inside the native app those must point at the server, not the app itself.
const withBase = (_key: string, v: unknown) => (typeof v === 'string' && v.startsWith('/media/') ? API_BASE + v : v);
const parseJson = (res: Response) => res.text().then((t) => JSON.parse(t, API_BASE ? withBase : undefined)).catch(() => ({} as any));

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

let authToken: string | null = native ? null : readStoredToken();

export const setAuthToken = (token: string | null) => {
  authToken = token;
  if (native) {
    void (token ? Preferences.set({ key: SESSION_KEY, value: token }) : Preferences.remove({ key: SESSION_KEY }));
    return;
  }
  try {
    if (token) sessionStorage.setItem(SESSION_KEY, token);
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // storage unavailable (private mode): the session then lasts until the page is reloaded
  }
};

// Native: the token loads asynchronously (in restoreSession), so assume one may exist and let it resolve.
export const hasStoredSession = () => native || authToken !== null;

export type RestoredSession =
  | { type: 'retailer'; user: { storeName: string; phone: string; ownerName?: string; gstin?: string; marketHub?: string }; mustChangePassword: boolean }
  | { type: 'admin' }
  | null;

async function request<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body) headers.set('Content-Type', 'application/json');
  if (authToken) headers.set('Authorization', `Bearer ${authToken}`);
  if (native) headers.set('X-App-Client', 'native');

  const usedToken = authToken;
  const res = await fetch(API_BASE + path, { ...init, headers });
  const json = await parseJson(res);
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

type ActivityEvent = { type: 'dwell'; sku: string; ms: number } | { type: 'search'; term: string } | { type: 'select'; sku: string };
const pendingEvents: ActivityEvent[] = [];
const pendingDwell = new Map<string, number>();

/** Sends what the visitor has looked at since the last flush. Never blocks or breaks the UI. */
export function flushActivity() {
  for (const [sku, ms] of pendingDwell) pendingEvents.push({ type: 'dwell', sku, ms });
  pendingDwell.clear();
  if (pendingEvents.length === 0) return;
  const events = pendingEvents.splice(0, 60);
  // Signed-in buyers are recorded under their account; in a public catalogue a guest is recorded by browser session.
  fetch(API_BASE + '/api/analytics/activity', {
    method: 'POST',
    keepalive: true,
    headers: { 'Content-Type': 'application/json', ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) },
    body: JSON.stringify({ sessionId: getSessionId(), events })
  }).catch(() => {});
}

/** Time a product was on screen (milliseconds); merged per product and sent with the next flush. */
export const trackDwell = (sku: string, ms: number) => pendingDwell.set(sku, (pendingDwell.get(sku) ?? 0) + ms);
export const trackSearch = (term: string) => pendingEvents.push({ type: 'search', term });
export const trackSelect = (sku: string) => pendingEvents.push({ type: 'select', sku });

export const api = {
  /** Re-checks a stored token with the server; quietly forgets it if it is no longer valid. */
  async restoreSession(): Promise<RestoredSession> {
    if (native) authToken = (await Preferences.get({ key: SESSION_KEY })).value;
    if (!authToken) return null;
    try {
      const res = await fetch(API_BASE + '/api/auth/me', { headers: { Authorization: `Bearer ${authToken}`, ...(native ? { 'X-App-Client': 'native' } : {}) } });
      if (res.status === 401) setAuthToken(null);
      if (!res.ok) return null;
      const json = await res.json();
      if (native && typeof json.token === 'string') setAuthToken(json.token); // renewed: the session slides forward on every app start
      return json.type === 'admin'
        ? { type: 'admin' }
        : { type: 'retailer', user: json.user, mustChangePassword: Boolean(json.mustChangePassword) };
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

  async updateCategory(id: string, cat: Partial<Category>): Promise<Category> {
    return (await request(`/api/categories/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(cat) })).data;
  },

  async deleteCategory(id: string): Promise<void> {
    await request(`/api/categories/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  async getBanners(): Promise<Banner[]> {
    try {
      return (await request('/api/banners')).data;
    } catch {
      return [];
    }
  },

  async addBanner(image: string, category?: string): Promise<Banner> {
    return (await post('/api/banners', { image, ...(category ? { category } : {}) })).data;
  },

  async setBannerLink(id: string, category: string | null): Promise<Banner> {
    return (await request(`/api/banners/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify({ category }) })).data;
  },

  async reorderBanners(ids: string[]): Promise<void> {
    await request('/api/banners/order', { method: 'PUT', body: JSON.stringify({ ids }) });
  },

  async getAbout(): Promise<About> {
    try {
      return (await request('/api/about')).data;
    } catch {
      return {};
    }
  },

  async saveAbout(about: About): Promise<About> {
    return (await request('/api/about', { method: 'PUT', body: JSON.stringify(about) })).data;
  },

  async cancelOrder(poId: string): Promise<void> {
    await request(`/api/orders/${encodeURIComponent(poId)}/cancel`, { method: 'POST' });
  },

  async getPurities(): Promise<Purity[] | null> {
    try {
      return (await request('/api/purities')).data;
    } catch {
      return null;
    }
  },

  async savePurities(purities: Array<{ key: string; enabled: boolean }>): Promise<Purity[]> {
    return (await request('/api/purities', { method: 'PUT', body: JSON.stringify({ purities }) })).data;
  },

  async getShortlist(): Promise<string[]> {
    try {
      return (await request('/api/shortlist')).data.skus;
    } catch {
      return [];
    }
  },

  async saveShortlist(skus: string[]): Promise<void> {
    await request('/api/shortlist', { method: 'PUT', body: JSON.stringify({ skus }) });
  },

  async deleteBanner(id: string): Promise<void> {
    await request(`/api/banners/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  /** Sends the original photo, untouched, to the merchant's storage. Returns the stored reference and a display link. */
  async uploadPhoto(file: File): Promise<{ ref: string; url: string }> {
    const res = await fetch(API_BASE + '/api/admin/photos', {
      method: 'POST',
      headers: { 'Content-Type': file.type, ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) },
      body: file
    });
    const json = await parseJson(res);
    if (res.status === 401) {
      setAuthToken(null);
      onUnauthorized?.();
      throw new ApiError(401, 'Your session has expired.', true);
    }
    if (!res.ok || json.status === 'error') throw new ApiError(res.status, json.message || 'The photo could not be uploaded.');
    return json.data;
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

  async updateProduct(id: string, prod: Partial<Product>): Promise<Product> {
    return (await request(`/api/products/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(prod) })).data;
  },

  async deleteProduct(id: string): Promise<void> {
    await request(`/api/products/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  async getOrderHistory(): Promise<PastOrder[]> {
    try {
      return (await request('/api/orders/history')).data;
    } catch {
      return [];
    }
  },

  async getVisitors(kind: VisitorKind): Promise<VisitorSummary[]> {
    return (await request(`/api/admin/visitors?kind=${kind}`)).data;
  },

  async getVisitor(id: string): Promise<VisitorDetail> {
    return (await request(`/api/admin/visitors/${encodeURIComponent(id)}`)).data;
  },

  async getBuyers(): Promise<BuyerRow[]> {
    return (await request('/api/admin/buyers')).data;
  },

  async resetBuyerPassword(phone: string): Promise<{ firmName: string; temporaryPassword: string }> {
    return (await post(`/api/admin/buyers/${encodeURIComponent(phone)}/reset-password`)).data;
  },

  async changePassword(payload: { currentPassword: string; newPassword: string }): Promise<void> {
    await post('/api/auth/retailer/change-password', payload);
  },

  async getOrders(): Promise<{ items: OrderItem[]; totalWeight: number; totalPieces: number }> {
    try {
      const json = await request('/api/orders');
      return { items: json.data, totalWeight: json.totalWeightNetGrams, totalPieces: json.totalPieces };
    } catch {
      return { items: [], totalWeight: 0, totalPieces: 0 };
    }
  },

  async addOrderItem(item: { sku: string; batchQty: number; qtyUnit?: string; note?: string; purity?: string }): Promise<OrderItem> {
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

  async requestOtp(phone: string) {
    return post('/api/auth/retailer/request-otp', { phone });
  },

  async verifyOtp(payload: { phone: string; code: string; firmName?: string }) {
    const json = await post('/api/auth/retailer/verify-otp', payload);
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
    const res = await fetch(API_BASE + '/api/analytics/export', { headers: authToken ? { Authorization: `Bearer ${authToken}` } : {} });
    if (!res.ok) throw new ApiError(res.status, 'Export failed. Please sign in again.');
    const url = URL.createObjectURL(await res.blob());
    const link = document.createElement('a');
    link.href = url;
    link.download = `${merchant.id}_audit_ledger.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }
};
