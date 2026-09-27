import { useState, useEffect } from 'react';
import { ActiveScreen, Product, Category, OrderItem, AnalyticsData } from './types';
import { api, ApiError, hasStoredSession, setAuthToken, setUnauthorizedHandler } from './api';
import { merchant } from './merchant';
import { sector } from './sector';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { WelcomeScreen } from './components/WelcomeScreen';
import { CatalogueScreen } from './components/CatalogueScreen';
import { CategoriesScreen } from './components/CategoriesScreen';
import { OrdersScreen } from './components/OrdersScreen';
import { RetailerAuthScreen } from './components/RetailerAuthScreen';
import { AdminLoginScreen } from './components/AdminLoginScreen';
import { AdminHubScreen } from './components/AdminHubScreen';
import { AdminOrdersScreen } from './components/AdminOrdersScreen';
import { NewProductScreen } from './components/NewProductScreen';
import { AddCategoryScreen } from './components/AddCategoryScreen';
import { QuotationModal } from './components/QuotationModal';

export default function App() {
  // The current screen lives in the browser history too, so Back/Forward (and a reload) stay inside the app.
  const [currentScreen, setCurrentScreen] = useState<ActiveScreen>(
    () => (window.history.state?.screen as ActiveScreen | undefined) ?? 'welcome'
  );
  // True while a session saved earlier in this tab is being re-checked, so we never flash the login screen.
  const [booting, setBooting] = useState(() => hasStoredSession());
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
    pendingDrafts: 0,
    newOrders: 0
  });
  const [analyticsUpdatedAt, setAnalyticsUpdatedAt] = useState<Date | null>(null);

  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [currentMerchant, setCurrentMerchant] = useState<{ storeName: string; phone: string } | null>(null);
  const isSignedIn = Boolean(currentMerchant) || isAdminLoggedIn;
  
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

  const handleNavigate = (screen: ActiveScreen, replace = false) => {
    setCurrentScreen(screen);
    if (replace) window.history.replaceState({ screen }, '');
    else if (window.history.state?.screen !== screen) window.history.pushState({ screen }, '');
  };

  useEffect(() => {
    if (!window.history.state?.screen) window.history.replaceState({ screen: currentScreen }, '');
    const onPop = (e: PopStateEvent) => setCurrentScreen((e.state?.screen as ActiveScreen | undefined) ?? 'welcome');
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // Restore a session saved earlier in this tab (survives reloads; ends when the tab is closed).
  useEffect(() => {
    if (!booting) return;
    api
      .restoreSession()
      .then((session) => {
        if (session?.type === 'retailer') {
          setCurrentMerchant(session.user);
          api.getOrders().then((result) => setOrders(result.items));
        } else if (session?.type === 'admin') {
          setIsAdminLoggedIn(true);
        }
      })
      .finally(() => setBooting(false));
  }, []);

  // Any request that finds the token expired or revoked signs the user out once, with a clear message.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      alert('Your session has expired. Please sign in again.');
      handleLogout();
    });
    return () => setUnauthorizedHandler(null);
  }, []);

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
        .catch(() => {});
    };

    refresh();
    const interval = setInterval(refresh, 15000);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [currentScreen, isAdminLoggedIn]);

  // Catalogue data. A members-only catalogue is loaded after sign-in and cleared on sign-out.
  useEffect(() => {
    if (merchant.catalogueAccess === 'login' && !isSignedIn) {
      setCategories([]);
      setProducts([]);
      return;
    }
    const fetchData = async () => {
      const [catsData, prodsData] = await Promise.all([api.getCategories(), api.getProducts()]);
      if (catsData.length > 0) setCategories(catsData);
      if (prodsData.length > 0) setProducts(prodsData);
    };
    fetchData();
  }, [isSignedIn]);

  // Add Item to Order (needs an account)
  const handleAddToOrder = async (product: Product, quantity: number) => {
    try {
      const newItem = await api.addOrderItem({ sku: product.sku, batchQty: quantity });
      setOrders((prev) => [...prev, newItem]);
    } catch (err) {
      if (err instanceof ApiError && !err.handled) {
        if (err.status === 401) {
          alert('Please sign in to your wholesale account to add items to your order.');
          handleNavigate('retailer-auth');
        } else {
          alert(err.message);
        }
      }
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
  const handleConfirmOrder = async (): Promise<{ poId: string } | null> => {
    try {
      return await api.confirmOrder();
    } catch (err) {
      if (err instanceof ApiError && !err.handled) {
        if (err.status === 401) {
          alert('Please sign in to your wholesale account to confirm this order.');
          handleNavigate('retailer-auth');
        } else {
          alert(err.message);
        }
      }
      return null;
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

    const msg = sector.orderManifest({ brandName: merchant.brand.name, store, orders });

    window.open(`https://wa.me/${merchant.contact.whatsapp}?text=${encodeURIComponent(msg)}`, '_blank');
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

  // New Product created: resolves true only when the server accepted it
  const handleProductCreated = async (newProd: Partial<Product>): Promise<boolean> => {
    try {
      const created = await api.createProduct(newProd);
      setProducts((prev) => [created, ...prev]);
      // The server counts designs per category; keep the on-screen count in step without a reload.
      setCategories((prev) => prev.map((c) => (c.name === created.category ? { ...c, designCount: c.designCount + 1 } : c)));
      return true;
    } catch (err) {
      if (!(err instanceof ApiError && err.handled)) alert(err instanceof Error ? err.message : 'Could not publish the product.');
      return false;
    }
  };

  // New Category created: resolves true only when the server accepted it
  const handleCategoryCreated = async (newCat: Partial<Category>): Promise<boolean> => {
    try {
      const created = await api.createCategory(newCat);
      setCategories((prev) => [...prev, created]);
      return true;
    } catch (err) {
      if (!(err instanceof ApiError && err.handled)) alert(err instanceof Error ? err.message : 'Could not create the category.');
      return false;
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
  const memberScreens: ActiveScreen[] = merchant.catalogueAccess === 'login' ? ['catalogue', 'categories', 'orders'] : ['orders'];
  const adminScreens: ActiveScreen[] = ['admin-hub', 'new-product', 'add-category', 'admin-orders'];
  let screen: ActiveScreen = currentScreen;
  if (isSignedIn && (screen === 'welcome' || screen === 'retailer-auth')) screen = currentMerchant ? 'catalogue' : 'admin-hub';
  if (isAdminLoggedIn && screen === 'admin-login') screen = 'admin-hub';
  const activeScreen: ActiveScreen =
    adminScreens.includes(screen) && !isAdminLoggedIn
      ? 'admin-login'
      : memberScreens.includes(screen) && !isSignedIn
        ? 'retailer-auth'
        : screen;

  const shouldShowBottomNav = ['catalogue', 'categories', 'orders', 'admin-hub'].includes(activeScreen);

  if (booting) return <div className="min-h-screen bg-surface" />;

  return (
    <div className="min-h-screen bg-surface text-on-surface flex flex-col font-sans selection:bg-primary-fixed selection:text-primary">
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
            onNavigate={(next) => handleNavigate(next, true)}
            onLoginSuccess={(user) => {
              setCurrentMerchant(user);
              handleNavigate('catalogue', true);
              api.getOrders().then((result) => setOrders(result.items));
            }}
          />
        )}

        {activeScreen === 'admin-login' && (
          <AdminLoginScreen
            onNavigate={(next) => handleNavigate(next, true)}
            onAdminLoginSuccess={() => {
              setIsAdminLoggedIn(true);
              handleNavigate('admin-hub', true);
            }}
          />
        )}

        {activeScreen === 'admin-orders' && <AdminOrdersScreen />}

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
