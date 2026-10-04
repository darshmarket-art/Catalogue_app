import { Header } from '../components/Header';
import { BottomNav } from '../components/BottomNav';
import { WelcomeScreen } from '../components/WelcomeScreen';
import { CategoriesScreen } from '../components/CategoriesScreen';
import { CatalogueScreen } from '../components/CatalogueScreen';
import { ShortlistScreen } from '../components/ShortlistScreen';
import { OrdersScreen } from '../components/OrdersScreen';
import { AboutScreen } from '../components/AboutScreen';

/**
 * The buyer-facing screens of one layout. Every layout implements the same props as these (the Gilded components are the
 * contract), so App.tsx, data loading and the admin screens are shared by all layouts.
 */
export const gilded = { Header, BottomNav, Welcome: WelcomeScreen, Categories: CategoriesScreen, Catalogue: CatalogueScreen, Shortlist: ShortlistScreen, Orders: OrdersScreen, About: AboutScreen };
export type LayoutKit = typeof gilded;
