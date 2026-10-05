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
  /** How the design is priced; absent on older records means "by-weight". */
}

/** One admin account of the store, as the Admins screen lists them. */
export interface AdminRow {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  mustChangePassword: boolean;
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

/** The owner's "About us" details; every field is optional. */
export interface About {
  ownerName?: string;
  ownerRole?: string;
  story?: string;
  address?: string;
  phone?: string;
  email?: string;
  openingHours?: string;
  gstin?: string;
  website?: string;
}

export interface Banner {
  id: string;
  image: string;
  /** The collection this banner opens, if the owner set one. */
  category?: string;
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
  /** The buyer's note to the store, if they left one when placing the order. */
  note?: string;
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

/** A WhatsApp enquiry a buyer sent: about one design, their shortlist, or a whole order. */
export interface EnquiryRow {
  id: string;
  kind: 'design' | 'shortlist' | 'order';
  buyerPhone: string;
  firmName: string;
  ownerName: string;
  sku: string | null;
  title: string | null;
  purity: string | null;
  count: number | null;
  createdAt: string;
  /** Set once the owner tapped Reply. */
  repliedAt?: string | null;
}

/** What is waiting for the owner (the Today list and the tab badges). */
export interface AdminSummary {
  newOrders: number;
  enquiriesWaiting: number;
  messagesFailed: number;
}

export interface BuyerRow {
  phone: string;
  firmName: string;
  ownerName: string;
  gstin: string;
  marketHub: string;
  createdAt: string;
  mustChangePassword: boolean;
  /** ISO time the buyer was last active, null if never seen. */
  lastSeen: string | null;
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
  note?: string;
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
  | 'admin-enquiries'
  | 'admin-store'
  | 'admin-buyers'
  | 'admin-banners'
  | 'admin-purities'
  | 'admin-about'
  | 'about'
  | 'shortlist'
  | 'change-password'
  | 'retailer-auth'
  | 'admin-plan'
  | 'admin-pdf'
  | 'admin-alerts'
  | 'admin-messages'
  | 'admin-insights'
  | 'admin-password'
  | 'plans';
