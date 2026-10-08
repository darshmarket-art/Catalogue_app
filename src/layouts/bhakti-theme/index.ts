// Bhakti Theme - Export all components
import './bhakti-theme.css';
import { bhaktiTheme } from './layouts/bhakti-theme';

export { bhaktiTheme };
export type { LayoutKit } from './layouts/bhakti-theme';

// Re-export types for convenience
export type { ActiveScreen, Banner, Category, Product, Purity, OrderItem, About } from './types';
