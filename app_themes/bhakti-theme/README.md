# Bhakti Theme

A modern, clean storefront layout for Bhakti Jewels, based on the test design concepts.

## Features

- **Clean Aesthetic**: Cream/neutral color palette with charcoal accents and gold highlights
- **Glassmorphism Header**: Blur effect on the top navigation bar
- **Responsive Design**: Works on mobile and desktop
- **Product Grid**: 2-4 column product grid based on screen size
- **Category Navigation**: Collection-based filtering
- **Cart Integration**: Order count and navigation to cart

## Files

- `bhakti-theme.css` - Main styles for the theme
- `components/` - React components for each screen
  - `Header.tsx` - Top navigation bar
  - `BottomNav.tsx` - Bottom tab navigation
  - `WelcomeScreen.tsx` - Welcome/landing page
  - `CategoriesScreen.tsx` - Collections grid
  - `CatalogueScreen.tsx` - Product grid with filters
  - `ShortlistScreen.tsx` - Saved products
  - `OrdersScreen.tsx` - Order history
  - `AboutScreen.tsx` - About the store
  - `ui.tsx` - Icon component and utilities
- `layouts/bhakti-theme.ts` - Layout kit definition
- `types.ts` - TypeScript type definitions

## Color Palette

- Cream: `#F5F0EB`
- Charcoal: `#1C1917`
- Accent Gold: `#B8860B`
- Muted: `#78716C`

## Fonts

- Display: DM Serif Display (Google Fonts)
- Body: Inter (Google Fonts)

## Usage

To use this theme, update your merchant configuration to reference `bhakti-theme` as the layout:

```json
{
  "layout": "bhakti-theme"
}
```

## Testing

1. Start the development server: `npm run dev`
2. Open the catalogue app in your browser
3. Navigate to test the various screens
