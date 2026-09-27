import { useState, useEffect } from 'react';
import { ActiveScreen, Product, Category, OrderItem, AnalyticsData, VisitorKind } from './types';
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
import { AdminVisitorsScreen } from './components/AdminVisitorsScreen';
import { AdminBuyersScreen } from './components/AdminBuyersScreen';
import { ChangePasswordScreen } from './components/ChangePasswordScreen';
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
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [visitorKind, setVisitorKind] = useState<VisitorKind>('all');
  // Set when the owner has reset this buyer's password: they must choose a new one before using the catalogue.
  const [mustChangePassword, setMustChangePassword] = useState(false);

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
          setMustChangePassword(session.mustChangePassword);
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
  const handleConfirmOrder = async (): Promise<{ poId: string; totalNetGrams: number; whatsappMessage: string } | null> => {
    try {
      const result = await api.confirmOrder();
      // The server has turned the batch into an order; the next batch starts empty.
      setOrders([]);
      return result;
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

  // Product saved (new or edited): resolves true only when the server accepted it
  const handleProductSaved = async (prod: Partial<Product>, id?: string): Promise<boolean> => {
    try {
      if (id) {
        const updated = await api.updateProduct(id, prod);
        setProducts((prev) => prev.map((p) => (p.id === id ? updated : p)));
        // A product can move between categories, so take the counts from the server.
        api.getCategories().then((cats) => cats.length > 0 && setCategories(cats));
        return true;
      }
      const created = await api.createProduct(prod);
      setProducts((prev) => [created, ...prev]);
      // The server counts designs per category; keep the on-screen count in step without a reload.
      setCategories((prev) => prev.map((c) => (c.name === created.category ? { ...c, designCount: c.designCount + 1 } : c)));
      return true;
    } catch (err) {
      if (!(err instanceof ApiError && err.handled)) alert(err instanceof Error ? err.message : 'Could not publish the product.');
      return false;
    }
  };

  const handleProductDeleted = async (product: Product): Promise<boolean> => {
    try {
      await api.deleteProduct(product.id);
      setProducts((prev) => prev.filter((p) => p.id !== product.id));
      setCategories((prev) => prev.map((c) => (c.name === product.category ? { ...c, designCount: Math.max(0, c.designCount - 1) } : c)));
      return true;
    } catch (err) {
      if (!(err instanceof ApiError && err.handled)) alert(err instanceof Error ? err.message : 'Could not delete the product.');
      return false;
    }
  };

  // Category saved (new or edited): resolves true only when the server accepted it
  const handleCategorySaved = async (cat: Partial<Category>, id?: string): Promise<boolean> => {
    try {
      if (id) {
        const updated = await api.updateCategory(id, cat);
        setCategories((prev) => prev.map((c) => (c.id === id ? updated : c)));
        // A rename carries the category's products along.
        api.getProducts().then((prods) => prods.length > 0 && setProducts(prods));
        return true;
      }
      const created = await api.createCategory(cat);
      setCategories((prev) => [...prev, created]);
      return true;
    } catch (err) {
      if (!(err instanceof ApiError && err.handled)) alert(err instanceof Error ? err.message : 'Could not create the category.');
      return false;
    }
  };

  const handleCategoryDeleted = async (category: Category): Promise<boolean> => {
    try {
      await api.deleteCategory(category.id);
      setCategories((prev) => prev.filter((c) => c.id !== category.id));
      return true;
    } catch (err) {
      if (!(err instanceof ApiError && err.handled)) alert(err instanceof Error ? err.message : 'Could not delete the category.');
      return false;
    }
  };

  const handleFilterCategoryInCatalogue = (catName: string) => {
    // Promotion banners pass their own headline, which is not always a category: only filter on real categories.
    setCategoryFilter(categories.some((c) => c.name === catName) ? catName : null);
    handleNavigate('catalogue');
  };

  const openProductForm = (product: Product | null) => {
    setEditingProduct(product);
    handleNavigate('new-product');
  };

  const openCategoryForm = (category: Category | null) => {
    setEditingCategory(category);
    handleNavigate('add-category');
  };

  const handleLogout = () => {
    setAuthToken(null);
    setOrders([]);
    setCurrentMerchant(null);
    setIsAdminLoggedIn(false);
    setMustChangePassword(false);
    setEditingProduct(null);
    setEditingCategory(null);
    setCategoryFilter(null);
    handleNavigate('welcome');
  };

  // Members-only portal: signed-out visitors are sent to login / sign-up, and admin tools need an admin session.
  const memberScreens: ActiveScreen[] = merchant.catalogueAccess === 'login' ? ['catalogue', 'categories', 'orders'] : ['orders'];
  const adminScreens: ActiveScreen[] = ['admin-hub', 'new-product', 'add-category', 'admin-orders', 'admin-visitors', 'admin-buyers'];
  const buyerOnlyScreens: ActiveScreen[] = ['change-password'];
  let screen: ActiveScreen = currentScreen;
  if (isSignedIn && (screen === 'welcome' || screen === 'retailer-auth')) screen = currentMerchant ? 'catalogue' : 'admin-hub';
  if (isAdminLoggedIn && screen === 'admin-login') screen = 'admin-hub';
  const activeScreen: ActiveScreen =
    currentMerchant && mustChangePassword
      ? 'change-password'
      : adminScreens.includes(screen) && !isAdminLoggedIn
        ? 'admin-login'
        : (memberScreens.includes(screen) || buyerOnlyScreens.includes(screen)) && !isSignedIn
          ? 'retailer-auth'
          : buyerOnlyScreens.includes(screen) && !currentMerchant
            ? 'catalogue'
            : screen;

  const shouldShowBottomNav =
    ['catalogue', 'categories', 'orders', 'admin-hub'].includes(activeScreen) && !(currentMerchant && mustChangePassword);

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
          isEditing={(activeScreen === 'new-product' && editingProduct !== null) || (activeScreen === 'add-category' && editingCategory !== null)}
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
            isAdmin={isAdminLoggedIn}
            categoryFilter={categoryFilter}
            onClearCategoryFilter={() => setCategoryFilter(null)}
            onEditProduct={openProductForm}
            onAddToOrder={handleAddToOrder}
            onOpenQuotation={handleOpenQuotation}
            onNavigateCategories={() => handleNavigate('categories')}
          />
        )}

        {activeScreen === 'categories' && (
          <CategoriesScreen
            categories={categories}
            isAdmin={isAdminLoggedIn}
            onEditCategory={openCategoryForm}
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
            onLoginSuccess={(user, mustChange) => {
              setCurrentMerchant(user);
              setMustChangePassword(mustChange);
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

        {activeScreen === 'admin-visitors' && <AdminVisitorsScreen initialKind={visitorKind} />}

        {activeScreen === 'admin-buyers' && <AdminBuyersScreen />}

        {activeScreen === 'change-password' && (
          <ChangePasswordScreen
            required={mustChangePassword}
            onDone={() => {
              setMustChangePassword(false);
              alert('Your password has been changed.');
              handleNavigate('catalogue', true);
            }}
            onCancel={() => handleNavigate('catalogue')}
          />
        )}

        {activeScreen === 'admin-hub' && (
          <AdminHubScreen
            analytics={analytics}
            updatedAt={analyticsUpdatedAt}
            onNavigate={handleNavigate}
            onOpenVisitors={(kind) => {
              setVisitorKind(kind);
              handleNavigate('admin-visitors');
            }}
          />
        )}

        {activeScreen === 'new-product' && (
          <NewProductScreen
            key={editingProduct?.id ?? 'new'}
            categories={categories}
            editing={editingProduct}
            onNavigate={(next) => {
              if (next !== 'add-category') setEditingProduct(null);
              handleNavigate(next);
            }}
            onSave={handleProductSaved}
            onDelete={handleProductDeleted}
          />
        )}

        {activeScreen === 'add-category' && (
          <AddCategoryScreen
            key={editingCategory?.id ?? 'new'}
            editing={editingCategory}
            onNavigate={(next) => {
              setEditingCategory(null);
              handleNavigate(next);
            }}
            onSave={handleCategorySaved}
            onDelete={handleCategoryDeleted}
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
