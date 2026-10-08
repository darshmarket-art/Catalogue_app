import type { ComponentProps, ComponentType } from 'react';
import type { ActiveScreen } from '../types';
import { Header } from '../components/Header';
import { BottomNav } from '../components/BottomNav';
import { WelcomeScreen } from '../components/WelcomeScreen';
import { CategoriesScreen } from '../components/CategoriesScreen';
import { CatalogueScreen } from '../components/CatalogueScreen';
import { ShortlistScreen } from '../components/ShortlistScreen';
import { OrdersScreen } from '../components/OrdersScreen';
import { AboutScreen } from '../components/AboutScreen';

/**
 * The buyer-facing screens of the Bhakti theme layout.
 * Every layout implements the same props as these (the Bhakti components are the contract),
 * so App.tsx, data loading and the admin screens are shared by all layouts.
 */
export const bhaktiTheme: LayoutKit = {
  Header,
  BottomNav,
  Welcome: WelcomeScreen,
  Categories: CategoriesScreen,
  Catalogue: CatalogueScreen,
  Shortlist: ShortlistScreen,
  Orders: OrdersScreen,
  About: AboutScreen,
};

/** A layout's Catalogue may also show the order's size and open it (the cart bar); Bhakti ignores both. */
export type CatalogueProps = ComponentProps<typeof CatalogueScreen> & { orderCount?: number; onNavigate?: (screen: ActiveScreen) => void };

export type LayoutKit = {
  Header: typeof Header;
  BottomNav: typeof BottomNav;
  Welcome: typeof WelcomeScreen;
  Categories: typeof CategoriesScreen;
  Catalogue: ComponentType<CatalogueProps>;
  Shortlist: typeof ShortlistScreen;
  Orders: typeof OrdersScreen;
  About: typeof AboutScreen;
};
