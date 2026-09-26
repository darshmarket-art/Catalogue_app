import { Product, Category, OrderItem, BullionRates, AnalyticsData } from './types';

export const api = {
  async getRates(): Promise<BullionRates> {
    try {
      const res = await fetch('/api/rates');
      if (!res.ok) throw new Error('Failed to fetch rates');
      const json = await res.json();
      return json.data;
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
      const res = await fetch('/api/categories');
      if (!res.ok) throw new Error('Failed to fetch categories');
      const json = await res.json();
      return json.data;
    } catch {
      return [];
    }
  },

  async createCategory(cat: Partial<Category>): Promise<Category> {
    const res = await fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cat)
    });
    const json = await res.json();
    return json.data;
  },

  async getProducts(params?: { search?: string; category?: string; purity?: string }): Promise<Product[]> {
    try {
      const query = new URLSearchParams(params as Record<string, string>).toString();
      const res = await fetch(`/api/products?${query}`);
      if (!res.ok) throw new Error('Failed to fetch products');
      const json = await res.json();
      return json.data;
    } catch {
      return [];
    }
  },

  async createProduct(prod: Partial<Product>): Promise<Product> {
    const res = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(prod)
    });
    const json = await res.json();
    return json.data;
  },

  async getOrders(): Promise<{ items: OrderItem[]; totalWeight: number; totalPieces: number }> {
    try {
      const res = await fetch('/api/orders');
      if (!res.ok) throw new Error('Failed to fetch orders');
      const json = await res.json();
      return {
        items: json.data,
        totalWeight: json.totalWeightNetGrams,
        totalPieces: json.totalPieces
      };
    } catch {
      return { items: [], totalWeight: 0, totalPieces: 0 };
    }
  },

  async addOrderItem(item: Partial<OrderItem>): Promise<OrderItem> {
    const res = await fetch('/api/orders/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item)
    });
    const json = await res.json();
    return json.data;
  },

  async removeOrderItem(id: string): Promise<void> {
    await fetch(`/api/orders/items/${id}`, { method: 'DELETE' });
  },

  async confirmOrder(): Promise<{ poId: string; totalNetGrams: number; whatsappMessage: string }> {
    const res = await fetch('/api/orders/confirm', { method: 'POST' });
    const json = await res.json();
    return json;
  },

  async getAnalytics(): Promise<AnalyticsData> {
    try {
      const res = await fetch('/api/analytics');
      if (!res.ok) throw new Error('Failed to fetch analytics');
      const json = await res.json();
      return json.data;
    } catch {
      return {
        views: 12480,
        viewsTrend: '+18.4%',
        inquiries: 384,
        bookedOrders: 142,
        bookedWeightKg: 28.650,
        liveVisitors: 1,
        todayVisitors: 1420,
        verifiedMerchants: 1,
        guestRetailers: 0,
        pendingDrafts: 3
      };
    }
  },

  async trackView(): Promise<void> {
    try {
      await fetch('/api/analytics/track-view', { method: 'POST' });
    } catch {
      // silent
    }
  },

  async recordInquiry(payload?: { clientFirm?: string; itemsCount?: number; totalNetWeight?: number }): Promise<void> {
    try {
      await fetch('/api/analytics/track-inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload || {})
      });
    } catch {
      // silent
    }
  },

  async sendHeartbeat(sessionId: string, isVerified: boolean): Promise<void> {
    try {
      await fetch('/api/analytics/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, isVerified })
      });
    } catch {
      // silent
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
    const res = await fetch('/api/auth/retailer/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    if (!res.ok || json.status === 'error') {
      throw new Error(json.message || 'Signup failed');
    }
    return json;
  },

  async loginRetailer(payload: { phone: string; password?: string; authMode?: string }) {
    const res = await fetch('/api/auth/retailer/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    if (!res.ok || json.status === 'error') {
      throw new Error(json.message || 'Access Denied: Invalid credentials');
    }
    return json;
  },

  async loginAdmin(payload: { adminId: string; password: string; otpCode?: string; role?: string }) {
    const res = await fetch('/api/auth/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    if (!res.ok || json.status === 'error') {
      throw new Error(json.message || 'Access Denied: Invalid Master Security Key');
    }
    return json;
  },

  async registerAdmin(payload: {
    name: string;
    email: string;
    password: string;
    role: string;
    masterProvisioningKey: string;
  }) {
    const res = await fetch('/api/auth/admin/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    if (!res.ok || json.status === 'error') {
      throw new Error(json.message || 'Admin creation rejected');
    }
    return json;
  },

  async getAuditLogs() {
    try {
      const res = await fetch('/api/admin/audit-logs');
      const json = await res.json();
      return json.data || [];
    } catch {
      return [];
    }
  }
};
