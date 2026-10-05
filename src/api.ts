import {
  Product,
  Category,
  Banner,
  Purity,
  About,
  OrderItem,
  AnalyticsData,
  AdminOrder,
  AdminRow,
  OrderStatus,
  PastOrder,
  VisitorSummary,
  VisitorDetail,
  VisitorKind,
  BuyerRow,
  EnquiryRow,
  AdminSummary
} from './types';
import { merchant } from './merchant';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

// Build-time API origin for native builds (e.g. https://app.example.com); empty on web = same origin.
const API_BASE: string = import.meta.env.VITE_API_BASE ?? '';
const native = Capacitor.isNativePlatform();
declare const __APP_VERSION__: string;

// Which store this app talks to. On a [store].antarixs.com address the host already says; on localhost, the Cloud Run address and native builds it comes from ?store=, remembered for the tab, or VITE_STORE.
const STORE: string = (() => {
  const built = import.meta.env.VITE_STORE ?? '';
  try {
    const q = new URLSearchParams(location.search).get('store');
    if (q) localStorage.setItem('store', q);
    return localStorage.getItem('store') || built;
  } catch {
    return built;
  }
})();

// Every API call states the app version; a server that has raised its minimum answers 426 and the app shows "Please update".
const apiFetch = async (url: string, init: RequestInit = {}) => {
  const headers = new Headers(init.headers);
  headers.set('X-App-Version', __APP_VERSION__);
  if (STORE) headers.set('X-Store', STORE);
  const res = await fetch(url, { ...init, headers });
  if (res.status === 426) window.dispatchEvent(new Event('app-update-required'));
  return res;
};

// The server returns photo links as /media/...; inside the native app those must point at the server, not the app itself.
// <img> loads cannot send X-Store, so photo links carry it as a query parameter.
const withBase = (_key: string, v: unknown) =>
  typeof v === 'string' && v.startsWith('/media/') ? API_BASE + v + (STORE ? (v.includes('?') ? '&' : '?') + 'store=' + encodeURIComponent(STORE) : '') : v;
const parseJson = (res: Response) => res.text().then((t) => JSON.parse(t, API_BASE || STORE ? withBase : undefined)).catch(() => ({} as any));

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    /** True when the app has already told the user (e.g. the session expired), so callers should stay quiet. */
    public handled = false,
    /** Machine-readable reason from the server, e.g. CATALOGUE_FULL or TRIAL_USED. */
    public code?: string
  ) {
    super(message);
  }
}

let onUnauthorized: (() => void) | null = null;

/** Called once when a signed-in user's token is rejected (expired, or the account was removed). */
export const setUnauthorizedHandler = (fn: (() => void) | null) => {
  onUnauthorized = fn;
};

// Kept in localStorage so people stay signed in after closing the browser. The server token lasts a month for buyers and for admins
// who ticked "Keep me signed in" (renewed on every visit), or 8 hours for admins who did not.
const SESSION_KEY = 'catalogue_session';

const readStoredToken = (): string | null => {
  try {
    return localStorage.getItem(SESSION_KEY);
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
    if (token) localStorage.setItem(SESSION_KEY, token);
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    // storage unavailable (private mode): the session then lasts until the page is reloaded
  }
};

// Native: the token loads asynchronously (in restoreSession), so assume one may exist and let it resolve.
export const hasStoredSession = () => native || authToken !== null;

export type RestoredSession =
  | { type: 'retailer'; user: { storeName: string; phone: string; ownerName?: string; gstin?: string; marketHub?: string }; mustChangePassword: boolean }
  | { type: 'admin'; mustChangePassword: boolean; email: string }
  | null;

/** What the catalogue may be asked for; every field is optional and they combine. Lists are comma-separated. */
export interface ProductQuery {
  search?: string;
  category?: string;
  purity?: string;
  minWt?: string | number;
  maxWt?: string | number;
  availability?: string;
  sort?: string;
  limit?: number;
  offset?: number;
}

export interface ProductPage {
  items: Product[];
  total: number;
  hasMore: boolean;
}

export interface AlertSettings {
  numbers: string[];
  maxNumbers: number;
  defaultNumber: string;
  whatsappConfigured: boolean;
  storeFullConfigured: boolean;
  pushConfigured: boolean;
  receiptsConnected: boolean;
  wording: { placed: string; cancelled: string; storeFull: string };
}

export interface AlertTestResult {
  results: { to: string; ok: boolean; error?: string; messageId?: string | null }[];
  pushed: number;
  whatsappConfigured: boolean;
}

export type MessageStatus = 'accepted' | 'sent' | 'delivered' | 'read' | 'failed';
export type FailureKind = 'not-on-whatsapp' | 'undeliverable' | 'other';
export type MessageKind = 'otp' | 'signup-otp' | 'admin-reset' | 'order' | 'store-full' | 'test' | 'trial';

export interface MessageRow {
  id: string;
  kind: MessageKind;
  to: string;
  buyer: string | null;
  status: MessageStatus;
  failure: FailureKind | null;
  errorCode: number | null;
  errorTitle: string | null;
  createdAt: string;
  updatedAt: string;
  receiptAt: string | null;
}

export interface MessagesPage {
  receipts: { connected: boolean; lastAt: string | null };
  counts: { today: number; failed: number; week: { total: number; delivered: number; failed: number; deliveredRate: number | null } };
  total: number;
  data: MessageRow[];
}

export interface Insights {
  periodLabel: string;
  summary: string;
  kpis: { views7: number; views7Prev: number; orders7: number; orders7Prev: number; activeBuyers7: number; activeBuyers30: number; newBuyers7: number; buyers: number; shortlisters: number; shortlistedDesigns: number };
  weeks: Array<{ label: string; views: number; orders: number; visitors: number }>;
  topDesigns: Array<{ sku: string; name: string; category: string; views: number }>;
  collections: Array<{ name: string; views: number; designs: number }>;
  whatsapp: { total: number; delivered: number; failed: number; deliveredRate: number | null; receiptsConnected: boolean } | null;
}

async function request<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body) headers.set('Content-Type', 'application/json');
  if (authToken) headers.set('Authorization', `Bearer ${authToken}`);
  if (native) headers.set('X-App-Client', 'native');

  const usedToken = authToken;
  const res = await apiFetch(API_BASE + path, { ...init, headers });
  const json = await parseJson(res);
  const sessionExpired = res.status === 401 && usedToken !== null && authToken === usedToken;
  if (sessionExpired) {
    setAuthToken(null);
    onUnauthorized?.();
  }
  if (!res.ok || json.status === 'error') {
    throw new ApiError(res.status, json.message || `Request failed (${res.status})`, sessionExpired, typeof json.code === 'string' ? json.code : undefined);
  }
  return json as T;
}

const post = (path: string, body?: unknown) =>
  request(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) });

let memorySessionId: string | null = null;

/** Anonymous per-tab visitor id used for presence and unique-view counting. */
export function getSessionId(): string {
  try {
    let sid = localStorage.getItem('catalogue_session_id');
    if (!sid) {
      sid = `sess-${crypto.randomUUID()}`;
      localStorage.setItem('catalogue_session_id', sid);
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
      await post('/api/v1/analytics/product-views', { sessionId: getSessionId(), skus: skus.slice(i, i + 50) });
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
  apiFetch(API_BASE + '/api/v1/analytics/activity', {
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
  pushKey: async (): Promise<string | null> => {
    const d = (await request('/api/v1/admin/push/key')).data;
    return d.enabled ? d.publicKey : null;
  },
  pushSubscribe: async (sub: unknown) => { await post('/api/v1/admin/push/subscribe', sub); },
  pushUnsubscribe: async (endpoint: string) => { await post('/api/v1/admin/push/unsubscribe', { endpoint }); },
  /** Re-checks a stored token with the server; quietly forgets it if it is no longer valid. */
  async restoreSession(): Promise<RestoredSession> {
    if (native) authToken = (await Preferences.get({ key: SESSION_KEY })).value;
    if (!authToken) return null;
    try {
      const res = await apiFetch(API_BASE + '/api/v1/auth/me', { headers: { Authorization: `Bearer ${authToken}`, ...(native ? { 'X-App-Client': 'native' } : {}) } });
      if (res.status === 401) setAuthToken(null);
      if (!res.ok) return null;
      const json = await res.json();
      // Renewed by the server (sliding session): keep the newest token so the session never lapses while in use.
      if (typeof json.token === 'string') setAuthToken(json.token);
      return json.type === 'admin'
        ? { type: 'admin', mustChangePassword: Boolean(json.mustChangePassword), email: json.admin?.email ?? '' }
        : { type: 'retailer', user: json.user, mustChangePassword: Boolean(json.mustChangePassword) };
    } catch {
      return null;
    }
  },

  async getCategories(): Promise<Category[]> {
    try {
      return (await request('/api/v1/categories')).data;
    } catch {
      return [];
    }
  },

  async createCategory(cat: Partial<Category>): Promise<Category> {
    return (await post('/api/v1/categories', cat)).data;
  },

  async updateCategory(id: string, cat: Partial<Category>): Promise<Category> {
    return (await request(`/api/v1/categories/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(cat) })).data;
  },

  async deleteCategory(id: string): Promise<void> {
    await request(`/api/v1/categories/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  async getBanners(): Promise<Banner[]> {
    try {
      return (await request('/api/v1/banners')).data;
    } catch {
      return [];
    }
  },

  async addBanner(image: string, category?: string): Promise<Banner> {
    return (await post('/api/v1/banners', { image, ...(category ? { category } : {}) })).data;
  },

  async setBannerLink(id: string, category: string | null): Promise<Banner> {
    return (await request(`/api/v1/banners/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify({ category }) })).data;
  },

  async reorderBanners(ids: string[]): Promise<void> {
    await request('/api/v1/banners/order', { method: 'PUT', body: JSON.stringify({ ids }) });
  },

  async getAbout(): Promise<About> {
    try {
      return (await request('/api/v1/about')).data;
    } catch {
      return {};
    }
  },

  async saveAbout(about: About): Promise<About> {
    return (await request('/api/v1/about', { method: 'PUT', body: JSON.stringify(about) })).data;
  },

  async cancelOrder(poId: string): Promise<void> {
    await request(`/api/v1/orders/${encodeURIComponent(poId)}/cancel`, { method: 'POST' });
  },

  async getPurities(): Promise<Purity[] | null> {
    try {
      return (await request('/api/v1/purities')).data;
    } catch {
      return null;
    }
  },

  async savePurities(purities: Array<{ key: string; enabled: boolean }>): Promise<Purity[]> {
    return (await request('/api/v1/purities', { method: 'PUT', body: JSON.stringify({ purities }) })).data;
  },

  async getShortlist(): Promise<string[]> {
    try {
      return (await request('/api/v1/shortlist')).data.skus;
    } catch {
      return [];
    }
  },

  async saveShortlist(skus: string[]): Promise<void> {
    await request('/api/v1/shortlist', { method: 'PUT', body: JSON.stringify({ skus }) });
  },

  async deleteBanner(id: string): Promise<void> {
    await request(`/api/v1/banners/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  /** Sends the original photo, untouched, to the merchant's storage. Returns the stored reference and a display link. */
  async uploadPhoto(file: File): Promise<{ ref: string; url: string }> {
    const res = await apiFetch(API_BASE + '/api/v1/admin/photos', {
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
      return (await request(`/api/v1/products?${query}`)).data;
    } catch {
      return [];
    }
  },

  /** One page of the catalogue for a search, filters and sort. Unlike getProducts this reports failures, so the screen can say so. */
  async queryProducts(q: ProductQuery): Promise<ProductPage> {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== null && String(v) !== '') params.set(k, String(v));
    const json = await request(`/api/v1/products?${params.toString()}`);
    return { items: json.data, total: json.total ?? json.count ?? json.data.length, hasMore: Boolean(json.hasMore) };
  },

  async createProduct(prod: Partial<Product>): Promise<Product> {
    return (await post('/api/v1/products', prod)).data;
  },

  async updateProduct(id: string, prod: Partial<Product>): Promise<Product> {
    return (await request(`/api/v1/products/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(prod) })).data;
  },

  async deleteProduct(id: string): Promise<void> {
    await request(`/api/v1/products/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  async getOrderHistory(): Promise<PastOrder[]> {
    try {
      return (await request('/api/v1/orders/history')).data;
    } catch {
      return [];
    }
  },

  async getVisitors(kind: VisitorKind): Promise<VisitorSummary[]> {
    return (await request(`/api/v1/admin/visitors?kind=${kind}`)).data;
  },

  async getVisitor(id: string): Promise<VisitorDetail> {
    return (await request(`/api/v1/admin/visitors/${encodeURIComponent(id)}`)).data;
  },

  /** A buyer tapped a WhatsApp button; the owner's Enquiries inbox lists it. Never breaks the UI. */
  async recordEnquiry(payload: { kind: 'design' | 'shortlist' | 'order'; sku?: string; title?: string; purity?: string; count?: number }): Promise<void> {
    try {
      await post('/api/v1/enquiries', payload);
    } catch {
      // the WhatsApp chat opens regardless
    }
  },

  async markEnquiryReplied(id: string): Promise<void> {
    try {
      await post(`/api/v1/admin/enquiries/${encodeURIComponent(id)}/replied`);
    } catch {
      // the WhatsApp chat opens regardless
    }
  },

  async getAdminSummary(): Promise<AdminSummary> {
    return (await request('/api/v1/admin/summary')).data;
  },

  async getEnquiries(): Promise<EnquiryRow[]> {
    return (await request('/api/v1/admin/enquiries')).data;
  },

  async getBuyers(): Promise<BuyerRow[]> {
    return (await request('/api/v1/admin/buyers')).data;
  },

  async removeBuyer(phone: string): Promise<void> {
    await request(`/api/v1/admin/buyers/${encodeURIComponent(phone)}`, { method: 'DELETE' });
  },

  async getOrders(): Promise<{ items: OrderItem[]; totalWeight: number; totalPieces: number }> {
    try {
      const json = await request('/api/v1/orders');
      return { items: json.data, totalWeight: json.totalWeightNetGrams, totalPieces: json.totalPieces };
    } catch {
      return { items: [], totalWeight: 0, totalPieces: 0 };
    }
  },

  async addOrderItem(item: { sku: string; batchQty: number; qtyUnit?: string; note?: string; purity?: string }): Promise<OrderItem> {
    return (await post('/api/v1/orders/items', item)).data;
  },

  async setOrderItemQty(id: string, batchQty: number): Promise<OrderItem> {
    return (await request(`/api/v1/orders/items/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ batchQty }) })).data;
  },

  async removeOrderItem(id: string): Promise<void> {
    await request(`/api/v1/orders/items/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  /** Books the current batch as an order; the optional note goes to the store with it (and into the WhatsApp text). */
  async confirmOrder(note?: string): Promise<{ poId: string; totalNetGrams: number; whatsappMessage: string }> {
    return post('/api/v1/orders/confirm', note?.trim() ? { note: note.trim() } : undefined);
  },

  async getAdminOrders(): Promise<AdminOrder[]> {
    return (await request('/api/v1/admin/orders?limit=100')).data;
  },

  async setOrderStatus(poId: string, status: OrderStatus): Promise<void> {
    await request(`/api/v1/admin/orders/${encodeURIComponent(poId)}`, { method: 'PATCH', body: JSON.stringify({ status }) });
  },

  async getEntitlements(): Promise<any> {
    return (await request('/api/v1/entitlements')).data;
  },

  async getAnalytics(): Promise<AnalyticsData> {
    return (await request('/api/v1/analytics')).data;
  },

  async recordInquiry(payload?: { clientFirm?: string; itemsCount?: number; totalNetWeight?: number }): Promise<void> {
    try {
      await post('/api/v1/analytics/track-inquiry', payload || {});
    } catch {
      // telemetry must never break the UI
    }
  },

  async sendHeartbeat(): Promise<void> {
    try {
      await post('/api/v1/analytics/heartbeat', { sessionId: getSessionId() });
    } catch {
      // telemetry must never break the UI
    }
  },

  async requestOtp(phone: string): Promise<{ message: string; devCode?: string; channel?: 'whatsapp' | 'dev'; messageId?: string | null; receipts?: boolean }> {
    return post('/api/v1/auth/retailer/request-otp', { phone });
  },

  /** Delivery stage of a sign-in code, for the "Delivered ✓" hint on the code screen. */
  async otpStatus(id: string): Promise<{ status: MessageStatus; failure: FailureKind | null; receipts: boolean }> {
    return (await request(`/api/v1/auth/otp-status/${encodeURIComponent(id)}`)).data;
  },

  async verifyOtp(payload: { phone: string; code: string; firmName?: string; ownerName?: string }) {
    const json = await post('/api/v1/auth/retailer/verify-otp', payload);
    if (json.token) setAuthToken(json.token);
    return json;
  },

  async adminForgotRequest(email: string): Promise<{ message: string; devCode?: string }> {
    return post('/api/v1/auth/admin/forgot/request-otp', { email });
  },
  async adminForgotReset(payload: { email: string; code: string; newPassword: string }): Promise<void> {
    await post('/api/v1/auth/admin/forgot/reset', payload);
  },

  async loginAdmin(payload: { adminId: string; password: string; remember?: boolean }) {
    const json = await post('/api/v1/auth/admin/login', payload);
    setAuthToken(json.sessionToken);
    return json;
  },

  async adminChangePassword(payload: { currentPassword: string; newPassword: string }): Promise<void> {
    await post('/api/v1/auth/admin/change-password', payload);
  },

  async getAlerts(): Promise<AlertSettings> {
    return (await request('/api/v1/admin/alerts')).data;
  },
  async saveAlerts(numbers: string[]): Promise<AlertSettings> {
    return (await request('/api/v1/admin/alerts', { method: 'PUT', body: JSON.stringify({ numbers }) })).data;
  },
  async testAlert(): Promise<AlertTestResult> {
    return (await post('/api/v1/admin/alerts/test')).data;
  },

  async getMessages(filter?: 'failed'): Promise<MessagesPage> {
    return (await request(`/api/v1/admin/messages${filter ? `?filter=${filter}` : ''}`)).data;
  },
  async getMessage(id: string): Promise<MessageRow> {
    return (await request(`/api/v1/admin/messages/${encodeURIComponent(id)}`)).data;
  },
  async getInsights(): Promise<Insights> {
    return (await request('/api/v1/analytics/insights')).data;
  },

  async registerAdmin(payload: {
    name: string;
    email: string;
    password: string;
    role: string;
    masterProvisioningKey: string;
  }) {
    // Provisioning does not sign the new admin in; they authenticate on the login form.
    return post('/api/v1/auth/admin/register', payload);
  },

  async getAuditLogs() {
    try {
      return (await request('/api/v1/admin/audit-logs')).data || [];
    } catch {
      return [];
    }
  },

  async downloadAuditExport(): Promise<void> {
    const res = await apiFetch(API_BASE + '/api/v1/analytics/export', { headers: authToken ? { Authorization: `Bearer ${authToken}` } : {} });
    if (!res.ok) throw new ApiError(res.status, 'Export failed. Please sign in again.');
    const url = URL.createObjectURL(await res.blob());
    const link = document.createElement('a');
    link.href = url;
    link.download = `${merchant.id}_audit_ledger.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }
};
