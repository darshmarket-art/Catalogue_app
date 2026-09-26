import { useState, useEffect } from 'react';
import { ActiveScreen, Product, Category, OrderItem, AnalyticsData } from './types';
import { api } from './api';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { WelcomeScreen } from './components/WelcomeScreen';
import { CatalogueScreen } from './components/CatalogueScreen';
import { CategoriesScreen } from './components/CategoriesScreen';
import { OrdersScreen } from './components/OrdersScreen';
import { RetailerAuthScreen } from './components/RetailerAuthScreen';
import { AdminLoginScreen } from './components/AdminLoginScreen';
import { AdminHubScreen } from './components/AdminHubScreen';
import { NewProductScreen } from './components/NewProductScreen';
import { AddCategoryScreen } from './components/AddCategoryScreen';
import { ProductionGuideModal } from './components/ProductionGuideModal';
import { QuotationModal } from './components/QuotationModal';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<ActiveScreen>('welcome');
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    views: 12480,
    viewsTrend: '+18.4%',
    inquiries: 384,
    bookedOrders: 142,
    bookedWeightKg: 28.650,
    liveVisitors: 48,
    todayVisitors: 1420,
    verifiedMerchants: 2,
    guestRetailers: 12,
    pendingDrafts: 3
  });

  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [currentMerchant, setCurrentMerchant] = useState<{ storeName: string; phone: string } | null>(null);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  
  // Quotation Modal state
  const [isQuotationOpen, setIsQuotationOpen] = useState(false);
  const [quotationData, setQuotationData] = useState<{
    selectedCount: number;
    totalNetWeight: number;
    items: Product[];
  }>({
    selectedCount: 0,
    totalNetWeight: 0,
    items: []
  });

  // Fetch Initial Data from persistent database
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [catsData, prodsData, ordersData, analyticsData] = await Promise.all([
          api.getCategories(),
          api.getProducts(),
          api.getOrders(),
          api.getAnalytics()
        ]);

        if (catsData.length > 0) setCategories(catsData);
        if (prodsData.length > 0) setProducts(prodsData);
        if (ordersData.items.length > 0) setOrders(ordersData.items);
        setAnalytics(analyticsData);
      } catch (err) {
        console.error('Failed to load initial data:', err);
      }
    };

    fetchData();
  }, []);

  // Add Item to Order
  const handleAddToOrder = async (product: Product, quantity: number) => {
    try {
      const newItem = await api.addOrderItem({
        title: product.title,
        sku: product.sku,
        purity: product.purity,
        totalNetGold: parseFloat((product.netWt * quantity).toFixed(3)),
        batchQty: quantity,
        qtyUnit: quantity > 1 ? 'Pcs' : 'Set',
        unitWt: product.netWt,
        unitDescription: `${product.netWt} g / pc`,
        image: product.image,
        note: `BIS Hallmarked • 916 HUID: ${product.huid || 'HM/C-728190'}`
      });

      setOrders((prev) => [...prev, newItem]);
    } catch {
      // client-side fallback
      const newItem: OrderItem = {
        id: `ord-${Date.now()}`,
        title: product.title,
        sku: product.sku,
        purity: product.purity,
        totalNetGold: parseFloat((product.netWt * quantity).toFixed(3)),
        batchQty: quantity,
        qtyUnit: quantity > 1 ? 'Pcs' : 'Set',
        unitWt: product.netWt,
        unitDescription: `${product.netWt} g / pc`,
        image: product.image,
        note: `BIS Hallmarked • 916 HUID: ${product.huid || 'HM/C-728190'}`
      };
      setOrders((prev) => [...prev, newItem]);
    }
  };

  // Remove Item from Order
  const handleRemoveOrderItem = async (id: string) => {
    try {
      await api.removeOrderItem(id);
    } catch {
      // quiet fallback
    }
    setOrders((prev) => prev.filter((item) => item.id !== id));
  };

  // Confirm Order (Pure Gram Settlement Allocation)
  const handleConfirmOrder = async () => {
    try {
      await api.confirmOrder();
    } catch {
      // quiet fallback
    }
  };

  // WhatsApp PO generation
  const handleGenerateWhatsAppPO = () => {
    const totalNet = orders.reduce((sum, item) => sum + (item.totalNetGold || 0), 0);
    const store = currentMerchant ? currentMerchant.storeName : 'Shree Ambica Jewellers';
    const msg = `*BHAKTI JEWELS B2B WHOLESALE MANIFEST (GRAM BASIS)*\n` +
      `*Store:* ${store}\n` +
      `*Settlement Terms:* Pure Fine Gold Gram Settlement (No Fiat Price Lock)\n` +
      `*Items in Batch:* ${orders.length} (${orders.reduce((s, i) => s + i.batchQty, 0)} Pcs)\n` +
      `*Total Fine Gold Weight:* ${totalNet.toFixed(3)}g Net\n\n` +
      `*Itemized Manifest:*\n` +
      orders.map((o) => `• ${o.title} (${o.sku}) x ${o.batchQty} — ${o.totalNetGold}g`).join('\n') +
      `\n\n_Please confirm vault allocation slot and physical 999.9 gold bullion handover._`;

    window.open(`https://wa.me/912223408899?text=${encodeURIComponent(msg)}`, '_blank');
  };

  // Open Quotation Modal
  const handleOpenQuotation = (selectedCount: number, totalNetWeight: number, items: Product[]) => {
    setQuotationData({
      selectedCount,
      totalNetWeight,
      items
    });
    setIsQuotationOpen(true);
  };

  // New Product created
  const handleProductCreated = async (newProd: Partial<Product>) => {
    try {
      const created = await api.createProduct(newProd);
      setProducts((prev) => [created, ...prev]);
    } catch {
      const fallbackProd: Product = {
        id: `item-${Date.now()}`,
        sku: newProd.sku || 'B2B-NEW',
        title: newProd.title || 'New Jewellery Item',
        category: newProd.category || 'Bridal Chokers & Haar',
        purity: newProd.purity || '22K 916',
        grossWt: newProd.grossWt || 40,
        netWt: newProd.netWt || 38,
        stoneWt: newProd.stoneWt || 2,
        priceEstimate: 290000,
        image: newProd.image || 'https://lh3.googleusercontent.com/aida-public/AB6AXuDUObQwsOoUT558zd-xq-IRhGUCH3gngnq1CIAJLIn1z1ktCuUgA6vDbd7k0XHEoUENtL9-abjc03ckpFPzrpgn0zi1qrOH9A9yS8oUmcAtc7F9UiucB-QXDrdBXh3wJdsVdX_WSduNHoK9YH5tul8lRn3Kn6EhWljP3GWGyI2QfH9xZPq10TteaS8hZb4sd_u23E7vT3LBRPsUSuklfuu5EC8AiX-S9GMuEvJdApdGBbyOQ87ExOiW',
        stockStatus: newProd.stockStatus || 'Ready in Vault'
      };
      setProducts((prev) => [fallbackProd, ...prev]);
    }
  };

  // New Category created
  const handleCategoryCreated = async (newCat: Partial<Category>) => {
    try {
      const created = await api.createCategory(newCat);
      setCategories((prev) => [...prev, created]);
    } catch {
      const fallbackCat: Category = {
        id: `cat-${Date.now()}`,
        slug: newCat.slug || 'CAT-CUSTOM',
        name: newCat.name || 'New Collection',
        subtitle: newCat.subtitle || 'Curated wholesale designs',
        designCount: 0,
        avgNetWt: newCat.avgNetWt || '20g – 90g',
        image: newCat.image || 'https://lh3.googleusercontent.com/aida-public/AB6AXuDUObQwsOoUT558zd-xq-IRhGUCH3gngnq1CIAJLIn1z1ktCuUgA6vDbd7k0XHEoUENtL9-abjc03ckpFPzrpgn0zi1qrOH9A9yS8oUmcAtc7F9UiucB-QXDrdBXh3wJdsVdX_WSduNHoK9YH5tul8lRn3Kn6EhWljP3GWGyI2QfH9xZPq10TteaS8hZb4sd_u23E7vT3LBRPsUSuklfuu5EC8AiX-S9GMuEvJdApdGBbyOQ87ExOiW',
        eligibleKarats: newCat.eligibleKarats || ['22K 916'],
        minTargetWt: newCat.minTargetWt || 20,
        maxTargetWt: newCat.maxTargetWt || 100
      };
      setCategories((prev) => [...prev, fallbackCat]);
    }
  };

  const handleFilterCategoryInCatalogue = (_catName: string) => {
    setCurrentScreen('catalogue');
  };

  const handleLogout = () => {
    setCurrentMerchant(null);
    setIsAdminLoggedIn(false);
    setCurrentScreen('welcome');
  };

  const shouldShowBottomNav = ['catalogue', 'categories', 'orders', 'admin-hub'].includes(currentScreen);

  return (
    <div className="min-h-screen bg-[#fcf9f5] text-[#1c1c1a] flex flex-col font-sans selection:bg-[#ffdf9e] selection:text-[#715509]">
      {/* Persistent Header */}
      <Header
        currentScreen={currentScreen}
        onNavigate={setCurrentScreen}
        onOpenGuide={() => setIsGuideOpen(true)}
        isAdminLoggedIn={isAdminLoggedIn}
        currentMerchant={currentMerchant}
        onLogout={handleLogout}
      />

      {/* Main View Container */}
      <main className="flex-1 w-full pt-16 md:pt-18">
        {currentScreen === 'welcome' && (
          <WelcomeScreen onNavigate={setCurrentScreen} />
        )}

        {currentScreen === 'catalogue' && (
          <CatalogueScreen
            products={products}
            onAddToOrder={handleAddToOrder}
            onOpenQuotation={handleOpenQuotation}
            onNavigateCategories={() => setCurrentScreen('categories')}
          />
        )}

        {currentScreen === 'categories' && (
          <CategoriesScreen
            categories={categories}
            onNavigate={setCurrentScreen}
            onFilterCategoryInCatalogue={handleFilterCategoryInCatalogue}
          />
        )}

        {currentScreen === 'orders' && (
          <OrdersScreen
            orders={orders}
            onRemoveItem={handleRemoveOrderItem}
            onConfirmOrder={handleConfirmOrder}
            onGenerateWhatsAppPO={handleGenerateWhatsAppPO}
            onNavigateCatalogue={() => setCurrentScreen('catalogue')}
          />
        )}

        {currentScreen === 'retailer-auth' && (
          <RetailerAuthScreen
            onNavigate={setCurrentScreen}
            onLoginSuccess={(user) => {
              setCurrentMerchant(user);
            }}
          />
        )}

        {currentScreen === 'admin-login' && (
          <AdminLoginScreen
            onNavigate={setCurrentScreen}
            onAdminLoginSuccess={() => {
              setIsAdminLoggedIn(true);
            }}
          />
        )}

        {currentScreen === 'admin-hub' && (
          <AdminHubScreen
            analytics={analytics}
            onNavigate={setCurrentScreen}
            onOpenGuide={() => setIsGuideOpen(true)}
          />
        )}

        {currentScreen === 'new-product' && (
          <NewProductScreen
            categories={categories}
            onNavigate={setCurrentScreen}
            onProductCreated={handleProductCreated}
          />
        )}

        {currentScreen === 'add-category' && (
          <AddCategoryScreen
            onNavigate={setCurrentScreen}
            onCategoryCreated={handleCategoryCreated}
          />
        )}
      </main>

      {/* Bottom Navigation */}
      {shouldShowBottomNav && (
        <BottomNav
          currentScreen={currentScreen}
          onNavigate={setCurrentScreen}
          orderCount={orders.length}
          isAdminLoggedIn={isAdminLoggedIn}
        />
      )}

      {/* Production Guide Modal */}
      <ProductionGuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
      />

      {/* Quotation Preview Modal */}
      <QuotationModal
        isOpen={isQuotationOpen}
        onClose={() => setIsQuotationOpen(false)}
        selectedCount={quotationData.selectedCount}
        totalNetWeight={quotationData.totalNetWeight}
        items={quotationData.items}
      />
    </div>
  );
}
