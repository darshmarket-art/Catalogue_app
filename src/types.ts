export interface Product {
  id: string;
  sku: string;
  title: string;
  category: string;
  purity: '22K 916' | '24K 999.9' | '18K 750' | '14K 585' | string;
  grossWt: number;
  netWt: number;
  stoneWt?: number;
  /** First photo, as a private link. */
  image: string;
  /** One to three photos, as private links (or plain http links for imported data). */
  images: string[];
  /** Merchant-defined details (see productFields in merchant.json). */
  extra?: Record<string, string | number>;
  stockStatus: 'Ready in Vault' | 'Made-to-Order' | string;
  leadDays?: number;
  huid?: string;
  description?: string;
}

export interface Category {
  id: string;
  slug: string;
  name: string;
  subtitle: string;
  designCount: number;
  avgNetWt: string;
  image: string;
  eligibleKarats: string[];
  minTargetWt: number;
  maxTargetWt: number;
}

export interface Purity {
  key: string;
  title: string;
  enabled: boolean;
}

export interface Banner {
  id: string;
  image: string;
}

export interface OrderItem {
  id: string;
  productId?: string;
  title: string;
  sku: string;
  purity: string;
  totalNetGold: number;
  batchQty: number;
  qtyUnit: string;
  unitWt: number;
  unitDescription: string;
  note: string;
  image: string;
}

export interface AnalyticsData {
  periodLabel: string;
  views: number;
  viewsTrend: string;
  inquiries: number;
  bookedOrders: number;
  bookedWeightKg: number;
  liveVisitors: number;
  todayVisitors: number;
  verifiedToday: number;
  verifiedMerchants: number;
  guestRetailers: number;
  pendingDrafts: number;
  newOrders: number;
}

export type OrderStatus = 'new' | 'confirmed' | 'dispatched' | 'cancelled';

export interface PastOrder {
  poId: string;
  status: OrderStatus;
  totalNetGrams: number;
  itemCount: number;
  items: Array<Pick<OrderItem, 'id' | 'title' | 'sku' | 'purity' | 'totalNetGold' | 'batchQty' | 'qtyUnit' | 'image'>>;
  timestamp: string;
}

export interface VisitorSummary {
  id: string;
  kind: 'verified' | 'guest';
  name: string;
  lastSeen: string;
  activeSeconds: number;
  sessions: number;
  productsViewed: number;
  dwellSeconds: number;
  searches: number;
  selections: number;
  addedToCart: number;
}

export interface VisitorDetail extends VisitorSummary {
  products: Array<{ sku: string; title: string; seconds: number; lastAt: string }>;
  searchTerms: Array<{ term: string; count: number; lastAt: string }>;
  picked: Array<{ sku: string; title: string; count: number; lastAt: string }>;
}

export type VisitorKind = 'all' | 'verified' | 'guest';

export interface BuyerRow {
  phone: string;
  firmName: string;
  ownerName: string;
  gstin: string;
  marketHub: string;
  createdAt: string;
  mustChangePassword: boolean;
}

export interface AdminOrder {
  poId: string;
  status: OrderStatus;
  retailerId: string;
  firmName: string;
  buyer: { firmName: string; ownerName: string; phone: string; gstin: string; marketHub: string } | null;
  totalNetGrams: number;
  itemCount: number;
  items: Array<{ id: string; title: string; sku: string; purity: string; totalNetGold: number; batchQty: number; qtyUnit: string }>;
  timestamp: string;
}

export type ActiveScreen = 
  | 'welcome'
  | 'catalogue'
  | 'categories'
  | 'orders'
  | 'admin-login'
  | 'admin-hub'
  | 'new-product'
  | 'add-category'
  | 'admin-orders'
  | 'admin-visitors'
  | 'admin-buyers'
  | 'admin-banners'
  | 'admin-purities'
  | 'shortlist'
  | 'change-password'
  | 'retailer-auth';
