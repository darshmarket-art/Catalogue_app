// Types for Bhakti theme - aligned with emergent layout types

export type ActiveScreen =
  | 'welcome'
  | 'categories'
  | 'catalogue'
  | 'shortlist'
  | 'orders'
  | 'about'
  | 'retailer-auth'
  | 'admin-login'
  | 'admin-hub'
  | 'admin-orders'
  | 'admin-buyers'
  | 'admin-store'
  | 'admin-banners'
  | 'admin-purities'
  | 'admin-about'
  | 'admin-plan'
  | 'admin-alerts'
  | 'admin-messages'
  | 'admin-insights'
  | 'admin-password'
  | 'new-product'
  | 'add-category';

export interface Banner {
  id: string;
  image: string;
  category?: string;
  title?: string;
}

export interface Category {
  id: string;
  name: string;
  nameHi?: string;
  subtitle?: string;
  tag?: string;
  image?: string;
  heroOrder?: number;
  designCount: number;
  avgNetWt?: number;
  eligibleKarats?: string[];
}

export interface ProductPricing {
  fixedPrice?: number;
  perGramPrice?: number;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  nameHi?: string;
  categoryId: string;
  image: string;
  imageUrls: string[];
  netWeight: number;
  purity?: string;
  pricing?: ProductPricing;
  status?: string;
  collection?: string;
  finish?: string;
}

export interface Purity {
  key: string;
  title: string;
  enabled: boolean;
}

export interface OrderItem {
  id: string;
  poId?: string;
  status?: string;
  items?: Array<{
    id: string;
    name: string;
    qty: number;
    netWt?: number;
  }>;
  totalNetGrams?: number;
  past?: boolean;
  createdAt?: string;
}

export interface About {
  description?: string;
  features?: Array<{ title: string }>;
  contact?: {
    whatsapp?: string;
    deskPhone?: string;
    address?: string;
  };
}
