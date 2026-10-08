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
import type { HeaderProps, BottomNavProps, WelcomeProps, CategoriesProps, CatalogueProps, ShortlistProps, OrdersProps, AboutProps } from '../props';

// Bhakti theme uses the same props types as emergent for compatibility
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

// Use emergent's props types for the layout kit
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
