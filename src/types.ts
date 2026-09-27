export interface Product {
  id: string;
  sku: string;
  title: string;
  category: string;
  purity: '22K 916' | '24K 999.9' | '18K 750' | '14K 585' | string;
  grossWt: number;
  netWt: number;
  stoneWt?: number;
  priceEstimate: number;
  image: string;
  angles?: string[];
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

export interface BullionRates {
  mcx24k: number;
  changePercent: string;
  gold916: number;
  gold750: number;
  silver999: number;
  lastSync: string;
  deskPhone: string;
  activeSessionLocks: number;
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
  | 'retailer-auth';
