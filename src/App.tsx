import { useState, useEffect } from 'react';
import { ActiveScreen, Product, Category, OrderItem, AnalyticsData } from './types';
import { api, ApiError, setAuthToken } from './api';
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
import { QuotationModal } from './components/QuotationModal';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<ActiveScreen>('welcome');
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    periodLabel: 'Last 7 days',
    views: 0,
    viewsTrend: '0%',
    inquiries: 0,
    bookedOrders: 0,
    bookedWeightKg: 0,
    liveVisitors: 0,
    todayVisitors: 0,
    verifiedToday: 0,
    verifiedMerchants: 0,
    guestRetailers: 0,
    pendingDrafts: 0
  });
  const [analyticsUpdatedAt, setAnalyticsUpdatedAt] = useState<Date | null>(null);

  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [currentMerchant, setCurrentMerchant] = useState<{ storeName: string; phone: string } | null>(null);
  
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

  const handleNavigate = (screen: ActiveScreen) => {
    setCurrentScreen(screen);
  };

  // Presence heartbeat: tells the server this visitor is here (paused while the tab is hidden).
  // Re-runs on sign-in so a guest session is upgraded to verified straight away.
  useEffect(() => {
    api.sendHeartbeat();
    const interval = setInterval(() => {
      if (!document.hidden) api.sendHeartbeat();
    }, 15000);
    const onVisible = () => {
      if (!document.hidden) api.sendHeartbeat();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [currentMerchant, isAdminLoggedIn]);

  // Admin Hub numbers: fetched on open, then every 15 seconds while the tab is visible.
  useEffect(() => {
    if (currentScreen !== 'admin-hub' || !isAdminLoggedIn) return;

    const refresh = () => {
      if (document.hidden) return;
      api
        .getAnalytics()
        .then((data) => {
          setAnalytics(data);
          setAnalyticsUpdatedAt(new Date());
        })
        .catch((err) => {
          if (err instanceof ApiError && err.status === 401) {
            alert('Your admin session has expired. Please sign in again.');
            handleLogout();
            setCurrentScreen('admin-login');
          }
        });
    };

    refresh();
    const interval = setInterval(refresh, 15000);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [currentScreen, isAdminLoggedIn]);

  // Fetch Initial Data from persistent database
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [catsData, prodsData] = await Promise.all([api.getCategories(), api.getProducts()]);

        if (catsData.length > 0) setCategories(catsData);
        if (prodsData.length > 0) setProducts(prodsData);
      } catch (err) {
        console.error('Failed to load initial data:', err);
      }
    };

    fetchData();
  }, []);

  // Add Item to Order
  const handleAddToOrder = async (product: Product, quantity: number) => {
    const localItem = (): OrderItem => ({
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
      note: `BIS Hallmarked • HUID: ${product.huid || 'N/A'}`
    });

    try {
      const newItem = await api.addOrderItem({ sku: product.sku, batchQty: quantity });
      setOrders((prev) => [...prev, newItem]);
    } catch (err) {
      if (err instanceof ApiError && err.status !== 401) {
        alert(err.message);
        return;
      }
      // Guests keep a local, unsaved batch until they sign in.
      setOrders((prev) => [...prev, localItem()]);
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
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        alert('Please sign in to your wholesale account to confirm this order.');
        handleNavigate('retailer-auth');
      } else if (err instanceof ApiError) {
        alert(err.message);
      }
    }
  };

  // WhatsApp PO generation
  const handleGenerateWhatsAppPO = () => {
    const totalNet = orders.reduce((sum, item) => sum + (item.totalNetGold || 0), 0);
    const store = currentMerchant ? currentMerchant.storeName : 'Guest Jeweller';

    // Record inquiry telemetry
    api.recordInquiry({
      clientFirm: store,
      itemsCount: orders.length,
      totalNetWeight: parseFloat(totalNet.toFixed(3))
    });

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
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not publish the product.');
    }
  };

  // New Category created
  const handleCategoryCreated = async (newCat: Partial<Category>) => {
    try {
      const created = await api.createCategory(newCat);
      setCategories((prev) => [...prev, created]);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not create the category.');
    }
  };

  const handleFilterCategoryInCatalogue = (_catName: string) => {
    handleNavigate('catalogue');
  };

  const handleLogout = () => {
    setAuthToken(null);
    setOrders([]);
    setCurrentMerchant(null);
    setIsAdminLoggedIn(false);
    handleNavigate('welcome');
  };

  // Members-only portal: signed-out visitors are sent to login / sign-up, and admin tools need an admin session.
  const isSignedIn = Boolean(currentMerchant) || isAdminLoggedIn;
  const memberScreens: ActiveScreen[] = ['catalogue', 'categories', 'orders'];
  const adminScreens: ActiveScreen[] = ['admin-hub', 'new-product', 'add-category'];
  const activeScreen: ActiveScreen =
    adminScreens.includes(currentScreen) && !isAdminLoggedIn
      ? 'admin-login'
      : memberScreens.includes(currentScreen) && !isSignedIn
        ? 'retailer-auth'
        : currentScreen;

  const shouldShowBottomNav = ['catalogue', 'categories', 'orders', 'admin-hub'].includes(activeScreen);

  return (
    <div className="min-h-screen bg-[#fcf9f5] text-[#1c1c1a] flex flex-col font-sans selection:bg-[#ffdf9e] selection:text-[#715509]">
      {/* Persistent Header */}
      {activeScreen !== 'welcome' && (
        <Header
          currentScreen={activeScreen}
          onNavigate={handleNavigate}
          isAdminLoggedIn={isAdminLoggedIn}
          currentMerchant={currentMerchant}
          onLogout={handleLogout}
        />
      )}

      {/* Main View Container */}
      <main className={`flex-1 w-full ${activeScreen === 'welcome' ? '' : 'pt-16 md:pt-18'}`}>
        {activeScreen === 'welcome' && (
          <WelcomeScreen onNavigate={handleNavigate} />
        )}

        {activeScreen === 'catalogue' && (
          <CatalogueScreen
            products={products}
            onAddToOrder={handleAddToOrder}
            onOpenQuotation={handleOpenQuotation}
            onNavigateCategories={() => handleNavigate('categories')}
          />
        )}

        {activeScreen === 'categories' && (
          <CategoriesScreen
            categories={categories}
            onNavigate={handleNavigate}
            onFilterCategoryInCatalogue={handleFilterCategoryInCatalogue}
          />
        )}

        {activeScreen === 'orders' && (
          <OrdersScreen
            orders={orders}
            onRemoveItem={handleRemoveOrderItem}
            onConfirmOrder={handleConfirmOrder}
            onGenerateWhatsAppPO={handleGenerateWhatsAppPO}
            onNavigateCatalogue={() => handleNavigate('catalogue')}
          />
        )}

        {activeScreen === 'retailer-auth' && (
          <RetailerAuthScreen
            onNavigate={handleNavigate}
            onLoginSuccess={(user) => {
              setCurrentMerchant(user);
              api.getOrders().then((result) => setOrders(result.items));
            }}
          />
        )}

        {activeScreen === 'admin-login' && (
          <AdminLoginScreen
            onNavigate={handleNavigate}
            onAdminLoginSuccess={() => {
              setIsAdminLoggedIn(true);
            }}
          />
        )}

        {activeScreen === 'admin-hub' && (
          <AdminHubScreen
            analytics={analytics}
            updatedAt={analyticsUpdatedAt}
            onNavigate={handleNavigate}
          />
        )}

        {activeScreen === 'new-product' && (
          <NewProductScreen
            categories={categories}
            onNavigate={handleNavigate}
            onProductCreated={handleProductCreated}
          />
        )}

        {activeScreen === 'add-category' && (
          <AddCategoryScreen
            onNavigate={handleNavigate}
            onCategoryCreated={handleCategoryCreated}
          />
        )}
      </main>

      {/* Bottom Navigation */}
      {shouldShowBottomNav && (
        <BottomNav
          currentScreen={activeScreen}
          onNavigate={handleNavigate}
          orderCount={orders.length}
          isAdminLoggedIn={isAdminLoggedIn}
        />
      )}

      {/* Quotation Preview Modal */}
      <QuotationModal
        isOpen={isQuotationOpen}
        onClose={() => setIsQuotationOpen(false)}
        selectedCount={quotationData.selectedCount}
        totalNetWeight={quotationData.totalNetWeight}
        items={quotationData.items}
        defaultFirm={currentMerchant?.storeName ?? ''}
      />
    </div>
  );
}
