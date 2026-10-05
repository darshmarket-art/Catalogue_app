import type { ComponentType, ReactNode } from 'react';
import type { About, ActiveScreen, Banner, Category, OrderItem, Product, Purity } from '../types';
import type { ProfileUser } from '../components/ProfileMenu';

/** Props of the buyer-facing screens. Every layout implements these, so App.tsx, data loading and the admin screens stay shared. */
export interface HeaderProps {
  currentScreen: ActiveScreen;
  onNavigate: (screen: ActiveScreen) => void;
  /** Where Back goes when it is not the usual place (the New design form behind New collection). */
  parentScreen?: ActiveScreen | null;
  isAdminLoggedIn: boolean;
  currentMerchant: ProfileUser | null;
  onLogout: () => void;
  onOpenOrders: (tab: 'current' | 'past') => void;
  /** True while an existing product or category is being edited. */
  isEditing: boolean;
  /** Small line above the title (Admin: the period and refresh time). */
  eyebrow?: string;
  /** Tag at the right of the title, e.g. "142 designs" or the plan. */
  aside?: ReactNode;
}
export interface BottomNavProps {
  currentScreen: ActiveScreen;
  onNavigate: (screen: ActiveScreen) => void;
  orderCount: number;
  shortlistCount: number;
  isAdminLoggedIn: boolean;
  /** Owner tab badges: new orders waiting, unanswered enquiries. */
  adminBadges?: { orders: number; buyers: number };
}
export interface WelcomeProps { onNavigate: (screen: ActiveScreen) => void }
export interface CategoriesProps {
  categories: Category[];
  products: Product[];
  banners: Banner[];
  isAdmin: boolean;
  onEditCategory: (category: Category) => void;
  onNavigate: (screen: ActiveScreen) => void;
  onFilterCategoryInCatalogue: (categoryName: string) => void;
}
export interface CatalogueProps {
  products: Product[];
  isAdmin: boolean;
  /** Only show designs from this collection. */
  categoryFilter: string | null;
  categories: Category[];
  onCategoryChange: (name: string | null) => void;
  onClearCategoryFilter: () => void;
  onEditProduct: (product: Product) => void;
  onAddToOrder: (product: Product, quantity: number, purity?: string) => void;
  /** Purities the owner currently offers. */
  purities: Purity[];
  /** SKUs the buyer has hearted. */
  shortlist: string[];
  onToggleShortlist: (product: Product) => void;
  /** The order's size and a way to open it (the cart bar). */
  orderCount?: number;
  onNavigate?: (screen: ActiveScreen) => void;
}
export interface ShortlistProps {
  products: Product[];
  shortlist: string[];
  storeName: string;
  /** Opening a design from the list needs these (the same details page as the catalogue). */
  purities: Purity[];
  categories: Category[];
  onAddToOrder: (product: Product, quantity: number, purity?: string) => void;
  onRemove: (product: Product) => void;
  /** Adds one piece of each design to the current order. */
  onAddAllToOrder: (items: Product[]) => Promise<void>;
  onBrowse: () => void;
}
export interface OrdersProps {
  orders: OrderItem[];
  onRemoveItem: (id: string) => void;
  /** The cart stepper: sets one line's quantity. */
  onChangeQty: (id: string, batchQty: number) => void;
  /** Both take the buyer's optional note to the store. */
  onConfirmOrder: (note?: string) => Promise<{ poId: string; totalNetGrams: number; whatsappMessage: string } | null>;
  onGenerateWhatsAppPO: (note?: string) => void;
  onNavigateCatalogue: () => void;
  /** Which tab to open first (the profile menu links straight to past orders). */
  initialTab?: 'current' | 'past';
}
export interface AboutProps { about: About }

export type LayoutKit = {
  Header: ComponentType<HeaderProps>;
  BottomNav: ComponentType<BottomNavProps>;
  Welcome: ComponentType<WelcomeProps>;
  Categories: ComponentType<CategoriesProps>;
  Catalogue: ComponentType<CatalogueProps>;
  Shortlist: ComponentType<ShortlistProps>;
  Orders: ComponentType<OrdersProps>;
  About: ComponentType<AboutProps>;
};
